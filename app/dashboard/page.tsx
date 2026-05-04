"use client"

import Link from "next/link"
import { memo, useMemo, useState } from "react"
import {
  Calendar,
  ChevronRight,
  CircleDollarSign,
  FileText,
  Newspaper,
  Shield,
  Star,
  Target,
  TrendingUp,
  Trophy,
  Users,
  Play,
  MapPin,
  Clock,
  ArrowUpRight,
  ArrowDownRight,
  Home,
  Plane,
  FastForward,
  Siren,
  Ban,
  AlertTriangle,
  Activity,
} from "lucide-react"
import { GameSidebar } from "@/components/game-sidebar"
import { GameHeader } from "@/components/game-header"
import { MusicPlayer } from "@/components/music-player"
import { GamepadControlsBar } from "@/components/gamepad-controls-bar"
import { TeamCrest } from "@/components/team-crest"
import { Progress } from "@/components/ui/progress"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { serieATeams, formatCurrency, formatNumber, type Team } from "@/lib/teams-data"
import { useUserTeam, useGameState } from "@/lib/save-system"
import { useCareerData } from "@/hooks/use-career-data"
import { cn } from "@/lib/utils"

// Memoized components for performance
const StandingRow = memo(function StandingRow({ 
  s, 
  isUser 
}: { 
  s: { pos: number; team: Team; pts: number; w: number; d: number; l: number }
  isUser: boolean 
}) {
  return (
    <div
      className={cn(
        "grid grid-cols-[32px_1fr_40px_32px_32px_32px] gap-1 px-4 py-2.5 items-center text-sm",
        isUser && "bg-primary/10 border-l-2 border-primary"
      )}
    >
      <span className={cn(
        "text-xs font-medium",
        s.pos <= 4 ? "text-[#1db954]" : s.pos >= 17 ? "text-red-500" : "text-white/50"
      )}>
        {s.pos}
      </span>
      <div className="flex items-center gap-2 min-w-0">
        <TeamCrest team={s.team} size="xs" />
        <span className="truncate text-xs text-white">{s.team.nome}</span>
      </div>
      <span className="text-center font-semibold text-white">{s.pts}</span>
      <span className="text-center text-xs text-white/50">{s.w}</span>
      <span className="text-center text-xs text-white/50">{s.d}</span>
      <span className="text-center text-xs text-white/50">{s.l}</span>
    </div>
  )
})

const FixtureRow = memo(function FixtureRow({ 
  fixture, 
  userTeam, 
  isNext 
}: { 
  fixture: { home: Team; away: Team; date: string; time: string; competition: string }
  userTeam: Team
  isNext: boolean 
}) {
  const isHome = fixture.home.curto === userTeam.curto
  const opponent = isHome ? fixture.away : fixture.home

  return (
    <Link
      href="/partida"
      className={cn(
        "flex items-center gap-3 px-5 py-3 hover:bg-white/5 transition-colors",
        isNext && "bg-primary/5"
      )}
    >
      <div className={cn(
        "flex h-8 w-8 items-center justify-center rounded-lg",
        isHome ? "bg-[#1db954]/20 text-[#1db954]" : "bg-white/10 text-white/60"
      )}>
        {isHome ? <Home className="h-4 w-4" /> : <Plane className="h-4 w-4" />}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <TeamCrest team={opponent} size="xs" />
          <span className="font-medium text-white text-sm truncate">
            {isHome ? "vs" : "@"} {opponent.nome}
          </span>
        </div>
        <div className="text-[10px] text-white/40 mt-0.5">{fixture.competition}</div>
      </div>
      <div className="text-right">
        <div className="text-xs text-white/60">{fixture.date}</div>
        <div className="text-[10px] text-primary">{fixture.time}</div>
      </div>
    </Link>
  )
})

