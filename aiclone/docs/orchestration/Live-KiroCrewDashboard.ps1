param(
  [int]$IntervalSeconds = 10
)

$ErrorActionPreference = 'Continue'
$OrchestrationDir = $PSScriptRoot
$AppRoot = Split-Path -Parent (Split-Path -Parent $OrchestrationDir)
$ProjectRoot = Split-Path -Parent $AppRoot
$SessionRoot = Join-Path $env:USERPROFILE '.openclaw\agents\main\sessions'
$KiroSessionRoot = Join-Path $env:USERPROFILE '.kiro\sessions\cli'
$StatusFile = Join-Path $OrchestrationDir 'LIVE_ACTIVITY.md'

$Lanes = @(
  @{ Name = 'primary-docs'; Path = $ProjectRoot; Branch = 'primary checkout'; Purpose = 'orchestration docs only' },
  @{ Name = 'core'; Path = 'C:\Users\shubh\Desktop\Projects\personal projects\personai-kirocrew-business-os-wt'; Branch = 'kirocrew/business-os-phase-1'; Purpose = 'core contracts and runtime' },
  @{ Name = 'api'; Path = 'C:\Users\shubh\Desktop\Projects\personal projects\personai-kirocrew-business-os-api-wt'; Branch = 'kirocrew/business-os-api'; Purpose = 'API contracts and routes' },
  @{ Name = 'ui'; Path = 'C:\Users\shubh\Desktop\Projects\personal projects\personai-kirocrew-business-os-ui-wt'; Branch = 'kirocrew/business-os-ui'; Purpose = 'dashboard UI shell' },
  @{ Name = 'quality'; Path = 'C:\Users\shubh\Desktop\Projects\personal projects\personai-kirocrew-business-os-quality-wt'; Branch = 'kirocrew/business-os-quality'; Purpose = 'verification and risk gates' },
  @{ Name = 'docs-verticals'; Path = 'C:\Users\shubh\Desktop\Projects\personal projects\personai-kirocrew-business-os-docs-wt'; Branch = 'kirocrew/business-os-docs'; Purpose = 'vertical strategy docs' },
  @{ Name = 'integration'; Path = 'C:\Users\shubh\Desktop\Projects\personal projects\personai-kirocrew-business-os-integration-wt'; Branch = 'kirocrew/business-os-integration'; Purpose = 'diff review and merge planning' }
)

function NowStamp { Get-Date -Format 'yyyy-MM-dd HH:mm:ss zzz' }

function Invoke-Text($Command, $WorkingDirectory) {
  try {
    Push-Location -LiteralPath $WorkingDirectory
    $output = Invoke-Expression $Command 2>&1 | Out-String
    return $output.Trim()
  } catch {
    return "ERROR: $($_.Exception.Message)"
  } finally {
    try { Pop-Location } catch {}
  }
}

function Get-SessionRows($Root, $Prefix, $Count) {
  Get-ChildItem -LiteralPath $Root -Filter '*.jsonl' -ErrorAction SilentlyContinue |
    Sort-Object LastWriteTime -Descending |
    Select-Object -First $Count |
    ForEach-Object {
      [pscustomobject]@{
        Source = $Prefix
        File = $_.Name
        Bytes = $_.Length
        LastWrite = $_.LastWriteTime.ToString('HH:mm:ss')
      }
    }
}

function Get-GitLaneRows {
  foreach ($lane in $Lanes) {
    $appPath = Join-Path $lane.Path 'aiclone'
    $gitPath = if (Test-Path -LiteralPath $appPath) { $appPath } else { $lane.Path }
    if (-not (Test-Path -LiteralPath $gitPath)) {
      [pscustomobject]@{ Lane = $lane.Name; Branch = $lane.Branch; State = 'MISSING PATH'; Changes = ''; Path = $gitPath }
      continue
    }

    $branch = Invoke-Text 'git branch --show-current' $gitPath
    $status = Invoke-Text 'git status --short' $gitPath
    $count = 0
    if ($status) { $count = ($status -split "`n" | Where-Object { $_.Trim() }).Count }
    $state = if ($count -eq 0) { 'clean' } else { "$count changed/untracked" }
    [pscustomobject]@{ Lane = $lane.Name; Branch = $branch; State = $state; Changes = ($status -replace "`r?`n", '; '); Path = $gitPath }
  }
}

function Get-KiroCrewList {
  if (Get-Command kirocrew -ErrorAction SilentlyContinue) {
    return Invoke-Text 'kirocrew spawn list' $ProjectRoot
  }
  return 'kirocrew command is not available in this shell.'
}

function Write-Markdown($lanes, $sessions, $kiro) {
  $lines = @(
    '# KiroCrew Live Activity',
    '',
    "Updated: $(NowStamp)",
    '',
    '## Write Paths',
    '',
    'All workers should use their assigned worktree path below. The primary checkout is docs-only for orchestration.',
    '',
    '| Lane | Branch | State | Path |',
    '| --- | --- | --- | --- |'
  )

  foreach ($lane in $lanes) {
    $lines += "| $($lane.Lane) | $($lane.Branch) | $($lane.State) | ``$($lane.Path)`` |"
  }

  $lines += @('', '## Recent Agent Activity', '', '| Source | Session | Bytes | Last write |', '| --- | --- | ---: | --- |')
  foreach ($s in $sessions) { $lines += "| $($s.Source) | $($s.File) | $($s.Bytes) | $($s.LastWrite) |" }

  $lines += @('', '## KiroCrew Spawn List', '```text', $kiro, '```')
  $lines | Set-Content -LiteralPath $StatusFile -Encoding UTF8
}

function Show-Dashboard {
  $lanes = @(Get-GitLaneRows)
  $sessions = @()
  $sessions += Get-SessionRows $SessionRoot 'openclaw' 8
  $sessions += Get-SessionRows $KiroSessionRoot 'kiro' 6
  $kiro = Get-KiroCrewList
  Write-Markdown $lanes $sessions $kiro

  Clear-Host
  Write-Host 'KiroCrew Live Activity' -ForegroundColor Cyan
  Write-Host "Updated: $(NowStamp)" -ForegroundColor DarkGray
  Write-Host "Docs: $OrchestrationDir"
  Write-Host "Status: $StatusFile"
  Write-Host ''
  Write-Host 'Write paths / lane status' -ForegroundColor Yellow
  $lanes | Select-Object Lane,Branch,State,Path | Format-Table -AutoSize
  Write-Host ''
  Write-Host 'Recent agent session writes' -ForegroundColor Yellow
  $sessions | Sort-Object LastWrite -Descending | Select-Object -First 12 | Format-Table -AutoSize
  Write-Host ''
  Write-Host 'KiroCrew spawn list' -ForegroundColor Yellow
  Write-Host $kiro
  Write-Host ''
  Write-Host "Refreshing every $IntervalSeconds seconds. Press Ctrl+C to stop." -ForegroundColor DarkGray
}

while ($true) {
  Show-Dashboard
  Start-Sleep -Seconds $IntervalSeconds
}
