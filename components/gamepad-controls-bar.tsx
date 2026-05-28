"use client"

import { useEffect, useState } from "react"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { ControllerButton } from "./controller-buttons"
import { 
  type GameContext, 
  getControlHints,
  CONTROL_MAPPINGS,
  ACTION_LABELS,
  type GameAction
} from "@/lib/gamepad-controls"

type ControllerType = "xbox" | "playstation" | "generic" | null

// Hook para detectar gamepad conectado
function useGamepadDetection() {
  const [gamepadInfo, setGamepadInfo] = useState<{
    connected: boolean
    type: ControllerType
  }>({ connected: false, type: null })

  useEffect(() => {
    const detectControllerType = (gamepad: Gamepad): ControllerType => {
      const id = gamepad.id.toLowerCase()
      if (id.includes("xbox") || id.includes("xinput") || id.includes("microsoft")) {
        return "xbox"
      }
      if (id.includes("playstation") || id.includes("dualshock") || id.includes("dualsense") || id.includes("054c")) {
        return "playstation"
      }
      return "generic"
    }

    const updateGamepads = () => {
      const gamepads = navigator.getGamepads()
      let foundGamepad: Gamepad | null = null
      
      for (const gp of gamepads) {
        if (gp && gp.connected) {
          foundGamepad = gp
          break
        }
      }

      if (foundGamepad) {
        setGamepadInfo({
          connected: true,
          type: detectControllerType(foundGamepad)
        })
      } else {
        setGamepadInfo({ connected: false, type: null })
      }
    }

    const handleGamepadConnected = () => updateGamepads()
    const handleGamepadDisconnected = () => updateGamepads()

    updateGamepads()

    window.addEventListener("gamepadconnected", handleGamepadConnected)
    window.addEventListener("gamepaddisconnected", handleGamepadDisconnected)

    const interval = setInterval(updateGamepads, 1000)

    return () => {
      window.removeEventListener("gamepadconnected", handleGamepadConnected)
      window.removeEventListener("gamepaddisconnected", handleGamepadDisconnected)
      clearInterval(interval)
    }
  }, [])

  return gamepadInfo
}

// Detecta o contexto atual baseado na rota
function useCurrentContext(): GameContext {
  const pathname = usePathname()
  const [modalOpen, setModalOpen] = useState(false)
  const [isPaused, setIsPaused] = useState(false)

  useEffect(() => {
    const handleModalChange = (e: CustomEvent<{ open: boolean }>) => {
      setModalOpen(e.detail.open)
    }
    const handlePauseChange = (e: CustomEvent<{ paused: boolean }>) => {
      setIsPaused(e.detail.paused)
    }
    
    window.addEventListener("modal:change" as any, handleModalChange)
    window.addEventListener("match:pause" as any, handlePauseChange)
    
    return () => {
      window.removeEventListener("modal:change" as any, handleModalChange)
      window.removeEventListener("match:pause" as any, handlePauseChange)
    }
  }, [])

  if (modalOpen) return "modal"
  
  if (pathname.includes("/partida/ao-vivo")) {
    return isPaused ? "match_paused" : "match_live"
  }
  if (pathname.includes("/partida")) return "match_preview"
  if (pathname.includes("/calendario")) return "calendar"
  if (pathname.includes("/elenco")) return "squad"
  if (pathname.includes("/mercado")) return "transfers"
  
  return "menu"
}

interface GamepadControlsBarProps {
  context?: GameContext
  customActions?: Array<{
    button: "A" | "B" | "X" | "Y" | "LB" | "RB" | "LT" | "RT"
    label: string
    onClick?: () => void
  }>
  className?: string
}

