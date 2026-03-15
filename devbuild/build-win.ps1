# One-click Windows build (OpenCode CLI only)
# Run from repo root: bun install, typecheck, then build opencode CLI

$ErrorActionPreference = "Stop"
$RepoRoot = $PSScriptRoot + "\.."

Push-Location $RepoRoot

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

    $distBin = Get-ChildItem -Path "dist" -Directory | Where-Object { Test-Path (Join-Path $_.FullName "bin") } | ForEach-Object { Join-Path $_.FullName "bin" } | Select-Object -First 1
    if ($distBin) { $distBin = (Resolve-Path $distBin).Path }
    Write-Host "`n==> Build finished." -ForegroundColor Green
    if ($distBin) { Write-Host "Bin: $distBin" -ForegroundColor Gray }
}
catch {
    Write-Host "`nBuild failed: $_" -ForegroundColor Red
    Pop-Location
    Read-Host "Press Enter to exit"
    exit 1
}
finally {
    Pop-Location
}

Read-Host "Press Enter to exit"
