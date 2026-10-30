$ErrorActionPreference = 'Stop'
$prefix = 'Chess-Animation-Studio-0.1.0-win.zip.part'
$parts = @(Get-ChildItem -LiteralPath $PSScriptRoot -Filter "$prefix*" | Sort-Object Name)
if ($parts.Count -ne 4) { throw "Expected 4 archive parts; found $($parts.Count). Re-download and extract the portable-v0.1.0 branch ZIP." }
$zipPath = Join-Path $PSScriptRoot 'Chess-Animation-Studio-0.1.0-win.zip'
$output = [System.IO.File]::Create($zipPath)
try {
    foreach ($part in $parts) {
        $inputStream = [System.IO.File]::OpenRead($part.FullName)
        try { $inputStream.CopyTo($output) } finally { $inputStream.Dispose() }
    }
} finally { $output.Dispose() }
$expected = '85085c139e482fe19e1523d762ef56ce33d1b7d081326bfe876efa2362f7c266'
$actual = (Get-FileHash -LiteralPath $zipPath -Algorithm SHA256).Hash.ToLowerInvariant()
if ($actual -ne $expected) { throw "Archive checksum does not match. Expected $expected; got $actual. Do not run the app." }
$installPath = Join-Path $PSScriptRoot 'Chess Animation Studio'
Expand-Archive -LiteralPath $zipPath -DestinationPath $installPath -Force
$app = Join-Path $installPath 'Chess Animation Studio.exe'
if (-not (Test-Path -LiteralPath $app -PathType Leaf)) { throw "The extracted app executable is missing: $app" }
Write-Host 'Archive verified and extracted. Starting Chess Animation Studio.'
Start-Process -FilePath $app -WorkingDirectory $installPath
