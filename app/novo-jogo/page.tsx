"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import Image from "next/image"
import {
  ArrowLeft,
  ArrowRight,
  Search,
  Star,
  Users,
  Building2,
  Wallet,
  Trophy,
  Globe,
  MapPin,
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
  type Regiao,
} from "@/lib/teams-data"
import {
  premierLeagueTeams,
  laLigaTeams,
  serieAItaTeams,
  bundesligaTeams,
  ligue1Teams,
  saudiProTeams,
  mlsTeams,
  ligaMXTeams,
  primeiraLigaTeams,
  leagueInfo,
} from "@/lib/international-teams"
import { teamRating, getPlayersByTeam } from "@/lib/players-data"
import { selectTeam } from "@/lib/save-system"
import { TeamCrest } from "@/components/team-crest"
import { Input } from "@/components/ui/input"

interface DivisaoTab {
  key: Divisao
  label: string
  short: string
  teams: Team[]
  region: Regiao
  country?: string
  flag?: string
}

const DIVISIONS: DivisaoTab[] = [
  // Brasil
  { key: "serie_a", label: "Brasileirao Serie A", short: "Serie A", teams: serieATeams, region: "brasil", country: "Brasil", flag: "🇧🇷" },
  { key: "serie_b", label: "Brasileirao Serie B", short: "Serie B", teams: serieBTeams, region: "brasil", country: "Brasil", flag: "🇧🇷" },
  { key: "serie_c", label: "Brasileirao Serie C", short: "Serie C", teams: serieCTeams, region: "brasil", country: "Brasil", flag: "🇧🇷" },
  { key: "serie_d", label: "Brasileirao Serie D", short: "Serie D", teams: serieDTeams, region: "brasil", country: "Brasil", flag: "🇧🇷" },
  // Europa
  { key: "premier_league", label: "Premier League", short: "Premier", teams: premierLeagueTeams, region: "europa", country: "Inglaterra", flag: "🏴󠁧󠁢󠁥󠁮󠁧󠁿" },
  { key: "la_liga", label: "La Liga", short: "La Liga", teams: laLigaTeams, region: "europa", country: "Espanha", flag: "🇪🇸" },
  { key: "serie_a_ita", label: "Serie A Italia", short: "Serie A ITA", teams: serieAItaTeams, region: "europa", country: "Italia", flag: "🇮🇹" },
  { key: "bundesliga", label: "Bundesliga", short: "Bundesliga", teams: bundesligaTeams, region: "europa", country: "Alemanha", flag: "🇩🇪" },
  { key: "ligue_1", label: "Ligue 1", short: "Ligue 1", teams: ligue1Teams, region: "europa", country: "Franca", flag: "🇫🇷" },
  { key: "primeira_liga", label: "Primeira Liga", short: "Portugal", teams: primeiraLigaTeams, region: "europa", country: "Portugal", flag: "🇵🇹" },
  // Americas
  { key: "mls", label: "MLS", short: "MLS", teams: mlsTeams, region: "americas", country: "EUA", flag: "🇺🇸" },
  { key: "liga_mx", label: "Liga MX", short: "Liga MX", teams: ligaMXTeams, region: "americas", country: "Mexico", flag: "🇲🇽" },
  // Asia
  { key: "saudi_pro", label: "Saudi Pro League", short: "Saudi Pro", teams: saudiProTeams, region: "asia", country: "Arabia Saudita", flag: "🇸🇦" },
]

const REGIONS: { key: Regiao | "all"; label: string; icon: string }[] = [
  { key: "all", label: "Todas", icon: "🌍" },
  { key: "brasil", label: "Brasil", icon: "🇧🇷" },
  { key: "europa", label: "Europa", icon: "🇪🇺" },
  { key: "americas", label: "Americas", icon: "🌎" },
  { key: "asia", label: "Asia", icon: "🌏" },
]

