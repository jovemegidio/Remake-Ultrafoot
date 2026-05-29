// Hook que gerencia as propostas de selecao, a aceitacao e as competicoes
// internacionais de selecao (Copa America, Eurocopa, Liga das Nacoes,
// Eliminatorias e Copa do Mundo). Tudo persistido no save offline.

"use client"

import { useCallback, useEffect, useMemo, useRef } from "react"
import { useGameState, type NationalOffer, DEFAULT_NATIONAL_CAREER } from "@/lib/save-system"
import {
  NATIONAL_TEAMS,
  getNationalTeamById,
  getAllNationalStrengths,
  type NationalTeam,
} from "@/lib/national-teams"
import {
  getCompetitionsForConfederation,
  getCompetitionDef,
  createNationalCompetition,
  advanceNationalRound,
  getUserNextFixture,
  type NationalCompetitionDef,
} from "@/lib/national-competitions"

const MIN_SCORE_FOR_OFFERS = 2
const MAX_OFFERS = 3

// Pontuacao de reputacao do treinador (titulos + nivel de reputacao + XP)
export function computeCoachScore(state: {
  coachTotalTitles?: number
  coachXP?: number
  coachLegacy?: { totalTitles?: number; reputationLevel?: number; legacyXP?: number }
}): number {
  const titles = (state.coachTotalTitles ?? 0) + (state.coachLegacy?.totalTitles ?? 0)
  const rep = state.coachLegacy?.reputationLevel ?? 0
  const xp = (state.coachXP ?? 0) + (state.coachLegacy?.legacyXP ?? 0)
  return titles * 3 + rep * 3 + Math.floor(xp / 250)
}

