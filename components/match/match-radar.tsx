"use client"

import { useEffect, useMemo, useRef } from "react"
import type { Team } from "@/lib/teams-data"

interface RadarPlayer {
  id: number
  name: string
  number: number
  position: string
  rating?: number
  stamina?: number
}

interface BallState {
  x: number // 0-100 (0 = gol da casa, 100 = gol visitante)
  y: number // 0-100 (largura)
  side: "home" | "away"
}

interface MatchRadarProps {
  homeTeam: Team
  awayTeam: Team
  homeSquad: RadarPlayer[]
  awaySquad: RadarPlayer[]
  /** Posicao real da bola vinda da engine (preferencial) */
  ball?: BallState
  /** Posse de bola da casa (0-100) — fallback quando 'ball' nao e fornecido */
  homePossession?: number
  /** Minuto atual — usado apenas como gatilho de atualizacao */
  minute?: number
  /** Fase da partida — em fases paradas a bola volta ao centro */
  phase?: string
}

// Ordem das posicoes da defesa ao ataque, para mapear o elenco em slots.
const POSITION_RANK: Record<string, number> = {
  GOL: 0, GK: 0,
  LD: 1, ZAG: 2, LE: 3, LAT: 1,
  VOL: 4, MC: 5, MEI: 6, MD: 5, ME: 5, MO: 7,
  PD: 8, PE: 8, SA: 9, CA: 10, ATA: 10,
}

// Template de formacao 4-3-3 (depth: 0 = proprio gol, 1 = ataque; x: 0 esq, 1 dir).
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

interface RadarSlot {
  key: string
  name: string
  number: number
  color: string
  textColor: string
  side: "home" | "away"
  isHome: boolean
  isGK: boolean
  fDepth: number // posicao na formacao (0 gol .. 1 ataque)
  fWidth: number // largura ja orientada (0..1) em coordenadas do radar
  seed: number
}

// Constroi os slots fixos (formacao) que servirao de base para a animacao.
function buildSlots(squad: RadarPlayer[], isHome: boolean, color: string): RadarSlot[] {
  const starters = [...squad.slice(0, 11)].sort(
    (a, b) => (POSITION_RANK[a.position] ?? 5) - (POSITION_RANK[b.position] ?? 5),
  )
  const textColor = getTextColor(color)
  return starters.map((p, i) => {
    const slot = FORMATION_433[i] ?? { depth: 0.5, x: 0.5 }
    return {
      key: `${isHome ? "h" : "a"}-${p.id}`,
      name: p.name,
      number: p.number,
      color,
      textColor,
      side: isHome ? "home" : "away",
      isHome,
      isGK: (POSITION_RANK[p.position] ?? 5) === 0,
      fDepth: slot.depth,
      // Largura espelhada para o visitante, para as formacoes ficarem simetricas
      fWidth: isHome ? slot.x : 1 - slot.x,
      seed: i * 1.7 + (isHome ? 0 : 0.9),
    }
  })
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))
const lerp = (a: number, b: number, t: number) => a + (b - a) * t

// Calcula a posicao alvo (0..1 no radar) de um jogador conforme a posicao da bola.
// Modelo de bloco compacto: o time inteiro desliza pelo campo seguindo a bola —
// a defesa sobe ao atacar e o ataque recua ao defender.
function targetFor(
  slot: RadarSlot,
  bx: number, // bola 0..1 no eixo comprimento (radar)
  by: number, // bola 0..1 no eixo largura (radar)
  time: number,
): { x: number; y: number } {
  // Centro do bloco acompanha a bola, com folga e limites (mantem compacidade)
  const centerX = clamp(0.5 + (bx - 0.5) * 0.85, 0.2, 0.8)
  const wanderX = Math.sin(time * 0.7 + slot.seed) * 0.006
  const wanderY = Math.cos(time * 0.6 + slot.seed * 1.3) * 0.009

  let x: number
  if (slot.isGK) {
    // Goleiro fica colado ao proprio gol, com leve acompanhamento do bloco
    x = slot.isHome
      ? clamp(0.045 + (centerX - 0.5) * 0.06, 0.03, 0.11)
      : clamp(0.955 + (centerX - 0.5) * 0.06, 0.89, 0.97)
  } else {
    // Jogadores de linha espalhados ao redor do centro do bloco (~50% do campo)
    const spread = (slot.fDepth - 0.5) * 0.5
    x = slot.isHome ? centerX + spread : centerX - spread
    // Leve atracao em direcao a bola (compacta o time perto da jogada)
    x += (bx - x) * 0.08
    x = clamp(x + wanderX, 0.04, 0.96)
  }

  // Largura: time desliza para o lado da bola, com leve compactacao
  let y: number
  if (slot.isGK) {
    y = clamp(0.5 + (by - 0.5) * 0.45, 0.3, 0.7)
  } else {
    const shiftY = (by - 0.5) * 0.26
    y = slot.fWidth + shiftY + (by - slot.fWidth) * 0.1
    y = clamp(y + wanderY, 0.06, 0.94)
  }

  return { x, y }
}

