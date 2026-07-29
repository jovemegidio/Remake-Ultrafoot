"use client"

import { useContext, useState, useEffect } from "react"
import { cn } from "@/lib/utils"

type ControllerType = "xbox" | "playstation"

// Context for auto-detecting controller type
import { createContext } from "react"
export const ControllerTypeContext = createContext<ControllerType>("playstation")

interface ControllerButtonProps {
  button: "A" | "B" | "X" | "Y" | "LB" | "RB" | "LT" | "RT" | "LS" | "RS" | "L" | "R" | "L3" | "R3" | "DPAD" | "DPAD_UP" | "DPAD_DOWN" | "DPAD_LEFT" | "DPAD_RIGHT" | "MENU" | "VIEW"
  label?: string
  size?: "xs" | "sm" | "md" | "lg"
  controller?: ControllerType
  className?: string
  showLabel?: boolean
}

// Xbox button icons - outline style matching reference image (white outline, letter inside)
function XboxAButton({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} fill="none">
      <circle cx="16" cy="16" r="13" stroke="white" strokeWidth="1.5" fill="transparent" />
      <circle cx="16" cy="16" r="10" stroke="white" strokeWidth="1" strokeOpacity="0.3" fill="transparent" />
      <text x="16" y="20" textAnchor="middle" fill="white" fontSize="12" fontWeight="bold" fontFamily="system-ui">A</text>
    </svg>
  )
}

function XboxBButton({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} fill="none">
      <circle cx="16" cy="16" r="13" stroke="white" strokeWidth="1.5" fill="transparent" />
      <circle cx="16" cy="16" r="10" stroke="white" strokeWidth="1" strokeOpacity="0.3" fill="transparent" />
      <text x="16" y="20" textAnchor="middle" fill="white" fontSize="12" fontWeight="bold" fontFamily="system-ui">B</text>
    </svg>
  )
}

function XboxXButton({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} fill="none">
      <circle cx="16" cy="16" r="13" stroke="white" strokeWidth="1.5" fill="transparent" />
      <circle cx="16" cy="16" r="10" stroke="white" strokeWidth="1" strokeOpacity="0.3" fill="transparent" />
      <text x="16" y="20" textAnchor="middle" fill="white" fontSize="12" fontWeight="bold" fontFamily="system-ui">X</text>
    </svg>
  )
}

function XboxYButton({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} fill="none">
      <circle cx="16" cy="16" r="13" stroke="white" strokeWidth="1.5" fill="transparent" />
      <circle cx="16" cy="16" r="10" stroke="white" strokeWidth="1" strokeOpacity="0.3" fill="transparent" />
      <text x="16" y="20" textAnchor="middle" fill="white" fontSize="12" fontWeight="bold" fontFamily="system-ui">Y</text>
    </svg>
  )
}

function XboxLBButton({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 44 28" className={className} fill="none">
      <rect x="2" y="2" width="40" height="24" rx="6" stroke="white" strokeWidth="1.5" fill="transparent" />
      <text x="22" y="18" textAnchor="middle" fill="white" fontSize="11" fontWeight="bold" fontFamily="system-ui">LB</text>
    </svg>
  )
}

function XboxRBButton({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 44 28" className={className} fill="none">
      <rect x="2" y="2" width="40" height="24" rx="6" stroke="white" strokeWidth="1.5" fill="transparent" />
      <text x="22" y="18" textAnchor="middle" fill="white" fontSize="11" fontWeight="bold" fontFamily="system-ui">RB</text>
    </svg>
  )
}

function XboxLTButton({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 36 40" className={className} fill="none">
      {/* Trigger shape - wider at top, narrower at bottom */}
      <path d="M4 6C4 3 7 2 10 2H26C29 2 32 3 32 6V32C32 36 28 38 18 38C8 38 4 36 4 32V6Z" stroke="white" strokeWidth="1.5" fill="transparent" />
      <text x="18" y="24" textAnchor="middle" fill="white" fontSize="11" fontWeight="bold" fontFamily="system-ui">LT</text>
    </svg>
  )
}

