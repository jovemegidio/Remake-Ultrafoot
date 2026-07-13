"use client"

import { usePathname } from "next/navigation"
import { MusicPlayer } from "@/components/music-player"

// /partida cobre tanto a escolha de times quanto a partida ao vivo (telas imersivas,
// sem o player flutuante) — ver HIDDEN_PATHS equivalente em ea-action-bar.tsx.
// /imprensa (Sala de Imprensa) tambem entra: musica por cima da coletiva quebra o clima.
const EXCLUDED_PATHS = ["/novo-jogo", "/splash", "/pre-office", "/partida", "/editar", "/imprensa"]

export function MusicPlayerWrapper() {
  const pathname = usePathname()
  if (EXCLUDED_PATHS.some(p => pathname.startsWith(p))) return null
  return <MusicPlayer defaultSize="hidden" />
}
