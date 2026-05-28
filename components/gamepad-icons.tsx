"use client"

import { cn } from "@/lib/utils"

type Platform = "playstation" | "xbox" | "keyboard"
type ButtonType = 
  // PlayStation
  | "cross" | "circle" | "square" | "triangle" 
  | "l1" | "r1" | "l2" | "r2" | "l3" | "r3"
  | "options" | "share" | "touchpad"
  // Xbox
  | "a" | "b" | "x" | "y"
  | "lb" | "rb" | "lt" | "rt" | "ls" | "rs"
  | "menu" | "view"
  // Shared
  | "dpad" | "dpad-up" | "dpad-down" | "dpad-left" | "dpad-right"
  // Keyboard
  | "key"

interface GamepadButtonProps {
  button: ButtonType
  platform?: Platform
  label?: string
  size?: "xs" | "sm" | "md" | "lg"
  className?: string
}

const sizeMap = {
  xs: { button: "w-5 h-5", text: "text-[8px]", icon: 10 },
  sm: { button: "w-6 h-6", text: "text-[9px]", icon: 12 },
  md: { button: "w-8 h-8", text: "text-[10px]", icon: 16 },
  lg: { button: "w-10 h-10", text: "text-xs", icon: 20 },
}

// PlayStation face buttons (X, O, Square, Triangle)
function PSCross({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10" />
      <path d="M8 8L16 16M16 8L8 16" />
    </svg>
  )
}

function PSCircle({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="12" r="5" />
    </svg>
  )
}

function PSSquare({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10" />
      <rect x="8" y="8" width="8" height="8" />
    </svg>
  )
}

function PSTriangle({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 7L17 16H7L12 7Z" />
    </svg>
  )
}

// PlayStation shoulder/trigger buttons
function PSBumper({ label, size = 16 }: { label: string; size?: number }) {
  return (
    <svg width={size * 1.5} height={size} viewBox="0 0 36 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="2" y="2" width="32" height="20" rx="4" />
      <text x="18" y="16" textAnchor="middle" fill="currentColor" fontSize="12" fontWeight="bold" stroke="none">
        {label}
      </text>
    </svg>
  )
}

function PSTrigger({ label, size = 16 }: { label: string; size?: number }) {
  return (
    <svg width={size * 1.5} height={size * 1.2} viewBox="0 0 36 28" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M4 4C4 2 6 2 6 2H30C30 2 32 2 32 4V20C32 24 28 26 18 26C8 26 4 24 4 20V4Z" />
      <text x="18" y="17" textAnchor="middle" fill="currentColor" fontSize="12" fontWeight="bold" stroke="none">
        {label}
      </text>
    </svg>
  )
}

function PSStick({ label, size = 16 }: { label: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10" />
      <text x="12" y="16" textAnchor="middle" fill="currentColor" fontSize="10" fontWeight="bold" stroke="none">
        {label}
      </text>
    </svg>
  )
}

// Xbox face buttons (A, B, X, Y)
function XboxButton({ label, size = 16, filled = false }: { label: string; size?: number; filled?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10" />
      {filled && <circle cx="12" cy="12" r="8" fill="currentColor" opacity="0.2" />}
      <text x="12" y="16" textAnchor="middle" fill="currentColor" fontSize="11" fontWeight="bold" stroke="none">
        {label}
      </text>
    </svg>
  )
}

// D-Pad
function DPad({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M9 2H15V9H22V15H15V22H9V15H2V9H9V2Z" />
      <path d="M12 5L10 7H14L12 5Z" fill="currentColor" />
      <path d="M12 19L10 17H14L12 19Z" fill="currentColor" />
      <path d="M5 12L7 10V14L5 12Z" fill="currentColor" />
      <path d="M19 12L17 10V14L19 12Z" fill="currentColor" />
    </svg>
  )
}

// Keyboard key
function KeyboardKey({ label, size = 16, wide = false }: { label: string; size?: number; wide?: boolean }) {
  const width = wide ? size * 2 : size
  return (
    <svg width={width} height={size} viewBox={`0 0 ${wide ? 48 : 24} 24`} fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="2" y="2" width={wide ? 44 : 20} height="20" rx="3" />
      <rect x="4" y="3" width={wide ? 40 : 16} height="16" rx="2" fill="currentColor" opacity="0.1" />
      <text x={wide ? 24 : 12} y="16" textAnchor="middle" fill="currentColor" fontSize={label.length > 2 ? "8" : "10"} fontWeight="bold" stroke="none">
        {label}
      </text>
    </svg>
  )
}

// Options/Menu buttons
function OptionsButton({ size = 16 }: { size?: number }) {
  return (
    <svg width={size * 1.2} height={size} viewBox="0 0 28 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="2" y="2" width="24" height="20" rx="4" />
      <line x1="8" y1="9" x2="20" y2="9" />
      <line x1="8" y1="12" x2="20" y2="12" />
      <line x1="8" y1="15" x2="20" y2="15" />
    </svg>
  )
}

