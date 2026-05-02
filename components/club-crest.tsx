import { cn } from "@/lib/utils"

interface ClubCrestProps {
  abbr: string
  primary?: string
  secondary?: string
  className?: string
  size?: "sm" | "md" | "lg" | "xl"
}

const sizeMap = {
  sm: "h-8 w-8 text-[9px]",
  md: "h-12 w-12 text-xs",
  lg: "h-16 w-16 text-sm",
  xl: "h-24 w-24 text-xl",
}

const innerSizeMap = {
  sm: "2px",
  md: "2px",
  lg: "3px",
  xl: "4px",
}

/**
 * EA FC 26 style club crest — Premium hexagonal shield with gradient and glow
 */
export function ClubCrest({
  abbr,
  primary = "oklch(0.75 0.18 195)",
  secondary = "oklch(0.08 0.02 260)",
  className,
  size = "md",
}: ClubCrestProps) {
  return (
    <div
      className={cn(
        "relative flex shrink-0 items-center justify-center overflow-hidden font-display tracking-wider",
        sizeMap[size],
        className,
      )}
      style={{
        clipPath: "polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)",
        background: `linear-gradient(160deg, ${primary} 0%, color-mix(in oklch, ${primary} 70%, ${secondary}) 50%, ${secondary} 100%)`,
        boxShadow: `0 0 20px color-mix(in oklch, ${primary} 50%, transparent)`,
      }}
      aria-label={`Escudo ${abbr}`}
    >
      {/* Inner shield */}
      <span 
        className="absolute flex items-center justify-center"
        style={{ 
          inset: innerSizeMap[size],
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
