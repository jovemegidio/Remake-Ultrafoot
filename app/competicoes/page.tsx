"use client"

import { useState, useMemo, useEffect } from "react"
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
} from "lucide-react"
import { GameSidebar } from "@/components/game-sidebar"
import { GameHeader } from "@/components/game-header"
import { MusicPlayer } from "@/components/music-player"
import { TeamCrest } from "@/components/team-crest"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { getTeamByShort, serieATeams, serieBTeams, type Team } from "@/lib/teams-data"
import { useUserTeam } from "@/lib/save-system"
import { useGameManager } from "@/lib/use-game-manager"
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

// Times para estaduais
const ESTADUAL_TEAMS: Record<string, string[]> = {
  "Paulistao": ["COR", "PAL", "SAO", "SAN", "BGT", "GUA", "NOV", "MIR", "POR", "OSA", "ITA", "AGU", "FER", "BOT-SP", "PTE", "INT-LM"],
  "Carioca": ["FLA", "FLU", "VAS", "BOT", "FLG", "BAN", "MAC", "NOV-IG", "RES", "POR-RJ", "AUD", "MAD"],
  "Gaucho": ["GRE", "INT", "JUV", "CAX", "BRA-RS", "PEL", "PAS", "SAJ", "AIR", "GUA-RS", "NOV-HZ", "SAO-JO"],
  "Mineiro": ["CAM", "CRU", "AME", "COE", "UBE", "CAL", "DEM", "TOM", "PAT", "IPA", "POC", "AYM"],
}

// Times da Libertadores
const LIBERTADORES_TEAMS = [
  { short: "FLA", country: "Brasil" },
  { short: "PAL", country: "Brasil" },
  { short: "BOT", country: "Brasil" },
  { short: "FLU", country: "Brasil" },
  { short: "BOC", country: "Argentina" },
  { short: "RIV", country: "Argentina" },
  { short: "RAC", country: "Argentina" },
  { short: "SLO", country: "Argentina" },
  { short: "PEN", country: "Uruguai" },
  { short: "NAC", country: "Uruguai" },
  { short: "UCH", country: "Chile" },
  { short: "COL", country: "Chile" },
  { short: "ACI", country: "Bolivia" },
  { short: "BOL", country: "Bolivia" },
  { short: "CER", country: "Paraguai" },
  { short: "OLI", country: "Paraguai" },
  { short: "ALI", country: "Peru" },
  { short: "UNI", country: "Peru" },
  { short: "LDQ", country: "Equador" },
  { short: "BSC", country: "Equador" },
  { short: "MIL", country: "Colombia" },
  { short: "NAL", country: "Colombia" },
  { short: "DEP", country: "Venezuela" },
  { short: "CAR", country: "Venezuela" },
]

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

