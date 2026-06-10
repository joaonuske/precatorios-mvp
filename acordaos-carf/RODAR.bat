@echo off
chcp 65001 >nul
cd /d "%~dp0"
py interface.py
if errorlevel 1 (
  echo.
  echo Falha ao abrir a interface. Rodando em modo lote...
  py processar_todos.py
  pause
)
