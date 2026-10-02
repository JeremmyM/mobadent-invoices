Set WshShell = CreateObject("WScript.Shell")

' 1. Iniciar Backend FastAPI en segundo plano (0 = oculto, sin ventana)
WshShell.Run "cmd /c ""cd /d C:\Users\jerem\OneDrive\Escritorio\movadent-invoices\backend && venv\Scripts\activate && uvicorn app.main:app --host 0.0.0.0 --port 8000""", 0, False

' 2. Esperar 3 segundos para que levante el backend
WScript.Sleep 3000

' 3. Iniciar el tunel de Cloudflare en segundo plano (0 = oculto)
WshShell.Run "cmd /c ""cd /d C:\Users\jerem\OneDrive\Escritorio\movadent-invoices && cloudflared.exe tunnel --url http://localhost:8000""", 0, False

' 4. Abrir la interfaz como VENTANA INDEPENDIENTE de escritorio (Modo App nativo)
' Intenta abrir con Chrome; si no lo encuentra, usa Microsoft Edge
Dim chromePath, edgePath, urlApp
urlApp = "file:///C:/Users/jerem/OneDrive/Escritorio/movadent-invoices/frontend/dashboard.html"
chromePath = "C:\Program Files\Google\Chrome\Application\chrome.exe"
edgePath = "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"

Dim fso
Set fso = CreateObject("Scripting.FileSystemObject")

If fso.FileExists(chromePath) Then
    WshShell.Run """" & chromePath & """ --app=""" & urlApp & """ --window-size=1280,850", 1, False
ElseIf fso.FileExists(edgePath) Then
    WshShell.Run """" & edgePath & """ --app=""" & urlApp & """ --window-size=1280,850", 1, False
Else
    WshShell.Run """" & urlApp & """", 1, False
End If