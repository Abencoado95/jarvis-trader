@echo off
echo INICIANDO JARVIS V4.2 (VERSAO SEGURA)...
echo.
echo Fechando processos antigos do Chrome para limpar memoria (opcional)...
taskkill /F /IM chrome.exe /T >nul 2>&1
echo.
echo Abrindo o PAINEL CORRETO...
start chrome "%~dp0index.html"
echo.
echo PRONTO! Verifique se aparece "JARVIS V4.2" no console (F12).
pause
