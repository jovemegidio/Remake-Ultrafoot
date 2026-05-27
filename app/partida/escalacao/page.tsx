"use client"

import { useState, useMemo, useCallback, useRef, useEffect } from "react"
import { useRouter } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import { 
  ChevronLeft, 
  ChevronRight,
  Shield,
  Target,
  TrendingUp,
  Zap,
  RotateCcw,
  Check,
  ArrowLeftRight
} from "lucide-react"
import { GameSidebar } from "@/components/game-sidebar"
import { GameHeader } from "@/components/game-header"
import { TeamCrest } from "@/components/team-crest"
import { PlayerAvatarCircle } from "@/components/player-avatar"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { getTeamByShort, serieATeams } from "@/lib/teams-data"
import { useGameState } from "@/lib/save-system"
import { getPlayersForTeam } from "@/lib/players-data"

// Formacoes predefinidas - EA FC style (coordenadas para campo 100x133)
const FORMATIONS: Record<string, { name: string; positions: { pos: string; x: number; y: number }[] }> = {
  "4-3-3": {
    name: "4-3-3",
    positions: [
      { pos: "GOL", x: 50, y: 92 },
      { pos: "LD", x: 85, y: 75 },
      { pos: "ZAG", x: 65, y: 80 },
      { pos: "ZAG", x: 35, y: 80 },
      { pos: "LE", x: 15, y: 75 },
      { pos: "VOL", x: 50, y: 55 },
      { pos: "MEI", x: 75, y: 42 },
      { pos: "MEI", x: 25, y: 42 },
      { pos: "PD", x: 80, y: 22 },
      { pos: "ATA", x: 50, y: 12 },
      { pos: "PE", x: 20, y: 22 },
    ],
  },
  "4-4-2": {
    name: "4-4-2",
    positions: [
      { pos: "GOL", x: 50, y: 92 },
      { pos: "LD", x: 85, y: 75 },
      { pos: "ZAG", x: 65, y: 80 },
      { pos: "ZAG", x: 35, y: 80 },
      { pos: "LE", x: 15, y: 75 },
      { pos: "MD", x: 85, y: 48 },
      { pos: "VOL", x: 60, y: 52 },
      { pos: "VOL", x: 40, y: 52 },
      { pos: "ME", x: 15, y: 48 },
      { pos: "ATA", x: 62, y: 15 },
      { pos: "ATA", x: 38, y: 15 },
    ],
  },
  "4-2-3-1": {
    name: "4-2-3-1",
    positions: [
      { pos: "GOL", x: 50, y: 92 },
      { pos: "LD", x: 85, y: 75 },
      { pos: "ZAG", x: 65, y: 80 },
      { pos: "ZAG", x: 35, y: 80 },
      { pos: "LE", x: 15, y: 75 },
      { pos: "VOL", x: 60, y: 58 },
      { pos: "VOL", x: 40, y: 58 },
      { pos: "PD", x: 82, y: 35 },
      { pos: "MEI", x: 50, y: 32 },
      { pos: "PE", x: 18, y: 35 },
      { pos: "ATA", x: 50, y: 12 },
    ],
  },
  "3-5-2": {
    name: "3-5-2",
    positions: [
      { pos: "GOL", x: 50, y: 92 },
      { pos: "ZAG", x: 75, y: 78 },
      { pos: "ZAG", x: 50, y: 82 },
      { pos: "ZAG", x: 25, y: 78 },
      { pos: "ALD", x: 90, y: 50 },
      { pos: "VOL", x: 65, y: 55 },
      { pos: "MEI", x: 50, y: 42 },
      { pos: "VOL", x: 35, y: 55 },
      { pos: "ALE", x: 10, y: 50 },
      { pos: "ATA", x: 62, y: 15 },
      { pos: "ATA", x: 38, y: 15 },
    ],
  },
  "5-3-2": {
    name: "5-3-2",
    positions: [
      { pos: "GOL", x: 50, y: 92 },
      { pos: "ALD", x: 90, y: 65 },
      { pos: "ZAG", x: 70, y: 78 },
      { pos: "ZAG", x: 50, y: 82 },
      { pos: "ZAG", x: 30, y: 78 },
      { pos: "ALE", x: 10, y: 65 },
      { pos: "MEI", x: 70, y: 45 },
      { pos: "VOL", x: 50, y: 50 },
      { pos: "MEI", x: 30, y: 45 },
      { pos: "ATA", x: 62, y: 15 },
      { pos: "ATA", x: 38, y: 15 },
    ],
  },
}

