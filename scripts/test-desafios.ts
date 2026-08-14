// MODO DESAFIOS — regra injetada, avaliação e recompensa.
//
// ⚠️ POR QUE ESTE TESTE EXISTE. Até a 1.0.302 o `challenge-engine` era um
// esqueleto que ninguém chamava: `evaluateChallenge` e `claimReward` não tinham
// um único chamador em todo o projeto, e `startChallenge` não injetava regra
// nenhuma. O modo parecia existir e não fazia nada. Este teste falha se
// qualquer uma das três voltar a ser decorativa.
//
// Rodar: npx tsx scripts/test-desafios.ts

import {
  CHALLENGES,
  acharDesafio,
  claimReward,
  contarReforcos,
  evaluateChallenge,
  podeReforcar,
  sincronizarDesafioAtivo,
  startChallenge,
  temporadaDeInicio,
  type ChallengeProgress,
} from "../lib/challenge-engine"
import type { GameState } from "../lib/save-system"
import type { SeasonRecord, TransferRecord } from "../lib/career-types"

let falhas = 0
function check(nome: string, atual: unknown, esperado: unknown) {
  const ok = JSON.stringify(atual) === JSON.stringify(esperado)
  if (!ok) falhas++
  console.log(`${ok ? "  ok  " : " FALHA"} ${nome}${ok ? "" : ` — esperado ${JSON.stringify(esperado)}, veio ${JSON.stringify(atual)}`}`)
}

const estadoBase = (extra: Partial<GameState> = {}): GameState => ({
  season: 2026,
  week: 1,
  balance: 50_000_000,
  selectedTeamShort: "FLA",
  transfers: [],
  ...extra,
} as unknown as GameState)

const reforco = (season: number, type: TransferRecord["type"] = "buy"): TransferRecord => ({
  id: `t${Math.random()}`, playerName: "Fulano", fromTeam: "", toTeam: "FLA",
  value: 1, type, week: 1, season,
})

const registro = (extra: Partial<SeasonRecord> = {}): SeasonRecord => ({
  season: 2026, competition: "Serie A", position: 10, points: 40,
  won: 10, drawn: 10, lost: 18, goalsFor: 30, goalsAgainst: 40,
  champion: "PAL", managerName: "Tecnico", promoted: false, relegated: false,
  teamCurto: "FLA", teamNome: "Flamengo",
  ...extra,
} as SeasonRecord)

console.log("\n1. CATÁLOGO\n")
check("os oito cenários continuam existindo", CHALLENGES.length, 8)
check("todo desafio tem ao menos uma meta", CHALLENGES.every(c => c.goals.length > 0), true)
check("toda meta nasce por cumprir", CHALLENGES.every(c => c.goals.every(g => !g.completed)), true)
check("todo desafio tem prazo", CHALLENGES.every(c => c.durationSeasons >= 1), true)

console.log("\n2. FISCALIZAÇÃO DO MERCADO (a regra que não existia)\n")

// Sem desafio ativo o jogo normal não muda em nada.
sincronizarDesafioAtivo(estadoBase({ activeChallenge: undefined }))
check("sem desafio ativo, contratar é livre", podeReforcar({ idade: 34 }).pode, true)

// "Copa sem reforços": zero contratações, nem por empréstimo.
const semReforcos = startChallenge("cup_no_signings", estadoBase(), 50_000_000)
sincronizarDesafioAtivo(semReforcos.estado)
check("proibido contratar", podeReforcar({ idade: 22 }).pode, false)
check("proibido também por empréstimo", podeReforcar({ idade: 22, emprestimo: true }).pode, false)
check("a recusa explica o motivo", typeof podeReforcar({ idade: 22 }).motivo, "string")

