# Poll D1 raw_mails table for incoming emails
# Usage: pwsh -File e2e/poll_d1_raw_mails.ps1 -IntervalSec 10 -MaxTries 12 -Address "test@miraclelab.online"
# Requires: CLOUDFLARE_GLOBAL_TOKEN, CLOUDFLARE_GLOBAL_EMAIL env vars

param(
    [int]$IntervalSec = 10,
    [int]$MaxTries = 12,
    [string]$Address = "test@miraclelab.online"
)

$ErrorActionPreference = 'Stop'

# Load env from .env.local
$envFile = "G:\VIBE\mmailtemp\.env.local"
if (Test-Path $envFile) {
    Get-Content $envFile | ForEach-Object {
        if ($_ -match '^\s*([^#][^=]*)=(.*)$') {
            $name = $matches[1].Trim()
            $val = $matches[2].Trim()
            Set-Item -Path "Env:\$name" -Value $val
        }
    }
}

# wrangler requires CLOUDFLARE_API_KEY (Global Key) + CLOUDFLARE_EMAIL
$env:CLOUDFLARE_API_KEY = $env:CLOUDFLARE_GLOBAL_TOKEN
$env:CLOUDFLARE_EMAIL = $env:CLOUDFLARE_GLOBAL_EMAIL
$env:CLOUDFLARE_API_TOKEN = ""

Set-Location G:\VIBE\mmailtemp\_clone_tmp\worker

Write-Host "Polling D1 raw_mails every ${IntervalSec}s for ${MaxTries} tries..." -ForegroundColor Cyan
Write-Host "Filter: address='$Address'" -ForegroundColor Cyan
Write-Host ""

$found = $false
for ($i = 0; $i -lt $MaxTries; $i++) {
    $ts = Get-Date -Format 'HH:mm:ss'
    Write-Host "[$i] $ts - " -NoNewline -ForegroundColor Yellow

    if ($Address) {
        $sql = "SELECT id, address, source, message_id, created_at FROM raw_mails WHERE address='$Address' ORDER BY id DESC LIMIT 5"
    } else {
        $sql = "SELECT id, address, source, message_id, created_at FROM raw_mails ORDER BY id DESC LIMIT 5"
    }

    $out = & npx.cmd wrangler d1 execute temp-email-db --command $sql --remote 2>&1 | Out-String
    # Count rows from output (D1 outputs like "id  address  source  message_id  created_at" then rows)
    $rowCount = ($out | Select-String '^\s*\d+\s*\|' -AllMatches).Matches.Count

    if ($rowCount -gt 0) {
        Write-Host "FOUND $rowCount row(s)!" -ForegroundColor Green
        Write-Host $out
        $found = $true
        break
    } else {
        $totalOut = & npx.cmd wrangler d1 execute temp-email-db --command "SELECT COUNT(*) as cnt FROM raw_mails" --remote 2>&1 | Out-String
        $totalMatch = ($totalOut | Select-String 'cnt\s*\|\s*(\d+)').Matches
        $total = if ($totalMatch.Count -gt 0) { $totalMatch[0].Groups[1].Value } else { "?" }
        Write-Host "0 rows. total_raw_mails=$total" -ForegroundColor Gray
    }

    if ($i -lt $MaxTries - 1) {
        Start-Sleep $IntervalSec
    }
}

Write-Host ""
if ($found) {
    Write-Host "SUCCESS: Email received!" -ForegroundColor Green
    exit 0
} else {
    Write-Host "TIMEOUT: No email in $MaxTries polls ($($MaxTries * $IntervalSec)s total)" -ForegroundColor Red
    Write-Host "Hint: Check wrangler tail output, CF Email Routing logs, and sender SPF/DKIM" -ForegroundColor Yellow
    exit 1
}
