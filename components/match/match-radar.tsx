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
  x: number // 0-100 (0 = home goal, 100 = away goal)
  y: number // 0-100
  side: "home" | "away"
}

interface MatchRadarProps {
  homeTeam: Team
  awayTeam: Team
  homeSquad: RadarPlayer[]
  awaySquad: RadarPlayer[]
  ball?: BallState
  homePossession?: number
  minute?: number
  phase?: string
}

// ─── Formation Templates ──────────────────────────────────────────────────────
// depth: 0.0 = own goal line, 1.0 = opponent goal line (always from home perspective)
// x: 0.0 = left touchline, 1.0 = right touchline
const FORMATION_TEMPLATES: Record<string, Array<{ depth: number; x: number }>> = {
  "4-3-3": [
    { depth: 0.05, x: 0.50 }, // GK
    { depth: 0.23, x: 0.84 }, // RB
    { depth: 0.18, x: 0.63 }, // CB
    { depth: 0.18, x: 0.37 }, // CB
    { depth: 0.23, x: 0.16 }, // LB
    { depth: 0.44, x: 0.50 }, // CDM/VOL
    { depth: 0.56, x: 0.28 }, // CM-L
    { depth: 0.56, x: 0.72 }, // CM-R
    { depth: 0.82, x: 0.16 }, // LW
    { depth: 0.90, x: 0.50 }, // ST
    { depth: 0.82, x: 0.84 }, // RW
  ],
  "4-4-2": [
    { depth: 0.05, x: 0.50 }, // GK
    { depth: 0.23, x: 0.84 }, // RB
    { depth: 0.18, x: 0.63 }, // CB
    { depth: 0.18, x: 0.37 }, // CB
    { depth: 0.23, x: 0.16 }, // LB
    { depth: 0.52, x: 0.84 }, // RM
    { depth: 0.48, x: 0.63 }, // CM-R
    { depth: 0.48, x: 0.37 }, // CM-L
    { depth: 0.52, x: 0.16 }, // LM
    { depth: 0.86, x: 0.63 }, // ST-R
    { depth: 0.86, x: 0.37 }, // ST-L
  ],
  "4-2-3-1": [
    { depth: 0.05, x: 0.50 }, // GK
    { depth: 0.23, x: 0.84 }, // RB
    { depth: 0.18, x: 0.63 }, // CB
    { depth: 0.18, x: 0.37 }, // CB
    { depth: 0.23, x: 0.16 }, // LB
    { depth: 0.40, x: 0.62 }, // CDM-R
    { depth: 0.40, x: 0.38 }, // CDM-L
    { depth: 0.62, x: 0.16 }, // LAM
    { depth: 0.64, x: 0.50 }, // CAM
    { depth: 0.62, x: 0.84 }, // RAM
    { depth: 0.90, x: 0.50 }, // ST
  ],
  "3-5-2": [
    { depth: 0.05, x: 0.50 }, // GK
    { depth: 0.18, x: 0.72 }, // CB-R
    { depth: 0.18, x: 0.50 }, // CB-C
    { depth: 0.18, x: 0.28 }, // CB-L
    { depth: 0.40, x: 0.93 }, // RWB
    { depth: 0.48, x: 0.70 }, // CM-R
    { depth: 0.48, x: 0.50 }, // CM-C
    { depth: 0.48, x: 0.30 }, // CM-L
    { depth: 0.40, x: 0.07 }, // LWB
    { depth: 0.86, x: 0.63 }, // ST-R
    { depth: 0.86, x: 0.37 }, // ST-L
  ],
  "5-3-2": [
    { depth: 0.05, x: 0.50 }, // GK
    { depth: 0.26, x: 0.91 }, // RWB
    { depth: 0.18, x: 0.72 }, // CB-R
    { depth: 0.18, x: 0.50 }, // CB-C
    { depth: 0.18, x: 0.28 }, // CB-L
    { depth: 0.26, x: 0.09 }, // LWB
    { depth: 0.50, x: 0.70 }, // CM-R
    { depth: 0.50, x: 0.50 }, // CM-C
    { depth: 0.50, x: 0.30 }, // CM-L
    { depth: 0.86, x: 0.63 }, // ST-R
    { depth: 0.86, x: 0.37 }, // ST-L
  ],
  "4-1-4-1": [
    { depth: 0.05, x: 0.50 }, // GK
    { depth: 0.23, x: 0.84 }, // RB
    { depth: 0.18, x: 0.63 }, // CB
    { depth: 0.18, x: 0.37 }, // CB
    { depth: 0.23, x: 0.16 }, // LB
    { depth: 0.38, x: 0.50 }, // DM
    { depth: 0.56, x: 0.84 }, // RM
    { depth: 0.56, x: 0.63 }, // CM-R
    { depth: 0.56, x: 0.37 }, // CM-L
    { depth: 0.56, x: 0.16 }, // LM
    { depth: 0.90, x: 0.50 }, // ST
  ],
}

