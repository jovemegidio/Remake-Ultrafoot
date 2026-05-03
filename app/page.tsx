"use client"

import Link from "next/link"
import {
  Calendar,
  ChevronRight,
  CircleDollarSign,
  FileText,
  Newspaper,
<<<<<<< HEAD
  ShieldCheck,
=======
  Shield,
>>>>>>> bfedf7d (Atualizar estrutura do projeto)
  Star,
  Target,
  TrendingUp,
  Trophy,
  Users,
<<<<<<< HEAD
  Zap,
} from "lucide-react"
import { GameSidebar } from "@/components/game-sidebar"
import { MusicPlayer } from "@/components/music-player"
import { TeamCrest } from "@/components/team-crest"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { serieATeams, getTeamByShort, formatCurrency, formatNumber, type Team } from "@/lib/teams-data"

// Dados do time do usuario (RB Bragantino por padrao)
const userTeam = getTeamByShort("RBB") || serieATeams[0]

// Classificacao da Serie A
const standings = serieATeams.slice(0, 10).map((team, index) => ({
  pos: index + 1,
  team,
  p: 0,
=======
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
import { serieATeams, getTeamByShort, formatCurrency, formatNumber, type Team } from "@/lib/teams-data"
import { cn } from "@/lib/utils"

const userTeam = getTeamByShort("RBB") || serieATeams[0]

// Standings
const standings = serieATeams.slice(0, 8).map((team, index) => ({
  pos: index + 1,
  team,
  pts: 0,
>>>>>>> bfedf7d (Atualizar estrutura do projeto)
  w: 0,
  d: 0,
  l: 0,
  isUser: team.curto === userTeam.curto,
}))

<<<<<<< HEAD
// Proximas partidas
const fixtures = [
  { round: "R1", home: userTeam, away: getTeamByShort("PLM")!, date: "Sab 16:00", venue: "Casa", competition: "Brasileirao" },
  { round: "R2", home: getTeamByShort("CRN")!, away: userTeam, date: "Qua 21:30", venue: "Fora", competition: "Brasileirao" },
  { round: "R3", home: userTeam, away: getTeamByShort("SNT")!, date: "Dom 18:30", venue: "Casa", competition: "Brasileirao" },
=======
// Next fixtures
const fixtures = [
  { home: userTeam, away: getTeamByShort("PLM")!, date: "Jan 15", time: "16:00", competition: "Brasileirao" },
  { home: getTeamByShort("CRN")!, away: userTeam, date: "Jan 22", time: "21:30", competition: "Brasileirao" },
  { home: userTeam, away: getTeamByShort("SNT")!, date: "Jan 29", time: "18:30", competition: "Copa do Brasil" },
>>>>>>> bfedf7d (Atualizar estrutura do projeto)
]

export default function DashboardPage() {
  return (
<<<<<<< HEAD
    <div className="min-h-screen pl-16 pb-20">
      <GameSidebar />

      {/* Top bar */}
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-border bg-background/80 backdrop-blur-xl px-6">
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="font-display tracking-widest text-primary">ULTRAFOOT</span>
          <span className="text-border">/</span>
          <span className="text-foreground">Dashboard</span>
        </div>
        <div className="flex items-center gap-4 text-xs">
          <span className="text-muted-foreground">
            Temporada <span className="text-foreground font-semibold">2026</span>
          </span>
          <span className="text-border">|</span>
          <span className="text-muted-foreground">
            Semana <span className="text-foreground font-semibold">0/48</span>
          </span>
          <span className="text-border">|</span>
          <span className="flex items-center gap-1.5 text-accent">
            <span className="h-1.5 w-1.5 rounded-full bg-accent animate-pulse-live" />
            Auto-save
          </span>
        </div>
      </header>

      <main className="p-6 space-y-6">
        {/* Hero — club identity */}
        <section className="relative overflow-hidden rounded-2xl border border-border eafc-card">
          <div className="absolute inset-0 bg-grid opacity-20" />
          <div
            className="absolute inset-0 opacity-50"
            style={{
              background: `radial-gradient(ellipse at left, ${userTeam.cor1}40, transparent 60%), radial-gradient(ellipse at right, ${userTeam.cor2}20, transparent 70%)`,
            }}
          />

          <div className="relative flex flex-col gap-6 p-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-6">
              <div className="relative">
                <TeamCrest team={userTeam} size="2xl" />
                <div className="absolute -bottom-1 -right-1 flex h-8 w-8 items-center justify-center rounded-full bg-card border-2 border-primary">
                  <span className="font-display text-xs text-primary">{userTeam.prestigio}</span>
                </div>
              </div>
              <div>
                <div className="flex items-center gap-2 text-xs text-primary font-display tracking-[0.3em]">
                  <Zap className="h-3 w-3" />
                  {userTeam.nome.toUpperCase()} - {userTeam.estado}
                </div>
                <h1 className="font-display-italic text-4xl lg:text-5xl leading-none tracking-tight text-glow-primary">
                  {userTeam.nome.toUpperCase()}
                </h1>
                <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                  <span className="rounded-md bg-primary/15 px-2.5 py-1 font-display tracking-wider text-primary border border-primary/30">
                    SERIE A
                  </span>
                  <span className="flex items-center gap-1">
                    <Star className="h-3 w-3 text-gold" />
                    Prestigio {userTeam.prestigio}
                  </span>
                  <span className="text-border">|</span>
                  <span className="flex items-center gap-1">
                    <Users className="h-3 w-3" />
                    {formatNumber(userTeam.torcida)} torcedores
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Button variant="outline" size="sm" className="font-display tracking-wider border-border/50">
                SALVAR
              </Button>
              <Link href="/partida">
                <Button
                  size="sm"
                  className="font-display tracking-wider bg-accent text-accent-foreground hover:bg-accent/90 shadow-glow-accent"
                >
                  AVANCAR SEMANA
                  <ChevronRight className="ml-1 h-4 w-4" />
                </Button>
              </Link>
            </div>
          </div>

          {/* Stat strip */}
          <div className="relative grid grid-cols-2 gap-px border-t border-border bg-border lg:grid-cols-5">
            <StatTile icon={Calendar} label="TEMPORADA" value="2026" sub="Semana 0 de 48" />
            <StatTile
              icon={CircleDollarSign}
              label="SALDO"
              value={formatCurrency(userTeam.saldo)}
              sub="+R$ 2.1M / mes"
              valueClass="text-accent"
            />
            <StatTile icon={Star} label="OVERALL" value={String(userTeam.prestigio)} sub="Media geral do clube" valueClass="overall-gold" />
            <StatTile icon={TrendingUp} label="CAMPANHA" value="0 pts" sub="0V 0E 0D 0/0 GS" />
            <StatTile
              icon={ShieldCheck}
              label="DIRETORIA"
              value="50%"
              sub="Regular"
              valueClass="text-gold"
            />
          </div>
        </section>

        {/* Board goals + News */}
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Goals */}
          <section className="lg:col-span-2 overflow-hidden rounded-2xl border border-border eafc-card">
            <div className="flex items-center justify-between border-b border-border bg-card/50 px-5 py-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-gold" />
                <h2 className="font-display tracking-widest text-xs">DIRETORIA - METAS</h2>
              </div>
              <button className="text-xs text-muted-foreground hover:text-primary transition-colors">
                Ver detalhes
                <ChevronRight className="inline h-3 w-3 ml-1" />
              </button>
            </div>
            <div className="grid gap-4 p-5 md:grid-cols-2">
              <GoalCard
                icon={Target}
                label="Meta Principal"
                title="Permanecer na Serie A"
                progress={50}
                tone="primary"
              />
              <GoalCard
                icon={Target}
                label="Meta Minima"
                title="Nao rebaixar (Top 16)"
                progress={75}
                tone="accent"
              />
            </div>
            <div className="border-t border-border bg-card/30 px-5 py-4 flex items-center justify-between">
              <div className="text-xs text-muted-foreground">
                Satisfacao atual da diretoria
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <div className="font-display-italic text-2xl text-gold leading-none">50%</div>
                  <div className="text-[10px] text-muted-foreground tracking-widest font-display">REGULAR</div>
                </div>
                <Progress value={50} className="w-32 h-2" />
              </div>
            </div>
          </section>

          {/* News */}
          <section className="overflow-hidden rounded-2xl border border-border eafc-card">
            <div className="flex items-center justify-between border-b border-border bg-card/50 px-5 py-3">
              <div className="flex items-center gap-2">
                <Newspaper className="h-4 w-4 text-primary" />
                <h2 className="font-display tracking-widest text-xs">NOTICIAS</h2>
              </div>
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/20 text-[10px] font-display text-primary">
                3
              </span>
            </div>
            <ul className="divide-y divide-border text-sm">
              {[
                { tag: "MERCADO", title: "Equipe abre janela com orcamento disponivel", time: "ha 2h" },
                { tag: "STAFF", title: "Comissao tecnica define estrategia para temporada", time: "ha 5h" },
                { tag: "ELENCO", title: "Capitao renova vinculo ate 2028", time: "ontem" },
              ].map((n) => (
                <li key={n.title} className="px-5 py-3 hover:bg-card/50 transition cursor-pointer group">
                  <div className="flex items-center gap-2 text-[10px] tracking-widest text-primary font-display">
                    <FileText className="h-3 w-3" />
                    {n.tag}
                    <span className="ml-auto text-muted-foreground font-sans tracking-normal text-[11px]">
                      {n.time}
                    </span>
                  </div>
                  <p className="mt-1 text-foreground/90 leading-snug text-pretty group-hover:text-foreground transition-colors">{n.title}</p>
                </li>
              ))}
            </ul>
          </section>
        </div>

        {/* Matchweek + Standings */}
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Matchweek focus */}
          <section className="lg:col-span-2 overflow-hidden rounded-2xl border border-border eafc-card">
            <div className="flex items-center justify-between border-b border-border bg-card/50 px-5 py-3">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-accent" />
                <h2 className="font-display tracking-widest text-xs">PROXIMAS PARTIDAS</h2>
              </div>
              <Link href="/partida" className="text-xs text-accent hover:text-accent/80 transition-colors font-display tracking-wider">
                VER TODAS
                <ChevronRight className="inline h-3 w-3 ml-1" />
              </Link>
            </div>

            <div className="grid gap-px bg-border lg:grid-cols-3">
              {fixtures.map((f, i) => (
                <FixtureCard key={i} fixture={f} highlight={i === 0} userTeam={userTeam} />
              ))}
            </div>
          </section>

          {/* Standings */}
          <section className="overflow-hidden rounded-2xl border border-border eafc-card">
            <div className="flex items-center justify-between border-b border-border bg-card/50 px-5 py-3">
              <div className="flex items-center gap-2">
                <Trophy className="h-4 w-4 text-gold" />
                <h2 className="font-display tracking-widest text-xs">CLASSIFICACAO</h2>
              </div>
              <span className="text-[10px] text-muted-foreground tracking-widest font-display">
                BRASILEIRAO
              </span>
            </div>
            <div className="divide-y divide-border text-sm">
              <div className="grid grid-cols-[28px_1fr_28px_28px_28px_28px] gap-1 px-4 py-2 text-[10px] font-display tracking-widest text-muted-foreground">
                <span>#</span>
                <span>CLUBE</span>
                <span className="text-center">P</span>
                <span className="text-center">V</span>
                <span className="text-center text-accent">E</span>
                <span className="text-center text-destructive">D</span>
              </div>
              {standings.map((c) => (
                <div
                  key={c.pos}
                  className={cn(
                    "grid grid-cols-[28px_1fr_28px_28px_28px_28px] gap-1 px-4 py-2.5 items-center transition-colors",
                    c.isUser
                      ? "bg-primary/10 border-l-2 border-primary"
                      : "hover:bg-card/50",
                  )}
                >
                  <span className={cn(
                    "text-xs tabular-nums",
                    c.pos <= 4 ? "text-accent font-semibold" : 
                    c.pos >= 17 ? "text-destructive" : "text-muted-foreground"
                  )}>{c.pos}</span>
                  <span className="flex items-center gap-2 min-w-0">
                    <TeamCrest team={c.team} size="xs" />
                    <span className="truncate text-xs">{c.team.nome}</span>
                  </span>
                  <span className="text-center tabular-nums text-xs font-semibold">{c.p}</span>
                  <span className="text-center tabular-nums text-xs">{c.w}</span>
                  <span className="text-center tabular-nums text-xs text-accent">{c.d}</span>
                  <span className="text-center tabular-nums text-xs text-destructive">{c.l}</span>
                </div>
              ))}
            </div>
            <Link 
              href="/competicoes"
              className="flex items-center justify-center gap-1 border-t border-border py-3 text-xs text-muted-foreground hover:text-primary hover:bg-card/50 transition-colors font-display tracking-wider"
            >
              VER TABELA COMPLETA
              <ChevronRight className="h-3 w-3" />
            </Link>
          </section>
=======
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
                      <div className="text-xs text-white/40">Casa</div>
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
                      <div className="text-xs text-white/40">Visitante</div>
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
>>>>>>> bfedf7d (Atualizar estrutura do projeto)
        </div>
      </main>

      <MusicPlayer />
    </div>
  )
}

<<<<<<< HEAD
function cn(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(" ")
}

function StatTile({
  icon: Icon,
  label,
  value,
  sub,
  valueClass,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: string
  sub: string
  valueClass?: string
}) {
  return (
    <div className="flex flex-col gap-1 bg-card p-4">
      <div className="flex items-center gap-1.5 text-[10px] font-display tracking-widest text-muted-foreground">
        <Icon className="h-3 w-3" />
        {label}
      </div>
      <div className={cn("font-display-italic text-2xl leading-none", valueClass)}>{value}</div>
      <div className="text-[11px] text-muted-foreground">{sub}</div>
    </div>
  )
}

function GoalCard({
  icon: Icon,
  label,
  title,
  progress,
  tone,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  title: string
  progress: number
  tone: "primary" | "accent"
}) {
  return (
    <div className="rounded-xl border border-border bg-card/50 p-4 transition-all hover:border-primary/30">
      <div
        className={cn(
          "flex items-center gap-1.5 text-[10px] font-display tracking-widest",
          tone === "primary" ? "text-primary" : "text-accent",
        )}
      >
        <Icon className="h-3 w-3" />
        {label}
      </div>
      <div className="mt-1.5 font-display tracking-wide text-sm">{title}</div>
      <div className="mt-3">
        <Progress value={progress} className="h-1.5" />
        <div className="mt-1.5 flex justify-between text-[10px] text-muted-foreground">
          <span>Progresso</span>
          <span className="tabular-nums font-semibold">{progress}%</span>
=======
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
>>>>>>> bfedf7d (Atualizar estrutura do projeto)
        </div>
      </div>
    </div>
  )
}

<<<<<<< HEAD
function FixtureCard({
  fixture,
  highlight,
  userTeam,
}: {
  fixture: { round: string; home: Team; away: Team; date: string; venue: string; competition: string }
  highlight?: boolean
  userTeam: Team
=======
function FixtureRow({
  fixture,
  userTeam,
  isNext,
}: {
  fixture: { home: Team; away: Team; date: string; time: string; competition: string }
  userTeam: Team
  isNext?: boolean
>>>>>>> bfedf7d (Atualizar estrutura do projeto)
}) {
  const isHome = fixture.home.curto === userTeam.curto

  return (
<<<<<<< HEAD
    <div
      className={cn(
        "relative bg-card p-4 transition-all",
        highlight && "bg-gradient-to-br from-accent/10 via-transparent to-primary/5",
      )}
    >
      {highlight && (
        <span className="absolute right-3 top-3 rounded-md bg-accent px-2 py-0.5 text-[9px] font-display tracking-widest text-accent-foreground shadow-glow-accent/30">
          PROXIMA
        </span>
      )}
      <div className="text-[10px] font-display tracking-widest text-muted-foreground">
        {fixture.round} - {fixture.competition}
      </div>
      <div className="mt-4 flex items-center justify-between gap-3">
        <div className="flex flex-col items-center gap-1">
          <TeamCrest team={fixture.home} size="lg" />
          <span className="text-[10px] font-display tracking-wider text-muted-foreground">{fixture.home.curto}</span>
        </div>
        <div className="flex flex-col items-center">
          <span className="font-display-italic text-lg text-muted-foreground/50">VS</span>
          <span className="text-[10px] text-muted-foreground">{fixture.date}</span>
        </div>
        <div className="flex flex-col items-center gap-1">
          <TeamCrest team={fixture.away} size="lg" />
          <span className="text-[10px] font-display tracking-wider text-muted-foreground">{fixture.away.curto}</span>
        </div>
      </div>
      <div className="mt-4 flex items-center justify-center">
        <span
          className={cn(
            "rounded-md px-2.5 py-1 font-display tracking-widest text-[10px]",
            isHome
              ? "bg-accent/15 text-accent border border-accent/30"
              : "bg-muted text-muted-foreground border border-border",
          )}
        >
          {fixture.venue.toUpperCase()}
        </span>
      </div>
=======
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
>>>>>>> bfedf7d (Atualizar estrutura do projeto)
    </div>
  )
}
