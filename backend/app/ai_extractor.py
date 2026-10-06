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
    descripcion: str = Field(default="", description="Nombre o descripción concisa del insumo")
    lote: Optional[str] = Field(default="N/A", description="Número de lote si aparece, sino N/A")
    fecha_caducidad: Optional[str] = Field(default=None, description="Fecha de vencimiento/caducidad YYYY-MM-DD o null")
    cantidad: float = Field(default=1.0, description="Cantidad física")
    precio_unitario: float = Field(default=0.0, description="Precio unitario")
    porcentaje_descuento: float = Field(default=0.0, description="Descuento (0 a 100)")
    subtotal: float = Field(default=0.0, description="Subtotal neto final tras descuento")
    categoria: Optional[str] = Field(default="General", description="Categoría clínica")

    @field_validator("fecha_caducidad", mode="before")
    @classmethod
    def normalizar_fecha(cls, v: Any) -> Optional[str]:
        if not v or str(v).lower() in ["none", "null", "n/a", "s/f", ""]:
            return None
        v_str = str(v).strip()
        m = re.match(r"^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$", v_str)
        if m:
            d, mes, a = m.groups()
            return f"{a}-{mes.zfill(2)}-{d.zfill(2)}"
        if re.match(r"^\d{4}-\d{2}-\d{2}$", v_str):
            return v_str
        return None

class FacturaExtraccionAI(BaseModel):
    proveedor_nombre: str = Field(default="Proveedor General", description="Razón social del emisor")
    proveedor_id_fiscal: str = Field(default="9999999999999", description="RUC o Cédula")
    numero_factura: str = Field(default="S/N", description="Número de factura o comprobante")
    fecha_emision: Optional[str] = Field(default=None, description="Fecha emisión YYYY-MM-DD")
    numero_autorizacion: Optional[str] = Field(default=None, description="Autorización SRI")
    base_iva_0: float = Field(default=0.0)
    base_iva_grabada: float = Field(default=0.0)
    subtotal: float = Field(default=0.0)
    descuento_total: float = Field(default=0.0)
    impuestos: float = Field(default=0.0)
    total: float = Field(default=0.0)
    items: List[ItemFacturaAI] = Field(default_factory=list)

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
        "Eres un auditor y clasificador experto en insumos odontológicos. "
        "Consolida todos los ítems de las hojas de la factura. "
        "CAMPOS OBLIGATORIOS POR ÍTEM: "
        "- 'descripcion': nombre conciso del insumo. "
        "- 'lote': número de lote o 'N/A' si no figura. "
        "- 'fecha_caducidad': fecha de vencimiento o EXP en formato 'YYYY-MM-DD' o null si no figura. "
        "- 'cantidad', 'precio_unitario', 'porcentaje_descuento', 'subtotal'. "
        "- 'categoria': clasifica en 'Restauración & Estética', 'Endodoncia', 'Ortodoncia', "
        "'Periodoncia & Profilaxis', 'Impresión & Modelos', 'Prótesis & Laboratorio', "
        "'Instrumental & Fresas', 'Bioseguridad & Esterilización', 'Equipos & Repuestos', "
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
        "gemini-3.1-flash-lite"
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