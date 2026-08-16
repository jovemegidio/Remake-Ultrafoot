"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import { loadGameState } from "@/lib/save-system"
import {
  createInitialState,
  startMatch,
  tickMinute,
  getFootballClock,
  resolvePendingPenalty,
  resolvePendingVar,
  startShootout,
  takeShootoutKick,
  shootoutAvailableTakers,
  SPEED_TICKS_PER_SEC,
  type MatchConfig,
  type MatchEvent,
  type MatchState,
  type MatchSpeed,
  type SquadPlayer,
  type PenaltyOutcome,
  type ShootoutKick,
  type Side,
} from "@/lib/match-engine"
import {
  aggregateDecisionEffects,
  applyDecision,
  pruneExpired,
  suggestDecision,
  type ActiveDecision,
  type DecisionEffect,
  type MatchDecisionId,
} from "@/lib/match-decisions"
// Habilidade "Fechamento de Casinha" — ver lib/efeito-do-treinador.ts. Lida aqui
// porque este e o unico ponto do jogo recalculado minuto a minuto.
import { efeitosDoTreinador } from "@/lib/efeito-do-treinador"

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
   * Decisões do técnico durante a partida (gritar, pressionar, segurar o
   * resultado...). O lib/match-decisions.ts já existia completo mas nunca foi
   * ligado: a única alavanca ao vivo era a mentalidade.
   */
  activeDecisions: ActiveDecision[]
  /**
   * TODAS as decisões tomadas na partida, inclusive as já expiradas.
   * `activeDecisions` só guarda as que ainda valem neste minuto, então não serve
   * para o balanço do fim de jogo — o técnico que gritou aos 20' teria feito
   * nada aos 90'. Ver `saldoDeMoralDaPartida`.
   */
  decisionHistory: ActiveDecision[]
  /** Efeito agregado que o motor esta usando neste minuto. */
  decisionEffect: DecisionEffect
  /** Sugestão do auxiliar para o momento atual — null quando não há nada a fazer. */
  suggestedDecision: MatchDecisionId | null
  applyCoachDecision: (id: MatchDecisionId) => void
  /**
   * Cobra o penalti pendente com o batedor escolhido pelo usuario.
   * Enquanto houver penalti pendente o relogio fica parado, entao isto e o que
   * destrava a partida.
   */
  takePenalty: (taker: SquadPlayer | null) => PenaltyOutcome | null
  /** Revela a decisao do VAR mantendo o relogio parado durante a animacao. */
  resolveVar: () => void
  /**
   * Abre a disputa de penaltis. Chamado pela tela quando o mata-mata termina
   * empatado — o motor nao decide isso sozinho porque so a tela sabe se este
   * jogo e a partida DECISIVA do confronto (ida e volta x jogo unico).
   */
  beginShootout: () => void
  /** Cobra a proxima penalidade da disputa; devolve o lance para a narracao. */
  kickShootout: (taker: SquadPlayer | null) => ShootoutKick | null
  /** Encerra a disputa e devolve a partida a "fulltime" (pos-jogo normal). */
  endShootout: () => void
  /** Batedores ainda disponiveis de um lado (nao repete antes de todos baterem). */
  shootoutTakers: (side: Side) => SquadPlayer[]
}

/**
 * Traduz a escolha da tela de configuracoes para a escala do motor.
 *
 * Leitura direta do save (sincrona) em vez do hook: assinar o estado inteiro
 * aqui faria a tela da partida re-renderizar a cada gravacao de save, e o que
 * se quer e apenas o valor inicial.
 */
function velocidadeInicial(): MatchSpeed {
  if (typeof window === "undefined") return "normal"
  try {
    const escolha = loadGameState().matchSpeed
    return escolha === "lento" ? "slow" : escolha === "rapido" ? "fast" : "normal"
  } catch {
    return "normal"
  }
}

