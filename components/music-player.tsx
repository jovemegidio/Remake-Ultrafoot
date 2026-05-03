"use client"

import { Heart, ListMusic, Maximize2, Mic2, MonitorSpeaker, Pause, Play, Repeat, Shuffle, SkipBack, SkipForward, Volume1, Volume2 } from "lucide-react"
import Image from "next/image"
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
  const [liked, setLiked] = useState(false)
  const [shuffle, setShuffle] = useState(false)
  const [repeat, setRepeat] = useState(false)

  if (variant === "minimal") {
    return (
      <div
        className={cn(
          "flex items-center gap-3 rounded-md bg-[#181818] px-3 py-2",
          className,
        )}
      >
        <button
          onClick={() => setPlaying(!playing)}
          className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-black transition hover:scale-105"
          aria-label={playing ? "Pausar" : "Tocar"}
        >
          {playing ? <Pause className="h-4 w-4 fill-current" /> : <Play className="h-4 w-4 fill-current translate-x-0.5" />}
        </button>
        <div className="min-w-0">
          <div className="truncate text-sm font-medium text-white">Spike Island</div>
          <div className="truncate text-xs text-[#b3b3b3]">The Stone Roses</div>
        </div>
      </div>
    )
  }

  return (
    <div
      className={cn(
        "fixed bottom-0 left-[72px] right-0 z-30 flex h-[90px] items-center justify-between bg-[#000000] border-t border-[#282828] px-4",
        className,
      )}
    >
      {/* Track info - Left section */}
      <div className="flex items-center gap-3 w-[30%] min-w-[180px]">
        <div className="relative h-14 w-14 flex-shrink-0 overflow-hidden rounded shadow-lg">
          <Image
            src="https://i.scdn.co/image/ab67616d00004851e8b066f70c206551210d902b"
            alt="Album cover"
            fill
            className="object-cover"
            unoptimized
          />
        </div>
        <div className="min-w-0">
          <div className="truncate text-sm font-medium text-white hover:underline cursor-pointer">
            Good Time Girl
          </div>
          <div className="truncate text-[11px] text-[#b3b3b3] hover:text-white hover:underline cursor-pointer">
            Sofi Tukker, Charlie Barker
          </div>
        </div>
        <button 
          onClick={() => setLiked(!liked)}
          className={cn(
            "flex-shrink-0 p-1.5 transition-colors",
            liked ? "text-[#1db954]" : "text-[#b3b3b3] hover:text-white"
          )}
          aria-label={liked ? "Remover dos favoritos" : "Adicionar aos favoritos"}
        >
          <Heart className={cn("h-4 w-4", liked && "fill-current")} />
        </button>
      </div>

      {/* Controls - Center section */}
      <div className="flex flex-col items-center gap-1.5 max-w-[45%] w-full">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => setShuffle(!shuffle)}
            className={cn(
              "p-1.5 transition-colors",
              shuffle ? "text-[#1db954]" : "text-[#b3b3b3] hover:text-white"
            )} 
            aria-label="Aleatório"
          >
            <Shuffle className="h-4 w-4" />
          </button>
          <button 
            className="p-1.5 text-[#b3b3b3] hover:text-white transition-colors" 
            aria-label="Anterior"
          >
            <SkipBack className="h-5 w-5 fill-current" />
          </button>
          <button
            onClick={() => setPlaying(!playing)}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-black transition-transform hover:scale-105 active:scale-95"
            aria-label={playing ? "Pausar" : "Tocar"}
          >
            {playing ? (
              <Pause className="h-4 w-4 fill-current" />
            ) : (
              <Play className="h-4 w-4 fill-current translate-x-0.5" />
            )}
          </button>
          <button 
            className="p-1.5 text-[#b3b3b3] hover:text-white transition-colors" 
            aria-label="Próxima"
          >
            <SkipForward className="h-5 w-5 fill-current" />
          </button>
          <button 
            onClick={() => setRepeat(!repeat)}
            className={cn(
              "p-1.5 transition-colors",
              repeat ? "text-[#1db954]" : "text-[#b3b3b3] hover:text-white"
            )} 
            aria-label="Repetir"
          >
            <Repeat className="h-4 w-4" />
          </button>
        </div>
        <div className="flex w-full items-center gap-2 text-[11px] text-[#b3b3b3]">
          <span className="w-10 text-right tabular-nums">0:09</span>
          <div className="flex-1 group">
            <Slider
              value={[progress]}
              onValueChange={(v) => setProgress(v[0] ?? 0)}
              max={100}
              step={1}
              className="cursor-pointer [&_[data-slot=track]]:h-1 [&_[data-slot=track]]:bg-[#4d4d4d] [&_[data-slot=range]]:bg-white group-hover:[&_[data-slot=range]]:bg-[#1db954] [&_[data-slot=thumb]]:h-3 [&_[data-slot=thumb]]:w-3 [&_[data-slot=thumb]]:opacity-0 group-hover:[&_[data-slot=thumb]]:opacity-100 [&_[data-slot=thumb]]:bg-white [&_[data-slot=thumb]]:border-0"
            />
          </div>
          <span className="w-10 tabular-nums">4:42</span>
        </div>
      </div>

      {/* Extra controls - Right section */}
      <div className="flex items-center justify-end gap-2 w-[30%] min-w-[180px]">
        <button className="p-2 text-[#b3b3b3] hover:text-white transition-colors" aria-label="Visualizar letras">
          <Mic2 className="h-4 w-4" />
        </button>
        <button className="p-2 text-[#b3b3b3] hover:text-white transition-colors" aria-label="Fila de reprodução">
          <ListMusic className="h-4 w-4" />
        </button>
        <button className="p-2 text-[#b3b3b3] hover:text-white transition-colors" aria-label="Conectar a um dispositivo">
          <MonitorSpeaker className="h-4 w-4" />
        </button>
        <div className="flex items-center gap-1 group w-28">
          <button className="p-2 text-[#b3b3b3] hover:text-white transition-colors" aria-label="Volume">
            <Volume2 className="h-4 w-4" />
          </button>
          <Slider 
            defaultValue={[70]} 
            max={100} 
            step={1} 
            className="flex-1 cursor-pointer [&_[data-slot=track]]:h-1 [&_[data-slot=track]]:bg-[#4d4d4d] [&_[data-slot=range]]:bg-white group-hover:[&_[data-slot=range]]:bg-[#1db954] [&_[data-slot=thumb]]:h-3 [&_[data-slot=thumb]]:w-3 [&_[data-slot=thumb]]:opacity-0 group-hover:[&_[data-slot=thumb]]:opacity-100 [&_[data-slot=thumb]]:bg-white [&_[data-slot=thumb]]:border-0"
          />
        </div>
        <button className="p-2 text-[#b3b3b3] hover:text-white transition-colors" aria-label="Tela cheia">
          <Maximize2 className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
