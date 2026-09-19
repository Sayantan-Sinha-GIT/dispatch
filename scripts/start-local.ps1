# Starts the five test instances, one per role, each in its own window.
#
# Run this from your own terminal rather than letting the assistant start them:
# servers started inside an assistant session are torn down when that session
# goes idle, which looks exactly like the app crashing.
#
#   powershell -ExecutionPolicy Bypass -File scripts\start-local.ps1
#
# Use the *.localhost names, not localhost:<port>. Cookies are scoped by host
# and ignore the port, so five bare ports would share a single login.

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot

$instances = @(
    @{ Port = 3000; Url = "http://admin.localhost:3000"; Role = "Admin" }
    @{ Port = 3001; Url = "http://c1.localhost:3001";    Role = "Customer 1" }
    @{ Port = 3002; Url = "http://c2.localhost:3002";    Role = "Customer 2" }
    @{ Port = 3003; Url = "http://r1.localhost:3003";    Role = "Rider 1" }
    @{ Port = 3004; Url = "http://r2.localhost:3004";    Role = "Rider 2" }
)

if (-not (Test-Path (Join-Path $root ".next"))) {
    Write-Host "No production build found — running npm run build first..." -ForegroundColor Yellow
    Push-Location $root
    npm run build
    Pop-Location
}

foreach ($i in $instances) {
    Start-Process -FilePath "cmd.exe" `
        -ArgumentList "/c", "title Dispatch $($i.Role) :$($i.Port) && npx next start -p $($i.Port)" `
        -WorkingDirectory $root
    Start-Sleep -Milliseconds 400
}

Write-Host ""
Write-Host "Five instances starting. Give them a few seconds, then open:" -ForegroundColor Green
foreach ($i in $instances) {
    "{0,-12} {1}" -f $i.Role, $i.Url | Write-Host
}
Write-Host ""
Write-Host "Close the five console windows to stop them." -ForegroundColor DarkGray
