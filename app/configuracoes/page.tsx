"use client"

import { useState } from "react"
import {
  Settings,
  Volume2,
  VolumeX,
  Monitor,
  Moon,
  Sun,
  Globe,
  Gamepad2,
  Bell,
  Save,
  RotateCcw,
  Shirt,
  Palette,
} from "lucide-react"
import { GameSidebar } from "@/components/game-sidebar"
import { MusicPlayer } from "@/components/music-player"
import { TeamCrest } from "@/components/team-crest"
import { Jersey } from "@/components/jersey"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Slider } from "@/components/ui/slider"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { getTeamByShort, serieATeams, getTeamUniforms } from "@/lib/teams-data"

const userTeam = getTeamByShort("RBB") || serieATeams[0]
const uniforms = getTeamUniforms(userTeam)

export default function ConfiguracoesPage() {
  const [musicVolume, setMusicVolume] = useState([70])
  const [sfxVolume, setSfxVolume] = useState([80])
  const [autoSave, setAutoSave] = useState(true)
  const [notifications, setNotifications] = useState(true)
  const [matchSpeed, setMatchSpeed] = useState("normal")
  const [selectedUniform, setSelectedUniform] = useState<"home" | "away" | "third">("home")

  return (
    <div className="min-h-screen pl-[72px] pb-24">
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

      <main className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
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
            </Button>
          </div>
        </div>

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
                </h3>

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium">Auto-save</div>
                      <div className="text-sm text-muted-foreground">Salvar automaticamente a cada semana</div>
                    </div>
                    <Switch checked={autoSave} onCheckedChange={setAutoSave} />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium">Notificacoes</div>
                      <div className="text-sm text-muted-foreground">Receber alertas de eventos importantes</div>
                    </div>
                    <Switch checked={notifications} onCheckedChange={setNotifications} />
                  </div>

                  <div className="space-y-2">
                    <div className="font-medium">Velocidade da Partida</div>
                    <div className="flex gap-2">
                      {["lento", "normal", "rapido"].map((speed) => (
                        <button
                          key={speed}
                          onClick={() => setMatchSpeed(speed)}
                          className={`flex-1 py-2 rounded-lg font-display text-xs tracking-wider transition-all ${
                            matchSpeed === speed
                              ? "bg-primary text-primary-foreground"
                              : "bg-card border border-border hover:border-primary/50"
                          }`}
                        >
                          {speed.toUpperCase()}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

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
                </div>
              </div>
            </div>
          </TabsContent>

          {/* Audio Settings */}
          <TabsContent value="audio" className="mt-6">
            <div className="eafc-card p-6 space-y-6 max-w-xl">
              <h3 className="font-display tracking-wider text-sm flex items-center gap-2">
                <Volume2 className="h-4 w-4 text-primary" />
                CONFIGURACOES DE AUDIO
              </h3>

              <div className="space-y-6">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
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
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
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
                  </div>
                  <Switch />
                </div>
              </div>
            </div>
          </TabsContent>

          {/* Uniform Settings */}
          <TabsContent value="uniform" className="mt-6">
            <div className="grid gap-6 lg:grid-cols-2">
              <div className="eafc-card p-6 space-y-6">
                <h3 className="font-display tracking-wider text-sm flex items-center gap-2">
                  <Shirt className="h-4 w-4 text-primary" />
                  SELECIONE O UNIFORME
                </h3>

                <div className="grid grid-cols-3 gap-4">
                  {(["home", "away", "third"] as const).map((type) => (
                    <button
                      key={type}
                      onClick={() => setSelectedUniform(type)}
                      className={`relative p-4 rounded-xl transition-all ${
                        selectedUniform === type
                          ? "ring-2 ring-primary bg-primary/10"
                          : "bg-card border border-border hover:border-primary/50"
                      }`}
                    >
                      <Jersey
                        variant={type}
                        primary={uniforms[type].primary}
                        secondary={uniforms[type].secondary}
                        pattern={uniforms[type].pattern}
                        className="w-full"
                      />
                      <div className="mt-2 text-center">
                        <div className="text-xs font-display tracking-wider">
                          {type === "home" ? "PRINCIPAL" : type === "away" ? "RESERVA" : "TERCEIRO"}
                        </div>
                      </div>
                      {selectedUniform === type && (
                        <div className="absolute top-2 right-2 h-3 w-3 rounded-full bg-primary" />
                      )}
                    </button>
                  ))}
                </div>

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
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>

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
        </Tabs>
      </main>

      <MusicPlayer />
    </div>
  )
}
