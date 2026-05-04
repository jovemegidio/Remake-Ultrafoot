"use client"

import { useContext } from "react"
import { cn } from "@/lib/utils"

type ControllerType = "xbox" | "playstation"

// Context for auto-detecting controller type
import { createContext } from "react"
export const ControllerTypeContext = createContext<ControllerType>("playstation")

interface ControllerButtonProps {
  button: "A" | "B" | "X" | "Y" | "LB" | "RB" | "LT" | "RT" | "LS" | "RS" | "L" | "R" | "DPAD" | "MENU" | "VIEW"
  label?: string
  size?: "xs" | "sm" | "md" | "lg"
  controller?: ControllerType
  className?: string
  showLabel?: boolean
}

// Xbox button icons - outline style as shown in reference image
function XboxAButton({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} fill="none">
      <circle cx="16" cy="16" r="14" stroke="#10b981" strokeWidth="2" fill="transparent" />
      <text x="16" y="21" textAnchor="middle" fill="#10b981" fontSize="14" fontWeight="bold" fontFamily="system-ui">A</text>
    </svg>
  )
}

function XboxBButton({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} fill="none">
      <circle cx="16" cy="16" r="14" stroke="#ef4444" strokeWidth="2" fill="transparent" />
      <text x="16" y="21" textAnchor="middle" fill="#ef4444" fontSize="14" fontWeight="bold" fontFamily="system-ui">B</text>
    </svg>
  )
}

function XboxXButton({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} fill="none">
      <circle cx="16" cy="16" r="14" stroke="#3b82f6" strokeWidth="2" fill="transparent" />
      <text x="16" y="21" textAnchor="middle" fill="#3b82f6" fontSize="14" fontWeight="bold" fontFamily="system-ui">X</text>
    </svg>
  )
}

function XboxYButton({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} fill="none">
      <circle cx="16" cy="16" r="14" stroke="#eab308" strokeWidth="2" fill="transparent" />
      <text x="16" y="21" textAnchor="middle" fill="#eab308" fontSize="14" fontWeight="bold" fontFamily="system-ui">Y</text>
    </svg>
  )
}

function XboxLBButton({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 24" className={className} fill="none">
      <rect x="1" y="1" width="38" height="22" rx="4" stroke="white" strokeWidth="2" fill="transparent" />
      <text x="20" y="17" textAnchor="middle" fill="white" fontSize="12" fontWeight="bold" fontFamily="system-ui">LB</text>
    </svg>
  )
}

function XboxRBButton({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 24" className={className} fill="none">
      <rect x="1" y="1" width="38" height="22" rx="4" stroke="white" strokeWidth="2" fill="transparent" />
      <text x="20" y="17" textAnchor="middle" fill="white" fontSize="12" fontWeight="bold" fontFamily="system-ui">RB</text>
    </svg>
  )
}

function XboxLTButton({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 28" className={className} fill="none">
      <path d="M4 24V8C4 4 8 2 12 2H28C32 2 36 4 36 8V24" stroke="white" strokeWidth="2" fill="transparent" />
      <text x="20" y="20" textAnchor="middle" fill="white" fontSize="12" fontWeight="bold" fontFamily="system-ui">LT</text>
    </svg>
  )
}

function XboxRTButton({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 28" className={className} fill="none">
      <path d="M4 24V8C4 4 8 2 12 2H28C32 2 36 4 36 8V24" stroke="white" strokeWidth="2" fill="transparent" />
      <text x="20" y="20" textAnchor="middle" fill="white" fontSize="12" fontWeight="bold" fontFamily="system-ui">RT</text>
    </svg>
  )
}

function XboxLStickButton({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} fill="none">
      <circle cx="16" cy="16" r="14" stroke="white" strokeWidth="2" fill="transparent" />
      <text x="16" y="21" textAnchor="middle" fill="white" fontSize="12" fontWeight="bold" fontFamily="system-ui">L</text>
    </svg>
  )
}

function XboxRStickButton({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} fill="none">
      <circle cx="16" cy="16" r="14" stroke="white" strokeWidth="2" fill="transparent" />
      <text x="16" y="21" textAnchor="middle" fill="white" fontSize="12" fontWeight="bold" fontFamily="system-ui">R</text>
    </svg>
  )
}

function XboxDpadButton({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} fill="none">
      <rect x="12" y="2" width="8" height="28" rx="1" stroke="white" strokeWidth="2" fill="transparent" />
      <rect x="2" y="12" width="28" height="8" rx="1" stroke="white" strokeWidth="2" fill="transparent" />
    </svg>
  )
}

function XboxMenuButton({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} fill="none">
      <rect x="4" y="8" width="24" height="3" rx="1" stroke="white" strokeWidth="1.5" fill="white" />
      <rect x="4" y="14.5" width="24" height="3" rx="1" stroke="white" strokeWidth="1.5" fill="white" />
      <rect x="4" y="21" width="24" height="3" rx="1" stroke="white" strokeWidth="1.5" fill="white" />
    </svg>
  )
}

