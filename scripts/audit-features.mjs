// Auditoria de features: existe? está LIGADO?
//
// Motivação: neste projeto vários sistemas estão implementados mas nunca são
// chamados por tela nenhuma (staff, injury-engine, match-decisions antes da
// 1.0.101). Procurar pelo nome do arquivo dá falso positivo; procurar pelo
// termo em português dá falso negativo quando o campo tem outro nome.
//
// Aqui cada feature declara ONDE o código dela deveria estar e QUEM deveria
// chamá-lo. Só conta como "ligada" quando as duas coisas batem.
//
// Rodar: node scripts/audit-features.mjs

import { readFileSync, readdirSync, statSync } from "node:fs"
import path from "node:path"

const root = process.cwd()

function walk(dir, acc = []) {
  for (const entry of readdirSync(dir)) {
    if (["node_modules", ".next", ".git", "out", "dist", "target"].includes(entry)) continue
    const full = path.join(dir, entry)
    let st
    try { st = statSync(full) } catch { continue }
    if (st.isDirectory()) walk(full, acc)
    else if (/\.(ts|tsx)$/.test(entry)) acc.push(full)
  }
  return acc
}

const files = [...walk(path.join(root, "lib")), ...walk(path.join(root, "app")), ...walk(path.join(root, "components")), ...walk(path.join(root, "hooks"))]
const contents = new Map(files.map(f => [path.relative(root, f).replace(/\\/g, "/"), readFileSync(f, "utf8")]))

/**
 * Um símbolo é USADO quando aparece fora do arquivo que o define.
 *
 * ⚠️ HEURÍSTICA FRACA — leia antes de confiar no resultado:
 *
 * 1. Falso NEGATIVO quando o símbolo é consumido dentro do próprio arquivo que
 *    o define (ex.: exceedsWageBudget é chamado por buyPlayer, ambos no
 *    game-engine.ts — o script diz "desligada" e está errado).
 * 2. Falso NEGATIVO quando a tela usa a feature por OUTRO nome. As telas de
 *    imprensa, vestiário e seleção acessam o engine inteiro via useGameEngine()
 *    e não citam o símbolo específico — todas apareceram como "desligadas" e
 *    todas funcionam.
 * 3. Falso POSITIVO quando outro arquivo apenas MENCIONA o nome (ex.: o
 *    staff-engine.ts morto contém "hireStaff" e foi apontado como o consumidor).
 *
 * Ou seja: este script serve para LEVANTAR SUSPEITAS, nunca para concluir.
 * Cada linha precisa ser verificada no código antes de virar afirmação.
 */
function usadoForaDe(simbolo, arquivoDono) {
  for (const [file, src] of contents) {
    if (file === arquivoDono) continue
    if (src.includes(simbolo)) return file
  }
  return null
}

const FEATURES = [
  // [nome, símbolo que prova a existência, arquivo dono, o que significaria estar ligado]
  ["Renovação de contrato", "renewContract", "lib/game-engine.ts", "tela chama renewContract"],
  ["Lista de transferíveis", "transferListedIds", "lib/game-engine.ts", "tela marca atleta à venda"],
  ["Rescisão de contrato", "terminateContract", "lib/game-engine.ts", "tela dispensa atleta"],
  ["Comissão técnica", "hireStaff", "lib/game-engine.ts", "tela contrata staff"],
  ["Decisões na partida", "applyCoachDecision", "hooks/use-match-simulation.ts", "partida ao vivo oferece decisões"],
  ["Teto salarial", "exceedsWageBudget", "lib/game-engine.ts", "contratação é barrada"],
  ["Foco de treino individual", "currentFocus", "lib/game-engine.ts", "tela de treino define atributo"],
  ["Olheiros", "scoutedLeads", "lib/game-engine.ts", "tela de olheiros lista relatórios"],
  ["Imprensa / entrevistas", "pressConferences", "lib/game-engine.ts", "tela de imprensa"],
  ["Diretoria / objetivos", "computeBoardConfidence", "lib/board-engine.ts", "confiança da diretoria muda"],
  ["Seleções", "nationalTeamCalls", "lib/game-engine.ts", "convocações acontecem"],
  ["Dívida do clube", "processDebtMonth", "lib/debt-engine.ts", "parcela é cobrada"],
  ["Patrocínio", "activeSponsors", "lib/save-system.ts", "receita mensal entra"],
  ["Sócio torcedor", "calculateFanRevenue", "lib/game-engine.ts", "receita de sócios entra"],
  ["Prêmios de temporada", "calcSeasonAwards", "lib/awards-engine.ts", "fim de temporada apura"],
  ["Economia do estádio", "calcMatchdayRevenue", "lib/stadium-economy.ts", "bilheteria credita no caixa"],
  ["Bola parada (batedores)", "setPieceTaker", "lib/tactics-engine.ts", "tática define cobradores"],
  ["Vestiário (eventos)", "detectEvents", "lib/dressing-room-engine.ts", "eventos aparecem ao jogador"],
  ["Hall da fama", "buildCareerStats", "lib/hall-of-fame-engine.ts", "carreira registra"],
  ["Entrevistas (engine)", "interviews", "lib/interviews-engine.ts", "perguntas chegam ao jogador"],
  ["Treino semanal (plano)", "defaultWeekPlan", "lib/training-engine.ts", "plano semanal aplicado"],
  ["Recuperação de lesão (engine)", "tickRecovery", "lib/injury-engine.ts", "recuperação usa o engine"],
]

console.log("\nFEATURE                          EXISTE  LIGADA  ONDE É USADA")
console.log("-".repeat(86))

const desligadas = []
for (const [nome, simbolo, dono, _oQueSignifica] of FEATURES) {
  const existe = contents.has(dono) && contents.get(dono).includes(simbolo)
  const usoEm = existe ? usadoForaDe(simbolo, dono) : null
  const ligada = Boolean(usoEm)
  if (existe && !ligada) desligadas.push(nome)
  console.log(
    `${nome.padEnd(32)} ${(existe ? "sim" : "NAO").padEnd(7)} ${(ligada ? "sim" : "NAO").padEnd(7)} ${usoEm ?? "-"}`,
  )
}

console.log("\n" + "=".repeat(86))
if (desligadas.length) {
  console.log(`SUSPEITAS DE DESLIGADAS (${desligadas.length}): ${desligadas.join(", ")}`)
  console.log("NAO sao conclusoes. Verifique CADA UMA no codigo antes de agir —")
  console.log("a heuristica erra nos tres casos documentados no topo do arquivo.")
} else {
  console.log("Nenhuma suspeita levantada.")
}
console.log("=".repeat(86) + "\n")
