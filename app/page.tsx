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
} from "lucide-react"
import { GameSidebar } from "@/components/game-sidebar"
import { MusicPlayer } from "@/components/music-player"
import { ClubCrest } from "@/components/club-crest"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"

const standings = [
  { pos: 1, abbr: "PAL", name: "Palmeiras", color: "oklch(0.65 0.15 145)", p: 0, w: 0, d: 0, l: 0 },
  { pos: 2, abbr: "COR", name: "Corinthians", color: "oklch(0.5 0.02 250)", p: 0, w: 0, d: 0, l: 0 },
  { pos: 3, abbr: "SAN", name: "Santos", color: "oklch(0.95 0.005 240)", p: 0, w: 0, d: 0, l: 0 },
  { pos: 4, abbr: "GUA", name: "Guarani", color: "oklch(0.75 0.15 80)", p: 0, w: 0, d: 0, l: 0 },
  { pos: 5, abbr: "PON", name: "Ponte Preta", color: "oklch(0.5 0.02 250)", p: 0, w: 0, d: 0, l: 0 },
  { pos: 6, abbr: "RBB", name: "RB Bragantino", color: "oklch(0.65 0.22 25)", p: 0, w: 0, d: 0, l: 0, isUser: true },
  { pos: 7, abbr: "BSP", name: "Botafogo-SP", color: "oklch(0.5 0.02 250)", p: 0, w: 0, d: 0, l: 0 },
  { pos: 8, abbr: "MIR", name: "Mirassol", color: "oklch(0.75 0.15 80)", p: 0, w: 0, d: 0, l: 0 },
]

const fixtures = [
  { round: "R1", home: "RBB", away: "PAL", date: "Sáb · 16:00", venue: "Casa", competition: "Brasileirão" },
  { round: "R2", home: "COR", away: "RBB", date: "Qua · 21:30", venue: "Fora", competition: "Brasileirão" },
  { round: "R3", home: "RBB", away: "SAN", date: "Dom · 18:30", venue: "Casa", competition: "Brasileirão" },
]

