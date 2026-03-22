# One-click Windows debug run (single terminal).
# Starts TUI directly with Bun inspector.

$ErrorActionPreference = "Stop"
$RepoRoot = $PSScriptRoot + "\.."

Push-Location $RepoRoot
$failed = $false

try {
    Write-Host "==> Starting debug TUI (no build)..." -ForegroundColor Cyan
    Write-Host "Debugger URL: ws://localhost:6499/" -ForegroundColor Gray
    Write-Host "Mode: single terminal (use Cursor Debug Console)" -ForegroundColor Gray

    Set-Location "$RepoRoot\packages\opencode"
    bun run --inspect-wait=ws://localhost:6499/ --conditions=browser ./src/index.ts --log-level DEBUG
    if ($LASTEXITCODE -ne 0) {
        throw "debug run failed (exit code: $LASTEXITCODE)"
    }
}
catch {
    $failed = $true
    Write-Host "`nDebug run failed: $_" -ForegroundColor Red
    Read-Host "Press Enter To Exit"
}
finally {
    # Ensure we return to repo root even if the debug command is interrupted.
    Pop-Location
}

if ($failed) { exit 1 }
