"use client"

import { useMemo } from "react"
import type { Team } from "@/lib/teams-data"

interface RadarPlayer {
  id: number
  name: string
  number: number
  position: string
  rating?: number
  stamina?: number
}

interface MatchRadarProps {
  homeTeam: Team
  awayTeam: Team
  homeSquad: RadarPlayer[]
  awaySquad: RadarPlayer[]
  /** Posse de bola da casa (0-100) — usada para posicionar a bola */
  homePossession?: number
}

// Ordem das posicoes da defesa ao ataque, para mapear o elenco em slots.
const POSITION_RANK: Record<string, number> = {
  GOL: 0, GK: 0,
  LD: 1, ZAG: 2, LE: 3, LAT: 1,
  VOL: 4, MC: 5, MEI: 6, MD: 5, ME: 5, MO: 7,
  PD: 8, PE: 8, SA: 9, CA: 10, ATA: 10,
}

// Template de formacao 4-3-3 (depth: 0 = proprio gol, 1 = meio-campo; x: 0 esq, 1 dir).
// Ordem da lista vai da defesa ao ataque para casar com o elenco ordenado.
const FORMATION_433: { depth: number; x: number }[] = [
  { depth: 0.04, x: 0.5 },  // GOL
  { depth: 0.24, x: 0.84 }, // LD
  { depth: 0.18, x: 0.62 }, // ZAG
  { depth: 0.18, x: 0.38 }, // ZAG
  { depth: 0.24, x: 0.16 }, // LE
  { depth: 0.46, x: 0.5 },  // VOL
  { depth: 0.56, x: 0.3 },  // MEI
  { depth: 0.56, x: 0.7 },  // MEI
  { depth: 0.82, x: 0.18 }, // PE
  { depth: 0.9, x: 0.5 },   // ATA
  { depth: 0.82, x: 0.82 }, // PD
]

interface PlacedPlayer extends RadarPlayer {
  x: number
  y: number
}

// Mapeia os 11 titulares em slots fixos de uma formacao 4-3-3, garantindo um
// posicionamento legivel independentemente da distribuicao de posicoes do elenco.
function placeTeam(squad: RadarPlayer[], isHome: boolean): PlacedPlayer[] {
  const starters = [...squad.slice(0, 11)].sort(
    (a, b) => (POSITION_RANK[a.position] ?? 5) - (POSITION_RANK[b.position] ?? 5),
  )

  return starters.map((p, i) => {
    const slot = FORMATION_433[i] ?? { depth: 0.5, x: 0.5 }
    // Orientacao horizontal: profundidade vira eixo X. Casa defende a esquerda,
    // fora defende a direita (espelhado). A largura da formacao vira eixo Y.
    const x = isHome ? 0.03 + slot.depth * 0.46 : 0.97 - slot.depth * 0.46
    const y = isHome ? slot.x : 1 - slot.x
    return { ...p, x, y }
  })
}

function PlayerDot({
  player,
  color,
  textColor,
}: {
  player: PlacedPlayer
  color: string
  textColor: string
}) {
  const stamina = Math.round(player.stamina ?? 100)
  return (
    <div
      className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-0.5"
      style={{ left: `${player.x * 100}%`, top: `${player.y * 100}%` }}
    >
      <div
        className="relative flex items-center justify-center rounded-full font-bold ring-2 ring-white/80"
        style={{
          width: 24,
          height: 24,
          background: color,
          color: textColor,
          fontSize: 11,
          boxShadow: "0 1px 4px rgba(0,0,0,0.6)",
        }}
      >
        {player.number}
        {/* Anel de condicao fisica */}
        {stamina < 60 && (
          <span
            className="absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full ring-1 ring-black/40"
            style={{ background: stamina < 40 ? "#ef4444" : "#f59e0b" }}
          />
        )}
      </div>
      <span className="max-w-[60px] truncate text-[8px] leading-none text-white/70">
        {player.name.split(" ").slice(-1)[0]}
      </span>
    </div>
  )
}