function XboxRTButton({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 36 40" className={className} fill="none">
      {/* Trigger shape - wider at top, narrower at bottom */}
      <path d="M4 6C4 3 7 2 10 2H26C29 2 32 3 32 6V32C32 36 28 38 18 38C8 38 4 36 4 32V6Z" stroke="white" strokeWidth="1.5" fill="transparent" />
      <text x="18" y="24" textAnchor="middle" fill="white" fontSize="11" fontWeight="bold" fontFamily="system-ui">RT</text>
    </svg>
  )
}

function XboxLSButton({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} fill="none">
      <circle cx="16" cy="16" r="13" stroke="white" strokeWidth="1.5" fill="transparent" />
      <circle cx="16" cy="16" r="8" stroke="white" strokeWidth="1" strokeOpacity="0.5" fill="transparent" />
      <text x="16" y="20" textAnchor="middle" fill="white" fontSize="10" fontWeight="bold" fontFamily="system-ui">LS</text>
    </svg>
  )
}

function XboxRSButton({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} fill="none">
      <circle cx="16" cy="16" r="13" stroke="white" strokeWidth="1.5" fill="transparent" />
      <circle cx="16" cy="16" r="8" stroke="white" strokeWidth="1" strokeOpacity="0.5" fill="transparent" />
      <text x="16" y="20" textAnchor="middle" fill="white" fontSize="10" fontWeight="bold" fontFamily="system-ui">RS</text>
    </svg>
  )
}

function XboxDpadButton({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} fill="none">
      {/* D-Pad cross shape */}
      <path d="M11 3H21V11H29V21H21V29H11V21H3V11H11V3Z" stroke="white" strokeWidth="1.5" fill="transparent" />
      {/* Direction arrows */}
      <path d="M16 7L13 10H19L16 7Z" fill="white" fillOpacity="0.6" />
      <path d="M16 25L13 22H19L16 25Z" fill="white" fillOpacity="0.6" />
      <path d="M7 16L10 13V19L7 16Z" fill="white" fillOpacity="0.6" />
      <path d="M25 16L22 13V19L25 16Z" fill="white" fillOpacity="0.6" />
    </svg>
  )
}

function XboxDpadUpButton({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} fill="none">
      <rect x="12" y="2" width="8" height="14" rx="1" stroke="white" strokeWidth="2" fill="white" fillOpacity="0.3" />
      <rect x="12" y="16" width="8" height="14" rx="1" stroke="white" strokeWidth="2" fill="transparent" />
      <rect x="2" y="12" width="10" height="8" rx="1" stroke="white" strokeWidth="2" fill="transparent" />
      <rect x="20" y="12" width="10" height="8" rx="1" stroke="white" strokeWidth="2" fill="transparent" />
    </svg>
  )
}

function XboxDpadDownButton({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} fill="none">
      <rect x="12" y="2" width="8" height="14" rx="1" stroke="white" strokeWidth="2" fill="transparent" />
      <rect x="12" y="16" width="8" height="14" rx="1" stroke="white" strokeWidth="2" fill="white" fillOpacity="0.3" />
      <rect x="2" y="12" width="10" height="8" rx="1" stroke="white" strokeWidth="2" fill="transparent" />
      <rect x="20" y="12" width="10" height="8" rx="1" stroke="white" strokeWidth="2" fill="transparent" />
    </svg>
  )
}

function XboxDpadLeftButton({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} fill="none">
      <rect x="12" y="2" width="8" height="14" rx="1" stroke="white" strokeWidth="2" fill="transparent" />
      <rect x="12" y="16" width="8" height="14" rx="1" stroke="white" strokeWidth="2" fill="transparent" />
      <rect x="2" y="12" width="10" height="8" rx="1" stroke="white" strokeWidth="2" fill="white" fillOpacity="0.3" />
      <rect x="20" y="12" width="10" height="8" rx="1" stroke="white" strokeWidth="2" fill="transparent" />
    </svg>
  )
}

