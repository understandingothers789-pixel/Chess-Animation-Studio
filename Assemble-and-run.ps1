$ErrorActionPreference = 'Stop'
$prefix = 'Chess-Animation-Studio-0.1.6-win.zip.part'
$parts = @(Get-ChildItem -LiteralPath $PSScriptRoot -Filter "$prefix*" | Sort-Object Name)
if ($parts.Count -ne 4) { throw "Expected 4 archive parts; found $($parts.Count). Re-download and extract the windows-v0.1.6 ZIP." }
$zipPath = Join-Path $PSScriptRoot 'Chess-Animation-Studio-0.1.6-win.zip'
$output = [System.IO.File]::Create($zipPath)
try {
    foreach ($part in $parts) {
        $inputStream = [System.IO.File]::OpenRead($part.FullName)
        try { $inputStream.CopyTo($output) } finally { $inputStream.Dispose() }
    }
} finally { $output.Dispose() }
$expected = 'd70dd3616108f117bcb6d552a2bfff6de70ca0d9424bf7fbcbcad3a45ccfa5cd'
$actual = (Get-FileHash -LiteralPath $zipPath -Algorithm SHA256).Hash.ToLowerInvariant()
if ($actual -ne $expected) { throw "Archive checksum does not match. Expected $expected; got $actual. Do not run the app." }
$installPath = Join-Path $PSScriptRoot 'Chess Animation Studio'
Expand-Archive -LiteralPath $zipPath -DestinationPath $installPath -Force
$app = Join-Path $installPath 'Chess Animation Studio.exe'
if (-not (Test-Path -LiteralPath $app -PathType Leaf)) { throw "The extracted app executable is missing: $app" }
Write-Host 'Archive verified and extracted. Starting Chess Animation Studio.'
Start-Process -FilePath $app -WorkingDirectory $installPath
