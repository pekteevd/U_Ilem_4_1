@echo off
chcp 65001 >nul
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js не найден. Установите Node.js 20 или новее.
  pause
  exit /b 1
)
echo Запуск локального сервера У Илем...
start "" cmd /c "timeout /t 2 >nul & start http://127.0.0.1:4173/"
node server.js
pause
