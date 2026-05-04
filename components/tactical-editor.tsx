"use client"

import { useState, useRef, useCallback } from "react"
import { X, Save, RotateCcw, ChevronDown, Users, Shuffle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { TeamCrest } from "@/components/team-crest"
import { cn } from "@/lib/utils"
import { type Team } from "@/lib/teams-data"

// Posicoes de jogadores no campo
type Position = {
  id: number
  name: string
  number: number
  position: string
  rating: number
  x: number // 0-100 percentual
  y: number // 0-100 percentual
}

// Formacoes predefinidas
const FORMATIONS: Record<string, { name: string; positions: { pos: string; x: number; y: number }[] }> = {
  "4-3-3": {
    name: "4-3-3",
    positions: [
      { pos: "GOL", x: 50, y: 92 },
      { pos: "LD", x: 85, y: 75 },
      { pos: "ZAG", x: 65, y: 78 },
      { pos: "ZAG", x: 35, y: 78 },
      { pos: "LE", x: 15, y: 75 },
      { pos: "VOL", x: 50, y: 58 },
      { pos: "MEI", x: 75, y: 48 },
      { pos: "MEI", x: 25, y: 48 },
      { pos: "PD", x: 80, y: 22 },
      { pos: "ATA", x: 50, y: 15 },
      { pos: "PE", x: 20, y: 22 },
    ],
  },
  "4-4-2": {
    name: "4-4-2",
    positions: [
      { pos: "GOL", x: 50, y: 92 },
      { pos: "LD", x: 85, y: 75 },
      { pos: "ZAG", x: 65, y: 78 },
      { pos: "ZAG", x: 35, y: 78 },
      { pos: "LE", x: 15, y: 75 },
      { pos: "MD", x: 85, y: 50 },
      { pos: "VOL", x: 60, y: 55 },
      { pos: "VOL", x: 40, y: 55 },
      { pos: "ME", x: 15, y: 50 },
      { pos: "ATA", x: 60, y: 18 },
      { pos: "ATA", x: 40, y: 18 },
    ],
  },
  "3-5-2": {
    name: "3-5-2",
    positions: [
      { pos: "GOL", x: 50, y: 92 },
      { pos: "ZAG", x: 75, y: 78 },
      { pos: "ZAG", x: 50, y: 82 },
      { pos: "ZAG", x: 25, y: 78 },
      { pos: "ALD", x: 90, y: 55 },
      { pos: "VOL", x: 65, y: 58 },
      { pos: "MEI", x: 50, y: 48 },
      { pos: "VOL", x: 35, y: 58 },
      { pos: "ALE", x: 10, y: 55 },
      { pos: "ATA", x: 60, y: 18 },
      { pos: "ATA", x: 40, y: 18 },
    ],
  },
  "4-2-3-1": {
    name: "4-2-3-1",
    positions: [
      { pos: "GOL", x: 50, y: 92 },
      { pos: "LD", x: 85, y: 75 },
      { pos: "ZAG", x: 65, y: 78 },
      { pos: "ZAG", x: 35, y: 78 },
      { pos: "LE", x: 15, y: 75 },
      { pos: "VOL", x: 60, y: 60 },
      { pos: "VOL", x: 40, y: 60 },
      { pos: "PD", x: 80, y: 38 },
      { pos: "MEI", x: 50, y: 35 },
      { pos: "PE", x: 20, y: 38 },
      { pos: "ATA", x: 50, y: 15 },
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
      { pos: "MEI", x: 70, y: 48 },
      { pos: "VOL", x: 50, y: 55 },
      { pos: "MEI", x: 30, y: 48 },
      { pos: "ATA", x: 60, y: 18 },
      { pos: "ATA", x: 40, y: 18 },
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

interface TacticalEditorProps {
  team: Team
  onClose: () => void
  onSave?: (formation: string, players: Position[]) => void
}

export function TacticalEditor({ team, onClose, onSave }: TacticalEditorProps) {
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
  const pitchRef = useRef<HTMLDivElement>(null)

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

  // Resetar posicoes
  const resetPositions = () => {
    applyFormation(formation)
  }

  // Embaralhar posicoes dos jogadores de campo
  const shufflePlayers = () => {
    setPlayers(prev => {
      const goalkeeper = prev[0]
      const fieldPlayers = [...prev.slice(1)]
      // Fisher-Yates shuffle
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

  // Drag handlers
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

  // Salvar e fechar
  const handleSave = () => {
    onSave?.(formation, players)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex bg-black/90 backdrop-blur-md">
      {/* Left sidebar - Info */}
      <aside className="w-64 flex-shrink-0 border-r border-white/10 bg-[#0d0d0d] flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-white/10">
          <div className="flex items-center gap-3 mb-3">
            <TeamCrest team={team} size="lg" />
            <div>
              <div className="text-xs text-white/40 font-medium">Escalacao</div>
              <div className="text-sm font-bold text-white">{team.nome}</div>
            </div>
          </div>
          
          {/* Formation selector */}
          <div className="relative">
            <button
              onClick={() => setShowFormationMenu(!showFormationMenu)}
              className="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm font-medium text-white hover:bg-white/10 transition"
            >
              <span>Formacao: {formation}</span>
              <ChevronDown className={cn("h-4 w-4 transition-transform", showFormationMenu && "rotate-180")} />
            </button>
            
            {showFormationMenu && (
              <div className="absolute top-full left-0 right-0 mt-1 rounded-lg bg-[#1a1a1a] border border-white/10 overflow-hidden z-10">
                {Object.keys(FORMATIONS).map(f => (
                  <button
                    key={f}
                    onClick={() => applyFormation(f)}
                    className={cn(
                      "w-full px-3 py-2 text-sm text-left transition",
                      f === formation 
                        ? "bg-[#1db954] text-black font-semibold" 
                        : "text-white/70 hover:bg-white/5"
                    )}
                  >
                    {FORMATIONS[f].name}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Starters list */}
        <div className="flex-1 overflow-y-auto p-3">
          <div className="text-[10px] font-medium text-white/40 uppercase tracking-wider mb-2">
            Titulares (11)
          </div>
          <div className="space-y-1">
            {players.map(p => (
              <button
                key={p.id}
                onClick={() => setSelectedPlayer(p.id === selectedPlayer ? null : p.id)}
                className={cn(
                  "w-full flex items-center gap-2 px-2 py-1.5 rounded text-left transition",
                  selectedPlayer === p.id 
                    ? "bg-[#1db954]/20 border border-[#1db954]/50" 
                    : "hover:bg-white/5 border border-transparent"
                )}
              >
                <div
                  className="h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-bold"
                  style={{ backgroundColor: team.cor1, color: team.cor2 }}
                >
                  {p.number}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium text-white truncate">{p.name}</div>
                  <div className="text-[10px] text-white/40">{p.position}</div>
                </div>
                <div className="text-xs font-bold text-[#1db954]">{p.rating}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Bench */}
        <div className="border-t border-white/10 p-3">
          <div className="text-[10px] font-medium text-white/40 uppercase tracking-wider mb-2 flex items-center gap-1">
            <Users className="h-3 w-3" />
            Banco ({bench.length})
          </div>
          <div className="grid grid-cols-4 gap-1">
            {bench.slice(0, 7).map(p => (
              <div
                key={p.id}
                className="flex flex-col items-center p-1 rounded bg-white/5 hover:bg-white/10 transition cursor-pointer"
                title={`${p.name} (${p.position}) - ${p.rating}`}
              >
                <div
                  className="h-5 w-5 rounded-full flex items-center justify-center text-[8px] font-bold mb-0.5"
                  style={{ backgroundColor: team.cor1, color: team.cor2 }}
                >
                  {p.number}
                </div>
                <div className="text-[8px] text-white/60 truncate w-full text-center">{p.name}</div>
              </div>
            ))}
          </div>
        </div>
      </aside>

      {/* Main content - Pitch */}
      <main className="flex-1 flex flex-col">
        {/* Top bar */}
        <header className="flex items-center justify-between px-6 py-3 border-b border-white/10 bg-[#0a0a0a]">
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-bold text-white">Editor Tatico</h1>
            <span className="px-2 py-0.5 rounded bg-[#1db954]/20 text-[#1db954] text-xs font-medium">
              {formation}
            </span>
          </div>
          
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={shufflePlayers}
              className="border-white/10 bg-transparent text-white/70 hover:bg-white/5"
            >
              <Shuffle className="mr-1 h-3.5 w-3.5" />
              Alternar
            </Button>
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
              Salvar
            </Button>
            <button
              onClick={onClose}
              className="ml-2 h-8 w-8 rounded-lg flex items-center justify-center text-white/50 hover:text-white hover:bg-white/10 transition"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </header>

        {/* Pitch area */}
        <div className="flex-1 flex items-center justify-center p-6 bg-[#0a0a0a]">
          <div
            ref={pitchRef}
            className="relative w-full max-w-3xl aspect-[3/4] rounded-xl overflow-hidden select-none"
            style={{
              background: `linear-gradient(180deg, oklch(0.42 0.14 145), oklch(0.32 0.11 145))`,
            }}
            onMouseMove={draggingId ? handleDrag : undefined}
            onMouseUp={handleDragEnd}
            onMouseLeave={handleDragEnd}
            onTouchMove={draggingId ? handleDrag : undefined}
            onTouchEnd={handleDragEnd}
          >
            {/* Pitch lines */}
            <div
              className="absolute inset-0 opacity-25"
              style={{
                backgroundImage:
                  "repeating-linear-gradient(0deg, transparent 0 8%, rgba(0,0,0,0.18) 8% 16%)",
              }}
            />
            <svg
              viewBox="0 0 100 100"
              className="absolute inset-0 h-full w-full"
              preserveAspectRatio="xMidYMid slice"
            >
              <g stroke="rgba(255,255,255,0.5)" strokeWidth="0.3" fill="none">
                {/* Outer boundary */}
                <rect x="2" y="2" width="96" height="96" />
                {/* Center line */}
                <line x1="2" y1="50" x2="98" y2="50" />
                {/* Center circle */}
                <circle cx="50" cy="50" r="10" />
                {/* Center spot */}
                <circle cx="50" cy="50" r="0.5" fill="rgba(255,255,255,0.5)" />
                {/* Top penalty area */}
                <rect x="20" y="2" width="60" height="18" />
                {/* Top goal area */}
                <rect x="35" y="2" width="30" height="7" />
                {/* Top penalty spot */}
                <circle cx="50" cy="12" r="0.5" fill="rgba(255,255,255,0.5)" />
                {/* Bottom penalty area */}
                <rect x="20" y="80" width="60" height="18" />
                {/* Bottom goal area */}
                <rect x="35" y="91" width="30" height="7" />
                {/* Bottom penalty spot */}
                <circle cx="50" cy="88" r="0.5" fill="rgba(255,255,255,0.5)" />
                {/* Goals */}
                <rect x="40" y="0" width="20" height="2" stroke="rgba(255,255,255,0.8)" />
                <rect x="40" y="98" width="20" height="2" stroke="rgba(255,255,255,0.8)" />
              </g>
            </svg>

            {/* Players */}
            {players.map(p => (
              <div
                key={p.id}
                className={cn(
                  "absolute -translate-x-1/2 -translate-y-1/2 cursor-grab active:cursor-grabbing transition-shadow",
                  draggingId === p.id && "z-20",
                  selectedPlayer === p.id && "z-10"
                )}
                style={{ left: `${p.x}%`, top: `${p.y}%` }}
                onMouseDown={() => handleDragStart(p.id)}
                onTouchStart={() => handleDragStart(p.id)}
              >
                {/* Selection ring */}
                {selectedPlayer === p.id && (
                  <div className="absolute inset-0 -m-1.5 rounded-full border-2 border-[#1db954] animate-pulse" />
                )}
                
                {/* Player circle */}
                <div
                  className={cn(
                    "h-10 w-10 rounded-full flex flex-col items-center justify-center shadow-lg border-2 transition-transform",
                    draggingId === p.id && "scale-110"
                  )}
                  style={{
                    backgroundColor: team.cor1,
                    borderColor: team.cor2,
                    color: team.cor2,
                  }}
                >
                  <span className="text-xs font-black leading-none">{p.number}</span>
                </div>
                
                {/* Player name tag */}
                <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1 whitespace-nowrap">
                  <div className="bg-black/80 rounded px-1.5 py-0.5 text-[10px] font-medium text-white text-center">
                    {p.name}
                  </div>
                  <div className="text-[9px] text-white/60 text-center mt-0.5">{p.position}</div>
                </div>
                
                {/* Rating badge */}
                <div
                  className="absolute -top-1 -right-1 h-5 w-5 rounded-full flex items-center justify-center text-[9px] font-bold bg-[#1db954] text-black shadow"
                >
                  {p.rating}
                </div>
              </div>
            ))}

            {/* Instructions overlay */}
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 px-3 py-1.5 rounded-full bg-black/60 text-[10px] text-white/70">
              Arraste os jogadores para reposicionar
            </div>
          </div>
        </div>
      </main>

      {/* Right sidebar - Selected player info */}
      {selectedPlayer && (
        <aside className="w-56 flex-shrink-0 border-l border-white/10 bg-[#0d0d0d] p-4">
          {(() => {
            const player = players.find(p => p.id === selectedPlayer)
            if (!player) return null
            return (
              <>
                <div className="text-[10px] font-medium text-white/40 uppercase tracking-wider mb-3">
                  Jogador Selecionado
                </div>
                <div className="flex items-center gap-3 mb-4">
                  <div
                    className="h-12 w-12 rounded-full flex items-center justify-center text-lg font-bold"
                    style={{ backgroundColor: team.cor1, color: team.cor2 }}
                  >
                    {player.number}
                  </div>
                  <div>
                    <div className="text-sm font-bold text-white">{player.name}</div>
                    <div className="text-xs text-white/50">{player.position}</div>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-white/50">Overall</span>
                    <span className="font-bold text-[#1db954]">{player.rating}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-white/50">Posicao X</span>
                    <span className="font-mono text-white">{player.x.toFixed(0)}%</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-white/50">Posicao Y</span>
                    <span className="font-mono text-white">{player.y.toFixed(0)}%</span>
                  </div>
                </div>
              </>
            )
          })()}
        </aside>
      )}
    </div>
  )
}
