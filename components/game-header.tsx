"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useState, useRef, useEffect } from "react"
import { Save, FastForward, Settings, Check, Loader2, ChevronDown, User, Trophy, Calendar, TrendingUp, ChevronRight, Star } from "lucide-react"
import { TeamCrest } from "@/components/team-crest"
import { NotificationBell, NotificationCenter } from "@/components/notifications-system"
import { getTeamByShort, serieATeams, type Team } from "@/lib/teams-data"
import { useGameState } from "@/lib/save-system"
import { useGameManager } from "@/lib/use-game-manager"
import { cn } from "@/lib/utils"
import { hardNavigate } from "@/lib/hard-navigation"

interface GameHeaderProps {
  team?: Team
  showNav?: boolean
  className?: string
}

// Trilha de navegacao (estilo EA FC Manager): [w] SecaoPai > PaginaAtual
// Mapeia o inicio da rota para { secao pai, href do pai, titulo da pagina }
interface RouteMeta {
  parent: string
  parentHref: string
  title: string
}
const ROUTE_META: { prefix: string; meta: RouteMeta }[] = [
  { prefix: "/central", meta: { parent: "Inicio", parentHref: "/", title: "Central" } },
  { prefix: "/notificacoes", meta: { parent: "Notificacoes", parentHref: "/notificacoes", title: "Caixa de Entrada" } },
  { prefix: "/mensagens", meta: { parent: "Notificacoes", parentHref: "/notificacoes", title: "Mensagens" } },
  { prefix: "/elenco/gerenciamento", meta: { parent: "Elenco", parentHref: "/elenco", title: "Gerenciamento" } },
  { prefix: "/elenco/taticas", meta: { parent: "Elenco", parentHref: "/elenco", title: "Taticas" } },
  { prefix: "/elenco/escalacoes", meta: { parent: "Elenco", parentHref: "/elenco", title: "Escalacoes" } },
  { prefix: "/elenco", meta: { parent: "Elenco", parentHref: "/elenco", title: "Visao Geral" } },
  { prefix: "/taticas", meta: { parent: "Elenco", parentHref: "/elenco", title: "Taticas" } },
  { prefix: "/vestiario", meta: { parent: "Elenco", parentHref: "/elenco", title: "Vestiario" } },
  { prefix: "/adversarios", meta: { parent: "Elenco", parentHref: "/elenco", title: "Adversarios" } },
  { prefix: "/transferencias", meta: { parent: "Transferencias", parentHref: "/transferencias", title: "Visao Geral" } },
  { prefix: "/mercado", meta: { parent: "Transferencias", parentHref: "/transferencias", title: "Buscar Atletas" } },
  { prefix: "/olheiros", meta: { parent: "Transferencias", parentHref: "/transferencias", title: "Olheiros" } },
  { prefix: "/relatorios", meta: { parent: "Transferencias", parentHref: "/transferencias", title: "Relatorios" } },
  { prefix: "/contratos", meta: { parent: "Transferencias", parentHref: "/transferencias", title: "Contratos" } },
  { prefix: "/treinamento", meta: { parent: "Academia", parentHref: "/treinamento", title: "Treinamento" } },
  { prefix: "/financas", meta: { parent: "Escritorio", parentHref: "/financas", title: "Financas" } },
  { prefix: "/estatisticas", meta: { parent: "Escritorio", parentHref: "/financas", title: "Estatisticas: Atletas" } },
  { prefix: "/competicoes", meta: { parent: "Escritorio", parentHref: "/financas", title: "Competicoes" } },
  { prefix: "/calendario", meta: { parent: "Escritorio", parentHref: "/financas", title: "Calendario" } },
  { prefix: "/historico", meta: { parent: "Escritorio", parentHref: "/financas", title: "Historico" } },
  { prefix: "/reunioes", meta: { parent: "Escritorio", parentHref: "/financas", title: "Reunioes" } },
  { prefix: "/imprensa", meta: { parent: "Escritorio", parentHref: "/financas", title: "Imprensa" } },
  { prefix: "/infraestrutura", meta: { parent: "Escritorio", parentHref: "/financas", title: "Infraestrutura" } },
  { prefix: "/analise-partida", meta: { parent: "Escritorio", parentHref: "/financas", title: "Analise da Partida" } },
  { prefix: "/configuracoes", meta: { parent: "Personalizar", parentHref: "/configuracoes", title: "Configuracoes" } },
  { prefix: "/salvar", meta: { parent: "Personalizar", parentHref: "/configuracoes", title: "Salvar" } },
]
function getRouteMeta(pathname: string): RouteMeta {
  const found = ROUTE_META.find((r) => pathname.startsWith(r.prefix))
  return found?.meta || { parent: "Inicio", parentHref: "/", title: "Escritorio" }
}

