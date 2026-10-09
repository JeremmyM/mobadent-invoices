import os
import uuid
import re
import logging
from fastapi import UploadFile
from supabase import create_client, Client

logger = logging.getLogger("mobadent-storage")

SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_KEY = os.getenv("SUPABASE_KEY", "") or os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
# El bucket raíz es comprobantes
BUCKET_NAME = os.getenv("SUPABASE_BUCKET", "comprobantes")
# La carpeta interna donde se alojan
CARPETA_DESTINO = "facturas"

def get_supabase_client() -> Client | None:
    if SUPABASE_URL and SUPABASE_KEY:
        try:
            return create_client(SUPABASE_URL, SUPABASE_KEY)
        except Exception as e:
            logger.error(f"Error inicializando cliente de Supabase: {e}")
    return None

def limpiar_nombre_archivo(nombre: str) -> str:
    # Sanitizar caracteres para compatibilidad con URLs de Supabase
    nombre_seguro = re.sub(r'[^a-zA-Z0-9_.-]', '_', nombre)
    return nombre_seguro or "comprobante"

async def subir_archivo_supabase(file: UploadFile) -> str | None:
    """
    Sube un archivo al bucket 'comprobantes' dentro de la carpeta 'facturas/'
    y retorna su URL pública accesible.
    """
    client = get_supabase_client()
    if not client:
        logger.warning("Credenciales de Supabase no configuradas en .env.")
        return None

    try:
        contenido = await file.read()
        await file.seek(0)
        
        ext = os.path.splitext(file.filename or "")[1].lower()
        if not ext:
            ext = ".pdf" if "pdf" in (file.content_type or "") else ".jpg"
            
        nombre_base = limpiar_nombre_archivo(os.path.splitext(file.filename or "doc")[0])
        nombre_archivo = f"{uuid.uuid4().hex[:10]}_{nombre_base}{ext}"
        
        # Ruta completa dentro del bucket: facturas/nombre_archivo.ext
        ruta_remota = f"{CARPETA_DESTINO}/{nombre_archivo}"
        content_type = file.content_type or ("application/pdf" if ext == ".pdf" else "image/jpeg")

        # Subida con sobreescritura habilitada (upsert)
        client.storage.from_(BUCKET_NAME).upload(
            path=ruta_remota,
            file=contenido,
            file_options={"content-type": content_type, "upsert": "true"}
        )
        
        # Obtener URL pública
        url_publica = client.storage.from_(BUCKET_NAME).get_public_url(ruta_remota)
        logger.info(f"Archivo subido exitosamente a Supabase: {url_publica}")
        return url_publica

    except Exception as e:
        logger.error(f"Fallo al subir archivo a Supabase Storage: {e}")
        return None