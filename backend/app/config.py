import os
import sys
from dotenv import load_dotenv

# Detectar ruta base en entorno normal o empaquetado (PyInstaller)
if getattr(sys, 'frozen', False):
    base_dir = getattr(sys, '_MEIPASS', os.path.dirname(sys.executable))
    ruta_env_meipass = os.path.join(base_dir, ".env")
    ruta_env_exe = os.path.join(os.path.dirname(sys.executable), ".env")
    
    if os.path.exists(ruta_env_meipass):
        load_dotenv(ruta_env_meipass)
    elif os.path.exists(ruta_env_exe):
        load_dotenv(ruta_env_exe)
else:
    # Modo desarrollo
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    load_dotenv(os.path.join(base_dir, ".env"))

# Variables de entorno
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
DATABASE_URL = os.getenv("DATABASE_URL")

# Adaptación para Neon / SQLAlchemy (PostgreSQL requiere postgresql://)
if DATABASE_URL and DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)