$ErrorActionPreference = 'Stop'

# Este script roda durante a instalacao NSIS. Os ativos sao dados globais do
# jogo (nao fazem parte dos saves), por isso sao extraidos diretamente no
# diretorio de instalacao.
$resourceDirectory = $PSScriptRoot
$installDirectory = Split-Path -Parent $resourceDirectory
$archivePath = Join-Path $resourceDirectory 'game-assets.zip'

$logPath = Join-Path $env:TEMP 'ultrafoot-assets-install.log'

if (-not (Test-Path -LiteralPath $archivePath -PathType Leaf)) { exit 0 }

try {
    "[$(Get-Date -Format o)] Iniciando extracao em $installDirectory" | Set-Content -LiteralPath $logPath -Encoding UTF8
    $extracted = $false
    $sevenZipPath = Join-Path $resourceDirectory 'extractor\7z.exe'

    # O extrator acompanha o instalador para que o processo seja previsivel mesmo
    # em edicoes do Windows sem tar.exe. O pacote inclui a licença oficial do 7-Zip.
    if (Test-Path -LiteralPath $sevenZipPath -PathType Leaf) {
        & $sevenZipPath x $archivePath "-o$installDirectory" -y -aoa 2>> $logPath | Out-Null
        if ($LASTEXITCODE -eq 0) { $extracted = $true }
        else { "7-Zip retornou $LASTEXITCODE; tentando extrator do Windows." | Add-Content -LiteralPath $logPath }
    }

    # O instalador NSIS pode iniciar o PowerShell em 32 bits. Nesse caso,
    # System32 e redirecionado para SysWOW64 e o tar.exe parece inexistente.
    # Sysnative permite alcançar o extrator de 64 bits sem esse redirecionamento.
    $tarPath = @(
        (Join-Path $env:SystemRoot 'Sysnative\tar.exe'),
        (Join-Path $env:SystemRoot 'System32\tar.exe')
    ) | Where-Object { Test-Path -LiteralPath $_ -PathType Leaf } | Select-Object -First 1

    # tar.exe acompanha o Windows 10/11 e e muito mais rapido/estavel com milhares
    # de imagens pequenas. Em sistemas antigos, cai no Expand-Archive.
    if (-not $extracted -and $tarPath) {
        & $tarPath -xf $archivePath -C $installDirectory 2>> $logPath
        if ($LASTEXITCODE -eq 0) { $extracted = $true }
        else { "tar.exe retornou $LASTEXITCODE; tentando fallback." | Add-Content -LiteralPath $logPath }
    }

    if (-not $extracted) {
        Expand-Archive -LiteralPath $archivePath -DestinationPath $installDirectory -Force
    }

    if (-not (Test-Path -LiteralPath (Join-Path $installDirectory 'escudos')) -or
        -not (Test-Path -LiteralPath (Join-Path $installDirectory 'kits-imported'))) {
        throw 'O pacote foi extraido, mas as pastas obrigatorias nao foram encontradas.'
    }

    Remove-Item -LiteralPath $archivePath -Force
    "[$(Get-Date -Format o)] Ativos instalados com sucesso." | Add-Content -LiteralPath $logPath
    exit 0
} catch {
    "[$(Get-Date -Format o)] ERRO: $($_.Exception.Message)`n$($_.ScriptStackTrace)" | Add-Content -LiteralPath $logPath
    exit 1
}
