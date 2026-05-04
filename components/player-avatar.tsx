"use client"

import Image from "next/image"
import { cn } from "@/lib/utils"
import { useState } from "react"

interface PlayerAvatarProps {
  name: string
  teamColor?: string
  size?: "xs" | "sm" | "md" | "lg" | "xl"
  className?: string
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

// Função para gerar URL de avatar baseado no nome
function getAvatarUrl(name: string, size: number = 128, bgColor?: string): string {
  // Usa UI Avatars API para gerar avatar com iniciais
  const bg = bgColor?.replace("#", "") || "1db954"
  const color = "ffffff"
  const encodedName = encodeURIComponent(name)
  return `https://ui-avatars.com/api/?name=${encodedName}&size=${size}&background=${bg}&color=${color}&bold=true&format=png`
}

// Função para gerar URL usando DiceBear com estilo de jogador
function getPlayerAvatarUrl(name: string, size: number = 128): string {
  const seed = encodeURIComponent(name)
  return `https://api.dicebear.com/7.x/avataaars/svg?seed=${seed}&size=${size}&backgroundColor=transparent`
}

export function PlayerAvatar({ 
  name, 
  teamColor,
  size = "md", 
  className 
}: PlayerAvatarProps) {
  const [imageError, setImageError] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  
  const pixelSize = size === "xs" ? 32 : size === "sm" ? 40 : size === "md" ? 56 : size === "lg" ? 64 : 96
  
  // URL do avatar estilizado
  const avatarUrl = getPlayerAvatarUrl(name, pixelSize * 2)
  
  if (imageError) {
    // Fallback para iniciais se o avatar falhar
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
          isLoading ? "opacity-0" : "opacity-100"
        )}
        onLoad={() => setIsLoading(false)}
        onError={() => setImageError(true)}
        unoptimized
      />
    </div>
  )
}

// Versão circular para uso em listas compactas
export function PlayerAvatarCircle({ 
  name, 
  teamColor,
  size = "md", 
  className 
}: PlayerAvatarProps) {
  const [imageError, setImageError] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  
  const pixelSize = size === "xs" ? 32 : size === "sm" ? 40 : size === "md" ? 56 : size === "lg" ? 64 : 96
  const avatarUrl = getPlayerAvatarUrl(name, pixelSize * 2)
  
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
          isLoading ? "opacity-0" : "opacity-100"
        )}
        onLoad={() => setIsLoading(false)}
        onError={() => setImageError(true)}
        unoptimized
      />
    </div>
  )
}
