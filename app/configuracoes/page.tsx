"use client"

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  Settings,
  User,
  Globe,
  Clock,
  Users,
  Grid2X2,
  UserPlus,
  Music,
  ChevronLeft,
  ChevronRight,
  Volume2,
  Monitor,
  Gamepad2,
  Bell,
  Save,
  RotateCcw,
  Shirt,
  Palette,
  Check,
  Loader2,
  Plus,
  Trash2,
  Zap,
  Cpu,
  X,
} from "lucide-react"
import { GameSidebar } from "@/components/game-sidebar"
import { GameHeader } from "@/components/game-header"
import { MusicPlayer } from "@/components/music-player"
import { TeamCrest } from "@/components/team-crest"
import { Jersey } from "@/components/jersey"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Slider } from "@/components/ui/slider"
import { Input } from "@/components/ui/input"
import { useTheme, themePresets, type ThemeColor } from "@/components/theme-provider"
import { getTeamUniforms, allTeams } from "@/lib/teams-data"
import { useGameState, useUserTeam, type ManagerProfile } from "@/lib/save-system"
import { cn } from "@/lib/utils"
import { 
  ControllerButton, 
  ControllerTypeContext 
} from "@/components/controller-buttons"
import { 
  CONTROL_MAPPINGS, 
  ACTION_LABELS, 
  type GameContext, 
  type GameAction 
} from "@/lib/gamepad-controls"
import {
  type PerformanceLevel,
  performancePresets,
  performanceLevelLabels,
  loadPerformanceLevel,
  savePerformanceLevel,
  detectPerformanceLevel,
} from "@/lib/performance-config"

type ViewType = "menu" | "configuracoes" | "perfil" | "online" | "tempo" | "times" | "escalacoes" | "criar_atleta" | "musica"

const menuCards = [
  { id: "configuracoes" as ViewType, title: "Configuracoes", icon: Settings, row: 0 },
  { id: "perfil" as ViewType, title: "Perfil", icon: User, row: 0 },
  { id: "online" as ViewType, title: "Configuracoes\nonline", icon: Globe, row: 0 },
  { id: "tempo" as ViewType, title: "Tempo de jogo", icon: Clock, row: 0 },
  { id: "times" as ViewType, title: "Editar\ntimes", icon: Grid2X2, row: 1 },
  { id: "escalacoes" as ViewType, title: "Escalacoes", icon: Grid2X2, row: 1 },
  { id: "criar_atleta" as ViewType, title: "Criar\natleta", icon: UserPlus, row: 1 },
  { id: "musica" as ViewType, title: "Musica\nEA SPORTS", icon: Music, row: 1 },
]

const languageOptions = [
  { id: "pt-BR", label: "Portugues (Brasil)", flag: "BR" },
  { id: "en-US", label: "English (US)", flag: "US" },
  { id: "es-ES", label: "Espanol", flag: "ES" },
]

const managerColors = [
  "#ef4444", "#3b82f6", "#22c55e", "#f59e0b", "#8b5cf6", "#ec4899", "#06b6d4", "#84cc16",
]

