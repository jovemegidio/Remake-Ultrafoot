"use client"

import { usePathname } from "next/navigation"
import { MusicPlayer } from "@/components/music-player"

const EXCLUDED_PATHS = ["/novo-jogo", "/splash"]

export function MusicPlayerWrapper() {
  const pathname = usePathname()
  if (EXCLUDED_PATHS.some(p => pathname.startsWith(p))) return null
  return <MusicPlayer defaultSize="hidden" />
}
