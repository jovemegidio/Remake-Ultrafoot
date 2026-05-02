"use client"

import { Music2, Pause, Play, Repeat, Shuffle, SkipBack, SkipForward, Volume2 } from "lucide-react"
import { useState } from "react"
import { Slider } from "@/components/ui/slider"
import { cn } from "@/lib/utils"

interface MusicPlayerProps {
  className?: string
  variant?: "full" | "minimal"
}

export function MusicPlayer({ className, variant = "full" }: MusicPlayerProps) {
  const [playing, setPlaying] = useState(true)
  const [progress, setProgress] = useState(8)

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
          className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground transition hover:scale-105"
          aria-label={playing ? "Pausar" : "Tocar"}
        >
          {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
        </button>
        <div className="min-w-0">
          <div className="truncate text-xs font-semibold">SPIKE ISLAND</div>
          <div className="truncate text-[10px] text-muted-foreground">Faixa 36 / 89</div>
        </div>
      </div>
    )
  }

  return (
    <div
      className={cn(
        "fixed bottom-0 left-16 right-0 z-30 flex h-16 items-center gap-4 border-t border-border bg-card/90 px-4 backdrop-blur-xl",
        className,
      )}
    >
      {/* Track info */}
      <div className="flex items-center gap-3 w-72">
        <div className="flex h-10 w-10 items-center justify-center rounded-md bg-gradient-to-br from-accent to-primary text-primary-foreground">
          <Music2 className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <div className="truncate font-display text-sm tracking-wider">GOOD TIME GIRL</div>
          <div className="truncate text-[11px] text-muted-foreground">28 · Faixa 77 de 89</div>
        </div>
      </div>

      {/* Controls */}
      <div className="flex flex-1 flex-col items-center gap-1">
        <div className="flex items-center gap-2">
          <button className="text-muted-foreground hover:text-foreground" aria-label="Aleatório">
            <Shuffle className="h-4 w-4" />
          </button>
          <button className="text-muted-foreground hover:text-foreground" aria-label="Anterior">
            <SkipBack className="h-4 w-4" />
          </button>
          <button
            onClick={() => setPlaying(!playing)}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-foreground text-background transition hover:scale-105"
            aria-label={playing ? "Pausar" : "Tocar"}
          >
            {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 translate-x-px" />}
          </button>
          <button className="text-muted-foreground hover:text-foreground" aria-label="Próxima">
            <SkipForward className="h-4 w-4" />
          </button>
          <button className="text-muted-foreground hover:text-foreground" aria-label="Repetir">
            <Repeat className="h-4 w-4" />
          </button>
        </div>
        <div className="flex w-full max-w-xl items-center gap-2 text-[10px] text-muted-foreground">
          <span className="tabular-nums">0:09</span>
          <Slider
            value={[progress]}
            onValueChange={(v) => setProgress(v[0] ?? 0)}
            max={100}
            step={1}
            className="flex-1"
          />
          <span className="tabular-nums">4:42</span>
        </div>
      </div>

      {/* Volume */}
      <div className="flex w-40 items-center gap-2">
        <Volume2 className="h-4 w-4 text-muted-foreground" />
        <Slider defaultValue={[70]} max={100} step={1} className="flex-1" />
      </div>
    </div>
  )
}
