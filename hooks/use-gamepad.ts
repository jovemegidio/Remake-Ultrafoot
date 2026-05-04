"use client"

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

  const animationFrameRef = useRef<number>()
  const lastPollRef = useRef<number>(0)

  const pollGamepad = useCallback(() => {
    const now = performance.now()
    if (now - lastPollRef.current < pollRate) {
      animationFrameRef.current = requestAnimationFrame(pollGamepad)
      return
    }
    lastPollRef.current = now

    const gamepads = navigator.getGamepads()
    const gamepad = gamepads[0] || gamepads[1] || gamepads[2] || gamepads[3]

    if (!gamepad) {
      if (state.connected) {
        setState(prev => ({ ...prev, connected: false }))
        onDisconnect?.()
      }
      animationFrameRef.current = requestAnimationFrame(pollGamepad)
      return
    }

    // Check button states
    const newButtons: Record<GamepadButtonName, boolean> = {} as Record<GamepadButtonName, boolean>
    
    for (const [name, index] of Object.entries(GAMEPAD_BUTTONS)) {
      const button = gamepad.buttons[index]
      const isPressed = button ? (typeof button === "object" ? button.pressed : button > 0.5) : false
      newButtons[name as GamepadButtonName] = isPressed

      // Detect button press/release
      const wasPressed = previousButtonsRef.current[name as GamepadButtonName]
      if (isPressed && !wasPressed) {
        onButtonPress?.(name as GamepadButtonName)
      } else if (!isPressed && wasPressed) {
        onButtonRelease?.(name as GamepadButtonName)
      }
    }

    previousButtonsRef.current = newButtons

    // Apply deadzone to sticks
    const applyDeadzone = (value: number) => Math.abs(value) < deadzone ? 0 : value

    const leftStick = {
      x: applyDeadzone(gamepad.axes[0] || 0),
      y: applyDeadzone(gamepad.axes[1] || 0),
    }
    const rightStick = {
      x: applyDeadzone(gamepad.axes[2] || 0),
      y: applyDeadzone(gamepad.axes[3] || 0),
    }

    setState({
      connected: true,
      controllerType: detectControllerType(gamepad.id),
      controllerName: gamepad.id,
      buttons: newButtons,
      leftStick,
      rightStick,
    })

    animationFrameRef.current = requestAnimationFrame(pollGamepad)
  }, [state.connected, onButtonPress, onButtonRelease, onDisconnect, deadzone, pollRate])

  useEffect(() => {
    const handleGamepadConnected = (e: GamepadEvent) => {
      onConnect?.(e.gamepad)
      setState(prev => ({
        ...prev,
        connected: true,
        controllerType: detectControllerType(e.gamepad.id),
        controllerName: e.gamepad.id,
      }))
    }

    const handleGamepadDisconnected = () => {
      onDisconnect?.()
      setState(prev => ({ ...prev, connected: false }))
    }

    window.addEventListener("gamepadconnected", handleGamepadConnected)
    window.addEventListener("gamepaddisconnected", handleGamepadDisconnected)

    // Start polling
    animationFrameRef.current = requestAnimationFrame(pollGamepad)

    return () => {
      window.removeEventListener("gamepadconnected", handleGamepadConnected)
      window.removeEventListener("gamepaddisconnected", handleGamepadDisconnected)
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
    }
  }, [pollGamepad, onConnect, onDisconnect])

  return state
}

// Hook for simple navigation with gamepad
export function useGamepadNavigation(options: {
  onNavigate?: (direction: "up" | "down" | "left" | "right") => void
  onSelect?: () => void
  onBack?: () => void
  onAction?: (action: "X" | "Y" | "LB" | "RB" | "LT" | "RT" | "START" | "SELECT") => void
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
