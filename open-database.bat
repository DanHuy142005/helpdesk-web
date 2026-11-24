@echo off
setlocal
title NexDesk - PostgreSQL
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\run-local.ps1" -DatabaseViewer %*
set "taskExitCode=%errorlevel%"
if not "%taskExitCode%"=="0" pause
exit /b %taskExitCode%
