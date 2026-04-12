<#
.SYNOPSIS
    First-time database setup.
    Connects to MySQL and runs schema.sql to create the database, tables, and seed data.
.USAGE
    cd DB
    .\setup.ps1
#>

$ErrorActionPreference = "Stop"

Write-Host "`n=== Database Setup ===" -ForegroundColor Cyan

# Check for mysql CLI
$mysqlPath = Get-Command mysql -ErrorAction SilentlyContinue
if (-not $mysqlPath) {
    Write-Host "ERROR: 'mysql' command not found." -ForegroundColor Red
    Write-Host "  Make sure MySQL is installed and its bin directory is in your PATH." -ForegroundColor Red
    Write-Host "  Common location: C:\Program Files\MySQL\MySQL Server 8.0\bin" -ForegroundColor Yellow
    exit 1
}

# Check schema file
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$schemaFile = Join-Path $scriptDir "schema.sql"

if (-not (Test-Path $schemaFile)) {
    Write-Host "ERROR: schema.sql not found at $schemaFile" -ForegroundColor Red
    exit 1
}

Write-Host "`n  Enter your MySQL credentials:" -ForegroundColor White

$dbUser = Read-Host "  MySQL user [root]"
if ([string]::IsNullOrWhiteSpace($dbUser)) { $dbUser = "root" }

$dbHost = Read-Host "  MySQL host [db]"
if ([string]::IsNullOrWhiteSpace($dbHost)) { $dbHost = "db" }

# --- Run schema.sql ---
Write-Host "`n  Running schema.sql against $dbHost as $dbUser..." -ForegroundColor Yellow
Write-Host "  (You will be prompted for your MySQL password)" -ForegroundColor Gray

Get-Content $schemaFile | mysql -u $dbUser -p -h $dbHost

if ($LASTEXITCODE -ne 0) {
    Write-Host "`nERROR: schema.sql failed. Check your credentials and that MySQL is running." -ForegroundColor Red
    exit 1
}

Write-Host "  schema.sql applied successfully." -ForegroundColor Green

Write-Host "`n=== Database ready! ===" -ForegroundColor Cyan
Write-Host "  Database:  school_db" -ForegroundColor White
Write-Host "  Tables:    users, auth_refresh_tokens, students, courses," -ForegroundColor White
Write-Host "             assignments, enrollments, assignment_grade" -ForegroundColor White
Write-Host "  Default login: admin@school.edu / ChangeMe123!" -ForegroundColor White
Write-Host "  (or register a new account at /register)" -ForegroundColor White
Write-Host ""
