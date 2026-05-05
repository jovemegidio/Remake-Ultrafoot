"use client"

import Image from "next/image"
import { cn } from "@/lib/utils"
import { useState, memo, useMemo } from "react"

interface PlayerAvatarProps {
  name: string
  teamColor?: string
  size?: "xs" | "sm" | "md" | "lg" | "xl"
  className?: string
  playerId?: string
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

// Banco de fotos reais de jogadores brasileiros
const realPlayerPhotos: Record<string, string> = {
  "Neymar": "https://www.thesportsdb.com/images/media/player/thumb/5lf1p41574873364.jpg",
  "Vinicius Junior": "https://www.thesportsdb.com/images/media/player/thumb/n0rip31596640316.jpg",
  "Richarlison": "https://www.thesportsdb.com/images/media/player/thumb/5cpb4t1574874008.jpg",
  "Casemiro": "https://www.thesportsdb.com/images/media/player/thumb/2pwgk91596640420.jpg",
  "Alisson": "https://www.thesportsdb.com/images/media/player/thumb/jqq4f21574873815.jpg",
  "Marquinhos": "https://www.thesportsdb.com/images/media/player/thumb/ufm6zx1574873706.jpg",
  "Raphinha": "https://www.thesportsdb.com/images/media/player/thumb/0q5ylv1659023766.jpg",
  "Lucas Paqueta": "https://www.thesportsdb.com/images/media/player/thumb/q7c63k1574873643.jpg",
  "Bruno Guimaraes": "https://www.thesportsdb.com/images/media/player/thumb/mfj0gl1596640253.jpg",
  "Endrick": "https://www.thesportsdb.com/images/media/player/thumb/sxggij1705846827.jpg",
  "Gabriel Jesus": "https://www.thesportsdb.com/images/media/player/thumb/w0izs61574873525.jpg",
  "Rodrygo": "https://www.thesportsdb.com/images/media/player/thumb/xtlz8a1596640369.jpg",
  "Antony": "https://www.thesportsdb.com/images/media/player/thumb/gy2vgq1596640204.jpg",
  "Militao": "https://www.thesportsdb.com/images/media/player/thumb/zqn0c01596640150.jpg",
  "Thiago Silva": "https://www.thesportsdb.com/images/media/player/thumb/xbdfzn1574873448.jpg",
  "Gabriel Martinelli": "https://www.thesportsdb.com/images/media/player/thumb/3wnxq01596640103.jpg",
  "Pedro": "https://www.thesportsdb.com/images/media/player/thumb/bsk7mj1596640056.jpg",
  "Ederson": "https://www.thesportsdb.com/images/media/player/thumb/p7w6k91574873764.jpg",
  "Fred": "https://www.thesportsdb.com/images/media/player/thumb/1wivtp1574873593.jpg",
  "Fabinho": "https://www.thesportsdb.com/images/media/player/thumb/3oydgt1574873869.jpg",
  "Firmino": "https://www.thesportsdb.com/images/media/player/thumb/aqwzq01574873479.jpg",
  "Coutinho": "https://www.thesportsdb.com/images/media/player/thumb/z6ghux1574873920.jpg",
  "Douglas Luiz": "https://www.thesportsdb.com/images/media/player/thumb/m6c4wn1596639957.jpg",
  "Danilo": "https://www.thesportsdb.com/images/media/player/thumb/xrm5l61574873396.jpg",
  "Alex Sandro": "https://www.thesportsdb.com/images/media/player/thumb/vl3hry1574873344.jpg",
}

function normalizePlayerName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
}

function findPlayerPhoto(name: string): string | null {
  const normalizedName = normalizePlayerName(name)
  
  for (const [playerName, photoUrl] of Object.entries(realPlayerPhotos)) {
    if (normalizePlayerName(playerName) === normalizedName) {
      return photoUrl
    }
    const nameParts = normalizedName.split(" ")
    const playerParts = normalizePlayerName(playerName).split(" ")
    
    if (nameParts.some(part => playerParts.includes(part) && part.length > 3)) {
      return photoUrl
    }
  }
  
  return null
}

