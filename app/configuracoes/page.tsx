"use client"

import { useState, useEffect } from "react"
import {
  Volume2,
  Monitor,
  Globe,
  Gamepad2,
  Bell,
  Save,
  RotateCcw,
  Shirt,
  Palette,
  Check,
  Loader2,
  Users,
  Plus,
  Trash2,
  ChevronRight,
} from "lucide-react"
import { GameSidebar } from "@/components/game-sidebar"
import { GameHeader } from "@/components/game-header"
import { MusicPlayer } from "@/components/music-player"
import { TeamCrest } from "@/components/team-crest"
import { Jersey } from "@/components/jersey"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Slider } from "@/components/ui/slider"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
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

const languageOptions = [
  { id: "pt-BR", label: "Portugues (Brasil)", flag: "🇧🇷" },
  { id: "en-US", label: "English (US)", flag: "🇺🇸" },
  { id: "es-ES", label: "Espanol", flag: "🇪🇸" },
]

const managerColors = [
  "#ef4444", // Vermelho
  "#3b82f6", // Azul
  "#22c55e", // Verde
  "#f59e0b", // Laranja
  "#8b5cf6", // Roxo
  "#ec4899", // Rosa
  "#06b6d4", // Ciano
  "#84cc16", // Lima
]

const contextLabels: Record<GameContext, string> = {
  menu: "Menu / Navegacao",
  match_preview: "Pre-Jogo",
  match_live: "Partida Ao Vivo",
  match_paused: "Partida Pausada",
  tactical: "Editor Tatico",
  substitution: "Substituicoes",
  calendar: "Calendario",
  squad: "Elenco",
  transfers: "Mercado",
  modal: "Modal",
}

