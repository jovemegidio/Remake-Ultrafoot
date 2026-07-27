"use client"

import { useState, useMemo, useEffect } from "react"
import {
  Trophy,
  Target,
  Footprints,
  AlertTriangle,
  Star,
  TrendingUp,
  Award,
  Users,
  Shirt,
  ChevronLeft,
  ChevronRight,
  CornerDownLeft,
} from "lucide-react"
import { GameHeader } from "@/components/game-header"
import { TeamCrest } from "@/components/team-crest"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { getTeamByShort, type Team } from "@/lib/teams-data"
import { getPlayersForTeam } from "@/lib/players-data"
import { gerarEstatisticasCompeticao } from "@/lib/competition-scorers"
import { useRouter } from "next/navigation"
import { useUserTeam } from "@/lib/save-system"
import { useGameEngine } from "@/lib/game-engine"
import { useGameManager, getLeagueName } from "@/lib/use-game-manager"
import { cn } from "@/lib/utils"

// Nacionalidade padrao por jogador conhecido (ISO-2). Default: br
const PLAYER_NATIONALITY: Record<string, string> = {
  Endrick: "br", Arrascaeta: "uy", "German Cano": "ar", "Juan Dinenno": "ar",
  Vegetti: "ar", Hulk: "br",
}
function flagUrl(code: string) {
  return `https://flagcdn.com/h20/${code}.png`
}

