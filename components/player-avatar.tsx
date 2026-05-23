"use client"

import { cn } from "@/lib/utils"
import { memo } from "react"

interface PlayerAvatarProps {
  name: string
  teamColor?: string
  size?: "xs" | "sm" | "md" | "lg" | "xl"
  className?: string
  playerId?: string
}

const sizeClasses = {
  xs: "h-8 w-8",
  sm: "h-10 w-10",
  md: "h-14 w-14",
  lg: "h-16 w-16",
  xl: "h-24 w-24",
}

const textSizeClasses = {
  xs: "text-xs",
  sm: "text-sm",
  md: "text-xl",
  lg: "text-2xl",
  xl: "text-4xl",
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return "?"
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase()
  return `${parts[0].charAt(0)}${parts[parts.length - 1].charAt(0)}`.toUpperCase()
}

function hashHue(name: string): number {
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) % 360
  }
  return hash
}

function PlayerAvatarBase({
  name,
  teamColor,
  size,
  className,
  rounded,
}: PlayerAvatarProps & { rounded: "xl" | "full" }) {
  const hue = hashHue(name)
  const background = teamColor
    ? `linear-gradient(135deg, ${teamColor}66 0%, hsl(${hue} 55% 22%) 100%)`
    : `linear-gradient(135deg, hsl(${hue} 65% 32%) 0%, hsl(${(hue + 42) % 360} 55% 16%) 100%)`

  return (
    <div
      className={cn(
        "relative overflow-hidden flex items-center justify-center border border-white/10",
        rounded === "full" ? "rounded-full" : "rounded-xl",
        sizeClasses[size ?? "md"],
        className,
      )}
      style={{ background }}
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.24),transparent_38%)]" />
      <span className={cn("relative font-black text-white/75", textSizeClasses[size ?? "md"])}>
        {getInitials(name)}
      </span>
    </div>
  )
}

export const PlayerAvatar = memo(function PlayerAvatar({ 
  name, 
  teamColor,
  size = "md", 
  className,
}: PlayerAvatarProps) {
  return <PlayerAvatarBase name={name} teamColor={teamColor} size={size} className={className} rounded="xl" />
})

export const PlayerAvatarCircle = memo(function PlayerAvatarCircle({ 
  name, 
  teamColor,
  size = "md", 
  className 
}: PlayerAvatarProps) {
  return <PlayerAvatarBase name={name} teamColor={teamColor} size={size} className={className} rounded="full" />
})
