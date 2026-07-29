// Motor de copa eliminatória (Copa do Brasil).
// Single-leg knockout: 16 → 8 → 4 → 2 → 1 (4 rodadas eliminatórias).
// Pareamento 1: top 8 vs bottom 8 por prestígio para chaveamento mais real.

import type { Team } from "@/lib/teams-data"
import { simulateFullMatch } from "@/lib/match-engine"
import type { CupMatch, CupBracket } from "@/lib/career-types"
import { getPlayersForTeam } from "@/lib/players-data"

const CUP_TEAM_COUNT = 16
const CUP_TOTAL_ROUNDS = 4 // 1=oitavas, 2=quartas, 3=semi, 4=final

const CUP_ROUND_NAME: Record<number, string> = {
  1: "Oitavas de Final",
  2: "Quartas de Final",
  3: "Semifinal",
  4: "Final",
}

const LIBER_ROUND_NAME: Record<number, string> = {
  1: "Quartas de Final",
  2: "Semifinal",
  3: "Final",
}

export function cupRoundLabel(r: number, competition = "Copa do Brasil"): string {
  if (competition === "Libertadores") return LIBER_ROUND_NAME[r] ?? `Rodada ${r}`
  return CUP_ROUND_NAME[r] ?? `Rodada ${r}`
}

/** Todas as fases sao ida e volta; a FINAL e jogo unico. */
function isTwoLeggedRound(round: number): boolean {
  return round < CUP_TOTAL_ROUNDS
}

/**
 * Disputa usando o elenco real dos dois clubes.
 *
 * Devolve o resultado COMPLETO (com as cobranças). A versão anterior devolvia só
 * `[golsA, golsB]` e as cobranças eram descartadas ali mesmo — por isso não havia
 * como assistir à disputa de um confronto que não fosse o do usuário.
 */
function shootoutComElenco(a: Team, b: Team): ResultadoPenaltis {
  return disputarPenaltis(a.prestigio, b.prestigio, batedoresDoClube(a), batedoresDoClube(b))
}


/**
 * Os cinco batedores do clube, na ordem em que baterao.
 *
 * Ate 1.0.205 a disputa saia do PRESTIGIO do clube — quem estava em campo nao
 * importava. Aqui pegamos o elenco de verdade e ordenamos por finalizacao, que
 * e como um tecnico escala a fila: os melhores primeiro, porque as primeiras
 * cobrancas sao as que mais decidem.
 *
 * Goleiro fica de fora (ele bateria a quinta na vida real, mas so em caso
 * extremo — e aqui nunca chegamos a mais de 5 nomes distintos).
 */
function batedoresDoClube(time: Team): BatedorPenalti[] {
  try {
    return getPlayersForTeam(time)
      .filter(j => j.pos !== "GOL")
      .map(j => ({ nome: j.nome, finalizacao: j.shooting ?? j.base }))
      .sort((a, b) => b.finalizacao - a.finalizacao)
      .slice(0, 5)
  } catch {
    // Clube sem elenco carregado: cai no prestigio, como era antes.
    return []
  }
}

/** Uma cobrança da disputa, para a tela poder narrar chute a chute. */
export interface CobrancaPenalti {
  ordem: number
  lado: "A" | "B"
  batedor: string
  converteu: boolean
  /** true quando a cobrança já não podia mais alterar o resultado. */
  decisiva: boolean
}

export interface ResultadoPenaltis {
  golsA: number
  golsB: number
  cobrancas: CobrancaPenalti[]
}

/** Batedor: só precisamos do nome e da finalização. */
export interface BatedorPenalti {
  nome: string
  finalizacao: number
}

/**
 * Disputa de pênaltis.
 *
 * MUDANÇA em 1.0.206: antes isto era decidido só pelo PRESTÍGIO DOS CLUBES —
 * quem estava em campo não importava, e o momento mais tenso do futebol era o
 * único em que o elenco do jogador não participava. Agora, quando a lista de
 * batedores é informada, cada cobrança usa a finalização de QUEM BATE, na ordem
 * escolhida. Sem lista, cai no prestígio como antes (partidas entre times da
 * IA, onde não há elenco carregado).
 *
 * O pênalti continua sendo loteria de propósito: a diferença de qualidade entra
 * comprimida, como no resto do motor — um batedor excelente converte ~85%, um
 * ruim ~65%, e não 99% contra 30%.
 */