export default function EstatisticasPage() {
  const { team: userTeam } = useUserTeam()
  const { squadPlayers, matchResults, currentSeason } = useGameEngine()
  const { standings } = useGameManager()
  const router = useRouter()
  const [activeTab, setActiveTab] = useState("artilheiros")
  const estatTabsOrder = ["artilheiros", "assistencias", "clean", "amarelos", "vermelhos", "notas"]

  useEffect(() => {
    const handler = (e: Event) => {
      const btn = (e as CustomEvent).detail?.button
      if (!btn) return
      if (btn === "B") { router.back(); return }
      if (btn === "LB") setActiveTab(t => estatTabsOrder[Math.max(0, estatTabsOrder.indexOf(t) - 1)])
      if (btn === "RB") setActiveTab(t => estatTabsOrder[Math.min(estatTabsOrder.length - 1, estatTabsOrder.indexOf(t) + 1)])
    }
    window.addEventListener("gamepad:button", handler)
    return () => window.removeEventListener("gamepad:button", handler)
  }, [router, activeTab])

  // Calcula estatisticas do elenco baseado nos dados do game engine
  const userSquadStatsLive = useMemo(() => {
    return squadPlayers.map(p => ({
      id: p.id,
      name: p.name,
      position: p.position,
      matches: p.seasonStats.matchesPlayed,
      goals: p.seasonStats.goals,
      assists: p.seasonStats.assists,
      yellows: p.seasonStats.yellowCards,
      reds: p.seasonStats.redCards,
      rating: 7.0 + (p.seasonStats.goals * 0.1) + (p.seasonStats.assists * 0.05),
      cleanSheets: p.seasonStats.cleanSheets
    })).sort((a, b) => (b.goals + b.assists) - (a.goals + a.assists))
  }, [squadPlayers])

  // Calcula estatisticas do time
  const userTeamStatsLive = useMemo(() => {
    const userMatches = matchResults.filter(
      m => m.homeTeam === userTeam.curto || m.awayTeam === userTeam.curto
    )
    
    let goalsScored = 0
    let goalsConceded = 0
    let wins = 0
    let draws = 0
    let losses = 0
    let cleanSheets = 0
    
    userMatches.forEach(m => {
      const isHome = m.homeTeam === userTeam.curto
      const scored = isHome ? m.homeScore : m.awayScore
      const conceded = isHome ? m.awayScore : m.homeScore
      
      goalsScored += scored
      goalsConceded += conceded
      
      if (conceded === 0) cleanSheets++
      
      if (scored > conceded) wins++
      else if (scored < conceded) losses++
      else draws++
    })
    
    return {
      goalsScored,
      goalsConceded,
      cleanSheets,
      wins,
      draws,
      losses,
      possession: 52,
      passAccuracy: 78,
      shotsPerGame: 12.4,
      tackles: 186,
      fouls: 142,
      corners: 89,
    }
  }, [matchResults, userTeam.curto])

  interface StatRow {
    pos: number
    name: string
    team: string
    matches: number
    isUser?: boolean
    nat?: string
    valueStr: string
  }
  // Tabelas construidas a partir do elenco REAL do usuario (seasonStats do game-engine).
  // A artilharia da liga inteira exigiria rastrear goleadores da CPU, que o motor ainda nao
  // guarda (calcTopScorers retorna []); entao mostramos os numeros REAIS do seu time em vez
  // da lista fixa de "Gabigol/Endrick" que aparecia antes.
  const userCurto = userTeam.curto

  // ARTILHARIA/ASSISTENCIAS da COMPETICAO INTEIRA. Os gols da CPU sao atribuidos
  // a jogadores plausiveis de cada time (ver lib/competition-scorers); o time do
  // usuario entra com os numeros REAIS. Cartoes/notas seguem so do usuario — sao
  // dados que o motor rastreia de verdade, sem chute.
  const compRows = useMemo(() => {
    const daLiga = new Set(standings.map(s => s.teamShort))
    daLiga.add(userTeam.curto)
    const resultados = matchResults.filter(m =>
      m.season === currentSeason && daLiga.has(m.homeTeam) && daLiga.has(m.awayTeam))
    const userRows = userSquadStatsLive
      .filter(p => p.goals > 0 || p.assists > 0)
      .map(p => ({ key: `${userTeam.curto}:${p.name}`, name: p.name, teamShort: userTeam.curto, teamName: userTeam.nome, nat: undefined, goals: p.goals, assists: p.assists, matches: p.matches }))
    return gerarEstatisticasCompeticao({
      resultados,
      squadDe: (short) => { const t = getTeamByShort(short); return t ? getPlayersForTeam(t) : [] },
      nomeDe: (short) => getTeamByShort(short)?.nome ?? short,
      userShort: userTeam.curto,
      userRows,
    })
  }, [standings, matchResults, currentSeason, userSquadStatsLive, userTeam.curto, userTeam.nome])

  const rowsComp = (pick: "goals" | "assists"): StatRow[] =>
    compRows
      .filter(r => r[pick] > 0)
      .sort((a, b) => b[pick] - a[pick] || b.goals + b.assists - (a.goals + a.assists))
      .slice(0, 25)
      .map((r, i) => ({ pos: i + 1, name: r.name, team: r.teamShort, matches: r.matches, isUser: r.teamShort === userCurto, nat: r.nat, valueStr: String(r[pick]) }))

  const mkRows = (pick: (p: (typeof userSquadStatsLive)[number]) => number): StatRow[] =>
    userSquadStatsLive
      .filter((p) => pick(p) > 0)
      .sort((a, b) => pick(b) - pick(a))
      .slice(0, 20)
      .map((p, i) => ({ pos: i + 1, name: p.name, team: userCurto, matches: p.matches, isUser: true, valueStr: String(pick(p)) }))
  const cats: { id: string; label: string; statLabel: string; rows: StatRow[] }[] = [
    { id: "artilheiros", label: "Artilheiros", statLabel: "Gols", rows: rowsComp("goals") },
    { id: "assistencias", label: "Assistências", statLabel: "Assistências", rows: rowsComp("assists") },
    { id: "clean", label: "S/ Gols Sofr.", statLabel: "S/ Gols Sofr.", rows: mkRows((p) => p.cleanSheets) },
    { id: "amarelos", label: "Cartões Amarelos", statLabel: "Cartões Amarelos", rows: mkRows((p) => p.yellows) },
    { id: "vermelhos", label: "Cartões Vermelhos", statLabel: "Cartões Vermelhos", rows: mkRows((p) => p.reds) },
    {
      id: "notas", label: "Notas Médias", statLabel: "Nota média",
      rows: userSquadStatsLive
        .filter((p) => p.matches > 0)
        .sort((a, b) => b.rating - a.rating)
        .slice(0, 20)
        .map((p, i) => ({ pos: i + 1, name: p.name, team: userCurto, matches: p.matches, isUser: true, valueStr: p.rating.toFixed(2).replace(".", ",") })),
    },
  ]
  const activeCat = cats.find((c) => c.id === activeTab) || cats[0]

  return (
    <div className="h-screen md:pl-0 pl-0 pb-20 md:pb-0 bg-[#050508] flex flex-col overflow-hidden">
      <GameHeader team={userTeam} />

      <main className="flex-1 overflow-y-auto px-6 pt-5 pb-24">
        {/* Titulo + sub-abas estilo EA FC */}
        <div className="flex items-end justify-between border-b border-white/[0.06] pb-3">
          <div className="flex items-center gap-6 overflow-x-auto">
            {cats.map((c) => {
              const active = activeTab === c.id
              return (
                <button
                  key={c.id}
                  onClick={() => setActiveTab(c.id)}
                  className={cn(
                    "relative shrink-0 whitespace-nowrap pb-3 text-sm font-semibold transition-colors",
                    active ? "text-white" : "text-white/40 hover:text-white/70",
                  )}
                >
                  {c.label}
                  {active && <span className="absolute -bottom-[13px] left-0 right-0 h-0.5 bg-[#00ffc8]" />}
                </button>
              )
            })}
          </div>
          <span className="hidden shrink-0 pl-6 text-sm text-white/45 lg:block">Temporada atual</span>
        </div>

        {/* Card de estatistica */}
        <div className="mt-6 overflow-hidden rounded-2xl border border-white/[0.06] bg-gradient-to-b from-[#12141b] to-[#0b0c11]">
          {/* Header: competicao + ano */}
          <div className="flex items-center justify-between px-6 py-5">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-md bg-white/5">
                <Trophy className="h-5 w-5 text-[#ffd700]" />
              </div>
              <div className="flex items-center gap-1.5 rounded-md border border-white/10 bg-white/5 px-2 py-1 text-[11px] font-medium text-white/60">
                <ChevronLeft className="h-3.5 w-3.5" />
                Num
                <ChevronRight className="h-3.5 w-3.5" />
              </div>
              <h2 className="text-xl font-extrabold uppercase tracking-tight text-white">
                {getLeagueName(userTeam.curto)}
              </h2>
            </div>
            <span className="text-3xl font-light text-white/30">{currentSeason}</span>
          </div>

          {activeCat.rows.length === 0 ? (
            <div className="flex h-72 items-center justify-center border-t border-white/[0.04]">
              <span className="text-2xl font-bold text-white/80">Não há dados disponíveis</span>
            </div>
          ) : (
            <>
              {/* Cabecalho de colunas */}
              <div className="grid grid-cols-[56px_minmax(0,1.5fr)_minmax(0,1.2fr)_120px_110px] items-center border-t border-white/[0.04] px-6 py-3 text-sm text-white/45">
                <span />
                <span>Atleta</span>
                <span>Time atual</span>
                <span className="text-center font-semibold text-white">{activeCat.statLabel}</span>
                <span className="text-center">Partidas</span>
              </div>

              {/* Linhas */}
              <div>
                {activeCat.rows.map((row, idx) => {
                  const team = getTeamByShort(row.team)
                  const parts = row.name.split(" ")
                  const first = parts.length > 1 ? parts[0] : ""
                  const last = parts.length > 1 ? parts.slice(1).join(" ") : row.name
                  const selected = idx === 0
                  return (
                    <div
                      key={row.pos}
                      className={cn(
                        "grid grid-cols-[56px_minmax(0,1.5fr)_minmax(0,1.2fr)_120px_110px] items-center border-t border-white/[0.04] px-6 transition-colors hover:bg-white/[0.03]",
                        selected && "bg-white/[0.04]",
                      )}
                    >
                      {/* chip de selecao */}
                      <div className="flex items-center">
                        {selected && (
                          <span className="flex h-8 w-8 items-center justify-center rounded-md border border-white/15 bg-white/10 text-white">
                            <CornerDownLeft className="h-4 w-4" />
                          </span>
                        )}
                      </div>

                      {/* Atleta */}
                      <div className="flex items-center gap-4 py-3">
                        <div className="flex h-14 w-12 shrink-0 items-end justify-center overflow-hidden rounded-md bg-gradient-to-b from-white/10 to-white/[0.02]">
                          <span className="pb-1 text-base font-bold text-white/70">
                            {(first[0] || last[0] || "").toUpperCase()}
                            {(last[0] || "").toUpperCase()}
                          </span>
                        </div>
                        <div className="min-w-0 leading-tight">
                          {first && <div className="truncate text-sm font-light uppercase text-white/55">{first}</div>}
                          <div className="flex items-center gap-2">
                            <img
                              src={flagUrl(PLAYER_NATIONALITY[row.name] || row.nat || "br") || "/placeholder.svg"}
                              alt=""
                              className="h-3 w-5 rounded-[2px] object-cover"
                            />
                            <span className="truncate text-base font-bold uppercase text-white">{last}</span>
                          </div>
                        </div>
                      </div>

                      {/* Time atual */}
                      <div className="flex items-center gap-3 py-3">
                        {team && <TeamCrest team={team} size="sm" />}
                        <span className={cn("truncate text-base", selected ? "font-bold text-white" : "text-white/80")}>
                          {team?.nome || row.team}
                        </span>
                      </div>

                      {/* Stat principal */}
                      <span className={cn("text-center text-lg tabular-nums", selected ? "font-bold text-white" : "font-semibold text-white/90")}>
                        {row.valueStr}
                      </span>

                      {/* Partidas */}
                      <span className={cn("text-center text-lg tabular-nums", selected ? "font-bold text-white" : "text-white/70")}>
                        {row.matches}
                      </span>
                    </div>
                  )
                })}
              </div>
            </>
          )}
        </div>
      </main>

    </div>
  )
}

