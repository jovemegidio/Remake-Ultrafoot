"use client"

import { useState, useMemo, useCallback } from "react"
import { 
  ChevronLeft, 
  ChevronRight,
  Star,
  Zap,
  Target,
  Shield,
  Footprints,
  TrendingUp,
  Smile,
  ArrowLeftRight,
  RotateCcw,
  Shuffle,
  Info
} from "lucide-react"
import { GameSidebar } from "@/components/game-sidebar"
import { GameHeader } from "@/components/game-header"
import { TeamCrest } from "@/components/team-crest"
import { PlayerAvatarCircle } from "@/components/player-avatar"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { getTeamByShort, serieATeams, type Team } from "@/lib/teams-data"
import { useGameState } from "@/lib/save-system"

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

export default function ElencoPage() {
  const { state } = useGameState()
  const userTeam = getTeamByShort(state.selectedTeamShort || "BGT") || serieATeams[0]
  
  const [activeTab, setActiveTab] = useState<"elenco" | "taticas" | "atribuicoes">("elenco")
  const [formation, setFormation] = useState("4-3-3")
  const [players, setPlayers] = useState(playersData)
  const [bench] = useState(benchData)
  const [selectedPlayerId, setSelectedPlayerId] = useState<number>(10) // Eduardo Sasha selected by default
  
  const selectedPlayer = useMemo(() => {
    return [...players, ...bench].find(p => p.id === selectedPlayerId) || players[0]
  }, [selectedPlayerId, players, bench])
  
  const formationKeys = Object.keys(FORMATIONS)
  const currentFormationIndex = formationKeys.indexOf(formation)
  
  const positionedPlayers = useMemo(() => {
    const formationData = FORMATIONS[formation]
    return players.map((player, index) => ({
      ...player,
      x: formationData.positions[index]?.x || 50,
      y: formationData.positions[index]?.y || 50,
    }))
  }, [players, formation])
  
  const nextFormation = () => {
    const nextIndex = (currentFormationIndex + 1) % formationKeys.length
    setFormation(formationKeys[nextIndex])
  }
  
  const prevFormation = () => {
    const prevIndex = (currentFormationIndex - 1 + formationKeys.length) % formationKeys.length
    setFormation(formationKeys[prevIndex])
  }

  return (
    <div className="min-h-screen pl-[72px] pb-24 bg-[#0a0a0a]">
      <GameSidebar />
      <GameHeader team={userTeam} />

      <main className="h-[calc(100vh-48px-96px)]">
        {/* Sub-header with tabs */}
        <div className="flex items-center justify-between px-6 py-3 border-b border-white/10 bg-[#0d0d0d]">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-3">
              <TeamCrest team={userTeam} size="sm" />
              <div>
                <h1 className="text-sm font-bold text-white">Gerenciamento do Time</h1>
                <p className="text-[10px] text-white/40">{userTeam.nome}</p>
              </div>
            </div>
            
            {/* Tabs */}
            <div className="flex items-center gap-1 ml-8">
              {(["elenco", "taticas", "atribuicoes"] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={cn(
                    "px-4 py-2 text-sm font-medium transition-all rounded",
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
          <div className="flex items-center gap-2">
            <button 
              onClick={prevFormation}
              className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-white transition"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <div className="px-4 py-2 min-w-[100px] text-center rounded-lg bg-[#1db954]/20 border border-[#1db954]/30">
              <span className="text-lg font-black text-white">{formation}</span>
            </div>
            <button 
              onClick={nextFormation}
              className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-white transition"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="flex h-full">
          {/* Main content - Pitch */}
          <div className="flex-1 flex flex-col p-4">
            {/* Pitch area */}
            <div className="flex-1 relative rounded-2xl overflow-hidden" style={{
              background: `linear-gradient(180deg, oklch(0.42 0.14 145), oklch(0.32 0.11 145))`,
            }}>
              {/* Pitch stripes */}
              <div
                className="absolute inset-0 opacity-15"
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
                <button
                  key={player.id}
                  onClick={() => setSelectedPlayerId(player.id)}
                  className={cn(
                    "absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center transition-all duration-200 group",
                    selectedPlayerId === player.id && "scale-110 z-10"
                  )}
                  style={{ 
                    left: `${player.x}%`, 
                    top: `${player.y}%` 
                  }}
                >
                  {/* Player name tag */}
                  <div className={cn(
                    "px-2 py-0.5 rounded text-[9px] font-semibold mb-1 whitespace-nowrap transition-all",
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
                      size="md"
                      className={cn(
                        "border-2 transition-all",
                        selectedPlayerId === player.id
                          ? "border-[#1db954] shadow-[0_0_12px_rgba(29,185,84,0.5)]"
                          : "border-white/30 group-hover:border-white/60"
                      )}
                    />
                    
                    {/* Overall badge */}
                    <div className={cn(
                      "absolute -bottom-1 -right-1 h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-black",
                      "bg-gradient-to-br from-[#1a1a1a] to-[#0a0a0a] border",
                      selectedPlayerId === player.id ? "border-[#1db954]" : "border-white/30"
                    )}>
                      <span className={getOverallColor(player.overall)}>{player.overall}</span>
                    </div>
                    
                    {/* Position indicator */}
                    {player.potential > player.overall + 3 && (
                      <div className="absolute -top-1 -left-1 h-4 w-4 rounded-full bg-[#1db954] flex items-center justify-center">
                        <TrendingUp className="h-2.5 w-2.5 text-black" />
                      </div>
                    )}
                  </div>
                </button>
              ))}
              
              {/* Tactical instruction overlay */}
              <div className="absolute bottom-4 left-4 flex items-center gap-2 px-3 py-1.5 rounded-lg bg-black/60 text-white/70 text-xs">
                <span>Sem a bola</span>
                <span className="text-white/40">|</span>
                <span className="text-[#1db954]">Trocar instrucao</span>
                <ChevronRight className="h-3 w-3 text-[#1db954]" />
              </div>
            </div>
            
            {/* Reserves section */}
            <div className="mt-4 p-4 rounded-xl bg-[#141414] border border-white/10">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-white">Reservas</h3>
                <span className="text-xs text-white/40">{bench.length} jogadores</span>
              </div>
              
              <div className="flex gap-3 overflow-x-auto pb-2">
                {bench.map((player) => {
                  const posColors = positionColors[player.position] || positionColors.MEI
                  return (
                    <button
                      key={player.id}
                      onClick={() => setSelectedPlayerId(player.id)}
                      className={cn(
                        "flex-shrink-0 flex items-center gap-3 px-3 py-2 rounded-lg transition-all min-w-[160px]",
                        selectedPlayerId === player.id
                          ? "bg-[#1db954]/20 border border-[#1db954]/50"
                          : "bg-white/5 border border-transparent hover:bg-white/10"
                      )}
                    >
                      <div className="relative">
                        <PlayerAvatarCircle
                          name={player.name}
                          teamColor={userTeam.cor1}
                          size="sm"
                        />
                        <div className={cn(
                          "absolute -bottom-0.5 -right-0.5 px-1 py-0.5 rounded text-[8px] font-bold border",
                          posColors.bg, posColors.text, posColors.border
                        )}>
                          {player.position}
                        </div>
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-medium text-white truncate">{player.name}</span>
                          <span className={cn("text-sm font-black", getOverallColor(player.overall))}>
                            {player.overall}
                          </span>
                        </div>
                        <div className="text-[10px] text-white/40">{player.age} anos</div>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          </div>

          {/* Right panel - Player details */}
          <aside className="w-80 flex-shrink-0 border-l border-white/10 bg-[#0d0d0d] overflow-y-auto">
            {/* Player header */}
            <div className="p-4 border-b border-white/10" style={{
              background: `linear-gradient(135deg, ${userTeam.cor1}30 0%, transparent 100%)`
            }}>
              <div className="flex items-start gap-4">
                <div className="text-right">
                  <div className={cn("text-4xl font-black", getOverallColor(selectedPlayer.overall))}>
                    {selectedPlayer.overall}
                  </div>
                  <div className="text-[10px] text-white/40 font-medium">
                    {selectedPlayer.position} • {selectedPlayer.position === "ATA" || selectedPlayer.position === "PD" || selectedPlayer.position === "PE" ? "ATA" : selectedPlayer.position === "MEI" || selectedPlayer.position === "VOL" ? "MEI" : selectedPlayer.position === "ZAG" || selectedPlayer.position === "LD" || selectedPlayer.position === "LE" ? "DEF" : "GOL"}
                  </div>
                </div>
                <div className="flex-1">
                  <h2 className="text-xl font-bold text-white uppercase">{selectedPlayer.name}</h2>
                </div>
              </div>
            </div>
            
            {/* Player info */}
            <div className="p-4 space-y-4">
              <div>
                <h3 className="text-xs font-semibold text-white/60 uppercase tracking-wider mb-3">
                  Informacoes do atleta
                </h3>
                
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-white/50">Energia</span>
                    <div className="flex items-center gap-2">
                      <div className="w-24 h-1.5 rounded-full bg-white/10 overflow-hidden">
                        <div 
                          className="h-full bg-[#1db954] rounded-full"
                          style={{ width: `${selectedPlayer.energy}%` }}
                        />
                      </div>
                      <span className="text-xs font-medium text-[#1db954]">{selectedPlayer.energy}%</span>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-white/50">Ritmo de jogo</span>
                      <span className={cn("text-xs font-medium", getStatColor(selectedPlayer.rhythm))}>
                        {selectedPlayer.rhythm}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-white/50">Idade</span>
                      <span className="text-xs font-medium text-white">{selectedPlayer.age}</span>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-white/50">Moral</span>
                      <span className={cn("text-xs font-medium flex items-center gap-1", getMoralColor(selectedPlayer.moral))}>
                        {selectedPlayer.moral}
                        {selectedPlayer.moral === "Feliz" && <Smile className="h-3 w-3" />}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-white/50">Ritmo</span>
                      <span className={cn("text-xs font-medium", getStatColor(selectedPlayer.pace))}>
                        {selectedPlayer.pace}
                      </span>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-white/50">Perna</span>
                      <span className="text-xs font-medium text-white">{selectedPlayer.foot}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-white/50">Finaliz.</span>
                      <span className={cn("text-xs font-medium", getStatColor(selectedPlayer.shooting))}>
                        {selectedPlayer.shooting}
                      </span>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-white/50">t. de aceleracao</span>
                      <span className="text-xs font-medium text-white">{selectedPlayer.acceleration}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-white/50">Passes</span>
                      <span className={cn("text-xs font-medium", getStatColor(selectedPlayer.passing))}>
                        {selectedPlayer.passing}
                        {selectedPlayer.passing >= 80 && <span className="text-[#1db954] ml-0.5">+1</span>}
                      </span>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-white/50">Funcao</span>
                      <span className="text-xs font-medium text-white">{selectedPlayer.function}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-white/50">Conducao</span>
                      <span className={cn("text-xs font-medium", getStatColor(selectedPlayer.dribbling))}>
                        {selectedPlayer.dribbling}
                      </span>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-white/50">Foco</span>
                      <span className="text-xs font-medium text-white">{selectedPlayer.focus}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-white/50">Defesa</span>
                      <span className={cn("text-xs font-medium", getStatColor(selectedPlayer.defending))}>
                        {selectedPlayer.defending}
                      </span>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-white/50">Altura</span>
                      <span className="text-xs font-medium text-white">{selectedPlayer.height} cm</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-white/50">Fisico</span>
                      <span className={cn("text-xs font-medium", getStatColor(selectedPlayer.physical))}>
                        {selectedPlayer.physical}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Playstyles */}
              <div className="pt-4 border-t border-white/10">
                <h3 className="text-xs font-semibold text-white/60 uppercase tracking-wider mb-3">
                  Estilos de jogo
                </h3>
                
                <div className="flex items-center justify-between">
                  <span className="text-xs text-white/50">Fintas</span>
                  <div className="flex items-center gap-0.5">
                    {getStarRating(selectedPlayer.fintas)}
                  </div>
                </div>
              </div>
              
              {/* Actions */}
              <div className="pt-4 border-t border-white/10 space-y-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full border-white/10 text-white/70 hover:text-white hover:bg-white/10"
                >
                  <ArrowLeftRight className="h-4 w-4 mr-2" />
                  Substituir
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full border-white/10 text-white/70 hover:text-white hover:bg-white/10"
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
      <div className="fixed bottom-0 left-[72px] right-0 h-14 bg-[#0d0d0d] border-t border-white/10 flex items-center justify-between px-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" className="text-white/60 hover:text-white">
            <ChevronLeft className="h-4 w-4 mr-1" />
            Voltar
          </Button>
          <Button variant="ghost" size="sm" className="text-white/60 hover:text-white">
            <RotateCcw className="h-4 w-4 mr-1" />
            Editar tatica ativa
          </Button>
        </div>
        
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" className="text-white/60 hover:text-white">
            <Shuffle className="h-4 w-4 mr-1" />
            Substituicoes sugeridas
          </Button>
          <Button variant="ghost" size="sm" className="text-white/60 hover:text-white">
            Substituicoes rapidas
          </Button>
          <div className="w-px h-6 bg-white/10" />
          <Button variant="ghost" size="sm" className="text-white/60 hover:text-white">
            Rolagem
          </Button>
          <Button variant="ghost" size="sm" className="text-white/60 hover:text-white">
            Tutoriais
          </Button>
        </div>
      </div>
    </div>
  )
}
