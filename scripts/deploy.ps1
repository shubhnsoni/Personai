#requires -Version 5.1
[CmdletBinding()]
param(
    [string[]] $Files = @(),
    [string[]] $Tests = @(),
    [string] $Message = 'Update Introify',
    [switch] $InstallDependencies,
    [switch] $NoPause,
    [ValidateRange(1, 45)] [int] $WaitMinutes = 15
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$repoRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$exitStatus = 1
$lockHandle = $null
$expectedOrigin = 'github.com/shubhnsoni/Personai'
$utf8 = New-Object Text.UTF8Encoding($false)

function Quote-Argument([string] $Value) {
    # Windows CommandLineToArgvW/CRT escaping; no shell interprets these arguments.
    return '"' + [regex]::Replace([regex]::Replace($Value, '(\\*)"', '$1$1\"'), '(\\+)$', '$1$1') + '"'
}

function Invoke-Program {
    param([string] $Program, [string[]] $Arguments, [string] $Directory = $repoRoot,
        [hashtable] $Environment = @{}, [switch] $Capture, [switch] $AllowFailure)
    $start = New-Object Diagnostics.ProcessStartInfo
    $start.FileName = $Program
    $start.Arguments = (($Arguments | ForEach-Object { Quote-Argument $_ }) -join ' ')
    $start.WorkingDirectory = $Directory
    $start.UseShellExecute = $false
    # Build/test children never inherit production provider, database, or Git override variables.
    $start.EnvironmentVariables.Clear()
    foreach ($key in @('PATH', 'PATHEXT', 'SystemRoot', 'WINDIR', 'COMSPEC', 'TEMP', 'TMP',
            'LOCALAPPDATA', 'APPDATA', 'USERPROFILE', 'HOMEDRIVE', 'HOMEPATH', 'PROGRAMFILES',
            'PROGRAMFILES(X86)', 'COMMONPROGRAMFILES', 'NUMBER_OF_PROCESSORS', 'PROCESSOR_ARCHITECTURE')) {
        $value = [Environment]::GetEnvironmentVariable($key)
        if ($null -ne $value) { $start.EnvironmentVariables[$key] = $value }
    }
    foreach ($key in $Environment.Keys) { $start.EnvironmentVariables[$key] = [string] $Environment[$key] }
    if ($Capture) { $start.RedirectStandardOutput = $true; $start.RedirectStandardError = $true }
    $process = New-Object Diagnostics.Process
    $process.StartInfo = $start
    try {
        if (-not $process.Start()) { throw 'Could not start a required validation tool.' }
        if ($Capture) {
            $stdout = $process.StandardOutput.ReadToEndAsync()
            $stderr = $process.StandardError.ReadToEndAsync()
        }
        $process.WaitForExit()
        $code = $process.ExitCode
        if ($Capture) { $output = $stdout.GetAwaiter().GetResult(); $null = $stderr.GetAwaiter().GetResult() }
        if ($code -ne 0 -and -not $AllowFailure) { throw "A required command failed (exit $code). Deployment stopped." }
        if ($Capture) { return [pscustomobject]@{ Code = $code; Output = $output.TrimEnd() } }
        if ($AllowFailure) { return $code }
    } finally { $process.Dispose() }
}

function Invoke-Git([string[]] $Arguments, [string] $Index = '') {
    $environment = @{}
    if ($Index) { $environment.GIT_INDEX_FILE = $Index }
    return (Invoke-Program -Program $script:gitExe -Arguments (@('-c', 'core.quotepath=false', '-C', $repoRoot) + $Arguments) -Environment $environment -Capture).Output
}

function Lines([string] $Text) { return ,@($Text -split '\r?\n' | Where-Object { $_.Length -gt 0 }) }

function Assert-Scope([string] $Path, [bool] $Explicit) {
    if ($Path -match '[\r\n]' -or $Path -match '(^|/)\.\.?(/|$)' -or [IO.Path]::IsPathRooted($Path)) { throw 'Release paths must be literal repository-relative files.' }
    if ($Path -notmatch '^introify/' -and $Path -notin @('deploy.cmd', 'scripts/deploy.ps1')) { throw "Outside deployment scope: $Path" }
    if ($Path -match '(^|/)(\.git|\.local|\.clerk|node_modules|\.next|backups|coverage)(/|$)' -or
        $Path -match '\.(pem|key|pfx|p12|dump|log|tsbuildinfo)$' -or $Path -match '\.sql\.gz$' -or
        $Path -eq 'introify/scripts/_edge_cdp.py' -or
        ($Path -match '(^|/)\.env' -and -not ($Explicit -and $Path -eq 'introify/.env.example'))) {
        throw "Excluded secret, local output, or maintenance file: $Path"
    }
    $absolute = [IO.Path]::GetFullPath((Join-Path $repoRoot $Path))
    if (-not $absolute.StartsWith($repoRoot + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) { throw 'Release path escaped the repository.' }
    if (Test-Path -LiteralPath $absolute -PathType Container) { throw "Select files, not directories: $Path" }
    if ((Test-Path -LiteralPath $absolute) -and ((Get-Item -LiteralPath $absolute).Attributes -band [IO.FileAttributes]::ReparsePoint)) { throw "Release files must not be links: $Path" }
}

function Assert-Repository {
    if ((Invoke-Git @('branch', '--show-current')) -ne 'main') { throw 'Switch to main before deploying.' }
    $origins = @((Invoke-Git @('remote', 'get-url', 'origin')).Trim()) + (Lines (Invoke-Git @('remote', 'get-url', '--push', '--all', 'origin')))
    foreach ($origin in $origins) {
        $canonical = $origin -replace '^https://', '' -replace '^git@', '' -replace ':', '/' -replace '\.git$', '' -replace '/$', ''
        if ($canonical -cne $expectedOrigin) { throw 'The origin fetch/push remote is not the expected Introify GitHub repository.' }
    }
    if (Invoke-Git @('diff', '--cached', '--name-only')) { throw 'The Git index already contains staged changes. Commit or unstage them before using this launcher.' }
    foreach ($name in @('MERGE_HEAD', 'CHERRY_PICK_HEAD', 'REVERT_HEAD', 'rebase-merge', 'rebase-apply')) {
        $statePath = Invoke-Git @('rev-parse', '--git-path', $name)
        if (-not [IO.Path]::IsPathRooted($statePath)) { $statePath = Join-Path $repoRoot $statePath }
        if (Test-Path -LiteralPath $statePath) { throw 'Finish the current Git merge, rebase, or cherry-pick before deploying.' }
    }
}

function Write-LocalFile([string] $Path, [string] $Content) { [IO.File]::WriteAllText($Path, $Content, $utf8) }

function Find-Node20([string] $BootstrapNode, [string] $NpmCli) {
    $cacheRoot = Join-Path $env:LOCALAPPDATA 'npm-cache/_npx'
    $candidates = @((Join-Path $cacheRoot '185e25162edaacfb/node_modules/node/bin/node.exe'))
    if (Test-Path -LiteralPath $cacheRoot) {
        $candidates += @(Get-ChildItem -LiteralPath $cacheRoot -Directory | ForEach-Object { Join-Path $_.FullName 'node_modules/node/bin/node.exe' })
    }
    foreach ($candidate in ($candidates | Select-Object -Unique)) {
        if (Test-Path -LiteralPath $candidate) {
            $version = Invoke-Program -Program $candidate -Arguments @('--version') -Capture
            if ($version.Output -eq 'v20.20.2') { return $candidate }
        }
    }
    Write-Host 'Preparing the pinned Node 20.20.2 runtime in the npm cache...'
    $result = Invoke-Program -Program $BootstrapNode -Arguments @($NpmCli, 'exec', '--yes', '--package=node@20.20.2', '--', 'node', '-p', 'process.execPath') -Directory $script:runRoot -Capture
    $candidate = (Lines $result.Output)[-1]
    if (-not (Test-Path -LiteralPath $candidate)) { throw 'npm did not return a usable Node 20 runtime.' }
    if ((Invoke-Program -Program $candidate -Arguments @('--version') -Capture).Output -ne 'v20.20.2') { throw 'Unexpected Node 20 runtime version.' }
    return $candidate
}

try {
    Write-Host 'Introify deployment: validate selected files, publish main, verify the live release.' -ForegroundColor Cyan
    $gitExe = (Get-Command git.exe -ErrorAction Stop).Source
    $node24 = (Get-Command node.exe -ErrorAction Stop).Source
    if ((Invoke-Program -Program $node24 -Arguments @('--version') -Capture).Output -notmatch '^v24\.') { throw 'Install or select Node 24 for the local UI test runner. The production build separately uses pinned Node 20.' }
    $npmCommand = (Get-Command npm.cmd -ErrorAction Stop).Source
    $npmCli = Join-Path (Split-Path $npmCommand) 'node_modules/npm/bin/npm-cli.js'
    if (-not (Test-Path -LiteralPath $npmCli)) { throw 'The npm CLI could not be located beside npm.cmd.' }
    Assert-Repository
    $localRoot = Join-Path $repoRoot '.local'
    $null = New-Item -ItemType Directory -Path $localRoot -Force
    try { $lockHandle = [IO.File]::Open((Join-Path $localRoot 'deploy.lock'), [IO.FileMode]::OpenOrCreate, [IO.FileAccess]::ReadWrite, [IO.FileShare]::None) }
    catch { throw 'Another deployment launcher is already running.' }
    $runRoot = Join-Path $localRoot ('release-' + (Get-Date -Format 'yyyyMMdd-HHmmss') + '-' + [guid]::NewGuid().ToString('N').Substring(0, 8))
    $null = New-Item -ItemType Directory -Path $runRoot
    $baseline = Invoke-Git @('rev-parse', 'HEAD')
    $selected = @()
    if ($Files.Count -gt 0) {
        $selected = @($Files | ForEach-Object { $_.Replace('\', '/').Trim() } | Select-Object -Unique)
        foreach ($path in $selected) { Assert-Scope $path $true }
    } else {
        $tracked = Lines (Invoke-Git @('diff', '--name-only', 'HEAD', '--', 'introify', 'deploy.cmd', 'scripts/deploy.ps1'))
        $new = Lines (Invoke-Git @('ls-files', '--others', '--exclude-standard', '--', 'introify/src', 'introify/tests', 'introify/public', 'deploy.cmd', 'scripts/deploy.ps1'))
        $selected = @(($tracked + $new) | Where-Object { $_ -notmatch '^introify/public/uploads/' -and $_ -ne 'introify/.env.example' } | Select-Object -Unique)
        foreach ($path in $selected) { Assert-Scope $path $false }
        $otherNew = @(Lines (Invoke-Git @('ls-files', '--others', '--exclude-standard', '--', 'introify')) | Where-Object {
            ($_ -match '^introify/(prisma|scripts)/' -or $_ -match '^introify/[^/]+$') -and
            $_ -notin @('introify/scripts/_edge_cdp.py', 'introify/.env.example') -and $_ -notin $selected
        })
        if ($otherNew.Count -gt 0) { throw ('New migration, script, or app configuration needs explicit -Files selection: ' + ($otherNew -join ', ')) }
    }
    Write-Host ('Selected files: ' + $selected.Count)
    $selected | ForEach-Object { Write-Host ('  ' + $_) }
    $index = Join-Path $runRoot 'release.index'
    $null = Invoke-Git @('read-tree', $baseline) $index
    if ($selected.Count -gt 0) { $null = Invoke-Git (@('--literal-pathspecs', 'add', '--') + $selected) $index }
    $tree = Invoke-Git @('write-tree') $index
    foreach ($path in @($selected | Where-Object { $_ -like '*.ps1' -and (Test-Path -LiteralPath (Join-Path $repoRoot $_)) })) {
        $parseTokens = $null; $parseErrors = $null
        $null = [Management.Automation.Language.Parser]::ParseFile((Join-Path $repoRoot $path), [ref] $parseTokens, [ref] $parseErrors)
        if ($parseErrors.Count -gt 0) { throw "PowerShell syntax validation failed: $path" }
    }
    if ((Invoke-Git @('ls-tree', '-r', $tree, '--', 'introify')) -match '(?m)^120000 ') { throw 'The release contains symbolic links. Use a regular-file release snapshot.' }
    $snapshot = Join-Path $runRoot 'introify'
    $null = New-Item -ItemType Directory -Path $snapshot
    $archive = Join-Path $runRoot 'source.tar'
    $null = Invoke-Git @('archive', '--format=tar', ('--output=' + $archive), ($tree + ':introify'))
    $tar = (Get-Command tar.exe -ErrorAction Stop).Source
    Invoke-Program -Program $tar -Arguments @('-xf', $archive, '-C', $snapshot)
    # Reject unexpected committed environment files too, before any dependency or app code runs.
    $envFiles = @(Get-ChildItem -LiteralPath $snapshot -File -Recurse -Force | Where-Object { $_.Name -like '.env*' -and $_.Name -ne '.env.example' })
    if ($envFiles.Count -gt 0) { throw 'The proposed release contains an environment file. No validation or deployment was run.' }
    $node20 = Find-Node20 $node24 $npmCli
    $validationEnv = @{
        PATH = ((Split-Path $node20) + ';' + $env:PATH)
        NODE_ENV = 'production'; NEXT_TELEMETRY_DISABLED = '1'; CI = '1'
        DATABASE_URL = 'postgresql://validation:validation@127.0.0.1:9/validation?connect_timeout=1'
        DIRECT_URL = 'postgresql://validation:validation@127.0.0.1:9/validation?connect_timeout=1'
        NEXT_PUBLIC_APP_URL = 'https://introify.com'
        NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = 'pk_test_dmFsaWRhdGlvbi5jbGVyay5hY2NvdW50cy5kZXYk'
        CLERK_SECRET_KEY = 'sk_test_validation_only'; INTROIFY_RELEASE_SHA = $baseline
        INTROIFY_AI_DISABLED = 'true'; INTROIFY_BILLING_ENABLED = 'false'
        INTROIFY_PHOTOREAL_ENABLED = 'false'; INTROIFY_WORKER_ENABLED = 'false'
    }
    $dependencyGuard = Join-Path $runRoot 'check-dependencies.cjs'
    Write-LocalFile $dependencyGuard @'
const fs = require('node:fs');
const path = require('node:path');
const [source, installed] = process.argv.slice(2);
const json = p => JSON.parse(fs.readFileSync(p, 'utf8'));
const schema = p => JSON.stringify((fs.readFileSync(p, 'utf8').match(/\/\/[^\r\n]*|"(?:\\.|[^"\\])*"|[A-Za-z_][A-Za-z0-9_]*|[0-9]+|[^\s]/g) || []).filter(token => !token.startsWith('//')));
try {
  const wanted = json(path.join(source, 'package-lock.json'));
  const actual = json(path.join(installed, 'node_modules/.package-lock.json'));
  if (JSON.stringify(json(path.join(source, 'package.json'))) !== JSON.stringify(json(path.join(installed, 'package.json'))) || JSON.stringify(wanted) !== JSON.stringify(json(path.join(installed, 'package-lock.json')))) throw Error();
  for (const [name, pkg] of Object.entries(wanted.packages)) {
    if (!name) continue;
    const found = actual.packages[name];
    if (!found && pkg.optional) continue;
    if (!found || found.version !== pkg.version || found.integrity !== pkg.integrity || found.resolved !== pkg.resolved || !fs.existsSync(path.join(installed, name))) throw Error();
  }
  if (schema(path.join(source, 'prisma/schema.prisma')) !== schema(path.join(installed, 'node_modules/.prisma/client/schema.prisma'))) throw Error();
} catch { console.error('Dependencies or generated Prisma client do not match the proposed release. Preparing an independent install.'); process.exitCode = 1; }
'@
    $useIndependentInstall = [bool] $InstallDependencies
    if (-not $useIndependentInstall) {
        $guardExit = Invoke-Program -Program $node24 -Arguments @($dependencyGuard, $snapshot, (Join-Path $repoRoot 'introify')) -AllowFailure
        $useIndependentInstall = $guardExit -ne 0
    }
    if ($useIndependentInstall) {
        Write-Host 'Installing independent dependencies inside the release snapshot...'
        $installEnv = $validationEnv.Clone()
        $installEnv.NODE_ENV = 'development'
        Invoke-Program -Program $node20 -Arguments @($npmCli, 'ci', '--include=dev', '--ignore-scripts', '--no-audit', '--no-fund') -Directory $snapshot -Environment $installEnv
        Invoke-Program -Program $node20 -Arguments @('node_modules/prisma/build/index.js', 'generate') -Directory $snapshot -Environment $validationEnv
    } else {
        $null = New-Item -ItemType Junction -Path (Join-Path $snapshot 'node_modules') -Target (Join-Path $repoRoot 'introify/node_modules')
    }
    $testFiles = @('tests/mobile-business-navigation.test.tsx', 'tests/dashboard-admin-banner.test.tsx', 'tests/billing-team.test.ts', 'tests/page-transition.test.tsx')
    if ($Tests.Count -gt 0) { $testFiles = $Tests }
    $testFiles = @(($testFiles + @($selected | Where-Object { $_ -match '^introify/tests/.+\.test\.tsx?$' -and $_ -notmatch 'postgres|\.integration\.' } | ForEach-Object { $_.Substring(9) })) | Select-Object -Unique)
    foreach ($test in $testFiles) {
        if ($test -notmatch '^tests/[a-zA-Z0-9_./-]+\.test\.tsx?$' -or $test -match '\.\.|postgres|\.integration\.' -or -not (Test-Path -LiteralPath (Join-Path $snapshot $test) -PathType Leaf)) { throw 'Select existing, isolated unit/UI tests only. Database integration suites are not part of deployment.' }
    }
    $runner = Join-Path $snapshot 'release-test-runner.mjs'
    Write-LocalFile $runner @'
import { startVitest } from 'vitest/node';
const context = await startVitest('test', process.argv.slice(2), { run: true, config: './vitest.config.mts' }, { envDir: false });
if (context) await context.close(); else process.exitCode = 1;
'@
    $testEnv = $validationEnv.Clone()
    $testEnv.NODE_ENV = 'test'
    $testEnv.PATH = ((Split-Path $node24) + ';' + $env:PATH)
    Write-Host 'Running isolated release tests on Node 24...'
    Invoke-Program -Program $node24 -Arguments (@($runner) + $testFiles) -Directory $snapshot -Environment $testEnv
    Write-Host 'Building the exact prospective release on Node 20.20.2 (Webpack)...'
    Invoke-Program -Program $node20 -Arguments @('node_modules/next/dist/bin/next', 'build', '--webpack') -Directory $snapshot -Environment $validationEnv
    Assert-Repository
    if ((Invoke-Git @('rev-parse', 'HEAD')) -ne $baseline) { throw 'HEAD changed during validation. Rerun to validate the new release.' }
    $checkIndex = Join-Path $runRoot 'check.index'
    $null = Invoke-Git @('read-tree', $baseline) $checkIndex
    if ($selected.Count -gt 0) { $null = Invoke-Git (@('--literal-pathspecs', 'add', '--') + $selected) $checkIndex }
    if ((Invoke-Git @('write-tree') $checkIndex) -ne $tree) { throw 'Selected files changed during validation. Nothing was committed; rerun.' }
    $createdCommit = $false
    if ($tree -ne (Invoke-Git @('rev-parse', 'HEAD^{tree}'))) {
        $null = Invoke-Git (@('--literal-pathspecs', 'add', '--') + $selected)
        if ((Invoke-Git @('write-tree')) -ne $tree) { throw 'The real index differs from the validated release. Review staged files before proceeding.' }
        $null = Invoke-Git @('commit', '-m', $Message)
        $createdCommit = $true
    }
    $release = Invoke-Git @('rev-parse', 'HEAD')
    if ((Invoke-Git @('rev-parse', 'HEAD^{tree}')) -ne $tree) { throw 'A commit hook changed the release tree. The release was not pushed; review it and rerun.' }
    if ($createdCommit -and (Invoke-Git @('rev-parse', 'HEAD^')) -ne $baseline) { throw 'The branch changed while committing. The release was not pushed; review it and rerun.' }
    Write-Host ('Pushing validated release ' + $release + '...')
    Invoke-Program -Program $gitExe -Arguments @('-C', $repoRoot, 'push', 'origin', ($release + ':refs/heads/main'))
    Write-Host 'Waiting for Hostinger to serve this exact commit...'
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
    $deadline = (Get-Date).AddMinutes($WaitMinutes)
    $live = $false
    while ((Get-Date) -lt $deadline) {
        try {
            $health = Invoke-WebRequest -UseBasicParsing -Uri ('https://introify.com/api/health?release=' + $release + '&t=' + [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()) -TimeoutSec 15 -Headers @{ 'Cache-Control' = 'no-cache' }
            if ($health.StatusCode -eq 200 -and $health.Headers['x-introify-release'] -eq $release -and ($health.Content | ConvertFrom-Json).status -eq 'ok') { $live = $true; break }
        } catch { }
        Start-Sleep -Seconds 15
    }
    if (-not $live) { throw "Push succeeded, but Hostinger has not served release $release within $WaitMinutes minutes. Check Hostinger build logs; this launcher does not claim deployment success." }
    foreach ($route in @('/', '/sign-in')) {
        $page = Invoke-WebRequest -UseBasicParsing -Uri ('https://introify.com' + $route) -TimeoutSec 30 -Headers @{ 'Cache-Control' = 'no-cache' }
        if ($page.StatusCode -ne 200) { throw 'The release marker matches, but a public page check failed. Review Hostinger before considering this release complete.' }
    }
    Write-Host ('LIVE: https://introify.com — ' + $release) -ForegroundColor Green
    Write-Host ('Validation snapshot retained at ' + $runRoot)
    $exitStatus = 0
} catch {
    Write-Host ('Deployment stopped: ' + $_.Exception.Message) -ForegroundColor Red
} finally {
    if ($null -ne $lockHandle) { $lockHandle.Dispose() }
    if (-not $NoPause) { $null = Read-Host 'Press Enter to close' }
}
exit $exitStatus
