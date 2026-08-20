"use client"

// ⚠️ HOOK DE COMPATIBILIDADE. Codigo novo deve usar `@/hooks/use-input`.
//
// Este arquivo era o motor do controle: abria o proprio `requestAnimationFrame`,
// lia `navigator.getGamepads()`, normalizava DirectInput e disparava
// `gamepad:button` na janela. Todo esse conhecimento nao foi jogado fora — ele
// foi PROMOVIDO para modulos proprios, onde da para testar e onde cabe mais de
// um backend:
//
//   ordem de botoes / hat switch  → lib/controller/profiles.ts
//   quem e o controle ativo       → lib/input/adapters/web-gamepad.ts
//   deadzone e repeticao          → lib/input/intent.ts, lib/input/repeat.ts
//   o laco unico do processo      → lib/input/manager.ts
//
// O que sobrou aqui e a MESMA interface publica, agora lendo do gerente. Isso
// importa por dois motivos:
//
// 1. `GamepadButtonName` e importado por telas (a partida ao vivo, por exemplo)
//    e por lib/gamepad-controls.ts. Mudar o tipo obrigaria a mexer nelas.
// 2. Cada chamada do hook antigo abria um laco E disparava o evento. Dois
//    componentes usando-o fariam todo botao chegar em dobro aos 44 arquivos que
//    ouvem `gamepad:button`. Agora o hook nao dispara nada — so escuta.

import { useEffect, useRef, useState } from "react"

import { gerenteDeInput } from "@/lib/input/manager"
import { useRetratoDoInput } from "@/hooks/use-input"

// Standard Gamepad Mapping do W3C. Mantido exportado porque telas o importam.
// A tabela VIVA, que trata tambem DirectInput, esta em lib/controller/profiles.ts.
export const GAMEPAD_BUTTONS = {
  A: 0, B: 1, X: 2, Y: 3,
  LB: 4, RB: 5, LT: 6, RT: 7,
  SELECT: 8, START: 9, L3: 10, R3: 11,
  DPAD_UP: 12, DPAD_DOWN: 13, DPAD_LEFT: 14, DPAD_RIGHT: 15,
  HOME: 16,
} as const

export type GamepadButtonName = keyof typeof GAMEPAD_BUTTONS

export interface GamepadState {
  connected: boolean
  controllerType: "xbox" | "playstation" | "generic"
  controllerName: string
  battery: number | null
  buttons: Record<GamepadButtonName, boolean>
  leftStick: { x: number; y: number }
  rightStick: { x: number; y: number }
}

interface UseGamepadOptions {
  onButtonPress?: (button: GamepadButtonName) => void
  onButtonRelease?: (button: GamepadButtonName) => void
  onConnect?: (gamepad: Gamepad) => void
  onDisconnect?: () => void
  deadzone?: number
  pollRate?: number
}

function botoesZerados(): Record<GamepadButtonName, boolean> {
  return Object.keys(GAMEPAD_BUTTONS).reduce((acc, k) => {
    acc[k as GamepadButtonName] = false
    return acc
  }, {} as Record<GamepadButtonName, boolean>)
}

/**
 * A familia detectada, no vocabulario antigo (tres valores).
 *
 * O modelo novo tem cinco familias (entra Nintendo e Steam). Steam Input
 * apresenta layout Xbox, entao vira "xbox" aqui; Nintendo cai em "generic",
 * que e o que o codigo antigo ja faria com ele.
 */
function tipoAntigo(familia: string | undefined): "xbox" | "playstation" | "generic" {
  if (familia === "playstation") return "playstation"
  if (familia === "xbox" || familia === "steam") return "xbox"
  return "generic"
}

