"use client"

import Image from "next/image"
import { useState } from "react"
import { cn } from "@/lib/utils"

interface ClubCrestProps {
  /** ID do clube para buscar o escudo real */
  clubId?: string
  /** URL direta do escudo */
  crestUrl?: string
  /** Abreviacao para fallback */
  abbr: string
  /** Cores para fallback */
  primary?: string
  secondary?: string
  className?: string
  size?: "xs" | "sm" | "md" | "lg" | "xl" | "2xl"
  /** Mostrar glow effect */
  glow?: boolean
}

const sizeMap = {
  xs: { container: "h-6 w-6", text: "text-[7px]", px: 24 },
  sm: { container: "h-10 w-10", text: "text-[9px]", px: 40 },
  md: { container: "h-14 w-14", text: "text-xs", px: 56 },
  lg: { container: "h-20 w-20", text: "text-sm", px: 80 },
  xl: { container: "h-28 w-28", text: "text-xl", px: 112 },
  "2xl": { container: "h-36 w-36", text: "text-2xl", px: 144 },
}

/**
 * Club crest component that loads real team badges
 * Falls back to a stylized EA FC style hexagon if image fails
 */
export function ClubCrest({
  clubId,
  crestUrl,
  abbr,
  primary = "oklch(0.75 0.18 195)",
  secondary = "oklch(0.08 0.02 260)",
  className,
  size = "md",
  glow = true,
}: ClubCrestProps) {
  const [imageError, setImageError] = useState(false)
  const sizeConfig = sizeMap[size]

  // Se tem URL de imagem e nao houve erro, mostrar imagem real
  if (crestUrl && !imageError) {
    return (
      <div
        className={cn(
          "relative flex shrink-0 items-center justify-center",
          sizeConfig.container,
          className,
        )}
        style={{
          filter: glow ? `drop-shadow(0 0 12px color-mix(in oklch, ${primary} 40%, transparent))` : undefined,
        }}
      >
        <Image
          src={crestUrl}
          alt={`Escudo ${abbr}`}
          width={sizeConfig.px}
          height={sizeConfig.px}
          className="h-full w-full object-contain"
          onError={() => setImageError(true)}
          unoptimized
        />
      </div>
    )
  }

  // Fallback: escudo estilizado EA FC
  return (
    <div
      className={cn(
        "relative flex shrink-0 items-center justify-center overflow-hidden font-display tracking-wider",
        sizeConfig.container,
        sizeConfig.text,
        className,
      )}
      style={{
        clipPath: "polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)",
        background: `linear-gradient(160deg, ${primary} 0%, color-mix(in oklch, ${primary} 70%, ${secondary}) 50%, ${secondary} 100%)`,
        boxShadow: glow ? `0 0 20px color-mix(in oklch, ${primary} 50%, transparent)` : undefined,
      }}
      aria-label={`Escudo ${abbr}`}
    >
      {/* Inner shield */}
      <span 
        className="absolute flex items-center justify-center"
        style={{ 
          inset: size === "xl" || size === "2xl" ? "4px" : size === "lg" ? "3px" : "2px",
          clipPath: "polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)",
          background: `linear-gradient(160deg, 
            color-mix(in oklch, ${secondary} 90%, ${primary} 10%) 0%, 
            ${secondary} 50%,
            color-mix(in oklch, ${secondary} 85%, transparent) 100%
          )`,
        }}
      >
        {/* Glossy effect */}
        <span 
          className="absolute inset-0 opacity-20"
          style={{
            background: `linear-gradient(160deg, white 0%, transparent 40%)`,
            clipPath: "polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)",
          }}
        />
        
        {/* Text */}
        <span 
          className="relative font-display-italic z-10"
          style={{ 
            color: primary,
            textShadow: `0 0 10px color-mix(in oklch, ${primary} 50%, transparent)`,
          }}
        >
          {abbr}
        </span>
      </span>

      {/* Outer glow ring */}
      <span 
        className="absolute inset-0 opacity-30"
        style={{
          clipPath: "polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)",
          background: `conic-gradient(from 0deg, ${primary}, transparent, ${primary}, transparent, ${primary})`,
        }}
      />
    </div>
  )
}
