"use client"

import { useState, useMemo } from "react"
import { useRouter } from "next/navigation"
import { motion } from "framer-motion"
import { 
  ChevronLeft,
  Plus,
  Download,
  Trash2,
  Star,
  AlertCircle,
  Gamepad2
} from "lucide-react"
import { GameSidebar } from "@/components/game-sidebar"
import { GameHeader } from "@/components/game-header"
import { TeamCrest } from "@/components/team-crest"
import { PlayerAvatarCircle } from "@/components/player-avatar"
import { cn } from "@/lib/utils"
import { getTeamByShort, serieATeams } from "@/lib/teams-data"
import { useGameState } from "@/lib/save-system"
import { getPlayersForTeam } from "@/lib/players-data"

// Formacoes predefinidas com coordenadas para campo 100x133
const FORMATIONS: Record<string, { name: string; positions: { pos: string; x: number; y: number }[] }> = {
  "4-3-3": {
    name: "4-3-3",
    positions: [
      { pos: "GOL", x: 50, y: 120 },
      { pos: "LD", x: 85, y: 95 },
      { pos: "ZAG", x: 65, y: 100 },
      { pos: "ZAG", x: 35, y: 100 },
      { pos: "LE", x: 15, y: 95 },
      { pos: "VOL", x: 50, y: 70 },
      { pos: "MEI", x: 75, y: 55 },
      { pos: "MEI", x: 25, y: 55 },
      { pos: "PD", x: 78, y: 25 },
      { pos: "ATA", x: 50, y: 15 },
      { pos: "PE", x: 22, y: 25 },
    ],
  },
  "4-4-2": {
    name: "4-4-2",
    positions: [
      { pos: "GOL", x: 50, y: 120 },
      { pos: "LD", x: 85, y: 95 },
      { pos: "ZAG", x: 65, y: 100 },
      { pos: "ZAG", x: 35, y: 100 },
      { pos: "LE", x: 15, y: 95 },
      { pos: "MD", x: 85, y: 60 },
      { pos: "VOL", x: 60, y: 65 },
      { pos: "VOL", x: 40, y: 65 },
      { pos: "ME", x: 15, y: 60 },
      { pos: "ATA", x: 60, y: 18 },
      { pos: "ATA", x: 40, y: 18 },
    ],
  },
  "4-2-3-1": {
    name: "4-2-3-1",
    positions: [
      { pos: "GOL", x: 50, y: 120 },
      { pos: "LD", x: 85, y: 95 },
      { pos: "ZAG", x: 65, y: 100 },
      { pos: "ZAG", x: 35, y: 100 },
      { pos: "LE", x: 15, y: 95 },
      { pos: "VOL", x: 60, y: 75 },
      { pos: "VOL", x: 40, y: 75 },
      { pos: "PD", x: 80, y: 45 },
      { pos: "MEI", x: 50, y: 40 },
      { pos: "PE", x: 20, y: 45 },
      { pos: "ATA", x: 50, y: 15 },
    ],
  },
  "3-5-2": {
    name: "3-5-2",
    positions: [
      { pos: "GOL", x: 50, y: 120 },
      { pos: "ZAG", x: 75, y: 98 },
      { pos: "ZAG", x: 50, y: 102 },
      { pos: "ZAG", x: 25, y: 98 },
      { pos: "ALD", x: 90, y: 62 },
      { pos: "VOL", x: 65, y: 70 },
      { pos: "MEI", x: 50, y: 52 },
      { pos: "VOL", x: 35, y: 70 },
      { pos: "ALE", x: 10, y: 62 },
      { pos: "ATA", x: 60, y: 18 },
      { pos: "ATA", x: 40, y: 18 },
    ],
  },
}

// Seeded random helper
function seededInt(seed: string, key: string, min: number, max: number): number {
  let hash = 0
  const combined = seed + key
  for (let i = 0; i < combined.length; i++) {
    const char = combined.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash
  }
  return min + Math.abs(hash) % (max - min + 1)
}

