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
} from "lucide-react"
import { GameSidebar } from "@/components/game-sidebar"
import { GameHeader } from "@/components/game-header"
import { MusicPlayer } from "@/components/music-player"
import { TeamCrest } from "@/components/team-crest"
import { Progress } from "@/components/ui/progress"
import { MatchCarousel } from "@/components/match-carousel"
import { serieATeams, getTeamByShort, formatCurrency, formatNumber, type Team } from "@/lib/teams-data"
import { cn } from "@/lib/utils"

const userTeam = getTeamByShort("BGT") || serieATeams[0]

// Standings
const standings = serieATeams.slice(0, 8).map((team, index) => ({
  pos: index + 1,
  team,
  pts: 0,
  w: 0,
  d: 0,
  l: 0,
  isUser: team.curto === userTeam.curto,
}))

// Next fixtures - usando siglas corretas dos times
const fixtures = [
  { home: userTeam, away: getTeamByShort("PAL")!, date: "Jan 15", time: "16:00", competition: "Brasileirao" },
  { home: getTeamByShort("COR")!, away: userTeam, date: "Jan 22", time: "21:30", competition: "Brasileirao" },
  { home: userTeam, away: getTeamByShort("SAN")!, date: "Jan 29", time: "18:30", competition: "Copa do Brasil" },
  { home: getTeamByShort("FLA")!, away: userTeam, date: "Fev 05", time: "20:00", competition: "Brasileirao" },
  { home: getTeamByShort("INT")!, away: userTeam, date: "Fev 12", time: "19:00", competition: "Brasileirao" },
  { home: userTeam, away: getTeamByShort("GRE")!, date: "Fev 19", time: "21:00", competition: "Brasileirao" },
]

export default function DashboardPage() {
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
              <div className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full bg-[#1a1a1a] border-2 border-[#1db954] text-[10px] font-bold text-[#1db954]">
                {userTeam.prestigio}
              </div>
            </div>

            {/* Team Info */}
            <div className="flex-1">
              <div className="flex items-center gap-2 text-[10px] text-[#1db954] font-medium tracking-wider uppercase mb-1">
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
                <div className="text-xl font-bold text-white">13°</div>
              </div>
              <div className="text-right">
                <div className="text-[10px] text-white/40 uppercase tracking-wider">Temporada</div>
                <div className="text-xl font-bold text-white">2026</div>
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
            {/* Next Match - FIFA Style Carousel */}
            <MatchCarousel 
              matches={fixtures.map((f, i) => ({
                ...f,
                matchday: i + 1,
                stadium: f.home?.estadio_nome || "Estadio"
              }))} 
              userTeam={userTeam} 
            />

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
                  title="Meta Principal"
                  description="Permanecer na Serie A"
                  progress={50}
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
                  <Calendar className="h-4 w-4 text-[#1db954]" />
                  PROXIMAS PARTIDAS
                </div>
                <Link href="/calendario" className="text-xs text-[#1db954] hover:text-[#1ed760] transition-colors">
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
                {[
                  { tag: "MERCADO", title: "Equipe abre janela com orcamento disponivel", time: "2h" },
                  { tag: "STAFF", title: "Comissao tecnica define estrategia para temporada", time: "5h" },
                  { tag: "ELENCO", title: "Capitao renova vinculo ate 2028", time: "1d" },
                ].map((news) => (
                  <div key={news.title} className="px-5 py-3 hover:bg-white/5 transition-colors cursor-pointer group">
                    <div className="flex items-center gap-2 text-[10px] text-primary font-medium tracking-wider">
                      <FileText className="h-3 w-3" />
                      {news.tag}
                      <span className="ml-auto text-white/40 font-normal">{news.time}</span>
                    </div>
                    <p className="mt-1 text-sm text-white/80 group-hover:text-white transition-colors line-clamp-2">
                      {news.title}
                    </p>
                  </div>
                ))}
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
                  <span className="text-lg font-bold text-[#1db954]">{formatCurrency(userTeam.saldo)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-white/60">Receita mensal</span>
                  <span className="text-sm font-medium text-white flex items-center gap-1">
                    <ArrowUpRight className="h-3 w-3 text-[#1db954]" />
                    R$ 2.1M
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-white/60">Folha salarial</span>
                  <span className="text-sm font-medium text-white flex items-center gap-1">
                    <ArrowDownRight className="h-3 w-3 text-red-500" />
                    R$ 1.8M
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
        "px-2 py-0.5 rounded text-[10px] font-medium",
        isHome ? "bg-[#1db954]/20 text-[#1db954]" : "bg-white/10 text-white/60"
      )}>
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
