import { cn } from "@/lib/utils"

interface ClubCrestProps {
  abbr: string
  primary?: string
  secondary?: string
  className?: string
  size?: "sm" | "md" | "lg" | "xl"
}

const sizeMap = {
  sm: "h-7 w-7 text-[10px]",
  md: "h-10 w-10 text-xs",
  lg: "h-14 w-14 text-sm",
  xl: "h-24 w-24 text-xl",
}

/**
 * Stylized club crest — geometric shield with abbreviation.
 * Pure CSS so we don't ship random images.
 */
export function ClubCrest({
  abbr,
  primary = "oklch(0.82 0.15 200)",
  secondary = "oklch(0.13 0.015 250)",
  className,
  size = "md",
}: ClubCrestProps) {
  return (
    <div
      className={cn(
        "relative flex shrink-0 items-center justify-center overflow-hidden font-display tracking-wider text-foreground",
        sizeMap[size],
        className,
      )}
      style={{
        clipPath: "polygon(50% 0, 100% 25%, 100% 75%, 50% 100%, 0 75%, 0 25%)",
        background: `linear-gradient(135deg, ${primary} 0%, ${secondary} 100%)`,
      }}
      aria-label={`Escudo ${abbr}`}
    >
      <span className="absolute inset-[2px] flex items-center justify-center bg-card/80 backdrop-blur-sm"
        style={{ clipPath: "polygon(50% 0, 100% 25%, 100% 75%, 50% 100%, 0 75%, 0 25%)" }}
      >
        <span className="font-display-italic" style={{ color: primary }}>
          {abbr}
        </span>
      </span>
    </div>
  )
}
