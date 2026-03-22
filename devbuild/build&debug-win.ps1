# One-click Windows build + debug run (single terminal).
# Builds first, then starts TUI directly with Bun inspector.

$ErrorActionPreference = "Stop"
$RepoRoot = $PSScriptRoot + "\.."

Push-Location $RepoRoot
$failed = $false

try {
    Write-Host "==> Installing dependencies (bun install)..." -ForegroundColor Cyan
    bun install
    if ($LASTEXITCODE -ne 0) { throw "bun install failed" }

    Write-Host "`n==> Typecheck (bun run typecheck)..." -ForegroundColor Cyan
    bun run typecheck
    if ($LASTEXITCODE -ne 0) { throw "typecheck failed" }

    Write-Host "`n==> Building OpenCode CLI (Windows x64)..." -ForegroundColor Cyan
    Set-Location "$RepoRoot\packages\opencode"
    bun run build --single
    if ($LASTEXITCODE -ne 0) { throw "CLI build failed" }

    Write-Host "`n==> Build finished. Starting debug TUI..." -ForegroundColor Green
    Write-Host "Debugger URL: ws://localhost:6499/" -ForegroundColor Gray
    Write-Host "Mode: single terminal (use Cursor Debug Console)" -ForegroundColor Gray

    Set-Location "$RepoRoot\packages\opencode"
    bun run --inspect-wait=ws://localhost:6499/ --conditions=browser ./src/index.ts --log-level DEBUG
    if ($LASTEXITCODE -ne 0) {
        throw "debug start failed (exit code: $LASTEXITCODE)"
    }
}
catch {
    $failed = $true
    Write-Host "`nBuild/Debug failed: $_" -ForegroundColor Red
    Read-Host "Press Enter to exit"
}
finally {
    # Ensure we return to repo root even if the debug command is interrupted.
    Pop-Location
}

if ($failed) { exit 1 }