// Detects tactical formation from squad position list
function detectFormation(squad: RadarPlayer[]): string {
  const s = squad.slice(0, 11)
  const def = s.filter(p => ["ZAG", "LD", "LE", "LAT"].includes(p.position)).length
  const mid = s.filter(p => ["VOL", "MEI", "MC", "MD", "ME", "MO"].includes(p.position)).length
  const att = s.filter(p => ["PE", "PD", "ATA", "CA", "SA"].includes(p.position)).length

  if (def >= 5 && mid === 3) return "5-3-2"
  if (def === 3 && mid >= 4 && att === 2) return "3-5-2"
  if (def === 4 && mid === 1 && att >= 4) return "4-1-4-1"
  if (def === 4 && mid <= 2 && att >= 3) return "4-2-3-1"
  if (def === 4 && mid === 4 && att === 2) return "4-4-2"
  if (def === 4 && mid === 3 && att >= 2) return "4-3-3"
  return "4-3-3"
}

// Position sort rank (GK → DEF → MID → ATT)
const POSITION_RANK: Record<string, number> = {
  GOL: 0, GK: 0,
  LD: 1, ZAG: 2, LE: 3, LAT: 2,
  VOL: 4, MC: 5, MEI: 6, MD: 5, ME: 5, MO: 7,
  PD: 8, PE: 8, CA: 9, SA: 9, ATA: 10,
}

// Position group for behavior logic
function posGroup(position: string): "GK" | "DEF" | "MID" | "ATT" {
  const r = POSITION_RANK[position] ?? 5
  if (r === 0) return "GK"
  if (r <= 3) return "DEF"
  if (r <= 7) return "MID"
  return "ATT"
}

interface RadarSlot {
  key: string
  name: string
  number: number
  position: string
  group: "GK" | "DEF" | "MID" | "ATT"
  color: string
  textColor: string
  side: "home" | "away"
  isHome: boolean
  isGK: boolean
  fDepth: number  // formation depth 0=own goal, 1=opponent goal
  fWidth: number  // formation width 0=left, 1=right (already oriented per side)
  seed: number
  sprintPhaseOffset: number  // unique phase offset for sprint animation
}

function buildSlots(squad: RadarPlayer[], isHome: boolean, color: string): RadarSlot[] {
  const starters = [...squad.slice(0, 11)].sort(
    (a, b) => (POSITION_RANK[a.position] ?? 5) - (POSITION_RANK[b.position] ?? 5),
  )
  const formation = detectFormation(squad)
  const template = FORMATION_TEMPLATES[formation] ?? FORMATION_TEMPLATES["4-3-3"]
  const textColor = getTextColor(color)

  return starters.map((p, i) => {
    const slot = template[i] ?? { depth: 0.5, x: 0.5 }
    const group = posGroup(p.position)
    return {
      key: `${isHome ? "h" : "a"}-${p.id}`,
      name: p.name,
      number: p.number,
      position: p.position,
      group,
      color,
      textColor,
      side: isHome ? "home" : "away",
      isHome,
      isGK: group === "GK",
      fDepth: slot.depth,
      fWidth: isHome ? slot.x : 1 - slot.x,
      seed: i * 1.7 + (isHome ? 0 : 0.9),
      sprintPhaseOffset: (i * 2.3 + (isHome ? 0 : 5.5)) % (Math.PI * 2),
    }
  })
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))
const lerp = (a: number, b: number, t: number) => a + (b - a) * t

