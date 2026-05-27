"use client"

import { useState } from "react"
import Image from "next/image"
import { cn } from "@/lib/utils"
import { getEscudoUrl, getTeamByShort, type Team } from "@/lib/teams-data"

interface TeamCrestProps {
  team?: Team
  teamShort?: string
  fileKey?: string
  size?: "xs" | "sm" | "md" | "lg" | "xl" | "2xl" | "3xl"
  className?: string
  showFallback?: boolean
}

const sizeMap = {
  xs: { container: "h-5 w-5", text: "text-[6px]", inner: "text-[5px]" },
  sm: { container: "h-8 w-8", text: "text-[8px]", inner: "text-[7px]" },
  md: { container: "h-12 w-12", text: "text-[10px]", inner: "text-[9px]" },
  lg: { container: "h-16 w-16", text: "text-xs", inner: "text-[10px]" },
  xl: { container: "h-20 w-20", text: "text-sm", inner: "text-xs" },
  "2xl": { container: "h-28 w-28", text: "text-lg", inner: "text-sm" },
  "3xl": { container: "h-36 w-36", text: "text-xl", inner: "text-base" },
}

const sizePixels = {
  xs: 20,
  sm: 32,
  md: 48,
  lg: 64,
  xl: 80,
  "2xl": 112,
  "3xl": 144,
}

/**
 * Team crest component that loads real escudos from Ultrafoot repository
 * Falls back to styled shield with team colors if image fails to load
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

  const { container, text, inner } = sizeMap[size]
  const pixels = sizePixels[size]

  // Professional fallback shield component
  const FallbackShield = () => {
    const cor1 = resolvedTeam?.cor1 || "#10b981"
    const cor2 = resolvedTeam?.cor2 || "#064e3b"
    const initial = resolvedTeam?.curto?.charAt(0) || teamShort?.charAt(0) || "?"
    const shortName = resolvedTeam?.curto || teamShort || "?"
    
    return (
      <div
        className={cn(
          "relative flex shrink-0 items-center justify-center overflow-hidden",
          container,
          className,
        )}
        aria-label={`Escudo ${resolvedTeam?.nome || teamShort || 'Time'}`}
      >
        <svg 
          viewBox="0 0 100 120" 
          className="w-full h-full"
          style={{ filter: "drop-shadow(0 4px 12px rgba(0,0,0,0.4))" }}
        >
          {/* Shield shape with gradient */}
          <defs>
            <linearGradient id={`shield-grad-${escudoKey || 'default'}`} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor={cor1} />
              <stop offset="100%" stopColor={cor2} />
            </linearGradient>
            <linearGradient id={`shine-${escudoKey || 'default'}`} x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="rgba(255,255,255,0.3)" />
              <stop offset="50%" stopColor="rgba(255,255,255,0)" />
            </linearGradient>
            <clipPath id={`shield-clip-${escudoKey || 'default'}`}>
              <path d="M50 0 L95 15 L95 70 Q95 100 50 120 Q5 100 5 70 L5 15 Z" />
            </clipPath>
          </defs>
          
          {/* Shield background */}
          <path 
            d="M50 0 L95 15 L95 70 Q95 100 50 120 Q5 100 5 70 L5 15 Z"
            fill={`url(#shield-grad-${escudoKey || 'default'})`}
          />
          
          {/* Inner border */}
          <path 
            d="M50 6 L89 19 L89 68 Q89 94 50 113 Q11 94 11 68 L11 19 Z"
            fill="none"
            stroke="rgba(255,255,255,0.2)"
            strokeWidth="1"
          />
          
          {/* Shine overlay */}
          <path 
            d="M50 0 L95 15 L95 70 Q95 100 50 120 Q5 100 5 70 L5 15 Z"
            fill={`url(#shine-${escudoKey || 'default'})`}
          />
          
          {/* Horizontal stripe */}
          <rect 
            x="5" 
            y="45" 
            width="90" 
            height="20" 
            fill="rgba(0,0,0,0.15)"
            clipPath={`url(#shield-clip-${escudoKey || 'default'})`}
          />
          
          {/* Team abbreviation */}
          <text 
            x="50" 
            y="72" 
            textAnchor="middle" 
            fill="white" 
            fontSize="28"
            fontWeight="900"
            fontFamily="system-ui, -apple-system, sans-serif"
            style={{ textShadow: "0 2px 4px rgba(0,0,0,0.5)" }}
          >
            {shortName.substring(0, 3)}
          </text>
        </svg>
      </div>
    )
  }

  if (!escudoUrl || (imageError && showFallback)) {
    return <FallbackShield />
  }

  return (
    <div 
      className={cn(
        "relative flex shrink-0 items-center justify-center",
        container,
        className,
      )}
      aria-label={`Escudo ${resolvedTeam?.nome || teamShort || 'Time'}`}
    >
      {/* Loading shimmer */}
      {!imageLoaded && !imageError && (
        <div 
          className={cn(
            "absolute inset-0 rounded-xl animate-pulse bg-gradient-to-br from-white/10 to-white/5",
            container
          )} 
        />
      )}
      
      <Image
        src={escudoUrl}
        alt={`Escudo ${resolvedTeam?.nome || 'Time'}`}
        width={pixels}
        height={pixels}
        className={cn(
          "object-contain transition-all duration-300",
          imageLoaded ? "opacity-100 scale-100" : "opacity-0 scale-95",
        )}
        style={{ 
          filter: imageLoaded ? "drop-shadow(0 4px 12px rgba(0,0,0,0.4))" : undefined 
        }}
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
