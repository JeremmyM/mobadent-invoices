@echo off
title Mobadent Local Server & Tunnel
echo ========================================================
echo       INICIANDO SISTEMA MOBADENT LOCAL + ACCESO REMOTO
echo ========================================================
echo.

:: 1. Iniciar el servidor local FastAPI
echo [1/3] Levantando Backend FastAPI en el puerto 8000...
cd /d "C:\Users\jerem\OneDrive\Escritorio\movadent-invoices\backend"
start "Backend Mobadent" cmd /k "venv\Scripts\activate && uvicorn app.main:app --host 0.0.0.0 --port 8000"

:: 2. Esperar 3 segundos a que el servidor este arriba
timeout /t 3 >nul

:: 3. Iniciar el tunel publico gratuito de Cloudflare
echo [2/3] Creando enlace publico seguro con Cloudflare...
cd /d "C:\Users\jerem\OneDrive\Escritorio\movadent-invoices"
start "Tunel Cloudflare" cmd /k "cloudflared.exe tunnel --url http://localhost:8000"

:: 4. Abrir la interfaz local en tu navegador
echo [3/3] Abriendo el panel de control...
start "" "C:\Users\jerem\OneDrive\Escritorio\movadent-invoices\frontend\dashboard.html"

echo.
echo Todo listo. Revisa la ventana de Cloudflare para ver tu enlace publico.
pause