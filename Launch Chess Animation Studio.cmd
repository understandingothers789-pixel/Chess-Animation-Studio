@echo off
cd /d "%~dp0"
copy /b chess-app.part000+chess-app.part001+chess-app.part002+chess-app.part003+chess-app.part004 "Chess Animation Studio.exe" >nul
powershell.exe -NoProfile -Command "if ((Get-FileHash -Algorithm SHA256 'Chess Animation Studio.exe').Hash -ne '4fafd02cd412ccd5fa8fe101958df2d46717faebbfad24274a25556b744f5258') { throw 'Download verification failed' }; Start-Process -FilePath '.\Chess Animation Studio.exe' -WorkingDirectory '%~dp0'"
if errorlevel 1 pause
