"use client"

<<<<<<< HEAD
import { useState } from "react"
import {
  Settings,
  Volume2,
  VolumeX,
  Monitor,
  Moon,
  Sun,
=======
import { useState, useEffect } from "react"
import {
  Volume2,
  Monitor,
>>>>>>> bfedf7d (Atualizar estrutura do projeto)
  Globe,
  Gamepad2,
  Bell,
  Save,
  RotateCcw,
  Shirt,
  Palette,
<<<<<<< HEAD
} from "lucide-react"
import { GameSidebar } from "@/components/game-sidebar"
=======
  Check,
} from "lucide-react"
import { GameSidebar } from "@/components/game-sidebar"
import { GameHeader } from "@/components/game-header"
>>>>>>> bfedf7d (Atualizar estrutura do projeto)
import { MusicPlayer } from "@/components/music-player"
import { TeamCrest } from "@/components/team-crest"
import { Jersey } from "@/components/jersey"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Slider } from "@/components/ui/slider"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
<<<<<<< HEAD
import { getTeamByShort, serieATeams, getTeamUniforms } from "@/lib/teams-data"
=======
import { useTheme, themePresets, type ThemeColor } from "@/components/theme-provider"
import { getTeamByShort, serieATeams, getTeamUniforms, allTeams } from "@/lib/teams-data"
import { cn } from "@/lib/utils"
>>>>>>> bfedf7d (Atualizar estrutura do projeto)

const userTeam = getTeamByShort("RBB") || serieATeams[0]
const uniforms = getTeamUniforms(userTeam)

