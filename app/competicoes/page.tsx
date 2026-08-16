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
  PlayCircle,
} from "lucide-react"
import { GameHeader } from "@/components/game-header"
import { TeamCrest } from "@/components/team-crest"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { getTeamByShort, getTeamByFileKey, getTeamsByDivision, serieBTeams, allBrazilianTeams, type Team } from "@/lib/teams-data"

// Grupos REAIS da fase de grupos da CONMEBOL Libertadores 2026 (sorteio 20/03/2026),
// por file_key para evitar colisao de "curto" (ha duas Universidad Catolica). Usados
// na 1a temporada (2026): a selecao do usuario cai no seu grupo real. Fonte: CNN Brasil.
const LIBERTADORES_2026_GROUPS: string[][] = [
  ["flarj", "estudiantes_lp", "cusco_fc", "ind_medellin"],                     // A
  ["nacional_ury", "universitario_per", "coquimbo_unido", "deportes_tolima"],  // B
  ["flurj", "bolivar_bol", "dep_la_guaira", "independiente_rivadavia"],        // C
  ["boca_juniors", "cruzeiro_bra", "u_catolica_chi", "barcelona_sc"],          // D
  ["penarol", "corinthians_bra", "santa_fe_col", "platense"],                  // E
  ["palmeiras", "cerro_porteno", "junior_baq", "sporting_cristal"],            // F
  ["ldu_quito", "lanus_arg", "always_ready", "miirassol_sp"],                  // G
  ["independiente_del_valle", "libertad_par", "rosario_central", "ucv_ven"],   // H
]

// Grupos REAIS da CONMEBOL Sul-Americana 2026 (mesmo sorteio, 20/03/2026). A aba
// continental do jogo e uma so (Libertadores/Sul-Americana pelo rotulo), entao o
// drawLibertadores checa os DOIS mapas e usa aquele em que o clube esta.
const SULAMERICANA_2026_GROUPS: string[][] = [
  ["america_cali", "tigre_arg", "macara", "alianza_atletico"],                 // A
  ["atleticomg_bra", "cienciano", "puerto_cabello", "juventud_ury"],           // B
  ["saopaulo_bra", "millonarios", "boston_river", "ohiggins"],                 // C
  ["santos", "san_lorenzo", "deportivo_cuenca", "recoleta"],                   // D
  ["racing_arg", "caracas", "independiente_bol", "botafogorj_bra"],            // E
  ["gremio", "palestino", "city_torque", "deportivo_riestra"],                 // F
  ["olimpia", "vasco", "audax_italiano", "barracas_central"],                  // G
  ["river_plate", "bragantino_bra", "blooming", "carabobo"],                   // H
]

// Os 16 REAIS classificados as OITAVAS da Copa do Brasil 2026 (definidos em
// 14/05/2026), por file_key. Na 1a temporada, as oitavas usam esses clubes.
// Fonte: CBF / soccerway. Das oitavas em diante e confiavel (clubes grandes).
const COPA_BRASIL_2026_OITAVAS: string[] = [
  "vitoria", "internacional_bra", "cruzeiro_bra", "flurj", "santos", "remo_pa",
  "vasco", "palmeiras", "atleticomg_bra", "miirassol_sp", "juventude",
  "chapecoense_bra", "gremio", "atleticopr_bra", "fortaleza", "corinthians_bra",
]
import { getCareerScopedKey } from "@/lib/save-system"
import { useUserTeam } from "@/lib/time-da-carreira"
import { useGameManager, getLeagueName, getStateChampRounds, ESTADO_CAMPEONATO, getStateChampionshipTeams, computeStandingsFromFixtures, type Fixture } from "@/lib/use-game-manager"
import type { StandingsEntry } from "@/lib/game-engine"
import { useGameEngine, type MatchResult as EngineMatchResult } from "@/lib/game-engine"
import { getPlayersForTeam } from "@/lib/players-data"
import { gerarEstatisticasCompeticao } from "@/lib/competition-scorers"
import { getCompetitionLogo } from "@/lib/competition-logo"
import { resolveTieByCurto, type CobrancaPenalti } from "@/lib/cup-engine"
import { faseDaPartida } from "@/lib/competition-phase"
import { resultadoDoConfronto } from "@/lib/cup-bracket"
// Assistir a disputa de penaltis de qualquer confronto da chave, nao so do seu.
import { PenaltisAlheiosModal } from "@/components/match/penaltis-alheios-modal"
import { getCountryCompetitions, getContinentalSpot, getContinentalDivisions } from "@/lib/country-competitions"
import { useTranslation } from "@/lib/i18n"
import { getStandingZone, getStandingZones } from "@/lib/standing-zones"
import { periodoLabelPorNome } from "@/lib/competition-dates-2026"
import { cn } from "@/lib/utils"
import { siglaExibivel } from "@/lib/club-identity"

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
  /**
   * Disputa de pênaltis, quando houve. O placar (`penaltis`) já dava para saber
   * QUEM passou; `cobrancas` é o que permite ASSISTIR — chute a chute, com quem
   * bateu e quem errou. Antes as cobranças eram calculadas e descartadas.
   */
  penaltis?: [number, number] | null
  cobrancas?: CobrancaPenalti[] | null
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

/**
 * A chave visual antiga tinha um sorteio próprio no localStorage, separado do
 * calendário oficial. Mantemos os confrontos da CPU, mas o caminho do usuário
 * sempre é sobrescrito pelas fixtures reais do save.
 */
