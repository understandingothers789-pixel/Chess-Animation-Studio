$ErrorActionPreference = 'Stop'
$prefix = 'Chess-Animation-Studio-0.1.5-win.zip.part'
$parts = @(Get-ChildItem -LiteralPath $PSScriptRoot -Filter "$prefix*" | Sort-Object Name)
if ($parts.Count -ne 4) { throw "Expected 4 archive parts; found $($parts.Count). Re-download and extract the windows-v0.1.5 ZIP." }
$zipPath = Join-Path $PSScriptRoot 'Chess-Animation-Studio-0.1.5-win.zip'
$output = [System.IO.File]::Create($zipPath)
try {
    foreach ($part in $parts) {
        $inputStream = [System.IO.File]::OpenRead($part.FullName)
        try { $inputStream.CopyTo($output) } finally { $inputStream.Dispose() }
    }
} finally { $output.Dispose() }
$expected = 'bd1f0002e02f40fd62a8a543bf688e98ec40cef7aa9d5168ec90a7716bcc591d'
$actual = (Get-FileHash -LiteralPath $zipPath -Algorithm SHA256).Hash.ToLowerInvariant()
if ($actual -ne $expected) { throw "Archive checksum does not match. Expected $expected; got $actual. Do not run the app." }
$installPath = Join-Path $PSScriptRoot 'Chess Animation Studio'
Expand-Archive -LiteralPath $zipPath -DestinationPath $installPath -Force
$app = Join-Path $installPath 'Chess Animation Studio.exe'
if (-not (Test-Path -LiteralPath $app -PathType Leaf)) { throw "The extracted app executable is missing: $app" }
Write-Host 'Archive verified and extracted. Starting Chess Animation Studio.'
Start-Process -FilePath $app -WorkingDirectory $installPath
