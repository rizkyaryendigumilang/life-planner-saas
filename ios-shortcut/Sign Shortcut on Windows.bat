@echo off
cd /d "%~dp0"
python sign_life_planner_shortcut.py
if errorlevel 1 (
  echo.
  echo Signing failed. Check internet access, then read README-ID.txt.
  pause
  exit /b 1
)
echo.
echo Signed file created. Send it to your iPhone and import it in Shortcuts.
pause
