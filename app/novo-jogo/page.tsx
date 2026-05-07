"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import Image from "next/image"
import {
  ArrowLeft,
  ArrowRight,
  ChevronDown,
  Search,
  Star,
  Users,
  Building2,
  Wallet,
  Trophy,
} from "lucide-react"
import {
  serieATeams,
  serieBTeams,
  serieCTeams,
  serieDTeams,
  formatCurrency,
  formatNumber,
  getLogoUrl,
  type Divisao,
  type Team,
} from "@/lib/teams-data"
import { teamRating, getPlayersByTeam } from "@/lib/players-data"
import { selectTeam } from "@/lib/save-system"
import { TeamCrest } from "@/components/team-crest"
import { Input } from "@/components/ui/input"

interface DivisaoTab {
  key: Divisao
  label: string
  short: string
  teams: Team[]
}

const DIVISIONS: DivisaoTab[] = [
  { key: "serie_a", label: "Brasileirao Serie A", short: "Serie A", teams: serieATeams },
  { key: "serie_b", label: "Brasileirao Serie B", short: "Serie B", teams: serieBTeams },
  { key: "serie_c", label: "Brasileirao Serie C", short: "Serie C", teams: serieCTeams },
  { key: "serie_d", label: "Brasileirao Serie D", short: "Serie D", teams: serieDTeams },
]

