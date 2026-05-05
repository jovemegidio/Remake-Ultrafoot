import { cn } from "@/lib/utils"

interface JerseyProps {
  variant: "home" | "away" | "third"
  primary: string
  secondary: string
  pattern?: "stripes" | "solid" | "diagonal"
  className?: string
}

/**
 * Pure-CSS football jersey illustration. Avoids random image assets.
 */
export function Jersey({ variant, primary, secondary, pattern = "solid", className }: JerseyProps) {
  return (
    <div className={cn("relative aspect-[4/5] w-full", className)} aria-label={`Uniforme ${variant}`}>
      <svg viewBox="0 0 100 120" className="h-full w-full drop-shadow-[0_8px_24px_rgba(0,0,0,0.5)]">
        <defs>
          <linearGradient id={`shade-${variant}`} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="white" stopOpacity="0.18" />
            <stop offset="1" stopColor="black" stopOpacity="0.25" />
          </linearGradient>
          <pattern id={`stripes-${variant}`} width="10" height="120" patternUnits="userSpaceOnUse">
            <rect width="5" height="120" fill={primary} />
            <rect x="5" width="5" height="120" fill={secondary} />
          </pattern>
        </defs>

        {/* Shirt body */}
        <path
          d="M30 10 L20 18 L8 28 L14 50 L22 48 L22 110 Q22 115 27 115 L73 115 Q78 115 78 110 L78 48 L86 50 L92 28 L80 18 L70 10 Q60 22 50 22 Q40 22 30 10 Z"
          fill={pattern === "stripes" ? `url(#stripes-${variant})` : primary}
        />

        {/* Collar accent */}
        {pattern === "diagonal" && (
          <path
            d="M30 10 L20 18 L50 60 L80 18 L70 10 Q60 22 50 22 Q40 22 30 10 Z"
            fill={secondary}
            opacity="0.85"
          />
        )}

        {/* V-Neck */}
        <path d="M40 10 L50 28 L60 10 Q55 16 50 16 Q45 16 40 10 Z" fill="oklch(0.13 0.015 250)" />

        {/* Sleeve trim */}
        <path d="M14 50 L8 28 L14 26 L20 48 Z" fill={secondary} opacity="0.9" />
        <path d="M86 50 L92 28 L86 26 L80 48 Z" fill={secondary} opacity="0.9" />

        {/* Brand stripe */}
        <rect x="46" y="62" width="8" height="10" fill={secondary} opacity="0.6" />

        {/* Highlight overlay */}
        <path
          d="M30 10 L20 18 L8 28 L14 50 L22 48 L22 110 Q22 115 27 115 L73 115 Q78 115 78 110 L78 48 L86 50 L92 28 L80 18 L70 10 Q60 22 50 22 Q40 22 30 10 Z"
          fill={`url(#shade-${variant})`}
        />
      </svg>
    </div>
  )
}
