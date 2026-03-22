param(
    [string]$Path = "$HOME\.local\share\opencode\log\dev.log",
    [int]$Tail = 100
)

$ErrorActionPreference = "Stop"

Write-Host "Watching log: $Path" -ForegroundColor Cyan
Write-Host "Tail lines: $Tail" -ForegroundColor Gray

while (!(Test-Path $Path)) {
    Write-Host "Log file not found yet, waiting... ($Path)" -ForegroundColor Yellow
    Start-Sleep -Seconds 1
}

Write-Host "Log file found. Streaming..." -ForegroundColor Green
Get-Content -Path $Path -Tail $Tail -Wait