export default function NovoJogoPage() {
  const router = useRouter()
  const [divisao, setDivisao] = useState<Divisao>("serie_a")
  const [search, setSearch] = useState("")
  const [managerName, setManagerName] = useState("")
  const [selected, setSelected] = useState<Team | null>(null)

  const activeDivision = DIVISIONS.find(d => d.key === divisao) ?? DIVISIONS[0]

  const teams = useMemo(() => {
    const list = activeDivision.teams
    if (!search.trim()) return list
    const q = search.toLowerCase()
    return list.filter(
      t =>
        t.nome.toLowerCase().includes(q) ||
        t.curto.toLowerCase().includes(q) ||
        t.estado.toLowerCase().includes(q),
    )
  }, [activeDivision, search])

  const handleStart = () => {
    if (!selected) return
    selectTeam(selected.curto, managerName)
    router.push("/dashboard")
  }

  return (
    <main className="min-h-screen bg-[#080808] text-white antialiased">
      <BackgroundFx />

      {/* Header */}
      <header className="relative z-10 flex items-center justify-between border-b border-white/5 px-6 py-4">
        <button
          onClick={() => router.push("/splash")}
          className="flex items-center gap-2 text-sm text-white/60 hover:text-white transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar
        </button>
        <div className="flex items-center gap-3">
          <Image
            src={getLogoUrl()}
            alt="Ultrafoot"
            width={28}
            height={28}
            unoptimized
          />
          <span
            className="text-sm font-bold tracking-[0.3em] text-white/80"
            style={{ fontFamily: "var(--font-oswald), var(--font-geist), sans-serif" }}
          >
            ULTRAFOOT
          </span>
        </div>
        <div className="text-[10px] tracking-[0.3em] text-white/30">
          NOVA CARREIRA
        </div>
      </header>

      <div className="relative z-10 mx-auto max-w-[1400px] px-6 py-8">
        <div className="mb-8">
          <p className="text-[11px] uppercase tracking-[0.4em] text-white/35">
            Passo 1 de 1
          </p>
          <h1
            className="mt-2 text-4xl font-extrabold tracking-tight"
            style={{
              fontFamily: "var(--font-oswald), var(--font-geist), sans-serif",
            }}
          >
            ESCOLHA SEU TIME
          </h1>
          <p className="mt-2 max-w-xl text-sm text-white/50">
            Selecione o clube que voce vai gerenciar nesta carreira. Voce pode jogar
            com qualquer um dos {DIVISIONS.reduce((s, d) => s + d.teams.length, 0)} times
            brasileiros disponiveis.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr_400px]">
          {/* Team browser */}
          <section>
            {/* Filters */}
            <div className="mb-4 flex flex-wrap items-center gap-3">
              <div className="flex flex-wrap items-center gap-1 rounded-full bg-white/[0.04] p-1">
                {DIVISIONS.map(d => (
                  <button
                    key={d.key}
                    onClick={() => {
                      setDivisao(d.key)
                      setSelected(null)
                    }}
                    className={
                      "rounded-full px-4 py-1.5 text-xs font-semibold transition " +
                      (d.key === divisao
                        ? "bg-white text-black"
                        : "text-white/55 hover:text-white")
                    }
                  >
                    {d.short}
                    <span className="ml-1.5 text-[10px] opacity-60">
                      {d.teams.length}
                    </span>
                  </button>
                ))}
              </div>
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
                <Input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder={`Buscar em ${activeDivision.label}…`}
                  className="border-white/10 bg-white/[0.03] pl-9 text-sm text-white placeholder:text-white/30"
                />
              </div>
            </div>

            {/* Team grid - scrollable with max height */}
            <div className="max-h-[calc(100vh-280px)] overflow-y-auto pr-2">
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
                {teams.map(team => (
                  <TeamCard
                    key={team.curto + team.divisao}
                    team={team}
                    selected={selected?.curto === team.curto}
                    onClick={() => setSelected(team)}
                  />
                ))}
                {teams.length === 0 && (
                  <div className="col-span-full rounded-xl border border-white/5 bg-white/[0.02] p-8 text-center text-sm text-white/40">
                    Nenhum time encontrado para "{search}".
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* Selection panel */}
          <aside className="lg:sticky lg:top-6 lg:h-fit">
            <div className="overflow-hidden rounded-2xl border border-white/5 bg-gradient-to-br from-white/[0.04] to-white/[0.01]">
              {selected ? (
                <SelectedPanel team={selected} />
              ) : (
                <div className="flex h-[420px] flex-col items-center justify-center px-6 text-center">
                  <div
                    aria-hidden
                    className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-white/5"
                  >
                    <Trophy className="h-7 w-7 text-white/30" />
                  </div>
                  <p className="text-sm text-white/50">
                    Selecione um time ao lado para ver detalhes e iniciar carreira.
                  </p>
                </div>
              )}

              {/* Manager + start */}
              <div className="border-t border-white/5 p-5">
                <label className="mb-1.5 block text-[10px] uppercase tracking-[0.3em] text-white/40">
                  Nome do Tecnico
                </label>
                <Input
                  value={managerName}
                  onChange={e => setManagerName(e.target.value)}
                  placeholder="Ex: Tite"
                  maxLength={32}
                  className="mb-4 border-white/10 bg-white/[0.03] text-white placeholder:text-white/30"
                />
                <button
                  onClick={handleStart}
                  disabled={!selected}
                  className={
                    "group flex w-full items-center justify-between rounded-xl px-5 py-3 text-sm font-semibold transition " +
                    (selected
                      ? "bg-white text-black hover:bg-white/90 shadow-[0_8px_30px_rgba(255,255,255,0.18)]"
                      : "cursor-not-allowed bg-white/5 text-white/30")
                  }
                >
                  <span>Comecar carreira</span>
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </button>
                <p className="mt-3 text-center text-[10px] text-white/30">
                  Save salvo localmente · funciona offline
                </p>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </main>
  )
}

