@echo off
title Cerrando Mobadent
echo Deteniendo Backend y Tunel de Cloudflare...
taskkill /f /im uvicorn.exe >nul 2>&1
taskkill /f /im cloudflared.exe >nul 2>&1
taskkill /f /im python.exe >nul 2>&1
echo Todo detenido correctamente.
timeout /t 2 >nul
exit