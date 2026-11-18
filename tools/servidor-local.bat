@echo off
rem Abre um servidor local para testar o sistema como se estivesse no GitHub Pages.
rem Uso: dois cliques neste arquivo.  Para outra porta:  servidor-local.bat 8090
rem      Para a IA local do simuladorlocal.html usar vários núcleos do processador:  servidor-local.bat 8080 isolado
set PORTA=%1
if "%PORTA%"=="" set PORTA=8080
set EXTRA=
if /I "%2"=="isolado" set EXTRA=-Isolado
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0servidor-local.ps1" -Porta %PORTA% %EXTRA%
pause