export function useMatchSimulation(config: MatchConfig | null): UseMatchSimulation {
  const [state, setState] = useState<MatchState>(() => createInitialState())
  // A partida COMECA na velocidade escolhida em Configuracoes > Tempo de jogo.
  // Aquela tela existia com tres botoes que nao faziam nada: o valor morria num
  // useState local da propria tela. Em campo o jogador continua trocando à
  // vontade — isto e so o ponto de partida.
  const [speed, setSpeed] = useState<MatchSpeed>(() => velocidadeInicial())
  const [isRunning, setIsRunning] = useState(false)
  const [activeDecisions, setActiveDecisions] = useState<ActiveDecision[]>([])
  const [decisionHistory, setDecisionHistory] = useState<ActiveDecision[]>([])

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const stateRef = useRef(state)
  const configRef = useRef(config)
  const activeDecisionsRef = useRef(activeDecisions)

  useEffect(() => { stateRef.current = state }, [state])
  useEffect(() => { configRef.current = config }, [config])
  useEffect(() => { activeDecisionsRef.current = activeDecisions }, [activeDecisions])

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
      const effect = aggregateDecisionEffects(activeDecisionsRef.current, current.minute, efeitosDoTreinador().defesaNoFinal)
      const liveConfig = cfg.userSide === "away"
        ? { ...cfg, awayCoachEffect: effect }
        : { ...cfg, homeCoachEffect: effect }
      const next = tickMinute(current, liveConfig)
      stateRef.current = next
      setState(next)
      // Decisões têm duração: expiram sozinhas conforme o relógio anda.
      setActiveDecisions(prev => {
        const kept = pruneExpired(prev, next.minute)
        activeDecisionsRef.current = kept
        return kept.length === prev.length ? prev : kept
      })
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
    setActiveDecisions([])
    setDecisionHistory([])
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
    // "penaltis" tambem encerra o laco: a disputa avanca por cobranca, e sem esta
    // saida o "avancar" giraria em falso ate estourar o safety.
    while (cur.phase !== "fulltime" && cur.phase !== "penaltis" && safety-- > 0) {
      const kept = pruneExpired(activeDecisionsRef.current, cur.minute)
      activeDecisionsRef.current = kept
      const effect = aggregateDecisionEffects(kept, cur.minute, efeitosDoTreinador().defesaNoFinal)
      const liveConfig = cfg.userSide === "away"
        ? { ...cfg, awayCoachEffect: effect }
        : { ...cfg, homeCoachEffect: effect }
      // tickMinute nao avanca enquanto houver penalti pendente — sem resolver aqui,
      // o "avancar" ficaria girando em falso ate estourar o safety. O motor bate.
      if (cur.pendingVar) {
        cur = resolvePendingVar(cur)
        continue
      }
      if (cur.pendingPenalty) {
        cur = resolvePendingPenalty(cur, liveConfig, null).state
        continue
      }
      cur = tickMinute(cur, liveConfig)
    }
    stateRef.current = cur
    setState(cur)
    setActiveDecisions(activeDecisionsRef.current)
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

  const resolveVar = useCallback(() => {
    const next = resolvePendingVar(stateRef.current)
    stateRef.current = next
    setState(next)
  }, [])

  // ── Disputa de penaltis ───────────────────────────────────────────────────

  /** Abre a disputa: a partida sai de "fulltime" e entra em "penaltis". */
  const beginShootout = useCallback(() => {
    const next = startShootout(stateRef.current)
    stateRef.current = next
    setState(next)
  }, [])

  /** Cobra a proxima penalidade e devolve o lance para a tela narrar. */
  const kickShootout = useCallback((taker: SquadPlayer | null): ShootoutKick | null => {
    const cfg = configRef.current
    if (!cfg) return null
    const { state: next, kick } = takeShootoutKick(stateRef.current, cfg, taker)
    stateRef.current = next
    setState(next)
    return kick
  }, [])

  /**
   * Fecha a disputa e devolve a partida a "fulltime".
   *
   * A fase volta de proposito: e em "fulltime" que a tela registra o resultado,
   * avanca a semana e mostra o pos-jogo. O `shootout` fica no estado — e dele que
   * sai o placar das cobrancas gravado no save.
   */
  const endShootout = useCallback(() => {
    const next: MatchState = { ...stateRef.current, phase: "fulltime" }
    stateRef.current = next
    setState(next)
  }, [])

  /** Quem ainda pode bater por um lado (a tela do usuario lista isto). */
  const shootoutTakers = useCallback((side: Side): SquadPlayer[] => {
    const cfg = configRef.current
    if (!cfg) return []
    return shootoutAvailableTakers(stateRef.current, cfg, side)
  }, [])

  /**
   * Aplica uma decisão do técnico. `applyDecision` mexe no momentum do estado
   * corrente — é a mesma grandeza que o tickMinute usa para decidir quem cria
   * chance, então o efeito aparece na simulação, não só na tela.
   */
  const applyCoachDecision = useCallback((id: MatchDecisionId) => {
    const current = stateRef.current
    if (current.phase === "fulltime" || current.phase === "penaltis") return
    const { state: next, active } = applyDecision(current, id)
    stateRef.current = next
    setState(next)
    setDecisionHistory(prev => [...prev, active])
    setActiveDecisions(prev => {
      const updated = [...pruneExpired(prev, next.minute).filter(d => d.id !== id), active]
      activeDecisionsRef.current = updated
      return updated
    })
  }, [])

  // Sugestão do auxiliar: recalculada a cada minuto a partir do placar/momentum.
  const suggestedDecision = state.phase === "fulltime" || state.phase === "penaltis"
    ? null
    : suggestDecision(state)

  return {
    state,
    speed,
    isRunning,
    activeDecisions,
    decisionHistory,
    decisionEffect: aggregateDecisionEffects(activeDecisions, state.minute, efeitosDoTreinador().defesaNoFinal),
    suggestedDecision,
    applyCoachDecision,
    start,
    pause,
    resume,
    reset,
    setSpeed: changeSpeed,
    forceGoal,
    addEvent,
    fastForward,
    takePenalty,
    resolveVar,
    beginShootout,
    kickShootout,
    endShootout,
    shootoutTakers,
  }
}
