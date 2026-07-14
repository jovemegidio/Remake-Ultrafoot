"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { motion } from "framer-motion"
import { 
  ChevronLeft,
  Scale,
  Shield,
  Swords,
  Target,
  Zap,
  TrendingUp,
  Users,
  Clock,
  Check
} from "lucide-react"
import { GameHeader } from "@/components/game-header"
import { TeamCrest } from "@/components/team-crest"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { getTeamByShort, serieATeams } from "@/lib/teams-data"
import { useGameState } from "@/lib/save-system"
import { useGameEngine, type TeamMentality } from "@/lib/game-engine"
import { hardNavigate } from "@/lib/hard-navigation"

const TACTICAL_PRESETS = [
  {
    id: "balanced",
    name: "Equilibrado",
    description: "Abordagem balanceada entre ataque e defesa",
    icon: Scale,
    stats: { attack: 50, defense: 50, possession: 50 },
    color: "from-blue-500/20 to-blue-600/10",
    borderColor: "border-blue-500/30",
  },
  {
    id: "defensive",
    name: "Defensivo",
    description: "Priorizacao da solidez defensiva",
    icon: Shield,
    stats: { attack: 30, defense: 80, possession: 40 },
    color: "from-amber-500/20 to-amber-600/10",
    borderColor: "border-amber-500/30",
  },
  {
    id: "attacking",
    name: "Ofensivo",
    description: "Foco total em criar chances de gol",
    icon: Swords,
    stats: { attack: 80, defense: 30, possession: 60 },
    color: "from-red-500/20 to-red-600/10",
    borderColor: "border-red-500/30",
  },
  {
    id: "possession",
    name: "Posse de Bola",
    description: "Controle do jogo atraves da posse",
    icon: Target,
    stats: { attack: 50, defense: 50, possession: 85 },
    color: "from-green-500/20 to-green-600/10",
    borderColor: "border-green-500/30",
  },
  {
    id: "counter",
    name: "Contra-Ataque",
    description: "Transicoes rapidas e letais",
    icon: Zap,
    stats: { attack: 70, defense: 60, possession: 30 },
    color: "from-purple-500/20 to-purple-600/10",
    borderColor: "border-purple-500/30",
  },
  {
    id: "pressing",
    name: "Pressao Alta",
    description: "Marcacao intensa no campo adversario",
    icon: TrendingUp,
    stats: { attack: 65, defense: 55, possession: 55 },
    color: "from-cyan-500/20 to-cyan-600/10",
    borderColor: "border-cyan-500/30",
  },
]

