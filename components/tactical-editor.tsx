"use client"

import { useState, useRef, useCallback, useContext } from "react"
import { X, Save, RotateCcw, ChevronDown, Users, Shuffle, ArrowLeftRight, ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { TeamCrest } from "@/components/team-crest"
import { ControllerButton, ControllerToolbar } from "@/components/controller-buttons"
import { cn } from "@/lib/utils"
import { type Team } from "@/lib/teams-data"
import { ControllerTypeContext } from "@/components/controller-buttons"

// Posicoes de jogadores no campo
type Position = {
  id: number
  name: string
  number: number
  position: string
  rating: number
  x: number
  y: number
  photo?: string
}

// Formacoes predefinidas - EA FC style
const FORMATIONS: Record<string, { name: string; positions: { pos: string; x: number; y: number }[] }> = {
  "4-3-3": {
    name: "4-3-3",
    positions: [
      { pos: "GOL", x: 50, y: 90 },
      { pos: "LD", x: 85, y: 72 },
      { pos: "ZAG", x: 65, y: 75 },
      { pos: "ZAG", x: 35, y: 75 },
      { pos: "LE", x: 15, y: 72 },
      { pos: "VOL", x: 50, y: 55 },
      { pos: "MEI", x: 75, y: 45 },
      { pos: "MEI", x: 25, y: 45 },
      { pos: "PD", x: 78, y: 20 },
      { pos: "ATA", x: 50, y: 12 },
      { pos: "PE", x: 22, y: 20 },
    ],
  },
  "4-4-2": {
    name: "4-4-2",
    positions: [
      { pos: "GOL", x: 50, y: 90 },
      { pos: "LD", x: 85, y: 72 },
      { pos: "ZAG", x: 65, y: 75 },
      { pos: "ZAG", x: 35, y: 75 },
      { pos: "LE", x: 15, y: 72 },
      { pos: "MD", x: 85, y: 48 },
      { pos: "VOL", x: 60, y: 52 },
      { pos: "VOL", x: 40, y: 52 },
      { pos: "ME", x: 15, y: 48 },
      { pos: "ATA", x: 60, y: 15 },
      { pos: "ATA", x: 40, y: 15 },
    ],
  },
  "3-5-2": {
    name: "3-5-2",
    positions: [
      { pos: "GOL", x: 50, y: 90 },
      { pos: "ZAG", x: 75, y: 75 },
      { pos: "ZAG", x: 50, y: 78 },
      { pos: "ZAG", x: 25, y: 75 },
      { pos: "ALD", x: 90, y: 50 },
      { pos: "VOL", x: 65, y: 55 },
      { pos: "MEI", x: 50, y: 42 },
      { pos: "VOL", x: 35, y: 55 },
      { pos: "ALE", x: 10, y: 50 },
      { pos: "ATA", x: 60, y: 15 },
      { pos: "ATA", x: 40, y: 15 },
    ],
  },
  "4-2-3-1": {
    name: "4-2-3-1",
    positions: [
      { pos: "GOL", x: 50, y: 90 },
      { pos: "LD", x: 85, y: 72 },
      { pos: "ZAG", x: 65, y: 75 },
      { pos: "ZAG", x: 35, y: 75 },
      { pos: "LE", x: 15, y: 72 },
      { pos: "VOL", x: 60, y: 58 },
      { pos: "VOL", x: 40, y: 58 },
      { pos: "PD", x: 80, y: 35 },
      { pos: "MEI", x: 50, y: 32 },
      { pos: "PE", x: 20, y: 35 },
      { pos: "ATA", x: 50, y: 12 },
    ],
  },
  "5-3-2": {
    name: "5-3-2",
    positions: [
      { pos: "GOL", x: 50, y: 90 },
      { pos: "ALD", x: 90, y: 62 },
      { pos: "ZAG", x: 70, y: 75 },
      { pos: "ZAG", x: 50, y: 78 },
      { pos: "ZAG", x: 30, y: 75 },
      { pos: "ALE", x: 10, y: 62 },
      { pos: "MEI", x: 70, y: 45 },
      { pos: "VOL", x: 50, y: 52 },
      { pos: "MEI", x: 30, y: 45 },
      { pos: "ATA", x: 60, y: 15 },
      { pos: "ATA", x: 40, y: 15 },
    ],
  },
  "4-1-4-1": {
    name: "4-1-4-1",
    positions: [
      { pos: "GOL", x: 50, y: 90 },
      { pos: "LD", x: 85, y: 72 },
      { pos: "ZAG", x: 65, y: 75 },
      { pos: "ZAG", x: 35, y: 75 },
      { pos: "LE", x: 15, y: 72 },
      { pos: "VOL", x: 50, y: 60 },
      { pos: "MD", x: 85, y: 42 },
      { pos: "MEI", x: 65, y: 38 },
      { pos: "MEI", x: 35, y: 38 },
      { pos: "ME", x: 15, y: 42 },
      { pos: "ATA", x: 50, y: 12 },
    ],
  },
}

// Jogadores iniciais mockados
const DEFAULT_STARTERS: Omit<Position, "x" | "y">[] = [
  { id: 1, name: "Silva", number: 1, position: "GOL", rating: 78 },
  { id: 2, name: "Santos", number: 2, position: "LD", rating: 74 },
  { id: 3, name: "Oliveira", number: 3, position: "ZAG", rating: 77 },
  { id: 4, name: "Costa", number: 4, position: "ZAG", rating: 76 },
  { id: 5, name: "Ferreira", number: 6, position: "LE", rating: 73 },
  { id: 6, name: "Souza", number: 5, position: "VOL", rating: 76 },
  { id: 7, name: "Almeida", number: 8, position: "MEI", rating: 78 },
  { id: 8, name: "Rodrigues", number: 10, position: "MEI", rating: 82 },
  { id: 9, name: "Lima", number: 7, position: "PE", rating: 79 },
  { id: 10, name: "Pereira", number: 9, position: "ATA", rating: 84 },
  { id: 11, name: "Martins", number: 11, position: "PD", rating: 78 },
]

const DEFAULT_BENCH = [
  { id: 12, name: "Gomes", number: 12, position: "GOL", rating: 70 },
  { id: 13, name: "Ribeiro", number: 13, position: "ZAG", rating: 71 },
  { id: 14, name: "Araujo", number: 14, position: "VOL", rating: 73 },
  { id: 15, name: "Barbosa", number: 15, position: "MEI", rating: 74 },
  { id: 16, name: "Carvalho", number: 16, position: "ATA", rating: 76 },
  { id: 17, name: "Tavares", number: 17, position: "PD", rating: 72 },
  { id: 18, name: "Mendes", number: 18, position: "MEI", rating: 71 },
]

// Rating color helper
function getRatingColor(rating: number): string {
  if (rating >= 85) return "from-[#d4af37] to-[#ffd700]" // Gold
  if (rating >= 80) return "from-[#1db954] to-[#2ecc71]" // Green
  if (rating >= 75) return "from-[#3498db] to-[#5dade2]" // Blue
  if (rating >= 70) return "from-[#9b59b6] to-[#bb6bd9]" // Purple
  return "from-[#7f8c8d] to-[#95a5a6]" // Gray
}

interface TacticalEditorProps {
  team: Team
  onClose: () => void
  onSave?: (formation: string, players: Position[]) => void
}

export function TacticalEditor({ team, onClose, onSave }: TacticalEditorProps) {
  const controllerType = useContext(ControllerTypeContext)
  const [formation, setFormation] = useState("4-3-3")
  const [showFormationMenu, setShowFormationMenu] = useState(false)
  const [players, setPlayers] = useState<Position[]>(() => {
    const formationData = FORMATIONS[formation]
    return DEFAULT_STARTERS.map((p, i) => ({
      ...p,
      x: formationData.positions[i]?.x || 50,
      y: formationData.positions[i]?.y || 50,
    }))
  })
  const [bench] = useState(DEFAULT_BENCH)
  const [draggingId, setDraggingId] = useState<number | null>(null)
  const [selectedPlayer, setSelectedPlayer] = useState<number | null>(null)
  const [activeTab, setActiveTab] = useState<"formation" | "tactics" | "attributes">("formation")
  const pitchRef = useRef<HTMLDivElement>(null)

  const formationKeys = Object.keys(FORMATIONS)
  const currentFormationIndex = formationKeys.indexOf(formation)

  // Aplicar nova formacao
  const applyFormation = (formationKey: string) => {
    const formationData = FORMATIONS[formationKey]
    if (!formationData) return
    
    setPlayers(prev => prev.map((p, i) => ({
      ...p,
      x: formationData.positions[i]?.x || 50,
      y: formationData.positions[i]?.y || 50,
    })))
    setFormation(formationKey)
    setShowFormationMenu(false)
  }

  const nextFormation = () => {
    const nextIndex = (currentFormationIndex + 1) % formationKeys.length
    applyFormation(formationKeys[nextIndex])
  }

  const prevFormation = () => {
    const prevIndex = (currentFormationIndex - 1 + formationKeys.length) % formationKeys.length
    applyFormation(formationKeys[prevIndex])
  }

  const resetPositions = () => {
    applyFormation(formation)
  }

  const shufflePlayers = () => {
    setPlayers(prev => {
      const goalkeeper = prev[0]
      const fieldPlayers = [...prev.slice(1)]
      for (let i = fieldPlayers.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1))
        const tempPos = { x: fieldPlayers[i].x, y: fieldPlayers[i].y }
        fieldPlayers[i].x = fieldPlayers[j].x
        fieldPlayers[i].y = fieldPlayers[j].y
        fieldPlayers[j].x = tempPos.x
        fieldPlayers[j].y = tempPos.y
      }
      return [goalkeeper, ...fieldPlayers]
    })
  }

  const handleDragStart = useCallback((id: number) => {
    setDraggingId(id)
    setSelectedPlayer(id)
  }, [])

  const handleDrag = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    if (!draggingId || !pitchRef.current) return
    
    const rect = pitchRef.current.getBoundingClientRect()
    let clientX: number, clientY: number
    
    if ("touches" in e) {
      clientX = e.touches[0].clientX
      clientY = e.touches[0].clientY
    } else {
      clientX = e.clientX
      clientY = e.clientY
    }
    
    const x = Math.max(5, Math.min(95, ((clientX - rect.left) / rect.width) * 100))
    const y = Math.max(5, Math.min(95, ((clientY - rect.top) / rect.height) * 100))
    
    setPlayers(prev => prev.map(p => 
      p.id === draggingId ? { ...p, x, y } : p
    ))
  }, [draggingId])

  const handleDragEnd = useCallback(() => {
    setDraggingId(null)
  }, [])

  const handleSave = () => {
    onSave?.(formation, players)
    onClose()
  }

  const selectedPlayerData = players.find(p => p.id === selectedPlayer)

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#0a0a0a]">
      {/* Header - EA FC style */}
      <header className="flex items-center justify-between h-14 px-6 border-b border-white/10 bg-[#0d0d0d]">
        <div className="flex items-center gap-4">
          <button
            onClick={onClose}
            className="flex items-center gap-2 text-white/60 hover:text-white transition"
          >
            <ChevronLeft className="h-5 w-5" />
            <span className="text-sm font-medium">Voltar</span>
          </button>
          <div className="w-px h-6 bg-white/10" />
          <div className="flex items-center gap-3">
            <TeamCrest team={team} size="sm" />
            <div>
              <h1 className="text-sm font-bold text-white">Escalacao</h1>
              <div className="text-[10px] text-white/40">{team.nome}</div>
            </div>
          </div>
        </div>

        {/* Tab navigation */}
        <div className="flex items-center gap-1 bg-white/5 rounded-lg p-1">
          {(["formation", "tactics", "attributes"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                "px-4 py-1.5 rounded-md text-xs font-medium transition-all",
                activeTab === tab
                  ? "bg-[#1db954] text-black"
                  : "text-white/60 hover:text-white hover:bg-white/5"
              )}
            >
              {tab === "formation" ? "Formacao" : tab === "tactics" ? "Taticas" : "Atributos"}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={resetPositions}
            className="border-white/10 bg-transparent text-white/70 hover:bg-white/5"
          >
            <RotateCcw className="mr-1 h-3.5 w-3.5" />
            Resetar
          </Button>
          <Button
            size="sm"
            onClick={handleSave}
            className="bg-[#1db954] text-black hover:bg-[#1ed760] font-bold"
          >
            <Save className="mr-1 h-3.5 w-3.5" />
            Confirmar
          </Button>
        </div>
      </header>

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left panel - Players list */}
        <aside className="w-72 flex-shrink-0 border-r border-white/10 bg-[#0d0d0d] flex flex-col">
          {/* Formation selector */}
          <div className="p-4 border-b border-white/10">
            <div className="text-[10px] font-medium text-white/40 uppercase tracking-wider mb-2">
              Formacao
            </div>
            <div className="flex items-center justify-between">
              <button 
                onClick={prevFormation}
                className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-white transition"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                onClick={() => setShowFormationMenu(!showFormationMenu)}
                className="flex-1 mx-2 px-4 py-2.5 rounded-lg bg-gradient-to-r from-[#1db954]/20 to-[#1db954]/10 border border-[#1db954]/30 text-xl font-black text-white hover:from-[#1db954]/30 hover:to-[#1db954]/20 transition"
              >
                {formation}
              </button>
              <button 
                onClick={nextFormation}
                className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-white transition"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
            
            {showFormationMenu && (
              <div className="absolute left-4 right-4 mt-2 rounded-lg bg-[#1a1a1a] border border-white/10 overflow-hidden z-10 shadow-xl">
                {formationKeys.map(f => (
                  <button
                    key={f}
                    onClick={() => applyFormation(f)}
                    className={cn(
                      "w-full px-4 py-3 text-sm text-left transition flex items-center justify-between",
                      f === formation 
                        ? "bg-[#1db954] text-black font-semibold" 
                        : "text-white/70 hover:bg-white/5"
                    )}
                  >
                    <span className="font-bold">{FORMATIONS[f].name}</span>
                    {f === formation && (
                      <span className="text-[10px] bg-black/20 px-2 py-0.5 rounded">ATUAL</span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Starters list */}
          <div className="flex-1 overflow-y-auto">
            <div className="p-3">
              <div className="text-[10px] font-medium text-white/40 uppercase tracking-wider mb-2 flex items-center justify-between">
                <span>Titulares</span>
                <span className="text-[#1db954]">11/11</span>
              </div>
              <div className="space-y-1">
                {players.map(p => (
                  <button
                    key={p.id}
                    onClick={() => setSelectedPlayer(p.id === selectedPlayer ? null : p.id)}
                    className={cn(
                      "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-all",
                      selectedPlayer === p.id 
                        ? "bg-[#1db954]/20 border border-[#1db954]/50" 
                        : "hover:bg-white/5 border border-transparent"
                    )}
                  >
                    {/* Player number circle */}
                    <div
                      className="h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold shadow-lg"
                      style={{ backgroundColor: team.cor1, color: team.cor2 }}
                    >
                      {p.number}
                    </div>
                    
                    {/* Player info */}
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-white truncate">{p.name}</div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-white/40 font-medium">{p.position}</span>
                        {selectedPlayer === p.id && (
                          <span className="text-[9px] bg-[#1db954]/30 text-[#1db954] px-1.5 rounded">
                            SELECIONADO
                          </span>
                        )}
                      </div>
                    </div>
                    
                    {/* Rating badge */}
                    <div className={cn(
                      "h-7 w-7 rounded flex items-center justify-center text-xs font-black text-white bg-gradient-to-br",
                      getRatingColor(p.rating)
                    )}>
                      {p.rating}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Bench */}
          <div className="border-t border-white/10 p-3">
            <div className="text-[10px] font-medium text-white/40 uppercase tracking-wider mb-2 flex items-center gap-1">
              <Users className="h-3 w-3" />
              <span>Reservas ({bench.length})</span>
            </div>
            <div className="flex gap-1.5 overflow-x-auto pb-1">
              {bench.map(p => (
                <div
                  key={p.id}
                  className="flex-shrink-0 flex flex-col items-center p-2 rounded-lg bg-white/5 hover:bg-white/10 transition cursor-pointer min-w-[52px]"
                  title={`${p.name} (${p.position}) - ${p.rating}`}
                >
                  <div
                    className="h-7 w-7 rounded-full flex items-center justify-center text-[10px] font-bold mb-1"
                    style={{ backgroundColor: team.cor1, color: team.cor2 }}
                  >
                    {p.number}
                  </div>
                  <div className="text-[9px] text-white/60 truncate max-w-[48px] text-center">{p.name}</div>
                  <div className={cn(
                    "mt-1 text-[9px] font-bold px-1.5 py-0.5 rounded bg-gradient-to-r",
                    getRatingColor(p.rating)
                  )}>
                    {p.rating}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </aside>

        {/* Center - Pitch */}
        <main className="flex-1 flex items-center justify-center p-6 bg-[#0a0a0a] overflow-hidden">
          <div
            ref={pitchRef}
            className="relative w-full max-w-2xl aspect-[3/4] rounded-2xl overflow-hidden select-none shadow-2xl"
            style={{
              background: `linear-gradient(180deg, oklch(0.42 0.14 145), oklch(0.32 0.11 145))`,
            }}
            onMouseMove={draggingId ? handleDrag : undefined}
            onMouseUp={handleDragEnd}
            onMouseLeave={handleDragEnd}
            onTouchMove={draggingId ? handleDrag : undefined}
            onTouchEnd={handleDragEnd}
          >
            {/* Pitch stripes */}
            <div
              className="absolute inset-0 opacity-20"
              style={{
                backgroundImage:
                  "repeating-linear-gradient(0deg, transparent 0 8%, rgba(0,0,0,0.15) 8% 16%)",
              }}
            />
            
            {/* Pitch markings */}
            <svg
              viewBox="0 0 100 100"
              className="absolute inset-0 h-full w-full"
              preserveAspectRatio="xMidYMid slice"
            >
              <g stroke="rgba(255,255,255,0.45)" strokeWidth="0.25" fill="none">
                <rect x="3" y="3" width="94" height="94" rx="1" />
                <line x1="3" y1="50" x2="97" y2="50" />
                <circle cx="50" cy="50" r="10" />
                <circle cx="50" cy="50" r="0.6" fill="rgba(255,255,255,0.45)" />
                <rect x="22" y="3" width="56" height="16" />
                <rect x="36" y="3" width="28" height="6" />
                <circle cx="50" cy="11" r="0.6" fill="rgba(255,255,255,0.45)" />
                <path d="M35 19 A 15 15 0 0 0 65 19" />
                <rect x="22" y="81" width="56" height="16" />
                <rect x="36" y="91" width="28" height="6" />
                <circle cx="50" cy="89" r="0.6" fill="rgba(255,255,255,0.45)" />
                <path d="M35 81 A 15 15 0 0 1 65 81" />
                <rect x="42" y="0" width="16" height="3" stroke="rgba(255,255,255,0.7)" />
                <rect x="42" y="97" width="16" height="3" stroke="rgba(255,255,255,0.7)" />
              </g>
            </svg>

            {/* Players */}
            {players.map(p => (
              <div
                key={p.id}
                className={cn(
                  "absolute -translate-x-1/2 -translate-y-1/2 cursor-grab active:cursor-grabbing group",
                  draggingId === p.id && "z-20 scale-110",
                  selectedPlayer === p.id && "z-10"
                )}
                style={{ left: `${p.x}%`, top: `${p.y}%` }}
                onMouseDown={() => handleDragStart(p.id)}
                onTouchStart={() => handleDragStart(p.id)}
              >
                {/* Selection glow */}
                {selectedPlayer === p.id && (
                  <div className="absolute inset-0 -m-3 rounded-full bg-[#1db954]/30 blur-md animate-pulse" />
                )}
                
                {/* Player circle */}
                <div
                  className={cn(
                    "relative h-12 w-12 rounded-full flex flex-col items-center justify-center shadow-xl border-[3px] transition-transform",
                    selectedPlayer === p.id ? "border-[#1db954]" : "border-white/50"
                  )}
                  style={{
                    backgroundColor: team.cor1,
                    color: team.cor2,
                  }}
                >
                  <span className="text-sm font-black leading-none">{p.number}</span>
                </div>
                
                {/* Player name */}
                <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1 whitespace-nowrap">
                  <div className={cn(
                    "px-2 py-1 rounded-md text-[11px] font-semibold text-center shadow-lg",
                    selectedPlayer === p.id
                      ? "bg-[#1db954] text-black"
                      : "bg-black/80 text-white"
                  )}>
                    {p.name}
                  </div>
                </div>
                
                {/* Rating badge */}
                <div className={cn(
                  "absolute -top-1 -right-1 h-6 w-6 rounded-md flex items-center justify-center text-[10px] font-black text-white shadow-lg bg-gradient-to-br",
                  getRatingColor(p.rating)
                )}>
                  {p.rating}
                </div>
                
                {/* Position indicator */}
                <div className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 px-1.5 py-0.5 rounded bg-black/60 text-[8px] font-bold text-white/80">
                  {p.position}
                </div>
              </div>
            ))}

            {/* Drag instructions */}
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/60 text-[10px] text-white/70 backdrop-blur-sm">
              <ArrowLeftRight className="h-3 w-3" />
              <span>Arraste para reposicionar</span>
            </div>
          </div>
        </main>

        {/* Right panel - Player details */}
        <aside className="w-64 flex-shrink-0 border-l border-white/10 bg-[#0d0d0d] flex flex-col">
          {selectedPlayerData ? (
            <>
              {/* Selected player header */}
              <div className="p-4 border-b border-white/10">
                <div className="flex items-center gap-4">
                  <div
                    className="h-16 w-16 rounded-xl flex items-center justify-center text-2xl font-black shadow-lg"
                    style={{ backgroundColor: team.cor1, color: team.cor2 }}
                  >
                    {selectedPlayerData.number}
                  </div>
                  <div>
                    <div className="text-lg font-bold text-white">{selectedPlayerData.name}</div>
                    <div className="text-xs text-white/50">{selectedPlayerData.position}</div>
                    <div className={cn(
                      "mt-1 inline-flex px-2 py-0.5 rounded text-xs font-black text-white bg-gradient-to-r",
                      getRatingColor(selectedPlayerData.rating)
                    )}>
                      {selectedPlayerData.rating} OVR
                    </div>
                  </div>
                </div>
              </div>

              {/* Stats */}
              <div className="flex-1 p-4 space-y-3">
                <div className="text-[10px] font-medium text-white/40 uppercase tracking-wider">
                  Atributos
                </div>
                {[
                  { label: "Ritmo", value: 78 },
                  { label: "Finalizacao", value: 75 },
                  { label: "Passe", value: 80 },
                  { label: "Drible", value: 77 },
                  { label: "Defesa", value: 45 },
                  { label: "Fisico", value: 72 },
                ].map((stat) => (
                  <div key={stat.label} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-white/60">{stat.label}</span>
                      <span className="font-bold text-white">{stat.value}</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
                      <div 
                        className="h-full rounded-full bg-gradient-to-r from-[#1db954] to-[#2ecc71]"
                        style={{ width: `${stat.value}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>

              {/* Actions */}
              <div className="p-4 border-t border-white/10 space-y-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full border-white/10 bg-transparent text-white/70 hover:bg-white/5"
                >
                  <ArrowLeftRight className="mr-2 h-4 w-4" />
                  Substituir Jogador
                </Button>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
              <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-4">
                <Users className="h-8 w-8 text-white/20" />
              </div>
              <div className="text-sm font-medium text-white/40">Nenhum jogador selecionado</div>
              <div className="text-xs text-white/20 mt-1">Clique em um jogador para ver detalhes</div>
            </div>
          )}
        </aside>
      </div>

      {/* Footer with controller buttons */}
      <ControllerToolbar
        visible={true}
        controller={controllerType}
        actions={[
          { button: "A", label: "Selecionar" },
          { button: "B", label: "Voltar" },
          { button: "X", label: "Substituir" },
          { button: "Y", label: "Taticas" },
          { button: "LB", label: "Form. Anterior" },
          { button: "RB", label: "Prox. Form." },
        ]}
        className="border-t border-white/10"
      />
    </div>
  )
}
