@echo off
cd /d "%~dp0"
copy /b app.zip.part000+app.zip.part001+app.zip.part002+app.zip.part003 "Chess-Animation-Studio-0.1.4.zip" >nul
powershell.exe -NoProfile -Command "if ((Get-FileHash -Algorithm SHA256 'Chess-Animation-Studio-0.1.4.zip').Hash -ne '47cb427ee7a02cf5af87641d55eb9aa188a88aa16fd9ea9758461d7e235c8aed') { throw 'Download verification failed' }; Expand-Archive -LiteralPath 'Chess-Animation-Studio-0.1.4.zip' -DestinationPath 'Chess Animation Studio 0.1.4' -Force; Start-Process -FilePath '.\Chess Animation Studio 0.1.4\Chess Animation Studio.exe' -WorkingDirectory '.\Chess Animation Studio 0.1.4'"
if errorlevel 1 pause