export function MatchRadar({ homeTeam, awayTeam, homeSquad, awaySquad, homePossession = 50 }: MatchRadarProps) {
  const homePlaced = useMemo(() => placeTeam(homeSquad, true), [homeSquad])
  const awayPlaced = useMemo(() => placeTeam(awaySquad, false), [awaySquad])

  const homeColor = homeTeam.cor1 || "#00ffc8"
  const awayColor = awayTeam.cor1 || "#ef4444"

  // Bola: vertical no meio, horizontal puxando para o lado com mais posse
  const ballX = 0.5 + (homePossession - 50) / 100 * 0.5

  return (
    <div className="flex flex-col items-center gap-3">
      {/* Cabecalho dos times */}
      <div className="flex w-full items-center justify-between px-1 text-[11px] font-semibold uppercase tracking-wider">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: homeColor }} />
          <span className="text-white/80">{homeTeam.curto}</span>
        </span>
        <span className="flex items-center gap-1.5">
          <span className="text-white/80">{awayTeam.curto}</span>
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: awayColor }} />
        </span>
      </div>

      {/* Campo (pitch) — orientacao horizontal */}
      <div
        className="relative w-full max-w-[440px] overflow-hidden rounded-xl border border-white/10"
        style={{
          aspectRatio: "4 / 3",
          background: "linear-gradient(90deg, #0f2a1e 0%, #123524 50%, #0f2a1e 100%)",
        }}
        role="img"
        aria-label="Radar de posicionamento dos times em campo"
      >
        {/* Listras do gramado (verticais) */}
        <div className="pointer-events-none absolute inset-0 flex flex-row">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="flex-1"
              style={{ background: i % 2 === 0 ? "rgba(255,255,255,0.025)" : "transparent" }}
            />
          ))}
        </div>

        {/* Marcacoes do campo */}
        <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 133 100" preserveAspectRatio="none">
          <g fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="0.5">
            {/* Borda */}
            <rect x="3" y="3" width="127" height="94" />
            {/* Linha de meio-campo (vertical) */}
            <line x1="66.5" y1="3" x2="66.5" y2="97" />
            {/* Circulo central */}
            <circle cx="66.5" cy="50" r="11" />
            <circle cx="66.5" cy="50" r="0.8" fill="rgba(255,255,255,0.5)" />
            {/* Grande area esquerda (casa) */}
            <rect x="3" y="26" width="24" height="48" />
            <rect x="3" y="38" width="8" height="24" />
            {/* Grande area direita (fora) */}
            <rect x="106" y="26" width="24" height="48" />
            <rect x="122" y="38" width="8" height="24" />
          </g>
        </svg>

        {/* Jogadores */}
        {homePlaced.map((p) => (
          <PlayerDot key={`h-${p.id}`} player={p} color={homeColor} textColor={getTextColor(homeColor)} />
        ))}
        {awayPlaced.map((p) => (
          <PlayerDot key={`a-${p.id}`} player={p} color={awayColor} textColor={getTextColor(awayColor)} />
        ))}

        {/* Bola (reflete posse) */}
        <div
          className="absolute h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow-[0_0_8px_rgba(255,255,255,0.8)] transition-all duration-1000 ease-out"
          style={{ left: `${ballX * 100}%`, top: "50%" }}
        />
      </div>

      {/* Legenda */}
      <p className="text-center text-[10px] text-white/40">
        A bola acompanha a posse de bola. Indicadores mostram jogadores cansados.
      </p>
    </div>
  )
}

// Decide texto preto ou branco conforme luminancia da cor de fundo
function getTextColor(hex: string): string {
  const c = hex.replace("#", "")
  if (c.length < 6) return "#fff"
  const r = parseInt(c.slice(0, 2), 16)
  const g = parseInt(c.slice(2, 4), 16)
  const b = parseInt(c.slice(4, 6), 16)
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return luminance > 0.6 ? "#0a0a0a" : "#ffffff"
}
