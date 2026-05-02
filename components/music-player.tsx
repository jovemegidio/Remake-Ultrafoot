"use client"

import {
  Heart,
  Laptop2,
  ListMusic,
  Maximize2,
  Mic2,
  Music2,
  Pause,
  Play,
  Repeat,
  Shuffle,
  SkipBack,
  SkipForward,
  Volume,
  Volume1,
  Volume2,
  VolumeX,
} from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { cn } from "@/lib/utils"

interface MusicPlayerProps {
  className?: string
  variant?: "full" | "minimal"
}

const TRACK = {
  title: "Good Time Girl",
  album: "Spike Island",
  artist: "Ultrafoot Radio",
  duration: 282, // seconds (4:42)
}

function formatTime(s: number) {
  const m = Math.floor(s / 60)
  const sec = Math.floor(s % 60)
  return `${m}:${sec.toString().padStart(2, "0")}`
}

export function MusicPlayer({ className, variant = "full" }: MusicPlayerProps) {
  const [playing, setPlaying] = useState(true)
  const [progress, setProgress] = useState(28)
  const [volume, setVolume] = useState(70)
  const [liked, setLiked] = useState(false)
  const [shuffle, setShuffle] = useState(false)
  const [repeat, setRepeat] = useState(false)
  const [hoverProgress, setHoverProgress] = useState(false)
  const [hoverVolume, setHoverVolume] = useState(false)

  // Simulate playback advance
  useEffect(() => {
    if (!playing) return
    const id = window.setInterval(() => {
      setProgress((p) => (p >= TRACK.duration ? 0 : p + 1))
    }, 1000)
    return () => window.clearInterval(id)
  }, [playing])

  const VolumeIcon = useMemo(() => {
    if (volume === 0) return VolumeX
    if (volume < 33) return Volume
    if (volume < 66) return Volume1
    return Volume2
  }, [volume])

  if (variant === "minimal") {
    return (
      <div
        className={cn(
          "flex items-center gap-3 rounded-lg border border-border bg-card/80 px-3 py-2 backdrop-blur",
          className,
        )}
      >
        <button
          onClick={() => setPlaying(!playing)}
          className="flex h-8 w-8 items-center justify-center rounded-full bg-foreground text-background transition hover:scale-105"
          aria-label={playing ? "Pausar" : "Tocar"}
        >
          {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 translate-x-px" />}
        </button>
        <div className="min-w-0">
          <div className="truncate text-xs font-semibold">{TRACK.title}</div>
          <div className="truncate text-[10px] text-muted-foreground">{TRACK.artist}</div>
        </div>
      </div>
    )
  }

  const progressPct = (progress / TRACK.duration) * 100

  return (
    <div
      className={cn(
        // Spotify-style: pure dark bar, full width, sits over sidebar offset
        "fixed bottom-0 left-16 right-0 z-30 flex h-[72px] items-center justify-between gap-4 border-t border-border bg-[oklch(0.05_0.01_260)] px-4",
        className,
      )}
    >
      {/* LEFT — Album art + track info + like */}
      <div className="flex items-center gap-3 w-[30%] min-w-0">
        <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-sm bg-gradient-to-br from-primary/40 via-accent/30 to-gold/20 shadow-md">
          <div className="absolute inset-0 flex items-center justify-center">
            <Music2 className="h-6 w-6 text-foreground/80" />
          </div>
          {/* Vinyl shimmer */}
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_30%,oklch(1_0_0/0.15),transparent_60%)]" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium text-foreground hover:underline cursor-pointer">
            {TRACK.title}
          </div>
          <div className="truncate text-xs text-muted-foreground hover:underline hover:text-foreground cursor-pointer">
            {TRACK.artist}
          </div>
        </div>
        <button
          onClick={() => setLiked(!liked)}
          className={cn(
            "shrink-0 transition-colors",
            liked ? "text-accent" : "text-muted-foreground hover:text-foreground",
          )}
          aria-label={liked ? "Remover curtida" : "Curtir"}
        >
          <Heart className={cn("h-4 w-4", liked && "fill-current")} />
        </button>
      </div>

      {/* CENTER — Controls + progress */}
      <div className="flex flex-1 max-w-2xl flex-col items-center gap-1.5">
        <div className="flex items-center gap-4">
          <button
            onClick={() => setShuffle(!shuffle)}
            className={cn(
              "relative transition-colors",
              shuffle ? "text-accent" : "text-muted-foreground hover:text-foreground",
            )}
            aria-label="Aleatorio"
          >
            <Shuffle className="h-4 w-4" />
            {shuffle && <span className="absolute -bottom-1.5 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-accent" />}
          </button>
          <button
            className="text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Anterior"
          >
            <SkipBack className="h-5 w-5 fill-current" />
          </button>
          <button
            onClick={() => setPlaying(!playing)}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-foreground text-background transition hover:scale-[1.06] active:scale-95"
            aria-label={playing ? "Pausar" : "Tocar"}
          >
            {playing ? (
              <Pause className="h-4 w-4 fill-current" />
            ) : (
              <Play className="h-4 w-4 translate-x-px fill-current" />
            )}
          </button>
          <button
            className="text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Proxima"
          >
            <SkipForward className="h-5 w-5 fill-current" />
          </button>
          <button
            onClick={() => setRepeat(!repeat)}
            className={cn(
              "relative transition-colors",
              repeat ? "text-accent" : "text-muted-foreground hover:text-foreground",
            )}
            aria-label="Repetir"
          >
            <Repeat className="h-4 w-4" />
            {repeat && <span className="absolute -bottom-1.5 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-accent" />}
          </button>
        </div>

        {/* Spotify-style progress bar */}
        <div
          className="flex w-full items-center gap-2 text-[11px] text-muted-foreground"
          onMouseEnter={() => setHoverProgress(true)}
          onMouseLeave={() => setHoverProgress(false)}
        >
          <span className="tabular-nums w-9 text-right">{formatTime(progress)}</span>
          <div className="relative flex-1 group">
            <input
              type="range"
              min={0}
              max={TRACK.duration}
              value={progress}
              onChange={(e) => setProgress(Number(e.target.value))}
              className="absolute inset-0 z-10 w-full cursor-pointer opacity-0"
              aria-label="Progresso"
            />
            <div className="h-1 w-full overflow-hidden rounded-full bg-[oklch(0.22_0.02_260)]">
              <div
                className={cn(
                  "h-full rounded-full transition-colors",
                  hoverProgress ? "bg-accent" : "bg-foreground",
                )}
                style={{ width: `${progressPct}%` }}
              />
            </div>
            {/* Thumb */}
            <div
              className={cn(
                "absolute top-1/2 -translate-y-1/2 -translate-x-1/2 h-3 w-3 rounded-full bg-foreground transition-opacity",
                hoverProgress ? "opacity-100" : "opacity-0",
              )}
              style={{ left: `${progressPct}%` }}
            />
          </div>
          <span className="tabular-nums w-9">{formatTime(TRACK.duration)}</span>
        </div>
      </div>

      {/* RIGHT — Extras + volume */}
      <div className="flex w-[30%] items-center justify-end gap-3">
        <button className="text-muted-foreground hover:text-foreground transition-colors" aria-label="Letra">
          <Mic2 className="h-4 w-4" />
        </button>
        <button className="text-muted-foreground hover:text-foreground transition-colors" aria-label="Fila">
          <ListMusic className="h-4 w-4" />
        </button>
        <button className="text-muted-foreground hover:text-foreground transition-colors" aria-label="Dispositivos">
          <Laptop2 className="h-4 w-4" />
        </button>

        <div
          className="flex items-center gap-1.5 group"
          onMouseEnter={() => setHoverVolume(true)}
          onMouseLeave={() => setHoverVolume(false)}
        >
          <button
            onClick={() => setVolume(volume === 0 ? 70 : 0)}
            className="text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Volume"
          >
            <VolumeIcon className="h-4 w-4" />
          </button>
          <div className="relative w-24">
            <input
              type="range"
              min={0}
              max={100}
              value={volume}
              onChange={(e) => setVolume(Number(e.target.value))}
              className="absolute inset-0 z-10 w-full cursor-pointer opacity-0"
              aria-label="Volume"
            />
            <div className="h-1 w-full overflow-hidden rounded-full bg-[oklch(0.22_0.02_260)]">
              <div
                className={cn(
                  "h-full rounded-full transition-colors",
                  hoverVolume ? "bg-accent" : "bg-foreground",
                )}
                style={{ width: `${volume}%` }}
              />
            </div>
            <div
              className={cn(
                "absolute top-1/2 -translate-y-1/2 -translate-x-1/2 h-2.5 w-2.5 rounded-full bg-foreground transition-opacity",
                hoverVolume ? "opacity-100" : "opacity-0",
              )}
              style={{ left: `${volume}%` }}
            />
          </div>
        </div>

        <button className="text-muted-foreground hover:text-foreground transition-colors" aria-label="Tela cheia">
          <Maximize2 className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
