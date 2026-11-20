# PowerShell wrapper for the cross-platform installer (Windows PowerShell 5.1 and PowerShell 7).
#   .\install.ps1                      install for every detected agent
#   .\install.ps1 --harness claude     only Claude Code
#   .\install.ps1 --uninstall          remove what was installed
# If scripts are blocked: powershell -ExecutionPolicy Bypass -File .\install.ps1
$ErrorActionPreference = 'Stop'
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  Write-Error 'node (>= 18) is required. Install it from https://nodejs.org (or: winget install OpenJS.NodeJS.LTS), open a new terminal and run this again.'
  exit 1
}
& node (Join-Path $PSScriptRoot 'install.mjs') @args
exit $LASTEXITCODE
