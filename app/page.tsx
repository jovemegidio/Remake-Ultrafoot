"use client"

import Link from "next/link"
import {
  Calendar,
  ChevronRight,
  CircleDollarSign,
  FileText,
  Newspaper,
  ShieldCheck,
  Star,
  Target,
  TrendingUp,
  Trophy,
  Users,
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
  w: 0,
  d: 0,
  l: 0,
  isUser: team.curto === userTeam.curto,
}))

// Proximas partidas
const fixtures = [
  { round: "R1", home: userTeam, away: getTeamByShort("PLM")!, date: "Sab 16:00", venue: "Casa", competition: "Brasileirao" },
  { round: "R2", home: getTeamByShort("CRN")!, away: userTeam, date: "Qua 21:30", venue: "Fora", competition: "Brasileirao" },
  { round: "R3", home: userTeam, away: getTeamByShort("SNT")!, date: "Dom 18:30", venue: "Casa", competition: "Brasileirao" },
]

export default function DashboardPage() {
  return (
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
          {/* Background layers */}
          <div className="absolute inset-0 bg-grid opacity-25" />
          <div
            className="absolute inset-0 opacity-60"
            style={{
              background: `radial-gradient(ellipse at left, ${userTeam.cor1}55, transparent 55%), radial-gradient(ellipse at right, ${userTeam.cor2}22, transparent 70%)`,
            }}
          />
          {/* Diagonal accent stripe (EA FC signature) */}
          <div
            className="absolute right-0 top-0 h-full w-1/3 opacity-20 pointer-events-none"
            style={{
              background: `linear-gradient(115deg, transparent 50%, ${userTeam.cor1} 50%, ${userTeam.cor1} 52%, transparent 52%, transparent 56%, ${userTeam.cor1} 56%, ${userTeam.cor1} 57%, transparent 57%)`,
            }}
          />
          {/* Faint big crest watermark */}
          <div className="absolute -right-10 -top-10 hidden lg:block opacity-[0.05] pointer-events-none">
            <TeamCrest team={userTeam} size="2xl" className="scale-[2.5]" />
          </div>

          <div className="relative flex flex-col gap-6 p-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-6">
              <div className="relative">
                <div
                  className="absolute -inset-2 rounded-full opacity-50 blur-xl"
                  style={{ background: `radial-gradient(circle, ${userTeam.cor1}60, transparent 70%)` }}
                />
                <TeamCrest team={userTeam} size="2xl" className="relative" />
                <div className="absolute -bottom-1 -right-1 flex h-9 w-9 items-center justify-center rounded-full bg-card border-2 border-primary shadow-glow-primary">
                  <span className="font-display-italic text-sm text-primary leading-none">{userTeam.prestigio}</span>
                </div>
              </div>
              <div>
                <div className="flex items-center gap-2 text-[10px] text-primary font-display tracking-[0.4em]">
                  <Zap className="h-3 w-3" />
                  CLUBE - {userTeam.estado}
                </div>
                <h1 className="font-display-italic text-5xl lg:text-6xl leading-[0.9] tracking-tight text-glow-primary mt-1">
                  {userTeam.nome.toUpperCase()}
                </h1>
                <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                  <span className="rounded-sm bg-primary/15 px-2.5 py-1 font-display tracking-wider text-primary border border-primary/30">
                    SERIE A
                  </span>
                  <span className="rounded-sm bg-card/60 px-2.5 py-1 font-display tracking-wider text-muted-foreground border border-border flex items-center gap-1.5">
                    <Star className="h-3 w-3 text-gold" />
                    PRESTIGIO {userTeam.prestigio}
                  </span>
                  <span className="rounded-sm bg-card/60 px-2.5 py-1 font-display tracking-wider text-muted-foreground border border-border flex items-center gap-1.5">
                    <Users className="h-3 w-3" />
                    {formatNumber(userTeam.torcida)} TORCEDORES
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

          {/* Stat strip — EAFC style with diagonal separators */}
          <div className="relative grid grid-cols-2 gap-px border-t border-border bg-border lg:grid-cols-5">
            <StatTile icon={Calendar} label="TEMPORADA" value="2026" sub="Semana 0 de 48" />
            <StatTile
              icon={CircleDollarSign}
              label="SALDO"
              value={formatCurrency(userTeam.saldo)}
              sub="+R$ 2.1M / mes"
              valueClass="text-accent"
            />
            <StatTile
              icon={Star}
              label="OVERALL"
              value={String(userTeam.prestigio)}
              sub="Media geral do clube"
              valueClass="overall-gold"
              accent
            />
            <StatTile icon={TrendingUp} label="CAMPANHA" value="0 pts" sub="0V 0E 0D 0/0 GS" />
            <StatTile icon={ShieldCheck} label="DIRETORIA" value="50%" sub="Regular" valueClass="text-gold" />
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
        </div>
      </main>

      <MusicPlayer />
    </div>
  )
}

function cn(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(" ")
}

function StatTile({
  icon: Icon,
  label,
  value,
  sub,
  valueClass,
  accent,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: string
  sub: string
  valueClass?: string
  accent?: boolean
}) {
  return (
    <div
      className={cn(
        "relative flex flex-col gap-1 p-4 transition-colors",
        accent ? "bg-card/80" : "bg-card",
      )}
    >
      {accent && (
        <span className="absolute left-0 top-0 h-[2px] w-12 bg-gradient-to-r from-gold to-transparent" />
      )}
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
        </div>
      </div>
    </div>
  )
}

function FixtureCard({
  fixture,
  highlight,
  userTeam,
}: {
  fixture: { round: string; home: Team; away: Team; date: string; venue: string; competition: string }
  highlight?: boolean
  userTeam: Team
}) {
  const isHome = fixture.home.curto === userTeam.curto

  return (
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
    </div>
  )
}