// Hook para gerenciar estado das competicoes
function useCompetitions(userTeamShort: string, userPosition: number) {
  const [state, setState] = useState<CompetitionState>(() => {
    // Tenta carregar do localStorage
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("ultrafoot-competitions")
      if (saved) {
        try {
          return JSON.parse(saved)
        } catch {}
      }
    }
    
    return {
      copaBrasil: {
        currentRound: "oitavas",
        oitavas: [],
        quartas: [],
        semis: [],
        final: [],
        drawn: false,
        eliminated: false,
        champion: null,
      },
      estadual: {
        phase: "grupos",
        groups: [],
        semis: [],
        final: [],
        drawn: false,
        eliminated: false,
        champion: null,
      },
      libertadores: {
        qualified: userPosition <= 4,
        currentRound: "grupos",
        group: null,
        bracket: [],
        eliminated: false,
        champion: null,
      },
      sulamericana: {
        qualified: userPosition > 4 && userPosition <= 6,
        currentRound: "grupos",
        group: null,
        eliminated: false,
      },
    }
  })
  
  // Salvar no localStorage
  useEffect(() => {
    localStorage.setItem("ultrafoot-competitions", JSON.stringify(state))
  }, [state])
  
  // Sortear Copa do Brasil
  const drawCopaBrasil = () => {
    const teams = ["FLA", "COR", "PAL", "SAO", "GRE", "INT", "BOT", "CAM", 
                   userTeamShort, "FLU", "FOR", "CRU", "BAH", "VAS", "CAP", "SAN"]
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
  
  // Simular jogos da Copa do Brasil
  const simulateCopaBrasilRound = () => {
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
      
      // Simular todas as partidas da rodada atual
      const simulatedMatches = currentMatches.map(match => {
        if (match.played) return match
        
        const [score1, score2] = simulateMatch(50, 50)
        let winner = score1 > score2 ? match.team1 : score1 < score2 ? match.team2 : null
        
        // Empate? Penaltis (aleatorio)
        if (!winner) {
          winner = Math.random() > 0.5 ? match.team1 : match.team2
        }
        
        return {
          ...match,
          score1,
          score2,
          played: true,
          winner,
        }
      })
      
      // Verificar se usuario foi eliminado
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
      if (copa.currentRound === "final" && simulatedMatches[0].played) {
        champion = simulatedMatches[0].winner
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
  }
  
  // Sortear Estadual
  const drawEstadual = () => {
    // Detectar estadual do usuario
    let estadualName = "Paulistao"
    let estadualTeams = ESTADUAL_TEAMS["Paulistao"]
    
    if (["FLA", "FLU", "VAS", "BOT"].includes(userTeamShort)) {
      estadualName = "Carioca"
      estadualTeams = ESTADUAL_TEAMS["Carioca"]
    } else if (["GRE", "INT", "JUV"].includes(userTeamShort)) {
      estadualName = "Gaucho"
      estadualTeams = ESTADUAL_TEAMS["Gaucho"]
    } else if (["CAM", "CRU", "AME"].includes(userTeamShort)) {
      estadualName = "Mineiro"
      estadualTeams = ESTADUAL_TEAMS["Mineiro"]
    }
    
    // Garantir que o time do usuario esta no estadual
    if (!estadualTeams.includes(userTeamShort)) {
      estadualTeams = [userTeamShort, ...estadualTeams.slice(0, 15)]
    }
    
    const shuffled = [...estadualTeams].sort(() => Math.random() - 0.5)
    
    // Criar 4 grupos de 4 times
    const groups = [
      { name: "Grupo A", teams: shuffled.slice(0, 4).map(t => ({ short: t, points: 0, played: 0 })) },
      { name: "Grupo B", teams: shuffled.slice(4, 8).map(t => ({ short: t, points: 0, played: 0 })) },
      { name: "Grupo C", teams: shuffled.slice(8, 12).map(t => ({ short: t, points: 0, played: 0 })) },
      { name: "Grupo D", teams: shuffled.slice(12, 16).map(t => ({ short: t, points: 0, played: 0 })) },
    ]
    
    setState(s => ({
      ...s,
      estadual: {
        ...s.estadual,
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
  
  // Sortear Libertadores
  const drawLibertadores = () => {
    if (!state.libertadores.qualified) return
    
    // Criar grupo com o time do usuario
    const availableTeams = LIBERTADORES_TEAMS.filter(t => t.short !== userTeamShort)
    const shuffled = availableTeams.sort(() => Math.random() - 0.5).slice(0, 3)
    
    const group = {
      name: "Grupo " + String.fromCharCode(65 + Math.floor(Math.random() * 8)),
      teams: [
        { short: userTeamShort, country: "Brasil", points: 0, played: 0 },
        ...shuffled.map(t => ({ ...t, points: 0, played: 0 })),
      ]
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
  const { standings: gameStandings, currentWeek, currentSeason, userPosition } = useGameManager()
  const [activeTab, setActiveTab] = useState("brasileirao")
  
  const {
    state: compState,
    drawCopaBrasil,
    simulateCopaBrasilRound,
    drawEstadual,
    simulateEstadualGroups,
    drawLibertadores,
  } = useCompetitions(userTeam.curto, userPosition)

  // Converte standings do game engine para o formato da tabela
  const serieAStandings = useMemo(() => {
    if (gameStandings.length === 0) {
      return generateStandings(serieATeams, userTeam.curto)
    }
    
    return gameStandings.map((entry, index) => ({
      position: index + 1,
      team: getTeamByShort(entry.teamShort) || serieATeams[0],
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

  const competitions = [
    { 
      id: "brasileirao", 
      name: "Brasileirao Serie A", 
      type: "Liga", 
      teams: 20, 
      status: currentWeek > 0 ? "Em andamento" : "A iniciar",
      userPosition: userPosition > 0 ? userPosition : null,
      icon: Trophy,
      color: "text-yellow-500",
      bgColor: "bg-yellow-500/10",
      borderColor: "border-yellow-500/30"
    },
    { 
      id: "copa-do-brasil", 
      name: "Copa do Brasil", 
      type: "Copa", 
      teams: 16, 
      status: compState.copaBrasil.champion 
        ? `Campeao: ${compState.copaBrasil.champion}`
        : compState.copaBrasil.eliminated 
          ? "Eliminado" 
          : compState.copaBrasil.drawn 
            ? compState.copaBrasil.currentRound.charAt(0).toUpperCase() + compState.copaBrasil.currentRound.slice(1)
            : "Aguardando sorteio",
      userPosition: null,
      icon: Trophy,
      color: compState.copaBrasil.eliminated ? "text-red-400" : "text-[#1db954]",
      bgColor: compState.copaBrasil.eliminated ? "bg-red-400/10" : "bg-[#1db954]/10",
      borderColor: compState.copaBrasil.eliminated ? "border-red-400/30" : "border-[#1db954]/30"
    },
    { 
      id: "estadual", 
      name: "Campeonato Estadual", 
      type: "Estadual", 
      teams: 16, 
      status: compState.estadual.champion
        ? `Campeao: ${compState.estadual.champion}`
        : compState.estadual.eliminated
          ? "Eliminado"
          : compState.estadual.drawn
            ? compState.estadual.phase.charAt(0).toUpperCase() + compState.estadual.phase.slice(1)
            : "Aguardando sorteio",
      userPosition: null,
      icon: MapPin,
      color: compState.estadual.eliminated ? "text-red-400" : "text-orange-400",
      bgColor: compState.estadual.eliminated ? "bg-red-400/10" : "bg-orange-400/10",
      borderColor: compState.estadual.eliminated ? "border-red-400/30" : "border-orange-400/30"
    },
    { 
      id: "libertadores", 
      name: "Copa Libertadores", 
      type: "Continental", 
      teams: 32, 
      status: compState.libertadores.qualified
        ? compState.libertadores.champion
          ? `Campeao: ${compState.libertadores.champion}`
          : compState.libertadores.eliminated
            ? "Eliminado"
            : compState.libertadores.group
              ? "Fase de Grupos"
              : "Classificado"
        : "Nao classificado",
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
  ]

  return (
    <div className="h-screen pl-16 bg-[#0a0a0a] flex flex-col overflow-hidden">
      <GameSidebar />
      <GameHeader team={userTeam} />

      <main className="flex-1 p-4 overflow-y-auto scrollbar-premium space-y-4">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-white tracking-tight">Competicoes</h1>
            <p className="text-sm text-white/50 mt-1">Temporada {currentSeason} - Acompanhe suas competicoes</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#141414] border border-white/5">
              <Calendar className="h-4 w-4 text-[#1db954]" />
              <span className="text-sm text-white/70">Rodada {currentWeek}/38</span>
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
                  "rounded-xl bg-[#141414] border p-5 text-left transition-all",
                  isActive 
                    ? "border-[#1db954] ring-1 ring-[#1db954]" 
                    : "border-white/5 hover:border-white/10"
                )}
              >
                <div className="flex items-start justify-between">
                  <div className={cn(
                    "flex h-10 w-10 items-center justify-center rounded-lg",
                    comp.bgColor
                  )}>
                    <Icon className={cn("h-5 w-5", comp.color)} />
                  </div>
                  {comp.userPosition && (
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#1db954]/20 text-sm font-bold text-[#1db954]">
                      {comp.userPosition}
                    </span>
                  )}
                </div>
                <h3 className="mt-4 font-semibold text-white text-sm">{comp.name}</h3>
                <div className="mt-1 flex items-center gap-2 text-xs text-white/50">
                  <span>{comp.type}</span>
                  <span className="text-white/20">|</span>
                  <Users className="h-3 w-3" />
                  <span>{comp.teams} times</span>
                </div>
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
            <TabsTrigger 
              value="brasileirao" 
              className="text-xs data-[state=active]:bg-white/10 data-[state=active]:text-white text-white/50 px-4 py-2"
            >
              Serie A
            </TabsTrigger>
            <TabsTrigger 
              value="serie-b" 
              className="text-xs data-[state=active]:bg-white/10 data-[state=active]:text-white text-white/50 px-4 py-2"
            >
              Serie B
            </TabsTrigger>
            <TabsTrigger 
              value="copa-do-brasil" 
              className="text-xs data-[state=active]:bg-white/10 data-[state=active]:text-white text-white/50 px-4 py-2"
            >
              Copa do Brasil
            </TabsTrigger>
            <TabsTrigger 
              value="estadual" 
              className="text-xs data-[state=active]:bg-white/10 data-[state=active]:text-white text-white/50 px-4 py-2"
            >
              Estadual
            </TabsTrigger>
            <TabsTrigger 
              value="libertadores" 
              className="text-xs data-[state=active]:bg-white/10 data-[state=active]:text-white text-white/50 px-4 py-2"
            >
              Libertadores
            </TabsTrigger>
          </TabsList>

          <TabsContent value="brasileirao" className="mt-4">
            <StandingsTable standings={serieAStandings} userTeam={userTeam} />
          </TabsContent>

          <TabsContent value="serie-b" className="mt-4">
            <StandingsTable standings={serieBStandings} userTeam={userTeam} />
          </TabsContent>

          <TabsContent value="copa-do-brasil" className="mt-4">
            <CopaBracket 
              userTeam={userTeam} 
              state={compState.copaBrasil}
              onDraw={drawCopaBrasil}
              onSimulate={simulateCopaBrasilRound}
            />
          </TabsContent>

          <TabsContent value="estadual" className="mt-4">
            <EstadualView
              userTeam={userTeam}
              state={compState.estadual}
              onDraw={drawEstadual}
              onSimulateGroups={simulateEstadualGroups}
            />
          </TabsContent>

          <TabsContent value="libertadores" className="mt-4">
            <LibertadoresView
              userTeam={userTeam}
              state={compState.libertadores}
              onDraw={drawLibertadores}
            />
          </TabsContent>
        </Tabs>
      </main>

      <MusicPlayer />
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
  const getTeamData = (short: string | null) => {
    if (!short) return null
    return getTeamByShort(short)
  }

  if (!state.drawn) {
    return (
      <div className="rounded-xl bg-[#141414] border border-white/5 p-12 text-center">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-[#1db954]/10 mx-auto mb-6">
          <Trophy className="h-10 w-10 text-[#1db954]" />
        </div>
        <h3 className="text-xl font-semibold text-white mb-2">Copa do Brasil 2026</h3>
        <p className="text-sm text-white/50 mb-6">
          Clique para realizar o sorteio das oitavas de final
        </p>
        <button
          onClick={onDraw}
          className="px-6 py-3 rounded-lg bg-[#1db954] text-black font-semibold hover:bg-[#1ed760] transition-colors inline-flex items-center gap-2"
        >
          <Shuffle className="h-4 w-4" />
          Sortear Chaves
        </button>
      </div>
    )
  }

  const allRounds = [
    { name: "Oitavas", matches: state.oitavas, isCurrent: state.currentRound === "oitavas" },
    { name: "Quartas", matches: state.quartas, isCurrent: state.currentRound === "quartas" },
    { name: "Semifinal", matches: state.semis, isCurrent: state.currentRound === "semis" },
    { name: "Final", matches: state.final, isCurrent: state.currentRound === "final" },
  ]

  const canSimulate = !state.champion && !state.eliminated

  return (
    <div className="rounded-xl bg-[#141414] border border-white/5 p-6 overflow-x-auto scrollbar-thin">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Trophy className="h-5 w-5 text-[#1db954]" />
          <h3 className="text-lg font-semibold text-white">Copa do Brasil 2026 - Mata-mata</h3>
        </div>
        
        {canSimulate && (
          <button
            onClick={onSimulate}
            className="px-4 py-2 rounded-lg bg-[#1db954] text-black font-medium text-sm hover:bg-[#1ed760] transition-colors inline-flex items-center gap-2"
          >
            <Play className="h-4 w-4" />
            Simular {state.currentRound}
          </button>
        )}
        
        {state.champion && (
          <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-yellow-500/20 border border-yellow-500/30">
            <Crown className="h-4 w-4 text-yellow-500" />
            <span className="text-sm font-semibold text-yellow-500">
              Campeao: {state.champion}
            </span>
          </div>
        )}
      </div>

      <div className="flex gap-6 min-w-[1000px]">
        {allRounds.map((round, roundIndex) => (
          <div key={round.name} className="flex-1">
            <div className={cn(
              "text-xs uppercase tracking-wider mb-3 text-center font-medium",
              round.isCurrent ? "text-[#1db954]" : "text-white/40",
              round.name === "Final" && "text-yellow-500"
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
                          ? "bg-[#1db954]/10 border-[#1db954]/30"
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
                        match.played && match.winner === match.team1 && "text-[#1db954]"
                      )}>
                        {match.team1 || "A definir"}
                      </span>
                      <span className={cn(
                        "text-sm font-bold tabular-nums",
                        match.played && match.winner === match.team1 ? "text-[#1db954]" : "text-white/50"
                      )}>
                        {match.score1 ?? "-"}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      {team2 && <TeamCrest team={team2} size="xs" />}
                      <span className={cn(
                        "text-xs flex-1",
                        match.team2 === userTeam.curto && "font-bold text-white",
                        match.played && match.winner === match.team2 && "text-[#1db954]"
                      )}>
                        {match.team2 || "A definir"}
                      </span>
                      <span className={cn(
                        "text-sm font-bold tabular-nums",
                        match.played && match.winner === match.team2 ? "text-[#1db954]" : "text-white/50"
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
          <p className="text-sm text-red-400">Voce foi eliminado da Copa do Brasil</p>
        </div>
      )}
    </div>
  )
}

// Estadual View
function EstadualView({
  userTeam,
  state,
  onDraw,
  onSimulateGroups,
}: {
  userTeam: Team
  state: CompetitionState["estadual"]
  onDraw: () => void
  onSimulateGroups: () => void
}) {
  if (!state.drawn) {
    return (
      <div className="rounded-xl bg-[#141414] border border-white/5 p-12 text-center">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-orange-400/10 mx-auto mb-6">
          <MapPin className="h-10 w-10 text-orange-400" />
        </div>
        <h3 className="text-xl font-semibold text-white mb-2">Campeonato Estadual 2026</h3>
        <p className="text-sm text-white/50 mb-6">
          Clique para realizar o sorteio dos grupos
        </p>
        <button
          onClick={onDraw}
          className="px-6 py-3 rounded-lg bg-orange-500 text-white font-semibold hover:bg-orange-600 transition-colors inline-flex items-center gap-2"
        >
          <Shuffle className="h-4 w-4" />
          Sortear Grupos
        </button>
      </div>
    )
  }

  return (
    <div className="rounded-xl bg-[#141414] border border-white/5 p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <MapPin className="h-5 w-5 text-orange-400" />
          <h3 className="text-lg font-semibold text-white">Campeonato Estadual 2026</h3>
        </div>
        
        {state.phase === "grupos" && !state.groups[0].teams[0].played && (
          <button
            onClick={onSimulateGroups}
            className="px-4 py-2 rounded-lg bg-orange-500 text-white font-medium text-sm hover:bg-orange-600 transition-colors inline-flex items-center gap-2"
          >
            <Play className="h-4 w-4" />
            Simular Fase de Grupos
          </button>
        )}
      </div>

      {/* Grupos */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {state.groups.map((group) => {
          const userInGroup = group.teams.some(t => t.short === userTeam.curto)
          
          return (
            <div 
              key={group.name}
              className={cn(
                "rounded-lg border p-4",
                userInGroup ? "bg-orange-500/10 border-orange-500/30" : "bg-white/5 border-white/10"
              )}
            >
              <h4 className="text-sm font-semibold text-white mb-3">{group.name}</h4>
              <div className="space-y-2">
                {group.teams.map((team, idx) => {
                  const teamData = getTeamByShort(team.short)
                  const isUser = team.short === userTeam.curto
                  const qualified = idx === 0 && team.played > 0
                  
                  return (
                    <div 
                      key={team.short}
                      className={cn(
                        "flex items-center gap-2 p-2 rounded",
                        isUser && "bg-orange-500/20",
                        qualified && !isUser && "bg-[#1db954]/10"
                      )}
                    >
                      <span className="text-xs text-white/50 w-4">{idx + 1}.</span>
                      {teamData && <TeamCrest team={teamData} size="xs" />}
                      <span className={cn(
                        "text-xs flex-1",
                        isUser && "font-bold text-white"
                      )}>
                        {team.short}
                      </span>
                      <span className="text-xs text-white/50">{team.played}J</span>
                      <span className="text-xs font-bold text-white">{team.points}pts</span>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>

      {state.eliminated && (
        <div className="mt-6 p-4 rounded-lg bg-red-500/10 border border-red-500/30 text-center">
          <X className="h-6 w-6 text-red-500 mx-auto mb-2" />
          <p className="text-sm text-red-400">Voce foi eliminado do Estadual na fase de grupos</p>
        </div>
      )}
    </div>
  )
}

// Libertadores View
function LibertadoresView({
  userTeam,
  state,
  onDraw,
}: {
  userTeam: Team
  state: CompetitionState["libertadores"]
  onDraw: () => void
}) {
  if (!state.qualified) {
    return (
      <div className="rounded-xl bg-[#141414] border border-white/5 p-12 text-center">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-white/5 mx-auto mb-6">
          <Globe className="h-10 w-10 text-white/30" />
        </div>
        <h3 className="text-xl font-semibold text-white mb-2">Copa Libertadores 2026</h3>
        <p className="text-sm text-white/50 mb-6">
          Termine entre os 4 primeiros no Brasileirao para se classificar
        </p>
        <div className="text-xs text-white/30">
          Posicao atual: {state.qualified ? "Classificado" : "Nao classificado"}
        </div>
      </div>
    )
  }

  if (!state.group) {
    return (
      <div className="rounded-xl bg-[#141414] border border-white/5 p-12 text-center">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-amber-400/10 mx-auto mb-6">
          <Globe className="h-10 w-10 text-amber-400" />
        </div>
        <h3 className="text-xl font-semibold text-white mb-2">Copa Libertadores 2026</h3>
        <p className="text-sm text-white/50 mb-6">
          Voce esta classificado! Clique para ver seu grupo
        </p>
        <button
          onClick={onDraw}
          className="px-6 py-3 rounded-lg bg-amber-500 text-black font-semibold hover:bg-amber-400 transition-colors inline-flex items-center gap-2"
        >
          <Shuffle className="h-4 w-4" />
          Sortear Grupo
        </button>
      </div>
    )
  }

  return (
    <div className="rounded-xl bg-[#141414] border border-white/5 p-6">
      <div className="flex items-center gap-2 mb-6">
        <Globe className="h-5 w-5 text-amber-400" />
        <h3 className="text-lg font-semibold text-white">Copa Libertadores 2026 - {state.group.name}</h3>
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
  userTeam 
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
}) {
  return (
    <div className="rounded-xl bg-[#141414] border border-white/5 overflow-hidden">
      {/* Header */}
      <div className="grid grid-cols-[40px_1fr_40px_40px_40px_40px_50px_50px_50px_60px_100px] gap-2 px-4 py-3 text-[10px] font-medium tracking-widest text-white/40 uppercase border-b border-white/5 bg-white/[0.02]">
        <span className="text-center">#</span>
        <span>Clube</span>
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
        {standings.map((row) => (
          <div
            key={row.team.curto}
            className={cn(
              "grid grid-cols-[40px_1fr_40px_40px_40px_40px_50px_50px_50px_60px_100px] gap-2 px-4 py-3 items-center transition-colors hover:bg-white/[0.02]",
              row.isUser && "bg-[#1db954]/10 border-l-2 border-[#1db954]"
            )}
          >
            <span className={cn(
              "text-center text-sm font-medium",
              row.position <= 4 ? "text-[#1db954]" :
              row.position <= 6 ? "text-blue-400" :
              row.position >= 17 ? "text-red-500" :
              "text-white/50"
            )}>
              {row.position}
            </span>
            
            <div className="flex items-center gap-2 min-w-0">
              <TeamCrest team={row.team} size="sm" />
              <span className={cn(
                "truncate text-sm",
                row.isUser ? "font-semibold text-white" : "text-white/80"
              )}>
                {row.team.nome}
              </span>
              {row.isUser && <Star className="h-3 w-3 text-yellow-500 shrink-0" />}
            </div>

            <span className="text-center text-sm tabular-nums text-white/70">{row.played}</span>
            <span className="text-center text-sm tabular-nums text-[#1db954]">{row.won}</span>
            <span className="text-center text-sm tabular-nums text-white/50">{row.drawn}</span>
            <span className="text-center text-sm tabular-nums text-red-500">{row.lost}</span>
            <span className="text-center text-sm tabular-nums text-white/70">{row.goalsFor}</span>
            <span className="text-center text-sm tabular-nums text-white/70">{row.goalsAgainst}</span>
            <span className={cn(
              "text-center text-sm tabular-nums",
              row.goalDiff > 0 ? "text-[#1db954]" :
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
                    result === "W" ? "bg-[#1db954]/20 text-[#1db954]" :
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
        ))}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-6 px-4 py-3 text-[10px] text-white/50 border-t border-white/5 bg-white/[0.02]">
        <div className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-[#1db954]" />
          <span>Libertadores</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-blue-400" />
          <span>Sul-Americana</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-red-500" />
          <span>Rebaixamento</span>
        </div>
      </div>
    </div>
  )
}
