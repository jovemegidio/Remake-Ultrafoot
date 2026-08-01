"use client"

import { cn } from "@/lib/utils"
import { getPlayerPhotoUrl } from "@/lib/player-photos"
import { gameAssetUrlAlternativa } from "@/lib/game-asset"
import { memo, useEffect, useState } from "react"

export interface PlayerAvatarProps {
  name: string
  teamColor?: string
  size?: "xs" | "sm" | "md" | "lg" | "xl"
  className?: string
  playerId?: string
  photoUrl?: string
  position?: string
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

const svgPx = { xs: 32, sm: 40, md: 56, lg: 64, xl: 96 }

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

function positionLabel(pos?: string): string {
  if (!pos) return "JOG"
  const p = pos.toUpperCase()
  if (p === "GOL") return "GOL"
  if (["ZAG", "LD", "LE", "LAD", "LAE", "CB", "RB", "LB"].includes(p)) return "DEF"
  if (["VOL", "MEI", "MC", "MED", "MCA", "MCB"].includes(p)) return "MEI"
  return "ATA"
}

function positionAccentColor(pos?: string): string {
  switch (positionLabel(pos)) {
    case "GOL": return "rgba(251,191,36,0.55)"   // amber
    case "DEF": return "rgba(59,130,246,0.55)"    // blue
    case "MEI": return "rgba(34,197,94,0.55)"     // green
    case "ATA": return "rgba(239,68,68,0.55)"     // red
    default:    return "rgba(148,163,184,0.45)"
  }
}

// Inline SVG silhouette — scales perfectly at all sizes
function PlayerSilhouette({
  position,
  size,
}: {
  position?: string
  size: keyof typeof svgPx
}) {
  const px = svgPx[size] ?? 56
  const accent = positionAccentColor(position)
  const label = positionLabel(position)
  const showLabel = size !== "xs"

  return (
    <svg
      width={px}
      height={px}
      viewBox="0 0 100 100"
      xmlns="http://www.w3.org/2000/svg"
      aria-label={label}
    >
      {/* head */}
      <ellipse cx="50" cy="21" rx="11" ry="12" fill="rgba(255,255,255,0.28)" />
      {/* neck */}
      <rect x="46" y="31" width="8" height="6" fill="rgba(255,255,255,0.20)" />
      {/* shirt body */}
      <path
        d="M30 46 Q28 39 37 35 L44 41 L50 37 L56 41 L63 35 Q72 39 70 46 L68 63 L32 63 Z"
        fill={accent}
      />
      {/* left arm */}
      <path d="M30 46 Q21 54 25 62 L32 59 L34 49 Z" fill="rgba(255,255,255,0.20)" />
      {/* right arm */}
      <path d="M70 46 Q79 54 75 62 L68 59 L66 49 Z" fill="rgba(255,255,255,0.20)" />
      {/* shorts */}
      <path d="M32 63 L36 78 L50 75 L64 78 L68 63 Z" fill="rgba(255,255,255,0.15)" />
      {/* left leg */}
      <rect x="33" y="77" width="13" height="16" rx="4" fill="rgba(255,255,255,0.16)" />
      {/* right leg */}
      <rect x="54" y="77" width="13" height="16" rx="4" fill="rgba(255,255,255,0.16)" />
      {/* position badge */}
      {showLabel && (
        <text
          x="50"
          y="58"
          textAnchor="middle"
          fontSize="10"
          fontWeight="bold"
          fill="rgba(255,255,255,0.85)"
          fontFamily="sans-serif"
        >
          {label}
        </text>
      )}
    </svg>
  )
}

function PlayerAvatarBase({
  name,
  teamColor,
  size = "md",
  className,
  rounded,
  photoUrl: photoUrlProp,
  position,
  playerId,
}: PlayerAvatarProps & { rounded: "xl" | "full" }) {
  const [imgFailed, setImgFailed] = useState(false)
  // 0 = URL como veio; 1 = a outra forma (caminho simples <-> game-asset://).
  const [tentativa, setTentativa] = useState<0 | 1>(0)

  const photoBase = photoUrlProp ?? getPlayerPhotoUrl(name, playerId)
  // Este componente e reutilizado ao navegar entre atletas. Uma falha no
  // retrato anterior nao pode condenar a foto valida do proximo selecionado.
  useEffect(() => {
    setImgFailed(false)
    setTentativa(0)
  }, [photoBase])

  // ⚠️ NAO CONFIE NA URL DA PRIMEIRA TENTATIVA.
  //
  // O jogo e export estatico: o HTML sai pre-renderizado do build, onde `window`
  // nao existe e `isTauri()` e falso — entao o `src` gravado no HTML e o caminho
  // simples `/jogadores/x.png`. Dentro do aplicativo isso NAO resolve, porque
  // `out/jogadores` e podado do frontend embutido e as fotos so existem como
  // *resources*, alcancaveis por `game-asset://`. E o React 18 nao corrige
  // atributo divergente na hidratacao, entao o src errado permanecia e virava
  // 404 silencioso: o atleta caia nas iniciais mesmo com o arquivo instalado.
  //
  // Em vez de acertar o ambiente de primeira, tenta a outra forma quando falha.
  const alternativa = photoBase ? gameAssetUrlAlternativa(photoBase) : null
  const photoUrl = tentativa === 0 ? photoBase : alternativa

  const hue = hashHue(name)
  const background = teamColor
    ? `linear-gradient(135deg, ${teamColor}66 0%, hsl(${hue} 55% 22%) 100%)`
    : `linear-gradient(135deg, hsl(${hue} 65% 32%) 0%, hsl(${(hue + 42) % 360} 55% 16%) 100%)`

  const showPhoto = !!photoUrl && !imgFailed

  return (
    <div
      className={cn(
        "relative overflow-hidden flex items-center justify-center border border-white/10",
        rounded === "full" ? "rounded-full" : "rounded-xl",
        sizeClasses[size],
        className,
      )}
      style={{ background }}
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.24),transparent_38%)]" />

      {showPhoto ? (
        <img
          src={photoUrl}
          alt={name}
          className="absolute inset-0 h-full w-full object-contain object-center"
          onError={() => {
            // Primeira falha: tenta a outra forma da URL antes de desistir.
            if (tentativa === 0 && alternativa) setTentativa(1)
            else setImgFailed(true)
          }}
        />
      ) : position !== undefined ? (
        // Silhouette when position is known (even if empty string)
        <PlayerSilhouette position={position} size={size} />
      ) : (
        // Pure initials fallback (legacy: when position not passed)
        <span className={cn("relative font-black text-white/75", textSizeClasses[size])}>
          {getInitials(name)}
        </span>
      )}
    </div>
  )
}

export const PlayerAvatar = memo(function PlayerAvatar({
  name,
  teamColor,
  size = "md",
  className,
  photoUrl,
  position,
  playerId,
}: PlayerAvatarProps) {
  return (
    <PlayerAvatarBase
      name={name}
      teamColor={teamColor}
      size={size}
      className={className}
      rounded="xl"
      photoUrl={photoUrl}
      position={position}
      playerId={playerId}
    />
  )
})

export const PlayerAvatarCircle = memo(function PlayerAvatarCircle({
  name,
  teamColor,
  size = "md",
  className,
  photoUrl,
  position,
  playerId,
}: PlayerAvatarProps) {
  return (
    <PlayerAvatarBase
      name={name}
      teamColor={teamColor}
      size={size}
      className={className}
      rounded="full"
      photoUrl={photoUrl}
      position={position}
      playerId={playerId}
    />
  )
})