export function disputarPenaltis(
  prestigeA: number,
  prestigeB: number,
  batedoresA?: BatedorPenalti[],
  batedoresB?: BatedorPenalti[],
): ResultadoPenaltis {
  const edge = (prestigeA - prestigeB) * 0.002
  const cobrancas: CobrancaPenalti[] = []
  let a = 0
  let b = 0

  const chuta = (lado: "A" | "B", indice: number): void => {
    const lista = lado === "A" ? batedoresA : batedoresB
    const batedor = lista?.length ? lista[indice % lista.length] : undefined
    // Sem batedor conhecido: comportamento antigo (prestígio).
    const base = batedor
      ? 0.75 + Math.sign(batedor.finalizacao - 70) * Math.pow(Math.abs(batedor.finalizacao - 70), 0.5) * 0.013
      : 0.75 + (lado === "A" ? edge : -edge)
    const converteu = Math.random() < Math.max(0.55, Math.min(0.9, base))
    if (converteu) { if (lado === "A") a++; else b++ }
    cobrancas.push({
      ordem: cobrancas.length + 1,
      lado,
      batedor: batedor?.nome ?? (lado === "A" ? "Batedor" : "Batedor"),
      converteu,
      decisiva: false,
    })
  }

  for (let i = 0; i < 5; i++) { chuta("A", i); chuta("B", i) }
  // Morte súbita até desempatar. O teto de 20 não é regra de futebol: é trava.
  // Se algum dia a conversão virar determinística (dois batedores de finalização
  // idêntica com um sorteio viciado), este laço não termina — e travar o jogo no
  // mata-mata é muito pior que uma disputa longa demais.
  let extra = 5
  while (a === b && extra < 20) { chuta("A", extra); chuta("B", extra); extra++ }
  if (a === b) a++  // desempate forçado no limite; não deve ocorrer em jogo real

  if (cobrancas.length) cobrancas[cobrancas.length - 1].decisiva = true
  return { golsA: a, golsB: b, cobrancas }
}

