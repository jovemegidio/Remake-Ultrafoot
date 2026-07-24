"use client"

import { useState, useMemo, useEffect, useRef } from "react"
import { safeLocalSet } from "@/lib/safe-storage"
import { useRouter } from "next/navigation"
import {
  Trophy,
  ChevronRight,
  TrendingUp,
  TrendingDown,
  Minus,
  Star,
  Calendar,
  Users,
  Target,
  Play,
  Globe,
  MapPin,
  Shuffle,
  Check,
  X,
  Crown,
  CalendarRange,
} from "lucide-react"
import { GameHeader } from "@/components/game-header"
import { TeamCrest } from "@/components/team-crest"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { getTeamByShort, getTeamsByDivision, serieBTeams, allBrazilianTeams, type Team } from "@/lib/teams-data"
import { useUserTeam } from "@/lib/save-system"
import { useGameManager, getLeagueName, getStateChampRounds, ESTADO_CAMPEONATO, getStateChampionshipTeams, computeStandingsFromFixtures, type Fixture } from "@/lib/use-game-manager"
import type { StandingsEntry } from "@/lib/game-engine"
import { getCompetitionLogo } from "@/lib/competition-logo"
import { resolveTieByCurto } from "@/lib/cup-engine"
import { getCountryCompetitions, getContinentalSpot, getContinentalDivisions } from "@/lib/country-competitions"
import { useTranslation } from "@/lib/i18n"
import { getStandingZone, getStandingZones } from "@/lib/standing-zones"
import { periodoLabelPorNome } from "@/lib/competition-dates-2026"
import { cn } from "@/lib/utils"

// Tipos para competicoes
interface BracketMatch {
  id: number
  team1: string
  team2: string
  score1: number | null
  score2: number | null
  score1Leg2?: number | null
  score2Leg2?: number | null
  played: boolean
  winner: string | null
}

interface CompetitionState {
  copaBrasil: {
    currentRound: "oitavas" | "quartas" | "semis" | "final"
    oitavas: BracketMatch[]
    quartas: BracketMatch[]
    semis: BracketMatch[]
    final: BracketMatch[]
    drawn: boolean
    eliminated: boolean
    champion: string | null
  }
  estadual: {
    name: string
    phase: "grupos" | "semis" | "final"
    groups: { name: string; teams: { short: string; points: number; played: number }[] }[]
    semis: BracketMatch[]
    final: BracketMatch[]
    drawn: boolean
    eliminated: boolean
    champion: string | null
  }
  libertadores: {
    qualified: boolean
    currentRound: "grupos" | "oitavas" | "quartas" | "semis" | "final"
    group: { name: string; teams: { short: string; country: string; points: number; played: number }[] } | null
    bracket: BracketMatch[]
    eliminated: boolean
    champion: string | null
  }
  sulamericana: {
    qualified: boolean
    currentRound: "grupos" | "oitavas" | "quartas" | "semis" | "final"
    group: { name: string; teams: { short: string; country: string; points: number; played: number }[] } | null
    eliminated: boolean
  }
}

// A Copa do Brasil, o estadual e a Libertadores NAO usam mais listas fixas: os
// participantes sao sorteados dos times REAIS (allBrazilianTeams / getTeamsByDivision /
// getStateChampionshipTeams / getContinentalDivisions), por prestigio. Ver copaBrasilPool
// e continentalTeams dentro do componente.

// Generate standings with random stats (fallback for Serie B)
const generateStandings = (teams: Team[], userTeamShort: string) => {
  return teams.map((team, index) => ({
    position: index + 1,
    team,
    played: 0,
    won: 0,
    drawn: 0,
    lost: 0,
    goalsFor: 0,
    goalsAgainst: 0,
    goalDiff: 0,
    points: 0,
    form: ["", "", "", "", ""] as ("W" | "D" | "L" | "")[],
    isUser: team.curto === userTeamShort,
  }))
}

// Simular resultado de partida
const simulateMatch = (team1Strength: number, team2Strength: number): [number, number] => {
  const total = team1Strength + team2Strength
  const team1Chance = team1Strength / total
  
  const generateGoals = (chance: number): number => {
    const base = Math.random()
    if (base < 0.15) return 0
    if (base < 0.40) return 1
    if (base < 0.65) return 2
    if (base < 0.85) return 3
    if (base < 0.95) return 4
    return 5
  }
  
  let goals1 = generateGoals(team1Chance)
  let goals2 = generateGoals(1 - team1Chance)
  
  // Ajuste baseado na forca
  if (team1Chance > 0.6) goals1 = Math.min(goals1 + 1, 6)
  if (team1Chance < 0.4) goals2 = Math.min(goals2 + 1, 6)
  
  return [goals1, goals2]
}

function initialCompetitionState(userPosition: number): CompetitionState {
  return {
    copaBrasil: { currentRound: "oitavas", oitavas: [], quartas: [], semis: [], final: [], drawn: false, eliminated: false, champion: null },
    estadual: { name: "Estadual", phase: "grupos", groups: [], semis: [], final: [], drawn: false, eliminated: false, champion: null },
    libertadores: { qualified: userPosition <= 4, currentRound: "grupos", group: null, bracket: [], eliminated: false, champion: null },
    sulamericana: { qualified: userPosition > 4 && userPosition <= 6, currentRound: "grupos", group: null, eliminated: false },
  }
}

function sanitizeCompetitionState(value: CompetitionState, userPosition: number): CompetitionState {
  const fallback = initialCompetitionState(userPosition)
  if (!value?.copaBrasil || !value?.estadual || !value?.libertadores || !value?.sulamericana) return fallback
  // Nunca declarar eliminacao antes de existir uma partida disputada.
  const copaPlayed = [...value.copaBrasil.oitavas, ...value.copaBrasil.quartas, ...value.copaBrasil.semis, ...value.copaBrasil.final].some(m => m.played)
  const estadualPlayed = value.estadual.groups.some(g => g.teams.some(t => t.played > 0)) || [...value.estadual.semis, ...value.estadual.final].some(m => m.played)
  const continentalPlayed = (value.libertadores.group?.teams.some(t => t.played > 0) ?? false) || value.libertadores.bracket.some(m => m.played)
  return {
    ...value,
    copaBrasil: { ...value.copaBrasil, eliminated: copaPlayed ? value.copaBrasil.eliminated : false },
    estadual: { ...value.estadual, eliminated: estadualPlayed ? value.estadual.eliminated : false },
    libertadores: { ...value.libertadores, eliminated: continentalPlayed ? value.libertadores.eliminated : false },
  }
}

