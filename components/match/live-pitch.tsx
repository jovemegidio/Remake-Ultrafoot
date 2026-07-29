"use client"

import { cn } from "@/lib/utils"
import type { BallPosition, Side } from "@/lib/match-engine"
import type { Team } from "@/lib/teams-data"

interface LivePitchProps {
  ball: BallPosition
  homeTeam: Team
  awayTeam: Team
  homePlayers: { id: number; number: number; name: string; position: string; rating: number; stamina: number }[]
  awayPlayers: { id: number; number: number; name: string; position: string; rating: number; stamina: number }[]
  selectedPlayer: number | null
  onSelectPlayer: (id: number | null) => void
  flash?: { side: Side; type: "goal" | "card" | "chance" } | null
}

// Formação 4-3-3 padrão
const HOME_POSITIONS = [
  { x: 8, y: 50 },   // GK
  { x: 22, y: 18 },  // LB
  { x: 22, y: 38 },  // CB
  { x: 22, y: 62 },  // CB
  { x: 22, y: 82 },  // RB
  { x: 40, y: 30 },  // CM
  { x: 40, y: 50 },  // CDM
  { x: 40, y: 70 },  // CM
  { x: 60, y: 22 },  // LW
  { x: 62, y: 50 },  // ST
  { x: 60, y: 78 },  // RW
]

const AWAY_POSITIONS = HOME_POSITIONS.map(p => ({ x: 100 - p.x, y: p.y }))

export function LivePitch({
  ball,
  homeTeam,
  awayTeam,
  homePlayers,
  awayPlayers,
  selectedPlayer,
  onSelectPlayer,
  flash,
}: LivePitchProps) {
  const homeColor = homeTeam.cor1
  const awayColor = awayTeam.cor1

  return (
    <div className="relative aspect-[16/9] w-full overflow-hidden bg-gradient-to-b from-[oklch(0.42_0.14_145)] via-[oklch(0.32_0.11_145)] to-[oklch(0.42_0.14_145)]">
      {/* Listras do gramado */}
      <div
        className="absolute inset-0 opacity-20"
        style={{
          backgroundImage:
            "repeating-linear-gradient(90deg, transparent 0 8%, rgba(0,0,0,0.18) 8% 16%)",
        }}
      />

      {/* Linhas do campo */}
      <svg
        viewBox="0 0 100 56.25"
        className="absolute inset-0 h-full w-full"
        preserveAspectRatio="xMidYMid slice"
      >
        <g stroke="rgba(255,255,255,0.55)" strokeWidth="0.18" fill="none">
          <rect x="2" y="2" width="96" height="52.25" />
          <line x1="50" y1="2" x2="50" y2="54.25" />
          <circle cx="50" cy="28.125" r="7" />
          <circle cx="50" cy="28.125" r="0.5" fill="rgba(255,255,255,0.6)" />
          {/* Grande área esquerda */}
          <rect x="2" y="14" width="13" height="28.25" />
          <rect x="2" y="20" width="5" height="16.25" />
          <path d="M 15 23 A 7 7 0 0 1 15 33.25" />
          {/* Grande área direita */}
          <rect x="85" y="14" width="13" height="28.25" />
          <rect x="93" y="20" width="5" height="16.25" />
          <path d="M 85 23 A 7 7 0 0 0 85 33.25" />
          {/* Marcas de pênalti */}
          <circle cx="9" cy="28.125" r="0.4" fill="rgba(255,255,255,0.6)" />
          <circle cx="91" cy="28.125" r="0.4" fill="rgba(255,255,255,0.6)" />
        </g>
      </svg>

      {/* Flash visual em chance/gol */}
      {flash && flash.type === "goal" && (
        <div
          className="absolute inset-0 pointer-events-none animate-pulse"
          style={{
            background: `radial-gradient(circle at ${flash.side === "home" ? "85%" : "15%"} 50%, ${
              flash.side === "home" ? homeColor : awayColor
            }55 0%, transparent 50%)`,
          }}
        />
      )}

      {/* Jogadores mandante */}
      {HOME_POSITIONS.map((pos, i) => {
        const player = homePlayers[i]
        if (!player) return null
        const isSelected = selectedPlayer === player.id
        const lowStamina = player.stamina < 50
        return (
          <button
            key={`home-${player.id}`}
            onClick={() => onSelectPlayer(isSelected ? null : player.id)}
            className="absolute -translate-x-1/2 -translate-y-1/2 group z-10"
            style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
            aria-label={`${player.name} - ${player.position}`}
          >
            <div
              className={cn(
                "relative flex items-center justify-center rounded-full text-[11px] font-bold transition-all",
                "h-8 w-8 sm:h-9 sm:w-9",
                isSelected ? "ring-2 ring-white scale-125 shadow-lg" : "hover:scale-110",
                lowStamina && "ring-2 ring-yellow-400",
              )}
              style={{
                backgroundColor: homeColor,
                color: homeTeam.cor2,
                boxShadow: isSelected ? `0 0 20px ${homeColor}` : undefined,
              }}
            >
              {player.number}
              {/* Stamina bar */}
              <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-7 h-[3px] rounded-full bg-black/40 overflow-hidden">
                <div
                  className={cn(
                    "h-full transition-all",
                    player.stamina > 70
                      ? "bg-[var(--brand)]"
                      : player.stamina > 40
                        ? "bg-yellow-400"
                        : "bg-red-400",
                  )}
                  style={{ width: `${player.stamina}%` }}
                />
              </div>
            </div>
            {isSelected && (
              <div className="absolute top-full mt-3 left-1/2 -translate-x-1/2 z-20 whitespace-nowrap pointer-events-none">
                <div className="bg-[#050508] border border-white/15 rounded-lg px-3 py-1.5 shadow-xl">
                  <div className="text-xs font-semibold text-white">{player.name}</div>
                  <div className="text-[10px] text-white/60">
                    {player.position} · OVR {player.rating} · {player.stamina}%
                  </div>
                </div>
              </div>
            )}
          </button>
        )
      })}

      {/* Jogadores visitante */}
      {AWAY_POSITIONS.map((pos, i) => {
        const player = awayPlayers[i]
        if (!player) return null
        return (
          <div
            key={`away-${i}`}
            className="absolute -translate-x-1/2 -translate-y-1/2 z-10"
            style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
          >
            <div
              className="flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-full text-[11px] font-bold opacity-95"
              style={{ backgroundColor: awayColor, color: awayTeam.cor2 }}
            >
              {player?.number ?? i + 1}
            </div>
          </div>
        )
      })}

      {/* Bola animada */}
      <div
        className="absolute z-20 -translate-x-1/2 -translate-y-1/2 transition-all duration-300 ease-out"
        style={{ left: `${ball.x}%`, top: `${ball.y}%` }}
      >
        <div className="relative h-3 w-3 sm:h-4 sm:w-4">
          <div className="absolute inset-0 rounded-full bg-white shadow-[0_0_12px_rgba(255,255,255,0.8)]" />
          <div className="absolute inset-0 rounded-full bg-gradient-to-br from-white to-white/70 border border-black/20" />
        </div>
        {/* Sombra */}
        <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 h-1 w-3 rounded-full bg-black/40 blur-sm" />
      </div>
    </div>
  )
}
