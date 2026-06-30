# sign-installer.ps1
# Assina o instalador Ultrafoot 26 com um certificado EV/OV
#
# PRE-REQUISITOS:
#   1. Windows SDK instalado (inclui signtool.exe)
#      Download: https://developer.microsoft.com/en-us/windows/downloads/windows-sdk/
#   2. Certificado OV ou EV de uma CA confiavel:
#      - DigiCert (mais comum): https://www.digicert.com/code-signing
#      - Sectigo: https://sectigo.com/ssl-certificates-tls/code-signing
#      - Azure Code Signing (servico Microsoft): https://learn.microsoft.com/azure/trusted-signing
#   3. Certificado instalado no Windows Certificate Store, OU arquivo .pfx disponivel
#
# USO:
#   .\scripts\sign-installer.ps1 -CertThumbprint "SEU_THUMBPRINT_AQUI"
#   .\scripts\sign-installer.ps1 -PfxPath "C:\cert.pfx" -PfxPassword "senha"
#
# ONDE OBTER O THUMBPRINT:
#   1. Instale o certificado no Windows
#   2. Abra certmgr.msc → Personal → Certificates
#   3. Clique duas vezes no certificado → Details → Thumbprint
#   4. Copie o valor (sem espacos)

param(
    [string]$CertThumbprint = $env:CERT_THUMBPRINT,
    [string]$PfxPath = $env:PFX_PATH,
    [string]$PfxPassword = $env:PFX_PASSWORD,
    [string]$InstallerPath = "src-tauri\target\release\bundle\nsis\Ultrafoot 26_1.0.0_x64-setup.exe",
    [string]$TimestampUrl = "http://timestamp.digicert.com"
)

# Localiza signtool.exe
$signtool = Get-Command signtool.exe -ErrorAction SilentlyContinue
if (-not $signtool) {
    $sdkPaths = @(
        "C:\Program Files (x86)\Windows Kits\10\bin\10.0.22621.0\x64\signtool.exe",
        "C:\Program Files (x86)\Windows Kits\10\bin\10.0.19041.0\x64\signtool.exe",
        "C:\Program Files\Windows Kits\10\bin\10.0.22621.0\x64\signtool.exe"
    )
    $signtool = $sdkPaths | Where-Object { Test-Path $_ } | Select-Object -First 1
    if (-not $signtool) {
        Write-Error "signtool.exe nao encontrado. Instale o Windows SDK."
        exit 1
    }
}

if (-not (Test-Path $InstallerPath)) {
    Write-Error "Instalador nao encontrado: $InstallerPath"
    Write-Host "Execute 'npm run tauri build' primeiro."
    exit 1
}

Write-Host "Assinando: $InstallerPath" -ForegroundColor Cyan

if ($CertThumbprint) {
    # Assinar usando certificado no Windows Store (EV recomendado)
    & $signtool sign `
        /sha1 $CertThumbprint `
        /fd sha256 `
        /td sha256 `
        /tr $TimestampUrl `
        /v `
        $InstallerPath
} elseif ($PfxPath -and $PfxPassword) {
    # Assinar usando arquivo .pfx
    & $signtool sign `
        /f $PfxPath `
        /p $PfxPassword `
        /fd sha256 `
        /td sha256 `
        /tr $TimestampUrl `
        /v `
        $InstallerPath
} else {
    Write-Error "Forneca -CertThumbprint ou -PfxPath + -PfxPassword"
    Write-Host ""
    Write-Host "Exemplos:" -ForegroundColor Yellow
    Write-Host "  # Usando certificado instalado no Windows (EV):"
    Write-Host "  .\scripts\sign-installer.ps1 -CertThumbprint 'ABC123...'"
    Write-Host ""
    Write-Host "  # Usando arquivo .pfx:"
    Write-Host "  .\scripts\sign-installer.ps1 -PfxPath 'C:\meu-cert.pfx' -PfxPassword 'senha'"
    Write-Host ""
    Write-Host "  # Usando variaveis de ambiente (para CI/CD):"
    Write-Host "  `$env:CERT_THUMBPRINT='ABC123...'"
    Write-Host "  .\scripts\sign-installer.ps1"
    exit 1
}

if ($LASTEXITCODE -eq 0) {
    Write-Host "Assinatura concluida com sucesso!" -ForegroundColor Green
    # Verifica a assinatura
    & $signtool verify /pa /v $InstallerPath
} else {
    Write-Error "Falha na assinatura. Codigo de saida: $LASTEXITCODE"
    exit 1
}
