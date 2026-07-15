"use client"

import { useEffect, useRef, useState } from "react"
import Image from "next/image"
import { cn } from "@/lib/utils"
import { getEscudoUrl, getTeamByShort, type Team } from "@/lib/teams-data"
import { storeGet, storeSet, storeRemove } from "@/lib/persistent-store"
// Escudos EMBUTIDOS no build (viajam no mesmo seed dos overrides, campo logoUrl). E por
// eles que um escudo importado no editor chega aos OUTROS jogadores, nao so ao save local.
import bundledOverrides from "@/data/seeds/team-overrides.json"

const BUNDLED_LOGOS = bundledOverrides as Record<string, { logoUrl?: string }>

interface TeamCrestProps {
  team?: Team
  teamShort?: string
  fileKey?: string
  size?: "xs" | "table" | "sm" | "md" | "lg" | "xl" | "2xl" | "3xl" | "4xl"
  className?: string
  showFallback?: boolean
}

const sizeMap = {
  xs: { container: "h-5 w-5", text: "text-[6px]", inner: "text-[5px]" },
  table: { container: "h-6 w-6", text: "text-[7px]", inner: "text-[6px]" },
  sm: { container: "h-8 w-8", text: "text-[8px]", inner: "text-[7px]" },
  md: { container: "h-12 w-12", text: "text-[10px]", inner: "text-[9px]" },
  lg: { container: "h-16 w-16", text: "text-xs", inner: "text-[10px]" },
  xl: { container: "h-20 w-20", text: "text-sm", inner: "text-xs" },
  "2xl": { container: "h-28 w-28", text: "text-lg", inner: "text-sm" },
  "3xl": { container: "h-36 w-36", text: "text-xl", inner: "text-base" },
  "4xl": { container: "h-44 w-44", text: "text-2xl", inner: "text-lg" },
}

const sizePixels = {
  xs: 20,
  table: 24,
  sm: 32,
  md: 48,
  lg: 64,
  xl: 80,
  "2xl": 112,
  "3xl": 144,
  "4xl": 176,
}

/**
 * Team crest component that loads real escudos from Ultrafoot repository
 * Falls back to styled shield with team colors if image fails to load
 */
const CUSTOM_LOGO_KEY = (key: string) => `ultrafoot:logo:${key}`

export function getCustomLogoUrl(fileKey: string): string | null {
  // Save LOCAL vence (personalizacao propria); o escudo EMBUTIDO no build e o fallback,
  // e por ele que o escudo que voce importou aparece para todo mundo.
  const local = typeof window === "undefined" ? null : storeGet(CUSTOM_LOGO_KEY(fileKey))
  return local ?? BUNDLED_LOGOS[fileKey]?.logoUrl ?? null
}

/** Escudos custom no save local (ultrafoot:logo:*), por fileKey — usado pelo editor ao exportar. */
export function listLocalCustomLogos(): Record<string, string> {
  const out: Record<string, string> = {}
  if (typeof window === "undefined") return out
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i)
    if (!k?.startsWith("ultrafoot:logo:")) continue
    const val = storeGet(k)
    if (val) out[k.replace("ultrafoot:logo:", "")] = val
  }
  return out
}

export function setCustomLogoUrl(fileKey: string, dataUrl: string): void {
  storeSet(CUSTOM_LOGO_KEY(fileKey), dataUrl)
  window.dispatchEvent(new CustomEvent("ultrafoot:logo:changed", { detail: { key: fileKey } }))
}

export function removeCustomLogoUrl(fileKey: string): void {
  storeRemove(CUSTOM_LOGO_KEY(fileKey))
  window.dispatchEvent(new CustomEvent("ultrafoot:logo:changed", { detail: { key: fileKey } }))
}

