"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import {
  createInitialState,
  startMatch,
  tickMinute,
  getFootballClock,
  resolvePendingPenalty,
  SPEED_TICKS_PER_SEC,
  type MatchConfig,
  type MatchEvent,
  type MatchState,
  type MatchSpeed,
  type SquadPlayer,
  type PenaltyOutcome,
} from "@/lib/match-engine"

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
  // Registra um evento vindo da UI (substituição) na timeline da partida
  addEvent: (ev: Omit<MatchEvent, "id" | "minute" | "addedTime">) => void
  // Simular até o fim instantaneamente
  fastForward: () => void
  /**
   * Cobra o penalti pendente com o batedor escolhido pelo usuario.
   * Enquanto houver penalti pendente o relogio fica parado, entao isto e o que
   * destrava a partida.
   */
  takePenalty: (taker: SquadPlayer | null) => PenaltyOutcome | null
}

export function useMatchSimulation(config: MatchConfig | null): UseMatchSimulation {
  const [state, setState] = useState<MatchState>(() => createInitialState())
  const [speed, setSpeed] = useState<MatchSpeed>("normal")
  const [isRunning, setIsRunning] = useState(false)

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
    const intervalMs = Math.max(33, Math.floor(1000 / ticksPerSec))

    timerRef.current = setInterval(() => {
      const cfg = configRef.current
      if (!cfg) return
      const current = stateRef.current
      if (current.phase === "fulltime") {
        stopTimer()
        setIsRunning(false)
        return
      }
      // No intervalo, tickMinute devolve o relogio para 45' e sai do halftime num tick.
      const next = tickMinute(current, cfg)
      stateRef.current = next
      setState(next)
    }, intervalMs)
  }, [stopTimer])

  const start = useCallback(() => {
    const cfg = configRef.current
    console.log("[v0] start() called, config:", cfg)
    if (!cfg) {
      console.log("[v0] config is null, aborting start")
      return
    }
    const initial = startMatch(stateRef.current.phase === "pre"
      ? createInitialState()
      : stateRef.current)
    console.log("[v0] initial state:", initial)
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

  /**
   * Registra na timeline um evento criado pela UI (ex.: substituicao). O minuto vem do
   * relogio do motor, entao uma troca no acrescimo aparece como "90+2'".
   */
  const addEvent = useCallback((ev: Omit<MatchEvent, "id" | "minute" | "addedTime">) => {
    const current = stateRef.current
    const next: MatchState = {
      ...current,
      events: [
        {
          id: Math.random().toString(36).slice(2, 9),
          ...getFootballClock(current, configRef.current ?? undefined),
          ...ev,
        },
        ...current.events,
      ],
    }
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
      // tickMinute nao avanca enquanto houver penalti pendente — sem resolver aqui,
      // o "avancar" ficaria girando em falso ate estourar o safety. O motor bate.
      if (cur.pendingPenalty) {
        cur = resolvePendingPenalty(cur, cfg, null).state
        continue
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

  // Devolve o desfecho para a UI narrar ("chutou... eeee... GOOOL!").
  const takePenalty = useCallback((taker: SquadPlayer | null): PenaltyOutcome | null => {
    const cfg = configRef.current
    if (!cfg) return null
    const { state: next, outcome } = resolvePendingPenalty(stateRef.current, cfg, taker)
    stateRef.current = next
    setState(next)
    return outcome
  }, [])

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
    addEvent,
    fastForward,
    takePenalty,
  }
}
