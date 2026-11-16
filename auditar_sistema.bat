@echo off
chcp 65001 > nul
echo ==================================================================================
echo   INICIANDO AUDITORIA TECNICA Y EVALUACION FORENSE LEY N 21.719
echo ==================================================================================
echo.

if exist .venv\Scripts\python.exe (
    .venv\Scripts\python.exe auditar_sistema.py %*
) else (
    python auditar_sistema.py %*
)

pause