function copaBrasilDoCalendario(
  state: CompetitionState["copaBrasil"],
  fixtures: Fixture[],
  userCurto: string,
  season: number,
  competitionName: string,
  /** Resultados do save: é deles que sai o placar REAL da disputa de pênaltis. */
  resultados: readonly EngineMatchResult[] = [],
): CompetitionState["copaBrasil"] {
  const isOfficial = (fixture: Fixture) => fixture.competitionType === "cup"
    && fixture.competition.localeCompare(competitionName, undefined, { sensitivity: "base" }) === 0
  const fases = [
    { fixtureStages: ["primeira_fase", "segunda_fase", "terceira_fase", "quarta_fase", "quinta_fase", "oitavas"], stateStage: "oitavas" as const },
    { fixtureStages: ["quartas"], stateStage: "quartas" as const },
    { fixtureStages: ["semifinal"], stateStage: "semis" as const },
    { fixtureStages: ["final"], stateStage: "final" as const },
  ]
  const next = {
    ...state,
    drawn: state.drawn || fixtures.some(isOfficial),
    oitavas: state.oitavas.map(match => ({ ...match })),
    quartas: state.quartas.map(match => ({ ...match })),
    semis: state.semis.map(match => ({ ...match })),
    final: state.final.map(match => ({ ...match })),
  }

  for (const fase of fases) {
    // Quando a oitava já foi criada ela substitui a 5ª fase no primeiro espaço
    // da chave compacta; enquanto isso, o sorteio inicial mostra a 5ª fase real.
    const fixtureStage = [...fase.fixtureStages].reverse().find(stage => fixtures.some(f =>
      isOfficial(f) && f.stage === stage && f.isUserMatch,
    ))
    if (!fixtureStage) continue
    const oficiais = fixtures
      .filter(f => isOfficial(f) && f.stage === fixtureStage && f.isUserMatch)
      .sort((a, b) => a.week - b.week || a.id - b.id)
    if (!oficiais.length) continue

    const primeira = oficiais[0]
    const rival = primeira.homeTeam.curto === userCurto ? primeira.awayTeam.curto : primeira.homeTeam.curto
    const partidas = next[fase.stateStage]
    const encontrado = partidas.findIndex(m => m.team1 === userCurto || m.team2 === userCurto)
    const slot = encontrado >= 0 ? encontrado : 0
    const base = partidas[slot] ?? { id: slot + 1, team1: "", team2: "", score1: null, score2: null, played: false, winner: null }
    const encerradas = oficiais.filter(f => f.played && f.homeScore !== undefined && f.awayScore !== undefined)
    const confrontoEncerrado = encerradas.length === oficiais.length
    const golsUser = encerradas.reduce((total, f) => total + (f.homeTeam.curto === userCurto ? f.homeScore! : f.awayScore!), 0)
    const golsRival = encerradas.reduce((total, f) => total + (f.homeTeam.curto === rival ? f.homeScore! : f.awayScore!), 0)
    // O placar da disputa vem do SAVE quando ela foi jogada na tela; senão, da
    // disputa determinística. Nos dois casos é o MESMO número que decidiu quem
    // passou — antes esta tela chumbava "5-4"/"4-5" para uma disputa que nunca
    // tinha acontecido.
    const decisao = confrontoEncerrado
      ? resultadoDoConfronto(
          encerradas.map(f => {
            const euEmCasa = f.homeTeam.curto === userCurto
            const r = resultados.find(x =>
              x.season === season && x.week === f.week &&
              (x.homeTeam === f.homeTeam.curto && x.awayTeam === f.awayTeam.curto),
            )
            return {
              golsPro: euEmCasa ? f.homeScore! : f.awayScore!,
              golsContra: euEmCasa ? f.awayScore! : f.homeScore!,
              penaltisPro: euEmCasa ? r?.homePenalties : r?.awayPenalties,
              penaltisContra: euEmCasa ? r?.awayPenalties : r?.homePenalties,
            }
          }),
          oficiais.length,
          `${userCurto}:${primeira.competitionId ?? competitionName}:${season}:${fixtureStage}`,
          getTeamByShort(userCurto)?.prestigio ?? 70,
          getTeamByShort(rival)?.prestigio ?? 70,
        )
      : { passou: null, penaltis: null }
    const passou = decisao.passou

    partidas[slot] = {
      ...base,
      team1: userCurto,
      team2: rival,
      score1: encerradas.length ? golsUser : null,
      score2: encerradas.length ? golsRival : null,
      played: confrontoEncerrado,
      winner: confrontoEncerrado ? (passou ? userCurto : rival) : null,
      penaltis: decisao.penaltis,
      cobrancas: null,
    }
  }

  return next
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
  /**
   * A CHAVE PRECISA SER DA CARREIRA, não só do clube+temporada.
   *
   * Era `ultrafoot-competitions:${season}:${userTeamShort}`. Duas carreiras com o
   * MESMO clube na mesma temporada — recomeçar com o Corinthians em 2026, que é
   * o caso mais comum de todos — liam e escreviam a mesma entrada: a campanha
   * nova abria com o sorteio, os confrontos e os classificados da anterior. É o
   * "às vezes exibe dados de outros campeonatos" do relato.
   *
   * `getCareerScopedKey` é o mecanismo que o resto do projeto já usa (save do
   * motor, notificações) exatamente por isso; esta tela guardava por fora dele.
   */
  const storageKey = getCareerScopedKey(`ultrafoot-competitions:${season}:${userTeamShort}`)
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
  }, [storageKey, userPosition])
  
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
    // OITAVAS REAIS 2026: na 1a temporada as oitavas usam os 16 classificados
    // reais. O usuario e garantido — se ja e um dos 16, mantem; senao entra no
    // lugar do ultimo. Fora de 2026, sorteio normal do pool.
    const reais2026 = season === 2026
      ? COPA_BRASIL_2026_OITAVAS.map(fk => getTeamByFileKey(fk)?.curto).filter((c): c is string => Boolean(c))
      : []

    let teams: string[]
    if (reais2026.length === 16) {
      teams = reais2026.includes(userTeamShort)
        ? reais2026
        : [userTeamShort, ...reais2026.filter(c => c !== userTeamShort)].slice(0, 16)
    } else {
      // Garante o usuario no sorteio SEM duplicar (se ele ja esta no pool, nao entra 2x).
      const base = copaBrasilPool.filter(c => c !== userTeamShort)
      teams = [userTeamShort, ...base].slice(0, 16)
    }
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
          penaltis: outcome.penalties,
          cobrancas: outcome.cobrancas,
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

    // GRUPO REAL 2026: na 1a temporada, se o clube do usuario esta no sorteio real
    // da Libertadores 2026, ele cai no seu grupo REAL com os adversarios certos.
    // Fora disso (outra temporada, ou clube fora do sorteio), sorteia do continente.
    const userFk = getTeamByShort(userTeamShort)?.file_key ?? ""
    // Continental unica: checa Libertadores E Sul-Americana; usa o grupo real em
    // que o clube do usuario esta (1a temporada 2026).
    let grpIdx = -1
    let grupoReal: string[] | null = null
    if (season === 2026) {
      grpIdx = LIBERTADORES_2026_GROUPS.findIndex(g => g.includes(userFk))
      if (grpIdx >= 0) grupoReal = LIBERTADORES_2026_GROUPS[grpIdx]
      else {
        grpIdx = SULAMERICANA_2026_GROUPS.findIndex(g => g.includes(userFk))
        if (grpIdx >= 0) grupoReal = SULAMERICANA_2026_GROUPS[grpIdx]
      }
    }

    let groupName: string
    let opponents: { short: string; country: string; points: number; played: number }[]

    if (grupoReal) {
      const reais = grupoReal
        .filter(fk => fk !== userFk)
        .map(fk => getTeamByFileKey(fk))
        .filter((t): t is Team => Boolean(t))
      groupName = "Grupo " + String.fromCharCode(65 + grpIdx)
      opponents = reais.map(t => ({ short: t.curto, country: t.pais || t.estado || "", points: 0, played: 0 }))
    } else {
      // Adversarios do CONTINENTE do clube (sorteio livre).
      const shuffled = [...continentalTeams].sort(() => Math.random() - 0.5).slice(0, 3)
      groupName = "Grupo " + String.fromCharCode(65 + Math.floor(Math.random() * 8))
      opponents = shuffled.map(t => ({ short: t.curto, country: t.pais || t.estado || "", points: 0, played: 0 }))
    }

    const group = {
      name: groupName,
      teams: [
        { short: userTeamShort, country: userCountry, points: 0, played: 0 },
        ...opponents,
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

// Seletor Classificacao | Artilheiros | Assistencias dentro de cada competicao.
function CompViewTabs({
  value,
  onChange,
}: {
  value: "classificacao" | "artilheiros" | "assistencias"
  onChange: (v: "classificacao" | "artilheiros" | "assistencias") => void
}) {
  const opts: { id: "classificacao" | "artilheiros" | "assistencias"; label: string }[] = [
    { id: "classificacao", label: "Classificação" },
    { id: "artilheiros", label: "Artilheiros" },
    { id: "assistencias", label: "Assistências" },
  ]
  return (
    <div className="mb-3 inline-flex rounded-lg border border-white/10 bg-[#141414] p-1">
      {opts.map(o => (
        <button
          key={o.id}
          onClick={() => onChange(o.id)}
          className={cn(
            "rounded-md px-3 py-1.5 text-xs font-semibold transition-colors",
            value === o.id ? "bg-[var(--brand)] text-[var(--brand-ink)]" : "text-white/50 hover:text-white/80",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

// Tabela de artilheiros/assistentes de uma competicao.
function ScorersTable({
  rows,
  userCurto,
  metric,
}: {
  rows: { name: string; teamShort: string; teamName: string; nat?: string; goals: number; assists: number; matches: number }[]
  userCurto: string
  metric: "goals" | "assists"
}) {
  const sorted = [...rows]
    .filter(r => r[metric] > 0)
    .sort((a, b) => b[metric] - a[metric] || (b.goals + b.assists) - (a.goals + a.assists))
    .slice(0, 20)
  if (sorted.length === 0) {
    return (
      <div className="rounded-xl border border-white/10 bg-[#1a1a1a] p-8 text-center text-sm text-white/40">
        Ainda não há {metric === "goals" ? "gols" : "assistências"} registrados nesta competição.
      </div>
    )
  }
  return (
    <div className="overflow-hidden rounded-xl border border-white/10 bg-[#1a1a1a]">
      <div className="grid grid-cols-[32px_1fr_36px_48px] items-center gap-3 border-b border-white/10 px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-white/40">
        <span>#</span>
        <span>Jogador</span>
        <span className="text-center">J</span>
        <span className="text-right">{metric === "goals" ? "Gols" : "Assist."}</span>
      </div>
      {sorted.map((r, i) => {
        const team = getTeamByShort(r.teamShort)
        const isUser = r.teamShort === userCurto
        return (
          <div
            key={`${r.teamShort}-${r.name}-${i}`}
            className={cn(
              "grid grid-cols-[32px_1fr_36px_48px] items-center gap-3 border-b border-white/5 px-4 py-2.5",
              isUser && "bg-[var(--brand)]/[0.06]",
            )}
          >
            <span className={cn("text-sm font-bold tabular-nums", i === 0 ? "text-amber-400" : "text-white/40")}>{i + 1}</span>
            <div className="flex min-w-0 items-center gap-2">
              {team ? <TeamCrest team={team} size="xs" /> : null}
              <div className="min-w-0">
                <div className={cn("truncate text-sm font-semibold", isUser ? "text-[var(--brand)]" : "text-white")}>{r.name}</div>
                <div className="truncate text-[10px] text-white/40">{r.teamName}</div>
              </div>
            </div>
            <span className="text-center text-sm tabular-nums text-white/50">{r.matches}</span>
            <span className="text-right text-base font-black tabular-nums text-white">{r[metric]}</span>
          </div>
        )
      })}
    </div>
  )
}

export default function CompeticoesPage() {
  const { team: userTeam } = useUserTeam()
  const { standings: gameStandings, currentWeek, currentSeason, userPosition, seasonCalendar } = useGameManager()
  const { squadPlayers, matchResults } = useGameEngine()
  const t = useTranslation()
  const router = useRouter()
  const [activeTab, setActiveTab] = useState("brasileirao")
  // Sub-visao de cada competicao: a classificacao OU os artilheiros/assistencias
  // DAQUELA competicao (pedido: ver o artilheiro dentro de Competicoes).
  const [compView, setCompView] = useState<"classificacao" | "artilheiros" | "assistencias">("classificacao")

  // Numeros REAIS do elenco do usuario nesta temporada (gols/assist), como na tela
  // de Estatisticas — o time do usuario entra com dado de verdade, nao atribuido.
  const userSquadStatsLive = useMemo(
    () => (squadPlayers ?? [])
      .filter(p => (p.seasonStats?.goals ?? 0) > 0 || (p.seasonStats?.assists ?? 0) > 0)
      .map(p => ({
        key: `${userTeam.curto}:${p.name}`, name: p.name, teamShort: userTeam.curto,
        teamName: userTeam.nome, nat: undefined as string | undefined,
        goals: p.seasonStats?.goals ?? 0, assists: p.seasonStats?.assists ?? 0,
        matches: p.seasonStats?.matchesPlayed ?? 0,
      })),
    [squadPlayers, userTeam.curto, userTeam.nome],
  )

  // Artilheiros/assistentes de um conjunto de clubes (uma competicao). Os gols dos
  // placares da CPU sao atribuidos aos jogadores REAIS de cada time por posicao
  // (deterministico); o time do usuario usa os numeros reais.
  const scorersFor = useMemo(() => (teamShorts: string[]) => {
    const doGrupo = new Set(teamShorts)
    doGrupo.add(userTeam.curto)
    const resultados = (matchResults ?? []).filter(m =>
      m.season === currentSeason && doGrupo.has(m.homeTeam) && doGrupo.has(m.awayTeam))
    return gerarEstatisticasCompeticao({
      resultados,
      squadDe: (short) => { const tm = getTeamByShort(short); return tm ? getPlayersForTeam(tm) : [] },
      nomeDe: (short) => getTeamByShort(short)?.nome ?? short,
      userShort: userTeam.curto,
      userRows: userSquadStatsLive,
    })
  }, [matchResults, currentSeason, userTeam.curto, userSquadStatsLive])
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

  const copaBrasilStateOficial = useMemo(
    () => copaBrasilDoCalendario(
      compState.copaBrasil,
      seasonCalendar.fixtures,
      userTeam.curto,
      currentSeason,
      getCountryCompetitions(userTeam.divisao).domesticCup,
      matchResults ?? [],
    ),
    [compState.copaBrasil, seasonCalendar.fixtures, userTeam.curto, userTeam.divisao, currentSeason, matchResults],
  )

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
  }, [gameStandings, userTeam.curto, userTeam.divisao])

  const serieBStandings = useMemo(() => generateStandings(serieBTeams, userTeam.curto), [userTeam.curto])

  // Competicoes do PAIS do clube. A tela era hardcoded em Brasil: quem jogava com o
  // Barcelona via "Copa do Brasil", "Paulistao" e "Libertadores".
  const countryComps = getCountryCompetitions(userTeam.divisao)
  const isBrazilian = countryComps.hasStateChampionship

  /**
   * SÓ AS COMPETIÇÕES QUE O CLUBE DISPUTA.
   *
   * As abas eram fixas: um clube da Série D via "Série B", e a aba continental
   * aparecia mesmo marcada "NÃO CLASSIFICADO" — competições que ele não joga,
   * ocupando espaço e sugerindo participação que não existe.
   *
   * A fonte é o CALENDÁRIO, não a configuração do país: o que o clube joga é,
   * literalmente, aquilo que está agendado para ele.
   */
  const competicoesDoClube = useMemo(() => {
    const minhas = seasonCalendar.fixtures.filter(f => f.isUserMatch)
    const tipos = new Set(minhas.map(f => f.competitionType))
    return {
      liga: tipos.has("league"),
      estadual: tipos.has("state"),
      copa: tipos.has("cup"),
      continental: tipos.has("continental"),
      // Nomes reais, para a aba dizer o que o técnico vai de fato disputar.
      // O fallback fica vazio de propósito: `continentalName` só é declarado
      // adiante, e lê-lo aqui cairia na TDZ — a mesma armadilha que já derrubou
      // a tela de partida ao vivo neste projeto. A aba só aparece quando há
      // fixture, e havendo fixture o nome vem dela.
      nomeDaCopa: minhas.find(f => f.competitionType === "cup")?.competition ?? countryComps.domesticCup,
      nomeContinental: minhas.find(f => f.competitionType === "continental")?.competition ?? "Continental",
    }
  }, [seasonCalendar.fixtures, countryComps.domesticCup])
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

  /**
   * FASE REAL DO CLUBE NA COPA NACIONAL.
   *
   * ⚠️ O card dizia "OITAVAS" para um clube da Serie D na PRIMEIRA FASE (relato
   * com print: "o time sendo de menor expressao entrando nas oitavas esta
   * errado").
   *
   * O regulamento no motor esta certo — `copaDoBrasil(entraTarde)` so manda para
   * a 5a fase quem e de primeira divisao; a Serie D comeca na 1a. O que mentia
   * era a TELA: o chaveamento desenhado aqui tem quatro colunas (oitavas ->
   * final) e `copaBrasilDoCalendario` COLAPSA 1a, 2a, 3a, 4a, 5a e oitavas todas
   * no primeiro espaco. Bom para desenhar a chave; pessimo como rotulo, porque
   * anuncia oitavas para quem esta a cinco fases delas.
   *
   * Aqui o rotulo sai do fixture do proprio clube, que e onde a fase de verdade
   * mora — o mesmo `faseDaPartida` que o calendario e a pre-partida usam.
   */
  const faseNaCopa = useMemo(() => {
    const minhasDaCopa = seasonCalendar.fixtures
      .filter(f => f.isUserMatch && f.competitionType === "cup"
        && f.competition.localeCompare(countryComps.domesticCup, undefined, { sensitivity: "base" }) === 0)
    if (minhasDaCopa.length === 0) return null
    // A que vale e a proxima por jogar; sem ela, a ultima disputada.
    const proxima = minhasDaCopa.find(f => !f.played) ?? minhasDaCopa[minhasDaCopa.length - 1]
    return faseDaPartida(proxima)?.label ?? null
  }, [seasonCalendar.fixtures, countryComps.domesticCup])

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
          // Fase do PROPRIO clube (ver `faseNaCopa`), nao o rotulo colapsado do
          // chaveamento de quatro colunas.
          : faseNaCopa
            ? faseNaCopa
            : compState.copaBrasil.drawn
              ? compState.copaBrasil.currentRound.charAt(0).toUpperCase() + compState.copaBrasil.currentRound.slice(1)
              : t.competitions.awaiting,
      userPosition: null,
      icon: Trophy,
      color: compState.copaBrasil.eliminated ? "text-red-400" : "text-[var(--brand)]",
      bgColor: compState.copaBrasil.eliminated ? "bg-red-400/10" : "bg-[var(--brand)]/10",
      borderColor: compState.copaBrasil.eliminated ? "border-red-400/30" : "border-[var(--brand)]/30"
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
      // ⚠️ QUEM TEM JOGO ESTA CLASSIFICADO. `compState.libertadores.qualified`
      // sai de `userPosition <= 4` — a posicao de AGORA na tabela. Um clube que
      // se classificou pela temporada passada e hoje esta em 5o veria
      // "NAO CLASSIFICADO" num card de competicao que ele disputa nesta semana.
      // O calendario e quem sabe: se ha fixture continental, ele esta dentro.
      status: competicoesDoClube.continental
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
      color: competicoesDoClube.continental
        ? compState.libertadores.eliminated ? "text-red-400" : "text-amber-400"
        : "text-white/30",
      bgColor: competicoesDoClube.continental
        ? compState.libertadores.eliminated ? "bg-red-400/10" : "bg-amber-400/10"
        : "bg-white/5",
      borderColor: competicoesDoClube.continental
        ? compState.libertadores.eliminated ? "border-red-400/30" : "border-amber-400/30"
        : "border-white/10"
    },
  // ⚠️ SO O QUE O CLUBE DISPUTA DE VERDADE (pedido: "a pagina de competicoes deve
  // exibir apenas competicoes que o time do usuario ira jogar").
  //
  // As ABAS ja usavam `competicoesDoClube` — derivado do CALENDARIO, que e a
  // unica fonte honesta do que o clube joga. Os CARDS do topo nao usavam: eles
  // eram uma lista fixa de quatro, e o filtro cobria so o estadual (para clube
  // de fora do Brasil). Resultado: um time da Serie D via o card da Libertadores
  // marcado "NAO CLASSIFICADO" ocupando um quarto da tela — anunciando uma
  // competicao que ele nao joga, com um rotulo que so existe para dizer isso.
  //
  // Agora os dois lados leem a mesma fonte. Sem fixture, sem card.
  ].filter(c => {
    if (c.id === "estadual") return isBrazilian && competicoesDoClube.estadual
    if (c.id === "copa-do-brasil") return competicoesDoClube.copa
    if (c.id === "libertadores") return competicoesDoClube.continental
    return true
  })

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
              <Calendar className="h-4 w-4 text-[var(--brand)]" />
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
                    ? "border-[var(--brand)] ring-1 ring-[var(--brand)]" 
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
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--brand)]/20 text-sm font-bold text-[var(--brand)]">
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
                {periodoLabelPorNome(comp.name, currentSeason) && (
                  <div className="mt-1 flex items-center gap-1.5 text-[11px] text-white/40">
                    <CalendarRange className="h-3 w-3" />
                    <span>{periodoLabelPorNome(comp.name, currentSeason)}</span>
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
            {/* A aba "Serie B" saiu: ela aparecia para TODO clube brasileiro,
                inclusive os que jogam a A, a C ou a D — uma competicao que o
                tecnico nao disputa. As demais so aparecem se houver partida
                agendada para o clube nelas. */}
            {competicoesDoClube.copa && (
              <TabsTrigger
                value="copa-do-brasil"
                className="text-xs data-[state=active]:bg-white/10 data-[state=active]:text-white text-white/50 px-4 py-2"
              >
                {competicoesDoClube.nomeDaCopa}
              </TabsTrigger>
            )}
            {competicoesDoClube.estadual && (
              <TabsTrigger
                value="estadual"
                className="text-xs data-[state=active]:bg-white/10 data-[state=active]:text-white text-white/50 px-4 py-2"
              >
                Estadual
              </TabsTrigger>
            )}
            {competicoesDoClube.continental && (
              <TabsTrigger
                value="libertadores"
                className="text-xs data-[state=active]:bg-white/10 data-[state=active]:text-white text-white/50 px-4 py-2"
              >
                {competicoesDoClube.nomeContinental}
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="brasileirao" className="mt-4">
            <CompViewTabs value={compView} onChange={setCompView} />
            {compView === "classificacao" ? (
              <StandingsTable standings={serieAStandings} userTeam={userTeam} division="serie_a" />
            ) : (
              <ScorersTable
                rows={scorersFor(serieAStandings.map(s => s.team.curto))}
                userCurto={userTeam.curto}
                metric={compView === "artilheiros" ? "goals" : "assists"}
              />
            )}
          </TabsContent>

          <TabsContent value="serie-b" className="mt-4">
            <CompViewTabs value={compView} onChange={setCompView} />
            {compView === "classificacao" ? (
              <StandingsTable standings={serieBStandings} userTeam={userTeam} division="serie_b" />
            ) : (
              <ScorersTable
                rows={scorersFor(serieBStandings.map(s => s.team.curto))}
                userCurto={userTeam.curto}
                metric={compView === "artilheiros" ? "goals" : "assists"}
              />
            )}
          </TabsContent>

          {/* ⚠️ O GATILHO da aba ja era escondido para quem nao disputa a copa,
              mas o CONTEUDO nao: bastava o `activeTab` cair em "copa-do-brasil"
              — pelo estado salvo, ou pelo LB/RB do controle, que percorre a
              lista de abas sem olhar quem esta disputando — para o chaveamento
              aparecer inteiro, com o botao de simular. Era o relato "a Copa do
              Brasil ainda aparece e deixa simular" num clube de Serie D. */}
          {competicoesDoClube.copa && (
          <TabsContent value="copa-do-brasil" className="mt-4">
            <CopaBracket
              userTeam={userTeam}
              state={copaBrasilStateOficial}
              onDraw={drawCopaBrasil}
              onSimulate={() => handleSimulateCopa(
                "Copa do Brasil",
                `${currentSeason}/${String(currentSeason + 1).slice(-2)}`
              )}
            />
          </TabsContent>
          )}

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
              fixtures={seasonCalendar.fixtures.filter(f =>
                f.competitionType === "continental" && f.competition === continentalName,
              )}
              season={currentSeason}
              resultados={matchResults ?? []}
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
  // Disputa de pênaltis aberta para assistir (de qualquer confronto da chave).
  const [disputaAberta, setDisputaAberta] = useState<{
    clubeA: { curto: string; nome: string }
    clubeB: { curto: string; nome: string }
    cobrancas: CobrancaPenalti[]
    placar: [number, number]
    vencedorCurto: string
  } | null>(null)
  const getTeamData = (short: string | null) => {
    if (!short) return null
    return getTeamByShort(short)
  }

  if (!state.drawn) {
    return (
      <div className="rounded-xl bg-[#0c0c10] border border-white/[0.04] p-12 text-center">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-[var(--brand)]/10 mx-auto mb-6">
          <Trophy className="h-10 w-10 text-[var(--brand)]" />
        </div>
        <h3 className="text-xl font-semibold text-white mb-2">{t.competitions.copaDoBrasil} 2026</h3>
        <p className="text-sm text-white/50 mb-6">
          Clique para realizar o sorteio das oitavas de final
        </p>
        <button
          onClick={onDraw}
          className="px-6 py-3 rounded-lg bg-[var(--brand)] text-[var(--brand-ink)] font-semibold hover:bg-[var(--brand-2)] transition-colors inline-flex items-center gap-2"
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

        // ELIMINADO não trava mais o mata-mata: antes o botão sumia quando o
        // usuário caía e a Copa ficava PRESA nas oitavas para sempre (relato). Agora
        // dá para continuar simulando os confrontos até sair o campeão — o usuário
        // só não está mais nele.
  const canSimulate = !state.champion

  return (
    <div className="rounded-xl bg-[#0c0c10] border border-white/[0.04] p-6 overflow-x-auto scrollbar-thin">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Trophy className="h-5 w-5 text-[var(--brand)]" />
          <h3 className="text-lg font-semibold text-white">{t.competitions.copaDoBrasil} 2026 - Mata-mata</h3>
        </div>

        {canSimulate && (
          <button
            onClick={onSimulate}
            className="px-4 py-2 rounded-lg bg-[var(--brand)] text-[var(--brand-ink)] font-medium text-sm hover:bg-[var(--brand-2)] transition-colors inline-flex items-center gap-2"
          >
            <Play className="h-4 w-4" />
            {state.eliminated ? "Simular até o campeão" : `${t.competitions.simulate} ${state.currentRound}`}
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
              round.isCurrent ? "text-[var(--brand)]" : "text-white/40",
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
                          ? "bg-[var(--brand)]/10 border-[var(--brand)]/30"
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
                        match.played && match.winner === match.team1 && "text-[var(--brand)]"
                      )}>
                        {match.team1 || t.competitions.toBeDefined}
                      </span>
                      <span className={cn(
                        "text-sm font-bold tabular-nums",
                        match.played && match.winner === match.team1 ? "text-[var(--brand)]" : "text-white/50"
                      )}>
                        {match.score1 ?? "-"}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      {team2 && <TeamCrest team={team2} size="xs" />}
                      <span className={cn(
                        "text-xs flex-1",
                        match.team2 === userTeam.curto && "font-bold text-white",
                        match.played && match.winner === match.team2 && "text-[var(--brand)]"
                      )}>
                        {match.team2 || t.competitions.toBeDefined}
                      </span>
                      <span className={cn(
                        "text-sm font-bold tabular-nums",
                        match.played && match.winner === match.team2 ? "text-[var(--brand)]" : "text-white/50"
                      )}>
                        {match.score2 ?? "-"}
                      </span>
                    </div>

                    {/* ASSISTIR AOS PÊNALTIS — inclusive de um confronto que não
                        é o seu. O placar da disputa já aparecia em silêncio; o
                        botão abre as cobranças, uma a uma. */}
                    {match.penaltis && match.cobrancas && match.cobrancas.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setDisputaAberta({
                          clubeA: { curto: match.team1, nome: getTeamData(match.team1)?.nome ?? match.team1 },
                          clubeB: { curto: match.team2, nome: getTeamData(match.team2)?.nome ?? match.team2 },
                          cobrancas: match.cobrancas!,
                          placar: match.penaltis!,
                          vencedorCurto: match.winner ?? match.team1,
                        })}
                        className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-md border border-white/10 py-1.5 text-[11px] text-white/50 transition-colors hover:border-[var(--brand)]/40 hover:text-white"
                      >
                        <PlayCircle className="h-3.5 w-3.5" />
                        Assistir pênaltis ({match.penaltis[0]}-{match.penaltis[1]})
                      </button>
                    )}
                    {match.penaltis && (!match.cobrancas || match.cobrancas.length === 0) && (
                      <div className="mt-2 rounded-md border border-amber-400/20 bg-amber-400/10 py-1.5 text-center text-[11px] font-semibold text-amber-300">
                        Decidido nos pênaltis: {match.penaltis[0]}-{match.penaltis[1]}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>

      {disputaAberta && (
        <PenaltisAlheiosModal
          aberto
          clubeA={disputaAberta.clubeA}
          clubeB={disputaAberta.clubeB}
          cobrancas={disputaAberta.cobrancas}
          placar={disputaAberta.placar}
          vencedorCurto={disputaAberta.vencedorCurto}
          onFechar={() => setDisputaAberta(null)}
        />
      )}

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
  fixtures,
  season,
  resultados,
}: {
  userTeam: Team
  state: CompetitionState["libertadores"]
  onDraw: () => void
  /** Competicao que o clube realmente disputa — nao e sempre a Libertadores. */
  competitionName: string
  fixtures: Fixture[]
  season: number
  /** Resultados do save: trazem o placar real das disputas de pênaltis. */
  resultados?: readonly EngineMatchResult[]
}) {
  const t = useTranslation()
  const groupFixtures = fixtures.filter(f => f.stage === "fase_grupos")
  const officialGroupShorts = Array.from(new Set(groupFixtures.flatMap(f => [f.homeTeam.curto, f.awayTeam.curto])))
  const hasOfficialCompetition = fixtures.length > 0

  if (!state.qualified && !hasOfficialCompetition) {
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

  if (!state.group && !hasOfficialCompetition) {
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

  const groupRows = officialGroupShorts.length > 0
    ? officialGroupShorts.map(short => {
        const games = groupFixtures.filter(f => f.played && (f.homeTeam.curto === short || f.awayTeam.curto === short))
        const points = games.reduce((total, f) => {
          const pro = f.homeTeam.curto === short ? (f.homeScore ?? 0) : (f.awayScore ?? 0)
          const against = f.homeTeam.curto === short ? (f.awayScore ?? 0) : (f.homeScore ?? 0)
          return total + (pro > against ? 3 : pro === against ? 1 : 0)
        }, 0)
        const team = getTeamByShort(short)
        return { short, country: team?.pais || team?.estado || "", points, played: games.length }
      }).sort((a, b) => b.points - a.points)
    : (state.group?.teams ?? [])

  return (
    <div className="rounded-xl bg-[#0c0c10] border border-white/[0.04] p-6">
      <div className="flex items-center gap-2 mb-6">
        <Globe className="h-5 w-5 text-amber-400" />
        <h3 className="text-lg font-semibold text-white">{competitionName} {season}</h3>
      </div>

      {groupRows.length > 0 && <div className="max-w-md">
        <div className="rounded-lg bg-amber-500/10 border border-amber-500/30 p-4">
          <h4 className="text-sm font-semibold text-amber-400 mb-3">{state.group?.name ?? "Fase de liga/grupos oficial"}</h4>
          <div className="space-y-2">
            {groupRows.map((team, idx) => {
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
      </div>}

      <OfficialKnockoutPath
        fixtures={fixtures}
        userCurto={userTeam.curto}
        competitionName={competitionName}
        season={season}
        resultados={resultados}
      />
    </div>
  )
}

/** Caminho real do clube em qualquer mata-mata continental. */
function OfficialKnockoutPath({
  fixtures,
  userCurto,
  competitionName,
  season,
  resultados = [],
}: {
  fixtures: Fixture[]
  userCurto: string
  competitionName: string
  season: number
  resultados?: readonly EngineMatchResult[]
}) {
  const stages = ["playoff", "oitavas", "quartas", "semifinal", "final"]
  const labels: Record<string, string> = {
    playoff: "Playoff", oitavas: "Oitavas de final", quartas: "Quartas de final",
    semifinal: "Semifinal", final: "Final",
  }
  const rounds = stages.map(stage => ({
    stage,
    games: fixtures.filter(f => f.stage === stage && f.isUserMatch).sort((a, b) => a.week - b.week || a.id - b.id),
  })).filter(round => round.games.length > 0)
  if (!rounds.length) return null

  return (
    <div className="mt-6 space-y-3 border-t border-white/10 pt-5">
      <h4 className="text-xs font-black uppercase tracking-wider text-amber-300">Mata-mata oficial</h4>
      {rounds.map(({ stage, games }) => {
        const rival = games[0].homeTeam.curto === userCurto ? games[0].awayTeam.curto : games[0].homeTeam.curto
        const played = games.filter(g => g.played && g.homeScore !== undefined && g.awayScore !== undefined)
        const complete = played.length === games.length
        const placares = played.map(g => {
          const euEmCasa = g.homeTeam.curto === userCurto
          const r = resultados.find(x =>
            x.season === season && x.week === g.week &&
            x.homeTeam === g.homeTeam.curto && x.awayTeam === g.awayTeam.curto,
          )
          return {
            golsPro: euEmCasa ? g.homeScore! : g.awayScore!,
            golsContra: euEmCasa ? g.awayScore! : g.homeScore!,
            penaltisPro: euEmCasa ? r?.homePenalties : r?.awayPenalties,
            penaltisContra: euEmCasa ? r?.awayPenalties : r?.homePenalties,
          }
        })
        const pro = placares.reduce((sum, score) => sum + score.golsPro, 0)
        const against = placares.reduce((sum, score) => sum + score.golsContra, 0)
        // O placar exibido é o MESMO que decidiu o confronto — antes era "5-4"
        // chumbado no código, para uma disputa que nunca acontecia.
        const decisao = complete ? resultadoDoConfronto(
          placares,
          games.length,
          `${userCurto}:${games[0].competitionId ?? competitionName}:${season}:${stage}`,
          getTeamByShort(userCurto)?.prestigio ?? 70,
          getTeamByShort(rival)?.prestigio ?? 70,
        ) : { passou: null, penaltis: null }
        const passed = decisao.passou
        const penalties = decisao.penaltis ? `${decisao.penaltis[0]}-${decisao.penaltis[1]}` : null
        return (
          <div key={stage} className="rounded-lg border border-white/10 bg-white/[0.025] p-4">
            <div className="mb-2 flex items-center justify-between gap-3">
              <span className="text-xs font-bold uppercase text-white/50">{labels[stage] ?? stage}</span>
              {complete && <span className={cn("text-xs font-bold", passed ? "text-emerald-400" : "text-red-400")}>
                {passed ? "Classificado" : "Eliminado"}
              </span>}
            </div>
            <div className="flex items-center gap-3 text-sm text-white">
              <span className="font-semibold">{getTeamByShort(userCurto)?.nome ?? userCurto}</span>
              <span className="rounded bg-black/40 px-2 py-1 font-black">{played.length ? `${pro} - ${against}` : "x"}</span>
              <span className="font-semibold">{getTeamByShort(rival)?.nome ?? rival}</span>
            </div>
            {games.length > 1 && <div className="mt-2 text-[11px] text-white/40">
              {played.map(g => `${siglaExibivel(g.homeTeam.curto, g.homeTeam.nome)} ${g.homeScore}-${g.awayScore} ${siglaExibivel(g.awayTeam.curto, g.awayTeam.nome)}`).join(" · ") || "Ida e volta ainda não disputadas"}
            </div>}
            {penalties && <div className="mt-2 text-xs font-semibold text-amber-300">Decidido nos pênaltis: {penalties}</div>}
          </div>
        )
      })}
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
                row.isUser && "bg-[var(--brand)]/10 border-l-2 border-[var(--brand)]"
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
              <span className="text-center text-sm tabular-nums text-[var(--brand)]">{row.won}</span>
              <span className="text-center text-sm tabular-nums text-white/50">{row.drawn}</span>
              <span className="text-center text-sm tabular-nums text-red-500">{row.lost}</span>
              <span className="text-center text-sm tabular-nums text-white/70">{row.goalsFor}</span>
              <span className="text-center text-sm tabular-nums text-white/70">{row.goalsAgainst}</span>
              <span className={cn(
                "text-center text-sm tabular-nums",
                row.goalDiff > 0 ? "text-[var(--brand)]" :
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
                      result === "W" ? "bg-[var(--brand)]/20 text-[var(--brand)]" :
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
