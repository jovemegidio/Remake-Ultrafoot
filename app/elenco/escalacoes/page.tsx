"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { motion } from "framer-motion"
import { 
  ChevronLeft,
  Plus,
  Pencil,
  Trash2,
  Copy,
  Star,
  Users,
  Check,
  MoreVertical
} from "lucide-react"
import { GameSidebar } from "@/components/game-sidebar"
import { GameHeader } from "@/components/game-header"
import { TeamCrest } from "@/components/team-crest"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { getTeamByShort, serieATeams } from "@/lib/teams-data"
import { useGameState } from "@/lib/save-system"

// Icone de formacao
function FormationMiniIcon({ formation, className }: { formation: string, className?: string }) {
  const positions: Record<string, { x: number; y: number }[]> = {
    "4-3-3": [
      { x: 50, y: 90 }, // GK
      { x: 20, y: 70 }, { x: 40, y: 72 }, { x: 60, y: 72 }, { x: 80, y: 70 }, // DEF
      { x: 30, y: 45 }, { x: 50, y: 50 }, { x: 70, y: 45 }, // MID
      { x: 25, y: 20 }, { x: 50, y: 15 }, { x: 75, y: 20 }, // ATK
    ],
    "4-4-2": [
      { x: 50, y: 90 },
      { x: 20, y: 70 }, { x: 40, y: 72 }, { x: 60, y: 72 }, { x: 80, y: 70 },
      { x: 20, y: 45 }, { x: 40, y: 48 }, { x: 60, y: 48 }, { x: 80, y: 45 },
      { x: 35, y: 18 }, { x: 65, y: 18 },
    ],
    "3-5-2": [
      { x: 50, y: 90 },
      { x: 30, y: 72 }, { x: 50, y: 75 }, { x: 70, y: 72 },
      { x: 15, y: 50 }, { x: 35, y: 45 }, { x: 50, y: 40 }, { x: 65, y: 45 }, { x: 85, y: 50 },
      { x: 35, y: 18 }, { x: 65, y: 18 },
    ],
  }

  const dots = positions[formation] || positions["4-3-3"]

  return (
    <svg viewBox="0 0 100 100" className={className}>
      <rect x="5" y="5" width="90" height="90" rx="2" fill="none" stroke="currentColor" strokeOpacity="0.2" strokeWidth="1" />
      <line x1="5" y1="50" x2="95" y2="50" stroke="currentColor" strokeOpacity="0.15" strokeWidth="1" />
      <circle cx="50" cy="50" r="8" fill="none" stroke="currentColor" strokeOpacity="0.15" strokeWidth="1" />
      {dots.map((dot, i) => (
        <circle key={i} cx={dot.x} cy={dot.y} r="4" fill="currentColor" fillOpacity="0.8" />
      ))}
    </svg>
  )
}

interface SavedLineup {
  id: string
  name: string
  formation: string
  isDefault: boolean
  lastUsed: string
  players: number
}

const INITIAL_LINEUPS: SavedLineup[] = [
  {
    id: "1",
    name: "Principal",
    formation: "4-3-3",
    isDefault: true,
    lastUsed: "Hoje",
    players: 11,
  },
]

