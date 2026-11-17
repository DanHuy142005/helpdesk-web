@echo off
setlocal
title Nova IT Helpdesk - Local Server
where powershell.exe >nul 2>&1
if errorlevel 1 (
    echo Can Windows 10/11 va Windows PowerShell 5.1 de chay web.
    pause
    exit /b 1
)

powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\run-local.ps1" %*
set "taskExitCode=%errorlevel%"
if not "%taskExitCode%"=="0" pause
exit /b %taskExitCode%
