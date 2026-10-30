@echo off
cd /d "%~dp0"
copy /b app.zip.part000+app.zip.part001+app.zip.part002+app.zip.part003 Chess-Animation-Studio-0.1.2.zip >nul
powershell.exe -NoProfile -Command "if ((Get-FileHash -Algorithm SHA256 'Chess-Animation-Studio-0.1.2.zip').Hash -ne 'd61ef669160cb9859a51271a64e3ead4d230e5a4a28d7df29bff682a46f1c0b7') { throw 'Download verification failed' }; Expand-Archive -LiteralPath 'Chess-Animation-Studio-0.1.2.zip' -DestinationPath 'Chess Animation Studio 0.1.2' -Force; Start-Process -FilePath '.\Chess Animation Studio 0.1.2\Chess Animation Studio.exe' -WorkingDirectory '.\Chess Animation Studio 0.1.2'"
if errorlevel 1 pause
