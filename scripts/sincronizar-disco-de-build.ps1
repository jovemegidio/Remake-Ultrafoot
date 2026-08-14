# SINCRONIZA O REPOSITÓRIO (G:) PARA O DISCO DE BUILD (C:) E **PROVA** QUE COPIOU.
#
# Por que este script existe
# --------------------------
# O repositório mora numa montagem do Google Drive. O cliente do Drive TRAVA
# arquivos enquanto sincroniza, e isso quebrou a build de duas maneiras
# diferentes em 11/08/2026:
#
#   1. `robocopy /MIR` viu uma pasta de origem momentaneamente ilegível,
#      concluiu "está vazia" e APAGOU o destino para espelhar. Levou junto
#      `lib`, `app`, `components` e os instaladores do disco de build.
#   2. Uma cópia com `/R:1` desistiu de **1.120 imagens** (ERRO 32, "arquivo em
#      uso") e seguiu adiante em silêncio. O type-check foi quem denunciou, e só
#      porque os arquivos que faltavam eram importados por TypeScript — as 1.120
#      imagens de uniforme não teriam denunciado ninguém: o instalador sairia
#      sem elas e o defeito apareceria no jogador.
#
# As três regras que este script aplica
# -------------------------------------
#   1. NUNCA `/MIR`. Só `/E`, que copia e jamais apaga. Espelhar exclusões a
#      partir de uma origem instável é apostar o disco de build num piscar de
#      rede.
#   2. Paciência em vez de paralelismo: `/R:10 /W:3` e sem `/MT`. A trava do
#      Drive é passageira; disputa por thread só a piora.
#   3. CONFERIR DEPOIS. Contagem de arquivos e soma de bytes por pasta, origem
#      contra destino. Sem isto, "terminou" e "copiou tudo" são coisas
#      diferentes — e foi essa diferença que quase publicou um pacote incompleto.
#
#   pwsh -File scripts/sincronizar-disco-de-build.ps1
#   pwsh -File scripts/sincronizar-disco-de-build.ps1 -Origem "G:\...\Ultrafoot - PC" -Destino C:\Ultrafoot

param(
  [string]$Origem  = "G:\Outros computadores\Meu laptop\Trabalho\Ultrafoot - PC",
  [string]$Destino = "C:\Ultrafoot",
  # Pastas que NÃO devem viajar: artefatos e dependências, refeitos no destino.
  [string[]]$Excluir = @("node_modules", ".next", "out", "target", ".git", ".venv2")
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path $Origem)) { throw "origem não encontrada: $Origem" }
New-Item -ItemType Directory -Force -Path $Destino | Out-Null

$log = Join-Path $env:TEMP "sincronizar-disco-de-build.log"
Write-Host "origem : $Origem"
Write-Host "destino: $Destino"
Write-Host ""

# ── 1. Cópia ───────────────────────────────────────────────────────────────
$t = [System.Diagnostics.Stopwatch]::StartNew()
robocopy $Origem $Destino /E /XD $Excluir /XF desktop.ini /R:10 /W:3 /NP /NDL /NFL /LOG:$log | Out-Null
$t.Stop()
$travados = @(Select-String -Path $log -Pattern "ERRO 32|ERROR 32" -ErrorAction SilentlyContinue).Count
Write-Host ("copia: {0:N1} min | arquivos que o Drive manteve travados ate o fim: {1}" -f $t.Elapsed.TotalMinutes, $travados)

# ── 2. Conferência ─────────────────────────────────────────────────────────
# Por PASTA DE PRIMEIRO NÍVEL, contagem e bytes. Divergência aqui é cópia
# incompleta, e cópia incompleta que passa despercebida vira build publicada
# sem uniforme.
# ⚠️ A MEDIÇÃO PRECISA APLICAR AS MESMAS EXCLUSÕES DA CÓPIA.
#
# A primeira versão disto contava `node_modules` e `target` DENTRO das pastas de
# origem — os mesmos diretórios que a cópia exclui de propósito. Resultado:
# `src-tauri` aparecia com "FALTAM 136.383" (era o cache do Rust) e `services`
# com "FALTAM 3.029" (node_modules dos serviços). Uma verificação que grita em
# cima de diferença esperada é pior do que não verificar: ensina a ignorar o
# vermelho, e aí o dia em que faltar de verdade ninguém olha.
$padraoExcluido = ($Excluir | ForEach-Object { [regex]::Escape($_) }) -join "|"

function Medir([string]$caminho) {
  $itens = Get-ChildItem $caminho -Recurse -File -ErrorAction SilentlyContinue |
    Where-Object {
      $_.Name -ne "desktop.ini" -and
      ($_.FullName -split "[\\/]" | Where-Object { $_ -match "^($padraoExcluido)$" }).Count -eq 0
    }
  [pscustomobject]@{
    Arquivos = @($itens).Count
    Bytes    = ($itens | Measure-Object Length -Sum).Sum
  }
}

$pastas = Get-ChildItem $Origem -Directory |
  Where-Object { $Excluir -notcontains $_.Name } |
  Select-Object -ExpandProperty Name

$divergencias = @()
foreach ($p in $pastas) {
  $o = Medir (Join-Path $Origem $p)
  $d = Medir (Join-Path $Destino $p)
  $faltam = $o.Arquivos - $d.Arquivos
  $estado = if ($faltam -eq 0) { "ok" } else { "FALTAM $faltam" }
  Write-Host ("  {0,-16} origem {1,7} arq  destino {2,7} arq   {3}" -f $p, $o.Arquivos, $d.Arquivos, $estado)
  if ($faltam -ne 0) { $divergencias += [pscustomobject]@{ Pasta = $p; Faltam = $faltam } }
}

Write-Host ""
if ($divergencias.Count -gt 0) {
  Write-Host "FALHA: o disco de build esta INCOMPLETO. Nao compile assim." -ForegroundColor Red
  Write-Host "Se as faltas persistirem, pause a sincronizacao do Google Drive e rode de novo." -ForegroundColor Red
  $divergencias | Format-Table -AutoSize
  exit 1
}
Write-Host "OK: disco de build confere com o repositorio, pasta por pasta." -ForegroundColor Green
