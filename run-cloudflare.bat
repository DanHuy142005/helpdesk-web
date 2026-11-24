@echo off
call "%~dp0run.bat" -Cloudflare %*
exit /b %errorlevel%
