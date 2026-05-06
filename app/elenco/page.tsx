"use client"

import { useState, useMemo, useCallback, useRef, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { 
  ChevronLeft, 
  ChevronRight,
  Star,
  Zap,
  Heart,
  Gauge,
  Shield,
  Target,
  TrendingUp,
  Smile,
  ArrowLeftRight,
  RotateCcw,
  Shuffle,
  Info,
  Scale,
  Clock,
  X,
  Gamepad2
} from "lucide-react"
import { GameSidebar } from "@/components/game-sidebar"
import { GameHeader } from "@/components/game-header"
import { TeamCrest } from "@/components/team-crest"
import { PlayerAvatarCircle } from "@/components/player-avatar"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { getTeamByShort, serieATeams } from "@/lib/teams-data"
import { useGameState } from "@/lib/save-system"
import { useNotifications } from "@/components/notifications-system"

// Formacoes predefinidas - EA FC style
const FORMATIONS: Record<string, { name: string; positions: { pos: string; x: number; y: number }[] }> = {
  "4-3-3": {
    name: "4-3-3",
    positions: [
      { pos: "GOL", x: 50, y: 90 },
      { pos: "LD", x: 85, y: 70 },
      { pos: "ZAG", x: 65, y: 75 },
      { pos: "ZAG", x: 35, y: 75 },
      { pos: "LE", x: 15, y: 70 },
      { pos: "VOL", x: 50, y: 52 },
      { pos: "MEI", x: 75, y: 40 },
      { pos: "MEI", x: 25, y: 40 },
      { pos: "PD", x: 78, y: 18 },
      { pos: "ATA", x: 50, y: 10 },
      { pos: "PE", x: 22, y: 18 },
    ],
  },
  "4-4-2": {
    name: "4-4-2",
    positions: [
      { pos: "GOL", x: 50, y: 90 },
      { pos: "LD", x: 85, y: 70 },
      { pos: "ZAG", x: 65, y: 75 },
      { pos: "ZAG", x: 35, y: 75 },
      { pos: "LE", x: 15, y: 70 },
      { pos: "MD", x: 85, y: 45 },
      { pos: "VOL", x: 60, y: 50 },
      { pos: "VOL", x: 40, y: 50 },
      { pos: "ME", x: 15, y: 45 },
      { pos: "ATA", x: 60, y: 12 },
      { pos: "ATA", x: 40, y: 12 },
    ],
  },
  "4-2-3-1": {
    name: "4-2-3-1",
    positions: [
      { pos: "GOL", x: 50, y: 90 },
      { pos: "LD", x: 85, y: 70 },
      { pos: "ZAG", x: 65, y: 75 },
      { pos: "ZAG", x: 35, y: 75 },
      { pos: "LE", x: 15, y: 70 },
      { pos: "VOL", x: 60, y: 55 },
      { pos: "VOL", x: 40, y: 55 },
      { pos: "PD", x: 80, y: 32 },
      { pos: "MEI", x: 50, y: 28 },
      { pos: "PE", x: 20, y: 32 },
      { pos: "ATA", x: 50, y: 10 },
    ],
  },
  "3-5-2": {
    name: "3-5-2",
    positions: [
      { pos: "GOL", x: 50, y: 90 },
      { pos: "ZAG", x: 75, y: 75 },
      { pos: "ZAG", x: 50, y: 78 },
      { pos: "ZAG", x: 25, y: 75 },
      { pos: "ALD", x: 90, y: 48 },
      { pos: "VOL", x: 65, y: 52 },
      { pos: "MEI", x: 50, y: 40 },
      { pos: "VOL", x: 35, y: 52 },
      { pos: "ALE", x: 10, y: 48 },
      { pos: "ATA", x: 60, y: 12 },
      { pos: "ATA", x: 40, y: 12 },
    ],
  },
  "5-3-2": {
    name: "5-3-2",
    positions: [
      { pos: "GOL", x: 50, y: 90 },
      { pos: "ALD", x: 90, y: 60 },
      { pos: "ZAG", x: 70, y: 75 },
      { pos: "ZAG", x: 50, y: 78 },
      { pos: "ZAG", x: 30, y: 75 },
      { pos: "ALE", x: 10, y: 60 },
      { pos: "MEI", x: 70, y: 42 },
      { pos: "VOL", x: 50, y: 48 },
      { pos: "MEI", x: 30, y: 42 },
      { pos: "ATA", x: 60, y: 12 },
      { pos: "ATA", x: 40, y: 12 },
    ],
  },
}

// Mock players data
const playersData = [
  { id: 1, name: "Cleiton", position: "GOL", age: 28, overall: 78, potential: 80, energy: 80, rhythm: 75, moral: "Feliz", foot: "Direita", acceleration: "Controlado", function: "Introvertido", focus: "Ataque", height: 186, pace: 45, shooting: 20, passing: 55, dribbling: 35, defending: 25, physical: 70, fintas: 4 },
  { id: 2, name: "Nathan Mendes", position: "LD", age: 24, overall: 75, potential: 82, energy: 85, rhythm: 78, moral: "Motivado", foot: "Direita", acceleration: "Explosivo", function: "Equilibrado", focus: "Equilibrado", height: 178, pace: 82, shooting: 55, passing: 70, dribbling: 72, defending: 74, physical: 70, fintas: 3 },
  { id: 3, name: "Pedro Henrique", position: "ZAG", age: 27, overall: 77, potential: 78, energy: 75, rhythm: 72, moral: "Normal", foot: "Direita", acceleration: "Controlado", function: "Defensivo", focus: "Defesa", height: 188, pace: 68, shooting: 45, passing: 60, dribbling: 55, defending: 80, physical: 82, fintas: 2 },
  { id: 4, name: "Eduardo Santos", position: "ZAG", age: 25, overall: 76, potential: 80, energy: 78, rhythm: 74, moral: "Feliz", foot: "Esquerda", acceleration: "Controlado", function: "Construtor", focus: "Defesa", height: 185, pace: 70, shooting: 42, passing: 58, dribbling: 52, defending: 78, physical: 80, fintas: 2 },
  { id: 5, name: "Luan Candido", position: "LE", age: 23, overall: 74, potential: 83, energy: 90, rhythm: 80, moral: "Motivado", foot: "Esquerda", acceleration: "Explosivo", function: "Ofensivo", focus: "Ataque", height: 175, pace: 85, shooting: 58, passing: 72, dribbling: 75, defending: 70, physical: 68, fintas: 3 },
  { id: 6, name: "Jadsom Silva", position: "VOL", age: 22, overall: 73, potential: 84, energy: 82, rhythm: 76, moral: "Normal", foot: "Direita", acceleration: "Equilibrado", function: "Box-to-box", focus: "Equilibrado", height: 180, pace: 72, shooting: 60, passing: 75, dribbling: 72, defending: 76, physical: 75, fintas: 2 },
  { id: 7, name: "Eric Ramires", position: "MEI", age: 26, overall: 79, potential: 81, energy: 76, rhythm: 79, moral: "Feliz", foot: "Direita", acceleration: "Controlado", function: "Meia Armador", focus: "Ataque", height: 176, pace: 75, shooting: 72, passing: 82, dribbling: 80, defending: 55, physical: 70, fintas: 4 },
  { id: 8, name: "Lincoln", position: "MEI", age: 24, overall: 78, potential: 85, energy: 84, rhythm: 80, moral: "Motivado", foot: "Direita", acceleration: "Explosivo", function: "Meia Atacante", focus: "Ataque", height: 174, pace: 80, shooting: 75, passing: 80, dribbling: 82, defending: 55, physical: 68, fintas: 4 },
  { id: 9, name: "Vitinho", position: "PD", age: 25, overall: 76, potential: 80, energy: 78, rhythm: 77, moral: "Normal", foot: "Esquerda", acceleration: "Explosivo", function: "Ponta Invertido", focus: "Ataque", height: 172, pace: 88, shooting: 72, passing: 70, dribbling: 80, defending: 35, physical: 65, fintas: 4 },
  { id: 10, name: "Eduardo Sasha", position: "ATA", age: 30, overall: 81, potential: 81, energy: 72, rhythm: 75, moral: "Feliz", foot: "Direita", acceleration: "Controlado", function: "Finalizador", focus: "Ataque", height: 182, pace: 78, shooting: 85, passing: 68, dribbling: 75, defending: 38, physical: 76, fintas: 3 },
  { id: 11, name: "Helinho", position: "PE", age: 22, overall: 75, potential: 84, energy: 88, rhythm: 82, moral: "Motivado", foot: "Direita", acceleration: "Explosivo", function: "Ponta Invertido", focus: "Ataque", height: 170, pace: 90, shooting: 70, passing: 72, dribbling: 82, defending: 32, physical: 62, fintas: 5 },
]

const benchData = [
  { id: 12, name: "Santos", position: "GOL", age: 32, overall: 80, potential: 80, energy: 70, rhythm: 72, moral: "Normal", foot: "Direita", acceleration: "Controlado", function: "Goleiro", focus: "Defesa", height: 190, pace: 40, shooting: 18, passing: 52, dribbling: 30, defending: 22, physical: 72, fintas: 1 },
  { id: 13, name: "Estevao", position: "MD", age: 20, overall: 79, potential: 90, energy: 92, rhythm: 85, moral: "Motivado", foot: "Esquerda", acceleration: "Explosivo", function: "Meia Atacante", focus: "Ataque", height: 168, pace: 85, shooting: 75, passing: 78, dribbling: 88, defending: 40, physical: 55, fintas: 5 },
  { id: 14, name: "Lavis", position: "VOL", age: 24, overall: 78, potential: 82, energy: 80, rhythm: 76, moral: "Normal", foot: "Direita", acceleration: "Equilibrado", function: "Volante", focus: "Defesa", height: 182, pace: 70, shooting: 58, passing: 75, dribbling: 70, defending: 78, physical: 78, fintas: 2 },
  { id: 15, name: "Garnacho", position: "ME", age: 20, overall: 78, potential: 88, energy: 90, rhythm: 84, moral: "Feliz", foot: "Direita", acceleration: "Explosivo", function: "Ponta", focus: "Ataque", height: 180, pace: 88, shooting: 74, passing: 68, dribbling: 84, defending: 35, physical: 68, fintas: 4 },
  { id: 16, name: "Hato", position: "LE", age: 19, overall: 78, potential: 87, energy: 88, rhythm: 80, moral: "Motivado", foot: "Esquerda", acceleration: "Explosivo", function: "Lateral Ofensivo", focus: "Equilibrado", height: 185, pace: 82, shooting: 55, passing: 72, dribbling: 74, defending: 75, physical: 75, fintas: 3 },
  { id: 17, name: "Jorgensen", position: "GL", age: 26, overall: 78, potential: 80, energy: 75, rhythm: 74, moral: "Normal", foot: "Direita", acceleration: "Controlado", function: "Goleiro", focus: "Defesa", height: 192, pace: 38, shooting: 15, passing: 55, dribbling: 28, defending: 20, physical: 75, fintas: 1 },
  { id: 18, name: "Guto", position: "ATA", age: 23, overall: 77, potential: 83, energy: 82, rhythm: 78, moral: "Feliz", foot: "Direita", acceleration: "Explosivo", function: "Centroavante", focus: "Ataque", height: 184, pace: 82, shooting: 78, passing: 62, dribbling: 72, defending: 32, physical: 75, fintas: 3 },
]

const positionColors: Record<string, { bg: string; text: string; border: string }> = {
  GOL: { bg: "bg-amber-500/30", text: "text-amber-400", border: "border-amber-500/50" },
  ZAG: { bg: "bg-blue-500/30", text: "text-blue-400", border: "border-blue-500/50" },
  LD: { bg: "bg-blue-500/30", text: "text-blue-400", border: "border-blue-500/50" },
  LE: { bg: "bg-blue-500/30", text: "text-blue-400", border: "border-blue-500/50" },
  ALD: { bg: "bg-blue-500/30", text: "text-blue-400", border: "border-blue-500/50" },
  ALE: { bg: "bg-blue-500/30", text: "text-blue-400", border: "border-blue-500/50" },
  VOL: { bg: "bg-green-500/30", text: "text-green-400", border: "border-green-500/50" },
  MEI: { bg: "bg-green-500/30", text: "text-green-400", border: "border-green-500/50" },
  MD: { bg: "bg-green-500/30", text: "text-green-400", border: "border-green-500/50" },
  ME: { bg: "bg-green-500/30", text: "text-green-400", border: "border-green-500/50" },
  PD: { bg: "bg-purple-500/30", text: "text-purple-400", border: "border-purple-500/50" },
  PE: { bg: "bg-purple-500/30", text: "text-purple-400", border: "border-purple-500/50" },
  ATA: { bg: "bg-red-500/30", text: "text-red-400", border: "border-red-500/50" },
  GL: { bg: "bg-amber-500/30", text: "text-amber-400", border: "border-amber-500/50" },
}

function getOverallColor(overall: number) {
  if (overall >= 85) return "text-yellow-400"
  if (overall >= 80) return "text-lime-400"
  if (overall >= 75) return "text-green-400"
  if (overall >= 70) return "text-blue-400"
  return "text-gray-400"
}

function getStatColor(stat: number) {
  if (stat >= 85) return "text-yellow-400"
  if (stat >= 80) return "text-lime-400"
  if (stat >= 70) return "text-green-400"
  if (stat >= 60) return "text-orange-400"
  return "text-red-400"
}

function getMoralColor(moral: string) {
  switch (moral) {
    case "Feliz": return "text-green-400"
    case "Motivado": return "text-lime-400"
    case "Normal": return "text-yellow-400"
    default: return "text-gray-400"
  }
}

function getStarRating(fintas: number) {
  return Array(5).fill(0).map((_, i) => (
    <Star 
      key={i} 
      className={cn(
        "h-3 w-3",
        i < fintas ? "fill-yellow-400 text-yellow-400" : "text-white/20"
      )} 
    />
  ))
}

type ViewType = "menu" | "visao_tatica" | "gerenciamento" | "escalacoes"

export default function ElencoPage() {
  const { state } = useGameState()
  const { addNotification } = useNotifications()
  const userTeam = getTeamByShort(state.selectedTeamShort || "BGT") || serieATeams[0]
  
  const [currentView, setCurrentView] = useState<ViewType>("gerenciamento")
  const [activeTab, setActiveTab] = useState<"elenco" | "taticas" | "atribuicoes">("elenco")
  const [formation, setFormation] = useState("4-3-3")
  const [players, setPlayers] = useState(playersData)
  const [bench, setBench] = useState(benchData)
  const [selectedPlayerId, setSelectedPlayerId] = useState<number>(10)
  const [draggingPlayer, setDraggingPlayer] = useState<number | null>(null)
  const [dragOverTarget, setDragOverTarget] = useState<number | null>(null)
  const [playerPositions, setPlayerPositions] = useState<Record<number, { x: number; y: number }>>({})
  const [showMatchNotification, setShowMatchNotification] = useState(false)
  const [isMatchInProgress, setIsMatchInProgress] = useState(false)
  const [showSubstitutionModal, setShowSubstitutionModal] = useState(false)
  const [showPlayerProfile, setShowPlayerProfile] = useState(false)
  const [showTutorials, setShowTutorials] = useState(false)
  const [showSuggestedSubs, setShowSuggestedSubs] = useState(false)
  const [ballInstruction, setBallInstruction] = useState<"sem_bola" | "com_bola">("sem_bola")
  const pitchRef = useRef<HTMLDivElement>(null)
  
  // Match notifications should only show during actual matches (simulations)
  // This would be triggered by the match simulation system
  // For now, we check a hypothetical state flag
  
  const selectedPlayer = useMemo(() => {
    return [...players, ...bench].find(p => p.id === selectedPlayerId) || players[0]
  }, [selectedPlayerId, players, bench])
  
  const formationKeys = Object.keys(FORMATIONS)
  const currentFormationIndex = formationKeys.indexOf(formation)
  
  const positionedPlayers = useMemo(() => {
    const formationData = FORMATIONS[formation]
    return players.map((player, index) => {
      const customPos = playerPositions[player.id]
      return {
        ...player,
        x: customPos?.x ?? formationData.positions[index]?.x ?? 50,
        y: customPos?.y ?? formationData.positions[index]?.y ?? 50,
      }
    })
  }, [players, formation, playerPositions])
  
  const nextFormation = () => {
    const nextIndex = (currentFormationIndex + 1) % formationKeys.length
    setFormation(formationKeys[nextIndex])
    setPlayerPositions({}) // Reset custom positions on formation change
  }
  
  const prevFormation = () => {
    const prevIndex = (currentFormationIndex - 1 + formationKeys.length) % formationKeys.length
    setFormation(formationKeys[prevIndex])
    setPlayerPositions({})
  }
  
  // Drag and drop handlers
  const handleDragStart = useCallback((e: React.DragEvent, playerId: number) => {
    setDraggingPlayer(playerId)
    e.dataTransfer.setData("playerId", playerId.toString())
    e.dataTransfer.effectAllowed = "move"
  }, [])
  
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = "move"
  }, [])
  
  const handleDragOverPlayer = useCallback((e: React.DragEvent, playerId: number) => {
    e.preventDefault()
    e.stopPropagation()
    setDragOverTarget(playerId)
  }, [])
  
  const handleDragLeave = useCallback(() => {
    setDragOverTarget(null)
  }, [])
  
  const handleDropOnPitch = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    const playerId = parseInt(e.dataTransfer.getData("playerId"))
    
    if (!pitchRef.current || !playerId) return
    
    const rect = pitchRef.current.getBoundingClientRect()
    const x = ((e.clientX - rect.left) / rect.width) * 100
    const y = ((e.clientY - rect.top) / rect.height) * 100
    
    // Clamp to field bounds
    const clampedX = Math.max(5, Math.min(95, x))
    const clampedY = Math.max(5, Math.min(95, y))
    
    // Check if player is from bench
    const benchPlayer = bench.find(p => p.id === playerId)
    if (benchPlayer) {
      // Find closest field player to swap
      const fieldPlayer = positionedPlayers.reduce((closest, p) => {
        const dist = Math.hypot(p.x - clampedX, p.y - clampedY)
        const closestDist = closest ? Math.hypot(closest.x - clampedX, closest.y - clampedY) : Infinity
        return dist < closestDist ? p : closest
      }, null as typeof positionedPlayers[0] | null)
      
      if (fieldPlayer) {
        // Swap players
        setPlayers(prev => prev.map(p => p.id === fieldPlayer.id ? benchPlayer : p))
        setBench(prev => prev.map(p => p.id === benchPlayer.id ? fieldPlayer : p))
      }
    } else {
      // Update position for field player
      setPlayerPositions(prev => ({
        ...prev,
        [playerId]: { x: clampedX, y: clampedY }
      }))
    }
    
    setDraggingPlayer(null)
    setDragOverTarget(null)
  }, [bench, positionedPlayers])
  
  const handleDropOnPlayer = useCallback((e: React.DragEvent, targetId: number) => {
    e.preventDefault()
    e.stopPropagation()
    
    const draggedId = parseInt(e.dataTransfer.getData("playerId"))
    if (!draggedId || draggedId === targetId) {
      setDraggingPlayer(null)
      setDragOverTarget(null)
      return
    }
    
    const draggedFromField = players.find(p => p.id === draggedId)
    const draggedFromBench = bench.find(p => p.id === draggedId)
    const targetFromField = players.find(p => p.id === targetId)
    const targetFromBench = bench.find(p => p.id === targetId)
    
    if (draggedFromField && targetFromField) {
      // Swap positions on field
      const draggedIdx = players.findIndex(p => p.id === draggedId)
      const targetIdx = players.findIndex(p => p.id === targetId)
      setPlayers(prev => {
        const newPlayers = [...prev]
        ;[newPlayers[draggedIdx], newPlayers[targetIdx]] = [newPlayers[targetIdx], newPlayers[draggedIdx]]
        return newPlayers
      })
      // Clear custom positions for swapped players
      setPlayerPositions(prev => {
        const newPos = { ...prev }
        delete newPos[draggedId]
        delete newPos[targetId]
        return newPos
      })
    } else if (draggedFromBench && targetFromField) {
      // Swap bench player with field player
      setPlayers(prev => prev.map(p => p.id === targetId ? draggedFromBench : p))
      setBench(prev => prev.map(p => p.id === draggedId ? targetFromField : p))
      setPlayerPositions(prev => {
        const newPos = { ...prev }
        delete newPos[targetId]
        return newPos
      })
    } else if (draggedFromField && targetFromBench) {
      // Swap field player with bench player
      setPlayers(prev => prev.map(p => p.id === draggedId ? targetFromBench : p))
      setBench(prev => prev.map(p => p.id === targetId ? draggedFromField : p))
      setPlayerPositions(prev => {
        const newPos = { ...prev }
        delete newPos[draggedId]
        return newPos
      })
    } else if (draggedFromBench && targetFromBench) {
      // Swap on bench
      const draggedIdx = bench.findIndex(p => p.id === draggedId)
      const targetIdx = bench.findIndex(p => p.id === targetId)
      setBench(prev => {
        const newBench = [...prev]
        ;[newBench[draggedIdx], newBench[targetIdx]] = [newBench[targetIdx], newBench[draggedIdx]]
        return newBench
      })
    }
    
    setDraggingPlayer(null)
    setDragOverTarget(null)
  }, [players, bench])
  
  const handleDragEnd = useCallback(() => {
    setDraggingPlayer(null)
    setDragOverTarget(null)
  }, [])

  // Menu view with cards
  if (currentView === "menu") {
    return (
      <div className="h-screen pl-[72px] bg-[#0a0a0a] flex flex-col overflow-hidden">
        <GameSidebar />
        <GameHeader team={userTeam} />
        
        <main className="flex-1 p-4 overflow-y-auto">
          {/* Header */}
          <div className="flex items-center gap-4 mb-8">
            <TeamCrest team={userTeam} size="lg" />
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-white">{userTeam.nome}</h1>
              <p className="text-sm text-white/50">Gerenciamento de Elenco</p>
            </div>
          </div>
          
          {/* Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
            {/* Visao Tatica Card */}
            <motion.button
              whileHover={{ scale: 1.02, y: -4 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setCurrentView("visao_tatica")}
              className="relative p-6 rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/20 via-primary/10 to-transparent text-left overflow-hidden group"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 rounded-full blur-3xl" />
              <h2 className="text-xl md:text-2xl font-bold text-white mb-1">Visao Tatica</h2>
              <p className="text-sm text-primary mb-6">Visao tatica atual</p>
              
              <div className="flex justify-center mb-6">
                <Scale className="h-20 w-20 md:h-24 md:w-24 text-white/80" />
              </div>
              
              <p className="text-lg font-semibold text-white">Padrao</p>
              
              <div className="flex items-center gap-2 mt-4 text-white/60 text-sm">
                <X className="h-4 w-4" />
                <span>Impacto em atleta</span>
              </div>
            </motion.button>
            
            {/* Gerenciamento do Time Card */}
            <motion.button
              whileHover={{ scale: 1.02, y: -4 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setCurrentView("gerenciamento")}
              className="relative p-6 rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/20 via-primary/10 to-transparent text-left overflow-hidden group"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 rounded-full blur-3xl" />
              <h2 className="text-xl md:text-2xl font-bold text-white mb-1">Gerenciamento do Time</h2>
              <p className="text-sm text-primary mb-4">Padrao {userTeam.nome.toUpperCase()}</p>
              
              {/* Mini field preview */}
              <div className="relative w-full aspect-[4/3] rounded-lg overflow-hidden bg-green-900/30 mb-4">
                <svg viewBox="0 0 100 75" className="absolute inset-0 w-full h-full">
                  <g stroke="rgba(255,255,255,0.3)" strokeWidth="0.5" fill="none">
                    <rect x="5" y="5" width="90" height="65" />
                    <line x1="50" y1="5" x2="50" y2="70" />
                    <circle cx="50" cy="37.5" r="8" />
                  </g>
                  {/* Players dots */}
                  {FORMATIONS[formation].positions.map((pos, i) => (
                    <circle key={i} cx={pos.x} cy={pos.y * 0.75} r="3" fill="white" />
                  ))}
                </svg>
              </div>
              
              {/* Stats indicators */}
              <div className="flex justify-around">
                <div className="flex flex-col items-center gap-1">
                  <div className="h-8 w-8 rounded-full border-2 border-green-500 flex items-center justify-center">
                    <Zap className="h-4 w-4 text-green-500" />
                  </div>
                  <span className="text-[10px] text-white/60">Prep. fisico</span>
                </div>
                <div className="flex flex-col items-center gap-1">
                  <div className="h-8 w-8 rounded-full border-2 border-green-500 flex items-center justify-center">
                    <Gauge className="h-4 w-4 text-green-500" />
                  </div>
                  <span className="text-[10px] text-white/60">Ritmo</span>
                </div>
                <div className="flex flex-col items-center gap-1">
                  <div className="h-8 w-8 rounded-full border-2 border-green-500 flex items-center justify-center">
                    <Heart className="h-4 w-4 text-green-500" />
                  </div>
                  <span className="text-[10px] text-white/60">Moral</span>
                </div>
              </div>
            </motion.button>
            
            {/* Escalacoes Card */}
            <motion.button
              whileHover={{ scale: 1.02, y: -4 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setCurrentView("escalacoes")}
              className="relative p-6 rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/20 via-primary/10 to-transparent text-left overflow-hidden group"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 rounded-full blur-3xl" />
              <h2 className="text-xl md:text-2xl font-bold text-white mb-1">Escalacoes</h2>
              <p className="text-sm text-primary mb-6">Escalacoes criadas: 1</p>
              
              <div className="flex justify-center mb-6">
                <div className="relative w-20 h-20 md:w-24 md:h-24">
                  <div className="absolute inset-0 border-2 border-white/80 rounded-lg" />
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-6 h-6 border-2 border-white/80 rounded-full" />
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-4 border-2 border-t-0 border-white/80" />
                </div>
              </div>
              
              <p className="text-xs text-white/60 text-center leading-relaxed">
                Monte e use diversas escalacoes para aproveitar o elenco ao maximo. Alterne escalacoes para se adaptar aos times adversarios.
              </p>
            </motion.button>
          </div>
          
          {/* Bottom controls */}
          <div className="fixed bottom-0 left-[72px] right-0 h-14 bg-[#0d0d0d] border-t border-white/10 flex items-center justify-between px-4 md:px-6">
            <div className="flex items-center gap-2 md:gap-4">
              <Button variant="ghost" size="sm" className="text-white/60 hover:text-white text-xs md:text-sm">
                <Gamepad2 className="h-4 w-4 mr-1 md:mr-2" />
                <span className="hidden sm:inline">Selecionar</span>
              </Button>
              <Button variant="ghost" size="sm" className="text-white/60 hover:text-white text-xs md:text-sm">
                <ChevronLeft className="h-4 w-4 mr-1" />
                <span className="hidden sm:inline">Voltar</span>
              </Button>
              <Button variant="ghost" size="sm" className="text-white/60 hover:text-white text-xs md:text-sm">
                <Info className="h-4 w-4 mr-1 md:mr-2" />
                <span className="hidden sm:inline">Tutoriais</span>
              </Button>
            </div>
            
            <Button
              onClick={() => setCurrentView("gerenciamento")}
              className="bg-primary hover:bg-primary/90 text-black font-semibold text-xs md:text-sm"
            >
              <Gamepad2 className="h-4 w-4 mr-1 md:mr-2" />
              Entrar em visao tatica
            </Button>
          </div>
        </main>
      </div>
    )
  }
  
  // Visao Tatica view
  if (currentView === "visao_tatica") {
    return (
      <div className="h-screen pl-[72px] bg-gradient-to-br from-primary/20 via-[#0a0a0a] to-primary/10 flex flex-col overflow-hidden">
        <GameSidebar />
        <GameHeader team={userTeam} />
        
        <main className="flex-1 p-4 overflow-y-auto">
          {/* Sub-header */}
          <div className="flex items-center gap-4 md:gap-6 mb-6 flex-wrap">
            <Button 
              variant="ghost" 
              onClick={() => setCurrentView("menu")}
              className="text-white/60 hover:text-white"
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Elenco
            </Button>
            <h1 className="text-lg md:text-xl font-bold text-white">Visao Tatica</h1>
            <div className="hidden md:flex items-center gap-4 text-white/60">
              <span>Gestao de Auxiliares Tec.</span>
              <span>Predefinicoes Taticas</span>
            </div>
          </div>
          
          <div className="flex flex-col lg:flex-row gap-6">
            {/* Left panel - Tactical info */}
            <div className="lg:w-1/3 space-y-6">
              <div>
                <h2 className="text-sm text-white/60 uppercase tracking-wider mb-4">Visao tatica atual</h2>
                
                <div className="flex flex-col items-center text-center mb-6">
                  <Scale className="h-24 w-24 md:h-32 md:w-32 text-white/80 mb-4" />
                  <h3 className="text-2xl md:text-3xl font-bold text-white uppercase tracking-wider">Padrao</h3>
                </div>
                
                <p className="text-sm text-white/60 text-center leading-relaxed mb-6">
                  O seu time adota um estilo equilibrado, com foco em conservar uma estrutura tatica que de solidez defensiva sem abrir mao de levar perigo no ataque.
                </p>
                
                {/* Tactical categories */}
                <div className="space-y-3">
                  {["Ataque", "Meio-campo", "Defesa", "Gol"].map((cat) => (
                    <div key={cat} className="flex items-center justify-between p-3 rounded-lg bg-white/5">
                      <span className="text-white">{cat}</span>
                      <span className="text-white/40 text-sm">ND</span>
                    </div>
                  ))}
                </div>
                
                <Button variant="outline" className="w-full mt-4 border-white/20 text-white">
                  <Gamepad2 className="h-4 w-4 mr-2" />
                  Alterar visao
                </Button>
              </div>
            </div>
            
            {/* Right panel - Field with players */}
            <div className="lg:flex-1">
              <div className="flex items-center gap-2 mb-4">
                <X className="h-4 w-4 text-white/40" />
                <span className="text-sm text-white/60">Impacto em atleta</span>
              </div>
              
              <div 
                className="relative rounded-2xl overflow-hidden aspect-[4/3]"
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
                <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full" preserveAspectRatio="xMidYMid slice">
                  <g stroke="rgba(255,255,255,0.35)" strokeWidth="0.2" fill="none">
                    <rect x="3" y="3" width="94" height="94" rx="1" />
                    <line x1="3" y1="50" x2="97" y2="50" />
                    <circle cx="50" cy="50" r="10" />
                    <rect x="22" y="3" width="56" height="16" />
                    <rect x="22" y="81" width="56" height="16" />
                  </g>
                </svg>
                
                {/* Players */}
                {positionedPlayers.map((player) => (
                  <motion.button
                    key={player.id}
                    initial={false}
                    animate={{ left: `${player.x}%`, top: `${player.y}%` }}
                    transition={{ type: "spring", stiffness: 300, damping: 30 }}
                    onClick={() => setSelectedPlayerId(player.id)}
                    className={cn(
                      "absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center group z-10",
                      selectedPlayerId === player.id && "z-20"
                    )}
                  >
                    <div className={cn(
                      "px-2 py-0.5 rounded text-[8px] md:text-[9px] font-semibold mb-1 whitespace-nowrap transition-all",
                      selectedPlayerId === player.id
                        ? "bg-[#1db954] text-black"
                        : "bg-black/60 text-white/90"
                    )}>
                      {player.name.split(" ").pop()}
                    </div>
                    
                    <div className="relative">
                      {player.potential > player.overall + 3 && (
                        <div className="absolute -top-1 -left-1 h-3 w-3 md:h-4 md:w-4 rounded-full bg-[#1db954] flex items-center justify-center z-10">
                          <TrendingUp className="h-2 w-2 md:h-2.5 md:w-2.5 text-black" />
                        </div>
                      )}
                      
                      <PlayerAvatarCircle
                        name={player.name}
                        teamColor={userTeam.cor1}
                        size="sm"
                        className={cn(
                          "border-2 transition-all",
                          selectedPlayerId === player.id
                            ? "border-[#1db954] shadow-[0_0_12px_rgba(29,185,84,0.5)]"
                            : "border-white/30"
                        )}
                      />
                      
                      <div className={cn(
                        "absolute -bottom-1 -right-1 h-5 w-5 md:h-6 md:w-6 rounded-full flex items-center justify-center text-[9px] md:text-[10px] font-black",
                        "bg-gradient-to-br from-[#1a1a1a] to-[#0a0a0a] border",
                        selectedPlayerId === player.id ? "border-[#1db954]" : "border-white/30"
                      )}>
                        <span className={getOverallColor(player.overall)}>{player.overall}</span>
                      </div>
                    </div>
                  </motion.button>
                ))}
              </div>
            </div>
          </div>
          
          {/* Bottom controls */}
          <div className="fixed bottom-0 left-[72px] right-0 h-14 bg-[#0d0d0d] border-t border-white/10 flex items-center justify-between px-4 md:px-6">
            <div className="flex items-center gap-2 md:gap-4">
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => setCurrentView("menu")}
                className="text-white/60 hover:text-white text-xs md:text-sm"
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                Voltar
              </Button>
              <Button variant="ghost" size="sm" className="text-white/60 hover:text-white text-xs md:text-sm">
                <Info className="h-4 w-4 mr-1 md:mr-2" />
                <span className="hidden sm:inline">Exibir detalhes</span>
              </Button>
            </div>
            
            <Button
              onClick={() => setCurrentView("gerenciamento")}
              className="bg-primary/20 hover:bg-primary/30 text-primary text-xs md:text-sm"
            >
              Ir para gerenciamento do time
            </Button>
          </div>
        </main>
      </div>
    )
  }

  // Gerenciamento view (main view)
  return (
    <div className="h-screen overflow-hidden pl-[72px] bg-[#0a0a0a]">
      <GameSidebar />
      <GameHeader team={userTeam} />
      
      {/* Match notification toast - only shows during actual match simulations */}
      <AnimatePresence>
        {isMatchInProgress && showMatchNotification && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-16 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-4 py-3 rounded-xl bg-[#1a1a1a] border border-white/10 shadow-2xl"
          >
            <Clock className="h-5 w-5 text-white/60" />
            <div>
              <p className="text-sm font-semibold text-white">Partida Iniciada</p>
              <p className="text-xs text-white/50">{userTeam.nome} x Sao Paulo - Campeonato Brasileiro</p>
            </div>
            <button 
              onClick={() => setShowMatchNotification(false)}
              className="p-1 rounded-lg hover:bg-white/10 text-white/40 hover:text-white transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <main className="h-[calc(100vh-48px-56px)]">
        {/* Sub-header with tabs */}
        <div className="flex flex-col md:flex-row md:items-center justify-between px-3 md:px-6 py-2 md:py-3 border-b border-white/10 bg-[#0d0d0d] gap-2 md:gap-0">
          <div className="flex items-center gap-3 md:gap-6">
            <div className="flex items-center gap-2 md:gap-3">
              <TeamCrest team={userTeam} size="sm" />
              <div className="hidden sm:block">
                <h1 className="text-sm font-bold text-white">Gerenciamento do Time</h1>
                <p className="text-[10px] text-white/40">{userTeam.nome}</p>
              </div>
            </div>
            
            {/* Tabs */}
            <div className="flex items-center gap-1">
              {(["elenco", "taticas", "atribuicoes"] as const).map((tab) => (
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
                  {tab === "elenco" ? "Elenco" : tab === "taticas" ? "Taticas" : "Atribuicoes"}
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
            <div className="px-3 md:px-4 py-1.5 md:py-2 min-w-[80px] md:min-w-[100px] text-center rounded-lg bg-[#1db954]/20 border border-[#1db954]/30">
              <span className="text-base md:text-lg font-black text-white">{formation}</span>
            </div>
            <button 
              onClick={nextFormation}
              className="p-1.5 md:p-2 rounded-lg bg-white/5 hover:bg-white/10 text-white transition"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="flex flex-col lg:flex-row h-full">
          {/* Main content area */}
          <div className="flex-1 flex flex-col p-2 md:p-4 overflow-hidden">
            {/* Tab Content: Elenco */}
            {activeTab === "elenco" && (
            <>
            {/* Pitch area */}
            <div 
              ref={pitchRef}
              onDragOver={handleDragOver}
              onDrop={handleDropOnPitch}
              className="flex-1 relative rounded-xl md:rounded-2xl overflow-hidden min-h-[300px]" 
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
              <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full" preserveAspectRatio="xMidYMid slice">
                <g stroke="rgba(255,255,255,0.35)" strokeWidth="0.2" fill="none">
                  <rect x="3" y="3" width="94" height="94" rx="1" />
                  <line x1="3" y1="50" x2="97" y2="50" />
                  <circle cx="50" cy="50" r="10" />
                  <circle cx="50" cy="50" r="0.5" fill="rgba(255,255,255,0.35)" />
                  <rect x="22" y="3" width="56" height="16" />
                  <rect x="36" y="3" width="28" height="6" />
                  <circle cx="50" cy="11" r="0.5" fill="rgba(255,255,255,0.35)" />
                  <path d="M35 19 A 15 15 0 0 0 65 19" />
                  <rect x="22" y="81" width="56" height="16" />
                  <rect x="36" y="91" width="28" height="6" />
                  <circle cx="50" cy="89" r="0.5" fill="rgba(255,255,255,0.35)" />
                  <path d="M35 81 A 15 15 0 0 1 65 81" />
                  <rect x="42" y="0" width="16" height="3" stroke="rgba(255,255,255,0.5)" />
                  <rect x="42" y="97" width="16" height="3" stroke="rgba(255,255,255,0.5)" />
                </g>
              </svg>

              {/* Players on pitch */}
              {positionedPlayers.map((player) => (
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
                    top: `${player.y}%`,
                    scale: draggingPlayer === player.id ? 1.1 : dragOverTarget === player.id ? 1.15 : selectedPlayerId === player.id ? 1.05 : 1,
                    opacity: draggingPlayer === player.id ? 0.7 : 1,
                  }}
                  transition={{ type: "spring", stiffness: 400, damping: 30 }}
                  onClick={() => setSelectedPlayerId(player.id)}
                  className={cn(
                    "absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center cursor-grab active:cursor-grabbing group z-10",
                    selectedPlayerId === player.id && "z-20",
                    dragOverTarget === player.id && "ring-2 ring-[#1db954] ring-offset-2 ring-offset-transparent rounded-full"
                  )}
                >
                  {/* Player name tag */}
                  <div className={cn(
                    "px-1.5 md:px-2 py-0.5 rounded text-[8px] md:text-[9px] font-semibold mb-1 whitespace-nowrap transition-all",
                    selectedPlayerId === player.id
                      ? "bg-[#1db954] text-black"
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
                          ? "border-[#1db954] shadow-[0_0_12px_rgba(29,185,84,0.5)]"
                          : "border-white/30 group-hover:border-white/60"
                      )}
                    />
                    
                    {/* Overall badge */}
                    <div className={cn(
                      "absolute -bottom-1 -right-1 h-5 w-5 md:h-6 md:w-6 rounded-full flex items-center justify-center text-[9px] md:text-[10px] font-black",
                      "bg-gradient-to-br from-[#1a1a1a] to-[#0a0a0a] border",
                      selectedPlayerId === player.id ? "border-[#1db954]" : "border-white/30"
                    )}>
                      <span className={getOverallColor(player.overall)}>{player.overall}</span>
                    </div>
                    
                    {/* Potential indicator */}
                    {player.potential > player.overall + 3 && (
                      <div className="absolute -top-1 -left-1 h-3 w-3 md:h-4 md:w-4 rounded-full bg-[#1db954] flex items-center justify-center">
                        <TrendingUp className="h-2 w-2 md:h-2.5 md:w-2.5 text-black" />
                      </div>
                    )}
                  </div>
                </motion.div>
              ))}
              
              {/* Tactical instruction overlay */}
              <button 
                onClick={() => setBallInstruction(prev => prev === "sem_bola" ? "com_bola" : "sem_bola")}
                className="absolute bottom-2 md:bottom-4 left-2 md:left-4 flex items-center gap-2 px-2 md:px-3 py-1 md:py-1.5 rounded-lg bg-black/60 hover:bg-black/80 text-white/70 text-[10px] md:text-xs transition-colors border border-white/10"
              >
                <span>{ballInstruction === "sem_bola" ? "Sem a bola" : "Com a bola"}</span>
                <span className="text-white/40">|</span>
                <span className="text-[#1db954]">Trocar instrucao</span>
                <ChevronRight className="h-3 w-3 text-[#1db954]" />
              </button>
            </div>
            
            {/* Reserves section */}
            <div className="mt-2 p-2 md:p-3 rounded-xl bg-[#141414] border border-white/10">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xs font-semibold text-white">Reservas ({bench.length})</h3>
              </div>
              
              <div className="flex gap-2 flex-wrap">
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
                        "flex flex-col items-center p-1.5 rounded-lg cursor-grab active:cursor-grabbing transition-all",
                        selectedPlayerId === player.id
                          ? "bg-[#1db954]/20 border border-[#1db954]/50"
                          : "bg-white/5 border border-transparent hover:bg-white/10",
                        dragOverTarget === player.id && "ring-2 ring-[#1db954]"
                      )}
                    >
                      <div className="relative">
                        <PlayerAvatarCircle
                          name={player.name}
                          teamColor={userTeam.cor1}
                          size="xs"
                        />
                        <div className={cn(
                          "absolute -bottom-0.5 -right-0.5 px-1 py-0.5 rounded text-[7px] font-bold",
                          posColors.bg, posColors.text
                        )}>
                          {player.overall}
                        </div>
                      </div>
                      <span className="text-[9px] text-white/70 mt-1 truncate max-w-[50px]">{player.name.split(" ").pop()}</span>
                    </motion.div>
                  )
                })}
              </div>
            </div>
            </>
            )}

            {/* Tab Content: Taticas */}
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
                          {["Baixa", "Media", "Alta"].map(opt => (
                            <button key={opt} className={cn(
                              "flex-1 px-3 py-2 rounded-lg text-xs font-medium transition-all",
                              opt === "Media" ? "bg-[#1db954] text-black" : "bg-white/5 text-white/60 hover:bg-white/10"
                            )}>{opt}</button>
                          ))}
                        </div>
                      </div>
                      <div>
                        <label className="text-xs text-white/60 block mb-2">Marcacao</label>
                        <div className="flex gap-2">
                          {["Pressao", "Equilibrada", "Recuada"].map(opt => (
                            <button key={opt} className={cn(
                              "flex-1 px-3 py-2 rounded-lg text-xs font-medium transition-all",
                              opt === "Equilibrada" ? "bg-[#1db954] text-black" : "bg-white/5 text-white/60 hover:bg-white/10"
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
                        <label className="text-xs text-white/60 block mb-2">Estilo de Construcao</label>
                        <div className="flex gap-2">
                          {["Curto", "Misto", "Direto"].map(opt => (
                            <button key={opt} className={cn(
                              "flex-1 px-3 py-2 rounded-lg text-xs font-medium transition-all",
                              opt === "Misto" ? "bg-[#1db954] text-black" : "bg-white/5 text-white/60 hover:bg-white/10"
                            )}>{opt}</button>
                          ))}
                        </div>
                      </div>
                      <div>
                        <label className="text-xs text-white/60 block mb-2">Velocidade de Ataque</label>
                        <div className="flex gap-2">
                          {["Lento", "Normal", "Rapido"].map(opt => (
                            <button key={opt} className={cn(
                              "flex-1 px-3 py-2 rounded-lg text-xs font-medium transition-all",
                              opt === "Normal" ? "bg-[#1db954] text-black" : "bg-white/5 text-white/60 hover:bg-white/10"
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
                      {["Ultra Defensivo", "Defensivo", "Equilibrado", "Ofensivo", "Ultra Ofensivo"].map(opt => (
                        <button key={opt} className={cn(
                          "flex-1 px-3 py-2 rounded-lg text-xs font-medium transition-all",
                          opt === "Equilibrado" ? "bg-[#1db954] text-black" : "bg-white/5 text-white/60 hover:bg-white/10"
                        )}>{opt}</button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Tab Content: Atribuicoes */}
            {activeTab === "atribuicoes" && (
              <div className="flex-1 rounded-xl md:rounded-2xl bg-[#111111] border border-white/10 overflow-auto p-4 md:p-6">
                <div className="max-w-4xl mx-auto space-y-6">
                  <div>
                    <h2 className="text-lg font-bold text-white mb-2">Funcoes dos Jogadores</h2>
                    <p className="text-sm text-white/50">Defina funcoes especificas para cada jogador em campo</p>
                  </div>

                  {/* Set Pieces */}
                  <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                    <h3 className="text-sm font-semibold text-white mb-4">Bolas Paradas</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="flex items-center justify-between p-3 rounded-lg bg-white/5">
                        <span className="text-xs text-white/70">Cobrador de Escanteios</span>
                        <span className="text-xs font-medium text-[#1db954]">Eric Ramires</span>
                      </div>
                      <div className="flex items-center justify-between p-3 rounded-lg bg-white/5">
                        <span className="text-xs text-white/70">Cobrador de Faltas</span>
                        <span className="text-xs font-medium text-[#1db954]">Lincoln</span>
                      </div>
                      <div className="flex items-center justify-between p-3 rounded-lg bg-white/5">
                        <span className="text-xs text-white/70">Cobrador de Penaltis</span>
                        <span className="text-xs font-medium text-[#1db954]">Eduardo Sasha</span>
                      </div>
                      <div className="flex items-center justify-between p-3 rounded-lg bg-white/5">
                        <span className="text-xs text-white/70">Capitao</span>
                        <span className="text-xs font-medium text-[#1db954]">Pedro Henrique</span>
                      </div>
                    </div>
                  </div>

                  {/* Player Roles */}
                  <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                    <h3 className="text-sm font-semibold text-white mb-4">Funcoes Individuais</h3>
                    <div className="space-y-3">
                      {players.slice(0, 6).map(player => (
                        <div key={player.id} className="flex items-center gap-4 p-3 rounded-lg bg-white/5">
                          <PlayerAvatarCircle name={player.name} teamColor={userTeam.cor1} size="xs" />
                          <div className="flex-1">
                            <div className="text-sm font-medium text-white">{player.name}</div>
                            <div className="text-[10px] text-white/40">{player.position}</div>
                          </div>
                          <select className="bg-white/10 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-[#1db954]">
                            <option>{player.function}</option>
                            <option>Equilibrado</option>
                            <option>Ofensivo</option>
                            <option>Defensivo</option>
                          </select>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Right panel - Player details (hidden on mobile, shown in drawer) */}
          <aside className="hidden lg:block w-64 xl:w-72 flex-shrink-0 border-l border-white/10 bg-[#0d0d0d] overflow-hidden">
            {/* Player header */}
            <div className="p-3 md:p-4 border-b border-white/10" style={{
              background: `linear-gradient(135deg, ${userTeam.cor1}30 0%, transparent 100%)`
            }}>
              <div className="flex items-start gap-3 md:gap-4">
                <div className="text-right">
                  <div className={cn("text-3xl md:text-4xl font-black", getOverallColor(selectedPlayer.overall))}>
                    {selectedPlayer.overall}
                  </div>
                  <div className="text-[9px] md:text-[10px] text-white/40 font-medium">
                    {selectedPlayer.position} • {selectedPlayer.position === "ATA" || selectedPlayer.position === "PD" || selectedPlayer.position === "PE" ? "ATA" : selectedPlayer.position === "MEI" || selectedPlayer.position === "VOL" ? "MEI" : selectedPlayer.position === "ZAG" || selectedPlayer.position === "LD" || selectedPlayer.position === "LE" ? "DEF" : "GOL"}
                  </div>
                </div>
                <div className="flex-1">
                  <h2 className="text-lg md:text-xl font-bold text-white uppercase">{selectedPlayer.name}</h2>
                </div>
              </div>
            </div>
            
            {/* Player info */}
            <div className="p-3 md:p-4 space-y-3 md:space-y-4">
              <div>
                <h3 className="text-[10px] md:text-xs font-semibold text-white/60 uppercase tracking-wider mb-2 md:mb-3">
                  Informacoes do atleta
                </h3>
                
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] md:text-xs text-white/50">Energia</span>
                    <div className="flex items-center gap-2">
                      <div className="w-20 md:w-24 h-1.5 rounded-full bg-white/10 overflow-hidden">
                        <motion.div 
                          className="h-full bg-[#1db954] rounded-full"
                          initial={{ width: 0 }}
                          animate={{ width: `${selectedPlayer.energy}%` }}
                          transition={{ duration: 0.5 }}
                        />
                      </div>
                      <span className="text-[10px] md:text-xs font-medium text-[#1db954]">{selectedPlayer.energy}%</span>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-x-3 md:gap-x-4 gap-y-1.5 md:gap-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] md:text-xs text-white/50">Ritmo de jogo</span>
                      <span className={cn("text-[10px] md:text-xs font-medium", getStatColor(selectedPlayer.rhythm))}>
                        {selectedPlayer.rhythm}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] md:text-xs text-white/50">Idade</span>
                      <span className="text-[10px] md:text-xs font-medium text-white">{selectedPlayer.age}</span>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] md:text-xs text-white/50">Moral</span>
                      <span className={cn("text-[10px] md:text-xs font-medium flex items-center gap-1", getMoralColor(selectedPlayer.moral))}>
                        {selectedPlayer.moral}
                        {selectedPlayer.moral === "Feliz" && <Smile className="h-3 w-3" />}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] md:text-xs text-white/50">Ritmo</span>
                      <span className={cn("text-[10px] md:text-xs font-medium", getStatColor(selectedPlayer.pace))}>
                        {selectedPlayer.pace}
                      </span>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] md:text-xs text-white/50">Perna</span>
                      <span className="text-[10px] md:text-xs font-medium text-white">{selectedPlayer.foot}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] md:text-xs text-white/50">Finaliz.</span>
                      <span className={cn("text-[10px] md:text-xs font-medium", getStatColor(selectedPlayer.shooting))}>
                        {selectedPlayer.shooting}
                      </span>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] md:text-xs text-white/50">t. aceleracao</span>
                      <span className="text-[10px] md:text-xs font-medium text-white">{selectedPlayer.acceleration}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] md:text-xs text-white/50">Passes</span>
                      <span className={cn("text-[10px] md:text-xs font-medium", getStatColor(selectedPlayer.passing))}>
                        {selectedPlayer.passing}
                        {selectedPlayer.passing >= 80 && <span className="text-[#1db954] ml-0.5">+1</span>}
                      </span>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] md:text-xs text-white/50">Funcao</span>
                      <span className="text-[10px] md:text-xs font-medium text-white truncate max-w-[60px]">{selectedPlayer.function}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] md:text-xs text-white/50">Conducao</span>
                      <span className={cn("text-[10px] md:text-xs font-medium", getStatColor(selectedPlayer.dribbling))}>
                        {selectedPlayer.dribbling}
                      </span>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] md:text-xs text-white/50">Foco</span>
                      <span className="text-[10px] md:text-xs font-medium text-white">{selectedPlayer.focus}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] md:text-xs text-white/50">Defesa</span>
                      <span className={cn("text-[10px] md:text-xs font-medium", getStatColor(selectedPlayer.defending))}>
                        {selectedPlayer.defending}
                      </span>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] md:text-xs text-white/50">Altura</span>
                      <span className="text-[10px] md:text-xs font-medium text-white">{selectedPlayer.height} cm</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] md:text-xs text-white/50">Fisico</span>
                      <span className={cn("text-[10px] md:text-xs font-medium", getStatColor(selectedPlayer.physical))}>
                        {selectedPlayer.physical}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Playstyles */}
              <div className="pt-3 md:pt-4 border-t border-white/10">
                <h3 className="text-[10px] md:text-xs font-semibold text-white/60 uppercase tracking-wider mb-2 md:mb-3">
                  Estilos de jogo
                </h3>
                
                <div className="flex items-center justify-between">
                  <span className="text-[10px] md:text-xs text-white/50">Fintas</span>
                  <div className="flex items-center gap-0.5">
                    {getStarRating(selectedPlayer.fintas)}
                  </div>
                </div>
              </div>
              
              {/* Actions */}
              <div className="pt-3 md:pt-4 border-t border-white/10 space-y-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowSubstitutionModal(true)}
                  className="w-full border-white/10 text-white/70 hover:text-white hover:bg-white/10 text-xs"
                >
                  <ArrowLeftRight className="h-4 w-4 mr-2" />
                  Substituir
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowPlayerProfile(true)}
                  className="w-full border-white/10 text-white/70 hover:text-white hover:bg-white/10 text-xs"
                >
                  <Info className="h-4 w-4 mr-2" />
                  Ver Perfil Completo
                </Button>
              </div>
            </div>
          </aside>
        </div>
      </main>
      
      {/* Bottom action bar */}
      <div className="fixed bottom-0 left-[72px] right-0 h-12 md:h-14 bg-[#0d0d0d] border-t border-white/10 flex items-center justify-between px-2 md:px-6">
        <div className="flex items-center gap-1 md:gap-4">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => setCurrentView("menu")}
            className="text-white/60 hover:text-white text-[10px] md:text-sm px-2 md:px-3"
          >
            <ChevronLeft className="h-3 w-3 md:h-4 md:w-4 mr-0.5 md:mr-1" />
            <span className="hidden sm:inline">Voltar</span>
          </Button>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => setCurrentView("visao_tatica")}
            className="text-white/60 hover:text-white text-[10px] md:text-sm px-2 md:px-3"
          >
            <RotateCcw className="h-3 w-3 md:h-4 md:w-4 mr-0.5 md:mr-1" />
            <span className="hidden md:inline">Editar tatica ativa</span>
          </Button>
        </div>
        
        <div className="flex items-center gap-1 md:gap-4">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => setShowSuggestedSubs(true)}
            className="text-white/60 hover:text-white text-[10px] md:text-sm px-2 md:px-3"
          >
            <Shuffle className="h-3 w-3 md:h-4 md:w-4 mr-0.5 md:mr-1" />
            <span className="hidden sm:inline">Substituicoes sugeridas</span>
          </Button>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => setShowSubstitutionModal(true)}
            className="text-white/60 hover:text-white text-[10px] md:text-sm px-2 md:px-3 hidden sm:flex"
          >
            <ArrowLeftRight className="h-3 w-3 md:h-4 md:w-4 mr-0.5 md:mr-1" />
            <span>Substituicoes rapidas</span>
          </Button>
          <div className="w-px h-4 md:h-6 bg-white/10 hidden md:block" />
          <Button variant="ghost" size="sm" className="text-white/60 hover:text-white text-[10px] md:text-sm px-2 md:px-3 hidden md:flex">
            Rolagem
          </Button>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => setShowTutorials(true)}
            className="text-white/60 hover:text-white text-[10px] md:text-sm px-2 md:px-3"
          >
            <Info className="h-3 w-3 md:h-4 md:w-4 sm:mr-1" />
            <span className="hidden sm:inline">Tutoriais</span>
          </Button>
        </div>
      </div>
      
      {/* Substitution Modal */}
      <AnimatePresence>
        {showSubstitutionModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowSubstitutionModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-[#1a1a1a] rounded-2xl border border-white/10 p-6 max-w-lg w-full"
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-white">Substituir Jogador</h2>
                <button onClick={() => setShowSubstitutionModal(false)} className="p-2 rounded-lg hover:bg-white/10">
                  <X className="h-5 w-5 text-white/60" />
                </button>
              </div>
              <p className="text-sm text-white/60 mb-4">
                Arraste jogadores entre o campo e os reservas para fazer substituicoes, ou selecione um jogador abaixo:
              </p>
              <div className="grid grid-cols-2 gap-2 max-h-60 overflow-y-auto">
                {bench.map((player) => (
                  <button
                    key={player.id}
                    onClick={() => {
                      // Swap selected player with this bench player
                      const selectedInField = players.find(p => p.id === selectedPlayerId)
                      if (selectedInField) {
                        setPlayers(prev => prev.map(p => p.id === selectedPlayerId ? player : p))
                        setBench(prev => prev.map(p => p.id === player.id ? selectedInField : p))
                        setShowSubstitutionModal(false)
                      }
                    }}
                    className="flex items-center gap-2 p-3 rounded-lg bg-white/5 hover:bg-white/10 transition-colors text-left"
                  >
                    <PlayerAvatarCircle name={player.name} teamColor={userTeam.cor1} size="xs" />
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium text-white truncate">{player.name}</div>
                      <div className="text-[10px] text-white/40">{player.position}</div>
                    </div>
                    <span className={cn("text-sm font-bold", getOverallColor(player.overall))}>{player.overall}</span>
                  </button>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* Player Profile Modal */}
      <AnimatePresence>
        {showPlayerProfile && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowPlayerProfile(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-[#1a1a1a] rounded-2xl border border-white/10 p-6 max-w-md w-full"
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-white">Perfil do Jogador</h2>
                <button onClick={() => setShowPlayerProfile(false)} className="p-2 rounded-lg hover:bg-white/10">
                  <X className="h-5 w-5 text-white/60" />
                </button>
              </div>
              <div className="flex items-center gap-4 mb-6">
                <PlayerAvatarCircle name={selectedPlayer.name} teamColor={userTeam.cor1} size="lg" />
                <div>
                  <h3 className="text-xl font-bold text-white">{selectedPlayer.name}</h3>
                  <p className="text-sm text-white/50">{selectedPlayer.position} - {selectedPlayer.age} anos</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={cn("text-2xl font-black", getOverallColor(selectedPlayer.overall))}>{selectedPlayer.overall}</span>
                    <span className="text-xs text-white/40">OVR</span>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: "Ritmo", value: selectedPlayer.pace },
                  { label: "Finaliz.", value: selectedPlayer.shooting },
                  { label: "Passe", value: selectedPlayer.passing },
                  { label: "Drible", value: selectedPlayer.dribbling },
                  { label: "Defesa", value: selectedPlayer.defending },
                  { label: "Fisico", value: selectedPlayer.physical },
                ].map(stat => (
                  <div key={stat.label} className="p-3 rounded-lg bg-white/5 text-center">
                    <div className={cn("text-lg font-bold", getStatColor(stat.value))}>{stat.value}</div>
                    <div className="text-[10px] text-white/40">{stat.label}</div>
                  </div>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* Tutorials Modal */}
      <AnimatePresence>
        {showTutorials && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowTutorials(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-[#1a1a1a] rounded-2xl border border-white/10 p-6 max-w-md w-full"
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-white">Tutoriais</h2>
                <button onClick={() => setShowTutorials(false)} className="p-2 rounded-lg hover:bg-white/10">
                  <X className="h-5 w-5 text-white/60" />
                </button>
              </div>
              <div className="space-y-3">
                <div className="p-3 rounded-lg bg-white/5">
                  <h3 className="text-sm font-medium text-white mb-1">Arrastar jogadores</h3>
                  <p className="text-xs text-white/50">Arraste jogadores no campo para reposiciona-los ou troca-los com reservas.</p>
                </div>
                <div className="p-3 rounded-lg bg-white/5">
                  <h3 className="text-sm font-medium text-white mb-1">Trocar formacao</h3>
                  <p className="text-xs text-white/50">Use as setas ao lado da formacao para alterar entre diferentes esquemas taticos.</p>
                </div>
                <div className="p-3 rounded-lg bg-white/5">
                  <h3 className="text-sm font-medium text-white mb-1">Ver detalhes</h3>
                  <p className="text-xs text-white/50">Clique em um jogador para ver seus atributos no painel lateral.</p>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* Suggested Substitutions Modal */}
      <AnimatePresence>
        {showSuggestedSubs && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowSuggestedSubs(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-[#1a1a1a] rounded-2xl border border-white/10 p-6 max-w-md w-full"
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-white">Substituicoes Sugeridas</h2>
                <button onClick={() => setShowSuggestedSubs(false)} className="p-2 rounded-lg hover:bg-white/10">
                  <X className="h-5 w-5 text-white/60" />
                </button>
              </div>
              <div className="space-y-3">
                {players.filter(p => p.energy < 80).slice(0, 3).map(tiredPlayer => {
                  const replacement = bench.find(b => b.position === tiredPlayer.position) || bench[0]
                  return (
                    <button
                      key={tiredPlayer.id}
                      onClick={() => {
                        setPlayers(prev => prev.map(p => p.id === tiredPlayer.id ? replacement : p))
                        setBench(prev => prev.map(p => p.id === replacement.id ? tiredPlayer : p))
                        setShowSuggestedSubs(false)
                      }}
                      className="w-full flex items-center gap-3 p-3 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <PlayerAvatarCircle name={tiredPlayer.name} teamColor={userTeam.cor1} size="xs" />
                        <div className="text-left">
                          <div className="text-xs text-white">{tiredPlayer.name}</div>
                          <div className="text-[10px] text-red-400">{tiredPlayer.energy}% energia</div>
                        </div>
                      </div>
                      <ArrowLeftRight className="h-4 w-4 text-white/40" />
                      <div className="flex items-center gap-2">
                        <PlayerAvatarCircle name={replacement.name} teamColor={userTeam.cor1} size="xs" />
                        <div className="text-left">
                          <div className="text-xs text-white">{replacement.name}</div>
                          <div className="text-[10px] text-green-400">{replacement.energy}% energia</div>
                        </div>
                      </div>
                    </button>
                  )
                })}
                {players.filter(p => p.energy < 80).length === 0 && (
                  <p className="text-sm text-white/50 text-center py-4">
                    Nenhuma substituicao sugerida no momento. Todos os jogadores estao com energia adequada.
                  </p>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