export default function ConfiguracoesPage() {
<<<<<<< HEAD
=======
  const { theme, setTheme, teamColors, setTeamColors } = useTheme()
>>>>>>> bfedf7d (Atualizar estrutura do projeto)
  const [musicVolume, setMusicVolume] = useState([70])
  const [sfxVolume, setSfxVolume] = useState([80])
  const [autoSave, setAutoSave] = useState(true)
  const [notifications, setNotifications] = useState(true)
  const [matchSpeed, setMatchSpeed] = useState("normal")
  const [selectedUniform, setSelectedUniform] = useState<"home" | "away" | "third">("home")

<<<<<<< HEAD
  return (
    <div className="min-h-screen pl-16 pb-20">
      <GameSidebar />

      {/* Top bar */}
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-border bg-background/80 backdrop-blur-xl px-6">
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="font-display tracking-widest text-primary">ULTRAFOOT</span>
          <span className="text-border">/</span>
          <span className="text-foreground">Configuracoes</span>
        </div>
        <div className="flex items-center gap-2">
          <TeamCrest team={userTeam} size="sm" />
          <span className="text-sm font-medium">{userTeam.nome}</span>
        </div>
      </header>
=======
  // Set team colors when "team" theme is selected
  useEffect(() => {
    if (theme === "team" && !teamColors) {
      setTeamColors({ primary: userTeam.cor1, secondary: userTeam.cor2 })
    }
  }, [theme, teamColors, setTeamColors])

  const handleThemeChange = (newTheme: ThemeColor) => {
    if (newTheme === "team") {
      setTeamColors({ primary: userTeam.cor1, secondary: userTeam.cor2 })
    }
    setTheme(newTheme)
  }

  return (
    <div className="min-h-screen pl-[72px] pb-24 bg-[#0a0a0a]">
      <GameSidebar />
      <GameHeader team={userTeam} />
>>>>>>> bfedf7d (Atualizar estrutura do projeto)

      <main className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
<<<<<<< HEAD
            <h1 className="font-display-italic text-3xl tracking-tight">CONFIGURACOES</h1>
            <p className="text-sm text-muted-foreground">Personalize sua experiencia de jogo</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" className="font-display text-xs tracking-wider border-border">
              <RotateCcw className="mr-2 h-4 w-4" />
              RESTAURAR
            </Button>
            <Button className="font-display text-xs tracking-wider">
              <Save className="mr-2 h-4 w-4" />
              SALVAR
=======
            <h1 className="text-2xl font-semibold text-white tracking-tight">Configuracoes</h1>
            <p className="text-sm text-white/50 mt-1">Personalize sua experiencia de jogo</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="text-xs bg-transparent border-white/10 text-white/70 hover:bg-white/5 hover:text-white">
              <RotateCcw className="mr-2 h-3.5 w-3.5" />
              Restaurar
            </Button>
            <Button size="sm" className="text-xs bg-[#1db954] text-black hover:bg-[#1ed760]">
              <Save className="mr-2 h-3.5 w-3.5" />
              Salvar
>>>>>>> bfedf7d (Atualizar estrutura do projeto)
            </Button>
          </div>
        </div>

<<<<<<< HEAD
        <Tabs defaultValue="game" className="w-full">
          <TabsList className="bg-card border border-border">
            <TabsTrigger value="game" className="font-display text-xs tracking-wider">
              <Gamepad2 className="mr-2 h-4 w-4" />
              JOGO
            </TabsTrigger>
            <TabsTrigger value="audio" className="font-display text-xs tracking-wider">
              <Volume2 className="mr-2 h-4 w-4" />
              AUDIO
            </TabsTrigger>
            <TabsTrigger value="uniform" className="font-display text-xs tracking-wider">
              <Shirt className="mr-2 h-4 w-4" />
              UNIFORMES
            </TabsTrigger>
            <TabsTrigger value="display" className="font-display text-xs tracking-wider">
              <Monitor className="mr-2 h-4 w-4" />
              EXIBICAO
            </TabsTrigger>
          </TabsList>

          {/* Game Settings */}
          <TabsContent value="game" className="mt-6">
            <div className="grid gap-6 lg:grid-cols-2">
              <div className="eafc-card p-6 space-y-6">
                <h3 className="font-display tracking-wider text-sm flex items-center gap-2">
                  <Gamepad2 className="h-4 w-4 text-primary" />
                  JOGABILIDADE
=======
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

              {/* Team Colors */}
              <div className="rounded-xl bg-[#141414] border border-white/5 p-6 space-y-5">
                <div>
                  <h3 className="text-sm font-medium text-white flex items-center gap-2">
                    <TeamCrest team={userTeam} size="xs" />
                    Cores do Time
                  </h3>
                  <p className="text-xs text-white/40 mt-1">Use as cores do seu clube na interface</p>
                </div>

                <button
                  onClick={() => handleThemeChange("team")}
                  className={cn(
                    "relative w-full flex items-center gap-4 p-4 rounded-lg border transition-all",
                    theme === "team" 
                      ? "border-primary bg-primary/10" 
                      : "border-white/10 bg-white/5 hover:border-white/20"
                  )}
                >
                  <div className="flex gap-1">
                    <div 
                      className="h-8 w-8 rounded-full border-2 border-white/20"
                      style={{ backgroundColor: userTeam.cor1 }}
                    />
                    <div 
                      className="h-8 w-8 rounded-full border-2 border-white/20 -ml-3"
                      style={{ backgroundColor: userTeam.cor2 }}
                    />
                  </div>
                  <div className="text-left">
                    <div className="text-sm font-medium text-white">{userTeam.nome}</div>
                    <div className="text-xs text-white/40">Usar cores do clube</div>
                  </div>
                  {theme === "team" && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 rounded-full bg-primary flex items-center justify-center">
                      <Check className="h-3 w-3 text-primary-foreground" />
                    </div>
                  )}
                </button>

                <div className="pt-4 border-t border-white/10">
                  <p className="text-xs text-white/40">
                    Selecione um time diferente para usar outras cores:
                  </p>
                  <div className="mt-3 grid grid-cols-5 gap-2 max-h-32 overflow-y-auto pr-2">
                    {allTeams.slice(0, 20).map((team) => (
                      <button
                        key={team.curto}
                        onClick={() => {
                          setTeamColors({ primary: team.cor1, secondary: team.cor2 })
                          setTheme("team")
                        }}
                        className="flex flex-col items-center gap-1 p-2 rounded-lg hover:bg-white/5 transition-colors"
                        title={team.nome}
                      >
                        <TeamCrest team={team} size="sm" />
                        <span className="text-[9px] text-white/40">{team.curto}</span>
                      </button>
                    ))}
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
>>>>>>> bfedf7d (Atualizar estrutura do projeto)
                </h3>

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
<<<<<<< HEAD
                      <div className="font-medium">Auto-save</div>
                      <div className="text-sm text-muted-foreground">Salvar automaticamente a cada semana</div>
=======
                      <div className="text-sm text-white">Auto-save</div>
                      <div className="text-xs text-white/40">Salvar automaticamente a cada semana</div>
>>>>>>> bfedf7d (Atualizar estrutura do projeto)
                    </div>
                    <Switch checked={autoSave} onCheckedChange={setAutoSave} />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
<<<<<<< HEAD
                      <div className="font-medium">Notificacoes</div>
                      <div className="text-sm text-muted-foreground">Receber alertas de eventos importantes</div>
=======
                      <div className="text-sm text-white">Notificacoes</div>
                      <div className="text-xs text-white/40">Receber alertas de eventos importantes</div>
>>>>>>> bfedf7d (Atualizar estrutura do projeto)
                    </div>
                    <Switch checked={notifications} onCheckedChange={setNotifications} />
                  </div>

<<<<<<< HEAD
                  <div className="space-y-2">
                    <div className="font-medium">Velocidade da Partida</div>
=======
                  <div className="space-y-2 pt-2">
                    <div className="text-sm text-white">Velocidade da Partida</div>
>>>>>>> bfedf7d (Atualizar estrutura do projeto)
                    <div className="flex gap-2">
                      {["lento", "normal", "rapido"].map((speed) => (
                        <button
                          key={speed}
                          onClick={() => setMatchSpeed(speed)}
<<<<<<< HEAD
                          className={`flex-1 py-2 rounded-lg font-display text-xs tracking-wider transition-all ${
                            matchSpeed === speed
                              ? "bg-primary text-primary-foreground"
                              : "bg-card border border-border hover:border-primary/50"
                          }`}
                        >
                          {speed.toUpperCase()}
=======
                          className={cn(
                            "flex-1 py-2 rounded-lg text-xs font-medium transition-all",
                            matchSpeed === speed
                              ? "bg-primary text-primary-foreground"
                              : "bg-white/5 border border-white/10 text-white/70 hover:bg-white/10"
                          )}
                        >
                          {speed.charAt(0).toUpperCase() + speed.slice(1)}
>>>>>>> bfedf7d (Atualizar estrutura do projeto)
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

<<<<<<< HEAD
              <div className="eafc-card p-6 space-y-6">
                <h3 className="font-display tracking-wider text-sm flex items-center gap-2">
                  <Bell className="h-4 w-4 text-accent" />
                  NOTIFICACOES
                </h3>

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium">Transferencias</div>
                      <div className="text-sm text-muted-foreground">Alertas de propostas recebidas</div>
                    </div>
                    <Switch defaultChecked />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium">Lesoes</div>
                      <div className="text-sm text-muted-foreground">Notificar sobre lesoes de jogadores</div>
                    </div>
                    <Switch defaultChecked />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium">Diretoria</div>
                      <div className="text-sm text-muted-foreground">Mensagens da diretoria</div>
                    </div>
                    <Switch defaultChecked />
                  </div>
=======
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
>>>>>>> bfedf7d (Atualizar estrutura do projeto)
                </div>
              </div>
            </div>
          </TabsContent>

          {/* Audio Settings */}
          <TabsContent value="audio" className="mt-6">
<<<<<<< HEAD
            <div className="eafc-card p-6 space-y-6 max-w-xl">
              <h3 className="font-display tracking-wider text-sm flex items-center gap-2">
                <Volume2 className="h-4 w-4 text-primary" />
                CONFIGURACOES DE AUDIO
=======
            <div className="rounded-xl bg-[#141414] border border-white/5 p-6 space-y-6 max-w-xl">
              <h3 className="text-sm font-medium text-white flex items-center gap-2">
                <Volume2 className="h-4 w-4 text-primary" />
                Configuracoes de Audio
>>>>>>> bfedf7d (Atualizar estrutura do projeto)
              </h3>

              <div className="space-y-6">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
<<<<<<< HEAD
                    <div className="font-medium">Volume da Musica</div>
                    <span className="text-sm text-muted-foreground tabular-nums">{musicVolume[0]}%</span>
                  </div>
                  <Slider
                    value={musicVolume}
                    onValueChange={setMusicVolume}
                    max={100}
                    step={1}
                    className="w-full"
                  />
=======
                    <div className="text-sm text-white">Volume da Musica</div>
                    <span className="text-xs text-white/50 tabular-nums">{musicVolume[0]}%</span>
                  </div>
                  <Slider value={musicVolume} onValueChange={setMusicVolume} max={100} step={1} />
>>>>>>> bfedf7d (Atualizar estrutura do projeto)
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
<<<<<<< HEAD
                    <div className="font-medium">Efeitos Sonoros</div>
                    <span className="text-sm text-muted-foreground tabular-nums">{sfxVolume[0]}%</span>
                  </div>
                  <Slider
                    value={sfxVolume}
                    onValueChange={setSfxVolume}
                    max={100}
                    step={1}
                    className="w-full"
                  />
                </div>

                <div className="flex items-center justify-between pt-4 border-t border-border">
                  <div>
                    <div className="font-medium">Mutar Tudo</div>
                    <div className="text-sm text-muted-foreground">Desativar todos os sons</div>
=======
                    <div className="text-sm text-white">Efeitos Sonoros</div>
                    <span className="text-xs text-white/50 tabular-nums">{sfxVolume[0]}%</span>
                  </div>
                  <Slider value={sfxVolume} onValueChange={setSfxVolume} max={100} step={1} />
                </div>

                <div className="flex items-center justify-between pt-4 border-t border-white/10">
                  <div>
                    <div className="text-sm text-white">Mutar Tudo</div>
                    <div className="text-xs text-white/40">Desativar todos os sons</div>
>>>>>>> bfedf7d (Atualizar estrutura do projeto)
                  </div>
                  <Switch />
                </div>
              </div>
            </div>
          </TabsContent>

          {/* Uniform Settings */}
          <TabsContent value="uniform" className="mt-6">
            <div className="grid gap-6 lg:grid-cols-2">
<<<<<<< HEAD
              <div className="eafc-card p-6 space-y-6">
                <h3 className="font-display tracking-wider text-sm flex items-center gap-2">
                  <Shirt className="h-4 w-4 text-primary" />
                  SELECIONE O UNIFORME
=======
              <div className="rounded-xl bg-[#141414] border border-white/5 p-6 space-y-5">
                <h3 className="text-sm font-medium text-white flex items-center gap-2">
                  <Shirt className="h-4 w-4 text-primary" />
                  Selecione o Uniforme
>>>>>>> bfedf7d (Atualizar estrutura do projeto)
                </h3>

                <div className="grid grid-cols-3 gap-4">
                  {(["home", "away", "third"] as const).map((type) => (
                    <button
                      key={type}
                      onClick={() => setSelectedUniform(type)}
<<<<<<< HEAD
                      className={`relative p-4 rounded-xl transition-all ${
                        selectedUniform === type
                          ? "ring-2 ring-primary bg-primary/10"
                          : "bg-card border border-border hover:border-primary/50"
                      }`}
=======
                      className={cn(
                        "relative p-4 rounded-xl transition-all",
                        selectedUniform === type
                          ? "ring-2 ring-primary bg-primary/10"
                          : "bg-white/5 border border-white/10 hover:border-white/20"
                      )}
>>>>>>> bfedf7d (Atualizar estrutura do projeto)
                    >
                      <Jersey
                        variant={type}
                        primary={uniforms[type].primary}
                        secondary={uniforms[type].secondary}
                        pattern={uniforms[type].pattern}
                        className="w-full"
                      />
                      <div className="mt-2 text-center">
<<<<<<< HEAD
                        <div className="text-xs font-display tracking-wider">
=======
                        <div className="text-[10px] font-medium text-white/70 tracking-wider">
>>>>>>> bfedf7d (Atualizar estrutura do projeto)
                          {type === "home" ? "PRINCIPAL" : type === "away" ? "RESERVA" : "TERCEIRO"}
                        </div>
                      </div>
                      {selectedUniform === type && (
<<<<<<< HEAD
                        <div className="absolute top-2 right-2 h-3 w-3 rounded-full bg-primary" />
=======
                        <div className="absolute top-2 right-2 h-4 w-4 rounded-full bg-primary flex items-center justify-center">
                          <Check className="h-2.5 w-2.5 text-primary-foreground" />
                        </div>
>>>>>>> bfedf7d (Atualizar estrutura do projeto)
                      )}
                    </button>
                  ))}
                </div>
<<<<<<< HEAD

                <div className="pt-4 border-t border-border">
                  <div className="text-sm text-muted-foreground">
                    O uniforme selecionado sera usado nas partidas em casa. O uniforme reserva sera usado automaticamente em caso de conflito de cores.
                  </div>
                </div>
              </div>

              <div className="eafc-card p-6 space-y-6">
                <h3 className="font-display tracking-wider text-sm flex items-center gap-2">
                  <Palette className="h-4 w-4 text-accent" />
                  PREVIEW DO UNIFORME
                </h3>

                <div className="flex items-center justify-center p-8 bg-gradient-to-br from-card to-muted rounded-xl">
                  <div className="w-48">
=======
              </div>

              <div className="rounded-xl bg-[#141414] border border-white/5 p-6 space-y-5">
                <h3 className="text-sm font-medium text-white flex items-center gap-2">
                  <Palette className="h-4 w-4 text-accent" />
                  Preview do Uniforme
                </h3>

                <div className="flex items-center justify-center p-8 bg-gradient-to-br from-white/5 to-white/[0.02] rounded-xl">
                  <div className="w-40">
>>>>>>> bfedf7d (Atualizar estrutura do projeto)
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
<<<<<<< HEAD
                    <div className="text-muted-foreground">Cor Principal</div>
                    <div className="flex items-center gap-2 mt-1">
                      <div 
                        className="h-6 w-6 rounded border border-border"
                        style={{ backgroundColor: uniforms[selectedUniform].primary }}
                      />
                      <span className="font-mono text-xs">{uniforms[selectedUniform].primary}</span>
                    </div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Cor Secundaria</div>
                    <div className="flex items-center gap-2 mt-1">
                      <div 
                        className="h-6 w-6 rounded border border-border"
                        style={{ backgroundColor: uniforms[selectedUniform].secondary }}
                      />
                      <span className="font-mono text-xs">{uniforms[selectedUniform].secondary}</span>
=======
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
>>>>>>> bfedf7d (Atualizar estrutura do projeto)
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>
<<<<<<< HEAD

          {/* Display Settings */}
          <TabsContent value="display" className="mt-6">
            <div className="eafc-card p-6 space-y-6 max-w-xl">
              <h3 className="font-display tracking-wider text-sm flex items-center gap-2">
                <Monitor className="h-4 w-4 text-primary" />
                CONFIGURACOES DE EXIBICAO
              </h3>

              <div className="space-y-4">
                <div>
                  <div className="font-medium mb-3">Tema</div>
                  <div className="flex gap-2">
                    <button className="flex-1 py-3 rounded-lg bg-primary text-primary-foreground font-display text-xs tracking-wider flex items-center justify-center gap-2">
                      <Moon className="h-4 w-4" />
                      ESCURO
                    </button>
                    <button className="flex-1 py-3 rounded-lg bg-card border border-border font-display text-xs tracking-wider flex items-center justify-center gap-2 opacity-50">
                      <Sun className="h-4 w-4" />
                      CLARO
                    </button>
                  </div>
                </div>

                <div>
                  <div className="font-medium mb-3">Idioma</div>
                  <div className="flex gap-2">
                    <button className="flex-1 py-3 rounded-lg bg-primary text-primary-foreground font-display text-xs tracking-wider flex items-center justify-center gap-2">
                      <Globe className="h-4 w-4" />
                      PORTUGUES
                    </button>
                    <button className="flex-1 py-3 rounded-lg bg-card border border-border font-display text-xs tracking-wider flex items-center justify-center gap-2">
                      <Globe className="h-4 w-4" />
                      ENGLISH
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-4 border-t border-border">
                  <div>
                    <div className="font-medium">Animacoes</div>
                    <div className="text-sm text-muted-foreground">Efeitos visuais e transicoes</div>
                  </div>
                  <Switch defaultChecked />
                </div>
              </div>
            </div>
          </TabsContent>
=======
>>>>>>> bfedf7d (Atualizar estrutura do projeto)
        </Tabs>
      </main>

      <MusicPlayer />
    </div>
  )
}
