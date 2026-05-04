"use client"

import { useMemo, useState } from "react"
import { cn } from "@/lib/utils"
import type { Team } from "@/lib/teams-data"
import { getPlayersForTeam, sortByPosition, type Player } from "@/lib/players-data"

// ─────────────────────────────────────────────────────────────────────────────
// Types & formations
// ─────────────────────────────────────────────────────────────────────────────

export type FormationKey =
  | "4-3-3"
  | "4-4-2"
  | "4-2-3-1"
  | "3-5-2"
  | "5-3-2"
  | "4-1-4-1"

interface Slot {
  /** Posição preferida no esquema base (apenas para escolher jogadores). */
  role: "GOL" | "DEF" | "MID" | "ATA"
  /** Posição relativa no campo, com 0–100 (ataque em cima quando atacando). */
  x: number
  y: number
  /** Rótulo curto exibido no campo (LB, CB, CM, LW...). */
  label: string
}

const FORMATIONS: Record<FormationKey, Slot[]> = {
  "4-3-3": [
    { role: "GOL", x: 50, y: 92, label: "GK" },
    { role: "DEF", x: 12, y: 72, label: "LB" },
    { role: "DEF", x: 36, y: 76, label: "CB" },
    { role: "DEF", x: 64, y: 76, label: "CB" },
    { role: "DEF", x: 88, y: 72, label: "RB" },
    { role: "MID", x: 28, y: 50, label: "CM" },
    { role: "MID", x: 50, y: 54, label: "CDM" },
    { role: "MID", x: 72, y: 50, label: "CM" },
    { role: "ATA", x: 18, y: 22, label: "LW" },
    { role: "ATA", x: 50, y: 16, label: "ST" },
    { role: "ATA", x: 82, y: 22, label: "RW" },
  ],
  "4-4-2": [
    { role: "GOL", x: 50, y: 92, label: "GK" },
    { role: "DEF", x: 12, y: 72, label: "LB" },
    { role: "DEF", x: 36, y: 76, label: "CB" },
    { role: "DEF", x: 64, y: 76, label: "CB" },
    { role: "DEF", x: 88, y: 72, label: "RB" },
    { role: "MID", x: 14, y: 48, label: "LM" },
    { role: "MID", x: 38, y: 52, label: "CM" },
    { role: "MID", x: 62, y: 52, label: "CM" },
    { role: "MID", x: 86, y: 48, label: "RM" },
    { role: "ATA", x: 36, y: 18, label: "ST" },
    { role: "ATA", x: 64, y: 18, label: "ST" },
  ],
  "4-2-3-1": [
    { role: "GOL", x: 50, y: 92, label: "GK" },
    { role: "DEF", x: 12, y: 72, label: "LB" },
    { role: "DEF", x: 36, y: 76, label: "CB" },
    { role: "DEF", x: 64, y: 76, label: "CB" },
    { role: "DEF", x: 88, y: 72, label: "RB" },
    { role: "MID", x: 36, y: 56, label: "CDM" },
    { role: "MID", x: 64, y: 56, label: "CDM" },
    { role: "MID", x: 18, y: 32, label: "LAM" },
    { role: "MID", x: 50, y: 30, label: "CAM" },
    { role: "MID", x: 82, y: 32, label: "RAM" },
    { role: "ATA", x: 50, y: 12, label: "ST" },
  ],
  "3-5-2": [
    { role: "GOL", x: 50, y: 92, label: "GK" },
    { role: "DEF", x: 22, y: 74, label: "CB" },
    { role: "DEF", x: 50, y: 78, label: "CB" },
    { role: "DEF", x: 78, y: 74, label: "CB" },
    { role: "MID", x: 8, y: 52, label: "LWB" },
    { role: "MID", x: 30, y: 50, label: "CM" },
    { role: "MID", x: 50, y: 54, label: "CDM" },
    { role: "MID", x: 70, y: 50, label: "CM" },
    { role: "MID", x: 92, y: 52, label: "RWB" },
    { role: "ATA", x: 36, y: 18, label: "ST" },
    { role: "ATA", x: 64, y: 18, label: "ST" },
  ],
  "5-3-2": [
    { role: "GOL", x: 50, y: 92, label: "GK" },
    { role: "DEF", x: 8, y: 70, label: "LWB" },
    { role: "DEF", x: 28, y: 76, label: "CB" },
    { role: "DEF", x: 50, y: 78, label: "CB" },
    { role: "DEF", x: 72, y: 76, label: "CB" },
    { role: "DEF", x: 92, y: 70, label: "RWB" },
    { role: "MID", x: 28, y: 48, label: "CM" },
    { role: "MID", x: 50, y: 52, label: "CDM" },
    { role: "MID", x: 72, y: 48, label: "CM" },
    { role: "ATA", x: 36, y: 18, label: "ST" },
    { role: "ATA", x: 64, y: 18, label: "ST" },
  ],
  "4-1-4-1": [
    { role: "GOL", x: 50, y: 92, label: "GK" },
    { role: "DEF", x: 12, y: 72, label: "LB" },
    { role: "DEF", x: 36, y: 76, label: "CB" },
    { role: "DEF", x: 64, y: 76, label: "CB" },
    { role: "DEF", x: 88, y: 72, label: "RB" },
    { role: "MID", x: 50, y: 60, label: "CDM" },
    { role: "MID", x: 14, y: 38, label: "LM" },
    { role: "MID", x: 38, y: 40, label: "CM" },
    { role: "MID", x: 62, y: 40, label: "CM" },
    { role: "MID", x: 86, y: 38, label: "RM" },
    { role: "ATA", x: 50, y: 14, label: "ST" },
  ],
}

