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
  Zap,
  Users,
  Timer,
} from "lucide-react"
import { GameSidebar } from "@/components/game-sidebar"
import { MusicPlayer } from "@/components/music-player"
import { ClubCrest } from "@/components/club-crest"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"

const standings = [
  { pos: 1, abbr: "PAL", name: "Palmeiras", color: "oklch(0.55 0.18 145)", p: 0, w: 0, d: 0, l: 0 },
  { pos: 2, abbr: "COR", name: "Corinthians", color: "oklch(0.4 0.02 250)", p: 0, w: 0, d: 0, l: 0 },
  { pos: 3, abbr: "SAN", name: "Santos", color: "oklch(0.95 0.01 240)", p: 0, w: 0, d: 0, l: 0 },
  { pos: 4, abbr: "GUA", name: "Guarani", color: "oklch(0.65 0.18 145)", p: 0, w: 0, d: 0, l: 0 },
  { pos: 5, abbr: "PON", name: "Ponte Preta", color: "oklch(0.4 0.02 250)", p: 0, w: 0, d: 0, l: 0 },
  { pos: 6, abbr: "RBB", name: "RB Bragantino", color: "oklch(0.60 0.24 25)", p: 0, w: 0, d: 0, l: 0, isUser: true },
  { pos: 7, abbr: "BSP", name: "Botafogo-SP", color: "oklch(0.4 0.02 250)", p: 0, w: 0, d: 0, l: 0 },
  { pos: 8, abbr: "MIR", name: "Mirassol", color: "oklch(0.65 0.18 85)", p: 0, w: 0, d: 0, l: 0 },
]

const fixtures = [
  { round: "R1", home: "RBB", away: "PAL", date: "SAB 16:00", venue: "Casa", competition: "Brasileirao" },
  { round: "R2", home: "COR", away: "RBB", date: "QUA 21:30", venue: "Fora", competition: "Brasileirao" },
  { round: "R3", home: "RBB", away: "SAN", date: "DOM 18:30", venue: "Casa", competition: "Brasileirao" },
]

