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
import { useTheme, themePresets, type ThemeColor } from "@/components/theme-provider"
import { getTeamUniforms } from "@/lib/teams-data"
import { useGameState, useUserTeam } from "@/lib/save-system"
import { cn } from "@/lib/utils"

const languageOptions = [
  { id: "pt-BR", label: "Portugues (Brasil)", flag: "🇧🇷" },
  { id: "en-US", label: "English (US)", flag: "🇺🇸" },
  { id: "es-ES", label: "Espanol", flag: "🇪🇸" },
]

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

  // Sync selectedUniform with state when it loads
  useEffect(() => {
    if (state.selectedUniform) {
      setSelectedUniform(state.selectedUniform)
    }
    if (state.language) {
      setLanguage(state.language)
    }
  }, [state.selectedUniform, state.language])

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

  const handleSaveSettings = async () => {
    setSaving(true)
    // Save to game state
    await new Promise(resolve => setTimeout(resolve, 500))
    setState({
      selectedUniform,
      language,
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
  }

  return (
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
          <TabsList className="bg-[#1a1a1a] border border-white/10 p-1 h-auto">
            <TabsTrigger value="theme" className="text-xs data-[state=active]:bg-white/10 data-[state=active]:text-white text-white/50 px-4 py-2">
              <Palette className="mr-2 h-3.5 w-3.5" />
              Tema
            </TabsTrigger>
            <TabsTrigger value="game" className="text-xs data-[state=active]:bg-white/10 data-[state=active]:text-white text-white/50 px-4 py-2">
              <Gamepad2 className="mr-2 h-3.5 w-3.5" />
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

          {/* Game Settings */}
          <TabsContent value="game" className="mt-6">
            <div className="grid gap-6 lg:grid-cols-2">
              <div className="rounded-xl bg-[#141414] border border-white/5 p-6 space-y-5">
                <h3 className="text-sm font-medium text-white flex items-center gap-2">
                  <Gamepad2 className="h-4 w-4 text-primary" />
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
  )
}
