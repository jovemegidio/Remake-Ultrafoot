"use client"

import { useContext } from "react"
import { cn } from "@/lib/utils"

type ControllerType = "xbox" | "playstation"

// Optional context for auto-detecting controller type
import { createContext } from "react"
export const ControllerTypeContext = createContext<ControllerType>("playstation")

interface ControllerButtonProps {
  button: "A" | "B" | "X" | "Y" | "LB" | "RB" | "LT" | "RT" | "LS" | "RS"
  label?: string
  size?: "xs" | "sm" | "md"
  controller?: ControllerType
  className?: string
}

// Map Xbox buttons to PlayStation equivalents (usando símbolos corretos)
const psButtonMap: Record<string, string> = {
  A: "✕", // Cross
  B: "○", // Circle  
  X: "□", // Square
  Y: "△", // Triangle
  LB: "L1",
  RB: "R1",
  LT: "L2",
  RT: "R2",
  LS: "L3",
  RS: "R3",
}

// Colors for Xbox buttons (cores oficiais Xbox)
const xboxColors: Record<string, string> = {
  A: "bg-[#107c10] text-white", // Verde Xbox
  B: "bg-[#e81123] text-white", // Vermelho Xbox
  X: "bg-[#0078d7] text-white", // Azul Xbox
  Y: "bg-[#ffb900] text-black", // Amarelo Xbox
  LB: "bg-[#2d2d2d] text-white border border-white/30",
  RB: "bg-[#2d2d2d] text-white border border-white/30",
  LT: "bg-[#2d2d2d] text-white border border-white/30",
  RT: "bg-[#2d2d2d] text-white border border-white/30",
  LS: "bg-[#2d2d2d] text-white border border-white/30",
  RS: "bg-[#2d2d2d] text-white border border-white/30",
}

// Colors for PlayStation buttons (cores oficiais PlayStation)
const psColors: Record<string, string> = {
  A: "bg-[#24398C] text-[#6BB3E9]", // Cross - azul com símbolo azul claro
  B: "bg-[#8C2424] text-[#E96B6B]", // Circle - vermelho com símbolo vermelho claro
  X: "bg-[#8C247B] text-[#E96BD1]", // Square - rosa/magenta
  Y: "bg-[#248C6B] text-[#6BE9C1]", // Triangle - verde/teal
  LB: "bg-[#1a1a1a] text-white border border-white/30",
  RB: "bg-[#1a1a1a] text-white border border-white/30",
  LT: "bg-[#1a1a1a] text-white border border-white/30",
  RT: "bg-[#1a1a1a] text-white border border-white/30",
  LS: "bg-[#1a1a1a] text-white border border-white/30",
  RS: "bg-[#1a1a1a] text-white border border-white/30",
}

const sizeClasses = {
  xs: "h-4 min-w-4 text-[8px]",
  sm: "h-5 min-w-5 text-[10px]",
  md: "h-6 min-w-6 text-xs",
}

export function ControllerButton({ 
  button, 
  label, 
  size = "sm", 
  controller,
  className 
}: ControllerButtonProps) {
  // Use context if no controller prop specified
  const contextController = useContext(ControllerTypeContext)
  const activeController = controller || contextController || "playstation"
  
  const displayButton = activeController === "playstation" ? psButtonMap[button] : button
  const colors = activeController === "playstation" ? psColors[button] : xboxColors[button]
  const isShoulderButton = ["LB", "RB", "LT", "RT"].includes(button)

  return (
    <div className={cn("flex items-center gap-1.5", className)}>
      <div
        className={cn(
          "flex items-center justify-center font-bold rounded",
          isShoulderButton ? "rounded-md px-1.5" : "rounded-full",
          colors,
          sizeClasses[size]
        )}
      >
        {displayButton}
      </div>
      {label && (
        <span className="text-[10px] text-white/60 font-medium tracking-wide">
          {label}
        </span>
      )}
    </div>
  )
}

// Toolbar de ações estilo FIFA
interface ControllerToolbarProps {
  actions: Array<{
    button: ControllerButtonProps["button"]
    label: string
    onClick?: () => void
  }>
  controller?: ControllerType
  className?: string
}