function TeamCard({
  team,
  selected,
  onClick,
}: {
  team: Team
  selected: boolean
  onClick: () => void
}) {
  const overall = teamRating(team.nome)

  return (
    <button
      onClick={onClick}
      className={
        "group relative flex items-center gap-3 overflow-hidden rounded-xl border p-3 text-left transition " +
        (selected
          ? "border-white/40 bg-white/[0.06]"
          : "border-white/5 bg-white/[0.02] hover:border-white/15 hover:bg-white/[0.04]")
      }
    >
      {/* Color accent bar */}
      <span
        aria-hidden
        className="absolute inset-y-0 left-0 w-[3px] transition-all"
        style={{ background: team.cor1 }}
      />
      <TeamCrest team={team} size="md" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <span className="truncate text-sm font-semibold text-white">
            {team.nome}
          </span>
          {overall > 0 && (
            <span className="rounded-md bg-white/10 px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-white/80">
              {overall}
            </span>
          )}
        </div>
        <div className="mt-0.5 flex items-center gap-2 text-[10px] text-white/40">
          <span>{team.estado}</span>
          <span className="text-white/15">·</span>
          <span className="flex items-center gap-0.5">
            <Star className="h-2.5 w-2.5" />
            {team.prestigio}
          </span>
        </div>
      </div>
    </button>
  )
}

function SelectedPanel({ team }: { team: Team }) {
  const overall = teamRating(team.nome)
  const players = getPlayersByTeam(team.nome)

  return (
    <div
      className="relative px-6 pb-6 pt-8"
      style={{
        backgroundImage: `radial-gradient(ellipse at top, ${team.cor1}30 0%, transparent 65%)`,
      }}
    >
      <div className="flex items-start gap-4">
        <TeamCrest team={team} size="2xl" />
        <div className="min-w-0 flex-1">
          <p className="text-[10px] uppercase tracking-[0.3em] text-white/40">
            {team.divisao.replace("_", " ").toUpperCase()}
          </p>
          <h2
            className="mt-1 text-2xl font-extrabold leading-tight text-white"
            style={{
              fontFamily: "var(--font-oswald), var(--font-geist), sans-serif",
            }}
          >
            {team.nome}
          </h2>
          <p className="mt-0.5 text-xs text-white/45">
            {team.cidade ? `${team.cidade}, ${team.estado}` : team.estado}
          </p>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3">
        <Stat icon={Star} label="Prestigio" value={team.prestigio.toString()} />
        <Stat
          icon={Trophy}
          label="Overall"
          value={overall > 0 ? overall.toString() : "–"}
        />
        <Stat icon={Users} label="Torcida" value={formatNumber(team.torcida)} />
        <Stat icon={Wallet} label="Saldo" value={formatCurrency(team.saldo)} />
      </div>

      <div className="mt-4 rounded-xl border border-white/5 bg-black/30 p-4">
        <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.3em] text-white/40">
          <Building2 className="h-3 w-3" />
          Estadio
        </div>
        <div className="mt-1.5 text-sm font-medium text-white">
          {team.estadio_nome || "—"}
        </div>
        <div className="mt-0.5 text-[11px] text-white/40">
          Capacidade: {team.estadio_cap.toLocaleString("pt-BR")}
        </div>
      </div>

      {players.length > 0 && (
        <div className="mt-3 flex items-center justify-between text-[11px] text-white/45">
          <span>{players.length} jogadores no elenco</span>
          {team.patrocinador && (
            <span className="text-white/30">{team.patrocinador}</span>
          )}
        </div>
      )}
    </div>
  )
}

function Stat({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: string
}) {
  return (
    <div className="rounded-xl border border-white/5 bg-black/20 p-3">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.3em] text-white/40">
        <Icon className="h-3 w-3" />
        {label}
      </div>
      <div
        className="mt-1 text-lg font-semibold text-white"
        style={{
          fontFamily: "var(--font-oswald), var(--font-geist), sans-serif",
        }}
      >
        {value}
      </div>
    </div>
  )
}

function BackgroundFx() {
  return (
    <>
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-0"
        style={{
          backgroundImage:
            "radial-gradient(ellipse at 30% 10%, oklch(0.32 0.10 195 / 0.18) 0%, transparent 55%)," +
            "radial-gradient(ellipse at 80% 90%, oklch(0.30 0.18 140 / 0.12) 0%, transparent 60%)",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-0 opacity-[0.06]"
        style={{
          backgroundImage:
            "radial-gradient(circle, rgba(255,255,255,0.6) 1px, transparent 1px)",
          backgroundSize: "32px 32px",
        }}
      />
    </>
  )
}
