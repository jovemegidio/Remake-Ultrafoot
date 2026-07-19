# Assina o executavel e todos os instaladores da build com Authenticode SHA-256.
# A assinatura minisign do atualizador nao substitui Authenticode/SmartScreen.
param(
    [string]$CertThumbprint = $env:CERT_THUMBPRINT,
    [string]$PfxPath = $env:PFX_PATH,
    [string]$PfxPassword = $env:PFX_PASSWORD,
    [string[]]$ArtifactPaths = @(),
    [string]$TimestampUrl = "http://timestamp.digicert.com"
)

$ErrorActionPreference = "Stop"
$signtoolCommand = Get-Command signtool.exe -ErrorAction SilentlyContinue
$signtool = if ($signtoolCommand) { $signtoolCommand.Source } else {
    Get-ChildItem "C:\Program Files (x86)\Windows Kits\10\bin" -Recurse -Filter signtool.exe -ErrorAction SilentlyContinue |
        Where-Object { $_.FullName -match "\\x64\\signtool\.exe$" } |
        Sort-Object FullName -Descending |
        Select-Object -First 1 -ExpandProperty FullName
}
if (-not $signtool) { throw "signtool.exe nao encontrado. Instale o Windows SDK." }

if ($ArtifactPaths.Count -eq 0) {
    $version = (Get-Content "src-tauri\tauri.conf.json" -Raw | ConvertFrom-Json).version
    $ArtifactPaths = @("src-tauri\target\release\ultrafoot.exe")
    $ArtifactPaths += Get-ChildItem "src-tauri\target\release\bundle" -Recurse -File -ErrorAction SilentlyContinue |
        Where-Object { $_.Extension -in @(".exe", ".msi") -and $_.Name -like "*$version*" } |
        Select-Object -ExpandProperty FullName
}
$ArtifactPaths = $ArtifactPaths | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -Unique
if ($ArtifactPaths.Count -eq 0) { throw "Nenhum executavel/instalador da build foi encontrado." }
if (-not $CertThumbprint -and -not ($PfxPath -and $PfxPassword)) {
    throw "Certificado Authenticode ausente. Informe CERT_THUMBPRINT ou PFX_PATH/PFX_PASSWORD; a chave privada nunca deve entrar no repositorio."
}

foreach ($artifact in $ArtifactPaths) {
    Write-Host "Assinando $artifact" -ForegroundColor Cyan
    $common = @("sign", "/fd", "sha256", "/td", "sha256", "/tr", $TimestampUrl, "/v")
    if ($CertThumbprint) { & $signtool @common "/sha1" $CertThumbprint $artifact }
    else { & $signtool @common "/f" $PfxPath "/p" $PfxPassword $artifact }
    if ($LASTEXITCODE -ne 0) { throw "Falha ao assinar $artifact" }
    & $signtool verify /pa /all $artifact
    if ($LASTEXITCODE -ne 0) { throw "Assinatura invalida em $artifact" }
}

Write-Host "Authenticode aplicado e verificado em $($ArtifactPaths.Count) artefato(s)." -ForegroundColor Green