export function GamepadButton({ button, platform = "playstation", label, size = "sm", className }: GamepadButtonProps) {
  const sizeConfig = sizeMap[size]
  
  const renderButton = () => {
    // PlayStation buttons
    if (platform === "playstation") {
      switch (button) {
        case "cross":
          return <PSCross size={sizeConfig.icon} />
        case "circle":
          return <PSCircle size={sizeConfig.icon} />
        case "square":
          return <PSSquare size={sizeConfig.icon} />
        case "triangle":
          return <PSTriangle size={sizeConfig.icon} />
        case "l1":
          return <PSBumper label="L1" size={sizeConfig.icon} />
        case "r1":
          return <PSBumper label="R1" size={sizeConfig.icon} />
        case "l2":
          return <PSTrigger label="L2" size={sizeConfig.icon} />
        case "r2":
          return <PSTrigger label="R2" size={sizeConfig.icon} />
        case "l3":
          return <PSStick label="L3" size={sizeConfig.icon} />
        case "r3":
          return <PSStick label="R3" size={sizeConfig.icon} />
        case "options":
          return <OptionsButton size={sizeConfig.icon} />
        case "dpad":
          return <DPad size={sizeConfig.icon} />
      }
    }
    
    // Xbox buttons
    if (platform === "xbox") {
      switch (button) {
        case "a":
          return <XboxButton label="A" size={sizeConfig.icon} />
        case "b":
          return <XboxButton label="B" size={sizeConfig.icon} />
        case "x":
          return <XboxButton label="X" size={sizeConfig.icon} filled />
        case "y":
          return <XboxButton label="Y" size={sizeConfig.icon} filled />
        case "lb":
          return <PSBumper label="LB" size={sizeConfig.icon} />
        case "rb":
          return <PSBumper label="RB" size={sizeConfig.icon} />
        case "lt":
          return <PSTrigger label="LT" size={sizeConfig.icon} />
        case "rt":
          return <PSTrigger label="RT" size={sizeConfig.icon} />
        case "ls":
          return <PSStick label="LS" size={sizeConfig.icon} />
        case "rs":
          return <PSStick label="RS" size={sizeConfig.icon} />
        case "menu":
          return <OptionsButton size={sizeConfig.icon} />
        case "dpad":
          return <DPad size={sizeConfig.icon} />
      }
    }
    
    // Keyboard
    if (platform === "keyboard" || button === "key") {
      const keyLabel = label || button.toUpperCase()
      const isWide = ["space", "enter", "shift", "ctrl", "alt", "tab"].includes(keyLabel.toLowerCase())
      return <KeyboardKey label={keyLabel} size={sizeConfig.icon} wide={isWide} />
    }
    
    return null
  }

  return (
    <span className={cn("inline-flex items-center text-white/80", className)}>
      {renderButton()}
    </span>
  )
}

// Action hint component - shows button + action label
interface ActionHintProps {
  button: ButtonType
  action: string
  platform?: Platform
  size?: "xs" | "sm" | "md"
  className?: string
}

export function ActionHint({ button, action, platform = "playstation", size = "sm", className }: ActionHintProps) {
  const textSize = size === "xs" ? "text-[9px]" : size === "sm" ? "text-[10px]" : "text-xs"
  
  return (
    <div className={cn("flex items-center gap-1.5", className)}>
      <GamepadButton button={button} platform={platform} size={size} />
      <span className={cn("text-white/50 font-medium", textSize)}>{action}</span>
    </div>
  )
}

// Footer action bar component
interface FooterAction {
  button: ButtonType
  label: string
}

interface GamepadFooterProps {
  leftActions: FooterAction[]
  rightActions?: FooterAction[]
  centerContent?: React.ReactNode
  platform?: Platform
  className?: string
}

export function GamepadFooter({ leftActions, rightActions, centerContent, platform = "playstation", className }: GamepadFooterProps) {
  return (
    <div className={cn(
      "flex items-center justify-between px-6 py-3 bg-gradient-to-t from-black via-black/95 to-transparent",
      className
    )}>
      {/* Left Actions */}
      <div className="flex items-center gap-4">
        {leftActions.map((action, i) => (
          <ActionHint key={i} button={action.button} action={action.label} platform={platform} size="sm" />
        ))}
      </div>

      {/* Center Content */}
      {centerContent && (
        <div className="flex items-center">
          {centerContent}
        </div>
      )}

      {/* Right Actions */}
      {rightActions && (
        <div className="flex items-center gap-4">
          {rightActions.map((action, i) => (
            <ActionHint key={i} button={action.button} action={action.label} platform={platform} size="sm" />
          ))}
        </div>
      )}
    </div>
  )
}

// Shoulder button hints (LB/RB or L1/R1)
interface ShoulderHintsProps {
  leftLabel: string
  rightLabel: string
  platform?: Platform
  className?: string
}

export function ShoulderHints({ leftLabel, rightLabel, platform = "playstation", className }: ShoulderHintsProps) {
  const leftButton = platform === "playstation" ? "l1" : "lb"
  const rightButton = platform === "playstation" ? "r1" : "rb"
  
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <GamepadButton button={leftButton as ButtonType} platform={platform} size="sm" />
      <span className="text-white/50 text-[10px] font-medium">{leftLabel}</span>
      <GamepadButton button={rightButton as ButtonType} platform={platform} size="sm" />
      <span className="text-white/50 text-[10px] font-medium">{rightLabel}</span>
    </div>
  )
}
