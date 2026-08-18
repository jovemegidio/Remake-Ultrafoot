// O GATE DO ESTADO QUE NÃO PODE INCHAR (1.0.346).
//
// ⚠️ POR QUE ELE EXISTE. Em 17/08/2026 o jogo ficou com TELA PRETA em todas as
// versões — inclusive nas antigas, que funcionavam. Não era regressão de código:
// `ultrafoot-clubs.json` tinha chegado a **546 MB**. Cada carreira grava um
// "universo 286" de ~42 MB e NINGUÉM os apagava, então treze carreiras de teste
// empilharam meio giga. O jogo travava a thread lendo isso no boot, e o sintoma
// era uma janela preta sem erro nenhum.
//
// ⚠️ E ISSO JÁ TINHA ACONTECIDO. O universo saiu do save por peso na 1.0.301 e
// voltou a ser persistido, agora multiplicado por carreira. Voltou em silêncio
// porque nenhum dos treze portões olhava para o TAMANHO do que fica em disco:
// todos conferem comportamento e dados, e o arquivo cresce na máquina do
// jogador, uma carreira por vez.
//
// O que este gate cobra:
//   1. a REGRA: universo de carreira que não existe mais é lixo e tem de sumir;
//   2. o TETO: nenhum universo isolado pode passar do limite;
//   3. o DIAGNÓSTICO: se houver um estado real em disco, ele é auditado e o
//      total é mostrado — é assim que o problema teria sido visto antes.
//
// Uso: npx tsx scripts/test-universo-nao-incha.ts

import { existsSync, readFileSync, statSync } from "node:fs"
import path from "node:path"

let falhas = 0
const erro = (m: string) => { console.log("FALHA: " + m); falhas++ }

const PREFIXO_UNIVERSO = "ultrafoot:universo:"
const PREFIXO_SAVE = "ultrafoot:save:"
/** Teto por universo. O real hoje é ~42 MB; acima disto vira trava de boot. */
const TETO_POR_UNIVERSO_MB = 60
/** Teto do arquivo inteiro. Aos 546 MB o jogo nao abria. */
const TETO_DO_ESTADO_MB = 150

/**
 * A REGRA, testada sem depender do disco: dado o conjunto de carreiras vivas,
 * quais chaves de universo sobram? É a mesma decisão de
 * `limparUniversosDeCarreirasMortas` em lib/save-system.
 */
function orfaos(chaves: string[], ativa: Set<string>): string[] {
  return chaves
    .filter(k => k.startsWith(PREFIXO_UNIVERSO))
    .filter(k => !ativa.has(k.slice(PREFIXO_UNIVERSO.length)))
}

// ── 1. A regra apaga o orfao e PRESERVA o vivo ──────────────────────────────
{
  const chaves = [
    `${PREFIXO_UNIVERSO}career-viva`,
    `${PREFIXO_UNIVERSO}career-morta`,
    `${PREFIXO_SAVE}career-viva`,
    "ultrafoot-game-engine",
  ]
  const lixo = orfaos(chaves, new Set(["career-viva"]))
  if (lixo.length !== 1 || !lixo[0].endsWith("career-morta")) {
    erro(`a limpeza deveria remover 1 orfao (career-morta), removeu: ${JSON.stringify(lixo)}`)
  } else {
    console.log("regra: universo de carreira apagada vira lixo, o da carreira viva fica")
  }
}

// ⚠️ O CASO QUE MAIS IMPORTA: nunca apagar o universo da carreira ATIVA. Apagar
// o dela custa 1,8 s de ressemeadura e, pior, MUDA O MUNDO dela.
{
  const chaves = [`${PREFIXO_UNIVERSO}career-ativa`]
  if (orfaos(chaves, new Set(["career-ativa"])).length !== 0) {
    erro("a limpeza apagaria o universo da carreira ATIVA")
  } else {
    console.log("regra: universo da carreira ativa nunca e apagado")
  }
}

// E nada que nao seja universo pode ser tocado — o save em si mora ao lado.
{
  const chaves = [`${PREFIXO_SAVE}career-morta`, `${PREFIXO_SAVE}career-morta:backup`]
  if (orfaos(chaves, new Set()).length !== 0) {
    erro("a limpeza tocaria em chave de SAVE, que nao e universo")
  } else {
    console.log("regra: chaves de save nunca sao tocadas pela limpeza")
  }
}

