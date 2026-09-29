import os
import sys
import ctypes

# 1. Asignar ID único en Windows para separar el icono en la barra de tareas
try:
    myappid = 'mobadent.invoices.desktop.app'
    ctypes.windll.shell32.SetCurrentProcessExplicitAppUserModelID(myappid)
except Exception:
    pass

# 2. Resolver el problema de sys.stdout/sys.stderr en modo sin consola (--noconsole)
class NullWriter:
    def write(self, s):
        pass
    def flush(self):
        pass
    def isatty(self):
        return False

if sys.stdout is None:
    sys.stdout = NullWriter()
if sys.stderr is None:
    sys.stderr = NullWriter()

import time
import subprocess
import urllib.request
import threading
import uvicorn

# Configuración de rutas para PyInstaller
if getattr(sys, 'frozen', False):
    BASE_DIR = getattr(sys, '_MEIPASS', os.path.dirname(sys.executable))
else:
    BASE_DIR = os.path.dirname(os.path.abspath(__file__))

os.chdir(BASE_DIR)
sys.path.insert(0, BASE_DIR)

from app.main import app

def esperar_servidor_activo(url="http://127.0.0.1:8000/docs", timeout=25):
    """Verifica periódicamente que el servidor responda."""
    inicio = time.time()
    while time.time() - inicio < timeout:
        try:
            with urllib.request.urlopen(url) as res:
                if res.status in (200, 404):
                    return True
        except Exception:
            time.sleep(0.4)
    return False

def abrir_ventana():
    """Abre la interfaz web aislada una vez que el servidor esté activo."""
    url = "http://127.0.0.1:8000/frontend/dashboard.html"
    
    esperar_servidor_activo()

    rutas_navegadores = [
        r"C:\Program Files\Google\Chrome\Application\chrome.exe",
        r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
        r"C:\Program Files\Microsoft\Edge\Application\msedge.exe",
        r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
    ]

    navegador = None
    for ruta in rutas_navegadores:
        if os.path.exists(ruta):
            navegador = ruta
            break

    # Carpeta de perfil aislada para que no mezcle el icono con ventanas normales del navegador
    user_data_path = os.path.join(os.environ.get("LOCALAPPDATA", "."), "MobadentAppProfile")

    if navegador:
        subprocess.Popen([
            navegador,
            f"--app={url}",
            f"--user-data-dir={user_data_path}",
            "--window-size=1350,880"
        ])
    else:
        import webbrowser
        webbrowser.open(url)

if __name__ == "__main__":
    # Lanzar el navegador en un hilo secundario
    hilo_interfaz = threading.Thread(target=abrir_ventana, daemon=True)
    hilo_interfaz.start()

    # Correr Uvicorn desactivando el formato de logs problemático
    uvicorn.run(
        app,
        host="127.0.0.1",
        port=8000,
        log_config=None,
        access_log=False
    )