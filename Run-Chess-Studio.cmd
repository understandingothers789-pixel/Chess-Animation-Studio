@echo off
cd /d "%~dp0"
copy /b app.zip.part000+app.zip.part001+app.zip.part002+app.zip.part003 app.zip >nul
powershell.exe -NoProfile -Command "if ((Get-FileHash -Algorithm SHA256 'app.zip').Hash -ne 'f91a69b1ff4f7f5b172a7e1493a1c7b64ae7a7d27d563f18b71e45642e9c8fd7') { throw 'Download verification failed' }; Expand-Archive -LiteralPath 'app.zip' -DestinationPath 'Chess Animation Studio' -Force; Start-Process -FilePath '.\Chess Animation Studio\Chess Animation Studio.exe' -WorkingDirectory '.\Chess Animation Studio'"
if errorlevel 1 pause
