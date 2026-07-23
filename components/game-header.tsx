"use client"

import Link from "next/link"
import Image from "next/image"
import { usePathname, useRouter } from "next/navigation"
import { useState, useRef, useEffect, useMemo } from "react"
import { Save, FastForward, Settings, Check, Loader2, ChevronDown, User, Trophy, Calendar, TrendingUp, ChevronRight, Star, LogOut, Bell, Sprout } from "lucide-react"
import { TeamCrest } from "@/components/team-crest"
import { ManagerAvatar } from "@/components/manager-avatar"
import { getTeamByShort, serieATeams, type Team } from "@/lib/teams-data"
import { podeSalvarCarreira, saveGameStateAndFlush, useGameState } from "@/lib/save-system"
import { persistGameEngineNow } from "@/lib/game-engine"
import { useGameManager } from "@/lib/use-game-manager"
import { clearJobOffers } from "@/lib/career-moves"
import { cn } from "@/lib/utils"
import { hardNavigate } from "@/lib/hard-navigation"
import { getGameDate } from "@/lib/game-date"

const MONTHS_SHORT = ["JAN", "FEV", "MAR", "ABR", "MAI", "JUN", "JUL", "AGO", "SET", "OUT", "NOV", "DEZ"]

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
  const router = useRouter()
  const { state, setState } = useGameState()
  const { advanceWeek: advanceGameWeek, currentWeek, currentSeason, seasonCalendar } = useGameManager()
  const userTeam = team || getTeamByShort(state.selectedTeamShort || "BGT") || serieATeams[0]
  const routeMeta = getRouteMeta(pathname)

  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [advancing, setAdvancing] = useState(false)
  // Data "correndo" durante o avanco (animacao dia a dia)
  const [advanceDate, setAdvanceDate] = useState<Date | null>(null)
  const [showCoachDropdown, setShowCoachDropdown] = useState(false)
  const [showNavMenu, setShowNavMenu] = useState(false)
  const [showResignConfirm, setShowResignConfirm] = useState(false)

  // Pedir demissao: sai do clube e volta ao menu (o progresso ja e salvo sozinho).
  // Mesma acao do card do escritorio, agora acessivel de qualquer tela pelo menu [W].
  const handleResign = () => {
    clearJobOffers()
    setState({ selectedTeamShort: null })
    hardNavigate("/sem-clube")
  }
  // Item destacado no menu de navegacao — so existe para o CONTROLE (no mouse o hover
  // ja resolve). Sem isto, o menu que criei nao era utilizavel no gamepad.
  const [navMenuIndex, setNavMenuIndex] = useState(0)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // No export estático as páginas são baixadas na primeira visita. Aquecemos as
  // rotas mais usadas depois que o cabeçalho já desenhou, sem bloquear a tela nem
  // desperdiçar memória com todas as páginas do jogo.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      for (const href of ["/", "/elenco", "/mercado", "/calendario", "/competicoes"]) {
        router.prefetch(href)
      }
    }, 700)
    return () => window.clearTimeout(timer)
  }, [router])

  // Atalho "W": abre o MENU de navegacao (o keycap [W] sempre existiu, mas a tecla nao
  // fazia nada). Antes W ia direto para a secao pai; o usuario pediu um menu com as
  // opcoes de todas as paginas.
  useEffect(() => {
    if (!showNav) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { setShowNavMenu(false); return }
      if (e.key.toLowerCase() !== "w" || e.ctrlKey || e.altKey || e.metaKey) return
      const el = document.activeElement as HTMLElement | null
      if (
        el && (
          el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" ||
          el.isContentEditable || el.getAttribute("role") === "slider"
        )
      ) return
      if (document.querySelector('[role="dialog"][data-state="open"]')) return
      e.preventDefault()
      setShowNavMenu((v) => !v)
    }
    // CONTROLE abre o menu: Y ou START (Options no PS) — o mesmo mapeamento que a
    // tela de Configuracoes ja documentava ("Y = Menu · START = Menu/Pausar"),
    // mas nenhum botao chegava a ABRIR o menu, so a tecla W. Sem input de texto
    // no controle, nao precisa da guarda de campo focado.
    const onPad = (e: Event) => {
      if (document.querySelector('[role="dialog"][data-state="open"]')) return
      const { button } = (e as CustomEvent<{ button: string }>).detail || {}
      if (button === "Y" || button === "START") setShowNavMenu((v) => !v)
    }
    window.addEventListener("keydown", onKey)
    window.addEventListener("gamepad:button", onPad)
    return () => {
      window.removeEventListener("keydown", onKey)
      window.removeEventListener("gamepad:button", onPad)
    }
  }, [showNav])

  // CONTROLE no menu de navegacao: D-pad move, A confirma, B/Y fecha.
  // (O menu foi criado depois do sistema de gamepad, entao nao respondia ao controle.)
  useEffect(() => {
    if (!showNavMenu) return
    const onPad = (e: Event) => {
      const { button } = (e as CustomEvent<{ button: string }>).detail
      const last = NAV_MENU_ITEMS.length - 1
      // O menu e uma grade de 3 colunas (sm:grid-cols-3).
      const COLS = 3
      switch (button) {
        case "DPAD_LEFT":
          setNavMenuIndex((i) => (i <= 0 ? last : i - 1)); break
        case "DPAD_RIGHT":
          setNavMenuIndex((i) => (i >= last ? 0 : i + 1)); break
        case "DPAD_UP":
          setNavMenuIndex((i) => Math.max(0, i - COLS)); break
        case "DPAD_DOWN":
          setNavMenuIndex((i) => Math.min(last, i + COLS)); break
        case "A": {
          const item = NAV_MENU_ITEMS[navMenuIndex]
          if (item) { setShowNavMenu(false); hardNavigate(item.href) }
          break
        }
        case "B":
        case "Y":
          setShowNavMenu(false); break
      }
    }
    window.addEventListener("gamepad:button", onPad)
    return () => window.removeEventListener("gamepad:button", onPad)
  }, [showNavMenu, navMenuIndex])

  // Ao abrir o menu, comeca no item da secao atual (nao sempre no primeiro).
  useEffect(() => {
    if (!showNavMenu) return
    const current = NAV_MENU_ITEMS.findIndex(
      (item) => item.href !== "/" && pathname.startsWith(item.href),
    )
    setNavMenuIndex(current >= 0 ? current : 0)
  }, [showNavMenu, pathname])

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowCoachDropdown(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  // Estatisticas REAIS da temporada, derivadas das partidas ja jogadas do usuario
  // no calendario (antes eram valores fixos: 24 jogos / 16V / 5E / 3D / +5V).
  const { coachData, form } = useMemo(() => {
    const userCurto = userTeam.curto
    const jogadas = (seasonCalendar?.fixtures ?? []).filter(
      f => f.isUserMatch && f.played && f.homeScore !== undefined && f.awayScore !== undefined,
    )

    const resultados: ("V" | "E" | "D")[] = jogadas.map(f => {
      const isHome = f.homeTeam.curto === userCurto
      const pro = (isHome ? f.homeScore : f.awayScore) as number
      const contra = (isHome ? f.awayScore : f.homeScore) as number
      return pro > contra ? "V" : pro === contra ? "E" : "D"
    })

    const vitorias = resultados.filter(r => r === "V").length
    const empates = resultados.filter(r => r === "E").length
    const derrotas = resultados.filter(r => r === "D").length
    const partidasTotal = resultados.length
    const aproveitamento =
      partidasTotal > 0 ? Math.round(((vitorias * 3 + empates) / (partidasTotal * 3)) * 100) : 0

    // Sequencia atual: quantos resultados iguais seguidos a partir do ultimo jogo.
    let sequencia = "-"
    if (resultados.length > 0) {
      const invertido = [...resultados].reverse()
      const tipo = invertido[0]
      let n = 0
      for (const r of invertido) {
        if (r !== tipo) break
        n++
      }
      sequencia = tipo === "V" ? `+${n}V` : tipo === "D" ? `-${n}D` : `${n}E`
    }

    const titulosTemporada = (state.seasonHistory ?? []).filter(
      s => s.season === currentSeason && s.champion === userTeam.nome,
    ).length

    return {
      coachData: {
        nome: state.managerName || "Voce",
        cargo: "Tecnico Principal",
        partidasTotal,
        vitorias,
        empates,
        derrotas,
        aproveitamento,
        titulosTemporada,
        sequencia,
      },
      form: resultados.slice(-5),
    }
  }, [seasonCalendar, userTeam.curto, userTeam.nome, state.managerName, state.seasonHistory, currentSeason])

  // O jogo e organizado por temporada (comecando 01/01) e nao por "rodada" isolada —
  // mostra a data corrente do calendario em vez de um contador de rodadas.
  // Durante o avanco mostra a data da animacao (dia a dia); fora dele, a data real.
  const gameDate = advanceDate ?? getGameDate(currentSeason, currentWeek)
  const gameDateLabel = `${gameDate.getDate().toString().padStart(2, "0")} ${MONTHS_SHORT[gameDate.getMonth()]}`

  const handleSave = async () => {
    // Sem carreira iniciada no pre-office nao ha o que salvar.
    if (!podeSalvarCarreira(state)) return
    setSaving(true)
    persistGameEngineNow()
    await saveGameStateAndFlush({ ...state, updatedAt: Date.now() })
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  // Avanca com animacao DIA A DIA (imersao) em vez de pular a semana de uma vez.
  // O engine continua avancando por semana: a data corre os 7 dias e so entao a
  // rodada e simulada.
  const handleAdvance = async () => {
    if (advancing) return
    setAdvancing(true)

    const start = getGameDate(currentSeason, currentWeek)
    for (let d = 1; d <= 7; d++) {
      setAdvanceDate(new Date(start.getTime() + d * 86_400_000))
      await new Promise(resolve => setTimeout(resolve, 95))
    }

    await advanceGameWeek()
    setAdvanceDate(null)
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
        {/* Logo UF26 */}
        <Link
          href="/"
          aria-label="Inicio"
          onClick={(e) => { e.preventDefault(); hardNavigate("/") }}
          className="flex h-11 shrink-0 items-center justify-center rounded-lg px-1 transition-opacity hover:opacity-80"
        >
          <Image
            src="/brand/uf26-logo.png"
            alt="UF26"
            width={120}
            height={44}
            className="h-9 w-auto object-contain"
            priority
          />
        </Link>

        {/* Trilha de navegacao */}
        {showNav && (
          <nav className="flex items-end gap-4 min-w-0 overflow-x-auto scrollbar-none">
            {/* [W] abre o MENU de navegacao (paginas do jogo). */}
            <button
              type="button"
              onClick={() => setShowNavMenu((v) => !v)}
              className="group relative flex shrink-0 flex-col items-center gap-1"
            >
              <KeyCap label="W" className="opacity-70" />
              <span className="whitespace-nowrap text-[15px] font-semibold tracking-wide text-white/40 transition-colors group-hover:text-white/70">
                {routeMeta.parent}
              </span>
            </button>

            {/* Pagina atual (bold/branco) */}
            <span className="shrink-0 whitespace-nowrap pb-[2px] text-[17px] font-extrabold tracking-tight text-white">
              {routeMeta.title}
            </span>
          </nav>
        )}
      </div>

      {/* Direita: acoes + widget do clube */}
      <div className="flex items-center gap-3 shrink-0">
        {/* Info temporada/calendario (data real, nao contador de rodada) */}
        <div className="hidden xl:flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white/[0.03] border border-white/[0.06]">
          <Calendar className="h-3.5 w-3.5 text-[#00ffc8]" />
          <span className="text-[10px] text-white/45 font-medium">Temporada {currentSeason}</span>
          <span className="text-white/15">|</span>
          <span className="text-[11px] text-white font-semibold">{gameDateLabel}</span>
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

        {/* O sino abria um drawer que sumia a cada navegação e passava
            despercebido — mensagens da diretoria e propostas ficavam sem
            resposta. A Central de Notificações agora é uma TELA do menu [W], e
            o escritório redireciona para ela enquanto houver algo não lido. */}

        <Link
          href="/configuracoes"
          aria-label="Configuracoes"
          onClick={(e) => { e.preventDefault(); hardNavigate("/configuracoes") }}
          className="flex h-8 w-8 items-center justify-center rounded-md text-white/45 hover:text-white/80 hover:bg-white/5 transition-colors"
        >
          <Settings className="h-4 w-4" />
        </Link>

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
                  <div className="w-14 h-14 rounded-full overflow-hidden bg-gradient-to-br from-[#00ffc8]/20 to-[#00c8ff]/10 ring-2 ring-[#00ffc8]/20">
                    <ManagerAvatar
                      src={state.managerAvatar}
                      className="w-14 h-14"
                      iconClassName="h-7 w-7 text-[#00ffc8]"
                    />
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

              <div className="p-4 border-t border-white/[0.04] bg-white/[0.01] space-y-1">
                <Link
                  href="/configuracoes"
                  onClick={(e) => { e.preventDefault(); setShowCoachDropdown(false); hardNavigate("/configuracoes") }}
                  className="flex items-center justify-center gap-2 w-full py-2.5 text-xs font-semibold text-[#00ffc8] hover:text-[#00ffdc] transition-colors rounded-lg hover:bg-[#00ffc8]/10"
                >
                  Ver perfil completo
                  <ChevronRight className="h-3.5 w-3.5" />
                </Link>

                {/* Sair para a selecao de saves. Antes, do escritorio, o jogador ficava
                    "preso" — nao havia como trocar de save de proposito. O progresso ja e
                    salvo automaticamente (persistent-store), entao sair e seguro. */}
                <button
                  type="button"
                  onClick={() => { setShowCoachDropdown(false); hardNavigate("/splash?menu=1") }}
                  className="flex items-center justify-center gap-2 w-full py-2.5 text-xs font-semibold text-white/60 hover:text-white transition-colors rounded-lg hover:bg-white/5"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  Sair para o Menu
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Menu de navegacao (tecla W ou clique na secao pai). */}
      {showNavMenu && (
        <div
          className="fixed inset-0 z-[70] bg-black/55 backdrop-blur-[7px]"
          onClick={() => setShowNavMenu(false)}
        >
          <div
          className="absolute left-5 top-16 flex max-h-[calc(100vh-4rem)] w-[min(292px,88vw)] flex-col overflow-hidden border-l border-white/10 bg-gradient-to-r from-[#07090d]/98 via-[#090c11]/94 to-[#090c11]/75 shadow-[28px_0_70px_rgba(0,0,0,.48)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex-1 space-y-0.5 overflow-y-auto px-3 py-2">
              {NAV_MENU_ITEMS.map((item, i) => {
                const Icon = item.icon
                const active = pathname.startsWith(item.href) && item.href !== "/"
                // Item sob o cursor do CONTROLE (no mouse, o hover ja indica).
                const focused = i === navMenuIndex
                return (
                  <button
                    key={item.href}
                    onClick={() => { setShowNavMenu(false); hardNavigate(item.href) }}
                    onMouseEnter={() => setNavMenuIndex(i)}
                    className={cn(
                      "relative flex w-full items-center gap-3 border-l-2 px-3 py-2.5 text-left transition-all",
                      focused
                        ? "border-l-[#00ffc8] bg-gradient-to-r from-[#00ffc8]/16 to-transparent"
                        : active
                          ? "border-l-[#00ffc8]/60 bg-white/[0.05]"
                          : "border-l-transparent hover:border-l-white/25 hover:bg-white/[0.035]",
                    )}
                  >
                    <Icon className={cn("h-4 w-4 shrink-0", focused || active ? "text-[#00ffc8]" : "text-white/50")} />
                    <span className={cn("text-sm font-semibold", focused || active ? "text-white" : "text-white/55")}>{item.label}</span>
                  </button>
                )
              })}
            </div>

            {/* Pedir demissao — acao destrutiva, separada da grade de navegacao. */}
            <div className="border-t border-white/[0.06] p-3">
              <button
                type="button"
                onClick={() => { setShowNavMenu(false); setShowResignConfirm(true) }}
                className="flex w-full items-center gap-3 border-l-2 border-l-red-400/60 bg-red-500/5 px-3 py-2.5 text-sm font-semibold text-red-300/90 transition-colors hover:bg-red-500/10 hover:text-red-200"
              >
                <LogOut className="h-4 w-4" />
                Pedir demissao
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmacao da demissao: irreversivel, exige confirmar (teclado Enter/Esc, controle A/B). */}
      {showResignConfirm && (
        <ResignConfirmDialog
          teamName={userTeam.nome}
          onCancel={() => setShowResignConfirm(false)}
          onConfirm={handleResign}
        />
      )}
    </header>
  )
}

// Aviso de demissao. Esc/B cancela, Enter/A confirma (teclado + controle).
function ResignConfirmDialog({ teamName, onCancel, onConfirm }: { teamName: string; onCancel: () => void; onConfirm: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.preventDefault(); e.stopImmediatePropagation(); onCancel() }
      else if (e.key === "Enter") { e.preventDefault(); e.stopImmediatePropagation(); onConfirm() }
    }
    const onPad = (e: Event) => {
      const { button } = (e as CustomEvent<{ button: string }>).detail
      if (button === "A") onConfirm()
      else if (button === "B") onCancel()
    }
    document.addEventListener("keydown", onKey, true)
    window.addEventListener("gamepad:button", onPad)
    return () => {
      document.removeEventListener("keydown", onKey, true)
      window.removeEventListener("gamepad:button", onPad)
    }
  }, [onCancel, onConfirm])

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={onCancel}>
      <div
        className="w-[400px] max-w-[90vw] rounded-2xl border border-white/10 bg-[#0c0c14] p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-bold text-white">Pedir demissao do {teamName}?</h2>
        <p className="mt-2 text-sm text-white/60">
          Voce encerra seu ciclo no clube e volta ao menu principal. O progresso e salvo
          automaticamente. Esta acao nao pode ser desfeita.
        </p>
        <div className="mt-6 flex justify-end gap-3">
          <button
            onClick={onCancel}
            className="rounded-lg px-4 py-2 text-sm font-semibold text-white/70 transition-colors hover:bg-white/10"
          >
            Cancelar <span className="text-white/30">(Esc)</span>
          </button>
          <button
            onClick={onConfirm}
            className="rounded-lg bg-red-500 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-red-400"
          >
            Confirmar demissao <span className="text-white/50">(Enter)</span>
          </button>
        </div>
      </div>
    </div>
  )
}

// Paginas do menu de navegacao rapida (tecla W).
const NAV_MENU_ITEMS: { label: string; href: string; icon: typeof Save }[] = [
  { label: "Escritorio", href: "/", icon: Trophy },
  { label: "Area do Treinador", href: "/treinador", icon: User },
  { label: "Notificacoes", href: "/notificacoes", icon: Bell },
  { label: "Elenco", href: "/elenco", icon: User },
  { label: "Juniores", href: "/base", icon: Sprout },
  { label: "Taticas", href: "/elenco/taticas", icon: Settings },
  { label: "Mercado", href: "/mercado", icon: TrendingUp },
  { label: "Calendario", href: "/calendario", icon: Calendar },
  { label: "Competicoes", href: "/competicoes", icon: Trophy },
  { label: "Classificacao", href: "/competicoes", icon: TrendingUp },
  { label: "Financas", href: "/financas", icon: TrendingUp },
  { label: "Treinamento", href: "/treinamento", icon: User },
  { label: "Infraestrutura", href: "/infraestrutura", icon: Settings },
  { label: "Configuracoes", href: "/configuracoes", icon: Settings },
]
