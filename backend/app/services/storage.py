import os
import io
import uuid
from PIL import Image, ImageOps
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

supabase: Client = None
if SUPABASE_URL and SUPABASE_KEY:
    try:
        supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
    except Exception as e:
        print(f"Error inicializando cliente Supabase: {e}")

def optimizar_imagen(file_bytes: bytes, max_ancho: int = 1800) -> tuple[bytes, str]:
    """
    Comprime la imagen reduciendo drásticamente el peso (WebP)
    sin perder legibilidad en números y textos finos.
    """
    try:
        img = Image.open(io.BytesIO(file_bytes))
        img = ImageOps.exif_transpose(img)

        if img.mode in ("RGBA", "P", "CMYK"):
            img = img.convert("RGB")

        ancho, alto = img.size
        if ancho > max_ancho:
            proporcion = max_ancho / float(ancho)
            nuevo_alto = int(float(alto) * float(proporcion))
            img = img.resize((max_ancho, nuevo_alto), Image.Resampling.LANCZOS)

        buffer = io.BytesIO()
        img.save(buffer, format="WEBP", quality=82, method=6)
        return buffer.getvalue(), "webp"
    except Exception as e:
        print(f"No se pudo optimizar la imagen (se enviará original): {e}")
        return file_bytes, "bin"

def subir_comprobante_a_nube(file_bytes: bytes, filename: str, carpeta: str = "facturas") -> str:
    """
    Sube el archivo optimizado a Supabase Storage y retorna el enlace público.
    carpeta: 'facturas' o 'transferencias'
    """
    if not supabase:
        print("Error: Supabase no está configurado en las variables de entorno.")
        return None

    try:
        es_pdf = filename.lower().endswith(".pdf")
        if es_pdf:
            archivo_final = file_bytes
            ext = "pdf"
            mime_type = "application/pdf"
        else:
            archivo_final, ext = optimizar_imagen(file_bytes)
            mime_type = f"image/{ext}"

        nombre_archivo = f"{carpeta}/{uuid.uuid4()}.{ext}"

        supabase.storage.from_("comprobantes").upload(
            path=nombre_archivo,
            file=archivo_final,
            file_options={"content-type": mime_type}
        )

        url_publica = supabase.storage.from_("comprobantes").get_public_url(nombre_archivo)
        return url_publica

    except Exception as e:
        print(f"Error al subir archivo a Supabase: {e}")
        return None