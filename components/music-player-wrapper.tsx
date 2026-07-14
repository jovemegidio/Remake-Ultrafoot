"use client"

import { usePathname } from "next/navigation"
import { SystemMediaPlayer } from "@/components/system-media-player"

// /partida cobre tanto a escolha de times quanto a partida ao vivo (telas imersivas,
// sem o player flutuante) — ver HIDDEN_PATHS equivalente em ea-action-bar.tsx.
// /imprensa (Sala de Imprensa) tambem entra: musica por cima da coletiva quebra o clima.
const EXCLUDED_PATHS = ["/novo-jogo", "/splash", "/pre-office", "/partida", "/editar", "/imprensa"]

// Antes isto montava o <MusicPlayer/>, que tocava a trilha EMBUTIDA (1,6 GB no
// instalador, e musica de terceiros). Agora monta o controle do player do SISTEMA:
// o jogo pilota o Spotify (ou qualquer player) que o jogador ja tem aberto.
export function MusicPlayerWrapper() {
  const pathname = usePathname()
  if (EXCLUDED_PATHS.some((p) => pathname.startsWith(p))) return null
  return <SystemMediaPlayer />
}
