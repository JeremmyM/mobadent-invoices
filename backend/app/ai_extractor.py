import os
import io
import sys
import asyncio
from typing import List, Optional, Tuple
from pydantic import BaseModel, Field
from PIL import Image
from dotenv import load_dotenv
from google import genai
from google.genai import types
from google.genai.errors import APIError

if getattr(sys, "frozen", False):
    BASE_DIR = sys._MEIPASS
else:
    BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

env_path = os.path.join(BASE_DIR, ".env")
if os.path.exists(env_path):
    load_dotenv(env_path)
else:
    load_dotenv()

class ItemFacturaAI(BaseModel):
    descripcion: str = Field(description="Nombre o descripción concisa del insumo o servicio")
    lote: Optional[str] = Field(default="N/A", description="Número de lote si aparece, sino N/A")
    cantidad: float = Field(default=1.0, description="Cantidad física adquirida")
    precio_unitario: float = Field(default=0.0, description="Precio unitario bruto de lista")
    porcentaje_descuento: float = Field(default=0.0, description="Porcentaje de descuento aplicado (0 a 100)")
    subtotal: float = Field(default=0.0, description="Subtotal neto final tras descuento")
    categoria: Optional[str] = Field(
        default="General", 
        description=(
            "Categoría exacta según el tipo de producto odontológico: "
            "'Restauración & Estética' (resinas, adhesivos, composites, ácidos), "
            "'Endodoncia' (limas, conos gutapercha/papel, cementos endo, irrigantes), "
            "'Ortodoncia' (brackets, arcos, ligaduras, tubos, botones), "
            "'Periodoncia & Profilaxis' (pastas profilácticas, copas de caucho, curetas), "
            "'Impresión & Modelos' (alginatos, siliconas, yesos, cubetas), "
            "'Prótesis & Laboratorio' (acrílicos, dientes, ceras, discos), "
            "'Instrumental & Fresas' (fresas diamante/carburo, pinzas, espejos, exploradores), "
            "'Bioseguridad & Esterilización' (guantes, mascarillas, baberos, eyectores, campos, fundas autoclave, desinfectantes), "
            "'Equipos & Repuestos' (lámparas fotocurado, turbinas, repuestos sillón), "
            "'Gasto Operativo' (fletes, envíos, transporte, embalaje), "
            "o 'General'."
        )
    )

class FacturaExtraccionAI(BaseModel):
    proveedor_nombre: str = Field(description="Razón social del emisor")
    proveedor_id_fiscal: str = Field(description="RUC o Cédula. Si no existe, '9999999999999'")
    numero_factura: str = Field(description="Número de factura o comprobante (ej: 001-011-000006114)")
    fecha_emision: Optional[str] = Field(default=None, description="Fecha de emisión YYYY-MM-DD")
    numero_autorizacion: Optional[str] = Field(default=None, description="Número de autorización fiscal")
    base_iva_0: float = Field(default=0.0, description="Subtotal tarifa 0%")
    base_iva_grabada: float = Field(default=0.0, description="Subtotal base imponible gravada (15%)")
    subtotal: float = Field(default=0.0, description="Subtotal general de la factura")
    descuento_total: float = Field(default=0.0, description="Descuento total de la factura")
    impuestos: float = Field(default=0.0, description="Valor del IVA liquidado")
    total: float = Field(default=0.0, description="Total final consolidado a pagar")
    items: List[ItemFacturaAI] = Field(default_factory=list, description="Lista unificada de todas las hojas")

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
        "Eres un auditor y clasificador experto en insumos de odontología y depósitos dentales. "
        "Se te proporcionan una o varias hojas que pertenecen a la MISMA factura comercial. "
        "Consolida todos los ítems de todas las páginas en una única lista secuencial. "
        "DISTINCIÓN DE GASTOS: Si un ítem corresponde a flete, transporte, envío, embalaje o servicios logísticos y no a un insumo, asigna en 'categoria' el valor exacto 'Gasto Operativo'. "
        "CATEGORÍAS CLÍNICAS PRECISAS: Clasifica cada producto en una de las siguientes opciones obligatorias: "
        "'Restauración & Estética', 'Endodoncia', 'Ortodoncia', 'Periodoncia & Profilaxis', "
        "'Impresión & Modelos', 'Prótesis & Laboratorio', 'Instrumental & Fresas', "
        "'Bioseguridad & Esterilización', 'Equipos & Repuestos', o 'General'. "
        "ATENCIÓN A DESCUENTOS: Si una línea tiene descuento, extrae el porcentaje en 'porcentaje_descuento' (0 a 100). "
        "Para 'descripcion', extrae únicamente el nombre conciso comercial del insumo sin textos accesorios."
    )

    partes = []
    for f_bytes, m_type in archivos:
        datos, mime = preparar_foto(f_bytes, m_type)
        partes.append(types.Part.from_bytes(data=datos, mime_type=mime))

    partes.append(prompt)

    modelos_confirmados = [
        "gemini-flash-lite-latest",
        "gemini-3.7-flash",
        "gemini-3.1-flash-lite"
    ]

    ultimo_error = None

    for api_key in claves:
        client = genai.Client(api_key=api_key)

        for model_name in modelos_confirmados:
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

            except APIError as err:
                ultimo_error = err
                await asyncio.sleep(0.3)
                continue
            except Exception as e:
                ultimo_error = e
                await asyncio.sleep(0.3)
                continue

    raise RuntimeError(f"Fallo al procesar comprobante multi-hoja: {str(ultimo_error)}")