/** Embaralha um array preservando ordem reprodutível via seed. */
function shuffleSeeded<T>(arr: T[], seed: number): T[] {
  const a = [...arr]
  let s = seed >>> 0
  for (let i = a.length - 1; i > 0; i--) {
    s = (s * 1664525 + 1013904223) >>> 0
    const j = s % (i + 1)
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/**
 * Gera chaveamento inicial das oitavas com 16 times.
 * Usa os 16 times de maior prestígio dentre `leagueTeams`,
 * complementando com mais times se houver disponíveis.
 */
export function generateCupBracket(
  leagueTeams: Team[],
  userTeamCurto: string,
  season: number,
  competition = "Copa do Brasil",
): CupBracket {
  // Garante usuário no chaveamento
  const sorted = [...leagueTeams].sort((a, b) => b.prestigio - a.prestigio)
  let pool = sorted.slice(0, CUP_TEAM_COUNT)
  if (!pool.some(t => t.curto === userTeamCurto)) {
    const user = leagueTeams.find(t => t.curto === userTeamCurto)
    if (user) {
      pool = [user, ...pool.slice(0, CUP_TEAM_COUNT - 1)]
    }
  }

  // Embaralha e cria 8 confrontos das oitavas (1v16, 2v15, ...) — após shuffle não é seed real, é amistoso
  const shuffled = shuffleSeeded(pool, season * 7919 + 17)
  const matches: CupMatch[] = []
  for (let i = 0; i < 8; i++) {
    const home = shuffled[i]
    const away = shuffled[15 - i]
    matches.push({
      id: `cup_${season}_r1_${i}`,
      cupRound: 1,
      bracketSlot: i,
      homeCurto: home.curto,
      awayCurto: away.curto,
      homeNome: home.nome,
      awayNome: away.nome,
      played: false,
      isUserMatch: home.curto === userTeamCurto || away.curto === userTeamCurto,
    })
  }

  return {
    competition,
    season,
    matches,
    currentCupRound: 1,
  }
}

/**
 * Simula a rodada eliminatória atual da copa.
 * Atualiza partidas, gera próxima rodada se houver, define campeão na final.
 */
export function simulateCupRound(
  bracket: CupBracket,
  userTeamCurto: string,
  leagueTeams: Team[],
): CupBracket {
  const round = bracket.currentCupRound
  if (round < 1 || round > CUP_TOTAL_ROUNDS) return bracket

  const teamMap = new Map(leagueTeams.map(t => [t.curto, t]))
  const roundMatches = bracket.matches.filter(m => m.cupRound === round && !m.played)
  const updated = bracket.matches.map(m => ({ ...m }))
  let userEliminatedAtRound = bracket.userEliminatedAtRound

  for (const m of roundMatches) {
    const home = teamMap.get(m.homeCurto)
    const away = teamMap.get(m.awayCurto)
    if (!home || !away) continue

    const playLeg = (h: Team, a: Team) => {
      const sim = simulateFullMatch({
        homeTeam: h, awayTeam: a,
        homeRating: h.prestigio, awayRating: a.prestigio,
        durationMinutes: 90,
      })
      return { homeGoals: sim.home.goals, awayGoals: sim.away.goals }
    }

    // IDA na casa do mandante do confronto.
    const leg1 = playLeg(home, away)

    // VOLTA na casa do visitante — so nas fases de ida e volta (a FINAL e jogo unico).
    const twoLegged = isTwoLeggedRound(round)
    const leg2 = twoLegged ? playLeg(away, home) : null

    // Agregado na perspectiva [mandante do confronto, visitante do confronto].
    const aggHome = leg1.homeGoals + (leg2 ? leg2.awayGoals : 0)
    const aggAway = leg1.awayGoals + (leg2 ? leg2.homeGoals : 0)

    // Empate no agregado -> PENALTIS. Sem gol qualificado fora de casa (regra abolida).
    // Antes o desempate era cara-ou-coroa somando um gol fantasma no placar.
    let penaltiesHome: number | undefined
    let penaltiesAway: number | undefined
    let winnerCurto: string

    if (aggHome > aggAway) {
      winnerCurto = m.homeCurto
    } else if (aggAway > aggHome) {
      winnerCurto = m.awayCurto
    } else {
      const pen = shootoutComElenco(home, away)
      const [ph, pa] = [pen.golsA, pen.golsB]
      penaltiesHome = ph
      penaltiesAway = pa
      winnerCurto = ph > pa ? m.homeCurto : m.awayCurto
    }

    const idx = updated.findIndex(x => x.id === m.id)
    if (idx >= 0) {
      updated[idx] = {
        ...updated[idx],
        played: true,
        homeGoals: leg1.homeGoals,
        awayGoals: leg1.awayGoals,
        leg2HomeGoals: leg2?.homeGoals,
        leg2AwayGoals: leg2?.awayGoals,
        twoLegged,
        aggHome,
        aggAway,
        penaltiesHome,
        penaltiesAway,
        winnerCurto,
      }
    }

    // Usuario eliminado nesta fase?
    if (m.isUserMatch && winnerCurto !== userTeamCurto && userEliminatedAtRound === undefined) {
      userEliminatedAtRound = round
    }
  }

  // Avança vencedores para próxima rodada
  const nextRound = round + 1
  let champion = bracket.champion
  if (nextRound <= CUP_TOTAL_ROUNDS) {
    const winnersOfRound: { curto: string; nome: string }[] = []
    const playedThisRound = updated.filter(m => m.cupRound === round && m.played)
      .sort((a, b) => a.bracketSlot - b.bracketSlot)
    for (const m of playedThisRound) {
      // Classificado vem do AGREGADO (ou dos penaltis) — nao do placar da ida.
      const homeWon = m.winnerCurto
        ? m.winnerCurto === m.homeCurto
        : (m.homeGoals ?? 0) > (m.awayGoals ?? 0)
      winnersOfRound.push(homeWon
        ? { curto: m.homeCurto, nome: m.homeNome }
        : { curto: m.awayCurto, nome: m.awayNome })
    }
    // Pareia consecutivos: 0v1, 2v3, 4v5, 6v7
    for (let i = 0; i < winnersOfRound.length; i += 2) {
      const a = winnersOfRound[i]
      const b = winnersOfRound[i + 1]
      if (!a || !b) continue
      updated.push({
        id: `cup_${bracket.season}_r${nextRound}_${i / 2}`,
        cupRound: nextRound,
        bracketSlot: i / 2,
        homeCurto: a.curto,
        awayCurto: b.curto,
        homeNome: a.nome,
        awayNome: b.nome,
        played: false,
        isUserMatch: a.curto === userTeamCurto || b.curto === userTeamCurto,
      })
    }
  } else {
    // Final encerrada: define campeão
    const finalMatch = updated.find(m => m.cupRound === CUP_TOTAL_ROUNDS && m.played)
    if (finalMatch) {
      const homeWon = finalMatch.winnerCurto
        ? finalMatch.winnerCurto === finalMatch.homeCurto
        : (finalMatch.homeGoals ?? 0) > (finalMatch.awayGoals ?? 0)
      champion = homeWon ? finalMatch.homeNome : finalMatch.awayNome
    }
  }

  return {
    ...bracket,
    matches: updated,
    currentCupRound: nextRound > CUP_TOTAL_ROUNDS ? CUP_TOTAL_ROUNDS : nextRound,
    champion,
    userEliminatedAtRound,
  }
}

/**
 * Resolve UM confronto de mata-mata a partir dos "curto" dos times.
 * Exposto para a tela de Competicoes, que mantem seu proprio formato de chaveamento
 * mas precisa do resultado REAL (forca dos clubes + ida/volta + agregado + penaltis)
 * em vez do mock que usava simulateMatch(50, 50) e cara-ou-coroa.
 */
export interface TieOutcome {
  leg1Home: number
  leg1Away: number
  leg2Home: number | null   // gols do visitante do confronto jogando em casa
  leg2Away: number | null
  aggHome: number
  aggAway: number
  penalties: [number, number] | null
  /**
   * Cobrança por cobrança da disputa, quando houve pênaltis.
   *
   * O placar agregado 4-3 já existia, mas as cobranças eram CALCULADAS e
   * jogadas fora — dava para saber quem passou, nunca quem errou. É este dado
   * que permite ASSISTIR a disputa de um jogo que não é o seu.
   */
  cobrancas: CobrancaPenalti[] | null
  winnerCurto: string
}

export function resolveTieByCurto(
  homeCurto: string,
  awayCurto: string,
  teams: Team[],
  twoLegged: boolean,
): TieOutcome | null {
  const home = teams.find(t => t.curto === homeCurto)
  const away = teams.find(t => t.curto === awayCurto)
  if (!home || !away) return null

  const playLeg = (h: Team, a: Team) => {
    const sim = simulateFullMatch({
      homeTeam: h, awayTeam: a,
      homeRating: h.prestigio, awayRating: a.prestigio,
      durationMinutes: 90,
    })
    return { homeGoals: sim.home.goals, awayGoals: sim.away.goals }
  }

  const leg1 = playLeg(home, away)
  const leg2 = twoLegged ? playLeg(away, home) : null

  const aggHome = leg1.homeGoals + (leg2 ? leg2.awayGoals : 0)
  const aggAway = leg1.awayGoals + (leg2 ? leg2.homeGoals : 0)

  let penalties: [number, number] | null = null
  let cobrancas: CobrancaPenalti[] | null = null
  let winnerCurto: string
  if (aggHome > aggAway) winnerCurto = homeCurto
  else if (aggAway > aggHome) winnerCurto = awayCurto
  else {
    const disputa = shootoutComElenco(home, away)
    penalties = [disputa.golsA, disputa.golsB]
    cobrancas = disputa.cobrancas
    winnerCurto = penalties[0] > penalties[1] ? homeCurto : awayCurto
  }

  return {
    leg1Home: leg1.homeGoals,
    leg1Away: leg1.awayGoals,
    leg2Home: leg2?.homeGoals ?? null,
    leg2Away: leg2?.awayGoals ?? null,
    aggHome,
    aggAway,
    penalties,
    cobrancas,
    winnerCurto,
  }
}

/** Rodadas em que a Copa do Brasil avança (entre as 38 rodadas da liga). */
export const CUP_TRIGGER_ROUNDS = [6, 14, 22, 30] as const

/** Rodadas em que a Libertadores avança (intercaladas com a Copa). */
export const LIBER_TRIGGER_ROUNDS = [10, 18, 26] as const

export function isCupTriggerRound(leagueRound: number): boolean {
  return (CUP_TRIGGER_ROUNDS as readonly number[]).includes(leagueRound)
}

export function isLiberTriggerRound(leagueRound: number): boolean {
  return (LIBER_TRIGGER_ROUNDS as readonly number[]).includes(leagueRound)
}

// ─── Libertadores: 8 times, 3 rodadas (quartas → semi → final) ────────────────

const LIBER_TEAM_COUNT = 8
const LIBER_TOTAL_ROUNDS = 3

/**
 * Gera chaveamento Libertadores com 8 times. Usa os top-8 por prestígio
 * e GARANTE que o usuário entra (mesmo se prestígio menor).
 * Em cenário real, classificacao da Libertadores depende do G4 do ano anterior;
 * para MVP, pegamos os 8 mais prestigiados disponiveis.
 */
export function generateLiberBracket(
  leagueTeams: Team[],
  userTeamCurto: string,
  season: number,
): CupBracket {
  const sorted = [...leagueTeams].sort((a, b) => b.prestigio - a.prestigio)
  let pool = sorted.slice(0, LIBER_TEAM_COUNT)
  if (!pool.some(t => t.curto === userTeamCurto)) {
    const user = leagueTeams.find(t => t.curto === userTeamCurto)
    if (user) pool = [user, ...pool.slice(0, LIBER_TEAM_COUNT - 1)]
  }

  const shuffled = shuffleSeeded(pool, season * 4523 + 31)
  const matches: CupMatch[] = []
  for (let i = 0; i < 4; i++) {
    const home = shuffled[i]
    const away = shuffled[7 - i]
    matches.push({
      id: `liber_${season}_r1_${i}`,
      cupRound: 1,
      bracketSlot: i,
      homeCurto: home.curto,
      awayCurto: away.curto,
      homeNome: home.nome,
      awayNome: away.nome,
      played: false,
      isUserMatch: home.curto === userTeamCurto || away.curto === userTeamCurto,
    })
  }

  return {
    competition: "Libertadores",
    season,
    matches,
    currentCupRound: 1,
  }
}

/** Simula a rodada eliminatória atual da Libertadores. */
export function simulateLiberRound(
  bracket: CupBracket,
  userTeamCurto: string,
  leagueTeams: Team[],
): CupBracket {
  const round = bracket.currentCupRound
  if (round < 1 || round > LIBER_TOTAL_ROUNDS) return bracket

  const teamMap = new Map(leagueTeams.map(t => [t.curto, t]))
  const roundMatches = bracket.matches.filter(m => m.cupRound === round && !m.played)
  const updated = bracket.matches.map(m => ({ ...m }))
  let userEliminatedAtRound = bracket.userEliminatedAtRound

  for (const m of roundMatches) {
    const home = teamMap.get(m.homeCurto)
    const away = teamMap.get(m.awayCurto)
    if (!home || !away) continue

    const playLeg = (h: Team, a: Team) => {
      const sim = simulateFullMatch({
        homeTeam: h, awayTeam: a,
        homeRating: h.prestigio, awayRating: a.prestigio,
        durationMinutes: 90,
      })
      return { homeGoals: sim.home.goals, awayGoals: sim.away.goals }
    }

    // Libertadores: quartas e semis em ida e volta; FINAL em jogo unico (como na real).
    const twoLegged = round < LIBER_TOTAL_ROUNDS
    const leg1 = playLeg(home, away)
    const leg2 = twoLegged ? playLeg(away, home) : null

    const aggHome = leg1.homeGoals + (leg2 ? leg2.awayGoals : 0)
    const aggAway = leg1.awayGoals + (leg2 ? leg2.homeGoals : 0)

    let penaltiesHome: number | undefined
    let penaltiesAway: number | undefined
    let winnerCurto: string
    if (aggHome > aggAway) winnerCurto = m.homeCurto
    else if (aggAway > aggHome) winnerCurto = m.awayCurto
    else {
      const pen = shootoutComElenco(home, away)
      const [ph, pa] = [pen.golsA, pen.golsB]
      penaltiesHome = ph
      penaltiesAway = pa
      winnerCurto = ph > pa ? m.homeCurto : m.awayCurto
    }

    const homeGoals = leg1.homeGoals
    const awayGoals = leg1.awayGoals

    const idx = updated.findIndex(x => x.id === m.id)
    if (idx >= 0) updated[idx] = {
      ...updated[idx],
      played: true,
      homeGoals, awayGoals,
      leg2HomeGoals: leg2?.homeGoals,
      leg2AwayGoals: leg2?.awayGoals,
      twoLegged, aggHome, aggAway,
      penaltiesHome, penaltiesAway, winnerCurto,
    }

    // Eliminado = nao foi o classificado. Comparar so o agregado deixava passar a
    // derrota nos PENALTIS (agregado empatado nao e "menor").
    if (m.isUserMatch && winnerCurto !== userTeamCurto && userEliminatedAtRound === undefined) {
      userEliminatedAtRound = round
    }
  }

  const nextRound = round + 1
  let champion = bracket.champion
  if (nextRound <= LIBER_TOTAL_ROUNDS) {
    const winners: { curto: string; nome: string }[] = []
    const playedThisRound = updated.filter(m => m.cupRound === round && m.played)
      .sort((a, b) => a.bracketSlot - b.bracketSlot)
    for (const m of playedThisRound) {
      const homeWon = m.winnerCurto
        ? m.winnerCurto === m.homeCurto
        : (m.homeGoals ?? 0) > (m.awayGoals ?? 0)
      winners.push(homeWon
        ? { curto: m.homeCurto, nome: m.homeNome }
        : { curto: m.awayCurto, nome: m.awayNome })
    }
    for (let i = 0; i < winners.length; i += 2) {
      const a = winners[i]
      const b = winners[i + 1]
      if (!a || !b) continue
      updated.push({
        id: `liber_${bracket.season}_r${nextRound}_${i / 2}`,
        cupRound: nextRound,
        bracketSlot: i / 2,
        homeCurto: a.curto,
        awayCurto: b.curto,
        homeNome: a.nome,
        awayNome: b.nome,
        played: false,
        isUserMatch: a.curto === userTeamCurto || b.curto === userTeamCurto,
      })
    }
  } else {
    const finalMatch = updated.find(m => m.cupRound === LIBER_TOTAL_ROUNDS && m.played)
    if (finalMatch) {
      const homeWon = finalMatch.winnerCurto
        ? finalMatch.winnerCurto === finalMatch.homeCurto
        : (finalMatch.homeGoals ?? 0) > (finalMatch.awayGoals ?? 0)
      champion = homeWon ? finalMatch.homeNome : finalMatch.awayNome
    }
  }

  return {
    ...bracket,
    matches: updated,
    currentCupRound: nextRound > LIBER_TOTAL_ROUNDS ? LIBER_TOTAL_ROUNDS : nextRound,
    champion,
    userEliminatedAtRound,
  }
}