// Pequeno "key chip" de teclado
function KeyCap({ label, className }: { label: string; className?: string }) {
  return (
    <kbd
      className={cn(
        "inline-flex h-[16px] min-w-[16px] items-center justify-center rounded-[4px] px-1",
        "border border-white/20 bg-white/[0.06] font-mono text-[9px] font-semibold text-white/70",
        className,
      )}
    >
      {label}
    </kbd>
  )
}

// Barra de "forma" (ultimos resultados) estilo EA FC
function FormBars({ results }: { results: ("V" | "E" | "D")[] }) {
  const color = (r: string) =>
    r === "V" ? "bg-[#00ffc8]" : r === "E" ? "bg-white/35" : "bg-red-500/70"
  return (
    <div className="hidden md:flex items-center gap-[3px]">
      {results.map((r, i) => (
        <span key={i} className={cn("h-3.5 w-[3px] rounded-full", color(r))} />
      ))}
    </div>
  )
}

export function GameHeader({ team, showNav = true, className }: GameHeaderProps) {
  const pathname = usePathname()
  const { state, setState } = useGameState()
  const { advanceWeek: advanceGameWeek, currentWeek, currentSeason, seasonCalendar } = useGameManager()
  const userTeam = team || getTeamByShort(state.selectedTeamShort || "BGT") || serieATeams[0]
  const routeMeta = getRouteMeta(pathname)

  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [advancing, setAdvancing] = useState(false)
  const [showNotifications, setShowNotifications] = useState(false)
  const [showCoachDropdown, setShowCoachDropdown] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowCoachDropdown(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  const coachData = {
    nome: "Voce",
    cargo: "Tecnico Principal",
    partidasTotal: 24,
    vitorias: 16,
    empates: 5,
    derrotas: 3,
    aproveitamento: Math.round(((16 * 3 + 5) / (24 * 3)) * 100),
    titulosTemporada: 0,
    sequencia: "+5V",
  }

  const form: ("V" | "E" | "D")[] = ["V", "V", "E", "V", "D"]

  const handleSave = async () => {
    setSaving(true)
    await new Promise((resolve) => setTimeout(resolve, 500))
    setState({ updatedAt: Date.now() })
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const handleAdvance = async () => {
    setAdvancing(true)
    await new Promise((resolve) => setTimeout(resolve, 300))
    await advanceGameWeek()
    setAdvancing(false)
    if (seasonCalendar.nextUserMatch) {
      hardNavigate("/partida")
    }
  }

  return (
    <header
      className={cn(
        "sticky top-0 z-30 flex h-16 items-center justify-between bg-[#070708]/95 backdrop-blur-xl border-b border-white/[0.06] pl-3 pr-5",
        className,
      )}
    >
      {/* Esquerda: emblema circular "mc" + trilha [w] SecaoPai > PaginaAtual */}
      <div className="flex items-center gap-4 min-w-0">
        {/* Emblema circular estilo "mc" */}
        <Link
          href="/"
          aria-label="Inicio"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/30 bg-transparent text-[14px] font-bold italic tracking-tight text-white/85 transition-colors hover:border-white/50 hover:text-white"
          style={{ fontFamily: "var(--font-display, var(--font-oswald)), sans-serif" }}
        >
          UF
        </Link>

        {/* Trilha de navegacao */}
        {showNav && (
          <nav className="flex items-end gap-4 min-w-0 overflow-x-auto scrollbar-none">
            {/* Secao pai (dimmed) com keycap [w] */}
            <Link
              href={routeMeta.parentHref}
              className="group relative flex shrink-0 flex-col items-center gap-1"
            >
              <KeyCap label="W" className="opacity-70" />
              <span className="whitespace-nowrap text-[15px] font-semibold tracking-wide text-white/40 transition-colors group-hover:text-white/70">
                {routeMeta.parent}
              </span>
            </Link>

            {/* Pagina atual (bold/branco) */}
            <span className="shrink-0 whitespace-nowrap pb-[2px] text-[17px] font-extrabold tracking-tight text-white">
              {routeMeta.title}
            </span>
          </nav>
        )}
      </div>

      {/* Direita: acoes + widget do clube */}
      <div className="flex items-center gap-3 shrink-0">
        {/* Info temporada/rodada */}
        <div className="hidden xl:flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white/[0.03] border border-white/[0.06]">
          <Calendar className="h-3.5 w-3.5 text-[#00ffc8]" />
          <span className="text-[10px] text-white/45 font-medium">{currentSeason}</span>
          <span className="text-white/15">|</span>
          <span className="text-[10px] text-white/45">Rod</span>
          <span className="text-[11px] text-white font-semibold">
            {currentWeek}
            <span className="text-white/30">/38</span>
          </span>
        </div>

        {/* Salvar */}
        <button
          onClick={handleSave}
          disabled={saving}
          aria-label="Salvar jogo"
          className={cn(
            "flex h-8 w-8 items-center justify-center rounded-md transition-all",
            saved ? "text-[#00ffc8] bg-[#00ffc8]/10" : "text-white/45 hover:text-white/80 hover:bg-white/5",
            saving && "opacity-50 cursor-wait",
          )}
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : saved ? <Check className="h-4 w-4" /> : <Save className="h-4 w-4" />}
        </button>

        {/* Avancar */}
        <button
          onClick={handleAdvance}
          disabled={advancing}
          className={cn(
            "eafc-btn flex items-center gap-2 px-4 py-2 text-[11px] font-bold tracking-wider uppercase",
            advancing && "opacity-50 cursor-wait",
          )}
        >
          {advancing ? <Loader2 className="h-4 w-4 animate-spin" /> : <FastForward className="h-4 w-4" />}
          <span className="hidden sm:inline">Avancar</span>
        </button>

        <NotificationBell onClick={() => setShowNotifications(true)} />

        <Link
          href="/configuracoes"
          aria-label="Configuracoes"
          className="flex h-8 w-8 items-center justify-center rounded-md text-white/45 hover:text-white/80 hover:bg-white/5 transition-colors"
        >
          <Settings className="h-4 w-4" />
        </Link>

        <NotificationCenter isOpen={showNotifications} onClose={() => setShowNotifications(false)} />

        {/* Widget do clube: escudo + forma + estrela (dropdown do tecnico) */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setShowCoachDropdown(!showCoachDropdown)}
            className={cn(
              "flex items-center gap-2.5 rounded-lg border border-white/[0.06] py-1 pl-2 pr-2.5 transition-all",
              showCoachDropdown ? "bg-white/10" : "hover:bg-white/5",
            )}
          >
            <TeamCrest team={userTeam} size="sm" />
            <div className="hidden md:flex flex-col items-start leading-none gap-1">
              <span className="text-[12px] font-bold text-white">{userTeam.curto}</span>
              <FormBars results={form} />
            </div>
            <Star className="hidden lg:block h-3.5 w-3.5 text-[#ffd700] fill-[#ffd700]" />
            <ChevronDown className={cn("h-3 w-3 text-white/40 transition-transform", showCoachDropdown && "rotate-180")} />
          </button>

          {/* Dropdown do tecnico */}
          {showCoachDropdown && (
            <div className="absolute top-full right-0 mt-2 w-80 rounded-xl border border-white/[0.08] bg-[#0a0a0c]/98 shadow-2xl overflow-hidden z-50 animate-fade-in backdrop-blur-xl">
              <div className="p-5 border-b border-white/[0.04] bg-gradient-to-r from-[#00ffc8]/10 via-transparent to-transparent">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-full bg-gradient-to-br from-[#00ffc8]/20 to-[#00c8ff]/10 flex items-center justify-center ring-2 ring-[#00ffc8]/20">
                    <User className="h-7 w-7 text-[#00ffc8]" />
                  </div>
                  <div>
                    <div className="text-sm font-bold text-white">{coachData.nome}</div>
                    <div className="text-[10px] text-[#00ffc8]/70 uppercase tracking-wider font-medium">{coachData.cargo}</div>
                  </div>
                </div>
              </div>

              <div className="p-5 space-y-4">
                <div className="text-[10px] font-semibold text-white/30 uppercase tracking-wider flex items-center gap-2">
                  <Trophy className="h-3 w-3 text-[#ffd700]" />
                  Estatisticas da Temporada
                </div>

                <div className="grid grid-cols-4 gap-2">
                  <div className="text-center p-3 rounded-lg bg-white/[0.03] border border-white/[0.04]">
                    <div className="text-lg font-bold text-white">{coachData.partidasTotal}</div>
                    <div className="text-[9px] text-white/40 uppercase">Jogos</div>
                  </div>
                  <div className="text-center p-3 rounded-lg bg-[#00ffc8]/10 border border-[#00ffc8]/20">
                    <div className="text-lg font-bold text-[#00ffc8]">{coachData.vitorias}</div>
                    <div className="text-[9px] text-white/40 uppercase">V</div>
                  </div>
                  <div className="text-center p-3 rounded-lg bg-[#ffd700]/10 border border-[#ffd700]/20">
                    <div className="text-lg font-bold text-yellow-400">{coachData.empates}</div>
                    <div className="text-[9px] text-white/40 uppercase">E</div>
                  </div>
                  <div className="text-center p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                    <div className="text-lg font-bold text-red-400">{coachData.derrotas}</div>
                    <div className="text-[9px] text-white/40 uppercase">D</div>
                  </div>
                </div>

                <div className="flex items-center justify-between p-3.5 rounded-lg bg-white/[0.03] border border-white/[0.04]">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-[#00ffc8]" />
                    <span className="text-xs text-white/60">Aproveitamento</span>
                  </div>
                  <span className="text-sm font-bold text-[#00ffc8]">{coachData.aproveitamento}%</span>
                </div>

                <div className="flex items-center justify-between p-3.5 rounded-lg bg-white/[0.03] border border-white/[0.04]">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-white/40" />
                    <span className="text-xs text-white/60">Sequencia</span>
                  </div>
                  <span className="text-sm font-bold text-[#00ffc8]">{coachData.sequencia}</span>
                </div>

                <div className="flex items-center justify-between p-3.5 rounded-lg bg-white/[0.03] border border-white/[0.04]">
                  <div className="flex items-center gap-2">
                    <Trophy className="h-4 w-4 text-yellow-400" />
                    <span className="text-xs text-white/60">Titulos na Temporada</span>
                  </div>
                  <span className="text-sm font-bold text-white">{coachData.titulosTemporada}</span>
                </div>
              </div>

              <div className="p-4 border-t border-white/[0.04] bg-white/[0.01]">
                <Link
                  href="/perfil"
                  onClick={() => setShowCoachDropdown(false)}
                  className="flex items-center justify-center gap-2 w-full py-2.5 text-xs font-semibold text-[#00ffc8] hover:text-[#00ffdc] transition-colors rounded-lg hover:bg-[#00ffc8]/10"
                >
                  Ver perfil completo
                  <ChevronRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
