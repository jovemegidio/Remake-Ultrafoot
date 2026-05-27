"use client"

import { useState, useMemo } from "react"
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

// Gera um ID unico para evitar conflitos de gradientes SVG
function generateUniqueId(prefix: string, key: string): string {
  return `${prefix}-${key}-${Math.random().toString(36).substr(2, 9)}`
}

/**
 * Team crest component with premium fallback design
 * Professional EA FC style shields when images aren't available
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

  const { container } = sizeMap[size]
  const pixels = sizePixels[size]

  // Generate unique IDs for SVG gradients
  const uniqueIds = useMemo(() => ({
    gradient: generateUniqueId('grad', escudoKey || 'default'),
    shine: generateUniqueId('shine', escudoKey || 'default'),
    clip: generateUniqueId('clip', escudoKey || 'default'),
    stripe: generateUniqueId('stripe', escudoKey || 'default'),
  }), [escudoKey])

  // Professional fallback shield - EA FC style
  const FallbackShield = () => {
    const cor1 = resolvedTeam?.cor1 || "#1db954"
    const cor2 = resolvedTeam?.cor2 || "#0d5c2a"
    const shortName = resolvedTeam?.curto || teamShort || "?"
    
    // Determine if we need light or dark text based on background brightness
    const getBrightness = (hex: string) => {
      const rgb = parseInt(hex.slice(1), 16)
      const r = (rgb >> 16) & 0xff
      const g = (rgb >> 8) & 0xff
      const b = (rgb >> 0) & 0xff
      return (r * 299 + g * 587 + b * 114) / 1000
    }
    
    const brightness = getBrightness(cor1)
    const textColor = brightness > 128 ? "#000000" : "#ffffff"
    const textShadow = brightness > 128 ? "rgba(255,255,255,0.3)" : "rgba(0,0,0,0.5)"
    
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
          style={{ filter: "drop-shadow(0 2px 8px rgba(0,0,0,0.4))" }}
        >
          <defs>
            {/* Main gradient */}
            <linearGradient id={uniqueIds.gradient} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor={cor1} />
              <stop offset="50%" stopColor={cor1} />
              <stop offset="100%" stopColor={cor2} />
            </linearGradient>
            
            {/* Shine overlay */}
            <linearGradient id={uniqueIds.shine} x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="rgba(255,255,255,0.35)" />
              <stop offset="30%" stopColor="rgba(255,255,255,0.1)" />
              <stop offset="100%" stopColor="rgba(0,0,0,0.1)" />
            </linearGradient>
            
            {/* Clip path for shield shape */}
            <clipPath id={uniqueIds.clip}>
              <path d="M50 2 L96 18 L96 68 Q96 98 50 118 Q4 98 4 68 L4 18 Z" />
            </clipPath>
            
            {/* Stripe pattern */}
            <pattern id={uniqueIds.stripe} patternUnits="userSpaceOnUse" width="100" height="120">
              <rect x="0" y="0" width="100" height="120" fill="transparent"/>
              <rect x="0" y="48" width="100" height="24" fill={cor2} opacity="0.3"/>
            </pattern>
          </defs>
          
          {/* Shield base with gradient */}
          <path 
            d="M50 2 L96 18 L96 68 Q96 98 50 118 Q4 98 4 68 L4 18 Z"
            fill={`url(#${uniqueIds.gradient})`}
          />
          
          {/* Stripe accent */}
          <rect 
            x="0" 
            y="0" 
            width="100" 
            height="120" 
            fill={`url(#${uniqueIds.stripe})`}
            clipPath={`url(#${uniqueIds.clip})`}
          />
          
          {/* Inner border */}
          <path 
            d="M50 8 L90 22 L90 66 Q90 92 50 110 Q10 92 10 66 L10 22 Z"
            fill="none"
            stroke={cor2}
            strokeWidth="1.5"
            opacity="0.4"
          />
          
          {/* Shine overlay */}
          <path 
            d="M50 2 L96 18 L96 68 Q96 98 50 118 Q4 98 4 68 L4 18 Z"
            fill={`url(#${uniqueIds.shine})`}
          />
          
          {/* Outer border */}
          <path 
            d="M50 2 L96 18 L96 68 Q96 98 50 118 Q4 98 4 68 L4 18 Z"
            fill="none"
            stroke="rgba(255,255,255,0.2)"
            strokeWidth="1"
          />
          
          {/* Team abbreviation */}
          <text 
            x="50" 
            y="70" 
            textAnchor="middle" 
            fill={textColor}
            fontSize="26"
            fontWeight="800"
            fontFamily="system-ui, -apple-system, sans-serif"
            letterSpacing="1"
            style={{ 
              filter: `drop-shadow(0 1px 2px ${textShadow})`,
            }}
          >
            {shortName.substring(0, 3).toUpperCase()}
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
          filter: imageLoaded ? "drop-shadow(0 2px 8px rgba(0,0,0,0.4))" : undefined 
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
