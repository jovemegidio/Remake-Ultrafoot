"use client"

// Widget que CONTROLA o player de midia do sistema (Spotify e afins).
//
// Substitui o player de trilha embutida: antes o jogo carregava 1,6 GB de musica no
// instalador; agora ele so pilota o que o jogador ja tem tocando. Se nao houver nenhuma
// sessao de midia ativa, o widget simplesmente nao aparece.

import { useCallback, useEffect, useState } from "react"
import { Music, Pause, Play, SkipBack, SkipForward, X } from "lucide-react"
import { cn } from "@/lib/utils"
import {
  getNowPlaying,
  skipNext,
  skipPrevious,
  sourceLabel,
  togglePlayPause,
  type NowPlaying,
} from "@/lib/system-media"

/** De quanto em quanto tempo perguntamos ao sistema o que esta tocando. */
const POLL_MS = 1500

export function SystemMediaPlayer({ className }: { className?: string }) {
  const [np, setNp] = useState<NowPlaying | null>(null)
  const [dismissed, setDismissed] = useState(false)
  const [busy, setBusy] = useState(false)

  const refresh = useCallback(async () => {
    setNp(await getNowPlaying())
  }, [])

  useEffect(() => {
    let alive = true
    let timer: ReturnType<typeof setInterval> | undefined

    const tick = async () => {
      const next = await getNowPlaying()
      if (alive) setNp(next)
    }

    void tick()
    // Nao gasta CPU perguntando ao sistema com a janela minimizada.
    const start = () => {
      if (timer) return
      timer = setInterval(() => void tick(), POLL_MS)
    }
    const stop = () => {
      if (timer) clearInterval(timer)
      timer = undefined
    }
    const onVisibility = () => (document.hidden ? stop() : (void tick(), start()))

    start()
    document.addEventListener("visibilitychange", onVisibility)
    return () => {
      alive = false
      stop()
      document.removeEventListener("visibilitychange", onVisibility)
    }
  }, [])

  /** Manda o comando e reconsulta logo em seguida (a UI responde na hora). */
  const command = async (fn: () => Promise<boolean>) => {
    if (busy) return
    setBusy(true)
    await fn()
    // Pequena espera: o player leva alguns ms para atualizar a sessao.
    setTimeout(() => { void refresh(); setBusy(false) }, 220)
  }

  // Sem sessao de midia (nada tocando) ou fora do Tauri: nao mostra nada.
  if (!np?.available || dismissed) return null

  const title = np.title || "Sem titulo"
  const subtitle = [np.artist, sourceLabel(np.source)].filter(Boolean).join(" • ")

  return (
    <div
      className={cn(
        "fixed bottom-4 right-4 z-40 flex items-center gap-3 rounded-xl",
        "border border-white/10 bg-[#0c0c14]/95 px-3 py-2 shadow-2xl backdrop-blur-xl",
        "w-[340px] max-w-[92vw]",
        className,
      )}
      role="region"
      aria-label="Controle de musica"
    >
      {/* Capa/placeholder */}
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-gradient-to-br from-[#1db954]/30 to-[#1db954]/5">
        <Music className="h-5 w-5 text-[#1db954]" />
      </div>

      {/* Faixa */}
      <div className="min-w-0 flex-1">
        <div className="truncate text-[13px] font-semibold text-white">{title}</div>
        <div className="truncate text-[11px] text-white/45">{subtitle}</div>
      </div>

      {/* Transporte */}
      <div className="flex shrink-0 items-center gap-1">
        <button
          type="button"
          onClick={() => void command(skipPrevious)}
          aria-label="Faixa anterior"
          className="rounded p-1.5 text-white/60 transition-colors hover:bg-white/10 hover:text-white"
        >
          <SkipBack className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => void command(togglePlayPause)}
          aria-label={np.isPlaying ? "Pausar" : "Tocar"}
          className="rounded-full bg-[#1db954] p-2 text-black transition-transform hover:scale-105"
        >
          {np.isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
        </button>
        <button
          type="button"
          onClick={() => void command(skipNext)}
          aria-label="Proxima faixa"
          className="rounded p-1.5 text-white/60 transition-colors hover:bg-white/10 hover:text-white"
        >
          <SkipForward className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          aria-label="Esconder o controle de musica"
          className="ml-1 rounded p-1 text-white/30 transition-colors hover:bg-white/10 hover:text-white/70"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  )
}