// ── 2. O estado REAL desta maquina, quando existir ──────────────────────────
// Diagnostico, nao invencao: se os arquivos estao aqui, sao auditados de verdade.
//
// ⚠️ SAO DOIS ARQUIVOS desde a 1.0.346. O universo saiu para o proprio, porque
// `store.save()` reescreve o arquivo INTEIRO e ele arrastava 42 MB junto de cada
// autosave. O principal e o que precisa ficar pequeno; o do universo e o que
// precisa nao acumular carreira.
const PASTA = path.join(process.env.APPDATA ?? "", "com.ultrafoot.remake")
const ARQUIVO_PRINCIPAL = path.join(PASTA, "ultrafoot-clubs.json")
const ARQUIVO_DO_UNIVERSO = path.join(PASTA, "ultrafoot-universo.json")
/** O principal e reescrito a cada gravacao: e o tamanho DELE que vira travada. */
const TETO_DO_PRINCIPAL_MB = 40

const lerJson = (p: string): Record<string, unknown> | null => {
  if (!existsSync(p)) return null
  try { return JSON.parse(readFileSync(p, "utf-8")) as Record<string, unknown> } catch { return null }
}

if (!existsSync(ARQUIVO_PRINCIPAL)) {
  console.log("(sem estado real nesta maquina — so a regra foi testada)")
} else {
  const mbDe = (p: string) => (existsSync(p) ? statSync(p).size / 1048576 : 0)
  const mbPrincipal = mbDe(ARQUIVO_PRINCIPAL)
  const mbUniverso = mbDe(ARQUIVO_DO_UNIVERSO)
  console.log(`estado real: ${mbPrincipal.toFixed(1)} MB (principal) `
    + `+ ${mbUniverso.toFixed(1)} MB (universo)`)

  // O CUSTO DE CADA GRAVACAO e o tamanho do principal — este teto e o que
  // impede a volta do "cada clique reescreve o arquivo inteiro".
  if (mbPrincipal > TETO_DO_PRINCIPAL_MB) {
    erro(`o arquivo principal tem ${mbPrincipal.toFixed(0)} MB (teto ${TETO_DO_PRINCIPAL_MB}) — `
      + "ele e reescrito a CADA gravacao, entao isto e travada por clique")
  }
  if (mbPrincipal + mbUniverso > TETO_DO_ESTADO_MB) {
    erro(`o estado somado tem ${(mbPrincipal + mbUniverso).toFixed(0)} MB `
      + `(teto ${TETO_DO_ESTADO_MB}) — aos 546 MB o jogo abria em tela preta`)
  }

  const principal = lerJson(ARQUIVO_PRINCIPAL)
  const doUniverso = lerJson(ARQUIVO_DO_UNIVERSO) ?? {}
  if (!principal) {
    console.log("(estado ilegivel como JSON — so o tamanho foi conferido)")
  } else {
    const vivas = new Set(
      Object.keys(principal).filter(k => k.startsWith(PREFIXO_SAVE) && !k.endsWith(":backup"))
        .map(k => k.slice(PREFIXO_SAVE.length)),
    )
    // Os dois arquivos entram na conta: enquanto a mudanca de casa nao roda, o
    // universo antigo ainda esta no principal e continua pesando igual.
    const todos: Record<string, unknown> = { ...doUniverso, ...principal }
    const universos = Object.keys(todos).filter(k => k.startsWith(PREFIXO_UNIVERSO))
    for (const u of universos) {
      const mb = JSON.stringify(todos[u]).length / 1048576
      if (mb > TETO_POR_UNIVERSO_MB) {
        erro(`${u} tem ${mb.toFixed(0)} MB (teto ${TETO_POR_UNIVERSO_MB})`)
      }
    }
    const noPrincipal = Object.keys(principal).filter(k => k.startsWith(PREFIXO_UNIVERSO))
    if (noPrincipal.length > 0) {
      erro(`${noPrincipal.length} universo(s) ainda no arquivo principal — a mudanca `
        + "de casa nao rodou, e cada gravacao continua arrastando dezenas de MB")
    }
    const lixo = orfaos(Object.keys(todos), vivas)
    console.log(`universos: ${universos.length} | carreiras vivas: ${vivas.size} | orfaos: ${lixo.length}`)
    // ⚠️ A REGRA NOVA (1.0.346): so o universo da carreira ATIVA fica. Mais de um
    // em disco significa que a limpeza nao rodou — e foi assim que 45 carreiras
    // viraram um risco de ~1,9 GB.
    if (universos.length > 1) {
      erro(`${universos.length} universos em disco — com a regra da carreira ativa `
        + "deveria haver no maximo 1, entao a limpeza nao rodou")
    }
    if (lixo.length > 0) {
      erro(`${lixo.length} universo(s) de carreira inexistente ocupando disco: `
        + lixo.slice(0, 3).join(", "))
    }
  }
}

console.log(falhas === 0
  ? "\nESTADO OK — a limpeza preserva o que importa e nada esta inchando."
  : `\n${falhas} problema(s): o estado em disco pode voltar a travar o jogo.`)
process.exit(falhas === 0 ? 0 : 1)
