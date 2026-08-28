param(
  [string]$Baseline = 'a4d9fba',
  [string]$OutputPath
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
$DefaultOut = Join-Path $Here 'LIVE_ACTIVITY.md'
$Out = if ($OutputPath) { [System.IO.Path]::GetFullPath($OutputPath) } else { $DefaultOut }

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

$TracePath = Join-Path $env:TEMP 'orchestrator-dashboard-trace.txt'
function Trace([string]$phase) {
  try { Add-Content -LiteralPath $TracePath -Value "$(Get-Date -Format 'HH:mm:ss.fff') $phase" } catch { }
}

function Git($dir, [string[]]$gitArgs) {
  $process = $null
  try {
    $startInfo = [System.Diagnostics.ProcessStartInfo]::new()
    $startInfo.FileName = 'git'
    $startInfo.UseShellExecute = $false
    $startInfo.RedirectStandardOutput = $true
    $startInfo.RedirectStandardError = $true
    $startInfo.CreateNoWindow = $true
    [void]$startInfo.ArgumentList.Add('-C')
    [void]$startInfo.ArgumentList.Add($dir)
    foreach ($gitArg in $gitArgs) { [void]$startInfo.ArgumentList.Add($gitArg) }

    $process = [System.Diagnostics.Process]::new()
    $process.StartInfo = $startInfo
    if (-not $process.Start()) { return '' }
    if (-not $process.WaitForExit(3000)) {
      $process.Kill()
      $process.WaitForExit()
      return 'timed out after 3s'
    }

    $stdout = $process.StandardOutput.ReadToEnd().Trim()
    [void]$process.StandardError.ReadToEnd()
    if ($process.ExitCode -ne 0) { return '' }
    return $stdout
  } catch { return '' }
  finally { if ($process) { $process.Dispose() } }
}

function LaneRow($lane) {
  $dir = $lane.Dir
  Trace "  laneRow:enter:$($lane.Name)"
  if (-not (Test-Path -LiteralPath $dir)) {
    Trace "  laneRow:absent:$($lane.Name)"
    return [pscustomobject]@{ Name = $lane.Name; Role = $lane.Role; Branch = 'absent'; Head = '-'; Ahead = '-'; Dirty = '-'; LastActivity = '-'; Task = $lane.Task }
  }
  Trace '  laneRow:git:branch'
  $branch = Git $dir @('rev-parse', '--abbrev-ref', 'HEAD')
  Trace '  laneRow:git:head'
  $head = Git $dir @('log', '-1', '--format=%h')
  Trace '  laneRow:git:ahead'
  $ahead = Git $dir @('rev-list', '--count', "$Baseline..HEAD")
  Trace '  laneRow:git:status'
  $status = Git $dir @('status', '--porcelain=v1')
  Trace '  laneRow:git:done'
  $dirty = if ($status) { @($status -split "`n" | Where-Object { $_.Trim() }).Count } else { 0 }

  # Scoped to the business-os directories on purpose. Recursing all of aiclone/src for
  # every lane on every tick took longer than the interval and starved the loop.
  $last = '-'
  $newest = $null
  foreach ($rel in @('src\lib\business-os', 'src\app\api\business-os', 'src\components\business-os', 'src\app\dashboard\business-os')) {
    $probe = Join-Path $dir "aiclone\$rel"
    if (-not (Test-Path -LiteralPath $probe)) { continue }
    Trace "  laneRow:scan:$rel"
    $candidate = Get-ChildItem -LiteralPath $probe -Recurse -File -ErrorAction SilentlyContinue |
      Sort-Object LastWriteTime -Descending | Select-Object -First 1
    if ($candidate -and (-not $newest -or $candidate.LastWriteTime -gt $newest)) { $newest = $candidate.LastWriteTime }
  }
  if ($newest) { $last = $newest.ToString('MM-dd HH:mm') }
  Trace "  laneRow:exit:$($lane.Name)"

  [pscustomobject]@{
    Name = $lane.Name; Role = $lane.Role; Branch = $branch; Head = $head
    Ahead = $ahead; Dirty = $dirty; LastActivity = $last; Task = $lane.Task
  }
}

function SpawnList {
  # Time-boxed: `kirocrew spawn list` starts a CLI plus Python children, and a slow or
  # hung call must not stall the dashboard loop.
  try {
    $job = Start-Job -ScriptBlock { (& kirocrew spawn list 2>&1 | Out-String).Trim() }
    if (Wait-Job -Job $job -Timeout 15) {
      $text = Receive-Job -Job $job
      Remove-Job -Job $job -Force -ErrorAction SilentlyContinue
      if ($text) { return ($text | Out-String).Trim() }
      return 'no sessions reported'
    }
    Stop-Job -Job $job -ErrorAction SilentlyContinue
    Remove-Job -Job $job -Force -ErrorAction SilentlyContinue
    return 'spawn list timed out after 15s'
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
  Trace 'tick:start'
  $rows = $Lanes | ForEach-Object { Trace "lane:$($_.Name)"; LaneRow $_ }
  Trace 'lanes:done'
  $app = AppState
  Trace 'appstate:done'
  $spawn = SpawnList
  Trace 'spawnlist:done'

  $lines = @(
    '# KiroCrew Orchestration Activity Snapshot',
    '',
    "Updated: $(NowStamp)",
    'Mode: one-shot snapshot; this script does not start, schedule, or claim a running monitor.',
    'A later manual invocation replaces this snapshot; no automatic next tick is promised.',
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
  Trace 'tick:written'
}

# Snapshot-only by design. ACP CLI cannot arm monitor_start here and no autonomous loop is
# registered, so a perpetual local loop would falsely imply durable orchestration. Invoke this
# command manually when a fresh measurement is needed; it exits after one completed write.
$dashboardMutex = [System.Threading.Mutex]::new($false, 'Local\PersonaAI.OrchestratorDashboard')
$hasWriterLock = $false
try {
  $hasWriterLock = $dashboardMutex.WaitOne(0)
  if (-not $hasWriterLock) {
    throw 'Another Orchestrator-Dashboard snapshot is already collecting; no output was written.'
  }
  Write-Dashboard
  Write-Host "Dashboard snapshot written: $Out"
} finally {
  if ($hasWriterLock) { [void]$dashboardMutex.ReleaseMutex() }
  $dashboardMutex.Dispose()
}
return