export function MatchRadar({
  homeTeam,
  awayTeam,
  homeSquad,
  awaySquad,
  ball,
  homePossession = 50,
  minute = 0,
  phase = "first",
}: MatchRadarProps) {
  const homeColor = homeTeam.cor1 || "#00ffc8"
  // Garante que os times sejam distinguiveis: se as cores forem proximas
  // (ex: dois times de branco), usa a cor secundaria/fallback do visitante.
  const awayColor = useMemo(() => {
    const base = awayTeam.cor1 || "#ef4444"
    if (colorDist(base, homeColor) >= 90) return base
    const alt = awayTeam.cor2 || ""
    if (alt && colorDist(alt, homeColor) >= 90) return alt
    // Fallback final: vermelho ou ambar, o que contrastar mais com a casa
    const red = "#ef4444"
    const amber = "#f5c400"
    return colorDist(red, homeColor) >= colorDist(amber, homeColor) ? red : amber
  }, [awayTeam.cor1, awayTeam.cor2, homeColor])

  const slots = useMemo(() => {
    return [
      ...buildSlots(homeSquad, true, homeColor),
      ...buildSlots(awaySquad, false, awayColor),
    ]
  }, [homeSquad, awaySquad, homeColor, awayColor])

  // Refs para escrever posicoes direto no DOM (animacao fluida sem re-render)
  const dotRefs = useRef<Map<string, HTMLDivElement | null>>(new Map())
  const ballRef = useRef<HTMLDivElement | null>(null)
  const slotsRef = useRef<RadarSlot[]>(slots)
  const posRef = useRef<Map<string, { x: number; y: number }>>(new Map())
  // Alvo atual da bola (0..1 no radar) + lado de posse
  const ballTargetRef = useRef<{ x: number; y: number; side: "home" | "away" }>({ x: 0.5, y: 0.5, side: "home" })
  const ballPosRef = useRef<{ x: number; y: number }>({ x: 0.5, y: 0.5 })

  useEffect(() => { slotsRef.current = slots }, [slots])

  // Atualiza o alvo da bola quando o estado da partida muda
  useEffect(() => {
    const stopped = phase === "pre" || phase === "halftime" || phase === "fulltime"
    if (stopped || !ball) {
      // Fallback: desliza horizontalmente pela posse, centralizado
      const bx = stopped ? 0.5 : clamp(0.5 + (homePossession - 50) / 100 * 0.5, 0.1, 0.9)
      ballTargetRef.current = { x: bx, y: 0.5, side: homePossession >= 50 ? "home" : "away" }
    } else {
      ballTargetRef.current = {
        x: clamp(ball.x / 100, 0.02, 0.98),
        y: clamp(ball.y / 100, 0.03, 0.97),
        side: ball.side,
      }
    }
  }, [ball, homePossession, minute, phase])

  // Loop de animacao continuo
  useEffect(() => {
    let raf = 0
    const animate = () => {
      const time = performance.now() / 1000
      const target = ballTargetRef.current

      // Suaviza a bola em direcao ao alvo
      const bp = ballPosRef.current
      bp.x = lerp(bp.x, target.x, 0.12)
      bp.y = lerp(bp.y, target.y, 0.12)

      // Encontra o portador da bola (jogador do time com posse mais proximo)
      const currentSlots = slotsRef.current
      let carrierKey = ""
      let bestDist = Infinity
      for (const s of currentSlots) {
        if (s.side !== target.side || s.isGK) continue
        const cur = posRef.current.get(s.key)
        const px = cur?.x ?? 0.5
        const py = cur?.y ?? 0.5
        const d = (px - bp.x) ** 2 + (py - bp.y) ** 2
        if (d < bestDist) { bestDist = d; carrierKey = s.key }
      }

      // Posiciona cada jogador
      for (const s of currentSlots) {
        let { x, y } = targetFor(s, bp.x, bp.y, time)
        // O portador "cola" na bola
        if (s.key === carrierKey) {
          x = lerp(x, bp.x, 0.5)
          y = lerp(y, bp.y, 0.5)
        }
        const prev = posRef.current.get(s.key) ?? { x, y }
        const ease = s.key === carrierKey ? 0.18 : 0.09
        const nx = lerp(prev.x, x, ease)
        const ny = lerp(prev.y, y, ease)
        posRef.current.set(s.key, { x: nx, y: ny })
        const el = dotRefs.current.get(s.key)
        if (el) {
          el.style.left = `${nx * 100}%`
          el.style.top = `${ny * 100}%`
        }
      }

      // Posiciona a bola
      if (ballRef.current) {
        ballRef.current.style.left = `${bp.x * 100}%`
        ballRef.current.style.top = `${bp.y * 100}%`
      }

      raf = requestAnimationFrame(animate)
    }
    raf = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(raf)
  }, [])

  return (
    <div className="flex flex-1 min-h-0 flex-col items-center gap-3">
      {/* Cabecalho dos times */}
      <div className="flex w-full shrink-0 items-center justify-between px-1 text-[11px] font-semibold uppercase tracking-wider">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: homeColor }} />
          <span className="text-white/80">{homeTeam.curto}</span>
        </span>
        <span className="flex items-center gap-1.5">
          <span className="text-white/80">{awayTeam.curto}</span>
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: awayColor }} />
        </span>
      </div>

      {/* Campo (pitch) — preenche toda a area disponivel do painel */}
      <div
        className="relative w-full flex-1 overflow-hidden rounded-xl border border-white/10"
        style={{ background: "#11261D" }}
        role="img"
        aria-label="Radar de posicionamento dos times em campo"
      >
        {/* Marcacoes do campo (com gols) */}
        <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 133 100" preserveAspectRatio="none">
          <g fill="none" stroke="#2B4F3B" strokeWidth="0.7">
            <rect x="3" y="3" width="127" height="94" />
            <line x1="66.5" y1="3" x2="66.5" y2="97" />
            <circle cx="66.5" cy="50" r="11" />
            <circle cx="66.5" cy="50" r="0.8" fill="#2B4F3B" />
            <rect x="3" y="26" width="24" height="48" />
            <rect x="3" y="38" width="8" height="24" />
            <rect x="106" y="26" width="24" height="48" />
            <rect x="122" y="38" width="8" height="24" />
            <rect x="0.5" y="44" width="2.5" height="12" fill="#2B4F3B" fillOpacity="0.4" />
            <rect x="130" y="44" width="2.5" height="12" fill="#2B4F3B" fillOpacity="0.4" />
          </g>
        </svg>

        {/* Jogadores (posicionados pela animacao) */}
        {slots.map((s) => {
          const init = posRef.current.get(s.key)
          const left = init ? init.x : (s.isHome ? 0.03 + s.fDepth * 0.46 : 0.97 - s.fDepth * 0.46)
          const top = init ? init.y : s.fWidth
          return (
            <div
              key={s.key}
              ref={(el) => { dotRefs.current.set(s.key, el) }}
              className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-0.5 will-change-[left,top]"
              style={{ left: `${left * 100}%`, top: `${top * 100}%` }}
            >
              <div
                className="relative flex items-center justify-center rounded-full font-bold ring-2 ring-white/80"
                style={{
                  width: 26,
                  height: 26,
                  background: s.color,
                  color: s.textColor,
                  fontSize: 11,
                  boxShadow: "0 1px 4px rgba(0,0,0,0.6)",
                }}
              >
                {s.number}
              </div>
              <span className="max-w-[64px] truncate text-[8px] leading-none text-white/75">
                {s.name.split(" ").slice(-1)[0]}
              </span>
            </div>
          )
        })}

        {/* Bola (posicao real, controlada pela animacao) */}
        <div
          ref={ballRef}
          className="absolute z-10 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow-[0_0_10px_rgba(255,255,255,0.9)] will-change-[left,top]"
          style={{ left: "50%", top: "50%" }}
        />
      </div>

      {/* Legenda */}
      <p className="shrink-0 text-center text-[10px] text-white/40">
        Os jogadores acompanham a movimentacao da bola em tempo real.
      </p>
    </div>
  )
}

// Distancia euclidiana entre duas cores hex no espaco RGB (0..441)
function colorDist(a: string, b: string): number {
  const pa = hexToRgb(a)
  const pb = hexToRgb(b)
  if (!pa || !pb) return 441
  return Math.sqrt((pa.r - pb.r) ** 2 + (pa.g - pb.g) ** 2 + (pa.b - pb.b) ** 2)
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const c = hex.replace("#", "")
  if (c.length < 6) return null
  return {
    r: parseInt(c.slice(0, 2), 16),
    g: parseInt(c.slice(2, 4), 16),
    b: parseInt(c.slice(4, 6), 16),
  }
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
