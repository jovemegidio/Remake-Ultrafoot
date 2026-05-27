"use client"

import { useState } from "react"
import Image from "next/image"
import { cn } from "@/lib/utils"
import { getEscudoUrl, getTeamByShort, type Team } from "@/lib/teams-data"

interface TeamCrestProps {
  team?: Team
  teamShort?: string
  fileKey?: string
  size?: "xs" | "sm" | "md" | "lg" | "xl" | "2xl"
  className?: string
  showFallback?: boolean
}

const sizeMap = {
  xs: { container: "h-5 w-5", text: "text-[8px]" },
  sm: { container: "h-8 w-8", text: "text-[10px]" },
  md: { container: "h-12 w-12", text: "text-xs" },
  lg: { container: "h-16 w-16", text: "text-sm" },
  xl: { container: "h-24 w-24", text: "text-xl" },
  "2xl": { container: "h-32 w-32", text: "text-2xl" },
}

const sizePixels = {
  xs: 20,
  sm: 32,
  md: 48,
  lg: 64,
  xl: 96,
  "2xl": 128,
}

/**
 * Team crest component that loads real escudos from Ultrafoot repository
 * Falls back to styled abbreviation if image fails to load
 */
export function TeamCrest({
  team,
  teamShort,
  fileKey,
  size = "md",
  className,
  showFallback = true,
}: TeamCrestProps) {
  const [imageError, setImageError] = useState(false)
  const [imageLoaded, setImageLoaded] = useState(false)

  // Resolve team data
  const resolvedTeam = team || (teamShort ? getTeamByShort(teamShort) : undefined)
  const escudoKey = fileKey || resolvedTeam?.file_key
  const escudoUrl = escudoKey ? getEscudoUrl(escudoKey) : null

  const { container, text } = sizeMap[size]
  const pixels = sizePixels[size]

  // Fallback shield component
  const FallbackShield = () => (
    <div
      className={cn(
        "relative flex shrink-0 items-center justify-center overflow-hidden font-display tracking-wider",
        container,
        text,
        className,
      )}
      style={{
        clipPath: "polygon(50% 0, 100% 20%, 100% 80%, 50% 100%, 0 80%, 0 20%)",
        background: resolvedTeam 
          ? `linear-gradient(145deg, ${resolvedTeam.cor1} 0%, ${resolvedTeam.cor2} 100%)`
          : "linear-gradient(145deg, oklch(0.78 0.18 195) 0%, oklch(0.08 0.02 260) 100%)",
      }}
      aria-label={`Escudo ${resolvedTeam?.nome || teamShort || 'Time'}`}
    >
      <span 
        className="absolute inset-[2px] flex items-center justify-center bg-background/90 backdrop-blur-sm"
        style={{ clipPath: "polygon(50% 0, 100% 20%, 100% 80%, 50% 100%, 0 80%, 0 20%)" }}
      >
        <span 
          className="font-display-italic"
          style={{ color: resolvedTeam?.cor1 || "oklch(0.78 0.18 195)" }}
        >
          {resolvedTeam?.curto || teamShort || "?"}
        </span>
      </span>
    </div>
  )

  if (!escudoUrl || (imageError && showFallback)) {
    return <FallbackShield />
  }

  return (
    <div
      className={cn(
        "relative flex shrink-0 items-center justify-center overflow-hidden rounded bg-white",
        container,
        className,
      )}
      aria-label={`Escudo ${resolvedTeam?.nome || teamShort || 'Time'}`}
    >
      {/* Loading shimmer */}
      {!imageLoaded && !imageError && (
        <div className={cn("absolute inset-0 animate-shimmer", container)} />
      )}

      <Image
        src={escudoUrl}
        alt={`Escudo ${resolvedTeam?.nome || 'Time'}`}
        width={pixels}
        height={pixels}
        className={cn(
          "object-contain p-[6%] transition-opacity duration-300",
          imageLoaded ? "opacity-100" : "opacity-0"
        )}
        onLoad={() => setImageLoaded(true)}
        onError={() => setImageError(true)}
        unoptimized
      />
    </div>
  )
}

// Export a simpler version for lists
export function TeamCrestSmall({ 
  team, 
  teamShort,
  className 
}: { 
  team?: Team
  teamShort?: string
  className?: string 
}) {
  return (
    <TeamCrest 
      team={team} 
      teamShort={teamShort}
      size="sm" 
      className={className} 
    />
  )
}
