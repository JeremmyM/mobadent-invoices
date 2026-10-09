import os
import io
import sys
import asyncio
import re
from typing import List, Optional, Tuple, Any
from pydantic import BaseModel, Field, field_validator
from PIL import Image
from dotenv import load_dotenv
from google import genai
from google.genai import types
from google.genai.errors import APIError
from fastapi import UploadFile

if getattr(sys, "frozen", False):
    BASE_DIR = sys._MEIPASS
else:
    BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

env_path = os.path.join(BASE_DIR, ".env")
if os.path.exists(env_path):
    load_dotenv(env_path)
else:
    load_dotenv()


def normalizar_fecha_latam(v: Any) -> Optional[str]:
    """
    Convierte fechas numéricas ecuatorianas/latinas (DD/MM/YYYY)
    estrictamente al formato ISO (YYYY-MM-DD).
    Ejemplo: 02/10/2026 -> 2026-10-02 (2 de octubre de 2026).
    """
    if not v or str(v).lower() in ["none", "null", "n/a", "s/f", ""]:
        return None
    v_str = str(v).strip()
    
    # 1. Ya viene en formato ISO YYYY-MM-DD
    if re.match(r"^\d{4}-\d{2}-\d{2}$", v_str):
        return v_str

    # 2. Formato latino DD/MM/YYYY o DD-MM-YYYY
    m = re.match(r"^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$", v_str)
    if m:
        dia, mes, anio = m.groups()
        return f"{anio}-{mes.zfill(2)}-{dia.zfill(2)}"

    # 3. Formato corto latino DD/MM/YY
    m_corto = re.match(r"^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2})$", v_str)
    if m_corto:
        dia, mes, anio_corto = m_corto.groups()
        anio = f"20{anio_corto}"
        return f"{anio}-{mes.zfill(2)}-{dia.zfill(2)}"

    return None


class ItemFacturaAI(BaseModel):
    descripcion: str = Field(default="", description="Nombre o descripción concisa del insumo")
    lote: Optional[str] = Field(default="N/A", description="Número de lote limpio si aparece, sino N/A")
    fecha_caducidad: Optional[str] = Field(default=None, description="Fecha de vencimiento/caducidad YYYY-MM-DD o null")
    cantidad: float = Field(default=1.0, description="Cantidad física")
    precio_unitario: float = Field(default=0.0, description="Precio unitario de lista")
    porcentaje_descuento: float = Field(default=0.0, description="Porcentaje de descuento efectivo consolidado (0 a 100)")
    subtotal: float = Field(default=0.0, description="Subtotal neto final tras descuento")
    categoria: Optional[str] = Field(default="General", description="Categoría clínica o Gasto Operativo")
    tarifa_iva: float = Field(default=15.0, description="Tarifa IVA aplicable: 15.0 o 0.0")

    @field_validator("fecha_caducidad", mode="before")
    @classmethod
    def validar_fecha_caducidad(cls, v: Any) -> Optional[str]:
        return normalizar_fecha_latam(v)


class FacturaExtraccionAI(BaseModel):
    proveedor_nombre: str = Field(default="Proveedor General", description="Razón social del emisor")
    proveedor_id_fiscal: str = Field(default="9999999999999", description="RUC o Cédula (13 dígitos)")
    numero_factura: str = Field(default="S/N", description="Número de factura (ej. 001-001-000000001)")
    fecha_emision: Optional[str] = Field(default=None, description="Fecha emisión YYYY-MM-DD")
    numero_autorizacion: Optional[str] = Field(default=None, description="Autorización SRI")
    base_iva_0: float = Field(default=0.0, description="Base imponible con tarifa 0%")
    base_iva_grabada: float = Field(default=0.0, description="Base imponible neta gravada con 15%")
    subtotal: float = Field(default=0.0, description="Subtotal neto gravado antes de impuestos")
    descuento_total: float = Field(default=0.0, description="Descuento global adicional no incluido en líneas")
    impuestos: float = Field(default=0.0, description="Valor del IVA 15%")
    total: float = Field(default=0.0, description="Total oficial final impreso en la factura")
    items: List[ItemFacturaAI] = Field(default_factory=list)

    @field_validator("fecha_emision", mode="before")
    @classmethod
    def validar_fecha_emision(cls, v: Any) -> Optional[str]:
        return normalizar_fecha_latam(v)


def obtener_claves_api() -> List[str]:
    raw_keys = os.getenv("GEMINI_API_KEY", "")
    if not raw_keys:
        raise RuntimeError("GEMINI_API_KEY no encontrada en el archivo .env.")
    return [k.strip() for k in raw_keys.split(",") if k.strip()]


def preparar_foto(file_bytes: bytes, mime_type: str) -> tuple[bytes, str]:
    if "pdf" in mime_type.lower():
        return file_bytes, "application/pdf"
    try:
        img = Image.open(io.BytesIO(file_bytes))
        if img.mode != "RGB":
            img = img.convert("RGB")
        max_dim = 1800
        if max(img.size) > max_dim:
            img.thumbnail((max_dim, max_dim), Image.Resampling.LANCZOS)
        buffer = io.BytesIO()
        img.save(buffer, format="JPEG", quality=80, optimize=True)
        return buffer.getvalue(), "image/jpeg"
    except Exception:
        return file_bytes, mime_type