export function ControllerToolbar({ actions, controller = "playstation", className }: ControllerToolbarProps) {
  return (
    <div className={cn(
      "flex items-center gap-6 px-4 py-2 bg-[#0a0a0a]/90 backdrop-blur-sm border-t border-white/5",
      className
    )}>
      {actions.map((action, i) => (
        <button
          key={i}
          onClick={action.onClick}
          className="flex items-center gap-1.5 hover:opacity-80 transition-opacity"
        >
          <ControllerButton button={action.button} controller={controller} size="sm" />
          <span className="text-[10px] text-white/60 font-medium tracking-wide">
            {action.label}
          </span>
        </button>
      ))}
    </div>
  )
}

// Header buttons (LB/RB navigation)
interface HeaderControlsProps {
  controller?: ControllerType
  className?: string
}

export function HeaderControls({ controller = "playstation", className }: HeaderControlsProps) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <ControllerButton button="LB" controller={controller} size="xs" />
      <div className="flex items-center gap-1">
        <div className="w-1.5 h-1.5 rounded-full bg-white/20" />
        <div className="w-1.5 h-1.5 rounded-full bg-[#1db954]" />
        <div className="w-1.5 h-1.5 rounded-full bg-white/20" />
      </div>
      <ControllerButton button="RB" controller={controller} size="xs" />
    </div>
  )
}

// Pagination dots estilo FIFA
interface CarouselDotsProps {
  total: number
  current: number
  onSelect?: (index: number) => void
  showNavButtons?: boolean
  controller?: ControllerType
  className?: string
}

// Connection status indicator
interface ControllerStatusProps {
  connected: boolean
  controllerType: "xbox" | "playstation" | "generic"
  className?: string
}

export function ControllerStatus({ connected, controllerType, className }: ControllerStatusProps) {
  if (!connected) return null
  
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div className={cn(
        "w-2 h-2 rounded-full animate-pulse",
        connected ? "bg-[#1db954]" : "bg-white/20"
      )} />
      {/* Ícone do controle */}
      <div className="w-4 h-4 flex items-center justify-center">
        {controllerType === "playstation" ? (
          <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 text-white/60" fill="currentColor">
            <path d="M8.985 2.596v17.548l3.915 1.261V6.688c0-.69.304-1.151.794-.991.636.181.76.814.76 1.505v5.875c2.441 1.193 4.362-.002 4.362-3.153 0-3.237-1.126-4.675-4.438-5.827-1.307-.448-3.728-1.186-5.393-1.501zm4.659 16.264l6.344-2.003c.725-.246 1.576-.795 1.576-1.753 0-.959-.775-1.261-1.576-1.016l-6.344 2.049v2.723zm-6.329-.423c-2.346-.746-4.315-.326-4.315 1.76 0 2.023 1.756 2.817 4.315 2.283l1.329-.381V19.4l-1.329.424v-1.387z"/>
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 text-white/60" fill="currentColor">
            <path d="M4.102 21.033A11.947 11.947 0 0 0 12 24a11.96 11.96 0 0 0 7.898-2.967c1.058-1.074-.438-3.523-2.649-6.106-1.738 2.313-3.767 4.671-5.249 4.671-1.483 0-3.512-2.358-5.249-4.671-2.211 2.583-3.707 5.032-2.649 6.106zM12 0a11.94 11.94 0 0 0-7.898 2.967c-1.058 1.074.438 3.523 2.649 6.106C8.489 6.76 10.518 4.402 12 4.402c1.482 0 3.511 2.358 5.249 4.671 2.211-2.583 3.707-5.032 2.649-6.106A11.94 11.94 0 0 0 12 0z"/>
          </svg>
        )}
      </div>
      <span className="text-[10px] text-white/40 font-medium">
        {controllerType === "playstation" ? "PlayStation" : controllerType === "xbox" ? "Xbox" : "Controller"}
      </span>
    </div>
  )
}

export function CarouselDots({ 
  total, 
  current, 
  onSelect, 
  showNavButtons = true,
  controller = "playstation",
  className 
}: CarouselDotsProps) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      {showNavButtons && (
        <ControllerButton button="LB" controller={controller} size="xs" />
      )}
      <div className="flex items-center gap-1.5">
        {Array.from({ length: total }).map((_, i) => (
          <button
            key={i}
            onClick={() => onSelect?.(i)}
            className={cn(
              "rounded-full transition-all duration-300",
              i === current 
                ? "w-5 h-2 bg-white" 
                : "w-2 h-2 bg-white/30 hover:bg-white/50"
            )}
          />
        ))}
      </div>
      {showNavButtons && (
        <ControllerButton button="RB" controller={controller} size="xs" />
      )}
    </div>
  )
}