// ─────────────────────────────────────────────────────────────────────────────
// Auto pick 11 by formation
// ─────────────────────────────────────────────────────────────────────────────

function bucket(players: Player[]) {
  const goalies: Player[] = []
  const defenders: Player[] = []
  const midfielders: Player[] = []
  const attackers: Player[] = []

  for (const p of players) {
    const pos = (p.pos || "").toUpperCase()
    if (pos === "GOL") goalies.push(p)
    else if (pos === "ZAG" || pos === "LD" || pos === "LE") defenders.push(p)
    else if (pos === "VOL" || pos === "MEI") midfielders.push(p)
    else if (pos === "ATA") attackers.push(p)
    else midfielders.push(p)
  }

  const byOverall = (a: Player, b: Player) => b.base - a.base
  goalies.sort(byOverall)
  defenders.sort(byOverall)
  midfielders.sort(byOverall)
  attackers.sort(byOverall)

  return { goalies, defenders, midfielders, attackers }
}

function pickStarters(team: Team, formation: FormationKey): (Player | null)[] {
  const slots = FORMATIONS[formation]
  const all = sortByPosition(getPlayersForTeam(team))
  const { goalies, defenders, midfielders, attackers } = bucket(all)

  const counts = {
    GOL: slots.filter(s => s.role === "GOL").length,
    DEF: slots.filter(s => s.role === "DEF").length,
    MID: slots.filter(s => s.role === "MID").length,
    ATA: slots.filter(s => s.role === "ATA").length,
  }

  const queues = {
    GOL: goalies.slice(0, counts.GOL),
    DEF: defenders.slice(0, counts.DEF),
    MID: midfielders.slice(0, counts.MID),
    ATA: attackers.slice(0, counts.ATA),
  }

  // Se faltarem jogadores, completa com sobras (qualquer posição) por overall.
  const used = new Set<string>([
    ...queues.GOL.map(p => p.nome),
    ...queues.DEF.map(p => p.nome),
    ...queues.MID.map(p => p.nome),
    ...queues.ATA.map(p => p.nome),
  ])
  const fillers = all.filter(p => !used.has(p.nome)).sort((a, b) => b.base - a.base)

  return slots.map(slot => {
    const queue = queues[slot.role]
    if (queue.length > 0) return queue.shift() ?? null
    return fillers.shift() ?? null
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// Camisa SVG (estilo EA FC)
// ─────────────────────────────────────────────────────────────────────────────

function Jersey({
  primary,
  secondary,
  pattern = "solid",
  size = 56,
}: {
  primary: string
  secondary: string
  pattern?: "solid" | "stripes"
  size?: number
}) {
  const id = useMemo(() => `jersey-${Math.random().toString(36).slice(2, 9)}`, [])
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden>
      <defs>
        <linearGradient id={`${id}-shade`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgba(255,255,255,0.18)" />
          <stop offset="100%" stopColor="rgba(0,0,0,0.25)" />
        </linearGradient>
        {pattern === "stripes" && (
          <pattern id={`${id}-stripes`} width="8" height="64" patternUnits="userSpaceOnUse">
            <rect width="4" height="64" fill={primary} />
            <rect x="4" width="4" height="64" fill={secondary} />
          </pattern>
        )}
      </defs>
      {/* Corpo da camisa */}
      <path
        d="M14 14 L24 8 Q32 14 40 8 L50 14 L58 22 L50 30 L48 28 L48 56 Q48 60 44 60 L20 60 Q16 60 16 56 L16 28 L14 30 L6 22 Z"
        fill={pattern === "stripes" ? `url(#${id}-stripes)` : primary}
        stroke={secondary}
        strokeWidth="1.2"
      />
      {/* Sombras */}
      <path
        d="M14 14 L24 8 Q32 14 40 8 L50 14 L58 22 L50 30 L48 28 L48 56 Q48 60 44 60 L20 60 Q16 60 16 56 L16 28 L14 30 L6 22 Z"
        fill={`url(#${id}-shade)`}
        opacity="0.6"
      />
      {/* Gola */}
      <path d="M26 8 Q32 14 38 8 L36 12 Q32 16 28 12 Z" fill={secondary} />
    </svg>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Pitch background
// ─────────────────────────────────────────────────────────────────────────────

function PitchBackground() {
  return (
    <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full" preserveAspectRatio="none" aria-hidden>
      <defs>
        <linearGradient id="pitch-bg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#0a0a0a" />
          <stop offset="50%" stopColor="#0d0d0d" />
          <stop offset="100%" stopColor="#0a0a0a" />
        </linearGradient>
      </defs>
      <rect width="100" height="100" fill="url(#pitch-bg)" />
      {/* Faixas sutis */}
      {Array.from({ length: 10 }).map((_, i) => (
        <rect
          key={i}
          x="0"
          y={i * 10}
          width="100"
          height="10"
          fill={i % 2 === 0 ? "rgba(255,255,255,0.012)" : "rgba(0,0,0,0)"}
        />
      ))}
      {/* Linhas do campo */}
      <g stroke="rgba(255,255,255,0.18)" strokeWidth="0.25" fill="none">
        <rect x="2" y="2" width="96" height="96" rx="0.5" />
        <line x1="2" y1="50" x2="98" y2="50" />
        <circle cx="50" cy="50" r="9" />
        <circle cx="50" cy="50" r="0.6" fill="rgba(255,255,255,0.3)" />
        {/* Grande área superior */}
        <rect x="22" y="2" width="56" height="14" />
        <rect x="34" y="2" width="32" height="6" />
        <circle cx="50" cy="13" r="0.6" fill="rgba(255,255,255,0.3)" />
        {/* Grande área inferior */}
        <rect x="22" y="84" width="56" height="14" />
        <rect x="34" y="92" width="32" height="6" />
        <circle cx="50" cy="87" r="0.6" fill="rgba(255,255,255,0.3)" />
      </g>
    </svg>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// FormationBoard (componente principal — EA FC style)
// ─────────────────────────────────────────────────────────────────────────────

interface FormationBoardProps {
  team: Team
  defaultFormation?: FormationKey
  /** Pattern do uniforme (solid ou stripes). Padrão = solid. */
  jerseyPattern?: "solid" | "stripes"
  showFormationPicker?: boolean
}

export function FormationBoard({
  team,
  defaultFormation = "4-3-3",
  jerseyPattern = "solid",
  showFormationPicker = true,
}: FormationBoardProps) {
  const [formation, setFormation] = useState<FormationKey>(defaultFormation)

  const slots = FORMATIONS[formation]
  const starters = useMemo(() => pickStarters(team, formation), [team, formation])

  // Capitão: jogador de maior overall que NÃO é goleiro.
  const captainName = useMemo(() => {
    const outfield = starters
      .map((p, i) => ({ p, role: slots[i]?.role }))
      .filter(s => s.p && s.role !== "GOL")
      .map(s => s.p as Player)
    if (!outfield.length) return null
    return outfield.reduce((a, b) => (a.base >= b.base ? a : b)).nome
  }, [starters, slots])

  const formations: FormationKey[] = ["4-3-3", "4-4-2", "4-2-3-1", "3-5-2", "5-3-2", "4-1-4-1"]

  return (
    <div className="flex flex-col gap-4">
      {showFormationPicker && (
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[10px] font-bold tracking-[0.2em] text-white/50">FORMAÇÃO</div>
            <div className="text-lg font-black text-white tabular-nums tracking-tight">{formation}</div>
          </div>
          <div className="flex flex-wrap gap-1">
            {formations.map(f => (
              <button
                key={f}
                onClick={() => setFormation(f)}
                className={cn(
                  "px-2.5 py-1 rounded text-[10px] font-bold tracking-wider transition tabular-nums",
                  formation === f
                    ? "bg-[#1db954] text-black"
                    : "bg-white/5 text-white/60 hover:bg-white/10 hover:text-white",
                )}
              >
                {f}
              </button>
            ))}
          </div>
        </div>
      )}

      <div
        className="relative aspect-[3/4] w-full overflow-hidden rounded-xl border border-white/10"
      >
        <PitchBackground />

        {slots.map((slot, i) => {
          const player = starters[i]
          const isGK = slot.role === "GOL"
          const primary = isGK ? "#fbbf24" : team.cor1
          const secondary = isGK ? "#0a0a0a" : team.cor2
          const isCaptain = player?.nome === captainName
          const lastName = player?.nome.split(" ").slice(-1)[0] ?? "—"
          const firstInitial = player?.nome ? `${player.nome[0]}.` : ""
          const displayName = player ? `${firstInitial} ${lastName}` : "—"

          return (
            <div
              key={i}
              className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center"
              style={{ left: `${slot.x}%`, top: `${slot.y}%` }}
            >
              <div className="relative">
                {/* Glow sutil */}
                <div
                  className="absolute inset-0 rounded-full blur-xl opacity-40 -z-10"
                  style={{ background: primary, transform: "scale(0.9)" }}
                />
                <Jersey
                  primary={primary}
                  secondary={secondary}
                  pattern={isGK ? "solid" : jerseyPattern}
                  size={56}
                />

                {/* Overall flutuante (estilo EA FC) */}
                {player && (
                  <div
                    className="absolute -right-3 -top-1 flex h-7 min-w-7 items-center justify-center rounded-md px-1.5 text-[11px] font-black tabular-nums shadow-lg ring-1 ring-black/40"
                    style={{ background: "#fafafa", color: "#0a0a0a" }}
                  >
                    {player.base}
                  </div>
                )}

                {/* Capitão */}
                {isCaptain && (
                  <div
                    className="absolute -left-2 -top-1 flex h-5 w-5 items-center justify-center rounded-full text-[9px] font-black ring-2 ring-black/60"
                    style={{ background: "#fde047", color: "#0a0a0a" }}
                  >
                    C
                  </div>
                )}
              </div>

              <div className="mt-1 flex flex-col items-center leading-tight">
                <div className="text-[11px] font-bold text-white whitespace-nowrap drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]">
                  {displayName}
                </div>
                <div className="text-[8px] font-bold tracking-widest text-white/40">
                  {slot.label}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Resumo da escalação */}
      <div className="grid grid-cols-4 gap-2">
        {([
          { label: "GOL", role: "GOL" as const },
          { label: "DEF", role: "DEF" as const },
          { label: "MEI", role: "MID" as const },
          { label: "ATA", role: "ATA" as const },
        ]).map(({ label, role }) => {
          const groupPlayers = starters
            .map((p, i) => ({ p, role: slots[i]?.role }))
            .filter(s => s.role === role && s.p)
            .map(s => s.p as Player)
          const avg =
            groupPlayers.length > 0
              ? Math.round(groupPlayers.reduce((s, p) => s + p.base, 0) / groupPlayers.length)
              : 0
          return (
            <div key={label} className="rounded-lg border border-white/10 bg-white/[0.02] p-2.5 text-center">
              <div className="text-[9px] font-bold tracking-[0.2em] text-white/40">{label}</div>
              <div className="mt-1 text-xl font-black tabular-nums text-white">{avg || "—"}</div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
