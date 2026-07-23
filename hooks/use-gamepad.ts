"use client"

import { invoke } from "@tauri-apps/api/core"
import { useEffect, useCallback, useRef, useState } from "react"

// Standard Gamepad Button Mapping (Xbox/PlayStation)
// https://w3c.github.io/gamepad/#remapping
export const GAMEPAD_BUTTONS = {
  A: 0,        // Xbox A / PlayStation X (Cross)
  B: 1,        // Xbox B / PlayStation Circle
  X: 2,        // Xbox X / PlayStation Square
  Y: 3,        // Xbox Y / PlayStation Triangle
  LB: 4,       // Left Bumper / L1
  RB: 5,       // Right Bumper / R1
  LT: 6,       // Left Trigger / L2
  RT: 7,       // Right Trigger / R2
  SELECT: 8,   // Back / Share
  START: 9,    // Start / Options
  L3: 10,      // Left Stick Press
  R3: 11,      // Right Stick Press
  DPAD_UP: 12,
  DPAD_DOWN: 13,
  DPAD_LEFT: 14,
  DPAD_RIGHT: 15,
  HOME: 16,    // Xbox / PlayStation button
} as const

export type GamepadButtonName = keyof typeof GAMEPAD_BUTTONS

export interface GamepadState {
  connected: boolean
  controllerType: "xbox" | "playstation" | "generic"
  controllerName: string
  battery: number | null // 0–1, null when not exposed by the browser
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

function detectControllerType(id: string): "xbox" | "playstation" | "generic" {
  const lowerId = id.toLowerCase()
  
  // PlayStation detection - DualShock 3/4, DualSense, SCPH, Wireless Controller
  if (
    lowerId.includes("playstation") || 
    lowerId.includes("dualshock") || 
    lowerId.includes("dualsense") || 
    lowerId.includes("sony") ||
    lowerId.includes("scph") ||
    lowerId.includes("054c") || // Sony USB Vendor ID
    (lowerId.includes("wireless controller") && !lowerId.includes("xbox"))
  ) {
    return "playstation"
  }
  
  // Xbox detection - Xbox 360, Xbox One, Xbox Series, XInput
  if (
    lowerId.includes("xbox") || 
    lowerId.includes("xinput") || 
    lowerId.includes("microsoft") ||
    lowerId.includes("045e") // Microsoft USB Vendor ID
  ) {
    return "xbox"
  }
  
  return "generic"
}

export function useGamepad(options: UseGamepadOptions = {}) {
  const {
    onButtonPress,
    onButtonRelease,
    onConnect,
    onDisconnect,
    deadzone = 0.15,
    pollRate = 16, // ~60fps
  } = options

  const [state, setState] = useState<GamepadState>({
    connected: false,
    controllerType: "generic",
    controllerName: "",
    battery: null,
    buttons: Object.keys(GAMEPAD_BUTTONS).reduce((acc, key) => {
      acc[key as GamepadButtonName] = false
      return acc
    }, {} as Record<GamepadButtonName, boolean>),
    leftStick: { x: 0, y: 0 },
    rightStick: { x: 0, y: 0 },
  })

  const previousButtonsRef = useRef<Record<GamepadButtonName, boolean>>(
    Object.keys(GAMEPAD_BUTTONS).reduce((acc, key) => {
      acc[key as GamepadButtonName] = false
      return acc
    }, {} as Record<GamepadButtonName, boolean>)
  )

  const animationFrameRef = useRef<number>(undefined)
  const lastPollRef = useRef<number>(0)
  const nativeBatteryRef = useRef<number | null>(null)

  // CALLBACKS EM REF. Antes o laco de polling dependia das callbacks (recriadas a
  // cada render pelo useGamepadNavigation), entao ele se DESMONTAVA e remontava a
  // cada render — cancelando e reagendando requestAnimationFrame o tempo todo, o
  // que embaralhava a deteccao. Agora o laco roda UMA vez e le as callbacks daqui.
  const cbRef = useRef({ onButtonPress, onButtonRelease, onConnect, onDisconnect })
  cbRef.current = { onButtonPress, onButtonRelease, onConnect, onDisconnect }

  // Snapshot em ref para a UI ler o analogico em tempo real sem forcar render.
  const stateRef = useRef(state)
  stateRef.current = state

  useEffect(() => {
    const applyDeadzone = (value: number) => (Math.abs(value) < deadzone ? 0 : value)

    const poll = () => {
      animationFrameRef.current = requestAnimationFrame(poll)

      const now = performance.now()
      if (now - lastPollRef.current < pollRate) return
      lastPollRef.current = now

      const gamepads = navigator.getGamepads?.() ?? []
      const gamepad = gamepads[0] || gamepads[1] || gamepads[2] || gamepads[3] || null

      if (!gamepad) {
        if (stateRef.current.connected) {
          cbRef.current.onDisconnect?.()
          setState(prev => (prev.connected ? { ...prev, connected: false } : prev))
        }
        return
      }

      // Bordas dos botoes: DISPARA sempre, mesmo sem re-render (e o que as telas
      // ouvem, via evento gamepad:button).
      const newButtons = {} as Record<GamepadButtonName, boolean>
      let algumMudou = false
      for (const [name, index] of Object.entries(GAMEPAD_BUTTONS)) {
        const button = gamepad.buttons[index]
        const isPressed = button ? (typeof button === "object" ? button.pressed : button > 0.5) : false
        newButtons[name as GamepadButtonName] = isPressed
        const wasPressed = previousButtonsRef.current[name as GamepadButtonName]
        if (isPressed !== wasPressed) algumMudou = true
        if (isPressed && !wasPressed) {
          cbRef.current.onButtonPress?.(name as GamepadButtonName)
          window.dispatchEvent(new CustomEvent("gamepad:button", { detail: { button: name as GamepadButtonName } }))
        } else if (!isPressed && wasPressed) {
          cbRef.current.onButtonRelease?.(name as GamepadButtonName)
        }
      }
      previousButtonsRef.current = newButtons

      const leftStick = { x: applyDeadzone(gamepad.axes[0] || 0), y: applyDeadzone(gamepad.axes[1] || 0) }
      const rightStick = { x: applyDeadzone(gamepad.axes[2] || 0), y: applyDeadzone(gamepad.axes[3] || 0) }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rawBattery = (gamepad as any).battery
      const browserBattery: number | null =
        typeof rawBattery === "number" ? rawBattery
          : typeof rawBattery?.batteryLevel === "number" ? rawBattery.batteryLevel : null
      const battery = browserBattery ?? nativeBatteryRef.current

      // SO faz setState quando algo RELEVANTE muda. Antes chamava setState a 60fps,
      // rerenderizando o app inteiro 60x/s — travava maquina fraca e competia com
      // o proprio laco. Botao e "balde" do analogico (passou do limiar) disparam
      // render; micro-variacao de eixo, nao.
      const prev = stateRef.current
      const bucket = (v: number) => (v > 0.5 ? 1 : v < -0.5 ? -1 : 0)
      const stickMudou =
        bucket(leftStick.x) !== bucket(prev.leftStick.x) ||
        bucket(leftStick.y) !== bucket(prev.leftStick.y)
      if (!prev.connected || algumMudou || stickMudou || prev.battery !== battery) {
        setState({
          connected: true,
          controllerType: detectControllerType(gamepad.id),
          controllerName: gamepad.id,
          battery,
          buttons: newButtons,
          leftStick,
          rightStick,
        })
      }
    }

    const handleGamepadConnected = (e: GamepadEvent) => {
      cbRef.current.onConnect?.(e.gamepad)
      setState(prev => ({
        ...prev,
        connected: true,
        controllerType: detectControllerType(e.gamepad.id),
        controllerName: e.gamepad.id,
      }))
    }
    const handleGamepadDisconnected = () => {
      cbRef.current.onDisconnect?.()
      setState(prev => ({ ...prev, connected: false }))
    }

    window.addEventListener("gamepadconnected", handleGamepadConnected)
    window.addEventListener("gamepaddisconnected", handleGamepadDisconnected)
    animationFrameRef.current = requestAnimationFrame(poll)

    return () => {
      window.removeEventListener("gamepadconnected", handleGamepadConnected)
      window.removeEventListener("gamepaddisconnected", handleGamepadDisconnected)
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current)
    }
    // Laco unico e estavel: nao depende de callbacks nem de state (lidos por ref).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deadzone, pollRate])

  useEffect(() => {
    if (!state.connected || !("__TAURI_INTERNALS__" in window)) {
      nativeBatteryRef.current = null
      return
    }

    let active = true
    const refreshNativeBattery = async () => {
      try {
        const level = await invoke<number | null>("get_bluetooth_gamepad_battery", {
          controllerName: state.controllerName,
        })
        if (!active) return

        nativeBatteryRef.current =
          typeof level === "number" ? Math.max(0, Math.min(1, level)) : null
        setState(prev => ({
          ...prev,
          battery: nativeBatteryRef.current,
        }))
      } catch {
        if (active) nativeBatteryRef.current = null
      }
    }

    void refreshNativeBattery()
    const interval = setInterval(refreshNativeBattery, 30_000)

    return () => {
      active = false
      clearInterval(interval)
    }
  }, [state.connected, state.controllerName])

  return state
}

// Hook for simple navigation with gamepad
export function useGamepadNavigation(options: {
  onNavigate?: (direction: "up" | "down" | "left" | "right") => void
  onSelect?: () => void
  onBack?: () => void
  onAction?: (action: "X" | "Y" | "LB" | "RB" | "LT" | "RT" | "START" | "SELECT" | "HOME") => void
  repeatDelay?: number
}) {
  const {
    onNavigate,
    onSelect,
    onBack,
    onAction,
    repeatDelay = 200,
  } = options

  const lastNavigationRef = useRef<number>(0)
  const lastDirectionRef = useRef<string>("")

  const gamepad = useGamepad({
    onButtonPress: (button) => {
      switch (button) {
        case "A":
          onSelect?.()
          break
        case "B":
          onBack?.()
          break
        case "X":
        case "Y":
        case "LB":
        case "RB":
        case "LT":
        case "RT":
        case "START":
        case "SELECT":
        case "HOME":
          onAction?.(button)
          break
        case "DPAD_UP":
          onNavigate?.("up")
          break
        case "DPAD_DOWN":
          onNavigate?.("down")
          break
        case "DPAD_LEFT":
          onNavigate?.("left")
          break
        case "DPAD_RIGHT":
          onNavigate?.("right")
          break
      }
    },
  })

  // Handle analog stick navigation with repeat delay
  useEffect(() => {
    if (!gamepad.connected) return

    const checkStickNavigation = () => {
      const now = Date.now()
      const { leftStick } = gamepad
      
      let direction: "up" | "down" | "left" | "right" | null = null
      
      if (Math.abs(leftStick.y) > Math.abs(leftStick.x)) {
        if (leftStick.y < -0.5) direction = "up"
        else if (leftStick.y > 0.5) direction = "down"
      } else {
        if (leftStick.x < -0.5) direction = "left"
        else if (leftStick.x > 0.5) direction = "right"
      }

      if (direction) {
        if (direction !== lastDirectionRef.current || now - lastNavigationRef.current > repeatDelay) {
          onNavigate?.(direction)
          lastNavigationRef.current = now
          lastDirectionRef.current = direction
        }
      } else {
        lastDirectionRef.current = ""
      }
    }

    const interval = setInterval(checkStickNavigation, 50)
    return () => clearInterval(interval)
  }, [gamepad.connected, gamepad.leftStick, onNavigate, repeatDelay])

  return gamepad
}