export default function NovoJogoPage() {
  const router = useRouter()
  const [selectedRegion, setSelectedRegion] = useState<Regiao | "all">("all")
  const [divisao, setDivisao] = useState<Divisao>("serie_a")
  const [search, setSearch] = useState("")
  const [managerName, setManagerName] = useState("")
  const [selected, setSelected] = useState<Team | null>(null)

  const filteredDivisions = useMemo(() => {
    if (selectedRegion === "all") return DIVISIONS
    return DIVISIONS.filter(d => d.region === selectedRegion)
  }, [selectedRegion])

  const activeDivision = DIVISIONS.find(d => d.key === divisao) ?? DIVISIONS[0]

  const teams = useMemo(() => {
    const list = activeDivision.teams
    if (!search.trim()) return list
    const q = search.toLowerCase()
    return list.filter(
      t =>
        t.nome.toLowerCase().includes(q) ||
        t.curto.toLowerCase().includes(q) ||
        t.estado.toLowerCase().includes(q) ||
        t.cidade?.toLowerCase().includes(q),
    )
  }, [activeDivision, search])

  const totalTeams = DIVISIONS.reduce((s, d) => s + d.teams.length, 0)

  const handleStart = () => {
    if (!selected) return
    selectTeam(selected.curto, managerName)
    router.push("/dashboard")
  }

  // When region changes, select first division of that region
  const handleRegionChange = (region: Regiao | "all") => {
    setSelectedRegion(region)
    const firstDivInRegion = region === "all" 
      ? DIVISIONS[0] 
      : DIVISIONS.find(d => d.region === region)
    if (firstDivInRegion) {
      setDivisao(firstDivInRegion.key)
    }
    setSelected(null)
  }

  return (
    <main className="h-screen bg-[#080808] text-white antialiased flex flex-col overflow-hidden">
      <BackgroundFx />

      {/* Header */}
      <header className="relative z-10 flex-shrink-0 flex items-center justify-between border-b border-white/5 px-6 h-14">
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

      <div className="relative z-10 flex-1 flex flex-col mx-auto w-full max-w-[1600px] px-6 py-4 overflow-hidden">
        <div className="flex-shrink-0 mb-4">
          <p className="text-[11px] uppercase tracking-[0.4em] text-white/35">
            Passo 1 de 1
          </p>
          <h1
            className="mt-1 text-2xl md:text-3xl font-extrabold tracking-tight"
            style={{
              fontFamily: "var(--font-oswald), var(--font-geist), sans-serif",
            }}
          >
            ESCOLHA SEU TIME
          </h1>
          <p className="mt-1 max-w-xl text-xs text-white/50">
            Selecione o clube que voce vai gerenciar. {totalTeams} times disponiveis em {DIVISIONS.length} ligas.
          </p>
        </div>

        <div className="flex-1 grid gap-4 lg:grid-cols-[1fr_360px] overflow-hidden">
          {/* Team browser */}
          <section className="flex flex-col overflow-hidden">
            {/* Region selector */}
            <div className="flex-shrink-0 mb-3">
              <div className="flex items-center gap-1 rounded-full bg-white/[0.04] p-1 w-fit">
                {REGIONS.map(r => (
                  <button
                    key={r.key}
                    onClick={() => handleRegionChange(r.key)}
                    className={
                      "rounded-full px-3 py-1.5 text-xs font-semibold transition flex items-center gap-1.5 " +
                      (r.key === selectedRegion
                        ? "bg-white text-black"
                        : "text-white/55 hover:text-white")
                    }
                  >
                    <span>{r.icon}</span>
                    {r.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Division tabs */}
            <div className="flex-shrink-0 mb-3 flex flex-wrap items-center gap-2">
              <div className="flex flex-wrap items-center gap-1 rounded-xl bg-white/[0.04] p-1 max-w-full overflow-x-auto">
                {filteredDivisions.map(d => (
                  <button
                    key={d.key}
                    onClick={() => {
                      setDivisao(d.key)
                      setSelected(null)
                    }}
                    className={
                      "rounded-lg px-2.5 py-1.5 text-[11px] font-semibold transition whitespace-nowrap flex items-center gap-1.5 " +
                      (d.key === divisao
                        ? "bg-white text-black"
                        : "text-white/55 hover:text-white hover:bg-white/5")
                    }
                  >
                    <span className="text-xs">{d.flag}</span>
                    {d.short}
                    <span className="text-[10px] opacity-60">
                      {d.teams.length}
                    </span>
                  </button>
                ))}
              </div>
              <div className="relative flex-1 min-w-[180px]">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
                <Input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder={`Buscar em ${activeDivision.label}...`}
                  className="border-white/10 bg-white/[0.03] pl-9 text-sm text-white placeholder:text-white/30 h-9"
                />
              </div>
            </div>

            {/* League info bar */}
            <div className="flex-shrink-0 mb-2 flex items-center gap-4 px-1">
              <div className="flex items-center gap-2 text-xs text-white/50">
                <Globe className="h-3.5 w-3.5" />
                <span>{activeDivision.country}</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-white/50">
                <Trophy className="h-3.5 w-3.5" />
                <span>{activeDivision.label}</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-white/50">
                <Users className="h-3.5 w-3.5" />
                <span>{activeDivision.teams.length} times</span>
              </div>
            </div>

            {/* Team grid - scrollable */}
            <div className="flex-1 overflow-y-auto scrollbar-thin pr-2">
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
                {teams.map(team => (
                  <TeamCard
                    key={team.curto + team.divisao}
                    team={team}
                    selected={selected?.curto === team.curto && selected?.divisao === team.divisao}
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
          <aside className="flex flex-col overflow-hidden">
            <div className="flex-1 flex flex-col overflow-hidden rounded-2xl border border-white/5 bg-gradient-to-br from-white/[0.04] to-white/[0.01]">
              {selected ? (
                <div className="flex-1 overflow-y-auto scrollbar-thin">
                  <SelectedPanel team={selected} />
                </div>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center px-6 text-center">
                  <div
                    aria-hidden
                    className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-white/5"
                  >
                    <Trophy className="h-6 w-6 text-white/30" />
                  </div>
                  <p className="text-sm text-white/50">
                    Selecione um time para ver detalhes.
                  </p>
                </div>
              )}

              {/* Manager + start */}
              <div className="flex-shrink-0 border-t border-white/5 p-4">
                <label className="mb-1 block text-[10px] uppercase tracking-[0.3em] text-white/40">
                  Nome do Tecnico
                </label>
                <Input
                  value={managerName}
                  onChange={e => setManagerName(e.target.value)}
                  placeholder="Ex: Tite"
                  maxLength={32}
                  className="mb-3 border-white/10 bg-white/[0.03] text-white placeholder:text-white/30 h-9"
                />
                <button
                  onClick={handleStart}
                  disabled={!selected}
                  className={
                    "group flex w-full items-center justify-between rounded-xl px-4 py-2.5 text-sm font-semibold transition " +
                    (selected
                      ? "bg-white text-black hover:bg-white/90 shadow-[0_8px_30px_rgba(255,255,255,0.18)]"
                      : "cursor-not-allowed bg-white/5 text-white/30")
                  }
                >
                  <span>Comecar carreira</span>
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </button>
                <p className="mt-2 text-center text-[10px] text-white/30">
                  Save salvo localmente
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
          <span>{team.pais || team.estado}</span>
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
  const divisionInfo = DIVISIONS.find(d => d.key === team.divisao)

  return (
    <div
      className="relative px-5 pb-4 pt-5"
      style={{
        backgroundImage: `radial-gradient(ellipse at top, ${team.cor1}30 0%, transparent 65%)`,
      }}
    >
      <div className="flex items-start gap-3">
        <TeamCrest team={team} size="xl" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.3em] text-white/40">
            <span>{divisionInfo?.flag}</span>
            <span>{divisionInfo?.label || team.divisao.replace("_", " ").toUpperCase()}</span>
          </div>
          <h2
            className="mt-0.5 text-xl font-extrabold leading-tight text-white"
            style={{
              fontFamily: "var(--font-oswald), var(--font-geist), sans-serif",
            }}
          >
            {team.nome}
          </h2>
          <p className="mt-0.5 text-xs text-white/45 flex items-center gap-1">
            <MapPin className="h-3 w-3" />
            {team.cidade ? `${team.cidade}, ${team.pais || team.estado}` : team.pais || team.estado}
          </p>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <Stat icon={Star} label="Prestigio" value={team.prestigio.toString()} />
        <Stat
          icon={Trophy}
          label="Overall"
          value={overall > 0 ? overall.toString() : "-"}
        />
        <Stat icon={Users} label="Torcida" value={formatNumber(team.torcida)} />
        <Stat icon={Wallet} label="Saldo" value={formatCurrency(team.saldo)} />
      </div>

      <div className="mt-3 rounded-xl border border-white/5 bg-black/30 p-3">
        <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.3em] text-white/40">
          <Building2 className="h-3 w-3" />
          Estadio
        </div>
        <div className="mt-1 text-sm font-medium text-white">
          {team.estadio_nome || "-"}
        </div>
        <div className="mt-0.5 text-[11px] text-white/40">
          Capacidade: {team.estadio_cap.toLocaleString("pt-BR")}
        </div>
      </div>

      {/* Additional info */}
      <div className="mt-3 rounded-xl border border-white/5 bg-black/30 p-3">
        <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.3em] text-white/40">
          <Globe className="h-3 w-3" />
          Informacoes
        </div>
        <div className="mt-2 grid grid-cols-2 gap-2 text-[11px]">
          <div>
            <span className="text-white/40">Pais: </span>
            <span className="text-white/70">{team.pais || "Brasil"}</span>
          </div>
          <div>
            <span className="text-white/40">Liga: </span>
            <span className="text-white/70">{divisionInfo?.short || team.divisao}</span>
          </div>
          {team.patrocinador && (
            <div className="col-span-2">
              <span className="text-white/40">Patrocinador: </span>
              <span className="text-white/70">{team.patrocinador}</span>
            </div>
          )}
        </div>
      </div>

      {players.length > 0 && (
        <div className="mt-2 flex items-center justify-between text-[11px] text-white/45">
          <span>{players.length} jogadores no elenco</span>
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
    <div className="rounded-lg border border-white/5 bg-black/20 p-2.5">
      <div className="flex items-center gap-1.5 text-[9px] uppercase tracking-[0.2em] text-white/40">
        <Icon className="h-3 w-3" />
        {label}
      </div>
      <div
        className="mt-0.5 text-base font-semibold text-white"
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
