@echo off
echo Stopping CareAudit AI servers...
taskkill /FI "WINDOWTITLE eq CareAudit-Backend" /F 2>nul
echo Backend stopped.
echo Frontend: Close the terminal window or press Ctrl+C.
pause