export default function DashboardPage() {
  const { team: userTeam, hydrated: teamHydrated } = useUserTeam()
  const { state: gameState, setState: setGameState } = useGameState()
  const { 
    players,
    season, 
    teamMorale, 
    boardSatisfaction,
    events,
    advanceWeek,
    getInjuredPlayers,
    getSuspendedPlayers,
    getExpiringContracts,
    getWeeklySalaryBill,
    hydrated: careerHydrated,
  } = useCareerData()

  const [advanceModalOpen, setAdvanceModalOpen] = useState(false)
  const [weekEvents, setWeekEvents] = useState<string[]>([])

  const standings = useMemo(
    () =>
      serieATeams.slice(0, 8).map((team, index) => ({
        pos: index + 1,
        team,
        pts: season.competitionResults.brasileirao.points,
        w: season.competitionResults.brasileirao.wins,
        d: season.competitionResults.brasileirao.draws,
        l: season.competitionResults.brasileirao.losses,
        isUser: team.curto === userTeam.curto,
      })),
    [userTeam.curto, season],
  )

  const fixtures = useMemo(() => {
    const opponents = serieATeams.filter(t => t.curto !== userTeam.curto)
    const fallbackOpponents = serieATeams.length > 1 ? serieATeams.slice(0, 6) : [serieATeams[0]]
    const opponentsList = opponents.length > 0 ? opponents : fallbackOpponents
    const opp = (i: number) => opponentsList[i % opponentsList.length]
    
    const baseWeek = season.week
    return [
      { home: userTeam, away: opp(0), date: `Sem ${baseWeek + 1}`, time: "16:00", competition: "Brasileirao" },
      { home: opp(1), away: userTeam, date: `Sem ${baseWeek + 2}`, time: "21:30", competition: "Brasileirao" },
      { home: userTeam, away: opp(2), date: `Sem ${baseWeek + 3}`, time: "18:30", competition: "Copa do Brasil" },
      { home: opp(3), away: userTeam, date: `Sem ${baseWeek + 4}`, time: "19:00", competition: "Brasileirao" },
      { home: userTeam, away: opp(4), date: `Sem ${baseWeek + 5}`, time: "16:00", competition: "Brasileirao" },
      { home: opp(5), away: userTeam, date: `Sem ${baseWeek + 6}`, time: "20:00", competition: "Brasileirao" },
    ]
  }, [userTeam, season.week])

  // Stats
  const injuredCount = getInjuredPlayers().length
  const suspendedCount = getSuspendedPlayers().length
  const expiringCount = getExpiringContracts().length
  const weeklySalary = getWeeklySalaryBill()

  const handleAdvanceWeek = () => {
    advanceWeek()
    // Atualiza o gameState tambem
    setGameState({ week: season.week + 1 })
    setWeekEvents(events.slice(0, 5))
    setAdvanceModalOpen(true)
  }

  if (!teamHydrated || !careerHydrated) {
    return (
      <div className="min-h-screen pl-[72px] bg-[#0a0a0a] flex items-center justify-center">
        <div className="text-white/50">Carregando...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen pl-[72px] pb-24 bg-[#0a0a0a]">
      <GameSidebar />
      <GameHeader team={userTeam} />

      <main className="p-6 space-y-5">
        {/* Hero - Club Identity */}
        <section className="relative overflow-hidden rounded-xl bg-gradient-to-br from-[#141414] to-[#0a0a0a] border border-white/5">
          {/* Background accents */}
          <div 
            className="absolute inset-0 opacity-20"
            style={{
              background: `radial-gradient(ellipse at left, ${userTeam.cor1}60, transparent 50%), radial-gradient(ellipse at right, ${userTeam.cor2}30, transparent 60%)`
            }}
          />
          
          <div className="relative flex items-center gap-6 p-6">
            {/* Team Crest */}
            <div className="relative">
              <TeamCrest team={userTeam} size="2xl" />
              <div className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full bg-[#1a1a1a] border-2 border-primary text-[10px] font-bold text-primary">
                {userTeam.prestigio}
              </div>
            </div>

            {/* Team Info */}
            <div className="flex-1">
              <div className="flex items-center gap-2 text-[10px] text-primary font-medium tracking-wider uppercase mb-1">
                <Shield className="h-3 w-3" />
                {userTeam.cidade}, {userTeam.estado}
              </div>
              <h1 className="text-3xl font-bold text-white tracking-tight">
                {userTeam.nome}
              </h1>
              <div className="flex items-center gap-4 mt-2 text-xs text-white/50">
                <span className="flex items-center gap-1">
                  <Star className="h-3 w-3 text-yellow-500" />
                  Prestigio {userTeam.prestigio}
                </span>
                <span className="flex items-center gap-1">
                  <Users className="h-3 w-3" />
                  {formatNumber(userTeam.torcida)} torcedores
                </span>
                <span className="flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  {userTeam.estadio_nome}
                </span>
              </div>
            </div>

            {/* Quick Stats */}
            <div className="flex gap-6">
              <div className="text-right">
                <div className="text-[10px] text-white/40 uppercase tracking-wider">Semana</div>
                <div className="text-xl font-bold text-primary">{season.week}/48</div>
              </div>
              <div className="text-right">
                <div className="text-[10px] text-white/40 uppercase tracking-wider">Posicao</div>
                <div className="text-xl font-bold text-white">{season.competitionResults.brasileirao.position || "-"}°</div>
              </div>
              <div className="text-right">
                <div className="text-[10px] text-white/40 uppercase tracking-wider">Temporada</div>
                <div className="text-xl font-bold text-white">{season.year}</div>
              </div>
            </div>
          </div>

          {/* Quick Action Bar */}
          <div className="flex items-center gap-px border-t border-white/5 bg-black/30">
            <Link 
              href="/partida"
              className="flex-1 flex items-center justify-center gap-2 py-3 text-xs font-medium text-white/70 hover:text-white hover:bg-white/5 transition-colors"
            >
              <Play className="h-4 w-4" />
              Proxima Partida
            </Link>
            <button 
              onClick={handleAdvanceWeek}
              className="flex-1 flex items-center justify-center gap-2 py-3 text-xs font-medium text-primary hover:text-white hover:bg-primary/10 transition-colors"
            >
              <FastForward className="h-4 w-4" />
              Avancar Semana
            </button>
            <Link 
              href="/elenco"
              className="flex-1 flex items-center justify-center gap-2 py-3 text-xs font-medium text-white/70 hover:text-white hover:bg-white/5 transition-colors"
            >
              <Users className="h-4 w-4" />
              Elenco
            </Link>
            <Link 
              href="/mercado"
              className="flex-1 flex items-center justify-center gap-2 py-3 text-xs font-medium text-white/70 hover:text-white hover:bg-white/5 transition-colors"
            >
              <TrendingUp className="h-4 w-4" />
              Mercado
            </Link>
          </div>
        </section>

        {/* Squad Status Alert */}
        {(injuredCount > 0 || suspendedCount > 0 || expiringCount > 0) && (
          <section className="grid gap-3 md:grid-cols-3">
            {injuredCount > 0 && (
              <Link href="/elenco?filter=injured" className="rounded-xl bg-red-500/10 border border-red-500/20 p-4 hover:bg-red-500/15 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-500/20">
                    <Siren className="h-5 w-5 text-red-400" />
                  </div>
                  <div>
                    <div className="text-sm font-medium text-red-400">{injuredCount} Jogador(es) Lesionado(s)</div>
                    <div className="text-xs text-white/50">Clique para ver detalhes</div>
                  </div>
                </div>
              </Link>
            )}
            {suspendedCount > 0 && (
              <Link href="/elenco?filter=suspended" className="rounded-xl bg-orange-500/10 border border-orange-500/20 p-4 hover:bg-orange-500/15 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-orange-500/20">
                    <Ban className="h-5 w-5 text-orange-400" />
                  </div>
                  <div>
                    <div className="text-sm font-medium text-orange-400">{suspendedCount} Jogador(es) Suspenso(s)</div>
                    <div className="text-xs text-white/50">Clique para ver detalhes</div>
                  </div>
                </div>
              </Link>
            )}
            {expiringCount > 0 && (
              <Link href="/elenco" className="rounded-xl bg-yellow-500/10 border border-yellow-500/20 p-4 hover:bg-yellow-500/15 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-yellow-500/20">
                    <AlertTriangle className="h-5 w-5 text-yellow-400" />
                  </div>
                  <div>
                    <div className="text-sm font-medium text-yellow-400">{expiringCount} Contrato(s) Expirando</div>
                    <div className="text-xs text-white/50">Renovar antes que saiam</div>
                  </div>
                </div>
              </Link>
            )}
          </section>
        )}

        {/* Main Grid */}
        <div className="grid gap-5 lg:grid-cols-3">
          {/* Left Column - Fixtures & Goals */}
          <div className="lg:col-span-2 space-y-5">
            {/* Next Match */}
            <section className="rounded-xl bg-[#141414] border border-white/5 overflow-hidden">
              <div className="flex items-center justify-between px-5 py-3 border-b border-white/5">
                <div className="flex items-center gap-2 text-xs font-medium text-white/60">
                  <Calendar className="h-4 w-4 text-[#1db954]" />
                  PROXIMA PARTIDA
                </div>
                <span className="text-[10px] text-white/40">Brasileirao Serie A</span>
              </div>
              
              <div className="p-5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <TeamCrest team={fixtures[0].home} size="xl" />
                    <div>
                      <div className="font-semibold text-white">{fixtures[0].home.nome}</div>
                      <div className="text-xs text-white/40 flex items-center gap-1">
                        <Home className="h-3 w-3" />
                        Casa
                      </div>
                    </div>
                  </div>
                  
                  <div className="text-center px-8">
                    <div className="text-2xl font-bold text-white/20">VS</div>
                    <div className="text-xs text-white/50 mt-1">{fixtures[0].date}</div>
                    <div className="text-xs text-primary">{fixtures[0].time}</div>
                  </div>
                  
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <div className="font-semibold text-white">{fixtures[0].away.nome}</div>
                      <div className="text-xs text-white/40 flex items-center gap-1 justify-end">
                        <Plane className="h-3 w-3" />
                        Visitante
                      </div>
                    </div>
                    <TeamCrest team={fixtures[0].away} size="xl" />
                  </div>
                </div>

                <div className="flex items-center justify-center gap-3 mt-5">
                  <Link 
                    href="/partida"
                    className="flex items-center gap-2 px-6 py-2.5 rounded-lg bg-[#1db954] text-black text-sm font-semibold hover:bg-[#1ed760] transition-colors"
                  >
                    <Play className="h-4 w-4 fill-current" />
                    Jogar Partida
                  </Link>
                  <button 
                    onClick={handleAdvanceWeek}
                    className="px-4 py-2.5 rounded-lg bg-white/5 text-white/70 text-sm font-medium hover:bg-white/10 transition-colors"
                  >
                    Simular
                  </button>
                </div>
              </div>
            </section>

            {/* Goals */}
            <section className="rounded-xl bg-[#141414] border border-white/5 overflow-hidden">
              <div className="flex items-center justify-between px-5 py-3 border-b border-white/5">
                <div className="flex items-center gap-2 text-xs font-medium text-white/60">
                  <Target className="h-4 w-4 text-yellow-500" />
                  METAS DA DIRETORIA
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-white/40">Satisfacao:</span>
                  <span className={cn(
                    "text-sm font-semibold",
                    boardSatisfaction >= 70 ? "text-[#1db954]" : boardSatisfaction >= 40 ? "text-yellow-500" : "text-red-400"
                  )}>
                    {boardSatisfaction}%
                  </span>
                </div>
              </div>
              
              <div className="p-5 grid gap-4 md:grid-cols-2">
                <GoalCard
                  title="Meta Principal"
                  description="Permanecer na Serie A"
                  progress={boardSatisfaction}
                  status="Em andamento"
                  tone="primary"
                />
                <GoalCard
                  title="Meta Minima"
                  description="Nao rebaixar (Top 16)"
                  progress={75}
                  status="No caminho"
                  tone="success"
                />
              </div>
            </section>

            {/* Upcoming Fixtures */}
            <section className="rounded-xl bg-[#141414] border border-white/5 overflow-hidden">
              <div className="flex items-center justify-between px-5 py-3 border-b border-white/5">
                <div className="flex items-center gap-2 text-xs font-medium text-white/60">
                  <Calendar className="h-4 w-4 text-primary" />
                  CALENDARIO
                </div>
                <Link href="/calendario" className="text-xs text-primary hover:text-primary/80 transition-colors">
                  Ver todos
                  <ChevronRight className="inline h-3 w-3 ml-0.5" />
                </Link>
              </div>
              
              <div className="divide-y divide-white/5">
                {fixtures.map((f, i) => (
                  <FixtureRow key={i} fixture={f} userTeam={userTeam} isNext={i === 0} />
                ))}
              </div>
            </section>
          </div>

          {/* Right Column - Standings & News */}
          <div className="space-y-5">
            {/* Team Morale */}
            <section className="rounded-xl bg-[#141414] border border-white/5 p-5">
              <div className="flex items-center gap-2 text-xs font-medium text-white/60 mb-4">
                <Activity className="h-4 w-4 text-blue-400" />
                MORAL DO ELENCO
              </div>
              <div className="flex items-center gap-4">
                <div className={cn(
                  "text-3xl font-bold",
                  teamMorale >= 70 ? "text-[#1db954]" : teamMorale >= 40 ? "text-yellow-500" : "text-red-400"
                )}>
                  {teamMorale}%
                </div>
                <div className="flex-1">
                  <Progress value={teamMorale} className="h-2" />
                  <div className="text-xs text-white/40 mt-1">
                    {teamMorale >= 70 ? "Excelente" : teamMorale >= 40 ? "Regular" : "Baixo"}
                  </div>
                </div>
              </div>
            </section>

            {/* Standings */}
            <section className="rounded-xl bg-[#141414] border border-white/5 overflow-hidden">
              <div className="flex items-center justify-between px-5 py-3 border-b border-white/5">
                <div className="flex items-center gap-2 text-xs font-medium text-white/60">
                  <Trophy className="h-4 w-4 text-yellow-500" />
                  CLASSIFICACAO
                </div>
                <span className="text-[10px] text-white/40">BRASILEIRAO</span>
              </div>
              
              <div className="divide-y divide-white/5">
                <div className="grid grid-cols-[32px_1fr_40px_32px_32px_32px] gap-1 px-4 py-2 text-[10px] text-white/40 uppercase tracking-wider">
                  <span>#</span>
                  <span>Clube</span>
                  <span className="text-center">Pts</span>
                  <span className="text-center">V</span>
                  <span className="text-center">E</span>
                  <span className="text-center">D</span>
                </div>
                
                {standings.map((s) => (
                  <StandingRow key={s.pos} s={s} isUser={s.isUser} />
                ))}
              </div>
              
              <Link 
                href="/competicoes"
                className="flex items-center justify-center gap-1 py-3 text-xs text-white/50 hover:text-white hover:bg-white/5 transition-colors border-t border-white/5"
              >
                Ver tabela completa
                <ChevronRight className="h-3 w-3" />
              </Link>
            </section>

            {/* Recent Events */}
            {events.length > 0 && (
              <section className="rounded-xl bg-[#141414] border border-white/5 overflow-hidden">
                <div className="flex items-center justify-between px-5 py-3 border-b border-white/5">
                  <div className="flex items-center gap-2 text-xs font-medium text-white/60">
                    <Newspaper className="h-4 w-4 text-primary" />
                    EVENTOS RECENTES
                  </div>
                </div>
                
                <div className="divide-y divide-white/5 max-h-[200px] overflow-y-auto">
                  {events.slice(0, 5).map((event, i) => (
                    <div key={i} className="px-5 py-3">
                      <p className="text-sm text-white/80">{event}</p>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Quick Finance */}
            <section className="rounded-xl bg-[#141414] border border-white/5 p-5">
              <div className="flex items-center gap-2 text-xs font-medium text-white/60 mb-4">
                <CircleDollarSign className="h-4 w-4 text-[#1db954]" />
                FINANCAS
              </div>
              
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-white/60">Saldo atual</span>
                  <span className="text-lg font-bold text-[#1db954]">{formatCurrency(userTeam.saldo)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-white/60">Folha semanal</span>
                  <span className="text-sm font-medium text-white flex items-center gap-1">
                    <ArrowDownRight className="h-3 w-3 text-red-500" />
                    {formatCurrency(weeklySalary)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-white/60">Elenco</span>
                  <span className="text-sm font-medium text-white">
                    {players.length} jogadores
                  </span>
                </div>
              </div>
              
              <Link 
                href="/financas"
                className="flex items-center justify-center gap-1 mt-4 py-2 text-xs text-primary hover:text-primary/80 transition-colors"
              >
                Ver detalhes
                <ChevronRight className="h-3 w-3" />
              </Link>
            </section>
          </div>
        </div>
      </main>
  
      <GamepadControlsBar />
      <MusicPlayer />

      {/* Advance Week Modal */}
      <Dialog open={advanceModalOpen} onOpenChange={setAdvanceModalOpen}>
        <DialogContent className="bg-[#1a1a1a] border-white/10 text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <FastForward className="h-5 w-5 text-primary" />
              Semana {season.week} - {season.year}
            </DialogTitle>
            <DialogDescription className="text-white/50">
              Resumo da semana
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4 space-y-3">
            {weekEvents.length > 0 ? (
              weekEvents.map((event, i) => (
                <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-white/5 border border-white/10">
                  <FileText className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                  <p className="text-sm text-white/80">{event}</p>
                </div>
              ))
            ) : (
              <div className="text-center py-4 text-white/50">
                Semana tranquila. Nenhum evento especial.
              </div>
            )}
          </div>
          
          <DialogFooter>
            <Button 
              onClick={() => setAdvanceModalOpen(false)}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
            >
              Continuar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function GoalCard({
  title,
  description,
  progress,
  status,
  tone,
}: {
  title: string
  description: string
  progress: number
  status: string
  tone: "primary" | "success"
}) {
  return (
    <div className="rounded-lg bg-white/5 p-4 border border-white/5">
      <div className="flex items-center justify-between mb-2">
        <span className={cn(
          "text-[10px] font-medium tracking-wider uppercase",
          tone === "success" ? "text-[#1db954]" : "text-primary"
        )}>
          {title}
        </span>
        <span className="text-[10px] text-white/40">{status}</span>
      </div>
      <div className="text-sm font-medium text-white mb-3">{description}</div>
      <div className="space-y-1.5">
        <Progress value={progress} className="h-1.5" />
        <div className="flex justify-between text-[10px] text-white/40">
          <span>Progresso</span>
          <span>{progress}%</span>
        </div>
      </div>
    </div>
  )
}