export default function DashboardPage() {
  return (
    <div className="min-h-screen pl-16 pb-20 bg-background">
      <GameSidebar />

      {/* Background effects */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute inset-0 bg-grid opacity-30" />
        <div
          className="absolute inset-0"
          style={{
            background: `
              radial-gradient(ellipse at 20% 0%, oklch(0.75 0.18 195 / 0.08) 0%, transparent 50%),
              radial-gradient(ellipse at 80% 100%, oklch(0.82 0.22 145 / 0.05) 0%, transparent 50%)
            `,
          }}
        />
      </div>

      {/* Top bar */}
      <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border/50 glass-panel px-6">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="h-8 w-1 bg-primary rounded-full" />
            <span className="font-display tracking-[0.3em] text-xs text-muted-foreground">OFFICE</span>
          </div>
          <span className="text-border">/</span>
          <span className="font-display tracking-wider text-sm text-foreground">DASHBOARD</span>
        </div>
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2 text-xs">
            <Timer className="h-3.5 w-3.5 text-primary" />
            <span className="text-muted-foreground">Temporada</span>
            <span className="font-display text-foreground">2026</span>
          </div>
          <div className="h-4 w-px bg-border" />
          <div className="flex items-center gap-2 text-xs">
            <Calendar className="h-3.5 w-3.5 text-accent" />
            <span className="text-muted-foreground">Semana</span>
            <span className="font-display text-foreground">0/48</span>
          </div>
          <div className="h-4 w-px bg-border" />
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-accent" />
            </span>
            Auto-save
          </div>
        </div>
      </header>

      <main className="relative z-10 p-6 space-y-6">
        {/* Hero — club identity */}
        <section className="relative overflow-hidden rounded-xl border border-border/50 glass-panel">
          {/* Decorative elements */}
          <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-bl from-primary/10 to-transparent rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-gradient-to-tr from-accent/10 to-transparent rounded-full blur-3xl" />
          
          {/* Corner accents */}
          <div className="absolute top-4 left-4 w-16 h-16 border-l-2 border-t-2 border-primary/30" />
          <div className="absolute top-4 right-4 w-16 h-16 border-r-2 border-t-2 border-primary/30" />

          <div className="relative flex flex-col gap-6 p-8 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-6">
              <div className="relative">
                <div className="absolute -inset-2 bg-gradient-to-br from-primary/20 to-accent/20 rounded-full blur-xl" />
                <ClubCrest
                  abbr="RBB"
                  size="xl"
                  primary="oklch(0.60 0.24 25)"
                  secondary="oklch(0.95 0.01 240)"
                />
              </div>
              <div>
                <div className="font-display tracking-[0.4em] text-[10px] text-primary mb-1">
                  RED BULL BRAGANTINO
                </div>
                <h1 className="font-display-italic text-5xl lg:text-6xl leading-none tracking-tight">
                  RB BRAGANTINO
                </h1>
                <div className="mt-3 flex items-center gap-4 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1.5 rounded bg-primary/10 px-2.5 py-1 font-display tracking-wider text-primary border border-primary/20">
                    <Trophy className="h-3 w-3" />
                    SERIE A
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Star className="h-3 w-3 text-gold" />
                    Prestigio 55
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Users className="h-3 w-3" />
                    33 jogadores
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Button variant="outline" size="lg" className="font-display tracking-wider border-border/50 hover:bg-card hover:border-primary/50">
                SALVAR
              </Button>
              <Link href="/partida">
                <Button
                  size="lg"
                  className="btn-eafc font-display tracking-[0.15em] shadow-glow-accent"
                >
                  AVANCAR SEMANA
                  <ChevronRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </div>
          </div>

          {/* Stat strip */}
          <div className="relative grid grid-cols-2 gap-px border-t border-border/50 bg-border/50 lg:grid-cols-5">
            <StatTile icon={Calendar} label="TEMPORADA" value="2026" sub="Semana 0 de 48" />
            <StatTile
              icon={CircleDollarSign}
              label="SALDO"
              value="R$ 27.5M"
              sub="+R$ 2.1M / mes"
              valueClass="text-accent"
            />
            <StatTile icon={Star} label="OVERALL" value="84" sub="Media geral do clube" valueClass="text-gold" />
            <StatTile icon={TrendingUp} label="CAMPANHA" value="0 pts" sub="0V 0E 0D 0/0 GS" />
            <StatTile
              icon={ShieldCheck}
              label="DIRETORIA"
              value="50%"
              sub="Regular"
              valueClass="text-primary"
            />
          </div>
        </section>

        {/* Board goals + News */}
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Goals */}
          <section className="lg:col-span-2 overflow-hidden rounded-xl border border-border/50 glass-panel">
            <div className="flex items-center justify-between border-b border-border/50 bg-card/30 px-6 py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gold/10 border border-gold/20">
                  <ShieldCheck className="h-4 w-4 text-gold" />
                </div>
                <div>
                  <h2 className="font-display tracking-wider text-sm">DIRETORIA</h2>
                  <p className="text-[10px] text-muted-foreground">Metas da temporada</p>
                </div>
              </div>
              <button className="text-xs text-primary hover:underline font-display tracking-wider">
                VER DETALHES
              </button>
            </div>
            <div className="grid gap-4 p-6 md:grid-cols-2">
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
            <div className="border-t border-border/50 bg-card/30 px-6 py-4 flex items-center justify-between">
              <div className="text-xs text-muted-foreground">
                Satisfacao atual da diretoria
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <div className="font-display-italic text-2xl text-gold leading-none">50%</div>
                  <div className="text-[9px] text-muted-foreground tracking-widest font-display">REGULAR</div>
                </div>
                <div className="w-32">
                  <Progress value={50} className="h-2" />
                </div>
              </div>
            </div>
          </section>

          {/* News */}
          <section className="overflow-hidden rounded-xl border border-border/50 glass-panel">
            <div className="flex items-center justify-between border-b border-border/50 bg-card/30 px-6 py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 border border-primary/20">
                  <Newspaper className="h-4 w-4 text-primary" />
                </div>
                <h2 className="font-display tracking-wider text-sm">NOTICIAS</h2>
              </div>
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] font-display text-primary-foreground">
                3
              </span>
            </div>
            <ul className="divide-y divide-border/50">
              {[
                { tag: "MERCADO", title: "Equipe abre janela com R$ 27.5M de orcamento", time: "2h" },
                { tag: "STAFF", title: "Comissao tecnica reune com diretoria sobre temporada", time: "5h" },
                { tag: "ELENCO", title: "Capitao renova vinculo ate 2028", time: "1d" },
              ].map((n) => (
                <li key={n.title} className="group px-6 py-4 hover:bg-card/30 transition cursor-pointer">
                  <div className="flex items-center gap-2 text-[10px] tracking-widest text-primary font-display">
                    <FileText className="h-3 w-3" />
                    {n.tag}
                    <span className="ml-auto text-muted-foreground font-sans tracking-normal text-[10px]">
                      {n.time}
                    </span>
                  </div>
                  <p className="mt-1.5 text-sm text-foreground/90 leading-snug group-hover:text-foreground transition">
                    {n.title}
                  </p>
                </li>
              ))}
            </ul>
          </section>
        </div>

        {/* Matchweek + Standings */}
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Matchweek focus */}
          <section className="lg:col-span-2 overflow-hidden rounded-xl border border-border/50 glass-panel">
            <div className="flex items-center justify-between border-b border-border/50 bg-card/30 px-6 py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent/10 border border-accent/20">
                  <Zap className="h-4 w-4 text-accent" />
                </div>
                <div>
                  <h2 className="font-display tracking-wider text-sm">PROXIMAS PARTIDAS</h2>
                  <p className="text-[10px] text-muted-foreground">Calendario da semana</p>
                </div>
              </div>
              <Link href="/partida" className="text-xs text-primary hover:underline font-display tracking-wider">
                IR PARA PARTIDA
              </Link>
            </div>

            <div className="grid gap-px bg-border/50 lg:grid-cols-3">
              {fixtures.map((f, i) => (
                <FixtureCard key={i} fixture={f} highlight={i === 0} />
              ))}
            </div>
          </section>

          {/* Standings */}
          <section className="overflow-hidden rounded-xl border border-border/50 glass-panel">
            <div className="flex items-center justify-between border-b border-border/50 bg-card/30 px-6 py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gold/10 border border-gold/20">
                  <Trophy className="h-4 w-4 text-gold" />
                </div>
                <h2 className="font-display tracking-wider text-sm">CLASSIFICACAO</h2>
              </div>
              <span className="text-[9px] text-muted-foreground tracking-widest font-display bg-card/50 px-2 py-1 rounded">
                BRASILEIRAO
              </span>
            </div>
            <div className="divide-y divide-border/50">
              <div className="grid grid-cols-[32px_1fr_28px_28px_28px_28px] gap-2 px-5 py-3 text-[9px] font-display tracking-widest text-muted-foreground bg-card/20">
                <span>#</span>
                <span>CLUBE</span>
                <span className="text-right">P</span>
                <span className="text-right">V</span>
                <span className="text-right text-accent">E</span>
                <span className="text-right text-destructive">D</span>
              </div>
              {standings.map((c) => (
                <div
                  key={c.pos}
                  className={cn_(
                    "grid grid-cols-[32px_1fr_28px_28px_28px_28px] gap-2 px-5 py-3 items-center transition",
                    c.isUser
                      ? "bg-primary/5 border-l-2 border-primary"
                      : "hover:bg-card/30",
                  )}
                >
                  <span className="text-xs text-muted-foreground tabular-nums font-display">{c.pos}</span>
                  <span className="flex items-center gap-2.5 min-w-0">
                    <ClubCrest abbr={c.abbr} primary={c.color} size="sm" />
                    <span className="truncate text-xs">{c.name}</span>
                  </span>
                  <span className="text-right tabular-nums text-xs font-display">{c.p}</span>
                  <span className="text-right tabular-nums text-xs">{c.w}</span>
                  <span className="text-right tabular-nums text-xs text-accent">{c.d}</span>
                  <span className="text-right tabular-nums text-xs text-destructive">{c.l}</span>
                </div>
              ))}
            </div>
          </section>
        </div>
      </main>

      <MusicPlayer />
    </div>
  )
}

