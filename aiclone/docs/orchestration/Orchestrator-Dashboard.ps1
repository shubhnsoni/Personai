param(
  [int]$IntervalSeconds = 30,
  [string]$Baseline = 'a4d9fba'
)

# Single truthful orchestration dashboard.
#
# Supersedes Watch-KiroCrewOrchestration.ps1 and Live-KiroCrewDashboard.ps1, which both
# wrote MONITOR_STATUS.md and raced each other, one of them on a 1s loop that re-invoked
# the KiroCrew CLI every tick.
#
# Every field below is measured from git, the process table, or the KiroCrew CLI. Lane
# state is never inferred from ledger text.

$ErrorActionPreference = 'Continue'
$Here = $PSScriptRoot
$Primary = (Resolve-Path (Join-Path $Here '..\..')).Path
$Projects = (Resolve-Path (Join-Path $Primary '..\..')).Path
$Out = Join-Path $Here 'LIVE_ACTIVITY.md'

# role: PRIMARY | FROZEN_EVIDENCE | ACTIVE
$Lanes = @(
  @{ Name = 'primary';        Dir = $Primary;                                                          Role = 'PRIMARY';         Task = 'root orchestration + committed restaurant work' }
  @{ Name = 'consolidation';  Dir = Join-Path $Projects 'personai-business-os-consolidation-wt';        Role = 'ACTIVE';          Task = 'P1-001 consolidation, P1-002 surface registration' }
  @{ Name = 'core';           Dir = Join-Path $Projects 'personai-kirocrew-business-os-wt';             Role = 'FROZEN_EVIDENCE'; Task = 'superseded draft, kept as evidence' }
  @{ Name = 'api';            Dir = Join-Path $Projects 'personai-kirocrew-business-os-api-wt';         Role = 'FROZEN_EVIDENCE'; Task = 'superseded draft, kept as evidence' }
  @{ Name = 'ui';             Dir = Join-Path $Projects 'personai-kirocrew-business-os-ui-wt';          Role = 'FROZEN_EVIDENCE'; Task = 'superseded draft, kept as evidence' }
  @{ Name = 'quality';        Dir = Join-Path $Projects 'personai-kirocrew-business-os-quality-wt';     Role = 'FROZEN_EVIDENCE'; Task = 'produced nothing' }
  @{ Name = 'docs-verticals'; Dir = Join-Path $Projects 'personai-kirocrew-business-os-docs-wt';        Role = 'FROZEN_EVIDENCE'; Task = 'produced nothing' }
  @{ Name = 'integration';    Dir = Join-Path $Projects 'personai-kirocrew-business-os-integration-wt'; Role = 'FROZEN_EVIDENCE'; Task = 'produced nothing' }
)

function NowStamp { Get-Date -Format 'yyyy-MM-dd HH:mm:ss zzz' }

function Git($dir, [string[]]$gitArgs) {
  try { return (& git -C $dir @gitArgs 2>$null | Out-String).Trim() } catch { return '' }
}

function LaneRow($lane) {
  $dir = $lane.Dir
  if (-not (Test-Path -LiteralPath $dir)) {
    return [pscustomobject]@{ Name = $lane.Name; Role = $lane.Role; Branch = 'absent'; Head = '-'; Ahead = '-'; Dirty = '-'; LastActivity = '-'; Task = $lane.Task }
  }
  $branch = Git $dir @('rev-parse', '--abbrev-ref', 'HEAD')
  $head = Git $dir @('log', '-1', '--format=%h')
  $ahead = Git $dir @('rev-list', '--count', "$Baseline..HEAD")
  $status = Git $dir @('status', '--porcelain=v1')
  $dirty = if ($status) { @($status -split "`n" | Where-Object { $_.Trim() }).Count } else { 0 }

  $last = '-'
  try {
    $newest = Get-ChildItem -LiteralPath (Join-Path $dir 'aiclone\src') -Recurse -File -ErrorAction SilentlyContinue |
      Sort-Object LastWriteTime -Descending | Select-Object -First 1
    if ($newest) { $last = $newest.LastWriteTime.ToString('MM-dd HH:mm') }
  } catch { }

  [pscustomobject]@{
    Name = $lane.Name; Role = $lane.Role; Branch = $branch; Head = $head
    Ahead = $ahead; Dirty = $dirty; LastActivity = $last; Task = $lane.Task
  }
}

function SpawnList {
  try {
    $text = (& kirocrew spawn list 2>&1 | Out-String).Trim()
    if (-not $text) { return 'no sessions reported' }
    return $text
  } catch { return "spawn list unavailable: $($_.Exception.Message)" }
}

function AppState {
  $listener = @(Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue).Count
  $tunnel = @(Get-Process cloudflared -ErrorAction SilentlyContinue).Count
  $gateway = @(Get-CimInstance Win32_Process -Filter "Name='kirocrew.exe'" -ErrorAction SilentlyContinue).Count
  [pscustomobject]@{
    LocalApp = if ($listener -gt 0) { "listening on 127.0.0.1:3000" } else { 'stopped' }
    PublicTunnel = if ($tunnel -gt 0) { "UP ($tunnel cloudflared process)" } else { 'DOWN (no public exposure)' }
    KiroCrewProcesses = $gateway
  }
}

function Write-Dashboard {
  $rows = $Lanes | ForEach-Object { LaneRow $_ }
  $app = AppState
  $spawn = SpawnList

  $lines = @(
    '# KiroCrew Live Activity',
    '',
    "Updated: $(NowStamp)",
    "Baseline: $Baseline",
    '',
    'Measured from git, the process table, and the KiroCrew CLI. Lane state is never',
    'inferred from ledger text. `Ahead` counts commits beyond the baseline.',
    '',
    '## Runtime',
    '',
    "- Local app: $($app.LocalApp)",
    "- Public tunnel: $($app.PublicTunnel)",
    "- KiroCrew processes: $($app.KiroCrewProcesses)",
    '',
    '## Worktrees',
    '',
    '| Lane | Role | Branch | HEAD | Ahead | Dirty | Last src write | Task |',
    '| --- | --- | --- | --- | ---: | ---: | --- | --- |'
  )
  foreach ($r in $rows) {
    $lines += "| $($r.Name) | $($r.Role) | $($r.Branch) | $($r.Head) | $($r.Ahead) | $($r.Dirty) | $($r.LastActivity) | $($r.Task) |"
  }
  $lines += @(
    '',
    '## KiroCrew sessions (verbatim CLI)',
    '',
    '```text',
    $spawn,
    '```'
  )

  Set-Content -LiteralPath $Out -Value $lines -Encoding UTF8
}

Write-Host "Orchestrator dashboard running. Output: $Out"
Write-Host 'Ctrl+C to stop.'
while ($true) {
  Write-Dashboard
  Write-Host "[$(NowStamp)] dashboard tick"
  Start-Sleep -Seconds $IntervalSeconds
}