function makeRng(seedStr: string): () => number {
  let h = 1779033703 ^ seedStr.length
  for (let i = 0; i < seedStr.length; i++) {
    h = Math.imul(h ^ seedStr.charCodeAt(i), 3432918353)
    h = (h << 13) | (h >>> 19)
  }
  let state = h >>> 0
  return () => {
    state = Math.imul(state ^ (state >>> 15), state | 1) >>> 0
    let t = (state + 0x6d2b79f5) >>> 0
    t = Math.imul(t ^ (t >>> 7), t | 61)
    t ^= t + Math.imul(t ^ (t >>> 14), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// Gera propostas com base na reputacao: quanto maior o score, mais fortes as selecoes.
function buildOffers(score: number, declined: string[], season: number, seed: string): NationalOffer[] {
  const strengths = getAllNationalStrengths()
  const desiredMax = Math.min(95, 62 + score * 2)
  let desiredMin = desiredMax - 18

  const eligible = (min: number) =>
    NATIONAL_TEAMS.filter(nt => {
      if (declined.includes(nt.id)) return false
      const s = strengths[nt.id] ?? 60
      return s <= desiredMax + 2 && s >= min
    })

  let candidates = eligible(desiredMin)
  // Relaxa o piso ate ter candidatos suficientes
  while (candidates.length < 1 && desiredMin > 40) {
    desiredMin -= 8
    candidates = eligible(desiredMin)
  }
  if (candidates.length === 0) return []

  const rng = makeRng(seed)
  // embaralha priorizando variedade de confederacoes
  const shuffled = [...candidates]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  const chosen: NationalTeam[] = []
  const confsUsed = new Set<string>()
  for (const nt of shuffled) {
    if (chosen.length >= MAX_OFFERS) break
    if (confsUsed.has(nt.confederation) && chosen.length < shuffled.length) {
      // tenta variar confederacao primeiro
      continue
    }
    chosen.push(nt)
    confsUsed.add(nt.confederation)
  }
  // completa caso a variacao tenha limitado demais
  if (chosen.length < Math.min(MAX_OFFERS, shuffled.length)) {
    for (const nt of shuffled) {
      if (chosen.length >= MAX_OFFERS) break
      if (!chosen.some(c => c.id === nt.id)) chosen.push(nt)
    }
  }

  return chosen.map(nt => ({
    nationalTeamId: nt.id,
    nationalTeamName: nt.name,
    code: nt.code,
    confederation: nt.confederation,
    strength: strengths[nt.id] ?? 60,
    createdSeason: season,
  }))
}

export function useNationalTeam() {
  const { state, hydrated, setState } = useGameState()
  const attemptedSeasonRef = useRef<number | null>(null)

  const career = state.nationalCareer ?? DEFAULT_NATIONAL_CAREER
  const nationalTeam = getNationalTeamById(career.nationalTeamId)
  const coachScore = computeCoachScore(state)
  const eligible = coachScore >= MIN_SCORE_FOR_OFFERS

  // Auto-gera propostas por temporada quando elegivel e sem selecao
  useEffect(() => {
    if (!hydrated) return
    if (career.nationalTeamId) return
    if ((state.pendingNationalOffers?.length ?? 0) > 0) return
    if (attemptedSeasonRef.current === state.season) return
    attemptedSeasonRef.current = state.season
    if (!eligible) return

    const offers = buildOffers(
      coachScore,
      state.declinedNationalTeamIds ?? [],
      state.season,
      `${state.managerName}-${state.season}-${coachScore}`,
    )
    if (offers.length > 0) {
      setState({
        pendingNationalOffers: offers,
        lastNationalOfferSeason: state.season,
      })
    }
  }, [hydrated, career.nationalTeamId, state.pendingNationalOffers, state.season, eligible, coachScore, state.declinedNationalTeamIds, state.managerName, setState])

  const availableCompetitions = useMemo<NationalCompetitionDef[]>(() => {
    if (!nationalTeam) return []
    return getCompetitionsForConfederation(nationalTeam.confederation)
  }, [nationalTeam])

  const acceptOffer = useCallback((offer: NationalOffer) => {
    setState({
      nationalCareer: {
        ...DEFAULT_NATIONAL_CAREER,
        ...(state.nationalCareer ?? {}),
        nationalTeamId: offer.nationalTeamId,
        nationalTeamName: offer.nationalTeamName,
        acceptedSeason: state.season,
        currentCompetition: null,
        completedThisSeason: [],
      },
      pendingNationalOffers: [],
    })
  }, [setState, state.nationalCareer, state.season])

  const declineOffer = useCallback((nationalTeamId: string) => {
    const remaining = (state.pendingNationalOffers ?? []).filter(o => o.nationalTeamId !== nationalTeamId)
    setState({
      pendingNationalOffers: remaining,
      declinedNationalTeamIds: [...(state.declinedNationalTeamIds ?? []), nationalTeamId],
    })
  }, [setState, state.pendingNationalOffers, state.declinedNationalTeamIds])

  const declineAll = useCallback(() => {
    const ids = (state.pendingNationalOffers ?? []).map(o => o.nationalTeamId)
    setState({
      pendingNationalOffers: [],
      declinedNationalTeamIds: [...(state.declinedNationalTeamIds ?? []), ...ids],
    })
  }, [setState, state.pendingNationalOffers, state.declinedNationalTeamIds])

  const leaveNationalTeam = useCallback(() => {
    setState({
      nationalCareer: { ...DEFAULT_NATIONAL_CAREER },
    })
  }, [setState])

  const startCompetition = useCallback((competitionId: string) => {
    if (!nationalTeam) return
    const def = getCompetitionDef(competitionId)
    if (!def) return
    const comp = createNationalCompetition(def, nationalTeam, state.season)
    setState({
      nationalCareer: {
        ...DEFAULT_NATIONAL_CAREER,
        ...(state.nationalCareer ?? {}),
        currentCompetition: comp,
      },
    })
  }, [nationalTeam, state.nationalCareer, state.season, setState])

  const playNextRound = useCallback(() => {
    const current = state.nationalCareer?.currentCompetition
    console.log("[v0] playNextRound chamado", { hasCurrent: !!current, hasNT: !!nationalTeam, status: current?.status, round: current?.currentRound })
    if (!current || !nationalTeam) return
    if (current.status !== "active") return

    const playedBefore = current.fixtures.filter(f => f.isUserMatch && f.played)
    const updated = advanceNationalRound(current, nationalTeam.id)
    const playedAfter = updated.fixtures.filter(f => f.isUserMatch && f.played)
    const newMatches = playedAfter.slice(playedBefore.length)

    let wins = 0, draws = 0, losses = 0
    for (const f of newMatches) {
      const userIsHome = f.homeId === nationalTeam.id
      const ug = userIsHome ? (f.homeScore ?? 0) : (f.awayScore ?? 0)
      const og = userIsHome ? (f.awayScore ?? 0) : (f.homeScore ?? 0)
      if (f.decidedOnPens) {
        if (f.userAdvanced) wins++; else losses++
      } else if (ug > og) wins++
      else if (ug === og) draws++
      else losses++
    }

    const prev = state.nationalCareer ?? DEFAULT_NATIONAL_CAREER
    const careerPatch: typeof prev = {
      ...prev,
      currentCompetition: updated,
      matchesPlayed: prev.matchesPlayed + newMatches.length,
      wins: prev.wins + wins,
      draws: prev.draws + draws,
      losses: prev.losses + losses,
    }

    // Recompensa por titulo / classificacao
    const justFinished = current.status === "active" && updated.status !== "active"
    let coachPatch: Record<string, unknown> = {}
    if (justFinished) {
      if (updated.status === "champion") {
        careerPatch.titles = [...prev.titles, { competition: updated.competitionName, season: updated.season }]
        coachPatch = {
          coachTotalTitles: (state.coachTotalTitles ?? 0) + 1,
          coachXP: (state.coachXP ?? 0) + 120,
        }
      } else if (updated.status === "qualified") {
        careerPatch.worldCupQualifications = prev.worldCupQualifications + 1
        coachPatch = { coachXP: (state.coachXP ?? 0) + 60 }
      }
    }

    console.log("[v0] playNextRound resultado", { newRound: updated.currentRound, newStatus: updated.status, played: updated.fixtures.filter(f => f.played).length })
    setState({ nationalCareer: careerPatch, ...coachPatch })
  }, [state.nationalCareer, state.coachTotalTitles, state.coachXP, nationalTeam, setState])

  // Encerra a competicao atual (apos terminada) e libera para iniciar outra
  const finishCompetition = useCallback(() => {
    const current = state.nationalCareer?.currentCompetition
    if (!current) return
    const prev = state.nationalCareer ?? DEFAULT_NATIONAL_CAREER
    setState({
      nationalCareer: {
        ...prev,
        currentCompetition: null,
        completedThisSeason: [...prev.completedThisSeason, current.competitionId],
      },
    })
  }, [state.nationalCareer, setState])

  const currentCompetition = career.currentCompetition ?? null
  const userNextFixture = currentCompetition ? getUserNextFixture(currentCompetition) : null

  return {
    hydrated,
    eligible,
    coachScore,
    minScoreForOffers: MIN_SCORE_FOR_OFFERS,
    offers: state.pendingNationalOffers ?? [],
    hasNationalTeam: !!career.nationalTeamId,
    nationalTeam,
    career,
    availableCompetitions,
    currentCompetition,
    userNextFixture,
    season: state.season,
    // acoes
    acceptOffer,
    declineOffer,
    declineAll,
    leaveNationalTeam,
    startCompetition,
    playNextRound,
    finishCompetition,
  }
}
