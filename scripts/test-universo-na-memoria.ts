// O UNIVERSO NÃO PODE ENTRAR NA MEMÓRIA DE QUEM NÃO O USA.
//
// ⚠️ O NÚMERO QUE ORIGINOU ISTO. Medido em 18/08/2026, no arquivo real desta
// máquina: `ultrafoot-universo.json` tem 42,3 MB e custa **158 MB de heap** —
// 85 MB só para segurar o texto e mais 74 MB depois do `JSON.parse`. Ler e
// interpretar leva ~300 ms.
//
// E no jogo toda navegação é RECARGA COMPLETA. Ou seja: 158 MB alocados e
// jogados fora a cada troca de tela. Na splash, no menu e no online não há
// carreira aberta e ninguém lê o universo — pagar isso ali é o caminho mais
// provável de um "out of memory" logo na abertura, numa máquina modesta.
//
// ⚠️ O QUE ESTE GATE PROVA, E O QUE NÃO PROVA. Ele lê o CÓDIGO: garante que a
// carga do universo continua condicionada à carreira aberta e que a condição não
// foi removida numa limpeza distraída. Ele não mede o heap do jogo rodando —
// isso exige o app aberto, e um teste que precisa de olho humano não é gate.
//
// Uso: npx tsx scripts/test-universo-na-memoria.ts

import { readFileSync, existsSync, statSync } from "node:fs"
import path from "node:path"

let falhas = 0
const erro = (m: string) => { console.log("FALHA: " + m); falhas++ }
const ok = (m: string) => console.log("ok   " + m)

const store = readFileSync("lib/persistent-store.ts", "utf-8")

// ── 1. A carga do universo é condicionada ───────────────────────────────────
{
  const trecho = store.match(/if \(cache\.get\(CHAVE_CARREIRA_ATIVA\)\) \{[\s\S]{0,200}?_carregarUniversoParaOCache\(\)/)
  if (!trecho) {
    erro("o universo voltou a ser carregado SEM conferir se ha carreira aberta — "
      + "sao 158 MB de heap na splash, no menu e no online")
  } else {
    ok("o universo so entra na memoria quando ha carreira aberta")
  }
}

// ── 2. Ele continua fora do espelho do localStorage ─────────────────────────
//
// O espelho existe para rotinas síncronas de listagem. Se o universo entrar
// nele, a WebView passa a segurar DUAS cópias de 42 MB — foi o que já aconteceu
// com as imagens em base64, e é por isso que `MAX_LOCAL_MIRROR_LENGTH` existe.
{
  const carga = store.match(/async function _carregarUniversoParaOCache[\s\S]*?\n\}/)?.[0] ?? ""
  if (!carga) {
    erro("nao encontrei `_carregarUniversoParaOCache` — o gate perdeu o alvo")
  } else if (/_mirrorToLocalStorage/.test(carga)) {
    erro("o universo passou a ser espelhado no localStorage: duas copias de 42 MB na WebView")
  } else {
    ok("o universo nao e espelhado no localStorage")
  }
}

// ── 3. O arquivo real, quando existe, cabe no teto ──────────────────────────
//
// Diagnóstico, não invenção: se o universo desta máquina estourar, o jogador
// dela vai sentir — e o número aparece aqui antes de virar relato.
{
  const arquivo = path.join(process.env.APPDATA ?? "", "com.ultrafoot.remake", "ultrafoot-universo.json")
  const TETO_MB = 80
  if (!existsSync(arquivo)) {
    console.log("     (sem universo nesta maquina — so a regra foi conferida)")
  } else {
    const mb = statSync(arquivo).size / 1048576
    // O heap custa cerca de 3,7x o arquivo (medido: 42,3 MB -> 158 MB).
    const heapEstimado = mb * 3.7
    console.log(`     universo real: ${mb.toFixed(1)} MB em disco, ~${heapEstimado.toFixed(0)} MB de heap`)
    if (mb > TETO_MB) {
      erro(`o universo tem ${mb.toFixed(0)} MB (teto ${TETO_MB}) — `
        + `seriam ~${heapEstimado.toFixed(0)} MB de heap por tela`)
    }
  }
}

console.log(falhas === 0
  ? "\nMEMORIA OK — o universo so e carregado por quem vai usa-lo."
  : `\n${falhas} problema(s): o jogo pode estar gastando centenas de MB a toa.`)
process.exit(falhas === 0 ? 0 : 1)