const positionColors: Record<string, { bg: string; text: string; border: string }> = {
  GOL: { bg: "bg-amber-500/30", text: "text-amber-400", border: "border-amber-500/50" },
  LD: { bg: "bg-blue-500/30", text: "text-blue-400", border: "border-blue-500/50" },
  ZAG: { bg: "bg-blue-500/30", text: "text-blue-400", border: "border-blue-500/50" },
  LE: { bg: "bg-blue-500/30", text: "text-blue-400", border: "border-blue-500/50" },
  ALD: { bg: "bg-blue-500/30", text: "text-blue-400", border: "border-blue-500/50" },
  ALE: { bg: "bg-blue-500/30", text: "text-blue-400", border: "border-blue-500/50" },
  VOL: { bg: "bg-green-500/30", text: "text-green-400", border: "border-green-500/50" },
  MEI: { bg: "bg-green-500/30", text: "text-green-400", border: "border-green-500/50" },
  MC: { bg: "bg-green-500/30", text: "text-green-400", border: "border-green-500/50" },
  MD: { bg: "bg-green-500/30", text: "text-green-400", border: "border-green-500/50" },
  ME: { bg: "bg-green-500/30", text: "text-green-400", border: "border-green-500/50" },
  PD: { bg: "bg-red-500/30", text: "text-red-400", border: "border-red-500/50" },
  PE: { bg: "bg-red-500/30", text: "text-red-400", border: "border-red-500/50" },
  ATA: { bg: "bg-red-500/30", text: "text-red-400", border: "border-red-500/50" },
  SA: { bg: "bg-red-500/30", text: "text-red-400", border: "border-red-500/50" },
}

