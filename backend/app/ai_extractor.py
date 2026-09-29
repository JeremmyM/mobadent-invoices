import os
import io
import asyncio
from PIL import Image, ImageOps
from google import genai
from google.genai import types
from google.genai.errors import ServerError, ClientError
from .config import GEMINI_API_KEY
from .schemas import FacturaExtraccionAI

if not GEMINI_API_KEY:
    raise RuntimeError("ERROR: GEMINI_API_KEY no está configurada en el archivo .env.")

client = genai.Client(api_key=GEMINI_API_KEY)

# Modelos oficiales vigentes requeridos por la API de Google
MODELOS_PRIORITARIOS = [
    "gemini-2.5-flash",
    "gemini-2.5-flash-lite"
]

def preparar_foto(file_bytes: bytes, mime_type: str) -> tuple[bytes, str]:
    """Reduce la imagen a un peso ultra-liviano (máx 1200px) para acelerar la subida."""
    if "image" not in mime_type:
        return file_bytes, mime_type
    
    try:
        img = Image.open(io.BytesIO(file_bytes))
        img = ImageOps.exif_transpose(img)
        if img.mode in ("RGBA", "P"):
            img = img.convert("RGB")
        
        max_dim = 1200
        if max(img.size) > max_dim:
            img.thumbnail((max_dim, max_dim), Image.Resampling.LANCZOS)
        
        buf = io.BytesIO()
        img.save(buf, format="JPEG", quality=75, optimize=True)
        return buf.getvalue(), "image/jpeg"
    except Exception:
        return file_bytes, mime_type

async def procesar_documento_factura(file_bytes: bytes, mime_type: str) -> FacturaExtraccionAI:
    bytes_listos, mime_listo = preparar_foto(file_bytes, mime_type)

    prompt = """
    Eres un auditor contable de máxima precisión para Mobadent.
    Analiza esta factura física o digital y extrae los datos respetando la cuadratura matemática:

    1. PROVEEDOR Y FACTURA:
       - Razón social, RUC/NIF del emisor y número oficial de factura.
       - Fecha de emisión en formato YYYY-MM-DD.

    2. DETALLE DE ÍTEMS:
       - Código o lote (si existe, sino N/A), descripción del insumo dental.
       - Cantidad, precio unitario de lista y porcentaje de descuento (% Dcto).
       - El subtotal de la línea debe ser neto: subtotal = (cantidad * precio_unitario) * (1 - descuento/100).

    3. CUADRE ARITMÉTICO:
       - subtotal: suma exacta de subtotales netos de todas las líneas.
       - base_iva_0: suma de líneas exentas de IVA.
       - base_iva_grabada: suma de líneas gravadas con IVA.
       - impuestos: valor del IVA liquidado.
       - total: subtotal + impuestos (o el total neto final impreso en la factura).
    """

    ultimo_error = None

    for modelo in MODELOS_PRIORITARIOS:
        for intento in range(2):
            try:
                response = await asyncio.wait_for(
                    client.aio.models.generate_content(
                        model=modelo,
                        contents=[
                            types.Part.from_bytes(data=bytes_listos, mime_type=mime_listo),
                            prompt
                        ],
                        config=types.GenerateContentConfig(
                            response_mime_type="application/json",
                            response_schema=FacturaExtraccionAI,
                            temperature=0.0
                        )
                    ),
                    timeout=25.0
                )
                return FacturaExtraccionAI.model_validate_json(response.text)

            except asyncio.TimeoutError:
                ultimo_error = "Tiempo de espera agotado (Timeout)."
                break

            except (ServerError, ClientError) as e:
                err_msg = str(e)
                ultimo_error = err_msg
                if "503" in err_msg or "429" in err_msg or "UNAVAILABLE" in err_msg:
                    await asyncio.sleep(2)
                    continue
                else:
                    break

            except Exception as e:
                ultimo_error = str(e)
                break

    raise RuntimeError(f"No fue posible completar la extracción. Detalle: {ultimo_error}")