export default function TaticasPage() {
  const router = useRouter()
  const { state } = useGameState()
  const userTeam = getTeamByShort(state.selectedTeamShort || "BGT") || serieATeams[0]
  const setTeamTactics = useGameEngine((st) => st.setTeamTactics)
  const [selectedPreset, setSelectedPreset] = useState("balanced")
  const [hoveredPreset, setHoveredPreset] = useState<string | null>(null)

  // Mapeia cada preset para a mentalidade do motor de partida.
  const PRESET_TO_MENTALITY: Record<string, TeamMentality> = {
    balanced: "equilibrado",
    defensive: "defensivo",
    attacking: "ofensivo",
    possession: "equilibrado",
    counter: "defensivo",
    pressing: "ofensivo",
  }

  const [applied, setApplied] = useState(false)

  const handleApply = () => {
    // BUG: antes isto so tinha um comentario "// Aqui salvaria a tatica" e um
    // router.push — nunca salvava nada, e no Tauri o router client-side nem navegava.
    // Dai "nao consigo aplicar tatica". Agora persiste a escolha no motor e volta via
    // hardNavigate (funciona no export estatico).
    setTeamTactics({ mentality: PRESET_TO_MENTALITY[selectedPreset] ?? "equilibrado" })
    setApplied(true)
    setTimeout(() => hardNavigate("/elenco"), 350)  // deixa o feedback aparecer
  }

  return (
    <div className="flex h-screen md:pl-0 pl-0 pb-20 md:pb-0 bg-[#050508] overflow-hidden">
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        <GameHeader />
        
        <main className="flex-1 overflow-y-auto overflow-x-hidden min-h-0 p-6 lg:p-8">
          {/* Header */}
          <div className="flex items-center gap-4 mb-8">
            <button
              onClick={() => router.push("/elenco")}
              className="p-2 rounded-lg bg-white/5 hover:bg-white/10 transition"
            >
              <ChevronLeft className="h-5 w-5 text-white/60" />
            </button>
            <div className="flex items-center gap-3">
              <TeamCrest team={userTeam} size="md" />
              <div>
                <h1 className="text-2xl font-bold text-white">Visao Tatica</h1>
                <p className="text-sm text-white/50">Selecione o estilo de jogo do time</p>
              </div>
            </div>
          </div>

          {/* Tactical Presets Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8 min-w-0">
            {TACTICAL_PRESETS.map((preset) => (
              <motion.div
                key={preset.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={cn(
                  "relative cursor-pointer rounded-xl border-2 p-5 transition-all duration-200",
                  "bg-gradient-to-br",
                  preset.color,
                  selectedPreset === preset.id 
                    ? "border-cyan-400 ring-2 ring-cyan-400/20" 
                    : hoveredPreset === preset.id 
                      ? "border-white/30" 
                      : preset.borderColor
                )}
                onMouseEnter={() => setHoveredPreset(preset.id)}
                onMouseLeave={() => setHoveredPreset(null)}
                onClick={() => setSelectedPreset(preset.id)}
              >
                {/* Selected indicator */}
                {selectedPreset === preset.id && (
                  <div className="absolute top-3 right-3 w-6 h-6 rounded-full bg-cyan-400 flex items-center justify-center">
                    <Check className="h-4 w-4 text-black" />
                  </div>
                )}

                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center">
                    <preset.icon className="h-6 w-6 text-white" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-bold text-white mb-1">{preset.name}</h3>
                    <p className="text-xs text-white/50 mb-3">{preset.description}</p>
                    
                    {/* Stats bars */}
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-white/40 w-14">Ataque</span>
                        <div className="flex-1 h-1.5 rounded-full bg-white/10 overflow-hidden">
                          <div 
                            className="h-full bg-red-400 transition-all duration-300"
                            style={{ width: `${preset.stats.attack}%` }}
                          />
                        </div>
                        <span className="text-[10px] text-white/60 w-6">{preset.stats.attack}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-white/40 w-14">Defesa</span>
                        <div className="flex-1 h-1.5 rounded-full bg-white/10 overflow-hidden">
                          <div 
                            className="h-full bg-blue-400 transition-all duration-300"
                            style={{ width: `${preset.stats.defense}%` }}
                          />
                        </div>
                        <span className="text-[10px] text-white/60 w-6">{preset.stats.defense}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-white/40 w-14">Posse</span>
                        <div className="flex-1 h-1.5 rounded-full bg-white/10 overflow-hidden">
                          <div 
                            className="h-full bg-green-400 transition-all duration-300"
                            style={{ width: `${preset.stats.possession}%` }}
                          />
                        </div>
                        <span className="text-[10px] text-white/60 w-6">{preset.stats.possession}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>

          {/* Action buttons */}
          <div className="flex items-center justify-end gap-3">
            <Button
              variant="outline"
              onClick={() => hardNavigate("/elenco")}
              className="bg-white/5 border-white/10 text-white hover:bg-white/10"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleApply}
              disabled={applied}
              className="bg-gradient-to-r from-cyan-500 to-teal-500 text-white"
            >
              {applied ? "Tatica Aplicada!" : "Aplicar Tatica"}
            </Button>
          </div>
        </main>
      </div>
    </div>
  )
}
