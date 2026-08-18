"use client"

import { useState, useEffect, useSyncExternalStore } from "react"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { motion } from "framer-motion"
import {
  Settings,
  User,
  Globe,
  Clock,
  Users,
  Grid2X2,
  Music,
  ChevronLeft,
  ChevronRight,
  Volume2,
  Gamepad2,
  Bell,
  Eye,
  Save,
  RotateCcw,
  Palette,
  Check,
  Loader2,
  Plus,
  Award,
  Heart,
  ExternalLink,
  HelpCircle,
  Keyboard,
  DollarSign,
  RefreshCw,
  X, Building2, Swords } from "lucide-react"
import { GameHeader } from "@/components/game-header"
import { IDIOMAS } from "@/lib/i18n"
import { NIVEIS, DIFICULDADE_PADRAO } from "@/lib/dificuldade"
import { AtualizacoesPanel } from "@/components/atualizacoes-panel"
import { SeloRegistrado } from "@/components/registro-necessario"
import { anunciarSfx } from "@/lib/sfx-volume"
import { accessibilityStore } from "@/lib/accessibility-store"
import { hardNavigate } from "@/lib/hard-navigation"
import { useGameEngine } from "@/lib/game-engine"
import {
  listSavedLineups,
  saveLineup,
  deleteLineup,
  type SavedLineup,
} from "@/lib/saved-lineups"
import { ManagerAvatarPicker } from "@/components/manager-avatar"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { isFullscreenEnabled, setFullscreen } from "@/lib/fullscreen"
import { CURRENCIES, setCurrency, getCurrencyCode } from "@/lib/currency"
import { Slider } from "@/components/ui/slider"
import { useTheme, themePresets, type ThemeColor } from "@/components/theme-provider"
import { useGameState, type ManagerProfile } from "@/lib/save-system"
import { useUserTeam } from "@/lib/time-da-carreira"
import { cn } from "@/lib/utils"
import { ControllerTypeContext, ControllerButton } from "@/components/controller-buttons"
import { CONTROL_MAPPINGS, ACTION_LABELS, type GameContext, type GameAction } from "@/lib/gamepad-controls"
import { useTranslation } from "@/lib/i18n"
import { applyPerformanceProfile, PERFORMANCE_STORAGE_KEY, type PerformanceProfile } from "@/components/performance-profile"

type ViewType = "menu" | "configuracoes" | "perfil" | "online" | "atualizacoes" | "tempo" | "escalacoes" | "musica" | "creditos" | "tutorial" | "infraestrutura"

const menuCards = [
  { id: "configuracoes" as ViewType, title: "Configuracoes", icon: Settings, row: 0 },
  { id: "perfil" as ViewType, title: "Perfil", icon: User, row: 0 },
  { id: "online" as ViewType, title: "Configuracoes\nonline", icon: Globe, row: 0 },
  // ATUALIZACOES: elencos, times e versao do jogo — sempre com consentimento.
  { id: "atualizacoes" as ViewType, title: "Atualizacoes", icon: RefreshCw, row: 1 },
  { id: "tempo" as ViewType, title: "Tempo de jogo", icon: Clock, row: 0 },
  { id: "escalacoes" as ViewType, title: "Escalacoes", icon: Grid2X2, row: 1 },
  { id: "musica" as ViewType, title: "Musica", icon: Music, row: 1 },
  { id: "creditos" as ViewType, title: "Creditos", icon: Award, row: 1 },
  { id: "tutorial" as ViewType, title: "Tutorial\ne Controles", icon: HelpCircle, row: 2 },
  // INFRAESTRUTURA vive aqui (pedido: "configuracoes e infraestrutura num so").
  // Nao e uma view interna — leva para a tela propria, que ja existe e e grande.
  { id: "infraestrutura" as ViewType, title: "Infraestrutura", icon: Building2, row: 2 },
]

// A lista de idiomas vem do REGISTRO (lib/i18n): era mantida aqui à mão, em
// paralelo ao mapa de traduções — duas listas para a mesma coisa. Agora um
// idioma novo aparece no seletor no momento em que o arquivo dele existe.
const languageOptions = IDIOMAS.map(i => ({ id: i.id, label: i.label, flag: i.flag, releaseStatus: i.releaseStatus }))

// "Padrão" deixou de ser um narrador: os sete efeitos curtos dele agora tocam
// SEMPRE, por baixo de qualquer voz (lib/audio-commentary.ts). Escolher "Padrão"
// virou, na pratica, escolher NAO ter voz — e o rotulo precisa dizer isso, senao
// a lista sugere que as outras oito opcoes trocam os efeitos, e elas somam.
const commentaryVoices = [
  ["padrao", "Padrão (só efeitos, sem voz)"], ["andre-hening", "André Hening"], ["cleber-machado", "Cléber Machado"],
  ["gustavo-villani", "Gustavo Villani"], ["jorge-igor", "Jorge Igor"], ["luis-roberto", "Luis Roberto"],
  ["luiz-felipe-freitas", "Luiz Felipe Freitas"], ["nivaldo-prieto", "Nivaldo Prieto"], ["rogerio-vaughan", "Rogério Vaughan"],
] as const