export default function DashboardPage() {
  return (
    <div className="min-h-screen pl-16 pb-16">
      <GameSidebar />

      {/* Top bar */}
      <header className="flex h-14 items-center justify-between border-b border-border bg-card/40 px-6 backdrop-blur">
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="font-display tracking-widest">OFFICE</span>
          <span className="text-border">/</span>
          <span className="text-foreground">Dashboard</span>
        </div>
        <div className="flex items-center gap-4 text-xs">
          <span className="text-muted-foreground">
            Temporada <span className="text-foreground font-semibold">2026</span>
          </span>
          <span className="text-border">·</span>
          <span className="text-muted-foreground">
            Semana <span className="text-foreground font-semibold">0/48</span>
          </span>
          <span className="text-border">·</span>
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <span className="h-1.5 w-1.5 rounded-full bg-accent animate-pulse-live" />
            Auto-save ativo
          </span>
        </div>
      </header>

      <main className="p-6 space-y-6">
        {/* Hero — club identity */}
        <section className="relative overflow-hidden rounded-xl border border-border bg-card">
          <div className="absolute inset-0 bg-grid opacity-30" />
          <div
            className="absolute inset-0 opacity-40"
            style={{
              background:
                "radial-gradient(ellipse at left, oklch(0.65 0.22 25 / 0.35), transparent 60%), radial-gradient(ellipse at right, oklch(0.82 0.15 200 / 0.15), transparent 70%)",
            }}
          />

          <div className="relative flex flex-col gap-6 p-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-5">
              <ClubCrest
                abbr="RBB"
                size="xl"
                primary="oklch(0.65 0.22 25)"
                secondary="oklch(0.95 0.005 240)"
              />
              <div>
                <div className="font-display-italic text-xs tracking-[0.3em] text-primary">
                  RED BULL BRAGANTINO · SP
                </div>
                <h1 className="font-display-italic text-5xl leading-none tracking-tight">
                  RB BRAGANTINO
                </h1>
                <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="rounded-sm bg-primary/15 px-2 py-0.5 font-display tracking-wider text-primary">
                    SÉRIE A
                  </span>
                  <span>Prestígio 55</span>
                  <span className="text-border">·</span>
                  <span>33 jogadores no elenco principal</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" className="font-display tracking-wider">
                SALVAR
              </Button>
              <Link href="/partida">
                <Button
                  size="sm"
                  className="font-display tracking-wider bg-accent text-accent-foreground hover:bg-accent/90 shadow-glow-accent"
                >
                  AVANÇAR SEMANA
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
              value="R$ 27.5M"
              sub="+R$ 2.1M / mês"
              valueClass="text-accent"
            />
            <StatTile icon={Star} label="OVERALL" value="84" sub="Média geral do clube" />
            <StatTile icon={TrendingUp} label="CAMPANHA" value="0 pts" sub="0V · 0E · 0D · 0/0 GS" />
            <StatTile
              icon={ShieldCheck}
              label="DIRETORIA"
              value="50%"
              sub="Regular"
              valueClass="text-gold"
            />
          </div>
        </section>

        {/* Board goals + Matchweek */}
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Goals */}
          <section className="lg:col-span-2 overflow-hidden rounded-xl border border-border bg-card">
            <div className="flex items-center justify-between border-b border-border bg-card-foreground/[0.02] px-5 py-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-gold" />
                <h2 className="font-display tracking-widest text-xs">DIRETORIA · METAS</h2>
              </div>
              <button className="text-xs text-muted-foreground hover:text-foreground">
                Ver detalhes →
              </button>
            </div>
            <div className="grid gap-4 p-5 md:grid-cols-2">
              <GoalCard
                icon={Target}
                label="Meta Principal"
                title="Permanecer na Série A"
                progress={50}
                tone="primary"
              />
              <GoalCard
                icon={Target}
                label="Meta Mínima"
                title="Não rebaixar (Top 16)"
                progress={75}
                tone="accent"
              />
            </div>
            <div className="border-t border-border bg-card-foreground/[0.02] px-5 py-3 flex items-center justify-between">
              <div className="text-xs text-muted-foreground">
                Satisfação atual da diretoria
              </div>
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <div className="font-display-italic text-2xl text-gold leading-none">50%</div>
                  <div className="text-[10px] text-muted-foreground tracking-widest">REGULAR</div>
                </div>
                <Progress value={50} className="w-32" />
              </div>
            </div>
          </section>

          {/* News */}
          <section className="overflow-hidden rounded-xl border border-border bg-card">
            <div className="flex items-center justify-between border-b border-border bg-card-foreground/[0.02] px-5 py-3">
              <div className="flex items-center gap-2">
                <Newspaper className="h-4 w-4 text-primary" />
                <h2 className="font-display tracking-widest text-xs">NOTÍCIAS</h2>
              </div>
              <span className="rounded-sm bg-primary/15 px-1.5 py-0.5 text-[10px] font-display tracking-wider text-primary">
                3
              </span>
            </div>
            <ul className="divide-y divide-border text-sm">
              {[
                { tag: "MERCADO", title: "Equipe abre janela com R$ 27.5M de orçamento", time: "há 2h" },
                { tag: "STAFF", title: "Comissão técnica reúne com diretoria sobre temporada", time: "há 5h" },
                { tag: "ELENCO", title: "Capitão renova vínculo até 2028", time: "ontem" },
              ].map((n) => (
                <li key={n.title} className="px-5 py-3 hover:bg-card-foreground/[0.03] transition cursor-pointer">
                  <div className="flex items-center gap-2 text-[10px] tracking-widest text-primary font-display">
                    <FileText className="h-3 w-3" />
                    {n.tag}
                    <span className="ml-auto text-muted-foreground font-sans tracking-normal">
                      {n.time}
                    </span>
                  </div>
                  <p className="mt-1 text-foreground/90 leading-snug text-pretty">{n.title}</p>
                </li>
              ))}
            </ul>
          </section>
        </div>

        {/* Matchweek + Standings */}
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Matchweek focus */}
          <section className="lg:col-span-2 overflow-hidden rounded-xl border border-border bg-card">
            <div className="flex items-center justify-between border-b border-border bg-card-foreground/[0.02] px-5 py-3">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-primary" />
                <h2 className="font-display tracking-widest text-xs">MATCHWEEK FOCUS</h2>
              </div>
              <Link href="/partida" className="text-xs text-primary hover:underline">
                Ir para partida →
              </Link>
            </div>

            <div className="grid gap-px bg-border lg:grid-cols-3">
              {fixtures.map((f, i) => (
                <FixtureCard key={i} fixture={f} highlight={i === 0} />
              ))}
            </div>
          </section>

          {/* Standings */}
          <section className="overflow-hidden rounded-xl border border-border bg-card">
            <div className="flex items-center justify-between border-b border-border bg-card-foreground/[0.02] px-5 py-3">
              <div className="flex items-center gap-2">
                <Trophy className="h-4 w-4 text-gold" />
                <h2 className="font-display tracking-widest text-xs">CLASSIFICAÇÃO</h2>
              </div>
              <span className="text-[10px] text-muted-foreground tracking-widest font-display">
                BRASILEIRÃO
              </span>
            </div>
            <div className="divide-y divide-border text-sm">
              <div className="grid grid-cols-[28px_1fr_24px_24px_24px_24px] gap-2 px-4 py-2 text-[10px] font-display tracking-widest text-muted-foreground">
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
                    "grid grid-cols-[28px_1fr_24px_24px_24px_24px] gap-2 px-4 py-2 items-center transition",
                    c.isUser
                      ? "bg-primary/10 border-l-2 border-primary"
                      : "hover:bg-card-foreground/[0.03]",
                  )}
                >
                  <span className="text-xs text-muted-foreground tabular-nums">{c.pos}</span>
                  <span className="flex items-center gap-2 min-w-0">
                    <ClubCrest abbr={c.abbr} primary={c.color} size="sm" />
                    <span className="truncate text-xs">{c.name}</span>
                  </span>
                  <span className="text-right tabular-nums text-xs">{c.p}</span>
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
    <div className="flex flex-col gap-1 bg-card p-4">
      <div className="flex items-center gap-1.5 text-[10px] font-display tracking-widest text-muted-foreground">
        <Icon className="h-3 w-3" />
        {label}
      </div>
      <div className={cn_("font-display-italic text-2xl leading-none", valueClass)}>{value}</div>
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
    <div className="rounded-lg border border-border bg-card-foreground/[0.02] p-4">
      <div
        className={cn_(
          "flex items-center gap-1.5 text-[10px] font-display tracking-widest",
          tone === "primary" ? "text-primary" : "text-accent",
        )}
      >
        <Icon className="h-3 w-3" />
        {label}
      </div>
      <div className="mt-1 font-display tracking-wide">{title}</div>
      <div className="mt-3">
        <Progress value={progress} className="h-1.5" />
        <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
          <span>Progresso</span>
          <span className="tabular-nums">{progress}%</span>
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
  return (
    <div
      className={cn_(
        "relative bg-card p-4 transition",
        highlight && "bg-gradient-to-br from-primary/[0.08] to-transparent",
      )}
    >
      {highlight && (
        <span className="absolute right-3 top-3 rounded-sm bg-accent px-1.5 py-0.5 text-[9px] font-display tracking-widest text-accent-foreground">
          PRÓXIMA
        </span>
      )}
      <div className="text-[10px] font-display tracking-widest text-muted-foreground">
        {fixture.round} · {fixture.competition}
      </div>
      <div className="mt-3 flex items-center justify-between gap-3">
        <ClubCrest
          abbr={fixture.home}
          primary={fixture.home === "RBB" ? "oklch(0.65 0.22 25)" : "oklch(0.6 0.1 250)"}
          size="md"
        />
        <span className="font-display-italic text-lg text-muted-foreground">VS</span>
        <ClubCrest
          abbr={fixture.away}
          primary={fixture.away === "RBB" ? "oklch(0.65 0.22 25)" : "oklch(0.6 0.1 250)"}
          size="md"
        />
      </div>
      <div className="mt-3 flex items-center justify-between text-[11px]">
        <span className="text-muted-foreground">{fixture.date}</span>
        <span
          className={cn_(
            "rounded-sm px-1.5 py-0.5 font-display tracking-widest text-[9px]",
            fixture.venue === "Casa"
              ? "bg-accent/15 text-accent"
              : "bg-muted text-muted-foreground",
          )}
        >
          {fixture.venue.toUpperCase()}
        </span>
      </div>
    </div>
  )
}