// Number of ghost segments in the ball's comet trail
const TRAIL_LEN = 6

// Minimum and maximum field depth each group can reach
const GROUP_MIN_DEPTH: Record<string, number> = { GK: 0.03, DEF: 0.10, MID: 0.28, ATT: 0.48 }
const GROUP_MAX_DEPTH: Record<string, number> = { GK: 0.16, DEF: 0.56, MID: 0.76, ATT: 0.97 }

function targetFor(
  slot: RadarSlot,
  bx: number,  // ball x in radar coords: 0 = home goal, 1 = away goal
  by: number,  // ball y in radar coords: 0 = left, 1 = right
  time: number,
): { x: number; y: number } {
  // How much the team is in attack mode (0=deep defending, 1=full attack)
  const attackPhase = slot.isHome ? bx : (1 - bx)

  // Block push: whole team shifts up when attacking, drops back when defending
  // Defenders rise more in attack; attackers drop less in defense
  const blockShiftScale = slot.group === "ATT" ? 0.14
    : slot.group === "MID" ? 0.20
    : slot.group === "DEF" ? 0.24
    : 0.04
  const blockShift = (attackPhase - 0.5) * blockShiftScale * 2

  // Base depth from formation + block shift
  let baseDepth = clamp(
    slot.fDepth + blockShift,
    GROUP_MIN_DEPTH[slot.group] ?? 0.05,
    GROUP_MAX_DEPTH[slot.group] ?? 0.95,
  )

  // Micro-wander (organic random movement)
  const wanderX = Math.sin(time * 0.8 + slot.seed) * 0.007
  const wanderY = Math.cos(time * 0.65 + slot.seed * 1.4) * 0.011

  let x: number

  if (slot.isGK) {
    // GK stays near own line; shifts slightly to close angle vs ball
    const angleInfluence = slot.isHome
      ? clamp((bx - 0.25) * 0.18, 0, 0.09)   // advances a little if ball is far
      : clamp((0.75 - bx) * 0.18, 0, 0.09)
    x = slot.isHome
      ? clamp(0.05 + angleInfluence + wanderX, 0.03, 0.16)
      : clamp(0.95 - angleInfluence + wanderX, 0.84, 0.97)
  } else {
    // Convert depth to field position (home attacks left→right)
    const fieldX = slot.isHome ? baseDepth : (1 - baseDepth)

    // Mild magnetic pull toward ball (compacts team around the action)
    x = lerp(fieldX, bx, 0.06) + wanderX

    // Sprint burst for attackers and wide midfielders (either touchline)
    const isWide = Math.min(slot.fWidth, 1 - slot.fWidth) < 0.25
    if (slot.group === "ATT" || (slot.group === "MID" && isWide)) {
      const period = 8.5 + (slot.seed % 4)  // 8.5–12.5 s per sprint cycle
      const phase = ((time + slot.sprintPhaseOffset) / period) % 1.0
      if (phase > 0.78) {
        // Forward burst during last 22% of cycle, bell-curve shaped
        const t = (phase - 0.78) / 0.22
        const sprintDx = Math.sin(t * Math.PI) * 0.10
        x += slot.isHome ? sprintDx : -sprintDx
      }
    }

    x = clamp(x, 0.04, 0.96)
  }

  // Width: team shifts toward the side of the ball (realistic lateral compaction)
  let y: number
  if (slot.isGK) {
    // GK covers angles: shifts to ball side
    y = clamp(0.5 + (by - 0.5) * 0.52, 0.24, 0.76)
  } else {
    const sideShift = (by - 0.5) * 0.32
    y = clamp(slot.fWidth + sideShift + wanderY, 0.04, 0.96)
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

  const awayColor = useMemo(() => {
    const base = awayTeam.cor1 || "#ef4444"
    if (colorDist(base, homeColor) >= 90) return base
    const alt = awayTeam.cor2 || ""
    if (alt && colorDist(alt, homeColor) >= 90) return alt
    const red = "#ef4444"
    const amber = "#f5c400"
    return colorDist(red, homeColor) >= colorDist(amber, homeColor) ? red : amber
  }, [awayTeam.cor1, awayTeam.cor2, homeColor])

  const slots = useMemo(() => [
    ...buildSlots(homeSquad, true, homeColor),
    ...buildSlots(awaySquad, false, awayColor),
  ], [homeSquad, awaySquad, homeColor, awayColor])

  const dotRefs = useRef<Map<string, HTMLDivElement | null>>(new Map())
  const ringRefs = useRef<Map<string, HTMLSpanElement | null>>(new Map())
  const ballRef = useRef<HTMLDivElement | null>(null)
  const ballShadowRef = useRef<HTMLDivElement | null>(null)
  const trailRefs = useRef<Array<HTMLDivElement | null>>([])
  const slotsRef = useRef<RadarSlot[]>(slots)
  const posRef = useRef<Map<string, { x: number; y: number }>>(new Map())
  const ballTargetRef = useRef<{ x: number; y: number; side: "home" | "away" }>({ x: 0.5, y: 0.5, side: "home" })
  const ballPosRef = useRef<{ x: number; y: number }>({ x: 0.5, y: 0.5 })
  const trailRef = useRef<Array<{ x: number; y: number }>>(
    Array.from({ length: TRAIL_LEN }, () => ({ x: 0.5, y: 0.5 })),
  )
  const carrierRef = useRef<string>("")

  useEffect(() => { slotsRef.current = slots }, [slots])

  useEffect(() => {
    const stopped = phase === "pre" || phase === "halftime" || phase === "fulltime"
    if (stopped || !ball) {
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

  useEffect(() => {
    let raf = 0
    let paused = false
    // PERFORMANCE: nao gastar CPU/GPU animando quando a janela esta oculta ou minimizada
    // (comum em PC fraco deixar o jogo de fundo). Ao voltar, retoma o loop.
    const onVisibility = () => {
      const hidden = document.hidden
      if (hidden && !paused) { paused = true; cancelAnimationFrame(raf) }
      else if (!hidden && paused) { paused = false; raf = requestAnimationFrame(animate) }
    }
    // Respeita "reduzir movimento" do SO: em maquinas fracas/aversao a animacao, o radar
    // atualiza a ~30fps em vez de 60, cortando o custo pela metade sem parecer travado.
    const reduceMotion = typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
    let lastFrame = 0
    const animate = () => {
      if (reduceMotion) {
        const now = performance.now()
        if (now - lastFrame < 33) { raf = requestAnimationFrame(animate); return }
        lastFrame = now
      }
      const time = performance.now() / 1000
      const target = ballTargetRef.current

      // Smooth ball toward target — keep previous frame to derive speed
      const bp = ballPosRef.current
      const prevBx = bp.x
      const prevBy = bp.y
      bp.x = lerp(bp.x, target.x, 0.10)
      bp.y = lerp(bp.y, target.y, 0.10)

      // Ball speed (per frame, normalised units) drives trail + lift + squash
      const speed = Math.hypot(bp.x - prevBx, bp.y - prevBy)
      const speedNorm = clamp(speed / 0.012, 0, 1)

      // Find ball carrier: closest field player on the team in possession
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
      carrierRef.current = carrierKey

      for (const s of currentSlots) {
        const { x: tx, y: ty } = targetFor(s, bp.x, bp.y, time)

        let x = tx
        let y = ty

        // Carrier sticks closer to ball
        if (s.key === carrierKey) {
          x = lerp(tx, bp.x, 0.55)
          y = lerp(ty, bp.y, 0.55)
        }

        const prev = posRef.current.get(s.key) ?? { x, y }
        const ease = s.key === carrierKey ? 0.22 : 0.08
        const nx = lerp(prev.x, x, ease)
        const ny = lerp(prev.y, y, ease)
        posRef.current.set(s.key, { x: nx, y: ny })

        const el = dotRefs.current.get(s.key)
        if (el) {
          el.style.left = `${nx * 100}%`
          el.style.top = `${ny * 100}%`
          // Players near the ball stack above the rest, so the action is never occluded
          const dist = Math.hypot(nx - bp.x, ny - bp.y)
          const near = clamp(1 - dist / 0.22, 0, 1)
          el.style.zIndex = s.key === carrierKey ? "9" : String(2 + Math.round(near * 3))
        }

        // Possession ring only around the carrier
        const ring = ringRefs.current.get(s.key)
        if (ring) {
          const on = s.key === carrierKey
          ring.style.opacity = on ? "1" : "0"
          ring.style.transform = on
            ? `scale(${(1.15 + Math.sin(time * 5.2) * 0.14).toFixed(3)})`
            : "scale(0.9)"
        }
      }

      // Comet trail: each segment chases the one in front of it
      const trail = trailRef.current
      for (let i = 0; i < trail.length; i++) {
        const lead = i === 0 ? bp : trail[i - 1]
        trail[i].x = lerp(trail[i].x, lead.x, 0.42)
        trail[i].y = lerp(trail[i].y, lead.y, 0.42)
        const el = trailRefs.current[i]
        if (el) {
          el.style.left = `${trail[i].x * 100}%`
          el.style.top = `${trail[i].y * 100}%`
          const fade = (1 - i / trail.length) ** 2
          el.style.opacity = (fade * 0.55 * speedNorm).toFixed(3)
          el.style.width = `${(7 - i * 0.9).toFixed(1)}px`
          el.style.height = `${(7 - i * 0.9).toFixed(1)}px`
        }
      }

      if (ballRef.current) {
        ballRef.current.style.left = `${bp.x * 100}%`
        ballRef.current.style.top = `${bp.y * 100}%`
        // Fast ball rides slightly higher off the turf and stretches along its path
        const lift = speedNorm * 2.6
        const stretch = 1 + speedNorm * 0.35
        const angle = (Math.atan2(bp.y - prevBy, bp.x - prevBx) * 180) / Math.PI
        ballRef.current.style.transform =
          `translate(-50%, calc(-50% - ${lift.toFixed(2)}px)) rotate(${angle.toFixed(1)}deg) scale(${stretch.toFixed(3)}, ${(1 / stretch).toFixed(3)})`
      }
      if (ballShadowRef.current) {
        ballShadowRef.current.style.left = `${bp.x * 100}%`
        ballShadowRef.current.style.top = `${bp.y * 100}%`
        ballShadowRef.current.style.opacity = (0.5 - speedNorm * 0.22).toFixed(2)
      }

      raf = requestAnimationFrame(animate)
    }
    raf = requestAnimationFrame(animate)
    document.addEventListener("visibilitychange", onVisibility)
    return () => {
      cancelAnimationFrame(raf)
      document.removeEventListener("visibilitychange", onVisibility)
    }
  }, [])

  return (
    <div className="flex flex-1 min-h-0 flex-col items-center gap-2">
      {/* Team labels */}
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

      {/* Pitch */}
      <div
        className="relative w-full flex-1 overflow-hidden rounded-xl border border-white/10"
        style={{
          background:
            "radial-gradient(120% 90% at 50% -10%, #1c5238 0%, #164632 42%, #0f3324 78%, #0a2419 100%)",
          boxShadow: "inset 0 0 60px rgba(0,0,0,0.55)",
        }}
        role="img"
        aria-label="Posicionamento tático em tempo real"
      >
        {/* Mowed turf stripes */}
        <div className="pointer-events-none absolute inset-0">
          {Array.from({ length: 12 }).map((_, i) => (
            <div
              key={i}
              className="absolute top-0 h-full"
              style={{
                left: `${(i * 100) / 12}%`,
                width: `${100 / 12}%`,
                background: i % 2 === 0 ? "rgba(255,255,255,0.035)" : "rgba(0,0,0,0.05)",
              }}
            />
          ))}
        </div>

        {/* Floodlight pools — four stadium corners */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(60% 55% at 15% 12%, rgba(255,255,235,0.10), transparent 70%)," +
              "radial-gradient(60% 55% at 85% 12%, rgba(255,255,235,0.10), transparent 70%)," +
              "radial-gradient(60% 55% at 15% 88%, rgba(255,255,235,0.08), transparent 70%)," +
              "radial-gradient(60% 55% at 85% 88%, rgba(255,255,235,0.08), transparent 70%)",
          }}
        />

        {/* Field markings */}
        <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 133 100" preserveAspectRatio="none">
          <defs>
            <pattern id="radar-net" width="1.6" height="1.6" patternUnits="userSpaceOnUse">
              <path d="M 1.6 0 L 0 0 0 1.6" fill="none" stroke="rgba(255,255,255,0.28)" strokeWidth="0.18" />
            </pattern>
          </defs>

          <g fill="none" stroke="rgba(255,255,255,0.42)" strokeWidth="0.55" strokeLinecap="round">
            {/* Outer border */}
            <rect x="3" y="3" width="127" height="94" />
            {/* Halfway line */}
            <line x1="66.5" y1="3" x2="66.5" y2="97" />
            {/* Centre circle */}
            <circle cx="66.5" cy="50" r="11" />
            {/* Home penalty area */}
            <rect x="3" y="26" width="24" height="48" />
            <rect x="3" y="38" width="8" height="24" />
            {/* Away penalty area */}
            <rect x="106" y="26" width="24" height="48" />
            <rect x="122" y="38" width="8" height="24" />
            {/* Penalty arcs */}
            <path d="M 27 41.5 A 11 11 0 0 0 27 58.5" />
            <path d="M 106 41.5 A 11 11 0 0 1 106 58.5" />
            {/* Corner arcs */}
            <path d="M 3 6 A 3 3 0 0 0 6 3" />
            <path d="M 127 3 A 3 3 0 0 0 130 6" />
            <path d="M 6 97 A 3 3 0 0 0 3 94" />
            <path d="M 130 94 A 3 3 0 0 0 127 97" />
          </g>

          {/* Centre + penalty spots */}
          <g fill="rgba(255,255,255,0.5)">
            <circle cx="66.5" cy="50" r="0.7" />
            <circle cx="14" cy="50" r="0.7" />
            <circle cx="119" cy="50" r="0.7" />
          </g>

          {/* Goals with nets */}
          <g>
            <rect x="0.4" y="43" width="2.6" height="14" fill="url(#radar-net)" />
            <rect x="0.4" y="43" width="2.6" height="14" fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth="0.4" />
            <rect x="130" y="43" width="2.6" height="14" fill="url(#radar-net)" />
            <rect x="130" y="43" width="2.6" height="14" fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth="0.4" />
          </g>
        </svg>

        {/* Players */}
        {slots.map((s) => {
          const init = posRef.current.get(s.key)
          const left = init ? init.x : (s.isHome ? s.fDepth * 0.94 + 0.03 : (1 - s.fDepth) * 0.94 + 0.03)
          const top = init ? init.y : s.fWidth
          const size = s.isGK ? 24 : 22
          return (
            <div
              key={s.key}
              ref={(el) => { dotRefs.current.set(s.key, el) }}
              className="absolute z-[2] -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-0.5 will-change-[left,top]"
              style={{ left: `${left * 100}%`, top: `${top * 100}%` }}
            >
              <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
                {/* Ground shadow — sells the "above the turf" depth */}
                <span
                  className="pointer-events-none absolute rounded-[50%]"
                  style={{
                    width: size * 0.92,
                    height: size * 0.32,
                    bottom: -3,
                    background: "rgba(0,0,0,0.42)",
                    filter: "blur(2px)",
                  }}
                />
                {/* Possession ring — driven per-frame for the ball carrier */}
                <span
                  ref={(el) => { ringRefs.current.set(s.key, el) }}
                  className="pointer-events-none absolute inset-[-5px] rounded-full opacity-0 transition-opacity duration-200"
                  style={{
                    border: `2px solid ${s.color}`,
                    boxShadow: `0 0 10px ${s.color}, inset 0 0 6px ${s.color}`,
                  }}
                />
                <span
                  className="relative flex h-full w-full items-center justify-center rounded-full font-bold"
                  style={{
                    background: `radial-gradient(circle at 35% 28%, ${lighten(s.color, 0.28)}, ${s.color} 70%)`,
                    color: s.textColor,
                    fontSize: 10,
                    outline: s.isGK ? "2px solid rgba(255,255,255,0.92)" : "1.5px solid rgba(255,255,255,0.6)",
                    boxShadow: "0 3px 7px rgba(0,0,0,0.6), inset 0 -2px 4px rgba(0,0,0,0.28)",
                  }}
                >
                  {s.number}
                </span>
              </div>
              <span
                className="max-w-[58px] truncate rounded px-1 text-[7.5px] leading-[1.35] text-white/85"
                style={{ background: "rgba(0,0,0,0.42)" }}
              >
                {s.name.split(" ").slice(-1)[0]}
              </span>
            </div>
          )
        })}

        {/* Ball trail */}
        {Array.from({ length: TRAIL_LEN }).map((_, i) => (
          <div
            key={i}
            ref={(el) => { trailRefs.current[i] = el }}
            className="pointer-events-none absolute z-[8] -translate-x-1/2 -translate-y-1/2 rounded-full bg-white opacity-0 will-change-[left,top,opacity]"
            style={{ left: "50%", top: "50%", width: 7, height: 7, filter: "blur(1.5px)" }}
          />
        ))}

        {/* Ball ground shadow */}
        <div
          ref={ballShadowRef}
          className="pointer-events-none absolute z-[9] rounded-[50%] will-change-[left,top]"
          style={{
            left: "50%",
            top: "50%",
            width: 10,
            height: 4,
            transform: "translate(-50%, 130%)",
            background: "rgba(0,0,0,0.55)",
            filter: "blur(2px)",
          }}
        />

        {/* Ball */}
        <div
          ref={ballRef}
          className="pointer-events-none absolute z-10 will-change-[left,top,transform]"
          style={{ left: "50%", top: "50%", transform: "translate(-50%, -50%)" }}
        >
          <div className="h-[11px] w-[11px] rounded-full bg-white shadow-[0_0_14px_rgba(255,255,255,0.95),0_0_5px_rgba(255,255,255,1)]" />
        </div>
      </div>

      {/* Possession bar */}
      <div className="w-full shrink-0 space-y-1">
        <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full transition-[width] duration-700 ease-out"
            style={{ width: `${clamp(homePossession, 0, 100)}%`, background: homeColor }}
          />
          <div className="h-full flex-1" style={{ background: awayColor }} />
        </div>
        <div className="flex items-center justify-between text-[9px] text-white/45">
          <span>{Math.round(homePossession)}% posse</span>
          <span>Posicionamento tático em tempo real</span>
          <span>{100 - Math.round(homePossession)}%</span>
        </div>
      </div>
    </div>
  )
}

// Euclidean distance between two hex colors in RGB space (0..441)
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

// Blends a hex color toward white (t = 0..1) for the dot's top-light highlight
function lighten(hex: string, t: number): string {
  const p = hexToRgb(hex)
  if (!p) return hex
  const mix = (c: number) => Math.round(c + (255 - c) * t)
  return `rgb(${mix(p.r)}, ${mix(p.g)}, ${mix(p.b)})`
}

function getTextColor(hex: string): string {
  const c = hex.replace("#", "")
  if (c.length < 6) return "#fff"
  const r = parseInt(c.slice(0, 2), 16)
  const g = parseInt(c.slice(2, 4), 16)
  const b = parseInt(c.slice(4, 6), 16)
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return luminance > 0.6 ? "#0a0a0a" : "#ffffff"
}