function cn_(...c: (string | false | null | undefined)[]) {
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
    <div className="flex flex-col gap-1.5 bg-card/50 p-5 backdrop-blur">
      <div className="flex items-center gap-2 text-[9px] font-display tracking-[0.2em] text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <div className={cn_("font-display-italic text-3xl leading-none", valueClass)}>{value}</div>
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
    <div className={cn_(
      "relative overflow-hidden rounded-lg border p-5 transition card-hover",
      tone === "primary" 
        ? "border-primary/20 bg-primary/5" 
        : "border-accent/20 bg-accent/5"
    )}>
      <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-current to-transparent opacity-5 rounded-full blur-2xl" />
      <div
        className={cn_(
          "flex items-center gap-2 text-[10px] font-display tracking-[0.2em]",
          tone === "primary" ? "text-primary" : "text-accent",
        )}
      >
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <div className="mt-2 font-display tracking-wide text-lg">{title}</div>
      <div className="mt-4">
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div 
            className={cn_(
              "h-full rounded-full transition-all",
              tone === "primary" ? "bg-primary" : "bg-accent"
            )}
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="mt-2 flex justify-between text-[10px] text-muted-foreground">
          <span>Progresso</span>
          <span className="tabular-nums font-display">{progress}%</span>
        </div>
      </div>
    </div>
  )
}

