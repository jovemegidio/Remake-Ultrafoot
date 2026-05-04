"use client"

import { ChevronDown, ChevronUp, Heart, ListMusic, Maximize2, Minimize2, MonitorSpeaker, Pause, Play, Repeat, Shuffle, SkipBack, SkipForward, Volume2, VolumeX, X } from "lucide-react"
import Image from "next/image"
import { useState, useEffect, useRef, useCallback } from "react"
import { Slider } from "@/components/ui/slider"
import { cn } from "@/lib/utils"

type PlayerSize = "full" | "compact" | "mini" | "hidden"

interface MusicPlayerProps {
  className?: string
  defaultSize?: PlayerSize
}

// Trilhas sonoras de futebol/jogo - usando URLs de audio livre
const tracks = [
  { 
    title: "Stadium Anthem", 
    artist: "Sport Vibes", 
    cover: "https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=300&h=300&fit=crop",
    // Audio livre de royalties para demo
    src: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3",
    duration: 372 // 6:12
  },
  { 
    title: "Victory March", 
    artist: "Game Day", 
    cover: "https://images.unsplash.com/photo-1508098682722-e99c43a406b2?w=300&h=300&fit=crop",
    src: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3",
    duration: 398 // 6:38
  },
  { 
    title: "Pre Match Energy", 
    artist: "Football Beats", 
    cover: "https://images.unsplash.com/photo-1431324155629-1a6deb1dec8d?w=300&h=300&fit=crop",
    src: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3",
    duration: 359 // 5:59
  },
  { 
    title: "Championship Vibes", 
    artist: "Sports Mix", 
    cover: "https://images.unsplash.com/photo-1489944440615-453fc2b6a9a9?w=300&h=300&fit=crop",
    src: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3",
    duration: 447 // 7:27
  },
  { 
    title: "Locker Room", 
    artist: "Team Spirit", 
    cover: "https://images.unsplash.com/photo-1579952363873-27f3bade9f55?w=300&h=300&fit=crop",
    src: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-5.mp3",
    duration: 322 // 5:22
  },
]

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