function XboxViewButton({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} fill="none">
      <rect x="4" y="6" width="14" height="10" rx="1" stroke="white" strokeWidth="2" fill="transparent" />
      <rect x="14" y="16" width="14" height="10" rx="1" stroke="white" strokeWidth="2" fill="transparent" />
    </svg>
  )
}

// PlayStation button icons - outline style as shown in reference image
function PSCrossButton({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} fill="none">
      <circle cx="16" cy="16" r="14" stroke="white" strokeWidth="2" fill="transparent" />
      <path d="M10 10L22 22M22 10L10 22" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  )
}

function PSCircleButton({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} fill="none">
      <circle cx="16" cy="16" r="14" stroke="white" strokeWidth="2" fill="transparent" />
      <circle cx="16" cy="16" r="6" stroke="white" strokeWidth="2.5" fill="transparent" />
    </svg>
  )
}

function PSSquareButton({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} fill="none">
      <circle cx="16" cy="16" r="14" stroke="white" strokeWidth="2" fill="transparent" />
      <rect x="9" y="9" width="14" height="14" stroke="white" strokeWidth="2.5" fill="transparent" />
    </svg>
  )
}

function PSTriangleButton({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} fill="none">
      <circle cx="16" cy="16" r="14" stroke="white" strokeWidth="2" fill="transparent" />
      <path d="M16 8L24 24H8L16 8Z" stroke="white" strokeWidth="2.5" fill="transparent" strokeLinejoin="round" />
    </svg>
  )
}

function PSL1Button({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 24" className={className} fill="none">
      <rect x="1" y="1" width="38" height="22" rx="4" stroke="white" strokeWidth="2" fill="transparent" />
      <text x="20" y="17" textAnchor="middle" fill="white" fontSize="12" fontWeight="bold" fontFamily="system-ui">L1</text>
    </svg>
  )
}

function PSR1Button({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 24" className={className} fill="none">
      <rect x="1" y="1" width="38" height="22" rx="4" stroke="white" strokeWidth="2" fill="transparent" />
      <text x="20" y="17" textAnchor="middle" fill="white" fontSize="12" fontWeight="bold" fontFamily="system-ui">R1</text>
    </svg>
  )
}

function PSL2Button({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 24" className={className} fill="none">
      <rect x="1" y="1" width="38" height="22" rx="4" stroke="white" strokeWidth="2" fill="transparent" />
      <text x="20" y="17" textAnchor="middle" fill="white" fontSize="12" fontWeight="bold" fontFamily="system-ui">L2</text>
    </svg>
  )
}

function PSR2Button({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 24" className={className} fill="none">
      <rect x="1" y="1" width="38" height="22" rx="4" stroke="white" strokeWidth="2" fill="transparent" />
      <text x="20" y="17" textAnchor="middle" fill="white" fontSize="12" fontWeight="bold" fontFamily="system-ui">R2</text>
    </svg>
  )
}

function PSL3Button({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 24" className={className} fill="none">
      <rect x="1" y="1" width="38" height="22" rx="4" stroke="white" strokeWidth="2" fill="transparent" />
      <text x="20" y="17" textAnchor="middle" fill="white" fontSize="12" fontWeight="bold" fontFamily="system-ui">L3</text>
    </svg>
  )
}

function PSR3Button({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 24" className={className} fill="none">
      <rect x="1" y="1" width="38" height="22" rx="4" stroke="white" strokeWidth="2" fill="transparent" />
      <text x="20" y="17" textAnchor="middle" fill="white" fontSize="12" fontWeight="bold" fontFamily="system-ui">R3</text>
    </svg>
  )
}

function PSDpadButton({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} fill="none">
      <rect x="12" y="2" width="8" height="28" rx="1" stroke="white" strokeWidth="2" fill="transparent" />
      <rect x="2" y="12" width="28" height="8" rx="1" stroke="white" strokeWidth="2" fill="transparent" />
    </svg>
  )
}

function PSOptionsButton({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} fill="none">
      <rect x="4" y="8" width="24" height="3" rx="1" stroke="white" strokeWidth="1.5" fill="white" />
      <rect x="4" y="14.5" width="24" height="3" rx="1" stroke="white" strokeWidth="1.5" fill="white" />
      <rect x="4" y="21" width="24" height="3" rx="1" stroke="white" strokeWidth="1.5" fill="white" />
    </svg>
  )
}

function PSTouchpadButton({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 24" className={className} fill="none">
      <rect x="2" y="2" width="44" height="20" rx="4" stroke="white" strokeWidth="2" fill="transparent" />
      <line x1="24" y1="6" x2="24" y2="18" stroke="white" strokeWidth="1.5" />
    </svg>
  )
}

const sizeClasses = {
  xs: "h-4 w-4",
  sm: "h-5 w-5",
  md: "h-6 w-6",
  lg: "h-8 w-8",
}

const wideSizeClasses = {
  xs: "h-4 w-6",
  sm: "h-5 w-8",
  md: "h-6 w-10",
  lg: "h-8 w-12",
}