export default function ConfiguracoesPage() {
  const { theme, setTheme, teamColors, setTeamColors } = useTheme()
  const { state, setState } = useGameState()
  const { team: userTeam } = useUserTeam()
  
  // Get uniforms from the user's selected team
  const uniforms = getTeamUniforms(userTeam)
  
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
  const [selectedContext, setSelectedContext] = useState<GameContext>("match_live")

  // Sync selectedUniform with state when it loads
  useEffect(() => {
    if (state.selectedUniform) {
      setSelectedUniform(state.selectedUniform)
    }
    if (state.language) {
      setLanguage(state.language)
    }
    if (state.multiplayerEnabled !== undefined) {
      setMultiplayerEnabled(state.multiplayerEnabled)
    }
    if (state.managers) {
      setManagers(state.managers)
    }
    if (state.controllerType) {
      setControllerType(state.controllerType)
    }
  }, [state.selectedUniform, state.language, state.multiplayerEnabled, state.managers, state.controllerType])

  // Set team colors when "team" theme is selected
  useEffect(() => {
    if (theme === "team" && !teamColors) {
      setTeamColors({ primary: userTeam.cor1, secondary: userTeam.cor2 })
    }
  }, [theme, teamColors, setTeamColors, userTeam])

  const handleThemeChange = (newTheme: ThemeColor) => {
    if (newTheme === "team") {
      setTeamColors({ primary: userTeam.cor1, secondary: userTeam.cor2 })
    }
    setTheme(newTheme)
  }

  const handleUniformSelect = (uniform: "home" | "away" | "third") => {
    setSelectedUniform(uniform)
  }

  const handleLanguageSelect = (langId: string) => {
    setLanguage(langId)
  }
  
  const handleAddManager = () => {
    if (!newManagerName.trim() || managers.length >= 4) return
    
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
  
  const handleRemoveManager = (id: string) => {
    setManagers(managers.filter(m => m.id !== id))
  }
  
  const handleManagerTeamChange = (managerId: string, teamShort: string) => {
    setManagers(managers.map(m => 
      m.id === managerId ? { ...m, teamShort } : m
    ))
  }
  
  const handleManagerColorChange = (managerId: string, color: string) => {
    setManagers(managers.map(m => 
      m.id === managerId ? { ...m, color } : m
    ))
  }

  const handleSaveSettings = async () => {
    setSaving(true)
    // Save to game state
    await new Promise(resolve => setTimeout(resolve, 500))
    setState({
      selectedUniform,
      language,
      multiplayerEnabled,
      managers,
      controllerType,
    })
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

  return (
    <ControllerTypeContext.Provider value={controllerType}>
      <div className="min-h-screen pl-[72px] pb-24 bg-[#0a0a0a]">
        <GameSidebar />
        <GameHeader team={userTeam} />

        <main className="p-6 space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-white tracking-tight">Configuracoes</h1>
              <p className="text-sm text-white/50 mt-1">Personalize sua experiencia de jogo</p>
            </div>
            <div className="flex items-center gap-2">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleRestoreDefaults}
                className="text-xs bg-transparent border-white/10 text-white/70 hover:bg-white/5 hover:text-white"
              >
                <RotateCcw className="mr-2 h-3.5 w-3.5" />
                Restaurar
              </Button>
              <Button 
                size="sm" 
                onClick={handleSaveSettings}
                disabled={saving}
                className={cn(
                  "text-xs transition-all",
                  saved 
                    ? "bg-[#1db954]/20 text-[#1db954]" 
                    : "bg-[#1db954] text-black hover:bg-[#1ed760]"
                )}
              >
                {saving ? (
                  <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                ) : saved ? (
                  <Check className="mr-2 h-3.5 w-3.5" />
                ) : (
                  <Save className="mr-2 h-3.5 w-3.5" />
                )}
                {saved ? "Salvo!" : "Salvar"}
              </Button>
            </div>
          </div>

          <Tabs defaultValue="theme" className="w-full">
            <TabsList className="bg-[#1a1a1a] border border-white/10 p-1 h-auto flex-wrap">
              <TabsTrigger value="theme" className="text-xs data-[state=active]:bg-white/10 data-[state=active]:text-white text-white/50 px-4 py-2">
                <Palette className="mr-2 h-3.5 w-3.5" />
                Tema
              </TabsTrigger>
              <TabsTrigger value="multiplayer" className="text-xs data-[state=active]:bg-white/10 data-[state=active]:text-white text-white/50 px-4 py-2">
                <Users className="mr-2 h-3.5 w-3.5" />
                Multiplayer
              </TabsTrigger>
              <TabsTrigger value="controls" className="text-xs data-[state=active]:bg-white/10 data-[state=active]:text-white text-white/50 px-4 py-2">
                <Gamepad2 className="mr-2 h-3.5 w-3.5" />
                Controles
              </TabsTrigger>
              <TabsTrigger value="game" className="text-xs data-[state=active]:bg-white/10 data-[state=active]:text-white text-white/50 px-4 py-2">
                <Monitor className="mr-2 h-3.5 w-3.5" />
                Jogo
              </TabsTrigger>
              <TabsTrigger value="audio" className="text-xs data-[state=active]:bg-white/10 data-[state=active]:text-white text-white/50 px-4 py-2">
                <Volume2 className="mr-2 h-3.5 w-3.5" />
                Audio
              </TabsTrigger>
              <TabsTrigger value="uniform" className="text-xs data-[state=active]:bg-white/10 data-[state=active]:text-white text-white/50 px-4 py-2">
                <Shirt className="mr-2 h-3.5 w-3.5" />
                Uniformes
              </TabsTrigger>
              <TabsTrigger value="language" className="text-xs data-[state=active]:bg-white/10 data-[state=active]:text-white text-white/50 px-4 py-2">
                <Globe className="mr-2 h-3.5 w-3.5" />
                Idioma
              </TabsTrigger>
            </TabsList>

            {/* Theme Settings */}
            <TabsContent value="theme" className="mt-6">
              <div className="grid gap-6 lg:grid-cols-2">
                {/* Color Presets */}
                <div className="rounded-xl bg-[#141414] border border-white/5 p-6 space-y-5">
                  <div>
                    <h3 className="text-sm font-medium text-white flex items-center gap-2">
                      <Palette className="h-4 w-4 text-primary" />
                      Cores do Tema
                    </h3>
                    <p className="text-xs text-white/40 mt-1">Escolha um esquema de cores para a interface</p>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    {(Object.keys(themePresets) as Exclude<ThemeColor, "team">[]).map((key) => {
                      const preset = themePresets[key]
                      const isActive = theme === key
                      
                      return (
                        <button
                          key={key}
                          onClick={() => handleThemeChange(key)}
                          className={cn(
                            "relative flex items-center gap-3 p-3 rounded-lg border transition-all text-left",
                            isActive 
                              ? "border-primary bg-primary/10" 
                              : "border-white/10 bg-white/5 hover:border-white/20"
                          )}
                        >
                          <div className="flex gap-1">
                            <div 
                              className="h-6 w-6 rounded-full border border-white/20"
                              style={{ backgroundColor: preset.primary }}
                            />
                            <div 
                              className="h-6 w-6 rounded-full border border-white/20 -ml-2"
                              style={{ backgroundColor: preset.accent }}
                            />
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

                {/* Team Colors - Apenas cores do time do usuario */}
                <div className="rounded-xl bg-[#141414] border border-white/5 p-6 space-y-5">
                  <div>
                    <h3 className="text-sm font-medium text-white flex items-center gap-2">
                      <TeamCrest team={userTeam} size="xs" />
                      Cores do Time
                    </h3>
                    <p className="text-xs text-white/40 mt-1">Use as cores do {userTeam.nome} na interface</p>
                  </div>

                  <button
                    onClick={() => {
                      setTeamColors({ primary: userTeam.cor1, secondary: userTeam.cor2 })
                      setTheme("team")
                    }}
                    className={cn(
                      "relative w-full flex items-center gap-4 p-4 rounded-lg border transition-all",
                      theme === "team" 
                        ? "border-primary bg-primary/10" 
                        : "border-white/10 bg-white/5 hover:border-white/20"
                    )}
                  >
                    <TeamCrest team={userTeam} size="md" />
                    <div className="flex-1 text-left">
                      <div className="text-sm font-medium text-white">{userTeam.nome}</div>
                      <div className="flex items-center gap-2 mt-1">
                        <div 
                          className="h-4 w-4 rounded-full border border-white/20"
                          style={{ backgroundColor: userTeam.cor1 }}
                        />
                        <div 
                          className="h-4 w-4 rounded-full border border-white/20"
                          style={{ backgroundColor: userTeam.cor2 }}
                        />
                        <span className="text-xs text-white/40">Cores do clube</span>
                      </div>
                    </div>
                    {theme === "team" && (
                      <div className="h-6 w-6 rounded-full bg-primary flex items-center justify-center">
                        <Check className="h-3.5 w-3.5 text-primary-foreground" />
                      </div>
                    )}
                  </button>

                  {/* Preview das cores do time */}
                  <div className="pt-4 border-t border-white/10">
                    <p className="text-xs text-white/40 mb-3">Preview das cores</p>
                    <div className="flex items-center gap-3">
                      <div 
                        className="flex-1 h-12 rounded-lg flex items-center justify-center text-xs font-medium"
                        style={{ backgroundColor: userTeam.cor1, color: userTeam.cor2 }}
                      >
                        Cor Primaria
                      </div>
                      <div 
                        className="flex-1 h-12 rounded-lg flex items-center justify-center text-xs font-medium border border-white/10"
                        style={{ backgroundColor: userTeam.cor2, color: userTeam.cor1 }}
                      >
                        Cor Secundaria
                      </div>
                    </div>
                  </div>
                </div>

                {/* Preview */}
                <div className="lg:col-span-2 rounded-xl bg-[#141414] border border-white/5 p-6">
                  <h3 className="text-sm font-medium text-white mb-4">Preview</h3>
                  <div className="flex items-center gap-4 flex-wrap">
                    <div className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium">
                      Botao Primario
                    </div>
                    <div className="px-4 py-2 rounded-lg bg-accent text-accent-foreground text-sm font-medium">
                      Botao Accent
                    </div>
                    <div className="px-4 py-2 rounded-lg border border-primary text-primary text-sm font-medium">
                      Outline
                    </div>
                    <div className="h-2 w-32 rounded-full bg-primary" />
                    <div className="h-2 w-24 rounded-full bg-accent" />
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* Multiplayer Settings */}
            <TabsContent value="multiplayer" className="mt-6">
              <div className="grid gap-6 lg:grid-cols-2">
                {/* Multiplayer Toggle */}
                <div className="rounded-xl bg-[#141414] border border-white/5 p-6 space-y-5">
                  <div>
                    <h3 className="text-sm font-medium text-white flex items-center gap-2">
                      <Users className="h-4 w-4 text-primary" />
                      Modo Multiplayer
                    </h3>
                    <p className="text-xs text-white/40 mt-1">
                      Jogue com ate 4 tecnicos simultaneamente, cada um gerenciando um time diferente
                    </p>
                  </div>

                  <div className="flex items-center justify-between p-4 rounded-lg bg-white/5 border border-white/10">
                    <div>
                      <div className="text-sm text-white">Ativar Multiplayer</div>
                      <div className="text-xs text-white/40">Permite varios jogadores</div>
                    </div>
                    <Switch 
                      checked={multiplayerEnabled} 
                      onCheckedChange={setMultiplayerEnabled} 
                    />
                  </div>

                  {multiplayerEnabled && (
                    <div className="space-y-4">
                      <div className="flex items-center gap-2">
                        <Input
                          value={newManagerName}
                          onChange={(e) => setNewManagerName(e.target.value)}
                          placeholder="Nome do tecnico..."
                          className="flex-1 bg-white/5 border-white/10 text-white placeholder:text-white/30"
                          maxLength={20}
                          onKeyDown={(e) => e.key === "Enter" && handleAddManager()}
                        />
                        <Button
                          onClick={handleAddManager}
                          disabled={!newManagerName.trim() || managers.length >= 4}
                          size="sm"
                          className="bg-primary text-primary-foreground hover:bg-primary/90"
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                      
                      {managers.length === 0 && (
                        <div className="text-center py-8 text-white/30 text-sm">
                          Adicione tecnicos para comecar o modo multiplayer
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Managers List */}
                {multiplayerEnabled && (
                  <div className="rounded-xl bg-[#141414] border border-white/5 p-6 space-y-5">
                    <div>
                      <h3 className="text-sm font-medium text-white flex items-center gap-2">
                        <Gamepad2 className="h-4 w-4 text-accent" />
                        Tecnicos Ativos ({managers.length}/4)
                      </h3>
                      <p className="text-xs text-white/40 mt-1">
                        Cada tecnico usa um controle diferente
                      </p>
                    </div>

                    <div className="space-y-3">
                      {managers.map((manager, index) => {
                        const managerTeam = allTeams.find(t => t.curto === manager.teamShort)
                        
                        return (
                          <div 
                            key={manager.id}
                            className="p-4 rounded-lg bg-white/5 border border-white/10 space-y-3"
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <div 
                                  className="h-8 w-8 rounded-full flex items-center justify-center text-white text-sm font-bold"
                                  style={{ backgroundColor: manager.color }}
                                >
                                  {index + 1}
                                </div>
                                <div>
                                  <div className="text-sm font-medium text-white">{manager.name}</div>
                                  <div className="text-[10px] text-white/40">
                                    Controle {manager.controllerIndex + 1}
                                  </div>
                                </div>
                              </div>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleRemoveManager(manager.id)}
                                className="h-8 w-8 p-0 text-white/40 hover:text-red-400 hover:bg-red-400/10"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                            
                            {/* Team Selection */}
                            <div className="flex items-center gap-2">
                              {managerTeam && (
                                <TeamCrest team={managerTeam} size="sm" />
                              )}
                              <select
                                value={manager.teamShort}
                                onChange={(e) => handleManagerTeamChange(manager.id, e.target.value)}
                                className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white"
                              >
                                {allTeams.slice(0, 40).map(team => (
                                  <option key={team.curto} value={team.curto} className="bg-[#1a1a1a]">
                                    {team.nome}
                                  </option>
                                ))}
                              </select>
                            </div>
                            
                            {/* Color Selection */}
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-white/40">Cor:</span>
                              <div className="flex gap-1">
                                {managerColors.map(color => (
                                  <button
                                    key={color}
                                    onClick={() => handleManagerColorChange(manager.id, color)}
                                    className={cn(
                                      "h-6 w-6 rounded-full transition-all",
                                      manager.color === color 
                                        ? "ring-2 ring-white ring-offset-2 ring-offset-[#141414]" 
                                        : "hover:scale-110"
                                    )}
                                    style={{ backgroundColor: color }}
                                  />
                                ))}
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
            </TabsContent>

            {/* Controller Settings */}
            <TabsContent value="controls" className="mt-6">
              <div className="grid gap-6 lg:grid-cols-3">
                {/* Controller Type */}
                <div className="rounded-xl bg-[#141414] border border-white/5 p-6 space-y-5">
                  <div>
                    <h3 className="text-sm font-medium text-white flex items-center gap-2">
                      <Gamepad2 className="h-4 w-4 text-primary" />
                      Tipo de Controle
                    </h3>
                    <p className="text-xs text-white/40 mt-1">Escolha o estilo de botoes</p>
                  </div>

                  <div className="space-y-2">
                    {(["playstation", "xbox"] as const).map((type) => (
                      <button
                        key={type}
                        onClick={() => setControllerType(type)}
                        className={cn(
                          "w-full flex items-center gap-4 p-4 rounded-lg border transition-all",
                          controllerType === type
                            ? "border-primary bg-primary/10"
                            : "border-white/10 bg-white/5 hover:border-white/20"
                        )}
                      >
                        <div className="flex items-center gap-2">
                          <ControllerButton button="A" controller={type} size="md" showLabel={false} />
                          <ControllerButton button="B" controller={type} size="md" showLabel={false} />
                          <ControllerButton button="X" controller={type} size="md" showLabel={false} />
                          <ControllerButton button="Y" controller={type} size="md" showLabel={false} />
                        </div>
                        <span className="text-sm font-medium text-white capitalize">{type}</span>
                        {controllerType === type && (
                          <Check className="ml-auto h-4 w-4 text-primary" />
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Context Selector */}
                <div className="rounded-xl bg-[#141414] border border-white/5 p-6 space-y-5">
                  <div>
                    <h3 className="text-sm font-medium text-white">Contexto do Jogo</h3>
                    <p className="text-xs text-white/40 mt-1">Veja os controles para cada situacao</p>
                  </div>

                  <div className="space-y-1 max-h-[300px] overflow-y-auto">
                    {(Object.keys(contextLabels) as GameContext[]).map((ctx) => (
                      <button
                        key={ctx}
                        onClick={() => setSelectedContext(ctx)}
                        className={cn(
                          "w-full flex items-center justify-between p-3 rounded-lg text-left transition-all",
                          selectedContext === ctx
                            ? "bg-primary/20 text-white"
                            : "text-white/60 hover:bg-white/5 hover:text-white"
                        )}
                      >
                        <span className="text-xs">{contextLabels[ctx]}</span>
                        <ChevronRight className={cn(
                          "h-4 w-4 transition-transform",
                          selectedContext === ctx && "rotate-90"
                        )} />
                      </button>
                    ))}
                  </div>
                </div>

                {/* Button Mappings */}
                <div className="rounded-xl bg-[#141414] border border-white/5 p-6 space-y-5">
                  <div>
                    <h3 className="text-sm font-medium text-white">
                      Mapeamento: {contextLabels[selectedContext]}
                    </h3>
                    <p className="text-xs text-white/40 mt-1">Acoes dos botoes neste contexto</p>
                  </div>

                  <div className="space-y-2 max-h-[350px] overflow-y-auto">
                    {Object.entries(CONTROL_MAPPINGS[selectedContext] || {}).map(([button, action]) => (
                      <div 
                        key={button}
                        className="flex items-center justify-between p-3 rounded-lg bg-white/5 border border-white/10"
                      >
                        <ControllerButton 
                          button={button as "A" | "B" | "X" | "Y" | "LB" | "RB" | "LT" | "RT"} 
                          controller={controllerType}
                          size="sm"
                          showLabel={false}
                        />
                        <span className="text-xs text-white/70">
                          {ACTION_LABELS[action as GameAction] || action}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Quick Reference */}
              <div className="mt-6 rounded-xl bg-[#141414] border border-white/5 p-6">
                <h3 className="text-sm font-medium text-white mb-4">Referencia Rapida - Partida Ao Vivo</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                  {[
                    { button: "A" as const, label: "Acelerar" },
                    { button: "B" as const, label: "Desacelerar" },
                    { button: "X" as const, label: "Estatisticas" },
                    { button: "Y" as const, label: "Substituir" },
                    { button: "LB" as const, label: "Evento Ant." },
                    { button: "RB" as const, label: "Prox. Evento" },
                    { button: "LT" as const, label: "Ver Tatica" },
                    { button: "RT" as const, label: "Camera" },
                    { button: "MENU" as const, label: "Pausar" },
                    { button: "VIEW" as const, label: "Simular" },
                  ].map(({ button, label }) => (
                    <div key={button} className="flex items-center gap-2 p-2 rounded bg-white/5">
                      <ControllerButton button={button} controller={controllerType} size="sm" showLabel={false} />
                      <span className="text-[10px] text-white/60">{label}</span>
                    </div>
                  ))}
                </div>
              </div>
            </TabsContent>

            {/* Game Settings */}
            <TabsContent value="game" className="mt-6">
              <div className="grid gap-6 lg:grid-cols-2">
                <div className="rounded-xl bg-[#141414] border border-white/5 p-6 space-y-5">
                  <h3 className="text-sm font-medium text-white flex items-center gap-2">
                    <Monitor className="h-4 w-4 text-primary" />
                    Jogabilidade
                  </h3>

                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm text-white">Auto-save</div>
                        <div className="text-xs text-white/40">Salvar automaticamente a cada semana</div>
                      </div>
                      <Switch checked={autoSave} onCheckedChange={setAutoSave} />
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm text-white">Notificacoes</div>
                        <div className="text-xs text-white/40">Receber alertas de eventos importantes</div>
                      </div>
                      <Switch checked={notifications} onCheckedChange={setNotifications} />
                    </div>

                    <div className="space-y-2 pt-2">
                      <div className="text-sm text-white">Velocidade da Partida</div>
                      <div className="flex gap-2">
                        {["lento", "normal", "rapido"].map((speed) => (
                          <button
                            key={speed}
                            onClick={() => setMatchSpeed(speed)}
                            className={cn(
                              "flex-1 py-2 rounded-lg text-xs font-medium transition-all",
                              matchSpeed === speed
                                ? "bg-primary text-primary-foreground"
                                : "bg-white/5 border border-white/10 text-white/70 hover:bg-white/10"
                            )}
                          >
                            {speed.charAt(0).toUpperCase() + speed.slice(1)}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="rounded-xl bg-[#141414] border border-white/5 p-6 space-y-5">
                  <h3 className="text-sm font-medium text-white flex items-center gap-2">
                    <Bell className="h-4 w-4 text-accent" />
                    Notificacoes
                  </h3>

                  <div className="space-y-4">
                    {[
                      { label: "Transferencias", sub: "Alertas de propostas recebidas" },
                      { label: "Lesoes", sub: "Notificar sobre lesoes de jogadores" },
                      { label: "Diretoria", sub: "Mensagens da diretoria" },
                    ].map((item) => (
                      <div key={item.label} className="flex items-center justify-between">
                        <div>
                          <div className="text-sm text-white">{item.label}</div>
                          <div className="text-xs text-white/40">{item.sub}</div>
                        </div>
                        <Switch defaultChecked />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* Audio Settings */}
            <TabsContent value="audio" className="mt-6">
              <div className="rounded-xl bg-[#141414] border border-white/5 p-6 space-y-6 max-w-xl">
                <h3 className="text-sm font-medium text-white flex items-center gap-2">
                  <Volume2 className="h-4 w-4 text-primary" />
                  Configuracoes de Audio
                </h3>

                <div className="space-y-6">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="text-sm text-white">Volume da Musica</div>
                      <span className="text-xs text-white/50 tabular-nums">{musicVolume[0]}%</span>
                    </div>
                    <Slider value={musicVolume} onValueChange={setMusicVolume} max={100} step={1} />
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="text-sm text-white">Efeitos Sonoros</div>
                      <span className="text-xs text-white/50 tabular-nums">{sfxVolume[0]}%</span>
                    </div>
                    <Slider value={sfxVolume} onValueChange={setSfxVolume} max={100} step={1} />
                  </div>

                  <div className="flex items-center justify-between pt-4 border-t border-white/10">
                    <div>
                      <div className="text-sm text-white">Mutar Tudo</div>
                      <div className="text-xs text-white/40">Desativar todos os sons</div>
                    </div>
                    <Switch />
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* Uniform Settings */}
            <TabsContent value="uniform" className="mt-6">
              <div className="grid gap-6 lg:grid-cols-2">
                <div className="rounded-xl bg-[#141414] border border-white/5 p-6 space-y-5">
                  <div>
                    <h3 className="text-sm font-medium text-white flex items-center gap-2">
                      <Shirt className="h-4 w-4 text-primary" />
                      Selecione o Uniforme
                    </h3>
                    <p className="text-xs text-white/40 mt-1">
                      Uniformes do {userTeam.nome}
                    </p>
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    {(["home", "away", "third"] as const).map((type) => (
                      <button
                        key={type}
                        onClick={() => handleUniformSelect(type)}
                        className={cn(
                          "relative p-4 rounded-xl transition-all",
                          selectedUniform === type
                            ? "ring-2 ring-primary bg-primary/10"
                            : "bg-white/5 border border-white/10 hover:border-white/20"
                        )}
                      >
                        <Jersey
                          variant={type}
                          primary={uniforms[type].primary}
                          secondary={uniforms[type].secondary}
                          pattern={uniforms[type].pattern}
                          className="w-full"
                        />
                        <div className="mt-2 text-center">
                          <div className="text-[10px] font-medium text-white/70 tracking-wider">
                            {type === "home" ? "PRINCIPAL" : type === "away" ? "RESERVA" : "TERCEIRO"}
                          </div>
                        </div>
                        {selectedUniform === type && (
                          <div className="absolute top-2 right-2 h-4 w-4 rounded-full bg-primary flex items-center justify-center">
                            <Check className="h-2.5 w-2.5 text-primary-foreground" />
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="rounded-xl bg-[#141414] border border-white/5 p-6 space-y-5">
                  <div>
                    <h3 className="text-sm font-medium text-white flex items-center gap-2">
                      <Palette className="h-4 w-4 text-accent" />
                      Preview do Uniforme
                    </h3>
                    <p className="text-xs text-white/40 mt-1">
                      Este uniforme sera usado nas partidas
                    </p>
                  </div>

                  <div className="flex items-center justify-center p-8 bg-gradient-to-br from-white/5 to-white/[0.02] rounded-xl">
                    <div className="w-40">
                      <Jersey
                        variant={selectedUniform}
                        primary={uniforms[selectedUniform].primary}
                        secondary={uniforms[selectedUniform].secondary}
                        pattern={uniforms[selectedUniform].pattern}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <div className="text-white/40 text-xs">Cor Principal</div>
                      <div className="flex items-center gap-2 mt-1">
                        <div 
                          className="h-5 w-5 rounded border border-white/20"
                          style={{ backgroundColor: uniforms[selectedUniform].primary }}
                        />
                        <span className="font-mono text-xs text-white/60">{uniforms[selectedUniform].primary}</span>
                      </div>
                    </div>
                    <div>
                      <div className="text-white/40 text-xs">Cor Secundaria</div>
                      <div className="flex items-center gap-2 mt-1">
                        <div 
                          className="h-5 w-5 rounded border border-white/20"
                          style={{ backgroundColor: uniforms[selectedUniform].secondary }}
                        />
                        <span className="font-mono text-xs text-white/60">{uniforms[selectedUniform].secondary}</span>
                      </div>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-white/10">
                    <div className="flex items-center gap-2">
                      <TeamCrest team={userTeam} size="sm" />
                      <div>
                        <div className="text-sm font-medium text-white">{userTeam.nome}</div>
                        <div className="text-[10px] text-white/40">Time selecionado</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* Language Settings */}
            <TabsContent value="language" className="mt-6">
              <div className="rounded-xl bg-[#141414] border border-white/5 p-6 space-y-6 max-w-xl">
                <div>
                  <h3 className="text-sm font-medium text-white flex items-center gap-2">
                    <Globe className="h-4 w-4 text-primary" />
                    Idioma do Jogo
                  </h3>
                  <p className="text-xs text-white/40 mt-1">
                    Selecione o idioma para textos e interface do jogo
                  </p>
                </div>

                <div className="space-y-2">
                  {languageOptions.map((lang) => {
                    const isSelected = language === lang.id
                    return (
                      <button
                        key={lang.id}
                        onClick={() => handleLanguageSelect(lang.id)}
                        className={cn(
                          "w-full flex items-center gap-4 p-4 rounded-lg border transition-all text-left",
                          isSelected
                            ? "border-primary bg-primary/10"
                            : "border-white/10 bg-white/5 hover:border-white/20"
                        )}
                      >
                        <span className="text-2xl">{lang.flag}</span>
                        <div className="flex-1">
                          <div className="text-sm font-medium text-white">{lang.label}</div>
                          {lang.id === "pt-BR" && (
                            <div className="text-[10px] text-primary mt-0.5">Padrao</div>
                          )}
                        </div>
                        {isSelected && (
                          <div className="h-5 w-5 rounded-full bg-primary flex items-center justify-center">
                            <Check className="h-3 w-3 text-primary-foreground" />
                          </div>
                        )}
                      </button>
                    )
                  })}
                </div>

                <div className="pt-4 border-t border-white/10 space-y-2">
                  <p className="text-xs text-white/40">
                    Idioma atual: <span className="text-white">{languageOptions.find(l => l.id === language)?.label}</span>
                  </p>
                  <p className="text-xs text-white/40">
                    Clique em Salvar para aplicar as alteracoes.
                  </p>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </main>

        <MusicPlayer />
      </div>
    </ControllerTypeContext.Provider>
  )
}