export default function ConfiguracoesPage() {
  const { theme, setTheme, teamColors, setTeamColors } = useTheme()
  const { state, setState } = useGameState()
  const { team: userTeam } = useUserTeam()
  
  const uniforms = getTeamUniforms(userTeam)
  
  const [currentView, setCurrentView] = useState<ViewType>("menu")
  const [selectedCardIndex, setSelectedCardIndex] = useState(0)
  const [musicVolume, setMusicVolume] = useState([70])
  const [sfxVolume, setSfxVolume] = useState([80])
  const [autoSave, setAutoSave] = useState(true)
  const [notifications, setNotifications] = useState(true)
  const [matchSpeed, setMatchSpeed] = useState("normal")
  const [selectedUniform, setSelectedUniform] = useState<"home" | "away" | "third">(state.selectedUniform || "home")
  const [language, setLanguage] = useState(state.language || "pt-BR")
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  
  // Multiplayer state
  const [multiplayerEnabled, setMultiplayerEnabled] = useState(state.multiplayerEnabled || false)
  const [managers, setManagers] = useState<ManagerProfile[]>(state.managers || [])
  const [newManagerName, setNewManagerName] = useState("")
  
  // Controller state
  const [controllerType, setControllerType] = useState<"xbox" | "playstation">(state.controllerType || "playstation")
  
  // Performance state
  const [performanceLevel, setPerformanceLevel] = useState<PerformanceLevel>("medium")

  useEffect(() => {
    if (state.selectedUniform) setSelectedUniform(state.selectedUniform)
    if (state.language) setLanguage(state.language)
    if (state.multiplayerEnabled !== undefined) setMultiplayerEnabled(state.multiplayerEnabled)
    if (state.managers) setManagers(state.managers)
    if (state.controllerType) setControllerType(state.controllerType)
  }, [state])

  useEffect(() => {
    if (theme === "team" && !teamColors) {
      setTeamColors({ primary: userTeam.cor1, secondary: userTeam.cor2 })
    }
  }, [theme, teamColors, setTeamColors, userTeam])

  const handleAddManager = () => {
    if (!newManagerName.trim() || managers.length >= 6) return
    const usedColors = managers.map(m => m.color)
    const availableColor = managerColors.find(c => !usedColors.includes(c)) || managerColors[0]
    const newManager: ManagerProfile = {
      id: `manager-${Date.now()}`,
      name: newManagerName.trim(),
      teamShort: userTeam.curto,
      color: availableColor,
      controllerIndex: managers.length,
    }
    setManagers([...managers, newManager])
    setNewManagerName("")
  }
  
  const handleRemoveManager = (id: string) => setManagers(managers.filter(m => m.id !== id))

  const handleSaveSettings = async () => {
    setSaving(true)
    await new Promise(resolve => setTimeout(resolve, 500))
    setState({ selectedUniform, language, multiplayerEnabled, managers, controllerType })
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const handleRestoreDefaults = () => {
    setMusicVolume([70])
    setSfxVolume([80])
    setAutoSave(true)
    setNotifications(true)
    setMatchSpeed("normal")
    setSelectedUniform("home")
    setLanguage("pt-BR")
    setTheme("green")
    setMultiplayerEnabled(false)
    setManagers([])
    setControllerType("playstation")
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
        setSelectedCardIndex(prev => Math.min(prev + 4, menuCards.length - 1))
      } else if (e.key === "ArrowUp") {
        setSelectedCardIndex(prev => Math.max(prev - 4, 0))
      } else if (e.key === "Enter" || e.key === " ") {
        setCurrentView(menuCards[selectedCardIndex].id)
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [currentView, selectedCardIndex])

  // Menu view with cards
  if (currentView === "menu") {
    return (
      <ControllerTypeContext.Provider value={controllerType}>
        <div className="h-screen pl-[72px] bg-[#0a0a0a] flex flex-col overflow-hidden">
          <GameSidebar />
          <GameHeader team={userTeam} />
          
          <main className="flex-1 p-4 overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between mb-8">
              <h1 className="text-xl md:text-2xl font-semibold text-white/70">Personalizar</h1>
              <div className="flex items-center gap-2 text-white/50 text-sm">
                <span>{state.managerName || "7spt"}</span>
                <span className="text-white/30">|</span>
                <span>Pressione <kbd className="px-1.5 py-0.5 bg-white/10 rounded text-xs">Q</kbd> para reconectar</span>
              </div>
            </div>
            
            {/* Cards Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 max-w-5xl">
              {menuCards.map((card, index) => {
                const Icon = card.icon
                const isSelected = index === selectedCardIndex
                return (
                  <motion.button
                    key={card.id}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setCurrentView(card.id)}
                    onMouseEnter={() => setSelectedCardIndex(index)}
                    className={cn(
                      "relative flex flex-col justify-between p-4 md:p-5 rounded-xl text-left overflow-hidden transition-all aspect-square",
                      "bg-gradient-to-br from-[#1a3a4a]/80 via-[#142a35]/90 to-[#0d1a20]",
                      isSelected 
                        ? "ring-2 ring-[#00d4ff] shadow-lg shadow-[#00d4ff]/20" 
                        : "ring-1 ring-white/5 hover:ring-white/20"
                    )}
                  >
                    <h2 className="text-sm md:text-base font-semibold text-white whitespace-pre-line leading-tight">
                      {card.title}
                    </h2>
                    
                    <div className="flex justify-center items-center">
                      <Icon className="h-8 w-8 md:h-10 md:w-10 text-white/70" strokeWidth={1.5} />
                    </div>
                  </motion.button>
                )
              })}
            </div>
            
            {/* Bottom controls */}
            <div className="fixed bottom-0 left-[72px] right-0 h-14 bg-[#0d0d0d] border-t border-white/10 flex items-center justify-between px-4 md:px-6">
              <div className="flex items-center gap-4">
                <Button variant="ghost" size="sm" className="text-white/60 hover:text-white text-xs">
                  <Gamepad2 className="h-4 w-4 mr-2" />
                  Selecionar
                </Button>
                <Button variant="ghost" size="sm" className="text-white/60 hover:text-white text-xs" onClick={() => window.history.back()}>
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  Voltar
                </Button>
              </div>
            </div>
          </main>
          
          <MusicPlayer defaultSize="mini" autoPlay={false} />
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
            <div className="rounded-xl bg-[#141414] border border-white/5 p-6 space-y-5">
              <h3 className="text-sm font-medium text-white flex items-center gap-2">
                <Palette className="h-4 w-4 text-primary" />
                Cores do Tema
              </h3>
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
            
            <div className="rounded-xl bg-[#141414] border border-white/5 p-6 space-y-4">
              <h3 className="text-sm font-medium text-white flex items-center gap-2">
                <Bell className="h-4 w-4 text-primary" />
                Notificacoes e Sistema
              </h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 rounded-lg bg-white/5">
                  <div>
                    <div className="text-sm text-white">Auto-save</div>
                    <div className="text-xs text-white/40">Salvar automaticamente</div>
                  </div>
                  <Switch checked={autoSave} onCheckedChange={setAutoSave} />
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg bg-white/5">
                  <div>
                    <div className="text-sm text-white">Notificacoes</div>
                    <div className="text-xs text-white/40">Alertas do jogo</div>
                  </div>
                  <Switch checked={notifications} onCheckedChange={setNotifications} />
                </div>
              </div>
            </div>
          </div>
        )
        
      case "perfil":
        return (
          <div className="space-y-6">
            <div className="rounded-xl bg-[#141414] border border-white/5 p-6 space-y-5">
              <h3 className="text-sm font-medium text-white flex items-center gap-2">
                <User className="h-4 w-4 text-primary" />
                Informacoes do Tecnico
              </h3>
              <div className="flex items-center gap-4">
                <div className="h-16 w-16 rounded-full bg-primary/20 flex items-center justify-center">
                  <User className="h-8 w-8 text-primary" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white">{state.managerName || "Tecnico"}</h2>
                  <p className="text-sm text-white/50">{userTeam.nome}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 rounded-lg bg-white/5">
                  <div className="text-xs text-white/40">Temporada</div>
                  <div className="text-lg font-bold text-white">{state.season}</div>
                </div>
                <div className="p-3 rounded-lg bg-white/5">
                  <div className="text-xs text-white/40">Semana</div>
                  <div className="text-lg font-bold text-white">{state.week}/48</div>
                </div>
              </div>
            </div>
            
            <div className="rounded-xl bg-[#141414] border border-white/5 p-6 space-y-5">
              <h3 className="text-sm font-medium text-white flex items-center gap-2">
                <Globe className="h-4 w-4 text-primary" />
                Idioma
              </h3>
              <div className="grid grid-cols-1 gap-2">
                {languageOptions.map((lang) => (
                  <button
                    key={lang.id}
                    onClick={() => setLanguage(lang.id)}
                    className={cn(
                      "flex items-center gap-3 p-3 rounded-lg border transition-all text-left",
                      language === lang.id ? "border-primary bg-primary/10" : "border-white/10 bg-white/5 hover:border-white/20"
                    )}
                  >
                    <span className="text-lg">{lang.flag === "BR" ? "🇧🇷" : lang.flag === "US" ? "🇺🇸" : "🇪🇸"}</span>
                    <span className="text-sm text-white">{lang.label}</span>
                    {language === lang.id && <Check className="h-4 w-4 text-primary ml-auto" />}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )
        
      case "tempo":
        return (
          <div className="space-y-6">
            <div className="rounded-xl bg-[#141414] border border-white/5 p-6 space-y-5">
              <h3 className="text-sm font-medium text-white flex items-center gap-2">
                <Clock className="h-4 w-4 text-primary" />
                Velocidade de Partida
              </h3>
              <div className="grid grid-cols-3 gap-2">
                {["lento", "normal", "rapido"].map((speed) => (
                  <button
                    key={speed}
                    onClick={() => setMatchSpeed(speed)}
                    className={cn(
                      "p-3 rounded-lg border text-sm font-medium transition-all capitalize",
                      matchSpeed === speed ? "border-primary bg-primary/10 text-white" : "border-white/10 bg-white/5 text-white/60 hover:border-white/20"
                    )}
                  >
                    {speed}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )
        
      case "times":
        return (
          <div className="space-y-6">
            <div className="rounded-xl bg-[#141414] border border-white/5 p-6 space-y-5">
              <h3 className="text-sm font-medium text-white flex items-center gap-2">
                <Users className="h-4 w-4 text-primary" />
                Multiplayer Local
              </h3>
              <div className="flex items-center justify-between p-3 rounded-lg bg-white/5">
                <div>
                  <div className="text-sm text-white">Ativar Multiplayer</div>
                  <div className="text-xs text-white/40">Ate 6 tecnicos</div>
                </div>
                <Switch checked={multiplayerEnabled} onCheckedChange={setMultiplayerEnabled} />
              </div>
              
              {multiplayerEnabled && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Input
                      value={newManagerName}
                      onChange={(e) => setNewManagerName(e.target.value)}
                      placeholder="Nome do tecnico..."
                      className="flex-1 bg-white/5 border-white/10 text-white"
                      onKeyDown={(e) => e.key === "Enter" && handleAddManager()}
                    />
                    <Button onClick={handleAddManager} disabled={!newManagerName.trim() || managers.length >= 6} size="sm">
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                  {managers.map((manager) => (
                    <div key={manager.id} className="flex items-center gap-3 p-3 rounded-lg bg-white/5">
                      <div className="h-8 w-8 rounded-full" style={{ backgroundColor: manager.color }} />
                      <div className="flex-1">
                        <div className="text-sm text-white">{manager.name}</div>
                        <div className="text-xs text-white/40">Controle {manager.controllerIndex + 1}</div>
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => handleRemoveManager(manager.id)}>
                        <Trash2 className="h-4 w-4 text-red-400" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            
            <div className="rounded-xl bg-[#141414] border border-white/5 p-6 space-y-5">
              <h3 className="text-sm font-medium text-white flex items-center gap-2">
                <Shirt className="h-4 w-4 text-primary" />
                Uniforme do Time
              </h3>
              <div className="grid grid-cols-3 gap-4">
                {(["home", "away", "third"] as const).map((type) => {
                  const uniform = uniforms[type]
                  return (
                    <button
                      key={type}
                      onClick={() => setSelectedUniform(type)}
                      className={cn(
                        "p-4 rounded-lg border transition-all flex flex-col items-center gap-2",
                        selectedUniform === type ? "border-primary bg-primary/10" : "border-white/10 bg-white/5 hover:border-white/20"
                      )}
                    >
                      <Jersey uniform={uniform} size="md" />
                      <span className="text-xs text-white capitalize">{type === "home" ? "Titular" : type === "away" ? "Visitante" : "Alternativo"}</span>
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        )
        
      case "musica":
        return (
          <div className="space-y-6">
            <div className="rounded-xl bg-[#141414] border border-white/5 p-6 space-y-5">
              <h3 className="text-sm font-medium text-white flex items-center gap-2">
                <Volume2 className="h-4 w-4 text-primary" />
                Volume da Musica
              </h3>
              <div className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-white/60">Musica</span>
                    <span className="text-sm text-white">{musicVolume[0]}%</span>
                  </div>
                  <Slider value={musicVolume} onValueChange={setMusicVolume} max={100} />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-white/60">Efeitos Sonoros</span>
                    <span className="text-sm text-white">{sfxVolume[0]}%</span>
                  </div>
                  <Slider value={sfxVolume} onValueChange={setSfxVolume} max={100} />
                </div>
              </div>
            </div>
            
            <div className="rounded-xl bg-[#141414] border border-white/5 p-6">
              <h3 className="text-sm font-medium text-white mb-4">Player de Musica</h3>
              <p className="text-xs text-white/50 mb-4">O player de musica esta disponivel na parte inferior da tela.</p>
              <MusicPlayer defaultSize="compact" autoPlay={false} offsetLeft={0} />
            </div>
          </div>
        )
        
      case "online":
        return (
          <div className="space-y-6">
            <div className="rounded-xl bg-[#141414] border border-white/5 p-6 space-y-5">
              <h3 className="text-sm font-medium text-white flex items-center gap-2">
                <Globe className="h-4 w-4 text-primary" />
                Configuracoes Online
              </h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 rounded-lg bg-white/5">
                  <div>
                    <div className="text-sm text-white">Modo Online</div>
                    <div className="text-xs text-white/40">Conectar a servidores</div>
                  </div>
                  <Switch />
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg bg-white/5">
                  <div>
                    <div className="text-sm text-white">Atualizacoes Automaticas</div>
                    <div className="text-xs text-white/40">Baixar elencos atualizados</div>
                  </div>
                  <Switch defaultChecked />
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg bg-white/5">
                  <div>
                    <div className="text-sm text-white">Partidas Online</div>
                    <div className="text-xs text-white/40">Jogar contra outros usuarios</div>
                  </div>
                  <Switch />
                </div>
              </div>
            </div>
          </div>
        )
        
      case "escalacoes":
        return (
          <div className="space-y-6">
            <div className="rounded-xl bg-[#141414] border border-white/5 p-6 space-y-5">
              <h3 className="text-sm font-medium text-white flex items-center gap-2">
                <Grid2X2 className="h-4 w-4 text-primary" />
                Escalacoes Salvas
              </h3>
              <p className="text-sm text-white/50">Gerencie suas escalacoes personalizadas para diferentes situacoes de jogo.</p>
              <div className="grid gap-3">
                {["Escalacao Principal", "Rotacao", "Jovens"].map((name, i) => (
                  <div key={name} className="flex items-center justify-between p-4 rounded-lg bg-white/5 hover:bg-white/10 transition-colors cursor-pointer">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-lg bg-primary/20 flex items-center justify-center">
                        <span className="text-sm font-bold text-primary">{i + 1}</span>
                      </div>
                      <div>
                        <div className="text-sm font-medium text-white">{name}</div>
                        <div className="text-xs text-white/40">4-3-3 • 11 jogadores</div>
                      </div>
                    </div>
                    <ChevronRight className="h-5 w-5 text-white/30" />
                  </div>
                ))}
              </div>
              <Button variant="outline" size="sm" className="w-full border-dashed border-white/20 text-white/60 hover:text-white hover:bg-white/5">
                <Plus className="h-4 w-4 mr-2" />
                Nova Escalacao
              </Button>
            </div>
          </div>
        )
        
      case "criar_atleta":
        return (
          <div className="space-y-6">
            <div className="rounded-xl bg-[#141414] border border-white/5 p-6 space-y-5">
              <h3 className="text-sm font-medium text-white flex items-center gap-2">
                <UserPlus className="h-4 w-4 text-primary" />
                Criar Novo Atleta
              </h3>
              <p className="text-sm text-white/50">Crie jogadores personalizados para adicionar ao seu elenco.</p>
              <div className="space-y-4">
                <div>
                  <label className="text-xs text-white/60 mb-1 block">Nome do Jogador</label>
                  <Input placeholder="Digite o nome..." className="bg-white/5 border-white/10 text-white" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-white/60 mb-1 block">Posicao</label>
                    <select className="w-full h-9 rounded-md bg-white/5 border border-white/10 text-white text-sm px-3">
                      <option value="ATA">Atacante</option>
                      <option value="MEI">Meia</option>
                      <option value="ZAG">Zagueiro</option>
                      <option value="LAT">Lateral</option>
                      <option value="GOL">Goleiro</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-white/60 mb-1 block">Idade</label>
                    <Input type="number" placeholder="18" min={16} max={45} className="bg-white/5 border-white/10 text-white" />
                  </div>
                </div>
                <div>
                  <label className="text-xs text-white/60 mb-1 block">Overall</label>
                  <Slider defaultValue={[70]} max={99} min={40} />
                </div>
              </div>
              <Button className="w-full bg-primary hover:bg-primary/90">
                <Plus className="h-4 w-4 mr-2" />
                Criar Atleta
              </Button>
            </div>
          </div>
        )
        
      default:
        return (
          <div className="flex items-center justify-center h-64">
            <p className="text-white/50">Em desenvolvimento...</p>
          </div>
        )
    }
  }

  return (
    <ControllerTypeContext.Provider value={controllerType}>
      <div className="h-screen pl-[72px] bg-[#0a0a0a] flex flex-col overflow-hidden">
        <GameSidebar />
        <GameHeader team={userTeam} />

        <main className="flex-1 p-4 overflow-y-auto space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="sm" onClick={() => setCurrentView("menu")} className="text-white/60 hover:text-white">
                <ChevronLeft className="h-4 w-4 mr-1" />
                Voltar
              </Button>
              <h1 className="text-xl font-semibold text-white capitalize">
                {menuCards.find(c => c.id === currentView)?.title.replace("\n", " ") || "Configuracoes"}
              </h1>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={handleRestoreDefaults} className="text-xs bg-transparent border-white/10 text-white/70 hover:bg-white/5">
                <RotateCcw className="mr-2 h-3.5 w-3.5" />
                Restaurar
              </Button>
              <Button size="sm" onClick={handleSaveSettings} disabled={saving} className={cn("text-xs transition-all", saved ? "bg-[#1db954]/20 text-[#1db954]" : "bg-[#1db954] text-black hover:bg-[#1ed760]")}>
                {saving ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : saved ? <Check className="mr-2 h-3.5 w-3.5" /> : <Save className="mr-2 h-3.5 w-3.5" />}
                {saved ? "Salvo!" : "Salvar"}
              </Button>
            </div>
          </div>

          {/* Content */}
          <div className="max-w-2xl">
            {renderDetailView()}
          </div>
        </main>
        
        <MusicPlayer defaultSize="mini" autoPlay={false} />
      </div>
    </ControllerTypeContext.Provider>
  )
}