function StatCard({ 
  label, 
  value, 
  icon: Icon, 
  color 
}: { 
  label: string; 
  value: string | number; 
  icon: React.ElementType; 
  color: string 
}) {
  return (
    <div className="p-4 rounded-lg bg-white/5">
      <div className="flex items-center gap-2 mb-2">
        <Icon className={cn("h-4 w-4", color)} />
        <span className="text-xs text-white/50">{label}</span>
      </div>
      <div className="text-2xl font-bold text-white">{value}</div>
    </div>
  )
}

function LeaderboardTable({ 
  title, 
  data, 
  columns,
  primaryColumn,
  primaryColor = "text-[#00ffc8]"
}: { 
  title: string;
  data: { pos: number; name: string; team: string; isUser?: boolean; [key: string]: string | number | boolean | undefined }[];
  columns: { key: string; label: string; icon: React.ElementType }[];
  primaryColumn: string;
  primaryColor?: string;
}) {
  return (
    <div className="rounded-xl bg-[#0c0c10] border border-white/[0.04] overflow-hidden">
      <div className="flex items-center gap-2 px-5 py-3 border-b border-white/[0.04]">
        <Award className="h-4 w-4 text-[#ffd700]" />
        <span className="font-semibold text-white">{title}</span>
      </div>

      {/* Header */}
      <div className="grid grid-cols-[40px_1fr_60px_repeat(3,60px)] gap-2 px-4 py-2 text-[10px] text-white/40 uppercase tracking-wider border-b border-white/[0.04] bg-white/[0.02]">
        <span className="text-center">#</span>
        <span>Jogador</span>
        <span className="text-center">Time</span>
        {columns.map(col => (
          <span key={col.key} className="text-center">{col.label}</span>
        ))}
      </div>

      {/* Rows */}
      <div className="divide-y divide-white/5">
        {data.map((row) => {
          const team = getTeamByShort(row.team)
          return (
            <div
              key={row.pos}
              className={cn(
                "grid grid-cols-[40px_1fr_60px_repeat(3,60px)] gap-2 px-4 py-3 items-center transition-colors hover:bg-white/[0.02]",
                row.isUser && "bg-[#00ffc8]/10 border-l-2 border-[#00ffc8]"
              )}
            >
              <span className={cn(
                "text-center text-sm font-medium",
                row.pos <= 3 ? "text-[#ffd700]" : "text-white/50"
              )}>
                {row.pos <= 3 ? (
                  <div className="flex items-center justify-center">
                    <Trophy className={cn(
                      "h-4 w-4",
                      row.pos === 1 ? "text-yellow-400" :
                      row.pos === 2 ? "text-gray-400" : "text-amber-600"
                    )} />
                  </div>
                ) : row.pos}
              </span>
              
              <div className="flex items-center gap-2 min-w-0">
                <span className={cn(
                  "truncate text-sm",
                  row.isUser ? "font-semibold text-white" : "text-white/80"
                )}>
                  {row.name}
                </span>
                {row.isUser && <Star className="h-3 w-3 text-[#ffd700] shrink-0" />}
              </div>

              <div className="flex items-center justify-center">
                {team && <TeamCrest team={team} size="xs" />}
              </div>

              {columns.map((col, i) => (
                <span 
                  key={col.key} 
                  className={cn(
                    "text-center text-sm tabular-nums",
                    i === 0 ? `font-bold ${primaryColor}` : "text-white/70"
                  )}
                >
                  {row[col.key] as string | number}
                </span>
              ))}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function SquadStatsTable({ 
  data 
}: { 
  data: { id: number; name: string; position: string; matches: number; goals: number; assists: number; yellows: number; reds: number; rating: number; cleanSheets?: number }[]
}) {
  return (
    <div className="rounded-xl bg-[#0c0c10] border border-white/[0.04] overflow-hidden">
      <div className="flex items-center gap-2 px-5 py-3 border-b border-white/[0.04]">
        <Users className="h-4 w-4 text-[#00ffc8]" />
        <span className="font-semibold text-white">Estatisticas do Elenco</span>
      </div>

      {/* Header */}
      <div className="grid grid-cols-[1fr_60px_50px_50px_50px_50px_50px_60px] gap-2 px-4 py-2 text-[10px] text-white/40 uppercase tracking-wider border-b border-white/[0.04] bg-white/[0.02]">
        <span>Jogador</span>
        <span className="text-center">Pos</span>
        <span className="text-center">J</span>
        <span className="text-center">G</span>
        <span className="text-center">A</span>
        <span className="text-center">AM</span>
        <span className="text-center">VM</span>
        <span className="text-center">Nota</span>
      </div>

      {/* Rows */}
      <div className="divide-y divide-white/5">
        {/* [...data] antes do sort: `data` e uma prop, e Array.sort MUTA no lugar.
            Ordenar a prop durante o render reordena o array do componente pai a
            cada frame — efeito colateral silencioso que pode embaralhar a lista
            de quem passou o dado. */}
        {[...data].sort((a, b) => b.rating - a.rating).map((player) => (
          <div
            key={player.id}
            className="grid grid-cols-[1fr_60px_50px_50px_50px_50px_50px_60px] gap-2 px-4 py-3 items-center transition-colors hover:bg-white/[0.02]"
          >
            <span className="text-sm text-white font-medium">{player.name}</span>
            <span className="text-center text-xs text-white/50">{player.position}</span>
            <span className="text-center text-sm text-white/70 tabular-nums">{player.matches}</span>
            <span className="text-center text-sm text-[#00ffc8] tabular-nums font-semibold">{player.goals}</span>
            <span className="text-center text-sm text-blue-400 tabular-nums">{player.assists}</span>
            <span className="text-center text-sm text-[#ffd700] tabular-nums">{player.yellows}</span>
            <span className="text-center text-sm text-red-500 tabular-nums">{player.reds}</span>
            <span className={cn(
              "text-center text-sm font-bold tabular-nums",
              player.rating >= 7.5 ? "text-[#00ffc8]" :
              player.rating >= 7.0 ? "text-lime-400" :
              player.rating >= 6.5 ? "text-[#ffd700]" : "text-orange-500"
            )}>
              {player.rating.toFixed(1)}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
