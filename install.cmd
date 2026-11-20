@echo off
rem cmd.exe wrapper for the cross-platform installer. Options pass through: install.cmd --help
where node >nul 2>nul
if errorlevel 1 (
  echo error: node ^(^>= 18^) is required. Install it from https://nodejs.org and open a new terminal. 1>&2
  exit /b 1
)
node "%~dp0install.mjs" %*
exit /b %ERRORLEVEL%