interface SavedLineup {
  id: string
  name: string
  formation: string
  style: string
  isDefault: boolean
  hasUnavailable: boolean
  players: {
    id: number
    name: string
    pos: string
    overall: number
  }[]
}

export default function EscalacoesPage() {
  const router = useRouter()
  const { state } = useGameState()
  const userTeam = getTeamByShort(state.selectedTeamShort || "BGT") || serieATeams[0]
  
  // Get team players
  const teamPlayers = useMemo(() => {
    const rawPlayers = getPlayersForTeam(userTeam)
    return rawPlayers.map((p, idx) => ({
      id: idx + 1,
      name: p.nome,
      pos: p.pos,
      overall: p.base,
    }))
  }, [userTeam])

  // Initial lineups
  const [lineups, setLineups] = useState<SavedLineup[]>([
    {
      id: "1",
      name: `Padrao ${userTeam.nome.toUpperCase().slice(0, 4)}...`,
      formation: "4-3-3",
      style: "ABERTO",
      isDefault: true,
      hasUnavailable: false,
      players: teamPlayers.slice(0, 11),
    },
  ])
  
  const [selectedLineupId, setSelectedLineupId] = useState<string>("1")
  const selectedLineup = lineups.find(l => l.id === selectedLineupId) || lineups[0]

  const handleCreateNew = () => {
    const newLineup: SavedLineup = {
      id: Date.now().toString(),
      name: `Escalacao ${lineups.length + 1}`,
      formation: "4-3-3",
      style: "EQUILIBRADO",
      isDefault: false,
      hasUnavailable: false,
      players: teamPlayers.slice(0, 11),
    }
    setLineups([...lineups, newLineup])
    setSelectedLineupId(newLineup.id)
  }

  const handleDelete = (id: string) => {
    if (lineups.length === 1) return
    const newLineups = lineups.filter(l => l.id !== id)
    setLineups(newLineups)
    if (selectedLineupId === id) {
      setSelectedLineupId(newLineups[0].id)
    }
  }

  const handleSetDefault = (id: string) => {
    setLineups(lineups.map(l => ({
      ...l,
      isDefault: l.id === id,
    })))
  }

  // Get formation positions for preview
  const formationPositions = FORMATIONS[selectedLineup?.formation || "4-3-3"]?.positions || FORMATIONS["4-3-3"].positions

  return (
    <div className="flex h-screen md:pl-0 pl-0 pb-20 md:pb-0 bg-[#050508] overflow-hidden">
      <GameSidebar />
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        <GameHeader />
        
        {/* Sub-header */}
        <div className="flex items-center gap-4 px-6 py-3 border-b border-white/[0.06] bg-[#0a0a0d]">
          <button
            onClick={() => router.push("/elenco")}
            className="p-2 rounded-lg bg-white/5 hover:bg-white/10 transition"
          >
            <ChevronLeft className="h-4 w-4 text-white/60" />
          </button>
          <span className="text-white/40 text-sm">Elenco</span>
          <span className="text-white/20">/</span>
          <span className="text-white font-semibold">Escalacoes</span>
          <span className="text-white/20 mx-2">|</span>
          <span className="text-white/60 text-sm">Escalacoes</span>
        </div>
        
        <main className="flex-1 overflow-hidden min-h-0">
          {/* Background gradient - EA FC style */}
          <div 
            className="h-full w-full flex"
            style={{
              background: `linear-gradient(135deg, 
                oklch(0.45 0.12 200) 0%, 
                oklch(0.40 0.10 190) 50%, 
                oklch(0.35 0.08 180) 100%)`
            }}
          >
            {/* Left Column - Actions and Lineup List */}
            <div className="w-[260px] md:w-[340px] lg:w-[420px] flex-shrink-0 p-6 overflow-auto">
              {/* Action Cards */}
              <div className="flex gap-4 mb-6">
                {/* Nova Escalacao */}
                <button
                  onClick={handleCreateNew}
                  className="flex-1 flex flex-col items-center justify-center gap-3 p-6 rounded-xl bg-white/10 hover:bg-white/15 border border-white/20 transition-all group"
                >
                  <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Plus className="h-8 w-8 text-white" />
                  </div>
                  <span className="text-white font-semibold text-sm">Nova escalacao</span>
                </button>

                {/* Importar Escalacao */}
                <button
                  className="flex-1 flex flex-col items-center justify-center gap-3 p-6 rounded-xl bg-white/10 hover:bg-white/15 border border-white/20 transition-all group"
                >
                  <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Download className="h-8 w-8 text-white" />
                  </div>
                  <span className="text-white font-semibold text-sm">Importar escalacao</span>
                </button>
              </div>

              {/* Saved Lineups List */}
              <div className="space-y-3">
                {lineups.map((lineup) => (
                  <motion.div
                    key={lineup.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={cn(
                      "relative cursor-pointer rounded-xl p-4 transition-all",
                      "bg-gradient-to-br from-[#1a3a5c] to-[#0f2540]",
                      "border-2",
                      selectedLineupId === lineup.id 
                        ? "border-cyan-400 shadow-lg shadow-cyan-500/20" 
                        : "border-transparent hover:border-white/30"
                    )}
                    onClick={() => setSelectedLineupId(lineup.id)}
                  >
                    <div className="flex items-start gap-3">
                      {/* Mini Formation Preview */}
                      <div className="w-24 h-20 rounded-lg bg-[#0a1929] border border-white/10 relative overflow-hidden flex-shrink-0">
                        {/* Mini pitch */}
                        <svg viewBox="0 0 100 80" className="absolute inset-0 w-full h-full">
                          <rect x="5" y="5" width="90" height="70" rx="1" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="0.5" />
                          <line x1="5" y1="40" x2="95" y2="40" stroke="rgba(255,255,255,0.15)" strokeWidth="0.5" />
                          <circle cx="50" cy="40" r="8" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="0.5" />
                          {/* Players dots */}
                          {FORMATIONS[lineup.formation]?.positions.map((pos, i) => (
                            <circle 
                              key={i} 
                              cx={pos.x} 
                              cy={(pos.y / 133) * 70 + 5} 
                              r="3" 
                              fill={i === 0 ? "#f59e0b" : "#3b82f6"} 
                            />
                          ))}
                        </svg>
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-bold text-white text-sm truncate">{lineup.name}</h3>
                          <span className="text-xs text-white/60">{lineup.formation}</span>
                        </div>
                        <span className="text-[10px] text-cyan-400 font-medium uppercase tracking-wider">{lineup.style}</span>
                        
                        {/* Unavailable warning */}
                        {lineup.hasUnavailable && (
                          <div className="flex items-center gap-1.5 mt-2 text-red-400">
                            <AlertCircle className="h-3 w-3" />
                            <span className="text-[10px]">Nao disponivel</span>
                          </div>
                        )}
                      </div>

                      {/* Star/Delete actions */}
                      <div className="flex flex-col items-end gap-2">
                        {lineup.isDefault && (
                          <Star className="h-4 w-4 text-amber-400 fill-amber-400" />
                        )}
                        {lineups.length > 1 && (
                          <button
                            onClick={(e) => { e.stopPropagation(); handleDelete(lineup.id) }}
                            className="p-1 rounded hover:bg-white/10 text-white/40 hover:text-red-400 transition"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>

            {/* Right Column - Large Tactical Preview */}
            <div className="flex-1 p-6 flex flex-col">
              {/* Preview Header */}
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-2xl font-black text-white tracking-tight">
                    Padrao {userTeam.nome.toUpperCase()}
                  </h2>
                  <p className="text-sm text-cyan-300 font-medium">
                    {selectedLineup?.formation} {selectedLineup?.style}
                  </p>
                </div>
                <TeamCrest team={userTeam} size="lg" />
              </div>

              {/* Large Tactical Field */}
              <div 
                className="flex-1 rounded-2xl overflow-hidden relative"
                style={{
                  background: `linear-gradient(180deg, 
                    oklch(0.50 0.08 200) 0%, 
                    oklch(0.45 0.06 195) 100%)`
                }}
              >
                {/* Field markings */}
                <svg
                  viewBox="0 0 100 133"
                  className="absolute inset-0 h-full w-full"
                  preserveAspectRatio="xMidYMid meet"
                >
                  <g stroke="rgba(255,255,255,0.3)" strokeWidth="0.4" fill="none">
                    {/* Campo exterior */}
                    <rect x="5" y="5" width="90" height="123" rx="1" />
                    {/* Linha do meio */}
                    <line x1="5" y1="66.5" x2="95" y2="66.5" />
                    {/* Circulo central */}
                    <circle cx="50" cy="66.5" r="12" />
                    <circle cx="50" cy="66.5" r="1" fill="rgba(255,255,255,0.3)" />
                    {/* Area grande - topo */}
                    <rect x="20" y="5" width="60" height="20" />
                    {/* Area pequena - topo */}
                    <rect x="32" y="5" width="36" height="8" />
                    {/* Arco da area - topo */}
                    <path d="M 35 25 Q 50 32 65 25" />
                    {/* Area grande - baixo */}
                    <rect x="20" y="108" width="60" height="20" />
                    {/* Area pequena - baixo */}
                    <rect x="32" y="120" width="36" height="8" />
                    {/* Arco da area - baixo */}
                    <path d="M 35 108 Q 50 101 65 108" />
                  </g>
                </svg>

                {/* Players */}
                <div className="absolute inset-0">
                  {selectedLineup?.players.slice(0, 11).map((player, index) => {
                    const pos = formationPositions[index]
                    if (!pos) return null
                    const isGoalkeeper = index === 0

                    return (
                      <div
                        key={player.id}
                        className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center"
                        style={{
                          left: `${pos.x}%`,
                          top: `${(pos.y / 133) * 100}%`,
                        }}
                      >
                        {/* Jersey icon */}
                        <div className={cn(
                          "relative w-10 h-10 flex items-center justify-center",
                          "transition-transform hover:scale-110"
                        )}>
                          {/* Jersey SVG */}
                          <svg viewBox="0 0 40 40" className="w-full h-full">
                            <path
                              d="M10 8 L5 12 L5 18 L10 18 L10 35 L30 35 L30 18 L35 18 L35 12 L30 8 L25 8 L23 12 L17 12 L15 8 Z"
                              fill={isGoalkeeper ? "#f59e0b" : userTeam.cor1}
                              stroke={isGoalkeeper ? "#d97706" : userTeam.cor2 || "#fff"}
                              strokeWidth="1"
                            />
                          </svg>
                          {/* Overall badge */}
                          <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-white text-[10px] font-bold flex items-center justify-center text-gray-900">
                            {player.overall}
                          </div>
                        </div>
                        {/* Player name */}
                        <span className="mt-1 text-[10px] text-white font-medium text-center whitespace-nowrap drop-shadow-md">
                          {player.name.split(" ").pop()}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          </div>
        </main>

        {/* Bottom Action Bar - EA FC Style */}
        <div className="flex items-center justify-between px-6 py-3 bg-[#0a0a0d] border-t border-white/[0.06]">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded bg-white/20 flex items-center justify-center text-[10px] font-bold text-white">A</div>
              <span className="text-xs text-white/60">Selecionar</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded bg-white/20 flex items-center justify-center text-[10px] font-bold text-white">B</div>
              <span className="text-xs text-white/60">Voltar</span>
            </div>
            <div className="flex items-center gap-2">
              <Gamepad2 className="h-4 w-4 text-white/40" />
              <span className="text-xs text-white/60">Corrigir automaticamente</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <TeamCrest team={userTeam} size="sm" />
          </div>
        </div>
      </div>
    </div>
  )
}
