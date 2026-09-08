param(
  [int]$IntervalSeconds = 30
)

$ErrorActionPreference = 'Continue'
$Root = Split-Path -Parent $PSScriptRoot
$Runlog = Join-Path $PSScriptRoot 'RUNLOG.md'
$StateFile = Join-Path $PSScriptRoot 'MONITOR_STATUS.md'
$SessionRoot = Join-Path $env:USERPROFILE '.kiro\sessions\cli'

function NowStamp {
  Get-Date -Format 'yyyy-MM-dd HH:mm:ss zzz'
}

function Get-SpawnList {
  try {
    Push-Location $Root
    $text = & kirocrew spawn list 2>&1 | Out-String
    Pop-Location
    return $text.Trim()
  } catch {
    try { Pop-Location } catch {}
    return "spawn list failed: $($_.Exception.Message)"
  }
}

function Get-RecentSessionFiles {
  Get-ChildItem -LiteralPath $SessionRoot -Filter '*.jsonl' -ErrorAction SilentlyContinue |
    Sort-Object LastWriteTime -Descending |
    Select-Object -First 6 FullName, Length, LastWriteTime
}

function Write-Status {
  $spawn = Get-SpawnList
  $files = Get-RecentSessionFiles
  $lines = @(
    '# KiroCrew Orchestration Monitor',
    '',
    "Updated: $(NowStamp)",
    '',
    '## Active Workers',
    '```text',
    $spawn,
    '```',
    '',
    '## Recent Session Files',
    '| File | Bytes | Last Write |',
    '| --- | ---: | --- |'
  )
  foreach ($f in $files) {
    $lines += "| $([IO.Path]::GetFileName($f.FullName)) | $($f.Length) | $($f.LastWriteTime.ToString('yyyy-MM-dd HH:mm:ss')) |"
  }
  $lines | Set-Content -LiteralPath $StateFile -Encoding UTF8
}

Write-Host "KiroCrew orchestration monitor started. Status: $StateFile"
Write-Host 'Press Ctrl+C to stop this visible monitor window.'

while ($true) {
  Write-Status
  Write-Host "[$(NowStamp)] monitor tick complete"
  Start-Sleep -Seconds $IntervalSeconds
}
