# FAST UPDATE - aplica alteracoes no jogo INSTALADO sem gerar instalador novo.
#
# Recompila o app pulando o empacotamento NSIS (makensis, ~15-20 min) e troca so
# o ultrafoot.exe (que ja embute o frontend + imagens) sobre a instalacao.
# Total ~3-4 min em vez de ~20. Use isto pra iterar em codigo/dados/telas.
#
# Fluxo: sync do source G:->C:  ->  tauri build --no-bundle  ->  troca do exe.
# Uso:  powershell -ExecutionPolicy Bypass -File scripts\fast-update.ps1
#
# Para RELEASE (instalador completo): npm run tauri:build em C:\ultrafoot-build
# com ambiente limpo (ver memoria: NAO rodar builds sobrepostas).
# ASCII-only de proposito: PowerShell 5.1 quebra o parse com acentos/em-dash.

$ErrorActionPreference = "Stop"
$G = (Resolve-Path "$PSScriptRoot\..").Path
$C = "C:\ultrafoot-build"

Write-Host "==> Sync source G: -> C: (sem node_modules/target/.next)..."
$opts = @('/MIR','/XF','desktop.ini','/XD','node_modules','.next','target','gen','.git','/R:1','/W:1','/MT:16','/NP','/NFL','/NDL','/NJH','/NJS')
foreach ($f in @('app','components','lib','hooks','styles','scripts','data')) {
  if (Test-Path "$G\$f") { robocopy "$G\$f" "$C\$f" @opts | Out-Null }
}
foreach ($f in @('package.json','next.config.mjs','tsconfig.json','postcss.config.mjs','components.json','next-env.d.ts')) {
  if (Test-Path "$G\$f") { Copy-Item "$G\$f" "$C\$f" -Force }
}
foreach ($d in @('images','brand','logos','flags','cutscenes')) {
  if (Test-Path "$G\public\$d") { robocopy "$G\public\$d" "$C\public\$d" '/XF' 'desktop.ini' '/R:1' '/W:1' '/MT:16' '/NP' '/NFL' '/NDL' '/NJH' '/NJS' | Out-Null }
}

Write-Host "==> Limpando processos antes de UMA build..."
Get-Process ultrafoot,node,cargo,rustc,makensis,link -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 2

Write-Host "==> tauri build --no-bundle (pula o makensis)..."
$env:Path = "$env:USERPROFILE\.cargo\bin;$env:Path"
Push-Location $C
cmd /c "npm run tauri:build -- --no-bundle"
$code = $LASTEXITCODE
Pop-Location
if ($code -ne 0) {
  Write-Host "BUILD FALHOU (exit $code). Veja o log acima."
  exit $code
}

Write-Host "==> Trocando o exe no jogo instalado..."
$built = "$C\src-tauri\target\release\ultrafoot.exe"
$inst  = "$env:LOCALAPPDATA\Ultrafoot 26\ultrafoot.exe"
Get-Process ultrafoot -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 2
Copy-Item $built $inst -Force
$v = (Get-Item $inst).VersionInfo.FileVersion
Write-Host "OK - jogo instalado atualizado (v$v). Abra o Ultrafoot para ver as mudancas."