const getOverallColor = (overall: number) => {
  if (overall >= 85) return "text-[#00ffc8]"
  if (overall >= 80) return "text-emerald-400"
  if (overall >= 75) return "text-lime-400"
  if (overall >= 70) return "text-yellow-400"
  if (overall >= 65) return "text-orange-400"
  return "text-red-400"
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

type Player = {
  id: number
  name: string
  position: string
  age: number
  overall: number
  potential: number
  energy?: number
  rhythm?: number
  x?: number
  y?: number
  formationPos?: string
}

export default function PartidaEscalacaoPage() {
  const router = useRouter()
  const { state } = useGameState()
  const userTeam = getTeamByShort(state.selectedTeamShort || "BGT") || serieATeams[0]
  const pitchRef = useRef<HTMLDivElement>(null)

  // State
  const [formation, setFormation] = useState("4-3-3")
  const [activeTab, setActiveTab] = useState<"formacao" | "taticas" | "atributos">("formacao")
  const [selectedPlayerId, setSelectedPlayerId] = useState<number | null>(null)
  const [draggingPlayer, setDraggingPlayer] = useState<number | null>(null)
  const [dragOverTarget, setDragOverTarget] = useState<number | null>(null)

  // Get players for the user's team and convert to UI format
  const teamPlayers = useMemo(() => {
    const rawPlayers = getPlayersForTeam(userTeam)
    return rawPlayers.map((p, idx) => ({
      id: idx + 1,
      name: p.nome,
      position: p.pos,
      age: p.idade,
      overall: p.base,
      potential: Math.min(99, p.base + seededInt(`${userTeam.curto}-${p.nome}-${idx}`, "potential", 0, 7)),
      energy: seededInt(`${userTeam.curto}-${p.nome}-${idx}`, "energy", 70, 94),
    }))
  }, [userTeam])

  // Position players based on formation
  const formationPositions = useMemo(() => {
    return FORMATIONS[formation]?.positions || FORMATIONS["4-3-3"].positions
  }, [formation])

  // Build starters and bench from teamPlayers
  const { starters, bench } = useMemo(() => {
    if (teamPlayers.length === 0) {
      return { starters: [], bench: [] }
    }
    // Sort by position order
    const posOrder: Record<string, number> = {
      GOL: 0, ZAG: 1, LD: 2, LE: 3, VOL: 4, MC: 4, MEI: 5, ME: 5, MD: 5, CA: 5, ATA: 6, PE: 6, PD: 6, SA: 6
    }
    const sorted = [...teamPlayers].sort((a, b) => (posOrder[a.position] ?? 7) - (posOrder[b.position] ?? 7))
    const startersList = sorted.slice(0, 11).map((p, i) => ({
      ...p,
      x: formationPositions[i]?.x || 50,
      y: formationPositions[i]?.y || 50,
      formationPos: formationPositions[i]?.pos || p.position,
    }))
    const benchList = sorted.slice(11)
    return { starters: startersList, bench: benchList }
  }, [teamPlayers, formationPositions])

  // Formation navigation
  const formationKeys = Object.keys(FORMATIONS)
  const currentFormationIndex = formationKeys.indexOf(formation)
  
  const prevFormation = () => {
    const newIndex = currentFormationIndex > 0 ? currentFormationIndex - 1 : formationKeys.length - 1
    setFormation(formationKeys[newIndex])
  }
  
  const nextFormation = () => {
    const newIndex = currentFormationIndex < formationKeys.length - 1 ? currentFormationIndex + 1 : 0
    setFormation(formationKeys[newIndex])
  }

  // Drag and drop handlers - simplified (just visual feedback)
  const handleDragStart = useCallback((e: React.DragEvent, playerId: number) => {
    setDraggingPlayer(playerId)
    e.dataTransfer.setData("text/plain", playerId.toString())
  }, [])

  const handleDragEnd = useCallback(() => {
    setDraggingPlayer(null)
    setDragOverTarget(null)
  }, [])

  const handleDragOverPlayer = useCallback((e: React.DragEvent, playerId: number) => {
    e.preventDefault()
    if (draggingPlayer !== playerId) {
      setDragOverTarget(playerId)
    }
  }, [draggingPlayer])

  const handleDragLeave = useCallback(() => {
    setDragOverTarget(null)
  }, [])

  const handleDropOnPlayer = useCallback((e: React.DragEvent, targetPlayerId: number) => {
    e.preventDefault()
    // For now, just show visual feedback
    // In a full implementation, we would swap players here
    setDraggingPlayer(null)
    setDragOverTarget(null)
  }, [])
  
  // Reset formation - just reset to default 4-3-3
  const resetFormation = useCallback(() => {
    setFormation("4-3-3")
    setSelectedPlayerId(null)
  }, [])

  // Show loading while players are being initialized
  if (starters.length === 0 || !starters[0]?.name) {
    return (
      <div className="h-screen flex items-center justify-center bg-[#050508] text-white">
        <div className="flex flex-col items-center gap-4">
          <div className="h-8 w-8 border-2 border-[#00ffc8] border-t-transparent rounded-full animate-spin" />
          <span className="text-white/60">Carregando escalacao...</span>
        </div>
      </div>
    )
  }
  
  return (
    <div className="h-screen overflow-hidden pl-16 bg-[#050508]">
      <GameSidebar />
      <GameHeader team={userTeam} />

      <main className="h-[calc(100vh-48px)] flex flex-col">
        {/* Sub-header with tabs */}
        <div className="flex flex-col md:flex-row md:items-center justify-between px-3 md:px-6 py-2 md:py-3 border-b border-white/10 bg-[#0d0d0d] gap-2 md:gap-0">
          <div className="flex items-center gap-3 md:gap-6">
            <button 
              onClick={() => router.push("/partida")}
              className="flex items-center gap-2 text-white/60 hover:text-white transition-colors"
            >
              <ChevronLeft className="h-5 w-5" />
              <span className="text-sm font-medium">Voltar</span>
            </button>
            
            <div className="flex items-center gap-2 md:gap-3">
              <TeamCrest team={userTeam} size="sm" />
              <div className="hidden sm:block">
                <h1 className="text-sm font-bold text-white">Escalacao</h1>
                <p className="text-[10px] text-white/40">{userTeam.nome}</p>
              </div>
            </div>
            
            {/* Tabs */}
            <div className="flex items-center gap-1">
              {(["formacao", "taticas", "atributos"] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={cn(
                    "px-2 md:px-4 py-1.5 md:py-2 text-xs md:text-sm font-medium transition-all rounded",
                    activeTab === tab
                      ? "text-white bg-white/10"
                      : "text-white/40 hover:text-white/70"
                  )}
                >
                  {tab === "formacao" ? "Formacao" : tab === "taticas" ? "Taticas" : "Atributos"}
                </button>
              ))}
            </div>
          </div>
          
          {/* Formation controls */}
          <div className="flex items-center gap-2 justify-center md:justify-end">
            <button 
              onClick={prevFormation}
              className="p-1.5 md:p-2 rounded-lg bg-white/5 hover:bg-white/10 text-white transition"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <div className="px-3 md:px-4 py-1.5 md:py-2 min-w-[80px] md:min-w-[100px] text-center rounded-lg bg-[#00ffc8]/20 border border-[#00ffc8]/30">
              <span className="text-base md:text-lg font-black text-white">{formation}</span>
            </div>
            <button 
              onClick={nextFormation}
              className="p-1.5 md:p-2 rounded-lg bg-white/5 hover:bg-white/10 text-white transition"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
            
            <div className="hidden md:flex items-center gap-2 ml-4">
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={resetFormation}
                className="text-white/60 hover:text-white"
              >
                <RotateCcw className="h-4 w-4 mr-2" />
                Resetar
              </Button>
            </div>
          </div>
        </div>

        <div className="flex flex-col lg:flex-row flex-1 overflow-hidden">
          {/* Left sidebar - Titulares */}
          <aside className="w-full lg:w-56 border-b lg:border-b-0 lg:border-r border-white/10 bg-[#0a0a0a] overflow-y-auto">
            <div className="p-3">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-semibold text-white/80 uppercase tracking-wider">
                  Titulares
                </h3>
                <span className="text-[10px] text-[#00ffc8] font-medium">{starters.length}/11</span>
              </div>
              
              <div className="space-y-1">
                {starters.map((player, index) => {
                  const posColors = positionColors[player.position] || positionColors.MEI
                  return (
                    <motion.button
                      key={player.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e as unknown as React.DragEvent, player.id)}
                      onDragOver={(e) => handleDragOverPlayer(e as unknown as React.DragEvent, player.id)}
                      onDragLeave={handleDragLeave}
                      onDrop={(e) => handleDropOnPlayer(e as unknown as React.DragEvent, player.id)}
                      onDragEnd={handleDragEnd}
                      animate={{
                        scale: draggingPlayer === player.id ? 1.02 : dragOverTarget === player.id ? 1.05 : 1,
                        opacity: draggingPlayer === player.id ? 0.6 : 1,
                      }}
                      onClick={() => setSelectedPlayerId(player.id)}
                      className={cn(
                        "w-full flex items-center gap-2 p-2 rounded-lg transition-all cursor-grab active:cursor-grabbing",
                        selectedPlayerId === player.id
                          ? "bg-[#00ffc8]/15 ring-1 ring-[#00ffc8]/40"
                          : "bg-white/[0.02] hover:bg-white/[0.05]",
                        dragOverTarget === player.id && "ring-2 ring-[#00ffc8]"
                      )}
                    >
                      <span className="text-[10px] font-bold text-white/30 w-4">{index + 1}</span>
                      
                      <div className="relative">
                        <PlayerAvatarCircle
                          name={player.name}
                          teamColor={userTeam.cor1}
                          size="xs"
                          className={cn(
                            "border-2 transition-colors",
                            selectedPlayerId === player.id ? "border-[#00ffc8]/60" : "border-white/10"
                          )}
                        />
                        <div className={cn(
                          "absolute -bottom-0.5 -right-0.5 h-4 w-4 rounded-full flex items-center justify-center text-[8px] font-black",
                          "bg-[#1a1a1a] border",
                          selectedPlayerId === player.id ? "border-[#00ffc8]/50" : "border-white/20"
                        )}>
                          <span className={getOverallColor(player.overall)}>{player.overall}</span>
                        </div>
                        {player.potential > player.overall + 3 && (
                          <div className="absolute -top-0.5 -left-0.5 h-3 w-3 rounded-full bg-[#00ffc8] flex items-center justify-center">
                            <TrendingUp className="h-1.5 w-1.5 text-black" />
                          </div>
                        )}
                      </div>
                      
                      <div className="flex-1 text-left min-w-0">
                        <div className="text-[11px] font-medium text-white truncate">{player.name}</div>
                        <div className={cn("text-[9px] font-semibold", posColors.text)}>{player.position}</div>
                      </div>
                    </motion.button>
                  )
                })}
              </div>
            </div>
          </aside>

          {/* Main content area */}
          <div className="flex-1 flex flex-col p-2 md:p-4 min-h-0">
            {activeTab === "formacao" && (
            <>
              {/* Pitch area */}
              <div 
                ref={pitchRef}
                className="relative rounded-xl md:rounded-2xl overflow-hidden flex-1 min-h-[350px] max-h-[500px]" 
                style={{
                  background: `linear-gradient(180deg, oklch(0.42 0.14 145), oklch(0.32 0.11 145))`,
                }}
              >
                {/* Pitch stripes */}
                <div
                  className="absolute inset-0 opacity-15"
                  style={{
                    backgroundImage: "repeating-linear-gradient(0deg, transparent 0 8%, rgba(0,0,0,0.15) 8% 16%)",
                  }}
                />
                
                {/* Pitch markings */}
                <svg viewBox="0 0 100 133" className="absolute inset-0 h-full w-full" preserveAspectRatio="none">
                  <g stroke="rgba(255,255,255,0.35)" strokeWidth="0.3" fill="none">
                    <rect x="3" y="3" width="94" height="127" rx="1" />
                    <line x1="3" y1="66.5" x2="97" y2="66.5" />
                    <circle cx="50" cy="66.5" r="12" />
                    <circle cx="50" cy="66.5" r="0.8" fill="rgba(255,255,255,0.35)" />
                    <rect x="20" y="3" width="60" height="20" />
                    <rect x="32" y="3" width="36" height="8" />
                    <circle cx="50" cy="16" r="0.8" fill="rgba(255,255,255,0.35)" />
                    <path d="M 35 23 Q 50 30 65 23" />
                    <rect x="20" y="110" width="60" height="20" />
                    <rect x="32" y="122" width="36" height="8" />
                    <circle cx="50" cy="117" r="0.8" fill="rgba(255,255,255,0.35)" />
                    <path d="M 35 110 Q 50 103 65 110" />
                    <rect x="40" y="0" width="20" height="3" strokeWidth="0.4" />
                    <rect x="40" y="130" width="20" height="3" strokeWidth="0.4" />
                  </g>
                </svg>

                {/* Players on pitch */}
                {starters.map((player) => (
                  <motion.div
                    key={player.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e as unknown as React.DragEvent, player.id)}
                    onDragOver={(e) => handleDragOverPlayer(e as unknown as React.DragEvent, player.id)}
                    onDragLeave={handleDragLeave}
                    onDrop={(e) => handleDropOnPlayer(e as unknown as React.DragEvent, player.id)}
                    onDragEnd={handleDragEnd}
                    initial={false}
                    animate={{ 
                      left: `${player.x}%`, 
                      top: `${(player.y / 133) * 100}%`,
                      scale: draggingPlayer === player.id ? 1.1 : dragOverTarget === player.id ? 1.15 : selectedPlayerId === player.id ? 1.05 : 1,
                      opacity: draggingPlayer === player.id ? 0.7 : 1,
                    }}
                    transition={{ type: "spring", stiffness: 400, damping: 30 }}
                    onClick={() => setSelectedPlayerId(player.id)}
                    className={cn(
                      "absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center cursor-grab active:cursor-grabbing group z-10",
                      selectedPlayerId === player.id && "z-20",
                      dragOverTarget === player.id && "ring-2 ring-[#00ffc8] ring-offset-2 ring-offset-transparent rounded-full"
                    )}
                  >
                    {/* Player name tag */}
                    <div className={cn(
                      "px-1.5 md:px-2 py-0.5 rounded text-[8px] md:text-[9px] font-semibold mb-1 whitespace-nowrap transition-all",
                      selectedPlayerId === player.id
                        ? "bg-[#00ffc8] text-black"
                        : "bg-black/60 text-white/90 group-hover:bg-black/80"
                    )}>
                      {player.name.split(" ").pop()}
                    </div>
                    
                    {/* Player avatar */}
                    <div className="relative">
                      <PlayerAvatarCircle
                        name={player.name}
                        teamColor={userTeam.cor1}
                        size="sm"
                        className={cn(
                          "border-2 transition-all",
                          selectedPlayerId === player.id
                            ? "border-[#00ffc8] shadow-[0_0_12px_rgba(29,185,84,0.5)]"
                            : "border-white/30 group-hover:border-white/60"
                        )}
                      />
                      
                      {/* Overall badge */}
                      <div className={cn(
                        "absolute -bottom-1 -right-1 h-5 w-5 md:h-6 md:w-6 rounded-full flex items-center justify-center text-[9px] md:text-[10px] font-black",
                        "bg-gradient-to-br from-[#1a1a1a] to-[#0a0a0a] border",
                        selectedPlayerId === player.id ? "border-[#00ffc8]" : "border-white/30"
                      )}>
                        <span className={getOverallColor(player.overall)}>{player.overall}</span>
                      </div>
                      
                      {/* Potential indicator */}
                      {player.potential > player.overall + 3 && (
                        <div className="absolute -top-1 -left-1 h-3 w-3 md:h-4 md:w-4 rounded-full bg-[#00ffc8] flex items-center justify-center">
                          <TrendingUp className="h-2 w-2 md:h-2.5 md:w-2.5 text-black" />
                        </div>
                      )}
                    </div>
                  </motion.div>
                ))}
              </div>
              
              {/* Reserves section */}
              <div className="mt-2 p-3 rounded-xl bg-[#111111] border border-white/[0.04] flex-shrink-0">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-xs font-semibold text-white/80 uppercase tracking-wider">Reservas ({bench.length})</h3>
                  <span className="text-[10px] text-white/40">Arraste para substituir</span>
                </div>
                
                <div className="max-h-[120px] overflow-y-auto scrollbar-game pr-1">
                  <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8 gap-2">
                    {bench.map((player) => {
                      const posColors = positionColors[player.position] || positionColors.MEI
                      return (
                        <motion.div
                          key={player.id}
                          draggable
                          onDragStart={(e) => handleDragStart(e as unknown as React.DragEvent, player.id)}
                          onDragOver={(e) => handleDragOverPlayer(e as unknown as React.DragEvent, player.id)}
                          onDragLeave={handleDragLeave}
                          onDrop={(e) => handleDropOnPlayer(e as unknown as React.DragEvent, player.id)}
                          onDragEnd={handleDragEnd}
                          animate={{
                            scale: draggingPlayer === player.id ? 1.05 : dragOverTarget === player.id ? 1.1 : 1,
                            opacity: draggingPlayer === player.id ? 0.7 : 1,
                          }}
                          onClick={() => setSelectedPlayerId(player.id)}
                          className={cn(
                            "flex flex-col items-center p-2 rounded-lg cursor-grab active:cursor-grabbing transition-all",
                            selectedPlayerId === player.id
                              ? "bg-[#00ffc8]/15 ring-1 ring-[#00ffc8]/40"
                              : "bg-white/[0.03] hover:bg-white/[0.06]",
                            dragOverTarget === player.id && "ring-2 ring-[#00ffc8]"
                          )}
                        >
                          <div className="relative mb-1">
                            <PlayerAvatarCircle
                              name={player.name}
                              teamColor={userTeam.cor1}
                              size="xs"
                              className={cn(
                                "border-2 transition-colors",
                                selectedPlayerId === player.id ? "border-[#00ffc8]/60" : "border-white/10"
                              )}
                            />
                            <div className={cn(
                              "absolute -bottom-0.5 -right-0.5 h-5 w-5 rounded-full flex items-center justify-center text-[8px] font-black",
                              "bg-[#1a1a1a] border",
                              selectedPlayerId === player.id ? "border-[#00ffc8]/50" : "border-white/20"
                            )}>
                              <span className={getOverallColor(player.overall)}>{player.overall}</span>
                            </div>
                          </div>
                          <span className="text-[9px] text-white/80 font-medium truncate w-full text-center">{player.name.split(" ").pop()}</span>
                          <span className={cn("text-[8px] font-semibold mt-0.5 px-1 py-px rounded", posColors.bg, posColors.text)}>{player.position}</span>
                        </motion.div>
                      )
                    })}
                  </div>
                </div>
              </div>
            </>
            )}

            {activeTab === "taticas" && (
              <div className="flex-1 rounded-xl md:rounded-2xl bg-[#111111] border border-white/10 overflow-auto p-4 md:p-6">
                <div className="max-w-4xl mx-auto space-y-6">
                  <div>
                    <h2 className="text-lg font-bold text-white mb-2">Instrucoes Taticas</h2>
                    <p className="text-sm text-white/50">Configure o estilo de jogo da sua equipe</p>
                  </div>

                  {/* Defensive Style */}
                  <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                    <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
                      <Shield className="h-4 w-4 text-blue-400" />
                      Estilo Defensivo
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs text-white/60 block mb-2">Linha Defensiva</label>
                        <div className="flex gap-2">
                          {["Baixa", "Media", "Alta"].map((opt, i) => (
                            <button key={opt} className={cn(
                              "flex-1 px-3 py-2 rounded-lg text-xs font-medium transition-all",
                              i === 1 ? "bg-[#00ffc8] text-black" : "bg-white/5 text-white/60 hover:bg-white/10"
                            )}>{opt}</button>
                          ))}
                        </div>
                      </div>
                      <div>
                        <label className="text-xs text-white/60 block mb-2">Marcacao</label>
                        <div className="flex gap-2">
                          {["Pressao", "Equilibrada", "Recuada"].map((opt, i) => (
                            <button key={opt} className={cn(
                              "flex-1 px-3 py-2 rounded-lg text-xs font-medium transition-all",
                              i === 1 ? "bg-[#00ffc8] text-black" : "bg-white/5 text-white/60 hover:bg-white/10"
                            )}>{opt}</button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Offensive Style */}
                  <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                    <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
                      <Target className="h-4 w-4 text-red-400" />
                      Estilo Ofensivo
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs text-white/60 block mb-2">Construcao</label>
                        <div className="flex gap-2">
                          {["Curta", "Mista", "Direta"].map((opt, i) => (
                            <button key={opt} className={cn(
                              "flex-1 px-3 py-2 rounded-lg text-xs font-medium transition-all",
                              i === 1 ? "bg-[#00ffc8] text-black" : "bg-white/5 text-white/60 hover:bg-white/10"
                            )}>{opt}</button>
                          ))}
                        </div>
                      </div>
                      <div>
                        <label className="text-xs text-white/60 block mb-2">Velocidade de Ataque</label>
                        <div className="flex gap-2">
                          {["Lenta", "Normal", "Rapida"].map((opt, i) => (
                            <button key={opt} className={cn(
                              "flex-1 px-3 py-2 rounded-lg text-xs font-medium transition-all",
                              i === 1 ? "bg-[#00ffc8] text-black" : "bg-white/5 text-white/60 hover:bg-white/10"
                            )}>{opt}</button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Team Mentality */}
                  <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                    <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
                      <Zap className="h-4 w-4 text-yellow-400" />
                      Mentalidade
                    </h3>
                    <div className="flex gap-2">
                      {["Ultra Def.", "Defensiva", "Equilibrada", "Ofensiva", "Ultra Ofe."].map((opt, i) => (
                        <button key={opt} className={cn(
                          "flex-1 px-3 py-2 rounded-lg text-xs font-medium transition-all",
                          i === 2 ? "bg-[#00ffc8] text-black" : "bg-white/5 text-white/60 hover:bg-white/10"
                        )}>{opt}</button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "atributos" && (
              <div className="flex-1 rounded-xl md:rounded-2xl bg-[#111111] border border-white/10 overflow-auto p-4 md:p-6">
                <div className="max-w-4xl mx-auto">
                  <h2 className="text-lg font-bold text-white mb-4">Atribuicoes de Jogadores</h2>
                  <p className="text-sm text-white/50 mb-6">Defina funcoes especificas para cada jogador</p>
                  
                  <div className="space-y-3">
                    {starters.map((player) => (
                      <div key={player.id} className="flex items-center justify-between p-3 rounded-lg bg-white/5 border border-white/10">
                        <div className="flex items-center gap-3">
                          <PlayerAvatarCircle name={player.name} teamColor={userTeam.cor1} size="xs" />
                          <div>
                            <div className="text-sm font-medium text-white">{player.name}</div>
                            <div className="text-xs text-white/40">{player.position}</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <select className="px-2 py-1 rounded bg-white/10 border border-white/20 text-xs text-white">
                            <option>Padrao</option>
                            <option>Ficar Atras</option>
                            <option>Apoiar Ataque</option>
                            <option>Livre</option>
                          </select>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Right sidebar - Player details */}
          <aside className="hidden xl:block w-64 border-l border-white/10 bg-[#0a0a0a] overflow-y-auto p-4">
            {selectedPlayerId ? (
              (() => {
                const player = [...starters, ...bench].find(p => p.id === selectedPlayerId)
                if (!player) return null
                const posColors = positionColors[player.position] || positionColors.MEI
                
                return (
                  <div className="space-y-4">
                    <div className="flex flex-col items-center">
                      <PlayerAvatarCircle name={player.name} teamColor={userTeam.cor1} size="lg" className="border-2 border-[#00ffc8]/50" />
                      <h3 className="mt-3 text-base font-bold text-white">{player.name}</h3>
                      <div className={cn("text-xs font-semibold mt-1 px-2 py-0.5 rounded", posColors.bg, posColors.text)}>
                        {player.position}
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-2">
                      <div className="p-2 rounded-lg bg-white/5 text-center">
                        <div className={cn("text-lg font-black", getOverallColor(player.overall))}>{player.overall}</div>
                        <div className="text-[10px] text-white/40 uppercase">Overall</div>
                      </div>
                      <div className="p-2 rounded-lg bg-white/5 text-center">
                        <div className="text-lg font-black text-[#00ffc8]">{player.potential}</div>
                        <div className="text-[10px] text-white/40 uppercase">Potencial</div>
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-white/60">Idade</span>
                        <span className="text-white font-medium">{player.age} anos</span>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-white/60">Energia</span>
                        <div className="flex items-center gap-2">
                          <div className="w-16 h-1.5 rounded-full bg-white/10 overflow-hidden">
                            <div className="h-full bg-green-500 rounded-full" style={{ width: `${player.energy || 80}%` }} />
                          </div>
                          <span className="text-white font-medium">{player.energy || 80}%</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })()
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-center text-white/40">
                <ArrowLeftRight className="h-8 w-8 mb-2 opacity-50" />
                <p className="text-sm">Nenhum jogador selecionado</p>
                <p className="text-xs mt-1">Clique em um jogador para ver detalhes</p>
              </div>
            )}
          </aside>
        </div>

        {/* Bottom action bar */}
        <div className="h-14 bg-[#0d0d0d] border-t border-white/10 flex items-center justify-between px-4 md:px-6">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => router.push("/partida")}
            className="text-white/60 hover:text-white"
          >
            <ChevronLeft className="h-4 w-4 mr-2" />
            Voltar
          </Button>

          <Button
            onClick={() => router.push("/partida")}
            className="bg-[#00ffc8] hover:bg-[#00ffc8]/90 text-black font-bold"
          >
            <Check className="h-4 w-4 mr-2" />
            Confirmar
          </Button>
        </div>
      </main>
    </div>
  )
}
