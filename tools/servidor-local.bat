@echo off
rem Abre um servidor local para testar o sistema como se estivesse no GitHub Pages.
rem Uso: dois cliques neste arquivo.  Para outra porta:  servidor-local.bat 8090
set PORTA=%1
if "%PORTA%"=="" set PORTA=8080
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0servidor-local.ps1" -Porta %PORTA%
pause
