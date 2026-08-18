import assert from "node:assert/strict"
import { serieATeams } from "../lib/teams-data"
import {
  createInitialState,
  resolvePendingVar,
  semearMotorDePartida,
  simulateFullMatch,
  startMatch,
  tickMinute,
  type MatchConfig,
  type MatchState,
} from "../lib/match-engine"

const config: MatchConfig = {
  homeTeam: serieATeams[0],
  awayTeam: serieATeams[1],
  homeRating: 74,
  awayRating: 72,
}

const revisaoDeGol: MatchState = {
  ...startMatch(createInitialState()),
  minute: 37,
  home: { ...createInitialState().home, goals: 1 },
  pendingVar: {
    incident: "goal",
    decision: "overturned",
    side: "home",
    minute: 37,
    originalEventId: "gol-qa",
    player: "Atacante QA",
    reason: "impedimento na origem da jogada",
    noMonitor: false,
  },
}

assert.strictEqual(tickMinute(revisaoDeGol, config), revisaoDeGol, "relogio andou durante a checagem")
const golAnulado = resolvePendingVar(revisaoDeGol)
assert.equal(golAnulado.home.goals, 0, "gol anulado continuou no placar")
assert.equal(golAnulado.pendingVar, null, "checagem nao foi encerrada")
assert.equal(golAnulado.events[0]?.varReview?.status, "decision", "decisao nao entrou na narracao")

const revisaoDePenalti: MatchState = {
  ...startMatch(createInitialState()),
  minute: 61,
  pendingVar: {
    incident: "penalty",
    decision: "confirmed",
    side: "away",
    minute: 61,
    originalEventId: "penalti-qa",
    noMonitor: true,
    reason: "infracao confirmada dentro da area",
  },
}
const penaltiConfirmado = resolvePendingVar(revisaoDePenalti)
assert.deepEqual(penaltiConfirmado.pendingPenalty, { side: "away", minute: 61 }, "penalti confirmado nao chegou a cobranca")

let checagens = 0
let decisoes = 0
// ⚠️ O RITO E O QUE O TORCEDOR RECONHECE (1.0.347): impedimento e FATO e a
// cabine resolve; falta, mao e penalti sao INTERPRETACAO e o arbitro vai ao
// monitor. Sem cobrar isto, a distincao volta a sumir e toda checagem vira a
// mesma tela.
let noMonitor = 0
let pelaCabine = 0
for (let seed = 1; seed <= 80; seed++) {
  semearMotorDePartida(seed)
  const partida = simulateFullMatch(config)
  assert.equal(partida.phase, "fulltime", `partida ${seed} travou no VAR`)
  assert.equal(partida.pendingVar, null, `partida ${seed} terminou com revisao pendente`)

  const varEvents = partida.events.filter(event => event.type === "var" && event.varReview)
  checagens += varEvents.filter(event => event.varReview?.status === "checking").length
  decisoes += varEvents.filter(event => event.varReview?.status === "decision").length

  for (const evento of varEvents) {
    const r = evento.varReview
    if (!r) continue
    if (r.noMonitor) noMonitor++
    else pelaCabine++
    // O protocolo: monitor SO quando o VAR derruba a decisao de campo, e nunca
    // por impedimento, que e fato e a cabine resolve.
    if (r.status === "decision" && r.decision === "confirmed") {
      assert.ok(!r.noMonitor, `checagem que confirmou mandou o arbitro ao monitor (semente ${seed})`)
    }
    if (r.incident === "goal" && r.reason.includes("impedimento")) {
      assert.ok(!r.noMonitor, `impedimento mandou o arbitro ao monitor (semente ${seed})`)
    }
  }

  for (const side of ["home", "away"] as const) {
    const golsNarrados = partida.events.filter(event => event.type === "goal" && event.side === side).length
    const anulados = varEvents.filter(event =>
      event.side === side
      && event.varReview?.status === "decision"
      && event.varReview.incident === "goal"
      && event.varReview.decision === "overturned",
    ).length
    assert.equal(partida[side].goals, golsNarrados - anulados, `placar ${side} divergiu da narracao na semente ${seed}`)
  }
}
semearMotorDePartida(null)

assert.ok(checagens > 0, "80 partidas nao produziram nenhuma checagem do VAR")
assert.equal(decisoes, checagens, "alguma checagem ficou sem decisao")
// ⚠️ O monitor tem de ser RARO: e disso que ele tira o peso. Se virar rotina, a
// revisao deixa de significar alguma coisa — foi o que a primeira versao fez,
// com 84% das checagens indo ao monitor.
const fatiaNoMonitor = noMonitor / (noMonitor + pelaCabine)
assert.ok(noMonitor > 0, "nenhuma revisao levou o arbitro ao monitor em 80 partidas")
assert.ok(fatiaNoMonitor < 0.3,
  `revisao em campo virou rotina: ${(fatiaNoMonitor * 100).toFixed(0)}% das checagens (teto 30%)`)
assert.ok(pelaCabine > 0, "nenhuma checagem foi resolvida pela cabine em 80 partidas")
console.log(`OK VAR 333: relogio congelado, placar corrigido e ${checagens} checagens com decisao em 80 partidas`)
console.log(`   rito: ${noMonitor} revisoes no monitor x ${pelaCabine} resolvidas pela cabine`)
