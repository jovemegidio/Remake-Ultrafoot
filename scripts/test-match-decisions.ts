// Decisões do técnico durante a partida.
//
// O lib/match-decisions.ts existia completo mas nunca foi ligado: a única
// alavanca ao vivo era a mentalidade. Estes testes garantem que a decisão
// realmente move o momentum (a grandeza que o motor usa para decidir quem cria
// chance) e que expira sozinha.
//
// Rodar: npx tsx scripts/test-match-decisions.ts

import { applyDecision, pruneExpired, suggestDecision } from "../lib/match-decisions"
import { createInitialState } from "../lib/match-engine"

let falhas = 0
function check(nome: string, cond: boolean, detalhe = "") {
  if (!cond) falhas++
  console.log(`${cond ? "  ok  " : " FALHA"} ${nome}${cond ? "" : ` — ${detalhe}`}`)
}

console.log("\nEfeito no momentum\n")

const base = createInitialState()
base.minute = 60

const pressionar = applyDecision(base, "pressionar")
check("pressionar aumenta o momentum", pressionar.state.momentum > base.momentum,
  `${base.momentum} -> ${pressionar.state.momentum}`)

const recuar = applyDecision(base, "recuar")
check("recuar reduz o momentum", recuar.state.momentum < base.momentum,
  `${base.momentum} -> ${recuar.state.momentum}`)

const tudo = applyDecision(base, "tudo_ou_nada")
check("tudo ou nada e a decisao mais agressiva",
  tudo.state.momentum > pressionar.state.momentum,
  `tudo=${tudo.state.momentum} pressionar=${pressionar.state.momentum}`)

check("momentum respeita o teto de 50", applyDecision({ ...base, momentum: 48 }, "tudo_ou_nada").state.momentum <= 50)
check("momentum respeita o piso de -50", applyDecision({ ...base, momentum: -48 }, "recuar").state.momentum >= -50)

console.log("\nDuração e expiração\n")

const aplicada = applyDecision(base, "pressionar").active
check("decisao registra o minuto em que foi tomada", aplicada.appliedAtMinute === 60)
check("decisao continua valendo dentro da duracao",
  pruneExpired([aplicada], 60 + aplicada.effect.durationMinutes - 1).length === 1)
check("decisao expira ao fim da duracao",
  pruneExpired([aplicada], 60 + aplicada.effect.durationMinutes).length === 0)

console.log("\nSugestão do auxiliar\n")

const perdendoNoFim = { ...base, minute: 85, home: { ...base.home, goals: 0 }, away: { ...base.away, goals: 1 } }
check("perdendo aos 85' sugere tudo ou nada", suggestDecision(perdendoNoFim) === "tudo_ou_nada",
  String(suggestDecision(perdendoNoFim)))

const ganhandoNoFim = { ...base, minute: 78, home: { ...base.home, goals: 2 }, away: { ...base.away, goals: 1 } }
check("ganhando aos 78' sugere segurar", suggestDecision(ganhandoNoFim) === "segurar_resultado",
  String(suggestDecision(ganhandoNoFim)))

const inicioTranquilo = { ...base, minute: 10 }
check("inicio de jogo equilibrado nao sugere nada", suggestDecision(inicioTranquilo) === null,
  String(suggestDecision(inicioTranquilo)))

console.log(`\n${falhas === 0 ? "TODOS OS TESTES PASSARAM" : `${falhas} FALHA(S)`}\n`)
process.exit(falhas === 0 ? 0 : 1)