export function ControllerButton({ 
  button, 
  label, 
  size = "sm", 
  controller,
  className,
  showLabel = true,
}: ControllerButtonProps) {
  const contextController = useContext(ControllerTypeContext)
  const activeController = controller || contextController || "xbox"
  
  const isWide = ["LB", "RB", "LT", "RT", "LS", "RS", "MENU", "VIEW"].includes(button)
  const sizeClass = isWide ? wideSizeClasses[size] : sizeClasses[size]
  
  const renderButton = () => {
    if (activeController === "xbox") {
      switch (button) {
        case "A": return <XboxAButton className={sizeClass} />
        case "B": return <XboxBButton className={sizeClass} />
        case "X": return <XboxXButton className={sizeClass} />
        case "Y": return <XboxYButton className={sizeClass} />
        case "LB": return <XboxLBButton className={sizeClass} />
        case "RB": return <XboxRBButton className={sizeClass} />
        case "LT": return <XboxLTButton className={sizeClass} />
        case "RT": return <XboxRTButton className={sizeClass} />
        case "LS": case "L": return <XboxLStickButton className={sizeClass} />
        case "RS": case "R": return <XboxRStickButton className={sizeClass} />
        case "DPAD": return <XboxDpadButton className={sizeClass} />
        case "MENU": return <XboxMenuButton className={sizeClass} />
        case "VIEW": return <XboxViewButton className={sizeClass} />
        default: return null
      }
    } else {
      // PlayStation
      switch (button) {
        case "A": return <PSCrossButton className={sizeClass} />
        case "B": return <PSCircleButton className={sizeClass} />
        case "X": return <PSSquareButton className={sizeClass} />
        case "Y": return <PSTriangleButton className={sizeClass} />
        case "LB": return <PSL1Button className={sizeClass} />
        case "RB": return <PSR1Button className={sizeClass} />
        case "LT": return <PSL2Button className={sizeClass} />
        case "RT": return <PSR2Button className={sizeClass} />
        case "LS": case "L": return <PSL3Button className={sizeClass} />
        case "RS": case "R": return <PSR3Button className={sizeClass} />
        case "DPAD": return <PSDpadButton className={sizeClass} />
        case "MENU": return <PSOptionsButton className={sizeClass} />
        case "VIEW": return <PSTouchpadButton className={sizeClass} />
        default: return null
      }
    }
  }

  return (
    <div className={cn("flex items-center gap-1.5", className)}>
      {renderButton()}
      {showLabel && label && (
        <span className="text-[10px] text-white/60 font-medium tracking-wide">
          {label}
        </span>
      )}
    </div>
  )
}

// Toolbar de acoes estilo EA FC
interface ControllerToolbarProps {
  actions: Array<{
    button: ControllerButtonProps["button"]
    label: string
    onClick?: () => void
  }>
  controller?: ControllerType
  className?: string
  visible?: boolean // Only show when gamepad connected
}

export function ControllerToolbar({ actions, controller, className, visible = true }: ControllerToolbarProps) {
  const contextController = useContext(ControllerTypeContext)
  const activeController = controller || contextController
  
  if (!visible) return null
  
  return (
    <div className={cn(
      "flex items-center gap-6 px-4 py-2 bg-[#0a0a0a]/95 backdrop-blur-sm border-t border-white/5",
      className
    )}>
      {actions.map((action, i) => (
        <button
          key={i}
          onClick={action.onClick}
          className="flex items-center gap-1.5 hover:opacity-80 transition-opacity"
        >
          <ControllerButton button={action.button} controller={activeController} size="sm" showLabel={false} />
          <span className="text-[10px] text-white/60 font-medium tracking-wide">
            {action.label}
          </span>
        </button>
      ))}
    </div>
  )
}

// Header controls (LB/RB navigation)
interface HeaderControlsProps {
  controller?: ControllerType
  className?: string
}

export function HeaderControls({ controller, className }: HeaderControlsProps) {
  const contextController = useContext(ControllerTypeContext)
  const activeController = controller || contextController
  
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <ControllerButton button="LB" controller={activeController} size="xs" showLabel={false} />
      <div className="flex items-center gap-1">
        <div className="w-1.5 h-1.5 rounded-full bg-white/20" />
        <div className="w-1.5 h-1.5 rounded-full bg-[#1db954]" />
        <div className="w-1.5 h-1.5 rounded-full bg-white/20" />
      </div>
      <ControllerButton button="RB" controller={activeController} size="xs" showLabel={false} />
    </div>
  )
}

// Carousel dots estilo EA FC
interface CarouselDotsProps {
  total: number
  current: number
  onSelect?: (index: number) => void
  showNavButtons?: boolean
  controller?: ControllerType
  className?: string
}

export function CarouselDots({ 
  total, 
  current, 
  onSelect, 
  showNavButtons = true,
  controller,
  className 
}: CarouselDotsProps) {
  const contextController = useContext(ControllerTypeContext)
  const activeController = controller || contextController
  
  return (
    <div className={cn("flex items-center gap-3", className)}>
      {showNavButtons && (
        <ControllerButton button="LB" controller={activeController} size="xs" showLabel={false} />
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
        <ControllerButton button="RB" controller={activeController} size="xs" showLabel={false} />
      )}
    </div>
  )
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
        "bg-[#1db954]"
      )} />
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