async def procesar_documentos_factura(archivos: List[Tuple[bytes, str]]) -> FacturaExtraccionAI:
    claves = obtener_claves_api()

    prompt = (
        "Eres un auditor contable experto en insumos odontológicos y facturación comercial en Ecuador "
        "(ejemplos: Distridental, Prodentec, Dentalcorp, Krobalto).\n"
        "Analiza minuciosamente todas las hojas de la factura adjunta y extrae la información con máxima precisión matemática y fiscal.\n\n"
        "REGLAS OBLIGATORIAS DE EXTRACCIÓN (ECUADOR):\n"
        "1. FECHAS:\n"
        "   - 'fecha_emision': En Ecuador siempre viene en formato DD-MM-YYYY o DD/MM/YYYY. "
        "Conviértela estrictamente a formato ISO 'YYYY-MM-DD' (ejemplo: '02-10-2026' es 2 de octubre -> '2026-10-02').\n"
        "2. DESCUENTOS EN CASCADA / DOS COLUMNAS DE DESCUENTO:\n"
        "   - En proveedores como Distridental pueden existir dos columnas contiguas de descuento (ejemplo: '50.00' y '20.00').\n"
        "   - Esto es un descuento en cascada: 1 - (1 - d1/100) * (1 - d2/100). "
        "Para 50% y 20%: 1 - (0.50 * 0.80) = 60%. "
        "Debes calcular y devolver el 'porcentaje_descuento' consolidado final de esa línea (ejemplo: 60.0).\n"
        "   - Si la columna de descuento muestra un valor monetario directo (como en Dentalcorp), calcula el porcentaje correspondiente: "
        "(descuento / (cantidad * precio_unitario)) * 100.\n"
        "3. LOTE Y CADUCIDAD:\n"
        "   - En Distridental: el lote aparece bajo la descripción ('Lote C843N') y la fecha en la columna contigua ('29/02/2028').\n"
        "   - En Prodentec: figura en 'Det. Adicional' como 'Lote: XXXXX Ven.DD/MM/AAAA'.\n"
        "   - En Dentalcorp / Krobalto: busca columnas 'LOTE' o 'Lote - Cant. / Serie'.\n"
        "   - Extrae 'lote' limpio (sin la palabra Lote). Si no figura, pon 'N/A'.\n"
        "   - Extrae 'fecha_caducidad' en formato ISO 'YYYY-MM-DD'. Si no figura, pon null.\n"
        "4. LÍNEAS DE ENVÍO / FLETE Y TARIFA IVA:\n"
        "   - Si una línea dice 'COSTO DE ENVIO', 'FLETE' o 'TRANSPORTE', clasifícala con categoría 'Gasto Operativo'.\n"
        "   - Si la factura en su liquidación final cobra IVA 15% sobre el envío (como en Distridental), asigna 'tarifa_iva': 15.0 a esa línea. "
        "Si está exenta, pon 0.0.\n"
        "5. RESUMEN DE TOTALES Y DESCUENTOS GLOBALES:\n"
        "   - Si los ítems ya reflejan el descuento en su valor neto, 'descuento_total' debe ser 0.00 para NO restar deducciones dos veces.\n"
        "   - 'subtotal': Corresponde al SubTotal neto gravado antes del IVA (ejemplo: 142.52 en Distridental). No tomes la base bruta que no tiene los descuentos descontados.\n"
        "   - 'impuestos': El valor monetario del IVA 15% liquidado (ejemplo: 21.38).\n"
        "   - 'total': El 'Total a Pagar' o 'Valor Total' oficial impreso al pie de la factura (ejemplo: 163.90, 88.41, 662.27, 150.49).\n"
        "6. CATEGORÍAS VÁLIDAS POR ÍTEM:\n"
        "   - 'Restauración & Estética', 'Endodoncia', 'Ortodoncia', 'Periodoncia & Profilaxis', 'Impresión & Modelos', "
        "'Prótesis & Laboratorio', 'Instrumental & Fresas', 'Bioseguridad & Esterilización', 'Equipos & Repuestos', "
        "'Gasto Operativo' o 'General'."
    )

    partes = []
    for f_bytes, m_type in archivos:
        datos, mime = preparar_foto(f_bytes, m_type)
        partes.append(types.Part.from_bytes(data=datos, mime_type=mime))

    partes.append(prompt)

    modelos = [
        "gemini-flash-lite-latest",
        "gemini-3.7-flash",
        "gemini-3.1-flash-lite",
    ]

    ultimo_error = None

    for api_key in claves:
        client = genai.Client(api_key=api_key)

        for model_name in modelos:
            try:
                response = await asyncio.to_thread(
                    client.models.generate_content,
                    model=model_name,
                    contents=partes,
                    config=types.GenerateContentConfig(
                        response_mime_type="application/json",
                        response_schema=FacturaExtraccionAI,
                        temperature=0.1,
                    )
                )

                if response and response.text:
                    resultado = FacturaExtraccionAI.model_validate_json(response.text.strip())
                    return resultado

            except Exception as e:
                ultimo_error = e
                await asyncio.sleep(0.2)
                continue

    raise RuntimeError(f"Fallo al procesar con IA: {str(ultimo_error)}")


# =========================================================================
# ADAPTADOR PARA FASTAPI (main.py)
# =========================================================================
async def extraer_datos_factura(files: List[UploadFile]) -> dict:
    """
    Lee los UploadFile de FastAPI, los transforma a tuplas (bytes, mime_type),
    ejecuta procesar_documentos_factura y estructura la respuesta para el frontend.
    """
    archivos_procesados: List[Tuple[bytes, str]] = []

    for f in files:
        contenido = await f.read()
        mime = f.content_type or "image/jpeg"
        if f.filename and f.filename.lower().endswith(".pdf"):
            mime = "application/pdf"
        archivos_procesados.append((contenido, mime))

    resultado: FacturaExtraccionAI = await procesar_documentos_factura(archivos_procesados)

    # Convertir a dict
    data = resultado.model_dump() if hasattr(resultado, "model_dump") else resultado.dict()

    # Mapear campo 'proveedor_nombre' a 'proveedor' para coincidir con el formulario
    data["proveedor"] = data.get("proveedor_nombre", "Proveedor General")
    return data