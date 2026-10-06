import os
import sys
import io
import uuid
from PIL import Image, ImageOps
from supabase import create_client, Client
from dotenv import load_dotenv

if getattr(sys, "frozen", False):
    BASE_DIR = getattr(sys, "_MEIPASS", os.path.dirname(sys.executable))
    env_path = os.path.join(BASE_DIR, ".env")
    if os.path.exists(env_path):
        load_dotenv(env_path)
    else:
        load_dotenv()
else:
    BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    env_path = os.path.join(BASE_DIR, ".env")
    if os.path.exists(env_path):
        load_dotenv(env_path)
    else:
        load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

supabase: Client = None

def obtener_cliente_supabase():
    global supabase
    if supabase is not None:
        return supabase
    url = os.getenv("SUPABASE_URL") or SUPABASE_URL
    key = os.getenv("SUPABASE_KEY") or SUPABASE_KEY
    if url and key:
        try:
            supabase = create_client(url.strip(), key.strip())
            return supabase
        except Exception as e:
            print("Error inicializando Supabase:", e)
    return None

def optimizar_imagen(file_bytes: bytes, max_ancho: int = 1800) -> tuple[bytes, str]:
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
        img.save(buffer, format="JPEG", quality=82)
        return buffer.getvalue(), "jpg"
    except Exception as e:
        print("Aviso al optimizar imagen:", e)
        return file_bytes, "jpg"

def subir_comprobante_a_nube(file_bytes: bytes, filename: str, carpeta: str = "facturas") -> str:
    cli = obtener_cliente_supabase()
    if not cli:
        print("Error: No hay cliente Supabase disponible.")
        return None

    try:
        es_pdf = filename.lower().endswith(".pdf")
        if es_pdf:
            archivo_final = file_bytes
            ext = "pdf"
            mime_type = "application/pdf"
        else:
            archivo_final, ext = optimizar_imagen(file_bytes)
            mime_type = "image/jpeg"

        nombre_archivo = f"{carpeta}/{uuid.uuid4()}.{ext}"

        # Subida con sobreescritura habilitada al bucket 'comprobantes'
        cli.storage.from_("comprobantes").upload(
            path=nombre_archivo,
            file=archivo_final,
            file_options={"content-type": mime_type, "upsert": "true"}
        )

        url_publica = cli.storage.from_("comprobantes").get_public_url(nombre_archivo)
        return url_publica
    except Exception as e:
        print(f"Error detallado en Supabase Storage: {e}")
        return None