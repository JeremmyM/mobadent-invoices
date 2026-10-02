import os
import sys
import ctypes

try:
    myappid = 'mobadent.invoices.desktop.app'
    ctypes.windll.shell32.SetCurrentProcessExplicitAppUserModelID(myappid)
except Exception:
    pass

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
import socket
import subprocess
import threading
import uvicorn

if getattr(sys, 'frozen', False):
    BASE_DIR = getattr(sys, '_MEIPASS', os.path.dirname(sys.executable))
else:
    BASE_DIR = os.path.dirname(os.path.abspath(__file__))

os.chdir(BASE_DIR)
sys.path.insert(0, BASE_DIR)

from app.main import app

def puerto_activo(host="127.0.0.1", port=8000) -> bool:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.settimeout(0.15)
        return s.connect_ex((host, port)) == 0

def abrir_ventana():
    url = "http://127.0.0.1:8000/frontend/dashboard.html"
    
    # Sondeo rápido: abre apenas el puerto 8000 responda
    for _ in range(80):
        if puerto_activo():
            break
        time.sleep(0.1)

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
    hilo_interfaz = threading.Thread(target=abrir_ventana, daemon=True)
    hilo_interfaz.start()

    uvicorn.run(
        app,
        host="127.0.0.1",
        port=8000,
        log_config=None,
        access_log=False
    )