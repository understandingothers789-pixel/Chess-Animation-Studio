@echo off
cd /d "%~dp0"
copy /b app.zip.part000+app.zip.part001+app.zip.part002+app.zip.part003 app.zip >nul
powershell.exe -NoProfile -Command "if ((Get-FileHash -Algorithm SHA256 'app.zip').Hash -ne '273d13a9de233a83b2dcb89b9db4f5fd132e37c4e75d2c3b9f081a28dfd30122') { throw 'Download verification failed' }; Expand-Archive -LiteralPath 'app.zip' -DestinationPath 'Chess Animation Studio' -Force; Start-Process -FilePath '.\Chess Animation Studio\Chess Animation Studio.exe' -WorkingDirectory '.\Chess Animation Studio'"
if errorlevel 1 pause
