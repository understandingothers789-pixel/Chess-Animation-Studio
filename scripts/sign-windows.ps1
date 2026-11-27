param([Parameter(Mandatory)][string]$Executable)

$ErrorActionPreference = 'Stop'
$sdk = Join-Path ${env:ProgramFiles(x86)} 'Windows Kits\10\bin'
$tool = Get-ChildItem $sdk -Recurse -Filter signtool.exe |
    Where-Object { $_.Directory.Name -eq 'x64' } |
    Sort-Object FullName -Descending |
    Select-Object -First 1
if (-not $tool) { throw 'Windows SDK SignTool is required for publisher signing.' }

$certFile = Join-Path ([IO.Path]::GetTempPath()) ([Guid]::NewGuid().ToString() + '.pfx')
$cert = $null
try {
    [IO.File]::WriteAllBytes($certFile, [Convert]::FromBase64String($env:STUDIO_SIGNING_PFX_BASE64))
    $password = New-Object Security.SecureString
    foreach ($character in $env:STUDIO_SIGNING_PFX_PASSWORD.ToCharArray()) {
        $password.AppendChar($character)
    }
    $cert = Import-PfxCertificate -FilePath $certFile -CertStoreLocation Cert:\CurrentUser\My -Password $password |
        Where-Object HasPrivateKey |
        Select-Object -First 1
    if (-not $cert) { throw 'The publisher credential does not contain a code-signing private key.' }
    & $tool.FullName sign /fd SHA256 /sha1 $cert.Thumbprint /tr 'http://timestamp.digicert.com' /td SHA256 $Executable
    if ($LASTEXITCODE -ne 0) { throw 'Authenticode signing failed.' }
    & $tool.FullName verify /pa $Executable
    if ($LASTEXITCODE -ne 0) { throw 'Authenticode verification failed.' }
    $signature = Get-AuthenticodeSignature -LiteralPath $Executable
    if ($signature.Status -ne 'Valid' -or $signature.SignerCertificate.Thumbprint -ne $cert.Thumbprint) {
        throw 'The executable does not have the configured publisher signature.'
    }
} finally {
    if ($cert) { Remove-Item "Cert:\CurrentUser\My\$($cert.Thumbprint)" -ErrorAction SilentlyContinue }
    Remove-Item -LiteralPath $certFile -Force -ErrorAction SilentlyContinue
}
