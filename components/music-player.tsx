"use client"

import { ChevronDown, ChevronUp, Heart, ListMusic, Maximize2, Mic2, Minimize2, MonitorSpeaker, Pause, Play, Repeat, Shuffle, SkipBack, SkipForward, Volume2, VolumeX, X } from "lucide-react"
import Image from "next/image"
import { useState, useEffect } from "react"
import { Slider } from "@/components/ui/slider"
import { cn } from "@/lib/utils"

type PlayerSize = "full" | "compact" | "mini" | "hidden"

interface MusicPlayerProps {
  className?: string
  defaultSize?: PlayerSize
}

const tracks = [
  { title: "Good Time Girl", artist: "Sofi Tukker, Charlie Barker", cover: "https://i.scdn.co/image/ab67616d00004851e8b066f70c206551210d902b", duration: "4:42" },
  { title: "Spike Island", artist: "The Stone Roses", cover: "https://i.scdn.co/image/ab67616d00004851af73e8c30f43bcbb4e8b8c83", duration: "3:55" },
  { title: "Blinding Lights", artist: "The Weeknd", cover: "https://i.scdn.co/image/ab67616d00004851ef017e899c0547766997d874", duration: "3:20" },
]

export function MusicPlayer({ className, defaultSize = "compact" }: MusicPlayerProps) {
  const [size, setSize] = useState<PlayerSize>(defaultSize)
  const [playing, setPlaying] = useState(false)
  const [progress, setProgress] = useState(8)
  const [volume, setVolume] = useState(70)
  const [muted, setMuted] = useState(false)
  const [liked, setLiked] = useState(false)
  const [shuffle, setShuffle] = useState(false)
  const [repeat, setRepeat] = useState(false)
  const [currentTrack] = useState(0)

  const track = tracks[currentTrack]

  // Hidden state - only show a small button
  if (size === "hidden") {
    return (
      <button
        onClick={() => setSize("mini")}
        className={cn(
          "fixed bottom-4 right-4 z-30 flex h-12 w-12 items-center justify-center rounded-full bg-[#1db954] text-black shadow-lg transition-all hover:scale-105",
          className
        )}
        aria-label="Abrir player"
      >
        <Play className="h-5 w-5 fill-current translate-x-0.5" />
      </button>
    )
  }

  // Mini player - floating pill
  if (size === "mini") {
    return (
      <div className={cn(
        "fixed bottom-4 right-4 z-30 flex items-center gap-3 rounded-full bg-[#282828] pl-1 pr-4 py-1 shadow-xl border border-white/10",
        className
      )}>
        <div className="relative h-10 w-10 flex-shrink-0 overflow-hidden rounded-full">
          <Image src={track.cover} alt="Album" fill className="object-cover" unoptimized />
        </div>
        <div className="min-w-0 max-w-[120px]">
          <div className="truncate text-sm font-medium text-white">{track.title}</div>
          <div className="truncate text-[10px] text-[#b3b3b3]">{track.artist}</div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setPlaying(!playing)}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-black transition hover:scale-105"
            aria-label={playing ? "Pausar" : "Tocar"}
          >
            {playing ? <Pause className="h-4 w-4 fill-current" /> : <Play className="h-4 w-4 fill-current translate-x-0.5" />}
          </button>
          <button
            onClick={() => setSize("compact")}
            className="p-1.5 text-[#b3b3b3] hover:text-white transition-colors"
            aria-label="Expandir"
          >
            <ChevronUp className="h-4 w-4" />
          </button>
          <button
            onClick={() => setSize("hidden")}
            className="p-1.5 text-[#b3b3b3] hover:text-white transition-colors"
            aria-label="Fechar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    )
  }

  // Compact player - slim bar
  if (size === "compact") {
    return (
      <div className={cn(
        "fixed bottom-0 left-[72px] right-0 z-30 flex h-16 items-center justify-between bg-gradient-to-r from-[#181818] to-[#121212] border-t border-[#282828] px-4",
        className
      )}>
        {/* Left - Track info */}
        <div className="flex items-center gap-3 w-[30%] min-w-[180px]">
          <div className="relative h-10 w-10 flex-shrink-0 overflow-hidden rounded shadow-lg">
            <Image src={track.cover} alt="Album" fill className="object-cover" unoptimized />
          </div>
          <div className="min-w-0">
            <div className="truncate text-sm font-medium text-white">{track.title}</div>
            <div className="truncate text-[11px] text-[#b3b3b3]">{track.artist}</div>
          </div>
          <button 
            onClick={() => setLiked(!liked)}
            className={cn("flex-shrink-0 p-1", liked ? "text-[#1db954]" : "text-[#b3b3b3] hover:text-white")}
          >
            <Heart className={cn("h-4 w-4", liked && "fill-current")} />
          </button>
        </div>

        {/* Center - Controls */}
        <div className="flex flex-col items-center gap-1 max-w-[40%] w-full">
          <div className="flex items-center gap-3">
            <button onClick={() => setShuffle(!shuffle)} className={cn("p-1", shuffle ? "text-[#1db954]" : "text-[#b3b3b3] hover:text-white")}>
              <Shuffle className="h-3.5 w-3.5" />
            </button>
            <button className="p-1 text-[#b3b3b3] hover:text-white"><SkipBack className="h-4 w-4 fill-current" /></button>
            <button
              onClick={() => setPlaying(!playing)}
              className="flex h-7 w-7 items-center justify-center rounded-full bg-white text-black transition hover:scale-105"
            >
              {playing ? <Pause className="h-3.5 w-3.5 fill-current" /> : <Play className="h-3.5 w-3.5 fill-current translate-x-0.5" />}
            </button>
            <button className="p-1 text-[#b3b3b3] hover:text-white"><SkipForward className="h-4 w-4 fill-current" /></button>
            <button onClick={() => setRepeat(!repeat)} className={cn("p-1", repeat ? "text-[#1db954]" : "text-[#b3b3b3] hover:text-white")}>
              <Repeat className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="flex w-full items-center gap-2 text-[10px] text-[#b3b3b3]">
            <span className="w-8 text-right tabular-nums">0:09</span>
            <Slider
              value={[progress]}
              onValueChange={(v) => setProgress(v[0] ?? 0)}
              max={100}
              className="flex-1 [&_[data-slot=track]]:h-1 [&_[data-slot=track]]:bg-[#4d4d4d] [&_[data-slot=range]]:bg-white [&_[data-slot=thumb]]:h-0 [&_[data-slot=thumb]]:w-0"
            />
            <span className="w-8 tabular-nums">{track.duration}</span>
          </div>
        </div>

        {/* Right - Volume & controls */}
        <div className="flex items-center justify-end gap-2 w-[30%] min-w-[180px]">
          <button className="p-1.5 text-[#b3b3b3] hover:text-white"><ListMusic className="h-4 w-4" /></button>
          <div className="flex items-center gap-1 w-24">
            <button onClick={() => setMuted(!muted)} className="p-1 text-[#b3b3b3] hover:text-white">
              {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
            </button>
            <Slider
              value={[muted ? 0 : volume]}
              onValueChange={(v) => { setVolume(v[0] ?? 0); setMuted(false) }}
              max={100}
              className="flex-1 [&_[data-slot=track]]:h-1 [&_[data-slot=track]]:bg-[#4d4d4d] [&_[data-slot=range]]:bg-white [&_[data-slot=thumb]]:h-0 [&_[data-slot=thumb]]:w-0"
            />
          </div>
          <button onClick={() => setSize("full")} className="p-1.5 text-[#b3b3b3] hover:text-white"><Maximize2 className="h-4 w-4" /></button>
          <button onClick={() => setSize("mini")} className="p-1.5 text-[#b3b3b3] hover:text-white"><Minimize2 className="h-4 w-4" /></button>
        </div>
      </div>
    )
  }

  // Full player - expanded bar
  return (
    <div className={cn(
      "fixed bottom-0 left-[72px] right-0 z-30 flex h-[90px] items-center justify-between bg-[#000000] border-t border-[#282828] px-4",
      className
    )}>
      {/* Left - Track info */}
      <div className="flex items-center gap-3 w-[30%] min-w-[180px]">
        <div className="relative h-14 w-14 flex-shrink-0 overflow-hidden rounded shadow-lg">
          <Image src={track.cover} alt="Album cover" fill className="object-cover" unoptimized />
        </div>
        <div className="min-w-0">
          <div className="truncate text-sm font-medium text-white hover:underline cursor-pointer">{track.title}</div>
          <div className="truncate text-[11px] text-[#b3b3b3] hover:text-white hover:underline cursor-pointer">{track.artist}</div>
        </div>
        <button 
          onClick={() => setLiked(!liked)}
          className={cn("flex-shrink-0 p-1.5 transition-colors", liked ? "text-[#1db954]" : "text-[#b3b3b3] hover:text-white")}
        >
          <Heart className={cn("h-4 w-4", liked && "fill-current")} />
        </button>
      </div>

      {/* Center - Controls */}
      <div className="flex flex-col items-center gap-1.5 max-w-[45%] w-full">
        <div className="flex items-center gap-4">
          <button onClick={() => setShuffle(!shuffle)} className={cn("p-1.5 transition-colors", shuffle ? "text-[#1db954]" : "text-[#b3b3b3] hover:text-white")}>
            <Shuffle className="h-4 w-4" />
          </button>
          <button className="p-1.5 text-[#b3b3b3] hover:text-white transition-colors"><SkipBack className="h-5 w-5 fill-current" /></button>
          <button
            onClick={() => setPlaying(!playing)}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-black transition-transform hover:scale-105 active:scale-95"
          >
            {playing ? <Pause className="h-4 w-4 fill-current" /> : <Play className="h-4 w-4 fill-current translate-x-0.5" />}
          </button>
          <button className="p-1.5 text-[#b3b3b3] hover:text-white transition-colors"><SkipForward className="h-5 w-5 fill-current" /></button>
          <button onClick={() => setRepeat(!repeat)} className={cn("p-1.5 transition-colors", repeat ? "text-[#1db954]" : "text-[#b3b3b3] hover:text-white")}>
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
              className="cursor-pointer [&_[data-slot=track]]:h-1 [&_[data-slot=track]]:bg-[#4d4d4d] [&_[data-slot=range]]:bg-white group-hover:[&_[data-slot=range]]:bg-[#1db954] [&_[data-slot=thumb]]:h-3 [&_[data-slot=thumb]]:w-3 [&_[data-slot=thumb]]:opacity-0 group-hover:[&_[data-slot=thumb]]:opacity-100 [&_[data-slot=thumb]]:bg-white [&_[data-slot=thumb]]:border-0"
            />
          </div>
          <span className="w-10 tabular-nums">{track.duration}</span>
        </div>
      </div>

      {/* Right - Extra controls */}
      <div className="flex items-center justify-end gap-2 w-[30%] min-w-[180px]">
        <button className="p-2 text-[#b3b3b3] hover:text-white transition-colors"><Mic2 className="h-4 w-4" /></button>
        <button className="p-2 text-[#b3b3b3] hover:text-white transition-colors"><ListMusic className="h-4 w-4" /></button>
        <button className="p-2 text-[#b3b3b3] hover:text-white transition-colors"><MonitorSpeaker className="h-4 w-4" /></button>
        <div className="flex items-center gap-1 group w-28">
          <button onClick={() => setMuted(!muted)} className="p-2 text-[#b3b3b3] hover:text-white transition-colors">
            {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
          </button>
          <Slider 
            value={[muted ? 0 : volume]}
            onValueChange={(v) => { setVolume(v[0] ?? 0); setMuted(false) }}
            max={100}
            className="flex-1 cursor-pointer [&_[data-slot=track]]:h-1 [&_[data-slot=track]]:bg-[#4d4d4d] [&_[data-slot=range]]:bg-white group-hover:[&_[data-slot=range]]:bg-[#1db954] [&_[data-slot=thumb]]:h-3 [&_[data-slot=thumb]]:w-3 [&_[data-slot=thumb]]:opacity-0 group-hover:[&_[data-slot=thumb]]:opacity-100 [&_[data-slot=thumb]]:bg-white [&_[data-slot=thumb]]:border-0"
          />
        </div>
        <button onClick={() => setSize("compact")} className="p-2 text-[#b3b3b3] hover:text-white transition-colors"><ChevronDown className="h-4 w-4" /></button>
        <button onClick={() => setSize("mini")} className="p-2 text-[#b3b3b3] hover:text-white transition-colors"><Minimize2 className="h-4 w-4" /></button>
      </div>
    </div>
  )
}
