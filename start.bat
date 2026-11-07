@echo off
chcp 65001 >nul
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js не найден. Установите Node.js 20 или новее.
  pause
  exit /b 1
)
where ollama >nul 2>nul
if errorlevel 1 (
  echo Ollama CLI не найдена. Игра запустится с локальным резервным разбором.
  echo Установите Ollama: https://ollama.com/download
  goto start_server
)
powershell -NoProfile -Command "try { Invoke-RestMethod -Uri 'http://127.0.0.1:11434/api/tags' -TimeoutSec 2 ^| Out-Null; exit 0 } catch { exit 1 }"
if errorlevel 1 (
  echo Запускаю службу Ollama...
  start "Ollama" /min cmd /c "ollama serve"
  timeout /t 5 /nobreak >nul
)
ollama list | findstr /i "qwen3:4b" >nul
if errorlevel 1 (
  echo Модель qwen3:4b не найдена. Загружаю её для работы игрового чата...
  ollama pull qwen3:4b
  if errorlevel 1 echo Не удалось загрузить модель. Игра продолжит работу в резервном режиме.
)
:start_server
echo Запуск локального сервера У Илем...
start "" cmd /c "timeout /t 2 >nul & start http://127.0.0.1:4173/"
node server.js
pause