function XboxDpadRightButton({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} fill="none">
      <rect x="12" y="2" width="8" height="14" rx="1" stroke="white" strokeWidth="2" fill="transparent" />
      <rect x="12" y="16" width="8" height="14" rx="1" stroke="white" strokeWidth="2" fill="transparent" />
      <rect x="2" y="12" width="10" height="8" rx="1" stroke="white" strokeWidth="2" fill="transparent" />
      <rect x="20" y="12" width="10" height="8" rx="1" stroke="white" strokeWidth="2" fill="white" fillOpacity="0.3" />
    </svg>
  )
}

function XboxL3Button({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 24" className={className} fill="none">
      <rect x="1" y="1" width="38" height="22" rx="4" stroke="white" strokeWidth="2" fill="transparent" />
      <text x="20" y="17" textAnchor="middle" fill="white" fontSize="12" fontWeight="bold" fontFamily="system-ui">L3</text>
    </svg>
  )
}

function XboxR3Button({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 24" className={className} fill="none">
      <rect x="1" y="1" width="38" height="22" rx="4" stroke="white" strokeWidth="2" fill="transparent" />
      <text x="20" y="17" textAnchor="middle" fill="white" fontSize="12" fontWeight="bold" fontFamily="system-ui">R3</text>
    </svg>
  )
}

function XboxMenuButton({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 24" className={className} fill="none">
      <rect x="2" y="2" width="28" height="20" rx="3" stroke="white" strokeWidth="1.5" fill="transparent" />
      <line x1="8" y1="8" x2="24" y2="8" stroke="white" strokeWidth="1.5" />
      <line x1="8" y1="12" x2="24" y2="12" stroke="white" strokeWidth="1.5" />
      <line x1="8" y1="16" x2="24" y2="16" stroke="white" strokeWidth="1.5" />
    </svg>
  )
}

function XboxViewButton({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 24" className={className} fill="none">
      <rect x="2" y="4" width="14" height="10" rx="2" stroke="white" strokeWidth="1.5" fill="transparent" />
      <rect x="16" y="10" width="14" height="10" rx="2" stroke="white" strokeWidth="1.5" fill="transparent" />
    </svg>
  )
}

// PlayStation button icons - outline style matching reference image
function PSCrossButton({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} fill="none">
      <circle cx="16" cy="16" r="13" stroke="white" strokeWidth="1.5" fill="transparent" />
      <path d="M10 10L22 22M22 10L10 22" stroke="white" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

function PSCircleButton({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} fill="none">
      <circle cx="16" cy="16" r="13" stroke="white" strokeWidth="1.5" fill="transparent" />
      <circle cx="16" cy="16" r="6" stroke="white" strokeWidth="2" fill="transparent" />
    </svg>
  )
}

function PSSquareButton({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} fill="none">
      <circle cx="16" cy="16" r="13" stroke="white" strokeWidth="1.5" fill="transparent" />
      <rect x="9" y="9" width="14" height="14" stroke="white" strokeWidth="2" fill="transparent" />
    </svg>
  )
}

function PSTriangleButton({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} fill="none">
      <circle cx="16" cy="16" r="13" stroke="white" strokeWidth="1.5" fill="transparent" />
      <path d="M16 8L24 24H8L16 8Z" stroke="white" strokeWidth="2" fill="transparent" strokeLinejoin="round" />
    </svg>
  )
}

function PSL1Button({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 44 28" className={className} fill="none">
      <rect x="2" y="2" width="40" height="24" rx="10" stroke="white" strokeWidth="1.5" fill="transparent" />
      <text x="22" y="18" textAnchor="middle" fill="white" fontSize="11" fontWeight="bold" fontFamily="system-ui">L1</text>
    </svg>
  )
}

function PSR1Button({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 44 28" className={className} fill="none">
      <rect x="2" y="2" width="40" height="24" rx="10" stroke="white" strokeWidth="1.5" fill="transparent" />
      <text x="22" y="18" textAnchor="middle" fill="white" fontSize="11" fontWeight="bold" fontFamily="system-ui">R1</text>
    </svg>
  )
}