export default function EscalacoesPage() {
  const router = useRouter()
  const { state } = useGameState()
  const userTeam = getTeamByShort(state.selectedTeamShort || "BGT") || serieATeams[0]
  const [lineups, setLineups] = useState<SavedLineup[]>(INITIAL_LINEUPS)
  const [selectedLineup, setSelectedLineup] = useState<string>("1")
  const [hoveredLineup, setHoveredLineup] = useState<string | null>(null)

  const handleCreateNew = () => {
    const newLineup: SavedLineup = {
      id: Date.now().toString(),
      name: `Escalacao ${lineups.length + 1}`,
      formation: "4-3-3",
      isDefault: false,
      lastUsed: "Nunca",
      players: 11,
    }
    setLineups([...lineups, newLineup])
    setSelectedLineup(newLineup.id)
  }

  const handleDelete = (id: string) => {
    if (lineups.length === 1) return
    setLineups(lineups.filter(l => l.id !== id))
    if (selectedLineup === id) {
      setSelectedLineup(lineups[0].id)
    }
  }

  const handleSetDefault = (id: string) => {
    setLineups(lineups.map(l => ({
      ...l,
      isDefault: l.id === id,
    })))
  }

  const handleEdit = (id: string) => {
    router.push(`/elenco/gerenciamento?lineup=${id}`)
  }

  return (
    <div className="flex h-screen bg-[#050508] overflow-hidden">
      <GameSidebar />
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        <GameHeader />
        
        <main className="flex-1 overflow-auto p-6 lg:p-8">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.push("/elenco")}
                className="p-2 rounded-lg bg-white/5 hover:bg-white/10 transition"
              >
                <ChevronLeft className="h-5 w-5 text-white/60" />
              </button>
              <div className="flex items-center gap-3">
                <TeamCrest team={userTeam} size="md" />
                <div>
                  <h1 className="text-2xl font-bold text-white">Escalacoes Salvas</h1>
                  <p className="text-sm text-white/50">{lineups.length} escalacao(oes) criada(s)</p>
                </div>
              </div>
            </div>
            
            <Button
              onClick={handleCreateNew}
              className="bg-gradient-to-r from-cyan-500 to-teal-500 text-white gap-2"
            >
              <Plus className="h-4 w-4" />
              Nova Escalacao
            </Button>
          </div>

          {/* Info card */}
          <div className="bg-gradient-to-r from-cyan-500/10 to-teal-500/10 border border-cyan-500/20 rounded-xl p-4 mb-6">
            <p className="text-sm text-white/70">
              Monte e use diversas escalacoes para aproveitar o elenco ao maximo. 
              Alterne escalacoes para se adaptar aos times adversarios e dar ao elenco inteiro uma chance de entrar em campo.
            </p>
          </div>

          {/* Lineups Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {lineups.map((lineup) => (
              <motion.div
                key={lineup.id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className={cn(
                  "relative cursor-pointer rounded-xl border-2 p-5 transition-all duration-200",
                  "bg-gradient-to-br from-white/5 to-white/[0.02]",
                  selectedLineup === lineup.id 
                    ? "border-cyan-400 ring-2 ring-cyan-400/20" 
                    : hoveredLineup === lineup.id 
                      ? "border-white/30" 
                      : "border-white/10"
                )}
                onMouseEnter={() => setHoveredLineup(lineup.id)}
                onMouseLeave={() => setHoveredLineup(null)}
                onClick={() => setSelectedLineup(lineup.id)}
              >
                {/* Default badge */}
                {lineup.isDefault && (
                  <div className="absolute top-3 right-3 flex items-center gap-1 px-2 py-1 rounded-full bg-amber-500/20 text-amber-400 text-[10px] font-medium">
                    <Star className="h-3 w-3" />
                    Padrao
                  </div>
                )}

                <div className="flex items-start gap-4">
                  {/* Formation visual */}
                  <div className="w-20 h-20 rounded-lg bg-white/5 p-2 flex-shrink-0">
                    <FormationMiniIcon formation={lineup.formation} className="w-full h-full text-white" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-white mb-1 truncate">{lineup.name}</h3>
                    <div className="flex items-center gap-3 text-xs text-white/50 mb-3">
                      <span>{lineup.formation}</span>
                      <span className="text-white/20">·</span>
                      <span className="flex items-center gap-1">
                        <Users className="h-3 w-3" />
                        {lineup.players}
                      </span>
                    </div>
                    <p className="text-[10px] text-white/40">Ultimo uso: {lineup.lastUsed}</p>
                  </div>
                </div>

                {/* Actions */}
                <div className={cn(
                  "flex items-center gap-2 mt-4 pt-4 border-t border-white/5 transition-opacity",
                  hoveredLineup === lineup.id || selectedLineup === lineup.id ? "opacity-100" : "opacity-0"
                )}>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleEdit(lineup.id) }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-xs text-white/70 transition"
                  >
                    <Pencil className="h-3 w-3" />
                    Editar
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleSetDefault(lineup.id) }}
                    className={cn(
                      "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition",
                      lineup.isDefault 
                        ? "bg-amber-500/20 text-amber-400" 
                        : "bg-white/5 hover:bg-white/10 text-white/70"
                    )}
                  >
                    <Star className="h-3 w-3" />
                    {lineup.isDefault ? "Padrao" : "Definir padrao"}
                  </button>
                  {lineups.length > 1 && (
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDelete(lineup.id) }}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-xs text-red-400 transition ml-auto"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  )}
                </div>
              </motion.div>
            ))}

            {/* Add new card */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="relative cursor-pointer rounded-xl border-2 border-dashed border-white/10 p-5 hover:border-cyan-400/50 hover:bg-white/[0.02] transition-all duration-200 flex flex-col items-center justify-center min-h-[180px]"
              onClick={handleCreateNew}
            >
              <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center mb-3">
                <Plus className="h-6 w-6 text-white/40" />
              </div>
              <span className="text-sm text-white/50">Criar nova escalacao</span>
            </motion.div>
          </div>
        </main>
      </div>
    </div>
  )
}