export default function ConfiguracoesPage() {
  const { theme, setTheme, teamColors, setTeamColors } = useTheme()
  const { state, setState } = useGameState()
  const { team: userTeam } = useUserTeam()
  const t = useTranslation()

  const cardTitles: Record<string, string> = {
    configuracoes: t.settings.cards.settings,
    perfil: t.settings.cards.profile,
    online: t.settings.cards.online,
    atualizacoes: t.settings.cards.updates,
    tempo: t.settings.cards.gameTime,
    escalacoes: t.settings.cards.lineups,
    musica: t.settings.cards.music,
    creditos: t.settings.cards.credits,
    tutorial: t.settings.cards.tutorial,
  }

  const [currentView, setCurrentView] = useState<ViewType>("menu")
  const [selectedCardIndex, setSelectedCardIndex] = useState(0)

  // Abrir um cartao passa SO por aqui.
  //
  // Infraestrutura nao e uma view interna: e uma tela propria. O clique do mouse
  // ja tratava disso, mas teclado e controle chamavam setCurrentView direto — e o
  // cartao caia no `default` do switch, mostrando "em desenvolvimento". Com o
  // desvio centralizado, os tres caminhos abrem a mesma coisa.
  const abrirCard = (id: ViewType) => {
    if (id === "infraestrutura") hardNavigate("/infraestrutura")
    else setCurrentView(id)
  }

  // Gamepad support
  const router = useRouter()
  useEffect(() => {
    const handler = (e: Event) => {
      const btn = (e as CustomEvent).detail?.button
      if (!btn) return
      if (currentView !== 'menu') {
        if (btn === 'B') setCurrentView('menu')
        return
      }
      if (btn === 'DPAD_RIGHT') setSelectedCardIndex(prev => Math.min(prev + 1, menuCards.length - 1))
      else if (btn === 'DPAD_LEFT') setSelectedCardIndex(prev => Math.max(prev - 1, 0))
      else if (btn === 'DPAD_DOWN') setSelectedCardIndex(prev => Math.min(prev + 3, menuCards.length - 1))
      else if (btn === 'DPAD_UP') setSelectedCardIndex(prev => Math.max(prev - 3, 0))
      else if (btn === 'A') abrirCard(menuCards[selectedCardIndex].id)
      else if (btn === 'B') router.back()
    }
    window.addEventListener('gamepad:button', handler)
    return () => window.removeEventListener('gamepad:button', handler)
  }, [currentView, selectedCardIndex, router])
  // Inicia com o volume REAL do player (antes era fixo em 70 e desconectado).
  // musicVolume saiu: a trilha embutida foi removida e o volume da musica agora e do
  // proprio Spotify/player do sistema. Aqui so restam os efeitos sonoros (sfxVolume).
  // Estes quatro seguem o mesmo padrao do idioma e da moeda: gravam NA HORA.
  // Antes o volume dos efeitos e a velocidade de partida nao eram gravados em
  // lugar nenhum — mexer neles nao mudava nada no jogo e o valor voltava ao
  // padrao na proxima abertura.
  const [sfxVolume, setSfxVolume] = useState([state.sfxVolume ?? 80])
  const [commentaryEnabled, setCommentaryEnabled] = useState(state.commentaryEnabled ?? true)
  const [commentaryVoice, setCommentaryVoice] = useState(state.commentaryVoice ?? "padrao")
  const [commentaryVolume, setCommentaryVolume] = useState([state.commentaryVolume ?? 80])
  // Preferencias de acessibilidade (store singleton: sobrevive a navegacao).
  const a11y = useSyncExternalStore(
    accessibilityStore.subscribe,
    accessibilityStore.getSnapshot,
    accessibilityStore.getServerSnapshot,
  )

  const [autoSaveInterval, setAutoSaveInterval] = useState<0 | 1 | 3 | 5>(state.autoSaveInterval ?? 1)
  const [notifications, setNotifications] = useState(state.notificationsEnabled ?? true)
  const [fullscreen, setFullscreenState] = useState(false)
  useEffect(() => { setFullscreenState(isFullscreenEnabled()) }, [])
  const [matchSpeed, setMatchSpeed] = useState<"lento" | "normal" | "rapido">(state.matchSpeed ?? "normal")
  const [performanceProfile, setPerformanceProfile] = useState<PerformanceProfile>("balanced")
  useEffect(() => {
    const stored = localStorage.getItem(PERFORMANCE_STORAGE_KEY)
    if (stored === "economy" || stored === "quality" || stored === "balanced") setPerformanceProfile(stored)
  }, [])

  // Escalacoes salvas de VERDADE. Antes esta tela mostrava 3 cartoes chumbados
  // ("Escalacao Principal / Rotacao / Jovens", todos "4-3-3 - 11 jogadores" escritos no
  // HTML): nao havia escalacao salva nenhuma — nada era gravado nem carregado.
  const [savedLineups, setSavedLineups] = useState<SavedLineup[]>([])
  const [lineupMsg, setLineupMsg] = useState<string | null>(null)
  useEffect(() => { setSavedLineups(listSavedLineups()) }, [])

  /** Grava o 11 titular ATUAL do engine como uma escalacao reutilizavel. */
  const handleSaveCurrentLineup = () => {
    const engine = useGameEngine.getState()
    const starters = (engine.squadPlayers ?? []).filter((p) => p.isStarter)
    if (starters.length === 0) {
      setLineupMsg("Escale o time primeiro — não há titulares definidos.")
      setTimeout(() => setLineupMsg(null), 3000)
      return
    }
    saveLineup({
      name: `Escalação ${listSavedLineups().length + 1}`,
      formation: engine.formation ?? "4-3-3",
      starters: starters.map((p) => p.id),
      starterNames: starters.map((p) => p.name),
    })
    setSavedLineups(listSavedLineups())
    setLineupMsg(`Escalação salva com ${starters.length} jogadores.`)
    setTimeout(() => setLineupMsg(null), 3000)
  }
  const [selectedUniform, setSelectedUniform] = useState<"home" | "away" | "third">(state.selectedUniform || "home")
  const [language, setLanguage] = useState(state.language || "pt-BR")
  // Comeca em "BRL" (igual ao build) e le a preferencia real so apos montar, p/ nao arriscar
  // hidratacao no botao ativo.
  const [currencyCode, setCurrencyCode] = useState("BRL")
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [tutorialTab, setTutorialTab] = useState<"xbox" | "playstation" | "keyboard">("xbox")

  // Multiplayer state
  const [multiplayerEnabled, setMultiplayerEnabled] = useState(state.multiplayerEnabled || false)
  const [managers, setManagers] = useState<ManagerProfile[]>(state.managers || [])
  
  // Controller state
  const [controllerType, setControllerType] = useState<"auto" | "xbox" | "playstation">(state.controllerType || "auto")

  useEffect(() => {
    if (state.selectedUniform) setSelectedUniform(state.selectedUniform)
    if (state.language) setLanguage(state.language)
    if (state.multiplayerEnabled !== undefined) setMultiplayerEnabled(state.multiplayerEnabled)
    if (state.managers) setManagers(state.managers)
    if (state.controllerType) setControllerType(state.controllerType)
    if (state.autoSaveInterval !== undefined) setAutoSaveInterval(state.autoSaveInterval)
    if (state.sfxVolume !== undefined) setSfxVolume([state.sfxVolume])
    if (state.matchSpeed) setMatchSpeed(state.matchSpeed)
    if (state.notificationsEnabled !== undefined) setNotifications(state.notificationsEnabled)
  }, [state])

  useEffect(() => { setCurrencyCode(getCurrencyCode()) }, [])

  useEffect(() => {
    if (theme === "team" && !teamColors) {
      setTeamColors({ primary: userTeam.cor1, secondary: userTeam.cor2 })
    }
  }, [theme, teamColors, setTeamColors, userTeam])

  const handleSaveSettings = async () => {
    setSaving(true)
    await new Promise(resolve => setTimeout(resolve, 500))
    // Salvar as configuracoes E uma decisao sobre o online: a partir daqui o
    // jogo para de ligar/desligar sozinho por causa da internet.
    setState({ selectedUniform, language, multiplayerEnabled, multiplayerDefinidoPeloJogador: true, managers, controllerType, commentaryEnabled, commentaryVoice, commentaryVolume: commentaryVolume[0], autoSaveInterval, sfxVolume: sfxVolume[0], matchSpeed, notificationsEnabled: notifications })
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const handleRestoreDefaults = () => {
    setSfxVolume([80])
    setAutoSaveInterval(1)
    setNotifications(true)
    setMatchSpeed("normal")
    setSelectedUniform("home")
    setLanguage("pt-BR")
    setTheme("green")
    setMultiplayerEnabled(false)
    setManagers([])
    setControllerType("auto")
    setCommentaryEnabled(true)
    setCommentaryVoice("padrao")
    setCommentaryVolume([80])
    // Restaurar tem que GRAVAR. Antes so mexia no estado da tela: quem clicava
    // e saia sem salvar via tudo voltar ao que era.
    setState({
      sfxVolume: 80, autoSaveInterval: 1, notificationsEnabled: true, matchSpeed: "normal",
      selectedUniform: "home", language: "pt-BR", multiplayerEnabled: false, managers: [],
      controllerType: "auto", commentaryEnabled: true, commentaryVoice: "padrao", commentaryVolume: 80,
    })
  }

  // Keyboard navigation for menu
  useEffect(() => {
    if (currentView !== "menu") return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") {
        setSelectedCardIndex(prev => Math.min(prev + 1, menuCards.length - 1))
      } else if (e.key === "ArrowLeft") {
        setSelectedCardIndex(prev => Math.max(prev - 1, 0))
      } else if (e.key === "ArrowDown") {
        setSelectedCardIndex(prev => Math.min(prev + 3, menuCards.length - 1))
      } else if (e.key === "ArrowUp") {
        setSelectedCardIndex(prev => Math.max(prev - 3, 0))
      } else if (e.key === "Enter" || e.key === " ") {
        abrirCard(menuCards[selectedCardIndex].id)
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [currentView, selectedCardIndex])

  // Menu view with cards
  if (currentView === "menu") {
    return (
      <ControllerTypeContext.Provider value={controllerType === "playstation" ? "playstation" : "xbox"}>
        <div className="h-screen md:pl-0 pl-0 pb-20 md:pb-0 bg-[#050508] flex flex-col overflow-hidden">
          <GameHeader team={userTeam} />
          
          {/* pb-24: espaco para a barra de acoes/player nao cobrir a ultima linha.
              overflow-x-hidden: `overflow-y-auto` sozinho faz o overflow-x COMPUTAR
              como `auto` (regra do CSS: se um eixo nao e `visible`, o outro vira
              auto) — era dai que vinha a barra de rolagem lateral, ainda mais com
              o zoom 0.8 do jogo, onde 100vw nao bate com a largura real. */}
          <main className="flex-1 p-4 pb-24 overflow-y-auto overflow-x-hidden">
            {/* Header */}
            <div className="flex items-center justify-between mb-8">
              <h1 className="text-xl md:text-2xl font-semibold text-white/70">{t.settings.customize}</h1>
              <div className="flex items-center gap-2 text-white/50 text-sm">
                {/* Selo de jogo registrado — some sozinho para quem nao registrou. */}
                <SeloRegistrado />
                <span>{state.managerName || "Tecnico"}</span>
                <span className="text-white/30">|</span>
                <span>{userTeam.nome}</span>
              </div>
            </div>
            
            {/* Cards Grid */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-4 max-w-4xl">
              {menuCards.map((card, index) => {
                const Icon = card.icon
                const isSelected = index === selectedCardIndex
                return (
                  <motion.button
                    key={card.id}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => abrirCard(card.id)}
                    onMouseEnter={() => setSelectedCardIndex(index)}
                    className={cn(
                      // Antes era aspect-square: com 3 colunas os cards ficavam ~285px de
                      // altura e as 3 linhas estouravam a viewport (ultima linha cortada).
                      "relative flex flex-col justify-between p-4 md:p-5 rounded-lg text-left overflow-hidden transition-all min-h-[130px] md:min-h-[150px]",
                      "bg-gradient-to-br from-[#0d2a35] via-[#0a2028] to-[#061318]",
                      isSelected 
                        ? "shadow-lg shadow-[var(--brand-2)]/30" 
                        : "hover:brightness-110"
                    )}
                    style={{
                      borderLeft: isSelected ? "3px solid var(--brand-2)" : "2px solid rgba(0, 180, 200, 0.4)",
                      borderBottom: isSelected ? "3px solid var(--brand-2)" : "2px solid rgba(0, 180, 200, 0.4)",
                      borderTop: isSelected ? "2px solid var(--brand-2)" : "1px solid rgba(255, 255, 255, 0.05)",
                      borderRight: isSelected ? "2px solid var(--brand-2)" : "1px solid rgba(255, 255, 255, 0.05)",
                    }}
                  >
                    <h2 className="text-sm md:text-base font-semibold text-white whitespace-pre-line leading-tight">
                      {cardTitles[card.id] ?? card.title}
                    </h2>
                    
                    <div className="flex justify-center items-center">
                      <Icon className="h-8 w-8 md:h-10 md:w-10 text-white/60" strokeWidth={1.5} />
                    </div>
                  </motion.button>
                )
              })}
            </div>
            
            {/* Rodapé removido: a barra global (EaActionBar, com FC HUB /
                Selecionar / Voltar) já cobre esta tela — a faixa sólida local
                ficava empilhada sobre ela. */}
          </main>
          
        </div>
      </ControllerTypeContext.Provider>
    )
  }

  // Settings detail views
  const renderDetailView = () => {
    switch (currentView) {
      case "configuracoes":
        return (
          <div className="space-y-6">
            <div className="rounded-xl bg-[#0c0c10] border border-white/[0.04] p-6 space-y-5">
              <h3 className="text-sm font-medium text-white flex items-center gap-2">
                <Palette className="h-4 w-4 text-primary" />
                {t.settings.themeColors}
              </h3>

              {/* Opcao Cores do Time */}
              <div className="mb-4">
                <button
                  onClick={() => {
                    setTheme("team")
                    setTeamColors({ primary: userTeam.cor1, secondary: userTeam.cor2 })
                  }}
                  className={cn(
                    "relative w-full flex items-center gap-3 p-3 rounded-lg border transition-all text-left",
                    theme === "team" ? "border-primary bg-primary/10" : "border-white/10 bg-white/5 hover:border-white/20"
                  )}
                >
                  <div className="flex gap-1">
                    <div className="h-6 w-6 rounded-full border border-white/20" style={{ backgroundColor: userTeam.cor1 }} />
                    <div className="h-6 w-6 rounded-full border border-white/20 -ml-2" style={{ backgroundColor: userTeam.cor2 }} />
                  </div>
                  <div className="flex-1">
                    <span className="text-xs font-medium text-white">{t.settings.useTeamColors(userTeam.nome)}</span>
                    <span className="text-[10px] text-white/40 block">{t.settings.useTeamColorsDesc}</span>
                  </div>
                  {theme === "team" && (
                    <div className="h-5 w-5 rounded-full bg-primary flex items-center justify-center">
                      <Check className="h-3 w-3 text-primary-foreground" />
                    </div>
                  )}
                </button>
              </div>
              
              <div className="text-xs text-white/40 mb-2">{t.settings.presetThemes}</div>
              <div className="grid grid-cols-2 gap-3">
                {(Object.keys(themePresets) as Exclude<ThemeColor, "team">[]).map((key) => {
                  const preset = themePresets[key]
                  const isActive = theme === key
                  return (
                    <button
                      key={key}
                      onClick={() => setTheme(key)}
                      className={cn(
                        "relative flex items-center gap-3 p-3 rounded-lg border transition-all text-left",
                        isActive ? "border-primary bg-primary/10" : "border-white/10 bg-white/5 hover:border-white/20"
                      )}
                    >
                      <div className="flex gap-1">
                        <div className="h-6 w-6 rounded-full border border-white/20" style={{ backgroundColor: preset.primary }} />
                        <div className="h-6 w-6 rounded-full border border-white/20 -ml-2" style={{ backgroundColor: preset.accent }} />
                      </div>
                      <span className="text-xs font-medium text-white">{preset.name}</span>
                      {isActive && (
                        <div className="absolute right-2 top-1/2 -translate-y-1/2 h-5 w-5 rounded-full bg-primary flex items-center justify-center">
                          <Check className="h-3 w-3 text-primary-foreground" />
                        </div>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>
            
            {/* ── Acessibilidade ──────────────────────────────────────────
                O tema escuro do jogo usa muito texto em white/40-50, que e
                ilegivel para baixa visao. Aqui o jogador ajusta e vale no jogo
                inteiro (o store escreve no <html>, o CSS reage). */}
            <div className="rounded-xl bg-[#0c0c10] border border-white/[0.04] p-6 space-y-4">
              <h3 className="text-sm font-medium text-white flex items-center gap-2">
                <Eye className="h-4 w-4 text-primary" />
                Acessibilidade
              </h3>

              <div>
                <div className="mb-2 flex items-center justify-between">
                  <div>
                    <div className="text-sm text-white">{t.configuracoes.tamanho_da_fonte}</div>
                    <div className="text-xs text-white/40">{t.configuracoes.aumenta_o_texto_de_todas_as}</div>
                  </div>
                  <span className="text-sm font-bold text-primary tabular-nums">{a11y.fontScale}%</span>
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {([100, 110, 125, 150] as const).map((s) => (
                    <button
                      key={s}
                      onClick={() => accessibilityStore.set("fontScale", s)}
                      className={cn(
                        "rounded-lg border py-2 text-xs font-bold transition-all",
                        a11y.fontScale === s
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-white/10 bg-white/[0.03] text-white/60 hover:border-white/25"
                      )}
                    >
                      {s}%
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                {([
                  { key: "highContrast", label: "Alto contraste", desc: "Reforca texto e bordas apagadas" },
                  { key: "reduceMotion", label: "Reduzir movimento", desc: "Desliga animacoes e transicoes" },
                  { key: "focusHighlight", label: "Realce de foco", desc: "Contorno forte no item selecionado (teclado/controle)" },
                  { key: "underlineLinks", label: "Sublinhar acoes", desc: "Sublinha links e botoes clicaveis" },
                ] as const).map((opt) => (
                  <div key={opt.key} className="flex items-center justify-between gap-4 p-3 rounded-lg bg-white/5 [&>div]:min-w-0">
                    <div>
                      <div className="text-sm text-white">{opt.label}</div>
                      <div className="text-xs text-white/40">{opt.desc}</div>
                    </div>
                    <Switch
                      checked={a11y[opt.key]}
                      onCheckedChange={(v) => accessibilityStore.set(opt.key, v)}
                    />
                  </div>
                ))}
              </div>

              <button
                onClick={() => accessibilityStore.reset()}
                className="w-full rounded-lg border border-white/10 py-2 text-xs text-white/50 transition-colors hover:bg-white/5 hover:text-white"
              >
                Restaurar padroes
              </button>
            </div>

            <div className="rounded-xl bg-[#0c0c10] border border-white/[0.04] p-6 space-y-4">
              <h3 className="text-sm font-medium text-white">{t.configuracoes.desempenho_grafico}</h3>
              <p className="text-xs text-white/40">{t.configuracoes.o_modo_economico_reduz_animacoes_transpare}</p>
              <select
                value={performanceProfile}
                onChange={event => {
                  const profile = event.target.value as PerformanceProfile
                  setPerformanceProfile(profile)
                  applyPerformanceProfile(profile)
                }}
                className="w-full rounded-lg border border-white/10 bg-[#101015] px-3 py-2 text-sm text-white"
                aria-label={t.configuracoes.perfil_de_desempenho_grafico}
              >
                <option value="economy">{t.configuracoes.economico_hardware_antigo}</option>
                <option value="balanced">Equilibrado</option>
                <option value="quality">Qualidade</option>
              </select>
            </div>

            <div className="rounded-xl bg-[#0c0c10] border border-white/[0.04] p-6 space-y-4">
              <h3 className="text-sm font-medium text-white flex items-center gap-2">
                <Bell className="h-4 w-4 text-primary" />
                {t.settings.notificationsSystem}
              </h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-4 p-3 rounded-lg bg-white/5">
                  <div>
                    <div className="text-sm text-white">{t.settings.autoSave}</div>
                    <div className="text-xs text-white/40">{t.configuracoes.salva_elenco_escalacao_calendario_e_carrei}</div>
                  </div>
                  <select
                    value={autoSaveInterval}
                    onChange={event => {
                      const value = Number(event.target.value) as 0 | 1 | 3 | 5
                      setAutoSaveInterval(value)
                      setState({ autoSaveInterval: value })
                    }}
                    className="min-w-[150px] rounded-lg border border-white/10 bg-[#101015] px-3 py-2 text-sm text-white"
                    aria-label={t.configuracoes.frequencia_do_salvamento_automatico}
                  >
                    <option value={0}>Desativado</option>
                    <option value={1}>{t.configuracoes.a_cada_jogo}</option>
                    <option value={3}>{t.configuracoes.a_cada_3_jogos}</option>
                    <option value={5}>{t.configuracoes.a_cada_5_jogos}</option>
                  </select>
                </div>
                <div className="flex items-center justify-between gap-4 p-3 rounded-lg bg-white/5 [&>div]:min-w-0">
                  <div>
                    <div className="text-sm text-white">{t.settings.notifications}</div>
                    <div className="text-xs text-white/40">{t.settings.notificationsDesc}</div>
                  </div>
                  <Switch
                    checked={notifications}
                    onCheckedChange={(v) => { setNotifications(v); setState({ notificationsEnabled: v }) }}
                  />
                </div>
                <div className="flex items-center justify-between gap-4 p-3 rounded-lg bg-white/5 [&>div]:min-w-0">
                  <div>
                    <div className="text-sm text-white">{t.configuracoes.tela_cheia}</div>
                    <div className="text-xs text-white/40">{t.configuracoes.alternar_entre_janela_e_tela_cheia}</div>
                  </div>
                  <Switch checked={fullscreen} onCheckedChange={(v) => { setFullscreenState(v); void setFullscreen(v) }} />
                </div>
              </div>
            </div>
          </div>
        )

      case "perfil":
        return (
          <div className="space-y-6">
            <div className="rounded-xl bg-[#0c0c10] border border-white/[0.04] p-6 space-y-5">
              <h3 className="text-sm font-medium text-white flex items-center gap-2">
                <User className="h-4 w-4 text-primary" />
                {t.settings.managerInfo}
              </h3>
              {/* Foto e apelido agora sao editaveis aqui — antes o nome so podia ser
                  definido na criacao da carreira e a foto nao existia. */}
              <ManagerAvatarPicker
                value={state.managerAvatar ?? ""}
                onChange={managerAvatar => setState({ managerAvatar })}
              />

              <div className="space-y-1.5">
                <label htmlFor="apelido-tecnico" className="text-xs text-white/40">
                  {t.settings.managerName}
                </label>
                <input
                  id="apelido-tecnico"
                  value={state.managerName ?? ""}
                  onChange={e => setState({ managerName: e.target.value })}
                  // Vazio volta para "Tecnico" so ao SAIR do campo: validar a cada
                  // tecla impediria de apagar tudo para escrever outro nome.
                  onBlur={e => { if (!e.target.value.trim()) setState({ managerName: "Tecnico" }) }}
                  maxLength={28}
                  placeholder="Tecnico"
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-lg font-bold text-white outline-none transition-colors focus:border-primary/60"
                />
                <p className="text-sm text-white/50">{userTeam.nome}</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 rounded-lg bg-white/5">
                  <div className="text-xs text-white/40">{t.settings.seasonLabel}</div>
                  <div className="text-lg font-bold text-white">{state.season}</div>
                </div>
                <div className="p-3 rounded-lg bg-white/5">
                  <div className="text-xs text-white/40">{t.settings.weekLabel}</div>
                  <div className="text-lg font-bold text-white">{state.week}/52</div>
                </div>
              </div>
            </div>
            
            {/* DIFICULDADE — o dedo na balanca deixou de ser constante de codigo.
                O motor dava ao adversario +9 fixo sempre que o usuario entrava em
                campo, e nao havia como pedir mais nem menos. "Normal" e exatamente
                esse valor, entao carreira em andamento nao muda de comportamento. */}
            <div className="rounded-xl bg-[#0c0c10] border border-white/[0.04] p-6 space-y-5">
              <h3 className="text-sm font-medium text-white flex items-center gap-2">
                <Swords className="h-4 w-4 text-primary" />
                Dificuldade
              </h3>
              <p className="text-xs text-white/40 -mt-2">
                Vale para as partidas que voce disputa. Muda a qualquer momento da carreira.
              </p>
              <div className="grid grid-cols-1 gap-2">
                {NIVEIS.map((nivel) => (
                  <button
                    key={nivel.id}
                    onClick={() => setState({ dificuldade: nivel.id })}
                    className={cn(
                      "flex items-start gap-3 p-3 rounded-lg border transition-all text-left",
                      (state.dificuldade ?? DIFICULDADE_PADRAO) === nivel.id
                        ? "border-primary bg-primary/10"
                        : "border-white/10 bg-white/5 hover:border-white/20",
                    )}
                  >
                    <span className="flex-1">
                      <span className="block text-sm text-white">{nivel.nome}</span>
                      <span className="block text-xs text-white/40 mt-0.5">{nivel.descricao}</span>
                    </span>
                    {(state.dificuldade ?? DIFICULDADE_PADRAO) === nivel.id && <Check className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />}
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-xl bg-[#0c0c10] border border-white/[0.04] p-6 space-y-5">
              <h3 className="text-sm font-medium text-white flex items-center gap-2">
                <Globe className="h-4 w-4 text-primary" />
                {t.settings.language}
              </h3>
              <p className="text-xs leading-relaxed text-white/45">Português é o idioma oficialmente suportado. English, Español e Italiano são prévias: o dicionário cobre 402 textos, e 13 das 227 telas do jogo estão ligadas a ele — o resto continua aparecendo em português. A cobertura completa é um trabalho de tradução em andamento, não um defeito da escolha de idioma.</p>
              <div className="grid grid-cols-1 gap-2">
                {languageOptions.map((lang) => (
                  <button
                    key={lang.id}
                    // Aplica o idioma NA HORA. Antes so o "check" mudava no clique e a
                    // traducao so entrava depois de clicar em Salvar — dava a impressao
                    // de que trocar o idioma nao fazia nada. setState grava no store, que
                    // dispara "ultrafoot:store:changed" e o useTranslation reage.
                    onClick={() => { setLanguage(lang.id); setState({ language: lang.id }) }}
                    className={cn(
                      "flex items-center gap-3 p-3 rounded-lg border transition-all text-left",
                      language === lang.id ? "border-primary bg-primary/10" : "border-white/10 bg-white/5 hover:border-white/20"
                    )}
                  >
                    <span className="w-7 h-5 rounded overflow-hidden shadow-sm flex-shrink-0 ring-1 ring-white/10">
                      <Image
                        src={`/flags/${({ BR: "br", PT: "pt", US: "us", GB: "gb-eng", ES: "es", MX: "mx" } as Record<string, string>)[lang.flag]}.png`}
                        alt={lang.label}
                        width={28}
                        height={20}
                        className="object-cover w-full h-full"
                        unoptimized
                      />
                    </span>
                    <span className="text-sm text-white">{lang.label}</span>
                    <span className={cn("rounded px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wide", lang.releaseStatus === "official" ? "bg-emerald-400/10 text-emerald-300" : "bg-amber-400/10 text-amber-200")}>{lang.releaseStatus === "official" ? "Oficial" : "Prévia"}</span>
                    {language === lang.id && <Check className="h-4 w-4 text-primary ml-auto" />}
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-xl bg-[#0c0c10] border border-white/[0.04] p-6 space-y-5">
              <h3 className="text-sm font-medium text-white flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-primary" />
                Moeda
              </h3>
              <p className="text-xs text-white/40 -mt-2">
                Muda o simbolo e a conversao dos valores exibidos (base R$).
              </p>
              <div className="grid grid-cols-2 gap-2">
                {CURRENCIES.map((c) => (
                  <button
                    key={c.code}
                    onClick={() => { setCurrencyCode(c.code); setCurrency(c.code) }}
                    className={cn(
                      "flex items-center gap-3 p-3 rounded-lg border transition-all text-left",
                      currencyCode === c.code ? "border-primary bg-primary/10" : "border-white/10 bg-white/5 hover:border-white/20"
                    )}
                  >
                    <span className="w-8 text-center text-base font-bold text-white/90">{c.symbol}</span>
                    <span className="text-sm text-white">{c.code}</span>
                    {currencyCode === c.code && <Check className="h-4 w-4 text-primary ml-auto" />}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )

      case "tempo":
        return (
          <div className="space-y-6">
            <div className="rounded-xl bg-[#0c0c10] border border-white/[0.04] p-6 space-y-5">
              <h3 className="text-sm font-medium text-white flex items-center gap-2">
                <Clock className="h-4 w-4 text-primary" />
                {t.settings.matchSpeed}
              </h3>
              <div className="grid grid-cols-3 gap-2">
                {([
                  { value: "lento", label: t.settings.slow },
                  { value: "normal", label: t.settings.normal },
                  { value: "rapido", label: t.settings.fast },
                ] as const).map(({ value, label }) => (
                  <button
                    key={value}
                    onClick={() => { setMatchSpeed(value); setState({ matchSpeed: value }) }}
                    className={cn(
                      "p-3 rounded-lg border text-sm font-medium transition-all capitalize",
                      matchSpeed === value ? "border-primary bg-primary/10 text-white" : "border-white/10 bg-white/5 text-white/60 hover:border-white/20"
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )
        
      case "musica":
        return (
          <div className="space-y-6">
            <div className="rounded-xl bg-[#0c0c10] border border-white/[0.04] p-6 space-y-5">
              <h3 className="text-sm font-medium text-white flex items-center gap-2">
                <Volume2 className="h-4 w-4 text-primary" />
                {t.settings.musicVolume}
              </h3>
              <div className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-white/60">{t.settings.soundEffects}</span>
                    <span className="text-sm text-white">{sfxVolume[0]}%</span>
                  </div>
                  {/* onValueCommit grava so quando o dedo solta: gravar a cada
                      pixel arrastado escreveria no save dezenas de vezes por
                      segundo. O som reage na hora pelo evento. */}
                  <Slider
                    value={sfxVolume}
                    onValueChange={(v) => { setSfxVolume(v); anunciarSfx(v[0]) }}
                    onValueCommit={(v) => setState({ sfxVolume: v[0] })}
                    max={100}
                  />
                </div>
                <div className="flex items-center justify-between rounded-lg bg-white/5 p-3">
                  <div><div className="text-sm text-white">{t.configuracoes.narracao_durante_as_partidas}</div><div className="text-xs text-white/40">{t.configuracoes.ativa_ou_desativa_as_vozes_do}</div></div>
                  <Switch checked={commentaryEnabled} onCheckedChange={(v) => { setCommentaryEnabled(v); setState({ commentaryEnabled: v }) }} />
                </div>
                {commentaryEnabled && <>
                  <div><label className="mb-2 block text-sm text-white/60">Narrador</label><select value={commentaryVoice} onChange={e => { setCommentaryVoice(e.target.value); setState({ commentaryVoice: e.target.value }) }} className="w-full rounded-lg border border-white/10 bg-[#101015] p-3 text-sm text-white">{commentaryVoices.map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></div>
                  <div><div className="mb-2 flex justify-between"><span className="text-sm text-white/60">{t.configuracoes.volume_da_narracao}</span><span className="text-sm text-white">{commentaryVolume[0]}%</span></div><Slider value={commentaryVolume} onValueChange={setCommentaryVolume} onValueCommit={(v) => setState({ commentaryVolume: v[0] })} max={100} /></div>
                </>}
              </div>
            </div>

            {/* O jogo nao embute mais trilha propria (eram 1,6 GB no instalador, e
                musica de terceiros). Agora ele CONTROLA o player que voce ja usa —
                por isso o volume da musica se ajusta no proprio Spotify, nao aqui. */}
            <div className="rounded-xl bg-[#0c0c10] border border-white/[0.04] p-6">
              <h3 className="text-sm font-medium text-white mb-2 flex items-center gap-2">
                <Volume2 className="h-4 w-4 text-[#1db954]" />
                Musica
              </h3>
              <p className="text-xs leading-relaxed text-white/50">
                O Ultrafoot nao tem mais trilha propria: ele controla o player que voce ja
                tem aberto — <strong className="text-white/70">Spotify</strong>, YouTube Music,
                Deezer, o que for. Abra sua musica e o controle (tocar, pausar, avancar)
                aparece no canto da tela, dentro do jogo.
              </p>
              <p className="mt-3 text-xs text-white/35">
                O volume da musica se ajusta no proprio player. Aqui voce controla so os
                efeitos sonoros do jogo.
              </p>
            </div>
          </div>
        )
        
      case "atualizacoes":
        return <AtualizacoesPanel />

      case "online":
        return (
          <div className="space-y-6">
            <div className="rounded-xl bg-[#0c0c10] border border-white/[0.04] p-6 space-y-5">
              <h3 className="text-sm font-medium text-white flex items-center gap-2">
                <Globe className="h-4 w-4 text-primary" />
                {t.settings.onlineConfig}
              </h3>
              {/* As TRES chaves aqui eram enfeite: nenhuma tinha `checked` nem
                  `onCheckedChange`, entao clicar nelas nao mudava nada e o estado
                  nem sobrevivia a sair da tela. Cada uma agora manda em algo real. */}
              <div className="space-y-3">
                {/* "Conectar a servidores" e "Atualizar automaticamente" sairam na
                    1.0.240. Os dois governavam a atualizacao por partes, que deixou
                    de existir: manter o jogo na ultima versao nao e mais preferencia
                    do jogador, e quem instala e o Ultrafoot Launcher. Deixar os
                    interruptores ali seria pior do que tira-los — comandariam nada. */}
                <div className="flex items-center justify-between gap-4 p-3 rounded-lg bg-white/5">
                  <div>
                    <div className="text-sm text-white">{t.settings.onlineMatches}</div>
                    <div className="text-xs text-white/40">{t.settings.onlineMatchesDesc}</div>
                  </div>
                  <Switch
                    checked={multiplayerEnabled}
                    onCheckedChange={(v) => { setMultiplayerEnabled(v); setState({ multiplayerEnabled: v }) }}
                  />
                </div>
                <button
                  onClick={() => setCurrentView("atualizacoes")}
                  className="flex w-full items-center justify-between rounded-lg border border-white/10 p-3 text-left transition-colors hover:bg-white/5"
                >
                  <div>
                    <div className="text-sm text-white">{t.configuracoes.central_de_atualizacoes}</div>
                    <div className="text-xs text-white/40">{t.configuracoes.versao_instalada_e_como_o_jogo}</div>
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0 text-white/40" />
                </button>
              </div>
            </div>
          </div>
        )

      case "escalacoes":
        return (
          <div className="space-y-6">
            <div className="rounded-xl bg-[#0c0c10] border border-white/[0.04] p-6 space-y-5">
              <h3 className="text-sm font-medium text-white flex items-center gap-2">
                <Grid2X2 className="h-4 w-4 text-primary" />
                {t.settings.savedLineups}
              </h3>
              <p className="text-sm text-white/50">{t.settings.savedLineupsDesc}</p>
              {/* Escalacoes REAIS (persistent-store). Antes eram 3 cartoes chumbados
                  ("Escalacao Principal / Rotacao / Jovens", todos "4-3-3 - 11 jogadores"
                  escritos no HTML): nao havia escalacao salva nenhuma. */}
              {savedLineups.length === 0 ? (
                <div className="rounded-lg border border-dashed border-white/10 bg-white/[0.02] p-6 text-center">
                  <p className="text-sm text-white/50">{t.configuracoes.nenhuma_escalacao_salva_ainda}</p>
                  <p className="mt-1 text-xs text-white/30">
                    Salve a escalação atual do seu time para reutilizá-la depois.
                  </p>
                </div>
              ) : (
                <div className="grid gap-3">
                  {savedLineups.map((lineup, i) => (
                    <div
                      key={lineup.id}
                      className="flex items-center justify-between p-4 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
                    >
                      <button
                        onClick={() => hardNavigate("/elenco/escalacoes")}
                        className="flex flex-1 items-center gap-3 text-left"
                      >
                        <div className="h-10 w-10 rounded-lg bg-primary/20 flex items-center justify-center">
                          <span className="text-sm font-bold text-primary">{i + 1}</span>
                        </div>
                        <div className="min-w-0">
                          <div className="truncate text-sm font-medium text-white">{lineup.name}</div>
                          <div className="text-xs text-white/40">
                            {lineup.formation} • {lineup.starters.length} jogadores
                          </div>
                        </div>
                      </button>
                      <button
                        onClick={() => {
                          deleteLineup(lineup.id)
                          setSavedLineups(listSavedLineups())
                        }}
                        aria-label={`Excluir ${lineup.name}`}
                        className="rounded-lg p-2 text-white/30 transition-colors hover:bg-red-500/15 hover:text-red-300"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <Button
                onClick={handleSaveCurrentLineup}
                variant="outline"
                size="sm"
                className="w-full border-dashed border-white/20 text-white/60 hover:text-white hover:bg-white/5"
              >
                <Plus className="h-4 w-4 mr-2" />
                Salvar escalação atual
              </Button>
              {lineupMsg && (
                <p className="text-center text-xs text-[var(--brand)]">{lineupMsg}</p>
              )}
            </div>
          </div>
        )
        
      case "creditos":
        return (
          <div className="space-y-6">
            {/* Patrocinadores Oficiais */}
            <div className="rounded-xl bg-[#0c0c10] border border-white/[0.04] p-6 space-y-5">
              <h3 className="text-sm font-medium text-white flex items-center gap-2">
                <Award className="h-4 w-4 text-primary" />
                {t.settings.officialSponsors}
              </h3>
              <div className="grid grid-cols-3 gap-3">
                {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="flex flex-col items-center justify-center gap-2 p-5 rounded-xl border-2 border-dashed border-white/10 bg-white/[0.03] aspect-video hover:border-primary/30 hover:bg-primary/5 transition-all"
                  >
                    <div className="h-10 w-10 rounded-full bg-white/10 flex items-center justify-center">
                      <Plus className="h-5 w-5 text-white/30" />
                    </div>
                    <span className="text-[10px] text-white/30 text-center leading-tight">
                      Slot {i}<br />{t.settings.slotAvailable}
                    </span>
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-center gap-1.5 text-xs text-white/40 pt-1">
                <ExternalLink className="h-3 w-3" />
                <span>{t.settings.sponsorContact}</span>
              </div>
            </div>

            {/* Apoiadores */}
            <div className="rounded-xl bg-[#0c0c10] border border-white/[0.04] p-6 space-y-4">
              <h3 className="text-sm font-medium text-white flex items-center gap-2">
                <Heart className="h-4 w-4 text-primary" />
                {t.settings.supporters}
              </h3>
              <div className="space-y-3">
                {[
                  { tier: "Ouro", color: "#f59e0b", supporters: [] as string[] },
                  { tier: "Prata", color: "#94a3b8", supporters: [] as string[] },
                  { tier: "Bronze", color: "#cd7f32", supporters: [] as string[] },
                ].map((level) => (
                  <div key={level.tier} className="rounded-lg border border-white/[0.04] overflow-hidden">
                    <div
                      className="flex items-center gap-2 px-4 py-2"
                      style={{ backgroundColor: `${level.color}15` }}
                    >
                      <div className="h-2 w-2 rounded-full" style={{ backgroundColor: level.color }} />
                      <span className="text-xs font-semibold tracking-wider uppercase" style={{ color: level.color }}>
                        {t.settings.levelLabel} {level.tier}
                      </span>
                    </div>
                    <div className="px-4 py-3">
                      {level.supporters.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                          {level.supporters.map((s) => (
                            <span key={s} className="px-2 py-1 rounded bg-white/5 text-xs text-white/70">{s}</span>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-white/25 italic">
                          {t.settings.noSupporter}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Equipe de Desenvolvimento */}
            <div className="rounded-xl bg-[#0c0c10] border border-white/[0.04] p-6 space-y-4">
              <h3 className="text-sm font-medium text-white flex items-center gap-2">
                <Users className="h-4 w-4 text-primary" />
                {t.settings.devTeam}
              </h3>
              <div className="space-y-2">
                {[
                  { role: "Diretor Criativo", name: "Antonio Egidio · @egidiocode" },
                  { role: "Desenvolvimento", name: "Gustavo Ventura e Isaac Moura" },
                  { role: "Design de Interface", name: "Antonio Egidio · @egidiocode" },
                  { role: "Dados e Estatisticas", name: "Gustavo Ventura e Isaac Moura" },
                ].map((member) => (
                  <div key={member.role} className="flex items-center justify-between px-4 py-2.5 rounded-lg bg-white/5">
                    <span className="text-xs text-white/40">{member.role}</span>
                    <span className="text-sm text-white font-medium">{member.name}</span>
                  </div>
                ))}
              </div>
              <div className="pt-2 border-t border-white/[0.04] text-center">
                <p className="text-[10px] text-white/25">{t.settings.copyright}</p>
              </div>
            </div>
          </div>
        )

      case "tutorial": {
        const gameContexts: Array<{ id: GameContext; label: string; description: string }> = [
          { id: "menu", label: "Menu / Navegacao Geral", description: "Dashboard, barra lateral e paginas de gestao" },
          { id: "match_preview", label: "Pre-Jogo", description: "Preparacao antes de iniciar a partida" },
          { id: "match_live", label: "Partida ao Vivo", description: "Durante a simulacao da partida" },
          { id: "match_paused", label: "Partida Pausada", description: "Com a simulacao pausada" },
          { id: "tactical", label: "Editor Tatico", description: "Configurando formacao e instrucoes" },
          { id: "substitution", label: "Substituicoes", description: "Trocando jogadores em campo" },
          { id: "calendar", label: "Calendario", description: "Gerenciando rodadas e partidas" },
          { id: "squad", label: "Elenco", description: "Visualizando e gerenciando jogadores" },
          { id: "transfers", label: "Mercado de Transferencias", description: "Comprando e vendendo atletas" },
        ]

        const svgButtons = ["A", "B", "X", "Y", "LB", "RB", "LT", "RT", "L3", "R3"] as const
        type SvgButton = typeof svgButtons[number]

        const renderBtnBadge = (btn: string, ctrl: "xbox" | "playstation") => {
          if ((svgButtons as readonly string[]).includes(btn)) {
            return <ControllerButton button={btn as SvgButton} controller={ctrl} size="sm" showLabel={false} />
          }
          const labels: Record<string, [string, string]> = {
            START: ["START ≡", "OPTIONS"],
            SELECT: ["SELECT ⧉", "SHARE"],
            HOME: ["HOME ⊕", "PS"],
            DPAD_UP: ["D-pad ↑", "D-pad ↑"],
            DPAD_DOWN: ["D-pad ↓", "D-pad ↓"],
            DPAD_LEFT: ["D-pad ←", "D-pad ←"],
            DPAD_RIGHT: ["D-pad →", "D-pad →"],
          }
          const label = labels[btn]?.[ctrl === "xbox" ? 0 : 1] || btn
          return (
            <span className="px-1.5 py-0.5 text-[9px] font-bold text-white/60 bg-white/10 border border-white/20 rounded whitespace-nowrap">
              {label}
            </span>
          )
        }

        const keyboardShortcuts = [
          {
            section: "Navegacao Geral",
            items: [
              { keys: ["↑ ↓ ← →"], label: "Navegar entre opcoes e itens (= D-pad)" },
              { keys: ["Enter"], label: "Confirmar selecao (= A no Xbox / X no PS)" },
              { keys: ["Esc", "Backspace"], label: "Voltar / Fechar modal (= B no Xbox / O no PS)" },
              { keys: ["Tab"], label: "Proxima aba (= RB / R1)" },
              { keys: ["Shift+Tab"], label: "Aba anterior (= LB / L1)" },
              { keys: ["Mouse"], label: "Clicar em qualquer botao ou opcao" },
              { keys: ["Scroll"], label: "Rolar listas e paginas" },
            ],
          },
          {
            section: "Splash / Selecao de Time",
            items: [
              { keys: ["← →"], label: "Navegar entre as opcoes do menu" },
              { keys: ["Enter"], label: "Confirmar selecao de time / opcao" },
              { keys: ["Esc"], label: "Voltar ao menu anterior" },
              { keys: ["LB / RB"], label: "Trocar divisao / liga (Serie A, B, C, D, internacionais)" },
            ],
          },
          {
            section: "Pre-Jogo",
            items: [
              { keys: ["Enter"], label: "Iniciar partida ao vivo" },
              { keys: ["Esc"], label: "Voltar ao Dashboard" },
              { keys: ["Q"], label: "Simulacao rapida (sem jogar ao vivo)" },
              { keys: ["← →"], label: "Trocar uniforme do mandante (= LB/RB)" },
              { keys: ["Shift+← →"], label: "Trocar uniforme do visitante (= LT/RT)" },
              { keys: ["T"], label: "Ver / editar taticas (= X / □ no PS)" },
              { keys: ["Y"], label: "Configuracoes da partida" },
            ],
          },
          {
            section: "Partida ao Vivo",
            items: [
              { keys: ["Espaco"], label: "Pausar / Continuar simulacao (= START / OPTIONS)" },
              { keys: ["F"], label: "Acelerar simulacao (= A no Xbox / X no PS)" },
              { keys: ["S"], label: "Desacelerar simulacao (= B no Xbox / O no PS)" },
              { keys: ["T"], label: "Abrir substituicoes (= Y no Xbox / △ no PS)" },
              { keys: ["I"], label: "Estatisticas ao vivo (= X / □ no PS)" },
              { keys: ["G"], label: "Pular direto ao resultado final (= SELECT / SHARE)" },
              { keys: ["M"], label: "Ligar / desligar musica (= L3)" },
              { keys: ["Print Screen"], label: "Capturar tela (= R3)" },
            ],
          },
          {
            section: "Partida Pausada",
            items: [
              { keys: ["Espaco", "Esc"], label: "Continuar partida" },
              { keys: ["T"], label: "Fazer substituicoes" },
              { keys: ["I"], label: "Ver estatisticas da partida" },
              { keys: ["G"], label: "Pular direto ao resultado" },
            ],
          },
          {
            section: "Calendario",
            items: [
              { keys: ["← →"], label: "Mes anterior / proximo (= LB / RB)" },
              { keys: ["Enter"], label: "Avancar rodada (= A / X no PS)" },
              { keys: ["X"], label: "Simular ate a proxima partida do usuario" },
              { keys: ["Y"], label: "Ir direto para sua proxima partida" },
            ],
          },
          {
            section: "Treinamento",
            items: [
              { keys: ["↑ ↓"], label: "Navegar entre jogadores / sessoes" },
              { keys: ["Enter"], label: "Iniciar sessao de treino" },
              { keys: ["← →"], label: "Mudar tipo de treino (Tecnico, Fisico, Tatico)" },
              { keys: ["Tab"], label: "Alternar entre abas (Individual, Coletivo)" },
            ],
          },
          {
            section: "Olheiros",
            items: [
              { keys: ["↑ ↓"], label: "Navegar entre jogadores observados" },
              { keys: ["Enter"], label: "Ver relatorio completo do jogador" },
              { keys: ["X"], label: "Adicionar jogador a lista de interesse" },
              { keys: ["← →"], label: "Mudar regiao de busca (= LB / RB)" },
            ],
          },
          {
            section: "Financas",
            items: [
              { keys: ["← →"], label: "Navegar entre abas (Resumo, Salarios, Receitas)" },
              { keys: ["Enter"], label: "Ver detalhes da transacao" },
              { keys: ["Tab"], label: "Proxima aba de financas" },
            ],
          },
          {
            section: "Contratos",
            items: [
              { keys: ["↑ ↓"], label: "Navegar entre jogadores" },
              { keys: ["Enter"], label: "Abrir negociacao de contrato" },
              { keys: ["← →"], label: "Ajustar valores da proposta" },
              { keys: ["X"], label: "Propor renovacao direta" },
              { keys: ["Esc"], label: "Cancelar negociacao" },
            ],
          },
          {
            section: "Infraestrutura",
            items: [
              { keys: ["↑ ↓"], label: "Navegar entre instalacoes" },
              { keys: ["Enter"], label: "Iniciar upgrade de instalacao" },
              { keys: ["X"], label: "Ver detalhes da instalacao" },
            ],
          },
          {
            section: "Elenco",
            items: [
              { keys: ["↑ ↓"], label: "Navegar entre jogadores (= D-pad)" },
              { keys: ["Enter"], label: "Ver perfil completo do jogador" },
              { keys: ["← →"], label: "Mudar aba / filtro de posicao (= LB / RB)" },
              { keys: ["F"], label: "Mudar formacao taticamente (= LT / RT)" },
              { keys: ["Y"], label: "Gerenciar substituicoes do elenco" },
            ],
          },
          {
            section: "Mercado de Transferencias",
            items: [
              { keys: ["↑ ↓"], label: "Navegar entre jogadores disponíveis" },
              { keys: ["Enter"], label: "Negociar / comprar jogador (= A / X no PS)" },
              { keys: ["← →"], label: "Mudar aba: Buscar / Rede / Olheiros (= LB / RB)" },
              { keys: ["Shift+Enter"], label: "Propor emprestimo ao invez de compra" },
              { keys: ["Esc"], label: "Fechar negociacao / voltar" },
            ],
          },
          {
            section: "Atalhos Globais",
            items: [
              { keys: ["Ctrl+S"], label: "Salvar jogo manualmente (= SELECT / SHARE)" },
              { keys: ["Q"], label: "Reconectar controle / acao de atalho" },
              { keys: ["F11"], label: "Alternar modo tela cheia" },
              { keys: ["F5"], label: "Recarregar pagina (use com cuidado!)" },
              { keys: ["Alt+F4"], label: "Fechar o jogo (Tauri / app desktop)" },
            ],
          },
        ]

        const ctrl = (tutorialTab !== "keyboard" ? tutorialTab : "xbox") as "xbox" | "playstation"

        return (
          <div className="space-y-4">
            {/* Tipo de controle: escolhe quais prompts de botao (glifos) aparecem no jogo
                inteiro. Aplica na hora (grava no store, que o gamepad-provider le). */}
            <div className="rounded-xl bg-[#0c0c10] border border-white/[0.04] p-5 space-y-4">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <Gamepad2 className="h-4 w-4 text-primary" />
                Tipo de controle
              </h3>
              <p className="text-xs text-white/40 -mt-2">
                Define os simbolos dos botoes exibidos no jogo. "Automatico" detecta pelo controle conectado.
              </p>
              <div className="grid grid-cols-3 gap-2">
                {([
                  { id: "auto" as const, label: "Automatico", desc: "Detecta" },
                  { id: "xbox" as const, label: "Xbox", desc: "A B X Y" },
                  { id: "playstation" as const, label: "PlayStation", desc: "✕ ◯ □ △" },
                ]).map((opt) => (
                  <button
                    key={opt.id}
                    onClick={() => { setControllerType(opt.id); setState({ controllerType: opt.id }) }}
                    className={cn(
                      "flex flex-col items-center gap-1 p-3 rounded-lg border transition-all",
                      controllerType === opt.id ? "border-primary bg-primary/10" : "border-white/10 bg-white/5 hover:border-white/20"
                    )}
                  >
                    <Gamepad2 className={cn("h-5 w-5", controllerType === opt.id ? "text-primary" : "text-white/50")} />
                    <span className="text-sm text-white">{opt.label}</span>
                    <span className="text-[10px] text-white/40">{opt.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Guia de Primeiros Passos */}
            <div className="rounded-xl bg-[#0c0c10] border border-white/[0.04] p-5 space-y-4">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <HelpCircle className="h-4 w-4 text-primary" />
                Primeiros Passos
              </h3>
              <div className="space-y-2.5">
                {[
                  {
                    step: 1,
                    title: "Crie seu perfil e selecione o time",
                    desc: "Na tela inicial (Splash), use o D-pad ← → ou as setas do teclado para navegar entre as opcoes. Pressione A (Xbox) / X (PS) / Enter para confirmar. Use LB/RB ou ← → para trocar a divisao (Serie A, B, C, D, e ligas internacionais).",
                  },
                  {
                    step: 2,
                    title: "Explore o Dashboard e a barra lateral",
                    desc: "Use o D-pad Cima/Baixo (ou ↑↓ no teclado) para navegar pela barra lateral esquerda. Acesse: Elenco, Calendario, Mercado, Taticas, Financas, Treinamento, Olheiros, Contratos e muito mais.",
                  },
                  {
                    step: 3,
                    title: "Monte seu elenco e configure as taticas",
                    desc: "Em Elenco, use LB/RB (L1/R1 no PS) para filtrar por posicao. Pressione A / X (PS) / Enter para ver o perfil completo de cada jogador. Em Taticas, ajuste a formacao com LT/RT (L2/R2 no PS).",
                  },
                  {
                    step: 4,
                    title: "Treine sua equipe",
                    desc: "No Treinamento, escolha entre treinos tecnicos, fisicos ou taticos. Selecione jogadores especificos para treinos individuais ou sessoes coletivas para melhorar o desempenho geral do elenco.",
                  },
                  {
                    step: 5,
                    title: "Use o Mercado e Olheiros para reforcar",
                    desc: "No Mercado, use LB/RB para alternar entre as abas. Os Olheiros vasculham regioes em busca de talentos. Gerencie Contratos para renovar ou liberar jogadores. Fique de olho no orcamento em Financas!",
                  },
                  {
                    step: 6,
                    title: "Gerencie o Calendario de rodadas",
                    desc: "No Calendario, pressione A / X (PS) / Enter para avancar a rodada. Use X no Xbox (□ no PS) para simular ate sua proxima partida. Use Y (△ no PS) para pular diretamente ao seu proximo jogo.",
                  },
                  {
                    step: 7,
                    title: "Jogue a partida ao vivo!",
                    desc: "Na tela de Pre-Jogo, configure o uniforme com LB/RB e LT/RT, ajuste as taticas com X/□ e pressione A/X (PS)/Enter para jogar. Na partida: START/OPTIONS pausa, A/X acelera, B/O desacelera, SELECT/SHARE pula ao resultado.",
                  },
                  {
                    step: 8,
                    title: "Invista na Infraestrutura",
                    desc: "Melhore as instalacoes do clube (CT, Estadio, Base) para aumentar receitas, desenvolver jovens talentos e atrair jogadores de maior nivel. Cada upgrade impacta diretamente o desempenho a longo prazo.",
                  },
                ].map(({ step, title, desc }) => (
                  <div key={step} className="flex gap-3 p-3 rounded-lg bg-white/5">
                    <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center">
                      <span className="text-xs font-bold text-primary">{step}</span>
                    </div>
                    <div>
                      <div className="text-sm font-medium text-white">{title}</div>
                      <div className="text-xs text-white/50 mt-0.5 leading-relaxed">{desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Referencia completa de controles */}
            <div className="rounded-xl bg-[#0c0c10] border border-white/[0.04] overflow-hidden">
              <div className="px-5 py-3.5 border-b border-white/[0.04]">
                <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                  <Keyboard className="h-4 w-4 text-primary" />
                  Referencia Completa de Controles
                </h3>
              </div>

              {/* Tabs de tipo de input */}
              <div className="flex border-b border-white/[0.04]">
                {([
                  { id: "xbox" as const, label: "Xbox / Generico" },
                  { id: "playstation" as const, label: "PlayStation" },
                  { id: "keyboard" as const, label: "Teclado / Mouse" },
                ] as const).map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setTutorialTab(tab.id)}
                    className={cn(
                      "flex-1 py-2.5 text-xs font-medium transition-colors border-b-2",
                      tutorialTab === tab.id
                        ? "text-white bg-primary/10 border-primary"
                        : "text-white/40 hover:text-white/70 border-transparent"
                    )}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Nota sobre equivalencia */}
              <div className="px-4 py-2.5 bg-white/[0.02] border-b border-white/[0.04]">
                <p className="text-[10px] text-white/40 leading-relaxed">
                  {tutorialTab === "xbox"
                    ? "Mapeamento: A = Confirmar · B = Voltar · X = Acao · Y = Menu · LB/RB = Abas · LT/RT = Acao Secundaria · START = Menu/Pausar · SELECT = Salvar"
                    : tutorialTab === "playstation"
                    ? "Mapeamento: X = Confirmar · O = Voltar · □ = Acao · △ = Menu · L1/R1 = Abas · L2/R2 = Acao Secundaria · OPTIONS = Menu/Pausar · SHARE = Salvar"
                    : "Dica: A maioria dos atalhos de teclado espelha os botoes do controle. O mouse funciona em todas as telas — clique em qualquer botao ou item."}
                </p>
              </div>

              <div className="p-4 space-y-3 max-h-[55vh] overflow-y-auto">
                {tutorialTab !== "keyboard" ? (
                  gameContexts.map((ctx) => {
                    const mapping = CONTROL_MAPPINGS[ctx.id]
                    const allEntries = Object.entries(mapping) as [string, GameAction][]
                    const hasDpad = allEntries.some(([btn]) => btn.startsWith("DPAD"))
                    const nonDpad = allEntries.filter(([btn]) => !btn.startsWith("DPAD"))

                    return (
                      <div key={ctx.id} className="border border-white/[0.04] rounded-lg overflow-hidden">
                        <div className="px-4 py-2.5 bg-white/[0.03] border-b border-white/[0.04]">
                          <div className="text-xs font-semibold text-white">{ctx.label}</div>
                          <div className="text-[10px] text-white/40">{ctx.description}</div>
                        </div>
                        <div className="p-3 grid grid-cols-1 gap-2">
                          {nonDpad.map(([btn, action]) => (
                            <div key={btn} className="flex items-center gap-2.5">
                              {renderBtnBadge(btn, ctrl)}
                              <span className="text-xs text-white/65">
                                {ACTION_LABELS[action] || action}
                              </span>
                            </div>
                          ))}
                          {hasDpad && (
                            <div className="flex items-center gap-2.5">
                              <ControllerButton button="DPAD" controller={ctrl} size="sm" showLabel={false} />
                              <span className="text-xs text-white/65">{t.configuracoes.navegar_cima_baixo_esq_dir}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })
                ) : (
                  keyboardShortcuts.map((section) => (
                    <div key={section.section} className="border border-white/[0.04] rounded-lg overflow-hidden">
                      <div className="px-4 py-2.5 bg-white/[0.03] border-b border-white/[0.04]">
                        <div className="text-xs font-semibold text-white">{section.section}</div>
                      </div>
                      <div className="p-3 space-y-2">
                        {section.items.map((item, i) => (
                          <div key={i} className="flex items-start justify-between gap-3">
                            <div className="flex items-center gap-1 flex-wrap flex-shrink-0">
                              {item.keys.map((key) => (
                                <kbd
                                  key={key}
                                  className="px-1.5 py-0.5 text-[10px] font-mono text-white/70 bg-white/10 border border-white/20 rounded"
                                >
                                  {key}
                                </kbd>
                              ))}
                            </div>
                            <span className="text-xs text-white/50 text-right leading-relaxed">{item.label}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )
      }

      default:
        return (
          <div className="flex items-center justify-center h-64">
            <p className="text-white/50">{t.common.inDevelopment}</p>
          </div>
        )
    }
  }

  return (
    <ControllerTypeContext.Provider value={controllerType === "playstation" ? "playstation" : "xbox"}>
      <div className="h-screen md:pl-0 pl-0 pb-20 md:pb-0 bg-[#050508] flex flex-col overflow-hidden">
        <GameHeader team={userTeam} />

        {/* pb-24 + overflow-x-hidden: mesma correcao do menu — a rolagem lateral
            nascia do proprio `overflow-y-auto`, e a barra de acoes cobria o fim
            da lista nas telas mais longas (acessibilidade, perfil). */}
        <main className="flex-1 p-4 pb-24 overflow-y-auto overflow-x-hidden space-y-4">
          {/* Header */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-4">
              <Button variant="ghost" size="sm" onClick={() => setCurrentView("menu")} className="shrink-0 text-white/60 hover:text-white">
                <ChevronLeft className="h-4 w-4 mr-1" />
                {t.common.back}
              </Button>
              <h1 className="truncate text-xl font-semibold text-white capitalize">
                {(cardTitles[currentView] ?? menuCards.find(c => c.id === currentView)?.title ?? t.settings.cards.settings).replace("\n", " ")}
              </h1>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Button variant="outline" size="sm" onClick={handleRestoreDefaults} className="text-xs bg-transparent border-white/10 text-white/70 hover:bg-white/5">
                <RotateCcw className="mr-2 h-3.5 w-3.5" />
                {t.common.restore}
              </Button>
              <Button size="sm" onClick={handleSaveSettings} disabled={saving} className={cn("text-xs transition-all", saved ? "bg-[var(--brand)]/20 text-[var(--brand)]" : "bg-[var(--brand)] text-[var(--brand-ink)] hover:bg-[var(--brand-2)]")}>
                {saving ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : saved ? <Check className="mr-2 h-3.5 w-3.5" /> : <Save className="mr-2 h-3.5 w-3.5" />}
                {saved ? t.common.saved : t.common.save}
              </Button>
            </div>
          </div>

          {/* Content. w-full + min-w-0: sem isto um filho largo (um <select>, uma
              linha de botoes) estica o container e volta a rolagem lateral. */}
          <div className="w-full min-w-0 max-w-3xl">
            {renderDetailView()}
          </div>
        </main>
        
      </div>
    </ControllerTypeContext.Provider>
  )
}