function PSL2Button({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 36 40" className={className} fill="none">
      {/* Trigger shape matching reference */}
      <path d="M4 6C4 3 7 2 10 2H26C29 2 32 3 32 6V32C32 36 28 38 18 38C8 38 4 36 4 32V6Z" stroke="white" strokeWidth="1.5" fill="transparent" />
      <text x="18" y="24" textAnchor="middle" fill="white" fontSize="11" fontWeight="bold" fontFamily="system-ui">L2</text>
    </svg>
  )
}

function PSR2Button({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 36 40" className={className} fill="none">
      {/* Trigger shape matching reference */}
      <path d="M4 6C4 3 7 2 10 2H26C29 2 32 3 32 6V32C32 36 28 38 18 38C8 38 4 36 4 32V6Z" stroke="white" strokeWidth="1.5" fill="transparent" />
      <text x="18" y="24" textAnchor="middle" fill="white" fontSize="11" fontWeight="bold" fontFamily="system-ui">R2</text>
    </svg>
  )
}

function PSL3Button({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} fill="none">
      <circle cx="16" cy="16" r="13" stroke="white" strokeWidth="1.5" fill="transparent" />
      <circle cx="16" cy="16" r="8" stroke="white" strokeWidth="1" strokeOpacity="0.5" fill="transparent" />
      <text x="16" y="20" textAnchor="middle" fill="white" fontSize="10" fontWeight="bold" fontFamily="system-ui">L3</text>
    </svg>
  )
}

function PSR3Button({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} fill="none">
      <circle cx="16" cy="16" r="13" stroke="white" strokeWidth="1.5" fill="transparent" />
      <circle cx="16" cy="16" r="8" stroke="white" strokeWidth="1" strokeOpacity="0.5" fill="transparent" />
      <text x="16" y="20" textAnchor="middle" fill="white" fontSize="10" fontWeight="bold" fontFamily="system-ui">R3</text>
    </svg>
  )
}

function PSDpadButton({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} fill="none">
      {/* D-Pad cross shape */}
      <path d="M11 3H21V11H29V21H21V29H11V21H3V11H11V3Z" stroke="white" strokeWidth="1.5" fill="transparent" />
      {/* Direction arrows */}
      <path d="M16 7L13 10H19L16 7Z" fill="white" fillOpacity="0.6" />
      <path d="M16 25L13 22H19L16 25Z" fill="white" fillOpacity="0.6" />
      <path d="M7 16L10 13V19L7 16Z" fill="white" fillOpacity="0.6" />
      <path d="M25 16L22 13V19L25 16Z" fill="white" fillOpacity="0.6" />
    </svg>
  )
}

function PSDpadUpButton({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} fill="none">
      <rect x="12" y="2" width="8" height="14" rx="1" stroke="white" strokeWidth="2" fill="white" fillOpacity="0.3" />
      <rect x="12" y="16" width="8" height="14" rx="1" stroke="white" strokeWidth="2" fill="transparent" />
      <rect x="2" y="12" width="10" height="8" rx="1" stroke="white" strokeWidth="2" fill="transparent" />
      <rect x="20" y="12" width="10" height="8" rx="1" stroke="white" strokeWidth="2" fill="transparent" />
    </svg>
  )
}

function PSDpadDownButton({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} fill="none">
      <rect x="12" y="2" width="8" height="14" rx="1" stroke="white" strokeWidth="2" fill="transparent" />
      <rect x="12" y="16" width="8" height="14" rx="1" stroke="white" strokeWidth="2" fill="white" fillOpacity="0.3" />
      <rect x="2" y="12" width="10" height="8" rx="1" stroke="white" strokeWidth="2" fill="transparent" />
      <rect x="20" y="12" width="10" height="8" rx="1" stroke="white" strokeWidth="2" fill="transparent" />
    </svg>
  )
}

function PSDpadLeftButton({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} fill="none">
      <rect x="12" y="2" width="8" height="14" rx="1" stroke="white" strokeWidth="2" fill="transparent" />
      <rect x="12" y="16" width="8" height="14" rx="1" stroke="white" strokeWidth="2" fill="transparent" />
      <rect x="2" y="12" width="10" height="8" rx="1" stroke="white" strokeWidth="2" fill="white" fillOpacity="0.3" />
      <rect x="20" y="12" width="10" height="8" rx="1" stroke="white" strokeWidth="2" fill="transparent" />
    </svg>
  )
}

