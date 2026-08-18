// VAR real no motor: checagem pendente congela o lance e a decisão altera o jogo.
import { createInitialState, resolvePendingVar, type PendingVarReview } from "../lib/match-engine"

let falhas = 0
const ck = (nome: string, ok: boolean) => {
  console.log(`${ok ? "ok" : "FALHOU"}  ${nome}`)
  if (!ok) falhas++
}

function revisao(overrides: Partial<PendingVarReview>): PendingVarReview {
  return {
    incident: "goal",
    decision: "overturned",
    side: "home",
    minute: 63,
    originalEventId: "gol-1",
    player: "Atacante",
    reason: "impedimento na origem da jogada",
    // Impedimento e FATO: a cabine resolve e o arbitro nao vai ao monitor.
    noMonitor: false,
    ...overrides,
  }
}

{
  const state = createInitialState()
  state.phase = "second"
  state.home.goals = 2
  state.pendingVar = revisao({})
  const next = resolvePendingVar(state)
  ck("gol anulado sai do placar", next.home.goals === 1)
  ck("decisão fica estruturada na súmula", next.events[0]?.varReview?.decision === "overturned")
  ck("revisão deixa de ficar pendente", next.pendingVar === null)
}

{
  const state = createInitialState()
  state.phase = "first"
  state.pendingVar = revisao({ incident: "penalty", decision: "confirmed", side: "away", minute: 28 })
  const next = resolvePendingVar(state)
  ck("pênalti confirmado libera a cobrança", next.pendingPenalty?.side === "away")
  ck("placar não muda antes da cobrança", next.away.goals === 0)
}

{
  const state = createInitialState()
  state.phase = "first"
  state.pendingVar = revisao({ incident: "penalty", decision: "overturned", minute: 11 })
  const next = resolvePendingVar(state)
  ck("pênalti anulado não abre cobrança", next.pendingPenalty === null)
  ck("texto informa pênalti anulado", /pênalti anulado/i.test(next.events[0]?.text ?? ""))
}

console.log(falhas === 0 ? "\nVAR OK" : `\n${falhas} falha(s)`)
process.exit(falhas === 0 ? 0 : 1)