// "Geração futura": teto de idade.
const sub23 = startChallenge("u23_only", estadoBase(), 50_000_000)
sincronizarDesafioAtivo(sub23.estado)
check("garoto de 21 passa", podeReforcar({ idade: 21 }).pode, true)
check("veterano de 30 é barrado", podeReforcar({ idade: 30 }).pode, false)
check("exatamente no teto (23) passa", podeReforcar({ idade: 23 }).pode, true)

// "Zebra estadual": 2 reforços por temporada e só sem clube.
const zebra = startChallenge("small_state", estadoBase(), 50_000_000)
sincronizarDesafioAtivo(zebra.estado)
check("atleta com clube é barrado", podeReforcar({ idade: 25, semClube: false }).pode, false)
check("atleta sem clube passa", podeReforcar({ idade: 25, semClube: true }).pode, true)
// Com dois reforços já feitos NA TEMPORADA, o teto fecha.
sincronizarDesafioAtivo(estadoBase({
  activeChallenge: zebra.estado.activeChallenge,
  transfers: [reforco(2026), reforco(2026, "loan")],
}))
check("teto de 2 reforços fecha o mercado", podeReforcar({ idade: 25, semClube: true }).pode, false)
// Reforço de OUTRA temporada não conta contra o teto do ano corrente.
sincronizarDesafioAtivo(estadoBase({
  activeChallenge: zebra.estado.activeChallenge,
  transfers: [reforco(2025), reforco(2025)],
}))
check("reforço de temporada passada não conta", podeReforcar({ idade: 25, semClube: true }).pode, true)
check("venda não conta como reforço", contarReforcos([reforco(2026, "sell")], 2026), 0)
check("empréstimo conta como reforço", contarReforcos([reforco(2026, "loan")], 2026), 1)

// Desafio encerrado solta o mercado.
sincronizarDesafioAtivo(estadoBase({
  activeChallenge: { ...zebra.estado.activeChallenge!, completed: true },
}))
check("desafio concluído deixa de restringir", podeReforcar({ idade: 33 }).pode, true)

console.log("\n3. SETUP INJETADO\n")
// "Contas em dia" corta o caixa; e o corte sai como ALVO, para o motor aplicar —
// gravar no save não mudaria o dinheiro que as telas mostram.
const contas = startChallenge("cut_payroll", estadoBase(), 80_000_000)
check("caixa é limitado pelo teto do desafio", contas.caixaAlvo, 5_000_000)
check("caixa abaixo do teto não é inflado", startChallenge("cut_payroll", estadoBase(), 1_000_000, ).caixaAlvo, 1_000_000)
check("desafio sem regra de caixa não mexe no caixa", startChallenge("promote_division", estadoBase(), 9).caixaAlvo, undefined)
check("moral inicial cai no desafio de permanência",
  startChallenge("save_relegation", estadoBase(), 9).estado.teamMorale, 45)
check("prazo começa no ano corrente na semana 1", temporadaDeInicio(2026, 1), 2026)
check("aceitar tarde empurra para a temporada seguinte", temporadaDeInicio(2026, 30), 2027)

console.log("\n4. AVALIAÇÃO NO FIM DA TEMPORADA\n")

const progressoDe = (id: Parameters<typeof acharDesafio>[0], extra: Partial<ChallengeProgress> = {}): ChallengeProgress => ({
  challengeId: id,
  startedAt: 0,
  startSeason: 2026,
  currentSeason: 2026,
  goals: acharDesafio(id)!.goals.map(g => ({ ...g })),
  failed: false,
  completed: false,
  rewardClaimed: false,
  ...extra,
})

const ctx = (extra: Partial<Parameters<typeof evaluateChallenge>[1]> = {}) => ({
  season: 2026,
  registrosDaTemporada: [registro()],
  transfers: [] as TransferRecord[],
  idadesDoElenco: [] as number[],
  saldo: 1,
  ...extra,
})

// Acesso conquistado -> meta cumprida.
check("acesso cumpre a meta de promoção",
  evaluateChallenge(progressoDe("promote_division"), ctx({ registrosDaTemporada: [registro({ promoted: true })] })).completed,
  true)
