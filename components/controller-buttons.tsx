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

// Map Xbox buttons to PlayStation equivalents
const psButtonMap: Record<string, string> = {
  A: "X",
  B: "O",
  X: "□",
  Y: "△",
  LB: "L1",
  RB: "R1",
  LT: "L2",
  RT: "R2",
  LS: "L3",
  RS: "R3",
}

// Colors for Xbox buttons
const xboxColors: Record<string, string> = {
  A: "bg-[#107c10] text-white",
  B: "bg-[#e81123] text-white",
  X: "bg-[#0078d7] text-white",
  Y: "bg-[#ffb900] text-black",
  LB: "bg-white/10 text-white border border-white/20",
  RB: "bg-white/10 text-white border border-white/20",
  LT: "bg-white/10 text-white border border-white/20",
  RT: "bg-white/10 text-white border border-white/20",
  LS: "bg-white/10 text-white border border-white/20",
  RS: "bg-white/10 text-white border border-white/20",
}

// Colors for PlayStation buttons
const psColors: Record<string, string> = {
  A: "bg-[#2e6db4] text-white", // Cross - blue
  B: "bg-[#df0024] text-white", // Circle - red
  X: "bg-[#f19db4] text-white", // Square - pink
  Y: "bg-[#00d474] text-white", // Triangle - green
  LB: "bg-white/10 text-white border border-white/20",
  RB: "bg-white/10 text-white border border-white/20",
  LT: "bg-white/10 text-white border border-white/20",
  RT: "bg-white/10 text-white border border-white/20",
  LS: "bg-white/10 text-white border border-white/20",
  RS: "bg-white/10 text-white border border-white/20",
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
      <span className="text-[10px] text-white/40 font-medium">
        {controllerType === "playstation" ? "PS" : "XBOX"}
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