function FixtureCard({
  fixture,
  highlight,
}: {
  fixture: { round: string; home: string; away: string; date: string; venue: string; competition: string }
  highlight?: boolean
}) {
  const homeColor = fixture.home === "RBB" ? "oklch(0.60 0.24 25)" : "oklch(0.5 0.15 250)"
  const awayColor = fixture.away === "RBB" ? "oklch(0.60 0.24 25)" : "oklch(0.55 0.18 145)"

  return (
    <div
      className={cn_(
        "relative bg-card/50 p-5 transition hover:bg-card/70",
        highlight && "bg-gradient-to-br from-accent/10 via-transparent to-transparent",
      )}
    >
      {highlight && (
        <span className="absolute right-3 top-3 rounded bg-accent px-2 py-0.5 text-[9px] font-display tracking-widest text-accent-foreground shadow-glow-accent">
          PROXIMA
        </span>
      )}
      <div className="text-[9px] font-display tracking-[0.2em] text-muted-foreground">
        {fixture.round} / {fixture.competition.toUpperCase()}
      </div>
      <div className="mt-4 flex items-center justify-between gap-4">
        <div className="flex flex-col items-center gap-2">
          <ClubCrest abbr={fixture.home} primary={homeColor} size="md" />
          <span className="text-[10px] font-display tracking-wider">{fixture.home}</span>
        </div>
        <div className="flex flex-col items-center">
          <span className="font-display-italic text-2xl text-muted-foreground">VS</span>
          <div className="mt-1 h-px w-8 bg-gradient-to-r from-transparent via-border to-transparent" />
        </div>
        <div className="flex flex-col items-center gap-2">
          <ClubCrest abbr={fixture.away} primary={awayColor} size="md" />
          <span className="text-[10px] font-display tracking-wider">{fixture.away}</span>
        </div>
      </div>
      <div className="mt-4 flex items-center justify-between text-[11px]">
        <span className="text-muted-foreground font-display tracking-wider">{fixture.date}</span>
        <span
          className={cn_(
            "rounded px-2 py-0.5 font-display tracking-widest text-[9px]",
            fixture.venue === "Casa"
              ? "bg-accent/10 text-accent border border-accent/20"
              : "bg-muted text-muted-foreground",
          )}
        >
          {fixture.venue.toUpperCase()}
        </span>
      </div>
    </div>
  )
}