// Hook para gerenciar estado das competicoes. O estado e por clube E temporada;
// o antigo slot global vazava eliminacoes ao trocar de emprego ou iniciar novo ano.
function useCompetitions(userTeamShort: string, userPosition: number, season: number) {
  const storageKey = `ultrafoot-competitions:${season}:${userTeamShort}`
  const skipSave = useRef(false)
  const [state, setState] = useState<CompetitionState>(() => {
    // Tenta carregar do localStorage
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem(storageKey)
      if (saved) {
        try {
          return sanitizeCompetitionState(JSON.parse(saved), userPosition)
        } catch {}
      }
    }
    return initialCompetitionState(userPosition)
  })

  useEffect(() => {
    skipSave.current = true
    try {
      const saved = localStorage.getItem(storageKey)
      setState(saved ? sanitizeCompetitionState(JSON.parse(saved), userPosition) : initialCompetitionState(userPosition))
    } catch {
      setState(initialCompetitionState(userPosition))
    }
  }, [storageKey])
  
  // Salvar no localStorage
  useEffect(() => {
    if (skipSave.current) { skipSave.current = false; return }
    safeLocalSet(storageKey, JSON.stringify(state))
  }, [state, storageKey])
  
  // Pool REAL da Copa do Brasil: os melhores clubes do Brasil por prestigio (Serie A a D),
  // sorteados a cada temporada. Substitui a lista fixa dos mesmos 16 grandes.
  const copaBrasilPool = useMemo(
    () =>
      allBrazilianTeams
        .filter(t => t.curto !== userTeamShort)
        .sort((a, b) => b.prestigio - a.prestigio)
        .slice(0, 31)
        .map(t => t.curto),
    [userTeamShort],
  )

  // Sortear Copa do Brasil
  // Pool de times que o motor de mata-mata usa para resolver os confrontos pela
  // forca REAL de cada clube (prestigio). Cobre liga do usuario + estadual + copa.
  const allCupTeams = useMemo(() => {
    const map = new Map<string, Team>()
    const add = (t?: Team) => { if (t) map.set(t.curto, t) }
    const user = getTeamByShort(userTeamShort)
    if (user) getTeamsByDivision(user.divisao).forEach(add)
    getStateChampionshipTeams(userTeamShort).forEach(add)
    copaBrasilPool.forEach(c => add(getTeamByShort(c)))
    add(user)
    return Array.from(map.values())
  }, [userTeamShort, copaBrasilPool])

  // Participantes da CONTINENTAL: vem das ligas da confederacao do clube.
  // Um clube da UEFA enfrenta europeus; um da CONMEBOL, sul-americanos.
  const continentalTeams = useMemo(() => {
    const user = getTeamByShort(userTeamShort)
    const pool: Team[] = []
    for (const div of getContinentalDivisions(user?.divisao)) {
      pool.push(...getTeamsByDivision(div))
    }
    return pool
      .filter(t => t.curto !== userTeamShort)
      .sort((a, b) => b.prestigio - a.prestigio)
      .slice(0, 31)   // os 31 melhores do continente + o usuario = 32
  }, [userTeamShort])

  const userCountry = useMemo(() => {
    const user = getTeamByShort(userTeamShort)
    return user?.pais || user?.estado || ""
  }, [userTeamShort])

  const drawCopaBrasil = () => {
    // Garante o usuario no sorteio SEM duplicar (se ele ja esta no pool, nao entra 2x).
    const base = copaBrasilPool.filter(c => c !== userTeamShort)
    const teams = [userTeamShort, ...base].slice(0, 16)
    const shuffled = [...teams].sort(() => Math.random() - 0.5)
    
    const oitavas: BracketMatch[] = []
    for (let i = 0; i < 8; i++) {
      oitavas.push({
        id: i + 1,
        team1: shuffled[i * 2],
        team2: shuffled[i * 2 + 1],
        score1: null,
        score2: null,
        played: false,
        winner: null,
      })
    }
    
    setState(s => ({
      ...s,
      copaBrasil: {
        ...s.copaBrasil,
        oitavas,
        quartas: Array(4).fill(null).map((_, i) => ({ 
          id: i + 1, team1: "", team2: "", score1: null, score2: null, played: false, winner: null 
        })),
        semis: Array(2).fill(null).map((_, i) => ({ 
          id: i + 1, team1: "", team2: "", score1: null, score2: null, played: false, winner: null 
        })),
        final: [{ id: 1, team1: "", team2: "", score1: null, score2: null, played: false, winner: null }],
        drawn: true,
      }
    }))
  }
  
  // Simular jogos da Copa do Brasil — retorna true se usuario ganhou a final
  const simulateCopaBrasilRound = (): boolean => {
    let userWonFinal = false

    setState(s => {
      const copa = { ...s.copaBrasil }
      let currentMatches: BracketMatch[] = []
      let nextRound: "quartas" | "semis" | "final" | null = null
      let nextMatches: BracketMatch[] = []

      if (copa.currentRound === "oitavas") {
        currentMatches = copa.oitavas
        nextRound = "quartas"
        nextMatches = copa.quartas
      } else if (copa.currentRound === "quartas") {
        currentMatches = copa.quartas
        nextRound = "semis"
        nextMatches = copa.semis
      } else if (copa.currentRound === "semis") {
        currentMatches = copa.semis
        nextRound = "final"
        nextMatches = copa.final
      } else if (copa.currentRound === "final") {
        currentMatches = copa.final
        nextRound = null
      }

      // Simular todas as partidas da rodada atual.
      // Antes: simulateMatch(50, 50) — forca fixa, o time nao importava; jogo unico;
      // e empate resolvido por cara-ou-coroa. Agora usa o motor real: forca dos clubes,
      // IDA E VOLTA (final em jogo unico), agregado e penaltis.
      const isFinalRound = copa.currentRound === "final"
      const simulatedMatches = currentMatches.map(match => {
        if (match.played) return match
        if (!match.team1 || !match.team2) return match

        const outcome = resolveTieByCurto(match.team1, match.team2, allCupTeams, !isFinalRound)
        if (!outcome) return match

        return {
          ...match,
          score1: outcome.leg1Home,
          score2: outcome.leg1Away,
          score1Leg2: outcome.leg2Away,   // gols do mandante do confronto NA VOLTA (fora)
          score2Leg2: outcome.leg2Home,   // gols do visitante do confronto NA VOLTA (em casa)
          played: true,
          winner: outcome.winnerCurto,
        }
      })

      // Verificar se usuario foi eliminado (pelo classificado, nao pelo placar da ida)
      const userMatch = simulatedMatches.find(m => m.team1 === userTeamShort || m.team2 === userTeamShort)
      const userEliminated = userMatch && userMatch.winner !== userTeamShort

      // Preencher proxima rodada
      if (nextRound && nextMatches.length > 0) {
        const winners = simulatedMatches.map(m => m.winner).filter(Boolean) as string[]

        for (let i = 0; i < nextMatches.length; i++) {
          nextMatches[i] = {
            ...nextMatches[i],
            team1: winners[i * 2] || "",
            team2: winners[i * 2 + 1] || "",
          }
        }
      }

      // Determinar campeao se for a final
      let champion = copa.champion
      if (copa.currentRound === "final" && simulatedMatches[0]?.played) {
        champion = simulatedMatches[0].winner
        if (champion === userTeamShort) {
          userWonFinal = true  // capturado sincronamente pelo closure
        }
      }

      return {
        ...s,
        copaBrasil: {
          ...copa,
          [copa.currentRound]: simulatedMatches,
          ...(nextRound ? { [nextRound]: nextMatches, currentRound: nextRound } : {}),
          eliminated: userEliminated || copa.eliminated,
          champion,
        }
      }
    })

    return userWonFinal
  }
  
  // Sortear Estadual
  const drawEstadual = () => {
    // Estadual REAL do time do usuario (pelo estado dele), nao mais uma lista
    // hardcoded de 4 estaduais que jogava todo mundo no Paulistao.
    const userTeamData = getTeamByShort(userTeamShort)
    const estadualName = ESTADO_CAMPEONATO[userTeamData?.estado ?? ""] ?? "Campeonato Estadual"
    let estadualTeams = getStateChampionshipTeams(userTeamShort).map(t => t.curto)

    // Garantir que o time do usuario esta no estadual
    if (!estadualTeams.includes(userTeamShort)) {
      estadualTeams = [userTeamShort, ...estadualTeams]
    }

    const shuffled = [...estadualTeams].sort(() => Math.random() - 0.5)

    // Distribui os times em 4 grupos em serpentina. Antes fatiava fixo de 4 em 4
    // assumindo 16 times — estaduais menores (Mineiro, Carioca...) ficavam com grupos vazios.
    const groupNames = ["Grupo A", "Grupo B", "Grupo C", "Grupo D"]
    const groups = groupNames.map(name => ({
      name,
      teams: [] as { short: string; points: number; played: number }[],
    }))
    shuffled.forEach((t, i) => {
      groups[i % 4].teams.push({ short: t, points: 0, played: 0 })
    })
    
    setState(s => ({
      ...s,
      estadual: {
        ...s.estadual,
        name: estadualName,
        groups,
        drawn: true,
      }
    }))
  }
  
  // Simular fase de grupos do Estadual
  const simulateEstadualGroups = () => {
    setState(s => {
      const grupos = s.estadual.groups.map(group => {
        const teams = [...group.teams]
        
        // Cada time joga 3 partidas (todos contra todos dentro do grupo)
        for (let i = 0; i < teams.length; i++) {
          for (let j = i + 1; j < teams.length; j++) {
            if (teams[i].played < 3 && teams[j].played < 3) {
              const [g1, g2] = simulateMatch(50, 50)
              
              teams[i].played++
              teams[j].played++
              
              if (g1 > g2) {
                teams[i].points += 3
              } else if (g2 > g1) {
                teams[j].points += 3
              } else {
                teams[i].points += 1
                teams[j].points += 1
              }
            }
          }
        }
        
        // Ordenar por pontos
        teams.sort((a, b) => b.points - a.points)
        
        return { ...group, teams }
      })
      
      // Criar semis com os primeiros de cada grupo
      const semis: BracketMatch[] = [
        { id: 1, team1: grupos[0].teams[0].short, team2: grupos[1].teams[0].short, score1: null, score2: null, played: false, winner: null },
        { id: 2, team1: grupos[2].teams[0].short, team2: grupos[3].teams[0].short, score1: null, score2: null, played: false, winner: null },
      ]
      
      // Verificar se usuario passou
      const userGroup = grupos.find(g => g.teams.some(t => t.short === userTeamShort))
      const userPassed = userGroup && userGroup.teams[0].short === userTeamShort
      
      return {
        ...s,
        estadual: {
          ...s.estadual,
          groups: grupos,
          semis,
          phase: "semis",
          eliminated: !userPassed,
        }
      }
    })
  }
  
  // Sortear a continental (Libertadores, Champions, AFC...).
  const drawLibertadores = () => {
    if (!state.libertadores.qualified) return

    // Adversarios do CONTINENTE do clube. Antes vinham de uma lista fixa de
    // sul-americanos (Boca, River, Penarol...), entao a Juventus caia num grupo
    // contra o Boca Juniors. E o proprio usuario era rotulado como "Brasil".
    const shuffled = [...continentalTeams].sort(() => Math.random() - 0.5).slice(0, 3)

    const group = {
      name: "Grupo " + String.fromCharCode(65 + Math.floor(Math.random() * 8)),
      teams: [
        { short: userTeamShort, country: userCountry, points: 0, played: 0 },
        ...shuffled.map(t => ({
          short: t.curto,
          country: t.pais || t.estado || "",
          points: 0,
          played: 0,
        })),
      ],
    }

    setState(s => ({
      ...s,
      libertadores: {
        ...s.libertadores,
        group,
      }
    }))
  }
  
  return {
    state,
    drawCopaBrasil,
    simulateCopaBrasilRound,
    drawEstadual,
    simulateEstadualGroups,
    drawLibertadores,
  }
}