export function useGamepad(options: UseGamepadOptions = {}): GamepadState {
  const { primario, dispositivos } = useRetratoDoInput()
  const [buttons, setButtons] = useState(botoesZerados)

  const cb = useRef(options)
  cb.current = options

  // Botoes vem do evento que o gerente ja emite — nenhum polling aqui.
  //
  // O `onButtonRelease` do contrato antigo NAO tem como ser servido: o evento
  // `gamepad:button` so existe na borda de SUBIDA. Nenhum chamador no
  // repositorio usava (conferido antes de mexer), e inventar um "soltou"
  // sintetico seria pior que a ausencia — dispararia na hora errada.
  useEffect(() => {
    const aoBotao = (e: Event) => {
      const { button } = (e as CustomEvent<{ button: GamepadButtonName }>).detail ?? {}
      if (!button) return
      cb.current.onButtonPress?.(button)
      // Pulso curto: o estado antigo era "esta apertado agora", e havia telas
      // que o liam para acender um realce. Sem o laco proprio nao ha como saber
      // quando soltou, entao o pulso de 120 ms preserva o efeito visual sem
      // fingir que sabemos o estado real do botao.
      setButtons(prev => ({ ...prev, [button]: true }))
      window.setTimeout(() => setButtons(prev => ({ ...prev, [button]: false })), 120)
    }
    window.addEventListener("gamepad:button", aoBotao)
    return () => window.removeEventListener("gamepad:button", aoBotao)
  }, [])

  const conectadoAntes = useRef(false)
  useEffect(() => {
    const conectado = dispositivos.length > 0
    if (conectado === conectadoAntes.current) return
    conectadoAntes.current = conectado
    if (!conectado) cb.current.onDisconnect?.()
    // `onConnect` recebia o `Gamepad` cru. Quem o chamava so lia `id`, e o
    // objeto vivo do navegador nao sobrevive fora do quadro em que foi lido —
    // buscamos um na hora, e se nao houver, nao chamamos.
    else {
      const gp = (navigator.getGamepads?.() ?? []).find(g => g?.connected)
      if (gp) cb.current.onConnect?.(gp)
    }
  }, [dispositivos.length])

  return {
    connected: dispositivos.length > 0,
    controllerType: tipoAntigo(primario?.family),
    controllerName: primario?.rawName ?? "",
    battery: primario?.battery ?? null,
    buttons,
    // Eixo cru NAO sobe mais para o React (era ele que rerenderizava o app a
    // 60 Hz). Quem precisa de analogico ao vivo usa `useEixosDeInput`, que
    // entrega por callback. Aqui fica zerado de proposito, e nenhuma tela do
    // repositorio lia estes campos.
    leftStick: { x: 0, y: 0 },
    rightStick: { x: 0, y: 0 },
  }
}

/** Navegacao simples. Continua servindo o provider antigo. */
export function useGamepadNavigation(options: {
  onNavigate?: (direction: "up" | "down" | "left" | "right") => void
  onSelect?: () => void
  onBack?: () => void
  onAction?: (action: "X" | "Y" | "LB" | "RB" | "LT" | "RT" | "START" | "SELECT" | "HOME") => void
  repeatDelay?: number
}): GamepadState {
  const ref = useRef(options)
  ref.current = options

  // A repeticao do analogico morava aqui e agora e do gerente (ele ja converte
  // o stick em DPAD_* com atraso inicial e cadencia configuraveis). Por isso
  // `repeatDelay` deixou de ter efeito — ficou na assinatura so para nao
  // quebrar quem passava.
  void options.repeatDelay

  useEffect(() => {
    const aoBotao = (e: Event) => {
      const { button } = (e as CustomEvent<{ button: string }>).detail ?? {}
      const o = ref.current
      switch (button) {
        case "A": o.onSelect?.(); break
        case "B": o.onBack?.(); break
        case "DPAD_UP": o.onNavigate?.("up"); break
        case "DPAD_DOWN": o.onNavigate?.("down"); break
        case "DPAD_LEFT": o.onNavigate?.("left"); break
        case "DPAD_RIGHT": o.onNavigate?.("right"); break
        case "X": case "Y": case "LB": case "RB":
        case "LT": case "RT": case "START": case "SELECT": case "HOME":
          o.onAction?.(button)
          break
      }
    }
    window.addEventListener("gamepad:button", aoBotao)
    return () => window.removeEventListener("gamepad:button", aoBotao)
  }, [])

  return useGamepad()
}

/**
 * Garante que o motor esta ligado.
 *
 * O `SistemaDeInput` (montado no layout) ja faz isso. Este atalho existe para
 * telas isoladas em testes e para a versao web, onde o layout pode nao montar.
 * `iniciar()` e idempotente.
 */
export function garantirInputLigado(): void {
  gerenteDeInput.iniciar()
}