export function MusicPlayer({ className, defaultSize = "mini" }: MusicPlayerProps) {
  const [size, setSize] = useState<PlayerSize>(defaultSize)
  const [playing, setPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolume] = useState(70)
  const [muted, setMuted] = useState(false)
  const [liked, setLiked] = useState<Set<number>>(new Set())
  const [shuffle, setShuffle] = useState(false)
  const [repeat, setRepeat] = useState<"off" | "all" | "one">("off")
  const [currentTrack, setCurrentTrack] = useState(0)
  const [isLoading, setIsLoading] = useState(false)
  const [showPlaylist, setShowPlaylist] = useState(false)
  
  const audioRef = useRef<HTMLAudioElement | null>(null)

  const track = tracks[currentTrack]

  // Initialize audio element
  useEffect(() => {
    if (!audioRef.current) {
      audioRef.current = new Audio()
      audioRef.current.preload = "metadata"
    }
    
    const audio = audioRef.current
    
    const handleTimeUpdate = () => setCurrentTime(audio.currentTime)
    const handleDurationChange = () => setDuration(audio.duration || track.duration)
    const handleEnded = () => {
      if (repeat === "one") {
        audio.currentTime = 0
        audio.play()
      } else {
        nextTrack()
      }
    }
    const handleCanPlay = () => setIsLoading(false)
    const handleWaiting = () => setIsLoading(true)
    
    audio.addEventListener("timeupdate", handleTimeUpdate)
    audio.addEventListener("durationchange", handleDurationChange)
    audio.addEventListener("ended", handleEnded)
    audio.addEventListener("canplay", handleCanPlay)
    audio.addEventListener("waiting", handleWaiting)
    
    return () => {
      audio.removeEventListener("timeupdate", handleTimeUpdate)
      audio.removeEventListener("durationchange", handleDurationChange)
      audio.removeEventListener("ended", handleEnded)
      audio.removeEventListener("canplay", handleCanPlay)
      audio.removeEventListener("waiting", handleWaiting)
    }
  }, [currentTrack, repeat])

  // Load track when changed
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.src = track.src
      audioRef.current.load()
      if (playing) {
        audioRef.current.play().catch(() => {})
      }
    }
  }, [currentTrack])

  // Handle play/pause
  useEffect(() => {
    if (audioRef.current) {
      if (playing) {
        audioRef.current.play().catch(() => setPlaying(false))
      } else {
        audioRef.current.pause()
      }
    }
  }, [playing])

  // Handle volume
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = muted ? 0 : volume / 100
    }
  }, [volume, muted])

  const togglePlay = useCallback(() => setPlaying(p => !p), [])

  const nextTrack = useCallback(() => {
    if (shuffle) {
      const next = Math.floor(Math.random() * tracks.length)
      setCurrentTrack(next)
    } else {
      setCurrentTrack(i => (i + 1) % tracks.length)
    }
  }, [shuffle])

  const prevTrack = useCallback(() => {
    if (audioRef.current && audioRef.current.currentTime > 3) {
      audioRef.current.currentTime = 0
    } else {
      setCurrentTrack(i => (i - 1 + tracks.length) % tracks.length)
    }
  }, [])

  const seek = useCallback((value: number[]) => {
    const newTime = (value[0] / 100) * duration
    if (audioRef.current) {
      audioRef.current.currentTime = newTime
    }
    setCurrentTime(newTime)
  }, [duration])

  const toggleLike = useCallback((index: number) => {
    setLiked(prev => {
      const next = new Set(prev)
      if (next.has(index)) {
        next.delete(index)
      } else {
        next.add(index)
      }
      return next
    })
  }, [])

  const cycleRepeat = useCallback(() => {
    setRepeat(r => r === "off" ? "all" : r === "all" ? "one" : "off")
  }, [])

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0

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

  // Mini player - EA FC style floating pill
  if (size === "mini") {
    return (
      <div className={cn(
        "fixed bottom-4 right-4 z-30 flex items-center gap-2 rounded-full bg-[#1a1a1a] pl-1.5 pr-2 py-1.5 shadow-2xl border border-[#333]",
        className
      )}>
        {/* Album cover with lime green glow */}
        <div className="relative h-9 w-9 flex-shrink-0 overflow-hidden rounded-full ring-2 ring-[#c5e946] ring-offset-1 ring-offset-[#1a1a1a]">
          <Image src={track.cover} alt="Album" fill className="object-cover" unoptimized />
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/50">
              <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            </div>
          )}
        </div>
        
        {/* Track info */}
        <div className="min-w-0 max-w-[100px] px-1">
          <div className="truncate text-xs font-semibold text-white leading-tight">{track.title}</div>
          <div className="truncate text-[10px] text-[#888]">{track.artist}</div>
        </div>
        
        {/* Play button - EA FC lime green style */}
        <button
          onClick={togglePlay}
          className="flex h-7 w-7 items-center justify-center rounded-full bg-[#c5e946] text-black transition hover:bg-[#d4f055] hover:scale-105"
          aria-label={playing ? "Pausar" : "Tocar"}
        >
          {playing ? <Pause className="h-3.5 w-3.5 fill-current" /> : <Play className="h-3.5 w-3.5 fill-current translate-x-0.5" />}
        </button>
        
        {/* Expand and close buttons */}
        <button
          onClick={() => setSize("compact")}
          className="p-1 text-[#666] hover:text-white transition-colors"
          aria-label="Expandir"
        >
          <ChevronUp className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={() => setSize("hidden")}
          className="p-1 text-[#666] hover:text-white transition-colors"
          aria-label="Fechar"
        >
          <X className="h-3.5 w-3.5" />
        </button>
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
            onClick={() => toggleLike(currentTrack)}
            className={cn("flex-shrink-0 p-1", liked.has(currentTrack) ? "text-[#1db954]" : "text-[#b3b3b3] hover:text-white")}
          >
            <Heart className={cn("h-4 w-4", liked.has(currentTrack) && "fill-current")} />
          </button>
        </div>

        {/* Center - Controls */}
        <div className="flex flex-col items-center gap-1 max-w-[40%] w-full">
          <div className="flex items-center gap-3">
            <button onClick={() => setShuffle(!shuffle)} className={cn("p-1", shuffle ? "text-[#1db954]" : "text-[#b3b3b3] hover:text-white")}>
              <Shuffle className="h-3.5 w-3.5" />
            </button>
            <button onClick={prevTrack} className="p-1 text-[#b3b3b3] hover:text-white"><SkipBack className="h-4 w-4 fill-current" /></button>
            <button
              onClick={togglePlay}
              disabled={isLoading}
              className="flex h-7 w-7 items-center justify-center rounded-full bg-white text-black transition hover:scale-105 disabled:opacity-50"
            >
              {isLoading ? (
                <div className="h-3 w-3 border-2 border-black/30 border-t-black rounded-full animate-spin" />
              ) : playing ? (
                <Pause className="h-3.5 w-3.5 fill-current" />
              ) : (
                <Play className="h-3.5 w-3.5 fill-current translate-x-0.5" />
              )}
            </button>
            <button onClick={nextTrack} className="p-1 text-[#b3b3b3] hover:text-white"><SkipForward className="h-4 w-4 fill-current" /></button>
            <button onClick={cycleRepeat} className={cn("p-1 relative", repeat !== "off" ? "text-[#1db954]" : "text-[#b3b3b3] hover:text-white")}>
              <Repeat className="h-3.5 w-3.5" />
              {repeat === "one" && <span className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 text-[8px] font-bold">1</span>}
            </button>
          </div>
          <div className="flex w-full items-center gap-2 text-[10px] text-[#b3b3b3]">
            <span className="w-8 text-right tabular-nums">{formatTime(currentTime)}</span>
            <Slider
              value={[progress]}
              onValueChange={seek}
              max={100}
              className="flex-1 [&_[data-slot=track]]:h-1 [&_[data-slot=track]]:bg-[#4d4d4d] [&_[data-slot=range]]:bg-white [&_[data-slot=thumb]]:h-0 [&_[data-slot=thumb]]:w-0"
            />
            <span className="w-8 tabular-nums">{formatTime(duration || track.duration)}</span>
          </div>
        </div>

        {/* Right - Volume & controls */}
        <div className="flex items-center justify-end gap-2 w-[30%] min-w-[180px]">
          <button 
            onClick={() => setShowPlaylist(!showPlaylist)} 
            className={cn("p-1.5", showPlaylist ? "text-[#1db954]" : "text-[#b3b3b3] hover:text-white")}
          >
            <ListMusic className="h-4 w-4" />
          </button>
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

        {/* Playlist Popup */}
        {showPlaylist && (
          <div className="absolute bottom-full right-4 mb-2 w-80 rounded-lg bg-[#282828] border border-white/10 shadow-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-white/5">
              <h3 className="text-sm font-semibold text-white">Fila de Reproducao</h3>
            </div>
            <div className="max-h-60 overflow-y-auto">
              {tracks.map((t, i) => (
                <button
                  key={i}
                  onClick={() => { setCurrentTrack(i); setShowPlaylist(false) }}
                  className={cn(
                    "w-full flex items-center gap-3 px-4 py-2 hover:bg-white/5 transition-colors",
                    i === currentTrack && "bg-white/10"
                  )}
                >
                  <div className="relative h-10 w-10 flex-shrink-0 rounded overflow-hidden">
                    <Image src={t.cover} alt={t.title} fill className="object-cover" unoptimized />
                    {i === currentTrack && playing && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                        <div className="flex items-end gap-0.5 h-3">
                          {[1, 2, 3].map(bar => (
                            <div 
                              key={bar} 
                              className="w-0.5 bg-[#1db954] animate-pulse" 
                              style={{ height: `${Math.random() * 100}%`, animationDelay: `${bar * 0.1}s` }}
                            />
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0 text-left">
                    <div className={cn("truncate text-sm", i === currentTrack ? "text-[#1db954]" : "text-white")}>
                      {t.title}
                    </div>
                    <div className="truncate text-xs text-[#b3b3b3]">{t.artist}</div>
                  </div>
                  <span className="text-xs text-[#b3b3b3] tabular-nums">{formatTime(t.duration)}</span>
                </button>
              ))}
            </div>
          </div>
        )}
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
          onClick={() => toggleLike(currentTrack)}
          className={cn("flex-shrink-0 p-1.5 transition-colors", liked.has(currentTrack) ? "text-[#1db954]" : "text-[#b3b3b3] hover:text-white")}
        >
          <Heart className={cn("h-4 w-4", liked.has(currentTrack) && "fill-current")} />
        </button>
      </div>

      {/* Center - Controls */}
      <div className="flex flex-col items-center gap-1.5 max-w-[45%] w-full">
        <div className="flex items-center gap-4">
          <button onClick={() => setShuffle(!shuffle)} className={cn("p-1.5 transition-colors", shuffle ? "text-[#1db954]" : "text-[#b3b3b3] hover:text-white")}>
            <Shuffle className="h-4 w-4" />
          </button>
          <button onClick={prevTrack} className="p-1.5 text-[#b3b3b3] hover:text-white transition-colors"><SkipBack className="h-5 w-5 fill-current" /></button>
          <button
            onClick={togglePlay}
            disabled={isLoading}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-black transition-transform hover:scale-105 active:scale-95 disabled:opacity-50"
          >
            {isLoading ? (
              <div className="h-4 w-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
            ) : playing ? (
              <Pause className="h-4 w-4 fill-current" />
            ) : (
              <Play className="h-4 w-4 fill-current translate-x-0.5" />
            )}
          </button>
          <button onClick={nextTrack} className="p-1.5 text-[#b3b3b3] hover:text-white transition-colors"><SkipForward className="h-5 w-5 fill-current" /></button>
          <button onClick={cycleRepeat} className={cn("p-1.5 transition-colors relative", repeat !== "off" ? "text-[#1db954]" : "text-[#b3b3b3] hover:text-white")}>
            <Repeat className="h-4 w-4" />
            {repeat === "one" && <span className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 text-[8px] font-bold">1</span>}
          </button>
        </div>
        <div className="flex w-full items-center gap-2 text-[11px] text-[#b3b3b3]">
          <span className="w-10 text-right tabular-nums">{formatTime(currentTime)}</span>
          <div className="flex-1 group">
            <Slider
              value={[progress]}
              onValueChange={seek}
              max={100}
              className="cursor-pointer [&_[data-slot=track]]:h-1 [&_[data-slot=track]]:bg-[#4d4d4d] [&_[data-slot=range]]:bg-white group-hover:[&_[data-slot=range]]:bg-[#1db954] [&_[data-slot=thumb]]:h-3 [&_[data-slot=thumb]]:w-3 [&_[data-slot=thumb]]:opacity-0 group-hover:[&_[data-slot=thumb]]:opacity-100 [&_[data-slot=thumb]]:bg-white [&_[data-slot=thumb]]:border-0"
            />
          </div>
          <span className="w-10 tabular-nums">{formatTime(duration || track.duration)}</span>
        </div>
      </div>

      {/* Right - Extra controls */}
      <div className="flex items-center justify-end gap-2 w-[30%] min-w-[180px]">
        <button 
          onClick={() => setShowPlaylist(!showPlaylist)}
          className={cn("p-2 transition-colors", showPlaylist ? "text-[#1db954]" : "text-[#b3b3b3] hover:text-white")}
        >
          <ListMusic className="h-4 w-4" />
        </button>
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

      {/* Playlist Popup */}
      {showPlaylist && (
        <div className="absolute bottom-full right-4 mb-2 w-96 rounded-lg bg-[#282828] border border-white/10 shadow-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white">Fila de Reproducao</h3>
            <span className="text-xs text-white/40">{tracks.length} musicas</span>
          </div>
          <div className="max-h-80 overflow-y-auto">
            {tracks.map((t, i) => (
              <button
                key={i}
                onClick={() => { setCurrentTrack(i); setShowPlaylist(false) }}
                className={cn(
                  "w-full flex items-center gap-3 px-4 py-2.5 hover:bg-white/5 transition-colors",
                  i === currentTrack && "bg-white/10"
                )}
              >
                <span className="w-5 text-xs text-white/40 text-right">{i + 1}</span>
                <div className="relative h-10 w-10 flex-shrink-0 rounded overflow-hidden">
                  <Image src={t.cover} alt={t.title} fill className="object-cover" unoptimized />
                  {i === currentTrack && playing && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                      <div className="flex items-end gap-0.5 h-4">
                        {[1, 2, 3].map(bar => (
                          <div 
                            key={bar} 
                            className="w-1 bg-[#1db954] rounded-full animate-pulse" 
                            style={{ height: `${40 + Math.random() * 60}%`, animationDelay: `${bar * 0.15}s` }}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0 text-left">
                  <div className={cn("truncate text-sm font-medium", i === currentTrack ? "text-[#1db954]" : "text-white")}>
                    {t.title}
                  </div>
                  <div className="truncate text-xs text-[#b3b3b3]">{t.artist}</div>
                </div>
                <button 
                  onClick={(e) => { e.stopPropagation(); toggleLike(i) }}
                  className={cn("p-1", liked.has(i) ? "text-[#1db954]" : "text-transparent group-hover:text-[#b3b3b3] hover:!text-white")}
                >
                  <Heart className={cn("h-4 w-4", liked.has(i) && "fill-current")} />
                </button>
                <span className="text-xs text-[#b3b3b3] tabular-nums">{formatTime(t.duration)}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