function getPlayerCardUrl(name: string, size: number = 128): string {
  const seed = encodeURIComponent(name)
  return `https://api.dicebear.com/7.x/big-smile/svg?seed=${seed}&size=${size}&backgroundColor=transparent`
}

export const PlayerAvatar = memo(function PlayerAvatar({ 
  name, 
  teamColor,
  size = "md", 
  className,
}: PlayerAvatarProps) {
  const [imageError, setImageError] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  
  const pixelSize = size === "xs" ? 32 : size === "sm" ? 40 : size === "md" ? 56 : size === "lg" ? 64 : 96
  
  const { realPhoto, avatarUrl } = useMemo(() => {
    const photo = findPlayerPhoto(name)
    return {
      realPhoto: photo,
      avatarUrl: photo || getPlayerCardUrl(name, pixelSize * 2)
    }
  }, [name, pixelSize])
  
  if (imageError) {
    return (
      <div 
        className={cn(
          "rounded-xl flex items-center justify-center",
          "bg-gradient-to-br from-white/10 to-white/5",
          sizeClasses[size],
          className
        )}
      >
        <span className={cn("font-bold text-white/40", textSizeClasses[size])}>
          {name.charAt(0).toUpperCase()}
        </span>
      </div>
    )
  }

  return (
    <div 
      className={cn(
        "relative rounded-xl overflow-hidden",
        "bg-gradient-to-br from-white/10 to-white/5",
        sizeClasses[size],
        className
      )}
      style={teamColor ? { 
        background: `linear-gradient(135deg, ${teamColor}40 0%, ${teamColor}10 100%)`
      } : undefined}
    >
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center">
          <span className={cn("font-bold text-white/20", textSizeClasses[size])}>
            {name.charAt(0).toUpperCase()}
          </span>
        </div>
      )}
      <Image
        src={avatarUrl}
        alt={name}
        fill
        className={cn(
          "object-cover transition-opacity duration-200",
          isLoading ? "opacity-0" : "opacity-100",
          realPhoto && "object-top"
        )}
        onLoad={() => setIsLoading(false)}
        onError={() => setImageError(true)}
        unoptimized
      />
    </div>
  )
})

export const PlayerAvatarCircle = memo(function PlayerAvatarCircle({ 
  name, 
  teamColor,
  size = "md", 
  className 
}: PlayerAvatarProps) {
  const [imageError, setImageError] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  
  const pixelSize = size === "xs" ? 32 : size === "sm" ? 40 : size === "md" ? 56 : size === "lg" ? 64 : 96
  
  const { realPhoto, avatarUrl } = useMemo(() => {
    const photo = findPlayerPhoto(name)
    return {
      realPhoto: photo,
      avatarUrl: photo || getPlayerCardUrl(name, pixelSize * 2)
    }
  }, [name, pixelSize])
  
  if (imageError) {
    return (
      <div 
        className={cn(
          "rounded-full flex items-center justify-center",
          "bg-gradient-to-br from-white/10 to-white/5",
          sizeClasses[size],
          className
        )}
      >
        <span className={cn("font-bold text-white/40", textSizeClasses[size])}>
          {name.charAt(0).toUpperCase()}
        </span>
      </div>
    )
  }

  return (
    <div 
      className={cn(
        "relative rounded-full overflow-hidden",
        "bg-gradient-to-br from-white/10 to-white/5",
        sizeClasses[size],
        className
      )}
      style={teamColor ? { 
        background: `linear-gradient(135deg, ${teamColor}40 0%, ${teamColor}10 100%)`
      } : undefined}
    >
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center">
          <span className={cn("font-bold text-white/20", textSizeClasses[size])}>
            {name.charAt(0).toUpperCase()}
          </span>
        </div>
      )}
      <Image
        src={avatarUrl}
        alt={name}
        fill
        className={cn(
          "object-cover transition-opacity duration-200",
          isLoading ? "opacity-0" : "opacity-100",
          realPhoto && "object-top"
        )}
        onLoad={() => setIsLoading(false)}
        onError={() => setImageError(true)}
        unoptimized
      />
    </div>
  )
})
