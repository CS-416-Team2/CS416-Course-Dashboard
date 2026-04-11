<#
.SYNOPSIS
    First-time setup for the Flask backend.
    Creates a virtual environment, installs dependencies, and generates db-config.env.
.USAGE
    cd Backend
    .\setup.ps1
#>

$ErrorActionPreference = "Stop"

Write-Host "`n=== Flask Backend Setup ===" -ForegroundColor Cyan

# --- Virtual environment ---
if (-not (Test-Path ".venv")) {
    Write-Host "`n[1/3] Creating Python virtual environment..." -ForegroundColor Yellow
    python -m venv .venv
    if ($LASTEXITCODE -ne 0) {
        Write-Host "ERROR: Failed to create venv. Make sure Python 3.10+ is installed." -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "`n[1/3] Virtual environment already exists — skipping." -ForegroundColor Green
}

# Activate
& .\.venv\Scripts\Activate.ps1

# --- Dependencies ---
Write-Host "[2/3] Installing dependencies from requirements.txt..." -ForegroundColor Yellow
pip install -r requirements.txt --quiet
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: pip install failed." -ForegroundColor Red
    exit 1
}
Write-Host "       Dependencies installed." -ForegroundColor Green

# --- db-config.env ---
if (-not (Test-Path "db-config.env")) {
    Write-Host "[3/3] Creating db-config.env..." -ForegroundColor Yellow
    Write-Host ""
    Write-Host "  Enter your MySQL connection details (press Enter for defaults):" -ForegroundColor White

    $dbHost = Read-Host "  DB_HOST [localhost]"
    if ([string]::IsNullOrWhiteSpace($dbHost)) { $dbHost = "localhost" }

    $dbUser = Read-Host "  DB_USER [root]"
    if ([string]::IsNullOrWhiteSpace($dbUser)) { $dbUser = "root" }

    $dbPass = Read-Host "  DB_PASS"
    if ([string]::IsNullOrWhiteSpace($dbPass)) {
        Write-Host "  WARNING: No password entered. Edit db-config.env later if needed." -ForegroundColor Yellow
    }

    $dbName = Read-Host "  DB_NAME [school_db]"
    if ([string]::IsNullOrWhiteSpace($dbName)) { $dbName = "school_db" }

    @"
DB_HOST=$dbHost
DB_USER=$dbUser
DB_PASS=$dbPass
DB_NAME=$dbName
"@ | Set-Content -Path "db-config.env" -Encoding UTF8

    Write-Host "       db-config.env created." -ForegroundColor Green
} else {
    Write-Host "[3/3] db-config.env already exists — skipping." -ForegroundColor Green
}

Write-Host "`n=== Setup complete! ===" -ForegroundColor Cyan
Write-Host "Start the server with:" -ForegroundColor White
Write-Host "  .\.venv\Scripts\python.exe app.py" -ForegroundColor White
Write-Host ""
