@echo off
echo ================================
echo Meta Upload Dashboard Launcher
echo ================================
echo.

cd /d "%~dp0"

echo Checking Python installation...
python --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Python not found!
    echo Please install Python 3.8+ from https://www.python.org/
    pause
    exit /b 1
)

echo.
echo Checking PySide6...
python -c "import PySide6" >nul 2>&1
if errorlevel 1 (
    echo PySide6 not installed. Installing now...
    pip install PySide6
) else (
    echo PySide6 is installed.
)

echo.
echo Launching Meta Upload Dashboard...
python main.py

pause
