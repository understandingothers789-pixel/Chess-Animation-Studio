@echo off
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0Assemble-and-run.ps1"
if errorlevel 1 pause