export function TeamCrest({
  team,
  teamShort,
  fileKey,
  size = "md",
  className,
  showFallback = true,
}: TeamCrestProps) {
  const imgRef = useRef<HTMLImageElement>(null)
  const [imageError, setImageError] = useState(false)
  const [imageLoaded, setImageLoaded] = useState(false)
  const [retryCount, setRetryCount] = useState(0)
  const [customLogo, setCustomLogo] = useState<string | null>(null)
  const MAX_RETRIES = 4

  // Resolve team data
  const resolvedTeam = team || (teamShort ? getTeamByShort(teamShort) : undefined)

  // O time do USUARIO vem do save (SavedTeam), que nomeia a chave como `fileKey`
  // (camelCase) — enquanto Team (teams-data) usa `file_key` (snake_case). Lendo so
  // `file_key`, a chave do proprio time do jogador saia undefined: sem URL, sem <img>,
  // e como o onError nunca disparava nem o fallback aparecia. Resultado: escudo do SEU
  // time em branco (e so o dele). Aceita as duas formas e, em ultimo caso, resolve
  // pelo curto no teams-data.
  const escudoKey =
    fileKey ||
    resolvedTeam?.file_key ||
    (resolvedTeam as unknown as { fileKey?: string })?.fileKey ||
    (resolvedTeam?.curto ? getTeamByShort(resolvedTeam.curto)?.file_key : undefined)

  const escudoUrl = escudoKey ? getEscudoUrl(escudoKey) : null

  // Check for custom imported logo
  useEffect(() => {
    if (!escudoKey) return
    const refresh = () => setCustomLogo(getCustomLogoUrl(escudoKey))
    refresh()
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail
      if (detail?.key === escudoKey) refresh()
    }
    window.addEventListener("ultrafoot:logo:changed", handler)
    // O persistent-store carrega o cache do disco de forma assincrona (e cada
    // navegacao reinicia esse cache). Sem re-ler aqui, um escudo ja importado
    // continuaria caindo no fallback ate ser reimportado.
    window.addEventListener("ultrafoot:store:ready", refresh)
    return () => {
      window.removeEventListener("ultrafoot:logo:changed", handler)
      window.removeEventListener("ultrafoot:store:ready", refresh)
    }
  }, [escudoKey])

  const { container, text, inner } = sizeMap[size]
  const pixels = sizePixels[size]

  useEffect(() => {
    setImageError(false)
    setImageLoaded(false)
    setRetryCount(0)
  }, [escudoUrl, customLogo])

  /**
   * Imagem JA em cache nao dispara onLoad.
   *
   * O <img> so fica visivel quando imageLoaded vira true (opacity-0 -> opacity-100).
   * Quando a imagem ja esta no cache do webview, o evento `load` acontece ANTES do React
   * anexar o handler: onLoad nunca e chamado, imageLoaded fica false para sempre e o
   * escudo some — sem erro, entao nem o fallback aparecia. Era exatamente o caso do
   * escudo do TIME DO USUARIO, que aparece em toda tela e por isso e o mais cacheado.
   *
   * Aqui perguntamos ao proprio elemento se ele ja terminou de carregar.
   */
  useEffect(() => {
    const img = imgRef.current
    if (img?.complete && img.naturalWidth > 0) setImageLoaded(true)
  }, [escudoUrl, customLogo, retryCount])

  // O protocolo game-asset:// (Tauri) por vezes falha numa primeira tentativa logo apos
  // a janela abrir. Antes de cair pro escudo generico, tenta de novo algumas vezes.
  const handleError = () => {
    if (retryCount < MAX_RETRIES) {
      setTimeout(() => setRetryCount((c) => c + 1), 120)
    } else {
      setImageError(true)
    }
  }

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

  const activeUrl = customLogo ?? escudoUrl

  if (!activeUrl || (imageError && showFallback)) {
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
        ref={imgRef}
        key={`${escudoKey ?? ""}-${retryCount}-${customLogo ? "custom" : "default"}`}
        src={activeUrl}
        alt={`Escudo ${resolvedTeam?.nome || 'Time'}`}
        width={pixels}
        height={pixels}
        className={cn(
          "object-contain transition-all duration-300",
          imageLoaded ? "opacity-100 scale-100" : "opacity-0 scale-95",
        )}
        style={{
          filter: imageLoaded ? "drop-shadow(0 4px 12px rgba(0,0,0,0.4))" : undefined,
        }}
        onLoad={() => setImageLoaded(true)}
        onError={handleError}
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