export function GamepadControlsBar({ 
  context: contextOverride,
  customActions, 
  className 
}: GamepadControlsBarProps) {
  const { connected, type } = useGamepadDetection()
  const detectedContext = useCurrentContext()
  const context = contextOverride || detectedContext

  // So mostra a barra se o gamepad estiver conectado
  if (!connected || !type) {
    return null
  }

  const controllerType = type === "generic" ? "xbox" : type

  // Usa acoes customizadas ou gera automaticamente baseado no contexto
  const actions = customActions || (() => {
    const mapping = CONTROL_MAPPINGS[context]
    if (!mapping) return []

    const mainButtons: Array<"A" | "B" | "X" | "Y" | "LB" | "RB"> = ["A", "B", "X", "Y", "LB", "RB"]
    
    return mainButtons
      .filter(button => mapping[button])
      .map(button => ({
        button,
        label: ACTION_LABELS[mapping[button] as GameAction] || mapping[button] as string,
        onClick: undefined as (() => void) | undefined,
      }))
  })()

  return (
    <div className={cn(
      "fixed bottom-0 left-0 md:left-16 right-0 z-30 items-center justify-center gap-6 px-6 py-2.5",
      "bg-[#050508]/95 backdrop-blur-sm border-t border-white/[0.04]",
      "hidden md:flex", // Esconde em mobile pois usamos bottom nav
      className
    )}>
      {actions.map((action, i) => (
        <button
          key={i}
          onClick={action.onClick}
          className="flex items-center gap-2 hover:opacity-80 transition-opacity group"
        >
          <ControllerButton 
            button={action.button} 
            controller={controllerType} 
            size="sm" 
            showLabel={false} 
          />
          <span className="text-[11px] text-white/60 font-medium tracking-wide group-hover:text-white/80">
            {action.label}
          </span>
        </button>
      ))}
    </div>
  )
}

// Header com indicador de controle conectado e navegacao LB/RB
interface GamepadHeaderControlsProps {
  className?: string
  showTabs?: boolean
  currentTab?: number
  totalTabs?: number
}

export function GamepadHeaderControls({ 
  className, 
  showTabs = true,
  currentTab = 0,
  totalTabs = 3 
}: GamepadHeaderControlsProps) {
  const { connected, type } = useGamepadDetection()

  if (!connected || !type) {
    return null
  }

  const controllerIcon = type === "playstation" ? (
    <svg viewBox="0 0 24 24" className="w-4 h-4 text-white/50" fill="currentColor">
      <path d="M8.985 2.596v17.548l3.915 1.261V6.688c0-.69.304-1.151.794-.991.636.181.76.814.76 1.505v5.875c2.441 1.193 4.362-.002 4.362-3.153 0-3.237-1.126-4.675-4.438-5.827-1.307-.448-3.728-1.186-5.393-1.501zm4.659 16.264l6.344-2.003c.725-.246 1.576-.795 1.576-1.753 0-.959-.775-1.261-1.576-1.016l-6.344 2.049v2.723zm-6.329-.423c-2.346-.746-4.315-.326-4.315 1.76 0 2.023 1.756 2.817 4.315 2.283l1.329-.381V19.4l-1.329.424v-1.387z"/>
    </svg>
  ) : (
    <svg viewBox="0 0 24 24" className="w-4 h-4 text-white/50" fill="currentColor">
      <path d="M4.102 21.033A11.947 11.947 0 0 0 12 24a11.96 11.96 0 0 0 7.898-2.967c1.058-1.074-.438-3.523-2.649-6.106-1.738 2.313-3.767 4.671-5.249 4.671-1.483 0-3.512-2.358-5.249-4.671-2.211 2.583-3.707 5.032-2.649 6.106zM12 0a11.94 11.94 0 0 0-7.898 2.967c-1.058 1.074.438 3.523 2.649 6.106C8.489 6.76 10.518 4.402 12 4.402c1.482 0 3.511 2.358 5.249 4.671 2.211-2.583 3.707-5.032 2.649-6.106A11.94 11.94 0 0 0 12 0z"/>
    </svg>
  )

  return (
    <div className={cn("flex items-center gap-3", className)}>
      <div className="flex items-center gap-1.5">
        <div className="w-1.5 h-1.5 rounded-full bg-[#00ffc8] animate-pulse" />
        {controllerIcon}
      </div>

      {showTabs && (
        <div className="flex items-center gap-2 ml-2">
          <ControllerButton 
            button="LB" 
            controller={type === "generic" ? "xbox" : type}
            size="xs" 
            showLabel={false} 
          />
          <div className="flex items-center gap-1">
            {Array.from({ length: totalTabs }).map((_, i) => (
              <div 
                key={i}
                className={cn(
                  "rounded-full transition-all",
                  i === currentTab 
                    ? "w-4 h-1.5 bg-[#00ffc8]" 
                    : "w-1.5 h-1.5 bg-white/20"
                )}
              />
            ))}
          </div>
          <ControllerButton 
            button="RB" 
            controller={type === "generic" ? "xbox" : type}
            size="xs" 
            showLabel={false} 
          />
        </div>
      )}
    </div>
  )
}

export { useGamepadDetection }
