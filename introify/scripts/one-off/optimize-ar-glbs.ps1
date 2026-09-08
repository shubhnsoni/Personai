# Compresses raw Meshy GLB exports into models small enough to stream to a phone.
#
# Meshy exports ~90 MB per dish: ~1.9M triangles with f32 attributes plus 4K
# JPEG textures. That will never load over a tunnel on mobile data.
#
# Pipeline per model:
#   1. gltf-transform copy  -> externalises textures next to a .gltf
#   2. ImageMagick          -> downsizes those textures
#      (gltf-transform's own --texture-compress uses sharp, whose libvips on this
#       machine fails with "colourspace: parameter space not set")
#   3. gltf-transform optimize -> weld + simplify + meshopt compression
#
# Raw originals are moved out of public/ so Next.js never serves a 90 MB file.

param(
    [string]$SrcDir = "public/uploads/skydine-ar",
    [string]$RawDir = "../ar-raw/skydine-ar-source",
    [string]$WorkDir = "../ar-raw/work",
    [double]$SimplifyError = 0.001,
    [int]$ColorSize = 1024,
    [int]$MaskSize = 512
)

$ErrorActionPreference = "Stop"
$gltf = @("npx", "--yes", "@gltf-transform/cli@4.4.2")

function Invoke-Gltf {
    param([string[]]$GltfArgs)
    $out = & $gltf[0] $gltf[1] $gltf[2] @GltfArgs 2>&1
    if ($LASTEXITCODE -ne 0) {
        $out | ForEach-Object { Write-Host $_ }
        throw "gltf-transform failed: $($GltfArgs -join ' ')"
    }
}

New-Item -ItemType Directory -Force -Path $RawDir, $WorkDir | Out-Null

$models = Get-ChildItem -LiteralPath $SrcDir -Filter *.glb -File |
    Where-Object { $_.Length -gt 20MB } |
    Sort-Object Name

if (-not $models) {
    Write-Host "nothing to do - no oversized .glb in $SrcDir"
    exit 0
}

$report = @()

foreach ($m in $models) {
    $name = [IO.Path]::GetFileNameWithoutExtension($m.Name)
    $beforeMb = [math]::Round($m.Length / 1MB, 2)
    Write-Host "`n=== $name ($beforeMb MB) ===" -ForegroundColor Cyan

    # keep the untouched export outside public/
    $raw = Join-Path $RawDir $m.Name
    Move-Item -LiteralPath $m.FullName -Destination $raw -Force

    $work = Join-Path $WorkDir $name
    if (Test-Path $work) { Remove-Item -Recurse -Force $work }
    New-Item -ItemType Directory -Force -Path $work | Out-Null

    # 1. externalise textures
    Invoke-Gltf @("copy", $raw, (Join-Path $work "m.gltf"))

    # 2. downsize textures with ImageMagick
    foreach ($img in Get-ChildItem -LiteralPath $work -Include *.jpg, *.jpeg, *.png -File) {
        $isMask = $img.Name -match "(?i)metallic|roughness|occlusion|specular"
        $target = if ($isMask) { $MaskSize } else { $ColorSize }
        $quality = if ($isMask) { 80 } elseif ($img.Name -match "(?i)normal") { 88 } else { 84 }
        $kbBefore = [math]::Round($img.Length / 1KB)

        # ">" only shrinks, never upscales a texture that is already small
        & magick $img.FullName -resize "${target}x${target}>" -strip -quality $quality -sampling-factor 4:2:0 $img.FullName
        if ($LASTEXITCODE -ne 0) { throw "magick failed on $($img.Name)" }

        $kbAfter = [math]::Round((Get-Item -LiteralPath $img.FullName).Length / 1KB)
        Write-Host ("    {0,-26} {1,6} KB -> {2,5} KB  (max {3}px)" -f $img.Name, $kbBefore, $kbAfter, $target)
    }

    # 3. weld + simplify + meshopt
    $outGlb = Join-Path $SrcDir "$name.glb"
    Invoke-Gltf @(
        "optimize", (Join-Path $work "m.gltf"), $outGlb,
        "--compress", "meshopt",
        "--texture-compress", "false",
        "--simplify", "true",
        "--simplify-error", "$SimplifyError"
    )

    $afterMb = [math]::Round((Get-Item -LiteralPath $outGlb).Length / 1MB, 2)
    Write-Host ("    => {0} MB -> {1} MB" -f $beforeMb, $afterMb) -ForegroundColor Green
    $report += [pscustomobject]@{ Model = $name; BeforeMB = $beforeMb; AfterMB = $afterMb }
}

Write-Host "`n"
$report | Format-Table -AutoSize
$totalBefore = ($report | Measure-Object BeforeMB -Sum).Sum
$totalAfter = ($report | Measure-Object AfterMB -Sum).Sum
Write-Host ("total {0} MB -> {1} MB" -f [math]::Round($totalBefore, 1), [math]::Round($totalAfter, 1)) -ForegroundColor Green
Write-Host "raw exports kept in $RawDir"