export default function CompeticoesPage() {
  const { team: userTeam } = useUserTeam()
  const { standings: gameStandings, currentWeek, currentSeason, userPosition, seasonCalendar } = useGameManager()
  const t = useTranslation()
  const router = useRouter()
  const [activeTab, setActiveTab] = useState("brasileirao")
  const didInitTab = useRef(false)
  const tabsOrder = ["brasileirao", "copabrasil", "estadual", "libertadores", "sulamericana"]

  useEffect(() => {
    const handler = (e: Event) => {
      const btn = (e as CustomEvent).detail?.button
      if (!btn) return
      if (btn === "B") { router.back(); return }
      if (btn === "LB") setActiveTab(t => tabsOrder[Math.max(0, tabsOrder.indexOf(t) - 1)])
      if (btn === "RB") setActiveTab(t => tabsOrder[Math.min(tabsOrder.length - 1, tabsOrder.indexOf(t) + 1)])
    }
    window.addEventListener("gamepad:button", handler)
    return () => window.removeEventListener("gamepad:button", handler)
  }, [router, activeTab])

  const {
    state: compState,
    drawCopaBrasil,
    simulateCopaBrasilRound,
    drawEstadual,
    simulateEstadualGroups,
    drawLibertadores,
  } = useCompetitions(userTeam.curto, userPosition, currentSeason)

  // Navega para a tela de campeao se o usuario ganhar uma copa
  const handleSimulateCopa = (competitionName: string, season: string) => {
    const userWon = simulateCopaBrasilRound()
    if (userWon) {
      safeLocalSet("ultrafoot-pending-champion", JSON.stringify({
        competition: competitionName,
        season,
        type: "cup",
        stats: null,
      }))
      router.push("/campeao")
    }
  }

  // Converte standings do game engine para o formato da tabela
  const serieAStandings = useMemo(() => {
    if (gameStandings.length === 0) {
      return generateStandings(getTeamsByDivision(userTeam.divisao), userTeam.curto)
    }
    
    return gameStandings.map((entry, index) => ({
      position: index + 1,
      team: getTeamByShort(entry.teamShort) || getTeamsByDivision(userTeam.divisao)[0],
      played: entry.played,
      won: entry.won,
      drawn: entry.drawn,
      lost: entry.lost,
      goalsFor: entry.goalsFor,
      goalsAgainst: entry.goalsAgainst,
      goalDiff: entry.goalsFor - entry.goalsAgainst,
      points: entry.points,
      form: [...entry.form.slice(-5), "", "", "", "", ""].slice(0, 5) as ("W" | "D" | "L" | "")[],
      isUser: entry.teamShort === userTeam.curto,
    }))
  }, [gameStandings, userTeam.curto])

  const serieBStandings = useMemo(() => generateStandings(serieBTeams, userTeam.curto), [userTeam.curto])

  // Competicoes do PAIS do clube. A tela era hardcoded em Brasil: quem jogava com o
  // Barcelona via "Copa do Brasil", "Paulistao" e "Libertadores".
  const countryComps = getCountryCompetitions(userTeam.divisao)
  const isBrazilian = countryComps.hasStateChampionship
  // Champions ou Europa League? Depende da posicao do clube na liga.
  const continentalSpot = getContinentalSpot(userTeam.divisao, userPosition)
  // Rotulo unico da continental: usado no card, na aba e nos headers de dentro dela.
  const continentalName = continentalSpot.competition ?? countryComps.continental

  // So no Brasil a liga nacional comeca depois do estadual. Fora do Brasil nao existe
  // estadual, entao a liga esta em andamento desde a 1a rodada.
  const stateChampRounds = isBrazilian ? getStateChampRounds(userTeam.curto) : 0
  const leagueStarted = currentWeek > stateChampRounds

  const officialStateName = ESTADO_CAMPEONATO[userTeam.estado ?? ""] ?? "Campeonato Estadual"
  const officialStateFixtures = seasonCalendar.fixtures.filter(fixture =>
    fixture.competitionType === "state" && fixture.competition === officialStateName,
  )
  const officialStateStandings = useMemo(
    () => computeStandingsFromFixtures(officialStateFixtures, officialStateName),
    [officialStateFixtures, officialStateName],
  )
  const stateChampion = useMemo(() => {
    const finals = officialStateFixtures.filter(fixture => fixture.stage === "final")
    if (!finals.length || finals.some(fixture => !fixture.played || fixture.homeScore === undefined || fixture.awayScore === undefined)) return null
    const totals = new Map<string, number>()
    for (const fixture of finals) {
      totals.set(fixture.homeTeam.curto, (totals.get(fixture.homeTeam.curto) ?? 0) + (fixture.homeScore ?? 0))
      totals.set(fixture.awayTeam.curto, (totals.get(fixture.awayTeam.curto) ?? 0) + (fixture.awayScore ?? 0))
    }
    return [...totals.entries()].sort((a, b) => b[1] - a[1] || (getTeamByShort(b[0])?.prestigio ?? 0) - (getTeamByShort(a[0])?.prestigio ?? 0))[0]?.[0] ?? null
  }, [officialStateFixtures])

  // Abre por padrao na competicao em andamento: estadual antes da liga comecar.
  useEffect(() => {
    if (didInitTab.current) return
    didInitTab.current = true
    if (!leagueStarted) setActiveTab("estadual")
  }, [leagueStarted])

  const competitions = [
    {
      id: "brasileirao",
      name: getLeagueName(userTeam.curto),
      type: "Liga",
      teams: getTeamsByDivision(userTeam.divisao).length,
      status: leagueStarted ? t.common.inProgress : t.common.onTrack,
      userPosition: leagueStarted && userPosition > 0 ? userPosition : null,
      icon: Trophy,
      color: "text-[#ffd700]",
      bgColor: "bg-[#ffd700]/10",
      borderColor: "border-[#ffd700]/30"
    },
    {
      id: "copa-do-brasil",
      // Copa nacional do PAIS do clube (Copa del Rey, FA Cup, Copa do Brasil...).
      name: countryComps.domesticCup,
      type: "Copa",
      teams: 16,
      status: compState.copaBrasil.champion
        ? `${t.finances.champion}: ${compState.copaBrasil.champion}`
        : compState.copaBrasil.eliminated
          ? t.competitions.eliminated
          : compState.copaBrasil.drawn
            ? compState.copaBrasil.currentRound.charAt(0).toUpperCase() + compState.copaBrasil.currentRound.slice(1)
            : t.competitions.awaiting,
      userPosition: null,
      icon: Trophy,
      color: compState.copaBrasil.eliminated ? "text-red-400" : "text-[#00ffc8]",
      bgColor: compState.copaBrasil.eliminated ? "bg-red-400/10" : "bg-[#00ffc8]/10",
      borderColor: compState.copaBrasil.eliminated ? "border-red-400/30" : "border-[#00ffc8]/30"
    },
    {
      id: "estadual",
      name: officialStateName,
      type: "Estadual",
      teams: 16,
      status: stateChampion
        ? `${t.finances.champion}: ${getTeamByShort(stateChampion)?.nome ?? stateChampion}`
        : compState.estadual.eliminated
          ? t.competitions.eliminated
          : compState.estadual.drawn
            ? compState.estadual.phase.charAt(0).toUpperCase() + compState.estadual.phase.slice(1)
            : t.competitions.awaiting,
      userPosition: null,
      icon: MapPin,
      color: compState.estadual.eliminated ? "text-red-400" : "text-orange-400",
      bgColor: compState.estadual.eliminated ? "bg-red-400/10" : "bg-orange-400/10",
      borderColor: compState.estadual.eliminated ? "border-red-400/30" : "border-orange-400/30"
    },
    {
      id: "libertadores",
      // A continental depende de ONDE o clube terminou, nao so do continente:
      // G4 -> Champions/Libertadores; 5o-6o -> Europa League/Sul-Americana.
      name: continentalSpot.competition ?? countryComps.continental,
      type: continentalSpot.isSecondary ? "Continental (2a)" : "Continental",
      teams: 32,
      status: compState.libertadores.qualified
        ? compState.libertadores.champion
          ? `${t.finances.champion}: ${compState.libertadores.champion}`
          : compState.libertadores.eliminated
            ? t.competitions.eliminated
            : compState.libertadores.group
              ? t.competitions.groupStage
              : t.competitions.qualified
        : t.competitions.notQualified,
      userPosition: null,
      icon: Globe,
      color: compState.libertadores.qualified
        ? compState.libertadores.eliminated ? "text-red-400" : "text-amber-400"
        : "text-white/30",
      bgColor: compState.libertadores.qualified
        ? compState.libertadores.eliminated ? "bg-red-400/10" : "bg-amber-400/10"
        : "bg-white/5",
      borderColor: compState.libertadores.qualified
        ? compState.libertadores.eliminated ? "border-red-400/30" : "border-amber-400/30"
        : "border-white/10"
    },
  // Estadual so existe no Brasil — um clube espanhol nao disputa "Paulistao".
  ].filter(c => c.id !== "estadual" || isBrazilian)

  return (
    <div className="h-screen md:pl-0 pl-0 pb-20 md:pb-0 bg-[#050508] flex flex-col overflow-hidden">
      <GameHeader team={userTeam} />

      <main className="flex-1 p-4 overflow-y-auto scrollbar-premium space-y-4">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm text-white/50">{t.competitions.seasonFollowup(currentSeason)}</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#0c0c10] border border-white/[0.04]">
              <Calendar className="h-4 w-4 text-[#00ffc8]" />
              <span className="text-sm text-white/70">{t.competitions.roundProgress(currentWeek)}</span>
            </div>
          </div>
        </div>

        {/* Competition Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {competitions.map((comp) => {
            const Icon = comp.icon
            const isActive = activeTab === comp.id
            
            return (
              <button
                key={comp.id}
                onClick={() => setActiveTab(comp.id)}
                className={cn(
                  "rounded-xl bg-[#0c0c10] border p-5 text-left transition-all",
                  isActive 
                    ? "border-[#00ffc8] ring-1 ring-[#00ffc8]" 
                    : "border-white/[0.04] hover:border-white/10"
                )}
              >
                <div className="flex items-start justify-between">
                  {/* Logo real da competicao quando existir; senao, o icone generico. */}
                  {getCompetitionLogo(comp.name) ? (
                    <div className="flex h-10 w-10 items-center justify-center">
                      <img
                        src={getCompetitionLogo(comp.name)!}
                        alt={comp.name}
                        className="h-10 w-10 object-contain"
                      />
                    </div>
                  ) : (
                    <div className={cn(
                      "flex h-10 w-10 items-center justify-center rounded-lg",
                      comp.bgColor
                    )}>
                      <Icon className={cn("h-5 w-5", comp.color)} />
                    </div>
                  )}
                  {comp.userPosition && (
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#00ffc8]/20 text-sm font-bold text-[#00ffc8]">
                      {comp.userPosition}
                    </span>
                  )}
                </div>
                <h3 className="mt-4 font-semibold text-white text-sm">{comp.name}</h3>
                <div className="mt-1 flex items-center gap-2 text-xs text-white/50">
                  <span>{comp.type}</span>
                  <span className="text-white/20">|</span>
                  <Users className="h-3 w-3" />
                  <span>{t.competitions.teamCount(comp.teams)}</span>
                </div>
                {/* Periodo REAL da competicao em 2026 (Copa do Mundo 11 jun – 19 jul,
                    etc.). O motor e por semana; isto e a data de verdade exibida.
                    Casa pelo NOME porque o card usa id generico. */}
                {periodoLabelPorNome(comp.name) && (
                  <div className="mt-1 flex items-center gap-1.5 text-[11px] text-white/40">
                    <CalendarRange className="h-3 w-3" />
                    <span>{periodoLabelPorNome(comp.name)}</span>
                  </div>
                )}
                <div className={cn(
                  "mt-3 inline-flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-medium uppercase tracking-wider",
                  comp.bgColor,
                  comp.color
                )}>
                  {comp.status}
                </div>
              </button>
            )
          })}
        </div>

        {/* Standings Table */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="bg-[#1a1a1a] border border-white/10 p-1 h-auto">
            {/* Rotulos vinham fixos em "Serie A / Serie B / Copa do Brasil / Estadual":
                com a Juventus, o jogador via abas brasileiras. Agora seguem o pais do clube. */}
            <TabsTrigger
              value="brasileirao"
              className="text-xs data-[state=active]:bg-white/10 data-[state=active]:text-white text-white/50 px-4 py-2"
            >
              {getLeagueName(userTeam.curto)}
            </TabsTrigger>
            {/* Serie B e Estadual so existem no Brasil. */}
            {isBrazilian && (
              <TabsTrigger
                value="serie-b"
                className="text-xs data-[state=active]:bg-white/10 data-[state=active]:text-white text-white/50 px-4 py-2"
              >
                Serie B
              </TabsTrigger>
            )}
            <TabsTrigger
              value="copa-do-brasil"
              className="text-xs data-[state=active]:bg-white/10 data-[state=active]:text-white text-white/50 px-4 py-2"
            >
              {countryComps.domesticCup}
            </TabsTrigger>
            {isBrazilian && (
              <TabsTrigger
                value="estadual"
                className="text-xs data-[state=active]:bg-white/10 data-[state=active]:text-white text-white/50 px-4 py-2"
              >
                Estadual
              </TabsTrigger>
            )}
            <TabsTrigger
              value="libertadores"
              className="text-xs data-[state=active]:bg-white/10 data-[state=active]:text-white text-white/50 px-4 py-2"
            >
              {continentalName}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="brasileirao" className="mt-4">
            <StandingsTable standings={serieAStandings} userTeam={userTeam} division="serie_a" />
          </TabsContent>

          <TabsContent value="serie-b" className="mt-4">
            <StandingsTable standings={serieBStandings} userTeam={userTeam} division="serie_b" />
          </TabsContent>

          <TabsContent value="copa-do-brasil" className="mt-4">
            <CopaBracket
              userTeam={userTeam}
              state={compState.copaBrasil}
              onDraw={drawCopaBrasil}
              onSimulate={() => handleSimulateCopa(
                "Copa do Brasil",
                `${currentSeason}/${String(currentSeason + 1).slice(-2)}`
              )}
            />
          </TabsContent>

          <TabsContent value="estadual" className="mt-4">
            <EstadualView
              userTeam={userTeam}
              name={officialStateName}
              fixtures={officialStateFixtures}
              standings={officialStateStandings}
              champion={stateChampion}
            />
          </TabsContent>

          <TabsContent value="libertadores" className="mt-4">
            <LibertadoresView
              userTeam={userTeam}
              state={compState.libertadores}
              onDraw={drawLibertadores}
              competitionName={continentalName}
            />
          </TabsContent>
        </Tabs>
      </main>

    </div>
  )
}

