@echo off
cd /d "%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0deployment\start-backend-service.ps1" -InstallAutoStart -Restart
pause
