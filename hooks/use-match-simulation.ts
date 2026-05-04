"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import {
  createInitialState,
  startMatch,
  tickMinute,
  SPEED_TICKS_PER_SEC,
  type MatchConfig,
  type MatchState,
  type MatchSpeed,
} from "@/lib/match-engine"
import { usePerformance } from "@/components/performance-provider"

export interface UseMatchSimulation {
  state: MatchState
  speed: MatchSpeed
  isRunning: boolean
  start: () => void
  pause: () => void
  resume: () => void
  reset: () => void
  setSpeed: (s: MatchSpeed) => void
  // Atalho para forçar um gol (botão de teste / DEV)
  forceGoal: (side: "home" | "away") => void
  // Simular até o fim instantaneamente
  fastForward: () => void
}

export function useMatchSimulation(config: MatchConfig | null): UseMatchSimulation {
  const [state, setState] = useState<MatchState>(() => createInitialState())
  const [speed, setSpeed] = useState<MatchSpeed>("normal")
  const [isRunning, setIsRunning] = useState(false)
  
  // Use performance settings for tick rate optimization
  const { tickRate: perfTickRate, isLowPerformance } = usePerformance()

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const stateRef = useRef(state)
  const configRef = useRef(config)

  useEffect(() => { stateRef.current = state }, [state])
  useEffect(() => { configRef.current = config }, [config])

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
  }, [])

  const startTimer = useCallback((spd: MatchSpeed) => {
    stopTimer()
    const ticksPerSec = SPEED_TICKS_PER_SEC[spd]
    // Use performance tick rate as minimum interval for low-end devices
    const minInterval = isLowPerformance ? Math.max(perfTickRate, 100) : 33
    const intervalMs = Math.max(minInterval, Math.floor(1000 / ticksPerSec))

    timerRef.current = setInterval(() => {
      const cfg = configRef.current
      if (!cfg) return
      const current = stateRef.current
      if (current.phase === "fulltime") {
        stopTimer()
        setIsRunning(false)
        return
      }
      // No intervalo, pula automaticamente após 1 tick
      if (current.phase === "halftime") {
        const next = { ...current, phase: "second" as const }
        stateRef.current = next
        setState(next)
        return
      }
      const next = tickMinute(current, cfg)
      stateRef.current = next
      setState(next)
    }, intervalMs)
  }, [stopTimer, isLowPerformance, perfTickRate])

  const start = useCallback(() => {
    const cfg = configRef.current
    if (!cfg) return
    const initial = startMatch(stateRef.current.phase === "pre"
      ? createInitialState()
      : stateRef.current)
    stateRef.current = initial
    setState(initial)
    setIsRunning(true)
    startTimer(speed)
  }, [speed, startTimer])

  const pause = useCallback(() => {
    stopTimer()
    setIsRunning(false)
  }, [stopTimer])

  const resume = useCallback(() => {
    if (stateRef.current.phase === "pre") {
      start()
      return
    }
    if (stateRef.current.phase === "fulltime") return
    setIsRunning(true)
    startTimer(speed)
  }, [speed, start, startTimer])

  const reset = useCallback(() => {
    stopTimer()
    const fresh = createInitialState()
    stateRef.current = fresh
    setState(fresh)
    setIsRunning(false)
  }, [stopTimer])

  const changeSpeed = useCallback((s: MatchSpeed) => {
    setSpeed(s)
    if (isRunning) {
      startTimer(s)
    }
  }, [isRunning, startTimer])

  const forceGoal = useCallback((side: "home" | "away") => {
    const current = stateRef.current
    const next: MatchState = {
      ...current,
      home: { ...current.home },
      away: { ...current.away },
      events: current.events.slice(),
    }
    if (side === "home") next.home.goals += 1
    else next.away.goals += 1
    next.events = [
      {
        id: Math.random().toString(36).slice(2, 9),
        minute: current.minute,
        type: "goal",
        side,
        text: `GOOOOL! ${side === "home" ? "Mandante" : "Visitante"} marca!`,
        important: true,
      },
      ...next.events,
    ]
    next.flash = { side, type: "goal" }
    stateRef.current = next
    setState(next)
  }, [])

  const fastForward = useCallback(() => {
    const cfg = configRef.current
    if (!cfg) return
    stopTimer()
    let cur = stateRef.current
    if (cur.phase === "pre") cur = startMatch(cur)
    let safety = 200
    while (cur.phase !== "fulltime" && safety-- > 0) {
      if (cur.phase === "halftime") {
        cur = { ...cur, phase: "second" }
      }
      cur = tickMinute(cur, cfg)
    }
    stateRef.current = cur
    setState(cur)
    setIsRunning(false)
  }, [stopTimer])

  // Cleanup
  useEffect(() => {
    return () => stopTimer()
  }, [stopTimer])

  return {
    state,
    speed,
    isRunning,
    start,
    pause,
    resume,
    reset,
    setSpeed: changeSpeed,
    forceGoal,
    fastForward,
  }
}