function PSDpadRightButton({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} fill="none">
      <rect x="12" y="2" width="8" height="14" rx="1" stroke="white" strokeWidth="2" fill="transparent" />
      <rect x="12" y="16" width="8" height="14" rx="1" stroke="white" strokeWidth="2" fill="transparent" />
      <rect x="2" y="12" width="10" height="8" rx="1" stroke="white" strokeWidth="2" fill="transparent" />
      <rect x="20" y="12" width="10" height="8" rx="1" stroke="white" strokeWidth="2" fill="white" fillOpacity="0.3" />
    </svg>
  )
}

function PSOptionsButton({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 24" className={className} fill="none">
      <rect x="2" y="2" width="28" height="20" rx="3" stroke="white" strokeWidth="1.5" fill="transparent" />
      <line x1="8" y1="8" x2="24" y2="8" stroke="white" strokeWidth="1.5" />
      <line x1="8" y1="12" x2="24" y2="12" stroke="white" strokeWidth="1.5" />
      <line x1="8" y1="16" x2="24" y2="16" stroke="white" strokeWidth="1.5" />
    </svg>
  )
}

function PSShareButton({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} fill="none">
      <rect x="4" y="4" width="24" height="24" rx="4" stroke="white" strokeWidth="1.5" fill="transparent" />
      {/* Share icon - lines radiating */}
      <circle cx="16" cy="10" r="2" stroke="white" strokeWidth="1.5" fill="transparent" />
      <circle cx="10" cy="20" r="2" stroke="white" strokeWidth="1.5" fill="transparent" />
      <circle cx="22" cy="20" r="2" stroke="white" strokeWidth="1.5" fill="transparent" />
      <line x1="14" y1="11" x2="11" y2="18" stroke="white" strokeWidth="1.5" />
      <line x1="18" y1="11" x2="21" y2="18" stroke="white" strokeWidth="1.5" />
    </svg>
  )
}

function PSTouchpadButton({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 56 28" className={className} fill="none">
      <rect x="2" y="2" width="52" height="24" rx="4" stroke="white" strokeWidth="1.5" fill="transparent" />
      {/* Dotted texture */}
      <g opacity="0.3">
        {[0, 1, 2, 3, 4, 5, 6, 7].map(i => (
          <line key={i} x1={10 + i * 5} y1="8" x2={10 + i * 5} y2="20" stroke="white" strokeWidth="0.5" strokeDasharray="1 2" />
        ))}
      </g>
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
  
  const isWide = ["LB", "RB", "LT", "RT", "LS", "RS", "L3", "R3", "MENU", "VIEW"].includes(button)
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
        case "LS": case "L": return <XboxLSButton className={sizeClass} />
        case "RS": case "R": return <XboxRSButton className={sizeClass} />
        case "L3": return <XboxL3Button className={sizeClass} />
        case "R3": return <XboxR3Button className={sizeClass} />
        case "DPAD": return <XboxDpadButton className={sizeClass} />
        case "DPAD_UP": return <XboxDpadUpButton className={sizeClass} />
        case "DPAD_DOWN": return <XboxDpadDownButton className={sizeClass} />
        case "DPAD_LEFT": return <XboxDpadLeftButton className={sizeClass} />
        case "DPAD_RIGHT": return <XboxDpadRightButton className={sizeClass} />
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
        case "L3": return <PSL3Button className={sizeClass} />
        case "R3": return <PSR3Button className={sizeClass} />
        case "DPAD": return <PSDpadButton className={sizeClass} />
        case "DPAD_UP": return <PSDpadUpButton className={sizeClass} />
        case "DPAD_DOWN": return <PSDpadDownButton className={sizeClass} />
        case "DPAD_LEFT": return <PSDpadLeftButton className={sizeClass} />
        case "DPAD_RIGHT": return <PSDpadRightButton className={sizeClass} />
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
  visible?: boolean // Force visibility (undefined = auto-detect)
}

// Hook para detectar gamepad conectado - exportado para uso em outros componentes
export function useGamepadConnected() {
  const [connected, setConnected] = useState(false)
  const [type, setType] = useState<ControllerType>("xbox")

  useEffect(() => {
    const detectControllerType = (gamepad: Gamepad): ControllerType => {
      const id = gamepad.id.toLowerCase()
      if (id.includes("playstation") || id.includes("dualshock") || id.includes("dualsense") || id.includes("054c") || id.includes("sony")) {
        return "playstation"
      }
      return "xbox"
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
        setConnected(true)
        setType(detectControllerType(foundGamepad))
      } else {
        setConnected(false)
      }
    }

    const handleGamepadConnected = () => updateGamepads()
    const handleGamepadDisconnected = () => updateGamepads()

    // Initial check
    updateGamepads()

    window.addEventListener("gamepadconnected", handleGamepadConnected)
    window.addEventListener("gamepaddisconnected", handleGamepadDisconnected)

    // Periodic check (some browsers don't fire events reliably)
    const interval = setInterval(updateGamepads, 2000)

    return () => {
      window.removeEventListener("gamepadconnected", handleGamepadConnected)
      window.removeEventListener("gamepaddisconnected", handleGamepadDisconnected)
      clearInterval(interval)
    }
  }, [])

  return { connected, type }
}

