"use client"

import { cn } from "@/lib/utils"

interface JerseyProps {
  variant?: "home" | "away" | "third"
  primary: string
  secondary: string
  accent?: string
  pattern?: "stripes" | "solid" | "diagonal" | "hoops" | "half"
  number?: number
  sponsor?: string
  className?: string
  size?: "sm" | "md" | "lg"
}

const sizeMap = {
  sm: "w-16",
  md: "w-24",
  lg: "w-32",
}

/**
 * EA FC 26 style football jersey with realistic patterns and details
 */
export function Jersey({ 
  variant = "home", 
  primary, 
  secondary, 
  accent,
  pattern = "solid", 
  number,
  sponsor,
  className,
  size = "md",
}: JerseyProps) {
  const uniqueId = `jersey-${variant}-${Math.random().toString(36).slice(2, 9)}`

  return (
    <div className={cn("relative aspect-[4/5]", sizeMap[size], className)} aria-label={`Uniforme ${variant}`}>
      <svg viewBox="0 0 100 120" className="h-full w-full drop-shadow-[0_8px_24px_rgba(0,0,0,0.5)]">
        <defs>
          {/* Gradient shading for 3D effect */}
          <linearGradient id={`shade-${uniqueId}`} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="white" stopOpacity="0.15" />
            <stop offset="0.5" stopColor="white" stopOpacity="0" />
            <stop offset="1" stopColor="black" stopOpacity="0.3" />
          </linearGradient>

          {/* Vertical stripes pattern */}
          <pattern id={`stripes-${uniqueId}`} width="10" height="120" patternUnits="userSpaceOnUse">
            <rect width="5" height="120" fill={primary} />
            <rect x="5" width="5" height="120" fill={secondary} />
          </pattern>

          {/* Horizontal hoops pattern */}
          <pattern id={`hoops-${uniqueId}`} width="100" height="16" patternUnits="userSpaceOnUse">
            <rect width="100" height="8" fill={primary} />
            <rect y="8" width="100" height="8" fill={secondary} />
          </pattern>

          {/* Half pattern (sash) */}
          <linearGradient id={`half-${uniqueId}`} x1="0" x2="1" y1="0" y2="0">
            <stop offset="0.45" stopColor={primary} />
            <stop offset="0.55" stopColor={secondary} />
          </linearGradient>

          {/* Fabric texture */}
          <filter id={`texture-${uniqueId}`}>
            <feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="4" result="noise" />
            <feDiffuseLighting in="noise" lightingColor="white" surfaceScale="1" result="light">
              <feDistantLight azimuth="45" elevation="60" />
            </feDiffuseLighting>
            <feBlend in="SourceGraphic" in2="light" mode="multiply" />
          </filter>
        </defs>

        {/* Shirt body */}
        <path
          d="M30 10 L20 18 L8 28 L14 50 L22 48 L22 110 Q22 115 27 115 L73 115 Q78 115 78 110 L78 48 L86 50 L92 28 L80 18 L70 10 Q60 22 50 22 Q40 22 30 10 Z"
          fill={getPatternFill(pattern, uniqueId, primary, secondary)}
        />

        {/* Diagonal sash overlay */}
        {pattern === "diagonal" && (
          <path
            d="M25 20 L15 30 L75 115 L78 110 L78 100 L35 20 Z"
            fill={secondary}
            opacity="0.95"
          />
        )}

        {/* Collar - modern V-neck style */}
        <path 
          d="M40 10 L50 26 L60 10 Q55 16 50 16 Q45 16 40 10 Z" 
          fill="oklch(0.10 0.01 260)"
        />
        <path 
          d="M41 10 L50 24 L59 10 Q55 15 50 15 Q45 15 41 10 Z" 
          fill={accent || secondary}
          opacity="0.6"
        />

        {/* Sleeve bands */}
        <path d="M8 28 L14 26 L16 32 L10 34 Z" fill={accent || secondary} opacity="0.9" />
        <path d="M92 28 L86 26 L84 32 L90 34 Z" fill={accent || secondary} opacity="0.9" />

        {/* Sleeve trim lines */}
        <path d="M14 50 L8 28 L10 27 L16 49 Z" fill={secondary} opacity="0.5" />
        <path d="M86 50 L92 28 L90 27 L84 49 Z" fill={secondary} opacity="0.5" />

        {/* Number on back (subtle) */}
        {number && (
          <text
            x="50"
            y="85"
            textAnchor="middle"
            fontSize="28"
            fontWeight="bold"
            fontFamily="sans-serif"
            fill={secondary}
            opacity="0.15"
          >
            {number}
          </text>
        )}

        {/* Sponsor area (subtle rectangle) */}
        {sponsor && (
          <rect 
            x="35" 
            y="55" 
            width="30" 
            height="12" 
            rx="1"
            fill={secondary} 
            opacity="0.15" 
          />
        )}

        {/* Bottom hem detail */}
        <path 
          d="M22 108 L22 110 Q22 115 27 115 L73 115 Q78 115 78 110 L78 108" 
          fill={accent || secondary}
          opacity="0.4"
        />

        {/* Highlight/shadow overlay for 3D effect */}
        <path
          d="M30 10 L20 18 L8 28 L14 50 L22 48 L22 110 Q22 115 27 115 L73 115 Q78 115 78 110 L78 48 L86 50 L92 28 L80 18 L70 10 Q60 22 50 22 Q40 22 30 10 Z"
          fill={`url(#shade-${uniqueId})`}
        />

        {/* Side seam lines */}
        <path d="M22 48 L22 110" stroke="black" strokeWidth="0.5" opacity="0.15" />
        <path d="M78 48 L78 110" stroke="black" strokeWidth="0.5" opacity="0.15" />
      </svg>
    </div>
  )
}

function getPatternFill(
  pattern: JerseyProps["pattern"],
  uniqueId: string,
  primary: string,
  secondary: string,
): string {
  switch (pattern) {
    case "stripes":
      return `url(#stripes-${uniqueId})`
    case "hoops":
      return `url(#hoops-${uniqueId})`
    case "half":
      return `url(#half-${uniqueId})`
    case "diagonal":
    case "solid":
    default:
      return primary
  }
}