// Copa do Brasil Bracket Completo
function CopaBracket({
  userTeam,
  state,
  onDraw,
  onSimulate
}: {
  userTeam: Team
  state: CompetitionState["copaBrasil"]
  onDraw: () => void
  onSimulate: () => void
}) {
  const t = useTranslation()
  const getTeamData = (short: string | null) => {
    if (!short) return null
    return getTeamByShort(short)
  }

  if (!state.drawn) {
    return (
      <div className="rounded-xl bg-[#0c0c10] border border-white/[0.04] p-12 text-center">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-[#00ffc8]/10 mx-auto mb-6">
          <Trophy className="h-10 w-10 text-[#00ffc8]" />
        </div>
        <h3 className="text-xl font-semibold text-white mb-2">{t.competitions.copaDoBrasil} 2026</h3>
        <p className="text-sm text-white/50 mb-6">
          Clique para realizar o sorteio das oitavas de final
        </p>
        <button
          onClick={onDraw}
          className="px-6 py-3 rounded-lg bg-[#00ffc8] text-black font-semibold hover:bg-[#00c8ff] transition-colors inline-flex items-center gap-2"
        >
          <Shuffle className="h-4 w-4" />
          {t.competitions.draw}
        </button>
      </div>
    )
  }

  const allRounds = [
    { name: t.competitions.roundOf16, matches: state.oitavas, isCurrent: state.currentRound === "oitavas" },
    { name: t.competitions.quarterFinals, matches: state.quartas, isCurrent: state.currentRound === "quartas" },
    { name: t.competitions.semiFinals, matches: state.semis, isCurrent: state.currentRound === "semis" },
    { name: t.competitions.final, matches: state.final, isCurrent: state.currentRound === "final" },
  ]

  const canSimulate = !state.champion && !state.eliminated

  return (
    <div className="rounded-xl bg-[#0c0c10] border border-white/[0.04] p-6 overflow-x-auto scrollbar-thin">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Trophy className="h-5 w-5 text-[#00ffc8]" />
          <h3 className="text-lg font-semibold text-white">{t.competitions.copaDoBrasil} 2026 - Mata-mata</h3>
        </div>

        {canSimulate && (
          <button
            onClick={onSimulate}
            className="px-4 py-2 rounded-lg bg-[#00ffc8] text-black font-medium text-sm hover:bg-[#00c8ff] transition-colors inline-flex items-center gap-2"
          >
            <Play className="h-4 w-4" />
            {t.competitions.simulate} {state.currentRound}
          </button>
        )}

        {state.champion && (
          <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#ffd700]/20 border border-[#ffd700]/30">
            <Crown className="h-4 w-4 text-[#ffd700]" />
            <span className="text-sm font-semibold text-[#ffd700]">
              {t.finances.champion}: {state.champion}
            </span>
          </div>
        )}
      </div>

      <div className="flex gap-6 min-w-[1000px]">
        {allRounds.map((round, roundIndex) => (
          <div key={round.name} className="flex-1">
            <div className={cn(
              "text-xs uppercase tracking-wider mb-3 text-center font-medium",
              round.isCurrent ? "text-[#00ffc8]" : "text-white/40",
              round.name === "Final" && "text-[#ffd700]"
            )}>
              {round.name}
            </div>
            <div 
              className="space-y-2"
              style={{ paddingTop: `${roundIndex * 24}px` }}
            >
              {round.matches.map((match) => {
                const team1 = getTeamData(match.team1)
                const team2 = getTeamData(match.team2)
                const isUserMatch = match.team1 === userTeam.curto || match.team2 === userTeam.curto
                const userWon = match.played && match.winner === userTeam.curto
                const userLost = match.played && isUserMatch && match.winner !== userTeam.curto
                
                return (
                  <div 
                    key={match.id} 
                    className={cn(
                      "p-3 rounded-lg border transition-all",
                      userLost 
                        ? "bg-red-500/10 border-red-500/30"
                        : userWon
                          ? "bg-[#00ffc8]/10 border-[#00ffc8]/30"
                          : isUserMatch 
                            ? "bg-blue-500/10 border-blue-500/30" 
                            : "bg-white/5 border-white/10"
                    )}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      {team1 && <TeamCrest team={team1} size="xs" />}
                      <span className={cn(
                        "text-xs flex-1",
                        match.team1 === userTeam.curto && "font-bold text-white",
                        match.played && match.winner === match.team1 && "text-[#00ffc8]"
                      )}>
                        {match.team1 || t.competitions.toBeDefined}
                      </span>
                      <span className={cn(
                        "text-sm font-bold tabular-nums",
                        match.played && match.winner === match.team1 ? "text-[#00ffc8]" : "text-white/50"
                      )}>
                        {match.score1 ?? "-"}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      {team2 && <TeamCrest team={team2} size="xs" />}
                      <span className={cn(
                        "text-xs flex-1",
                        match.team2 === userTeam.curto && "font-bold text-white",
                        match.played && match.winner === match.team2 && "text-[#00ffc8]"
                      )}>
                        {match.team2 || t.competitions.toBeDefined}
                      </span>
                      <span className={cn(
                        "text-sm font-bold tabular-nums",
                        match.played && match.winner === match.team2 ? "text-[#00ffc8]" : "text-white/50"
                      )}>
                        {match.score2 ?? "-"}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>
      
      {state.eliminated && (
        <div className="mt-6 p-4 rounded-lg bg-red-500/10 border border-red-500/30 text-center">
          <X className="h-6 w-6 text-red-500 mx-auto mb-2" />
          <p className="text-sm text-red-400">{t.competitions.eliminatedFromCopa}</p>
        </div>
      )}
    </div>
  )
}

// Estadual View
function EstadualView({
  userTeam,
  name,
  fixtures,
  standings,
  champion,
}: {
  userTeam: Team
  name: string
  fixtures: Fixture[]
  standings: StandingsEntry[]
  champion: string | null
}) {
  const stageOrder = ["fase_classificatoria", "segunda_fase", "quartas", "semifinal", "final"]
  const stageLabels: Record<string, string> = { fase_classificatoria: "Fase classificatória", segunda_fase: "Segunda fase", quartas: "Quartas de final", semifinal: "Semifinal", final: "Final" }
  const activeStage = stageOrder.find(stage => fixtures.some(fixture => fixture.stage === stage && !fixture.played)) ?? "final"
  const stageFixtures = fixtures.filter(fixture => fixture.stage === activeStage)

  return (
    <div className="rounded-xl bg-[#0c0c10] border border-white/[0.04] p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <MapPin className="h-5 w-5 text-orange-400" />
          <div><h3 className="text-lg font-semibold text-white">{name} 2026</h3><p className="text-xs text-white/40">{stageLabels[activeStage] ?? activeStage}</p></div>
        </div>
        {champion && <div className="flex items-center gap-2 rounded-lg border border-[#ffd700]/30 bg-[#ffd700]/10 px-4 py-2 text-sm font-bold text-[#ffd700]"><Crown className="h-4 w-4" />Campeão: {getTeamByShort(champion)?.nome ?? champion}</div>}
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.15fr_.85fr]">
        <div className="overflow-hidden rounded-xl border border-white/10">
          <div className="grid grid-cols-[36px_1fr_42px_42px_42px] bg-white/[0.04] px-3 py-2 text-[10px] font-bold uppercase text-white/35"><span>#</span><span>Clube</span><span>J</span><span>SG</span><span>PTS</span></div>
          {standings.map((row, index) => {
            const team = getTeamByShort(row.teamShort)
            const mine = row.teamShort === userTeam.curto
            return <div key={row.teamShort} className={cn("grid grid-cols-[36px_1fr_42px_42px_42px] items-center border-t border-white/[0.05] px-3 py-2.5 text-xs", mine && "border-l-2 border-l-orange-400 bg-orange-400/10")}><span className="text-white/45">{index + 1}</span><span className="flex min-w-0 items-center gap-2 font-semibold text-white">{team && <TeamCrest team={team} size="xs" />}<span className="truncate">{team?.nome ?? row.teamShort}</span>{mine && <span className="rounded bg-orange-400 px-1.5 py-0.5 text-[8px] font-black text-black">VOCÊ</span>}</span><span className="text-white/55">{row.played}</span><span className="text-white/55">{row.goalsFor - row.goalsAgainst}</span><span className="font-black text-white">{row.points}</span></div>
          })}
        </div>
        <div className="space-y-2">
          <h4 className="mb-3 text-xs font-black uppercase tracking-wider text-orange-300">Partidas da fase</h4>
          {stageFixtures.slice(-12).map(fixture => {
            const mine = fixture.isUserMatch
            return <div key={fixture.id} className={cn("flex items-center gap-2 rounded-lg border border-white/[0.06] bg-white/[0.025] p-3 text-xs", mine && "border-orange-400/35 bg-orange-400/10")}><span className="min-w-0 flex-1 truncate text-right text-white/70">{fixture.homeTeam.nome}</span><span className="rounded bg-black/35 px-2 py-1 font-black text-white">{fixture.played ? `${fixture.homeScore} - ${fixture.awayScore}` : "x"}</span><span className="min-w-0 flex-1 truncate text-white/70">{fixture.awayTeam.nome}</span></div>
          })}
        </div>
      </div>
    </div>
  )
}

// Continental View (Libertadores, Champions, Europa League, Sul-Americana...)
function LibertadoresView({
  userTeam,
  state,
  onDraw,
  competitionName,
}: {
  userTeam: Team
  state: CompetitionState["libertadores"]
  onDraw: () => void
  /** Competicao que o clube realmente disputa — nao e sempre a Libertadores. */
  competitionName: string
}) {
  const t = useTranslation()

  if (!state.qualified) {
    return (
      <div className="rounded-xl bg-[#0c0c10] border border-white/[0.04] p-12 text-center">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-white/5 mx-auto mb-6">
          <Globe className="h-10 w-10 text-white/30" />
        </div>
        <h3 className="text-xl font-semibold text-white mb-2">{competitionName} 2026</h3>
        <p className="text-sm text-white/50 mb-6">
          {t.competitions.toQualifyTop4}
        </p>
        <div className="text-xs text-white/30">
          {state.qualified ? t.competitions.qualified : t.competitions.notQualified}
        </div>
      </div>
    )
  }

  if (!state.group) {
    return (
      <div className="rounded-xl bg-[#0c0c10] border border-white/[0.04] p-12 text-center">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-amber-400/10 mx-auto mb-6">
          <Globe className="h-10 w-10 text-amber-400" />
        </div>
        <h3 className="text-xl font-semibold text-white mb-2">{competitionName} 2026</h3>
        <p className="text-sm text-white/50 mb-6">
          {t.competitions.youQualified}
        </p>
        <button
          onClick={onDraw}
          className="px-6 py-3 rounded-lg bg-amber-500 text-black font-semibold hover:bg-amber-400 transition-colors inline-flex items-center gap-2"
        >
          <Shuffle className="h-4 w-4" />
          {t.competitions.drawGroup}
        </button>
      </div>
    )
  }

  return (
    <div className="rounded-xl bg-[#0c0c10] border border-white/[0.04] p-6">
      <div className="flex items-center gap-2 mb-6">
        <Globe className="h-5 w-5 text-amber-400" />
        <h3 className="text-lg font-semibold text-white">{competitionName} 2026 - {state.group.name}</h3>
      </div>

      <div className="max-w-md">
        <div className="rounded-lg bg-amber-500/10 border border-amber-500/30 p-4">
          <h4 className="text-sm font-semibold text-amber-400 mb-3">{state.group.name}</h4>
          <div className="space-y-2">
            {state.group.teams.map((team, idx) => {
              const isUser = team.short === userTeam.curto
              
              return (
                <div 
                  key={team.short}
                  className={cn(
                    "flex items-center gap-3 p-2 rounded",
                    isUser && "bg-amber-500/20"
                  )}
                >
                  <span className="text-xs text-white/50 w-4">{idx + 1}.</span>
                  <div className="flex-1">
                    <span className={cn(
                      "text-sm",
                      isUser && "font-bold text-white"
                    )}>
                      {team.short}
                    </span>
                    <span className="text-xs text-white/40 ml-2">({team.country})</span>
                  </div>
                  <span className="text-xs text-white/50">{team.played}J</span>
                  <span className="text-sm font-bold text-white">{team.points}pts</span>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

function StandingsTable({ 
  standings, 
  userTeam,
  division,
}: { 
  standings: {
    position: number
    team: Team
    played: number
    won: number
    drawn: number
    lost: number
    goalsFor: number
    goalsAgainst: number
    goalDiff: number
    points: number
    form: ("W" | "D" | "L" | "")[]
    isUser: boolean
  }[]
  userTeam: Team
  division: string
}) {
  const t = useTranslation()
  const zones = useMemo(
    () => getStandingZones(division, standings.length),
    [division, standings.length]
  )

  return (
    <div className="rounded-xl bg-[#0c0c10] border border-white/[0.04] overflow-hidden">
      {/* Header */}
      <div className="grid grid-cols-[40px_1fr_40px_40px_40px_40px_50px_50px_50px_60px_100px] gap-2 px-4 py-3 text-[10px] font-medium tracking-widest text-white/40 uppercase border-b border-white/[0.04] bg-white/[0.02]">
        <span className="text-center">#</span>
        <span>{t.dashboard.col.club}</span>
        <span className="text-center">J</span>
        <span className="text-center">V</span>
        <span className="text-center">E</span>
        <span className="text-center">D</span>
        <span className="text-center">GP</span>
        <span className="text-center">GC</span>
        <span className="text-center">SG</span>
        <span className="text-center">PTS</span>
        <span className="text-center">Forma</span>
      </div>

      {/* Rows */}
      <div className="divide-y divide-white/5 max-h-[500px] overflow-y-auto scrollbar-thin">
        {standings.map((row) => {
          const zone = getStandingZone(row.position, zones)

          return (
            <div
              key={row.team.curto}
              className={cn(
                "grid grid-cols-[40px_1fr_40px_40px_40px_40px_50px_50px_50px_60px_100px] gap-2 px-4 py-3 items-center transition-colors hover:bg-white/[0.02]",
                row.isUser && "bg-[#00ffc8]/10 border-l-2 border-[#00ffc8]"
              )}
            >
              <span
                className={cn(
                  "text-center text-sm font-medium",
                  !zone && "text-white/50"
                )}
                style={zone ? { color: zone.color } : undefined}
              >
                {row.position}
              </span>
              
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center">
                  <TeamCrest team={row.team} size="table" />
                </div>
                <span className={cn(
                  "truncate text-sm",
                  row.isUser ? "font-semibold text-white" : "text-white/80"
                )}>
                  {row.team.nome}
                </span>
                {row.isUser && <Star className="h-3 w-3 text-[#ffd700] shrink-0" />}
              </div>

              <span className="text-center text-sm tabular-nums text-white/70">{row.played}</span>
              <span className="text-center text-sm tabular-nums text-[#00ffc8]">{row.won}</span>
              <span className="text-center text-sm tabular-nums text-white/50">{row.drawn}</span>
              <span className="text-center text-sm tabular-nums text-red-500">{row.lost}</span>
              <span className="text-center text-sm tabular-nums text-white/70">{row.goalsFor}</span>
              <span className="text-center text-sm tabular-nums text-white/70">{row.goalsAgainst}</span>
              <span className={cn(
                "text-center text-sm tabular-nums",
                row.goalDiff > 0 ? "text-[#00ffc8]" :
                row.goalDiff < 0 ? "text-red-500" :
                "text-white/50"
              )}>
                {row.goalDiff > 0 ? "+" : ""}{row.goalDiff}
              </span>
              <span className="text-center text-sm tabular-nums font-bold text-white">{row.points}</span>

              <div className="flex items-center justify-center gap-1">
                {row.form.map((result, i) => (
                  <span
                    key={i}
                    className={cn(
                      "h-5 w-5 rounded text-[10px] font-bold flex items-center justify-center",
                      result === "W" ? "bg-[#00ffc8]/20 text-[#00ffc8]" :
                      result === "D" ? "bg-white/10 text-white/50" :
                      result === "L" ? "bg-red-500/20 text-red-500" :
                      "bg-white/5 text-white/20"
                    )}
                  >
                    {result || "-"}
                  </span>
                ))}
              </div>
            </div>
          )
        })}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3 text-[10px] text-white/50 border-t border-white/[0.04] bg-white/[0.02]">
        {zones.map((zone) => (
          <div key={zone.id} className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: zone.color }} />
            <span>{zone.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