export function ControllerToolbar({ actions, controller, className, visible }: ControllerToolbarProps) {
  const contextController = useContext(ControllerTypeContext)
  const { connected, type } = useGamepadConnected()
  
  // Use deteccao automatica se visible nao for especificado
  const shouldShow = visible !== undefined ? visible : connected
  
  if (!shouldShow) return null
  
  const activeController = controller || (connected ? type : contextController)
  
  return (
    <div className={cn(
      "flex items-center gap-6 px-4 py-2 bg-[#050508]/95 backdrop-blur-sm border-t border-white/[0.04]",
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

// Header controls (LB/RB navigation) - so aparece com gamepad conectado
interface HeaderControlsProps {
  controller?: ControllerType
  className?: string
  forceVisible?: boolean
}

export function HeaderControls({ controller, className, forceVisible }: HeaderControlsProps) {
  const contextController = useContext(ControllerTypeContext)
  const { connected, type } = useGamepadConnected()
  
  // So mostra se gamepad conectado (ou forceVisible)
  if (!forceVisible && !connected) return null
  
  const activeController = controller || (connected ? type : contextController)
  
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <ControllerButton button="LB" controller={activeController} size="xs" showLabel={false} />
      <div className="flex items-center gap-1">
        <div className="w-1.5 h-1.5 rounded-full bg-white/20" />
        <div className="w-1.5 h-1.5 rounded-full bg-[var(--brand)]" />
        <div className="w-1.5 h-1.5 rounded-full bg-white/20" />
      </div>
      <ControllerButton button="RB" controller={activeController} size="xs" showLabel={false} />
    </div>
  )
}

// Carousel dots estilo EA FC - botoes de navegacao so aparecem com gamepad
interface CarouselDotsProps {
  total: number
  current: number
  onSelect?: (index: number) => void
  showNavButtons?: boolean // undefined = auto-detect, true/false = force
  controller?: ControllerType
  className?: string
}

export function CarouselDots({ 
  total, 
  current, 
  onSelect, 
  showNavButtons,
  controller,
  className 
}: CarouselDotsProps) {
  const contextController = useContext(ControllerTypeContext)
  const { connected, type } = useGamepadConnected()
  
  // Determina se deve mostrar botoes de navegacao
  const shouldShowNavButtons = showNavButtons !== undefined ? showNavButtons : connected
  const activeController = controller || (connected ? type : contextController)
  
  return (
    <div className={cn("flex items-center gap-3", className)}>
      {shouldShowNavButtons && (
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
      {shouldShowNavButtons && (
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
        "bg-[var(--brand)]"
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
