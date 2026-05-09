"use client"

import Link from "next/link"
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
  AlertTriangle,
  Heart,
  DollarSign,
} from "lucide-react"
import { GameSidebar } from "@/components/game-sidebar"
import { GameHeader } from "@/components/game-header"
import { MusicPlayer } from "@/components/music-player"
import { GamepadControlsBar, GamepadHeaderControls } from "@/components/gamepad-controls-bar"
import { TeamCrest } from "@/components/team-crest"
import { Progress } from "@/components/ui/progress"
import { serieATeams, getTeamByShort, formatCurrency, formatNumber, type Team } from "@/lib/teams-data"
import { useUserTeam } from "@/lib/save-system"
import { useGameManager, useStandings, type Fixture } from "@/lib/use-game-manager"
import { useGameEngine } from "@/lib/game-engine"
import { cn } from "@/lib/utils"
import { useMemo, useEffect } from "react"

export default function DashboardPage() {
  const { team: userTeam } = useUserTeam()
  const { 
    standings: gameStandings, 
    seasonCalendar, 
    currentWeek, 
    currentSeason,
    userPosition,
    initializeNewGame,
    hydrated
  } = useGameManager()
  const gameEngine = useGameEngine()
  
  // Inicializa o jogo se ainda nao foi inicializado
  useEffect(() => {
    if (hydrated && userTeam && gameStandings.length === 0) {
      initializeNewGame(userTeam.curto)
    }
  }, [hydrated, userTeam, gameStandings.length, initializeNewGame])

  // Classificacao formatada para exibicao (top 8)
  const standings = useMemo(() => {
    if (gameStandings.length === 0) {
      // Fallback inicial
      return serieATeams.slice(0, 8).map((team, index) => ({
        pos: index + 1,
        team,
        pts: 0,
        w: 0,
        d: 0,
        l: 0,
        isUser: team.curto === userTeam.curto,
      }))
    }
    
    return gameStandings.slice(0, 8).map((entry, index) => ({
      pos: index + 1,
      team: getTeamByShort(entry.teamShort) || serieATeams[0],
      pts: entry.points,
      w: entry.won,
      d: entry.drawn,
      l: entry.lost,
      isUser: entry.teamShort === userTeam.curto,
    }))
  }, [gameStandings, userTeam.curto])

  // Proximas partidas do usuario
  const fixtures = useMemo(() => {
    const userFixtures = seasonCalendar.fixtures.filter(f => f.isUserMatch && !f.played)
    
    if (userFixtures.length === 0) {
      // Fallback
      const opponents = serieATeams.filter(t => t.curto !== userTeam.curto)
      const opp = (i: number) => opponents[i % opponents.length]
      return [
        { home: userTeam, away: opp(0), date: "Rodada 1", time: "16:00", competition: "Brasileirao", round: 1 },
        { home: opp(1), away: userTeam, date: "Rodada 2", time: "21:30", competition: "Brasileirao", round: 2 },
        { home: userTeam, away: opp(2), date: "Rodada 3", time: "18:30", competition: "Brasileirao", round: 3 },
        { home: opp(3), away: userTeam, date: "Rodada 4", time: "19:00", competition: "Brasileirao", round: 4 },
        { home: userTeam, away: opp(4), date: "Rodada 5", time: "16:00", competition: "Brasileirao", round: 5 },
        { home: opp(5), away: userTeam, date: "Rodada 6", time: "20:00", competition: "Brasileirao", round: 6 },
      ]
    }
    
    return userFixtures.slice(0, 6).map(f => ({
      home: f.homeTeam,
      away: f.awayTeam,
      date: `Rodada ${f.round}`,
      time: "16:00",
      competition: f.competition,
      round: f.round
    }))
  }, [seasonCalendar.fixtures, userTeam])

  // Financas dinamicas
  const finances = useMemo(() => {
    const totalWages = gameEngine.squadPlayers.reduce((sum, p) => sum + (p.contract?.salary || 0), 0) * 4
    const scoutWages = gameEngine.scouts.reduce((sum, s) => sum + s.salary, 0) * 4
    const monthlyExpenses = totalWages + scoutWages + 800000
    const monthlyIncome = (userTeam.prestigio * 25000 + 1500000) + (userTeam.prestigio * 15000 + 800000)
    
    return {
      balance: gameEngine.balance,
      monthlyIncome,
      monthlyExpenses,
      netIncome: monthlyIncome - monthlyExpenses
    }
  }, [gameEngine.balance, gameEngine.squadPlayers, gameEngine.scouts, userTeam.prestigio])

  // Noticias dinamicas baseadas em eventos do jogo
  const news = useMemo(() => {
    const newsItems: { tag: string; title: string; time: string; icon: typeof Trophy }[] = []
    
    // Verifica lesoes
    const injuredPlayers = gameEngine.squadPlayers.filter(p => p.injury)
    if (injuredPlayers.length > 0) {
      newsItems.push({
        tag: "MEDICO",
        title: `${injuredPlayers[0].name} esta lesionado - ${injuredPlayers[0].injury?.type}`,
        time: "Agora",
        icon: AlertTriangle
      })
    }
    
    // Verifica contratos expirando
    const expiringContracts = gameEngine.squadPlayers.filter(p => {
      if (!p.contract) return false
      const weeksRemaining = p.contract.endDate - currentWeek
      return weeksRemaining <= 26 && weeksRemaining > 0
    })
    if (expiringContracts.length > 0) {
      newsItems.push({
        tag: "CONTRATOS",
        title: `${expiringContracts.length} jogador(es) com contrato expirando`,
        time: "Importante",
        icon: FileText
      })
    }
    
    // Ultimo resultado
    const lastResult = gameEngine.matchResults.slice(-1)[0]
    if (lastResult) {
      const isWin = (lastResult.homeTeam === userTeam.curto && lastResult.homeScore > lastResult.awayScore) ||
                   (lastResult.awayTeam === userTeam.curto && lastResult.awayScore > lastResult.homeScore)
      const isDraw = lastResult.homeScore === lastResult.awayScore
      newsItems.push({
        tag: "RESULTADO",
        title: isWin ? `Vitoria! ${lastResult.homeTeam} ${lastResult.homeScore} x ${lastResult.awayScore} ${lastResult.awayTeam}` :
               isDraw ? `Empate: ${lastResult.homeTeam} ${lastResult.homeScore} x ${lastResult.awayScore} ${lastResult.awayTeam}` :
               `Derrota: ${lastResult.homeTeam} ${lastResult.homeScore} x ${lastResult.awayScore} ${lastResult.awayTeam}`,
        time: `Rodada ${lastResult.week}`,
        icon: Trophy
      })
    }
    
    // Posicao na tabela
    if (userPosition > 0) {
      const zone = userPosition <= 4 ? "Libertadores" : userPosition <= 6 ? "Sul-Americana" : userPosition >= 17 ? "Rebaixamento" : "Meio da tabela"
      newsItems.push({
        tag: "TABELA",
        title: `${userPosition}o lugar - Zona de ${zone}`,
        time: "Atual",
        icon: TrendingUp
      })
    }
    
    // Olheiros ativos
    const activeScouts = gameEngine.scouts.filter(s => s.isSearching)
    if (activeScouts.length > 0) {
      newsItems.push({
        tag: "OLHEIROS",
        title: `${activeScouts.length} olheiro(s) em busca ativa`,
        time: "Em andamento",
        icon: Users
      })
    }
    
    return newsItems.slice(0, 4)
  }, [gameEngine.squadPlayers, gameEngine.matchResults, gameEngine.scouts, currentWeek, userTeam.curto, userPosition])

  // Metas dinamicas
  const goals = useMemo(() => {
    const targetPosition = userTeam.prestigio >= 80 ? 4 : userTeam.prestigio >= 70 ? 8 : 12
    const avoidPosition = 17
    
    const mainProgress = userPosition > 0 ? Math.max(0, Math.min(100, ((20 - userPosition) / (20 - targetPosition)) * 100)) : 50
    const survivalProgress = userPosition > 0 ? Math.max(0, Math.min(100, ((20 - userPosition) / (20 - avoidPosition)) * 100)) : 75
    
    return {
      main: {
        title: "Meta Principal",
        description: targetPosition <= 4 ? "Classificar para Libertadores" : targetPosition <= 8 ? "Classificar para Sul-Americana" : "Terminar no top 12",
        progress: mainProgress,
        status: mainProgress >= 80 ? "No caminho" : mainProgress >= 50 ? "Em andamento" : "Dificil"
      },
      survival: {
        title: "Meta Minima",
        description: "Nao rebaixar (Top 16)",
        progress: survivalProgress,
        status: survivalProgress >= 80 ? "Tranquilo" : survivalProgress >= 50 ? "Em andamento" : "Perigo!"
      }
    }
  }, [userPosition, userTeam.prestigio])

  return (
    <div className="h-screen pl-[72px] bg-[#0a0a0a] flex flex-col overflow-hidden">
      <GameSidebar />
      <GameHeader team={userTeam} />

      <main className="flex-1 p-4 overflow-y-auto space-y-4 max-w-full">
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
                <div className="text-[10px] text-white/40 uppercase tracking-wider">Saldo</div>
                <div className="text-xl font-bold text-[#1db954]">{formatCurrency(userTeam.saldo)}</div>
              </div>
              <div className="text-right">
                <div className="text-[10px] text-white/40 uppercase tracking-wider">Posicao</div>
                <div className="text-xl font-bold text-white">{userPosition > 0 ? `${userPosition}°` : "-"}</div>
              </div>
              <div className="text-right">
                <div className="text-[10px] text-white/40 uppercase tracking-wider">Rodada</div>
                <div className="text-xl font-bold text-white">{currentWeek}<span className="text-sm text-white/40">/38</span></div>
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
            <Link 
              href="/calendario"
              className="flex-1 flex items-center justify-center gap-2 py-3 text-xs font-medium text-white/70 hover:text-white hover:bg-white/5 transition-colors"
            >
              <Calendar className="h-4 w-4" />
              Calendario
            </Link>
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
                  <button className="px-4 py-2.5 rounded-lg bg-white/5 text-white/70 text-sm font-medium hover:bg-white/10 transition-colors">
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
                  <span className="text-sm font-semibold text-yellow-500">50%</span>
                </div>
              </div>
              
              <div className="p-5 grid gap-4 md:grid-cols-2">
                <GoalCard
                  title={goals.main.title}
                  description={goals.main.description}
                  progress={goals.main.progress}
                  status={goals.main.status}
                  tone="primary"
                />
                <GoalCard
                  title={goals.survival.title}
                  description={goals.survival.description}
                  progress={goals.survival.progress}
                  status={goals.survival.status}
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
                  <div
                    key={s.pos}
                    className={cn(
                      "grid grid-cols-[32px_1fr_40px_32px_32px_32px] gap-1 px-4 py-2.5 items-center text-sm",
                      s.isUser && "bg-primary/10 border-l-2 border-primary"
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

            {/* News */}
            <section className="rounded-xl bg-[#141414] border border-white/5 overflow-hidden">
              <div className="flex items-center justify-between px-5 py-3 border-b border-white/5">
                <div className="flex items-center gap-2 text-xs font-medium text-white/60">
                  <Newspaper className="h-4 w-4 text-primary" />
                  NOTICIAS
                </div>
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/20 text-[10px] font-semibold text-primary">
                  3
                </span>
              </div>
              
              <div className="divide-y divide-white/5">
                {news.length > 0 ? news.map((item, idx) => (
                  <div key={idx} className="px-5 py-3 hover:bg-white/5 transition-colors cursor-pointer group">
                    <div className="flex items-center gap-2 text-[10px] text-primary font-medium tracking-wider">
                      <item.icon className="h-3 w-3" />
                      {item.tag}
                      <span className="ml-auto text-white/40 font-normal">{item.time}</span>
                    </div>
                    <p className="mt-1 text-sm text-white/80 group-hover:text-white transition-colors line-clamp-2">
                      {item.title}
                    </p>
                  </div>
                )) : (
                  <div className="px-5 py-6 text-center text-white/40 text-sm">
                    Nenhuma noticia no momento
                  </div>
                )}
              </div>
              
              <Link 
                href="/mensagens"
                className="flex items-center justify-center gap-1 py-3 text-xs text-white/50 hover:text-white hover:bg-white/5 transition-colors border-t border-white/5"
              >
                Ver todas noticias
                <ChevronRight className="h-3 w-3" />
              </Link>
            </section>

            {/* Quick Finance */}
            <section className="rounded-xl bg-[#141414] border border-white/5 p-5">
              <div className="flex items-center gap-2 text-xs font-medium text-white/60 mb-4">
                <CircleDollarSign className="h-4 w-4 text-[#1db954]" />
                FINANCAS
              </div>
              
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-white/60">Saldo atual</span>
                  <span className="text-lg font-bold text-[#1db954]">{formatCurrency(finances.balance)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-white/60">Receita mensal</span>
                  <span className="text-sm font-medium text-white flex items-center gap-1">
                    <ArrowUpRight className="h-3 w-3 text-[#1db954]" />
                    {formatCurrency(finances.monthlyIncome)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-white/60">Despesas mensais</span>
                  <span className="text-sm font-medium text-white flex items-center gap-1">
                    <ArrowDownRight className="h-3 w-3 text-red-500" />
                    {formatCurrency(finances.monthlyExpenses)}
                  </span>
                </div>
                <div className="flex items-center justify-between pt-2 border-t border-white/5">
                  <span className="text-sm text-white/60">Balanco</span>
                  <span className={cn(
                    "text-sm font-bold flex items-center gap-1",
                    finances.netIncome >= 0 ? "text-[#1db954]" : "text-red-500"
                  )}>
                    {finances.netIncome >= 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                    {finances.netIncome >= 0 ? "+" : ""}{formatCurrency(finances.netIncome)}
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
          <span className="font-medium text-white">{progress}%</span>
        </div>
      </div>
    </div>
  )
}

function FixtureRow({
  fixture,
  userTeam,
  isNext,
}: {
  fixture: { home: Team; away: Team; date: string; time: string; competition: string }
  userTeam: Team
  isNext?: boolean
}) {
  const isHome = fixture.home.curto === userTeam.curto

  return (
    <div className={cn(
      "flex items-center gap-4 px-5 py-3",
      isNext && "bg-[#1db954]/5"
    )}>
      <div className="w-16 text-xs">
        <div className="text-white/80">{fixture.date}</div>
        <div className="text-white/40">{fixture.time}</div>
      </div>
      
      <div className="flex items-center gap-2 flex-1">
        <TeamCrest team={fixture.home} size="sm" />
        <span className={cn("text-sm", fixture.home.curto === userTeam.curto && "font-semibold text-white")}>
          {fixture.home.curto}
        </span>
        <span className="text-white/30 mx-2">vs</span>
        <span className={cn("text-sm", fixture.away.curto === userTeam.curto && "font-semibold text-white")}>
          {fixture.away.curto}
        </span>
        <TeamCrest team={fixture.away} size="sm" />
      </div>

      <span className={cn(
        "flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium",
        isHome ? "bg-[#1db954]/20 text-[#1db954]" : "bg-white/10 text-white/60"
      )}>
        {isHome ? <Home className="h-3 w-3" /> : <Plane className="h-3 w-3" />}
        {isHome ? "Casa" : "Fora"}
      </span>

      {isNext && (
        <span className="px-2 py-0.5 rounded bg-[#1db954] text-black text-[10px] font-semibold">
          PROXIMA
        </span>
      )}
    </div>
  )
}