check("sem acesso a meta segue aberta",
  evaluateChallenge(progressoDe("promote_division"), ctx()).completed, false)

// Prazo: duração 2 temporadas a partir de 2026 -> falha só no fim de 2027.
check("não falha antes do prazo",
  evaluateChallenge(progressoDe("promote_division"), ctx({ season: 2026 })).failed, false)
check("falha quando o prazo termina",
  evaluateChallenge(progressoDe("promote_division"), ctx({ season: 2027 })).failed, true)

// Rebaixamento: a meta é terminar acima da zona E não cair.
check("16º sem rebaixamento cumpre a permanência",
  evaluateChallenge(progressoDe("save_relegation"), ctx({ registrosDaTemporada: [registro({ position: 16 })] })).completed,
  true)
check("rebaixado não cumpre a permanência",
  evaluateChallenge(progressoDe("save_relegation"), ctx({ registrosDaTemporada: [registro({ position: 16, relegated: true })] })).completed,
  false)

// "Copa sem reforços": título + zero contratações. Contratar DESCUMPRE de volta.
const comTitulo = ctx({ registrosDaTemporada: [registro({ position: 1, competition: "Copa do Brasil" })] })
check("título sem contratar conclui o desafio",
  evaluateChallenge(progressoDe("cup_no_signings"), comTitulo).completed, true)
check("título tendo contratado NÃO conclui",
  evaluateChallenge(progressoDe("cup_no_signings"), { ...comTitulo, transfers: [reforco(2026)] }).completed, false)

// Sub-23 conta o elenco vindo do MOTOR (não o espelho do save).
const elencoJovem = Array.from({ length: 13 }, () => 21)
check("elenco jovem cumpre a meta de sub-23",
  evaluateChallenge(progressoDe("u23_only"), ctx({
    idadesDoElenco: elencoJovem,
    registrosDaTemporada: [registro({ position: 5 })],
  })).completed,
  true)
check("elenco veterano não cumpre",
  evaluateChallenge(progressoDe("u23_only"), ctx({
    idadesDoElenco: Array.from({ length: 13 }, () => 29),
    registrosDaTemporada: [registro({ position: 5 })],
  })).completed,
  false)

// Desafio aceito no meio do ano não é cobrado pela temporada que já corria.
check("temporada anterior ao início é ignorada",
  evaluateChallenge(progressoDe("promote_division", { startSeason: 2027 }), ctx({ season: 2026 })).failed,
  false)

console.log("\n5. RECOMPENSA\n")
const concluido = evaluateChallenge(progressoDe("cup_no_signings"), comTitulo)
const premio = claimReward(concluido, { coachXP: 100, selectedTeam: null, desafiosConcluidos: [] } as unknown as GameState)
check("desafio concluído paga o prêmio", premio !== null, true)
check("o prêmio em caixa é o do catálogo", premio?.premioEmCaixa, acharDesafio("cup_no_signings")!.reward.saldo)
check("o XP do técnico sobe", premio?.patch.coachXP, 100 + acharDesafio("cup_no_signings")!.reward.xp)
check("o desafio entra na lista de concluídos", premio?.patch.desafiosConcluidos?.length, 1)
check("o prêmio é marcado como pago", premio?.patch.activeChallenge?.rewardClaimed, true)
check("pagar de novo não acontece",
  claimReward(premio!.patch.activeChallenge!, { coachXP: 0, selectedTeam: null, desafiosConcluidos: [] } as unknown as GameState),
  null)
check("desafio não concluído não paga",
  claimReward(progressoDe("cup_no_signings"), { coachXP: 0, selectedTeam: null, desafiosConcluidos: [] } as unknown as GameState),
  null)

console.log(`\n${falhas === 0 ? "TODOS OS TESTES PASSARAM" : `${falhas} FALHA(S)`}\n`)
process.exit(falhas === 0 ? 0 : 1)
