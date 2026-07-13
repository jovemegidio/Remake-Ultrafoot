"use client"

import { ChevronDown, ChevronUp, Heart, ListMusic, Maximize2, Mic2, Minimize2, MonitorSpeaker, Pause, Play, Repeat, Shuffle, SkipBack, SkipForward, Volume1, Volume2, VolumeX, X } from "lucide-react"
import Image from "next/image"
import { useState, useEffect, useMemo, useSyncExternalStore } from "react"
import { Slider } from "@/components/ui/slider"
import { cn } from "@/lib/utils"
import { musicStore } from "@/lib/music-store"

type PlayerSize = "full" | "compact" | "mini" | "hidden"

interface MusicPlayerProps {
  className?: string
  defaultSize?: PlayerSize
  autoPlay?: boolean
  offsetLeft?: number
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

// Spotify green color
const SPOTIFY_GREEN = "#1db954"
const SPOTIFY_GREEN_HOVER = "#1ed760"

export function MusicPlayer({ className, defaultSize = "mini", autoPlay = true, offsetLeft = 72 }: MusicPlayerProps) {
  // Estado de reproducao compartilhado (singleton) — sobrevive a troca de paginas
  const snap = useSyncExternalStore(
    musicStore.subscribe,
    musicStore.getSnapshot,
    musicStore.getServerSnapshot,
  )
  const {
    tracks,
    currentTrack,
    playing,
    currentTime,
    duration,
    volume,
    muted,
    shuffle,
    repeat,
    isLoading,
  } = snap

  // Tamanho/UI sao locais a cada instancia do player
  const [size, setSize] = useState<PlayerSize>(defaultSize)
  const [showPlaylist, setShowPlaylist] = useState(false)
  const [isHoveringProgress, setIsHoveringProgress] = useState(false)
  const [isHoveringVolume, setIsHoveringVolume] = useState(false)

  // Restaura/persiste apenas o tamanho do player (preferencia visual)
  useEffect(() => {
    const savedSize = localStorage.getItem("ultrafoot:music-size")
    if (savedSize !== null) setSize(savedSize as PlayerSize)
  }, [])
  useEffect(() => { localStorage.setItem("ultrafoot:music-size", size) }, [size])

  // Autoplay (apenas instancias com autoPlay habilitado)
  useEffect(() => {
    if (autoPlay) musicStore.requestAutoplay()
  }, [autoPlay, tracks.length])

  const liked = useMemo(() => new Set(snap.liked), [snap.liked])

  const togglePlay = () => musicStore.toggle()
  const nextTrack = () => musicStore.next()
  const prevTrack = () => musicStore.prev()
  const seek = (value: number[]) => musicStore.seekRatio(value[0] ?? 0)
  const toggleLike = (index: number) => musicStore.toggleLike(index)
  const cycleRepeat = () => musicStore.cycleRepeat()
  const setShuffle = (s: boolean) => musicStore.setShuffle(s)
  const setMuted = (m: boolean) => musicStore.setMuted(m)
  const setVolume = (v: number) => musicStore.setVolume(v)
  const setCurrentTrack = (i: number) => musicStore.setCurrentTrack(i)

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0

  const track = tracks[currentTrack]
  if (!track || tracks.length === 0) return null

  const VolumeIcon = muted || volume === 0 ? VolumeX : volume < 50 ? Volume1 : Volume2

  // Hidden state
  if (size === "hidden") {
    return (
      <button
        onClick={() => setSize("mini")}
        className={cn(
          // bottom-4 colide com a EaActionBar (rodape global de 44px, tambem z-30) em desktop,
          // deixando o botao escondido atras dela. Sobe pra cima da barra em md+.
          "fixed bottom-4 md:bottom-[60px] right-4 z-30 flex h-12 w-12 items-center justify-center rounded-full shadow-lg transition-all hover:scale-105",
          className
        )}
        style={{ backgroundColor: SPOTIFY_GREEN }}
        aria-label="Abrir player"
      >
        <Play className="h-5 w-5 fill-white text-white translate-x-0.5" />
      </button>
    )
  }

  // Mini player - Spotify style floating pill
  if (size === "mini") {
    const progressPct = duration > 0 ? (currentTime / duration) * 100 : 0

    // Visual Apple Music: cartao de vidro fosco, glow ambiente vindo da propria capa,
    // acento vermelho (#fa233b) e uma linha fina de progresso na base.
    return (
      <div className={cn("fixed bottom-20 md:bottom-[60px] right-4 z-50", className)}>
        {/* Glow ambiente: a capa borrada vazando por tras do cartao */}
        <div
          aria-hidden
          className="pointer-events-none absolute -inset-6 -z-10 opacity-40 blur-2xl saturate-150"
          style={{
            backgroundImage: `url(${track.cover})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        />

        <div className="relative overflow-hidden rounded-2xl border border-white/15 bg-white/[0.07] shadow-2xl shadow-black/50 backdrop-blur-2xl backdrop-saturate-150">
          <div className="flex items-center gap-3 p-2.5">
            {/* Capa */}
            <div className="relative h-12 w-12 flex-shrink-0 overflow-hidden rounded-lg shadow-lg shadow-black/40 ring-1 ring-white/10">
              <Image src={track.cover} alt="Album" fill className="object-cover" unoptimized />
              {isLoading && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/60">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                </div>
              )}
            </div>

            {/* Faixa */}
            <div className="min-w-0 w-[170px] max-w-[42vw] md:w-[210px]">
              <div className="truncate text-[13px] font-semibold leading-tight tracking-[-0.01em] text-white">
                {track.title}
              </div>
              <div className="truncate text-[11px] leading-tight text-white/55">{track.artist}</div>
            </div>

            {/* Controles */}
            <button
              onClick={() => toggleLike(currentTrack)}
              className={cn(
                "p-1.5 transition-colors",
                liked.has(currentTrack) ? "text-[#fa233b]" : "text-white/45 hover:text-white"
              )}
              aria-label="Curtir"
            >
              <Heart className={cn("h-4 w-4", liked.has(currentTrack) && "fill-current")} />
            </button>

            <button
              onClick={togglePlay}
              className="flex h-9 w-9 items-center justify-center rounded-full text-white transition-transform hover:scale-110 active:scale-95"
              aria-label={playing ? "Pausar" : "Tocar"}
            >
              {playing
                ? <Pause className="h-5 w-5 fill-current" />
                : <Play className="h-5 w-5 translate-x-0.5 fill-current" />}
            </button>

            <button
              onClick={() => setSize("compact")}
              className="p-1 text-white/40 transition-colors hover:text-white"
              aria-label="Expandir"
            >
              <ChevronUp className="h-4 w-4" />
            </button>
            <button
              onClick={() => setSize("hidden")}
              className="p-1 text-white/40 transition-colors hover:text-white"
              aria-label="Fechar"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Linha de progresso */}
          <div className="h-[2px] w-full bg-white/10">
            <div
              className="h-full bg-white/70 transition-[width] duration-300 ease-linear"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>
      </div>
    )
  }

  // Compact/Full player - Spotify style bottom bar
  const isFullSize = size === "full"
  
  return (
    <div 
      className={cn(
        // bottom-11 (44px) encaixa a barra do player em cima da EaActionBar global, em vez de
        // sobrepor (mesma posicao/z-index das duas, ver bug do botao "hidden" acima).
        "fixed bottom-11 right-0 z-30 hidden md:flex items-center justify-between bg-[#181818] border-t border-[#282828] px-4",
        isFullSize ? "h-24" : "h-[72px]",
        className
      )}
      style={{ left: `${offsetLeft}px` }}
    >
      {/* Left - Now Playing */}
      <div className="flex items-center gap-3 w-[30%] min-w-[180px]">
        <div className={cn(
          "relative flex-shrink-0 overflow-hidden rounded shadow-lg transition-all",
          isFullSize ? "h-16 w-16" : "h-14 w-14"
        )}>
          <Image src={track.cover} alt="Album cover" fill className="object-cover" unoptimized />
        </div>
        <div className="min-w-0">
          <div className="truncate text-sm font-medium text-white hover:underline cursor-pointer">
            {track.title}
          </div>
          <div className="truncate text-[11px] text-[#a7a7a7] hover:text-white hover:underline cursor-pointer">
            {track.artist}
          </div>
        </div>
        <button 
          onClick={() => toggleLike(currentTrack)}
          className={cn(
            "flex-shrink-0 p-2 transition-colors",
            liked.has(currentTrack) ? "text-[#1db954]" : "text-[#a7a7a7] hover:text-white"
          )}
        >
          <Heart className={cn("h-4 w-4", liked.has(currentTrack) && "fill-current")} />
        </button>
      </div>

      {/* Center - Player Controls */}
      <div className="flex flex-col items-center gap-2 max-w-[45%] w-full">
        {/* Control buttons */}
        <div className="flex items-center gap-4">
          <button 
            onClick={() => setShuffle(!shuffle)} 
            className={cn(
              "p-2 transition-colors relative",
              shuffle ? "text-[#1db954]" : "text-[#a7a7a7] hover:text-white"
            )}
          >
            <Shuffle className="h-4 w-4" />
            {shuffle && <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-[#1db954]" />}
          </button>
          
          <button 
            onClick={prevTrack} 
            className="p-2 text-[#a7a7a7] hover:text-white transition-colors"
          >
            <SkipBack className="h-4 w-4 fill-current" />
          </button>
          
          <button
            onClick={togglePlay}
            disabled={isLoading}
            className={cn(
              "flex items-center justify-center rounded-full bg-white text-black transition-all hover:scale-105 active:scale-95 disabled:opacity-50",
              isFullSize ? "h-9 w-9" : "h-8 w-8"
            )}
          >
            {isLoading ? (
              <div className="h-4 w-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
            ) : playing ? (
              <Pause className={cn("fill-current", isFullSize ? "h-5 w-5" : "h-4 w-4")} />
            ) : (
              <Play className={cn("fill-current translate-x-0.5", isFullSize ? "h-5 w-5" : "h-4 w-4")} />
            )}
          </button>
          
          <button 
            onClick={nextTrack} 
            className="p-2 text-[#a7a7a7] hover:text-white transition-colors"
          >
            <SkipForward className="h-4 w-4 fill-current" />
          </button>
          
          <button 
            onClick={cycleRepeat} 
            className={cn(
              "p-2 transition-colors relative",
              repeat !== "off" ? "text-[#1db954]" : "text-[#a7a7a7] hover:text-white"
            )}
          >
            <Repeat className="h-4 w-4" />
            {repeat === "one" && (
              <span className="absolute top-1 right-0.5 text-[8px] font-bold text-[#1db954]">1</span>
            )}
            {repeat !== "off" && <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-[#1db954]" />}
          </button>
        </div>

        {/* Progress bar */}
        <div 
          className="flex w-full items-center gap-2"
          onMouseEnter={() => setIsHoveringProgress(true)}
          onMouseLeave={() => setIsHoveringProgress(false)}
        >
          <span className="text-[11px] text-[#a7a7a7] w-10 text-right tabular-nums">
            {formatTime(currentTime)}
          </span>
          <div className="flex-1 group">
            <Slider
              value={[progress]}
              onValueChange={seek}
              max={100}
              className={cn(
                "cursor-pointer",
                "[&_[data-slot=track]]:h-1 [&_[data-slot=track]]:bg-[#4d4d4d] [&_[data-slot=track]]:rounded-full",
                isHoveringProgress 
                  ? "[&_[data-slot=range]]:bg-[#1db954] [&_[data-slot=thumb]]:block" 
                  : "[&_[data-slot=range]]:bg-white [&_[data-slot=thumb]]:hidden",
                "[&_[data-slot=thumb]]:h-3 [&_[data-slot=thumb]]:w-3 [&_[data-slot=thumb]]:bg-white [&_[data-slot=thumb]]:border-0"
              )}
            />
          </div>
          <span className="text-[11px] text-[#a7a7a7] w-10 tabular-nums">
            {formatTime(duration || track.duration)}
          </span>
        </div>
      </div>

      {/* Right - Volume & Other Controls */}
      <div className="flex items-center justify-end gap-1 w-[30%] min-w-[180px]">
        {/* Now Playing View */}
        <button className="p-2 text-[#a7a7a7] hover:text-white transition-colors">
          <Mic2 className="h-4 w-4" />
        </button>
        
        {/* Queue */}
        <button 
          onClick={() => setShowPlaylist(!showPlaylist)} 
          className={cn(
            "p-2 transition-colors",
            showPlaylist ? "text-[#1db954]" : "text-[#a7a7a7] hover:text-white"
          )}
        >
          <ListMusic className="h-4 w-4" />
        </button>
        
        {/* Connect to device */}
        <button className="p-2 text-[#a7a7a7] hover:text-white transition-colors">
          <MonitorSpeaker className="h-4 w-4" />
        </button>
        
        {/* Volume */}
        <div 
          className="flex items-center gap-1 group"
          onMouseEnter={() => setIsHoveringVolume(true)}
          onMouseLeave={() => setIsHoveringVolume(false)}
        >
          <button 
            onClick={() => setMuted(!muted)} 
            className="p-2 text-[#a7a7a7] hover:text-white transition-colors"
          >
            <VolumeIcon className="h-4 w-4" />
          </button>
          <div className="w-24">
            <Slider
              value={[muted ? 0 : volume]}
              onValueChange={(v) => { setVolume(v[0] ?? 0); setMuted(false) }}
              max={100}
              className={cn(
                "cursor-pointer",
                "[&_[data-slot=track]]:h-1 [&_[data-slot=track]]:bg-[#4d4d4d] [&_[data-slot=track]]:rounded-full",
                isHoveringVolume 
                  ? "[&_[data-slot=range]]:bg-[#1db954] [&_[data-slot=thumb]]:block" 
                  : "[&_[data-slot=range]]:bg-white [&_[data-slot=thumb]]:hidden",
                "[&_[data-slot=thumb]]:h-3 [&_[data-slot=thumb]]:w-3 [&_[data-slot=thumb]]:bg-white [&_[data-slot=thumb]]:border-0"
              )}
            />
          </div>
        </div>

        {/* Size controls */}
        <button 
          onClick={() => setSize(isFullSize ? "compact" : "full")} 
          className="p-2 text-[#a7a7a7] hover:text-white transition-colors"
        >
          {isFullSize ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
        </button>
        <button 
          onClick={() => setSize("mini")} 
          className="p-2 text-[#a7a7a7] hover:text-white transition-colors"
        >
          <ChevronDown className="h-4 w-4" />
        </button>
      </div>

      {/* Playlist Popup - Spotify style */}
      {showPlaylist && (
        <div className="absolute bottom-full right-4 mb-2 w-80 rounded-lg bg-[#282828] shadow-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-white/[0.06]">
            <h3 className="text-base font-bold text-white">Fila</h3>
          </div>
          <div className="p-2">
            <div className="px-2 py-1 text-xs font-bold text-[#a7a7a7] uppercase tracking-wider">
              Tocando agora
            </div>
            <div className="flex items-center gap-3 p-2 rounded-md bg-[#ffffff0d]">
              <div className="relative h-10 w-10 flex-shrink-0 rounded overflow-hidden">
                <Image src={track.cover} alt={track.title} fill className="object-cover" unoptimized />
                {playing && (
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
              <div className="flex-1 min-w-0">
                <div className="truncate text-sm font-medium text-[#1db954]">{track.title}</div>
                <div className="truncate text-xs text-[#a7a7a7]">{track.artist}</div>
              </div>
            </div>
          </div>
          <div className="p-2 border-t border-white/[0.06]">
            <div className="px-2 py-1 text-xs font-bold text-[#a7a7a7] uppercase tracking-wider">
              Proximas
            </div>
            <div className="max-h-64 overflow-y-auto">
              {tracks.slice(currentTrack + 1).map((t, i) => (
                <button
                  key={i}
                  onClick={() => { setCurrentTrack(currentTrack + 1 + i); setShowPlaylist(false) }}
                  className="w-full flex items-center gap-3 p-2 rounded-md hover:bg-[#ffffff0d] transition-colors"
                >
                  <div className="relative h-10 w-10 flex-shrink-0 rounded overflow-hidden">
                    <Image src={t.cover} alt={t.title} fill className="object-cover" unoptimized />
                  </div>
                  <div className="flex-1 min-w-0 text-left">
                    <div className="truncate text-sm font-medium text-white">{t.title}</div>
                    <div className="truncate text-xs text-[#a7a7a7]">{t.artist}</div>
                  </div>
                  <span className="text-xs text-[#a7a7a7] tabular-nums">{formatTime(t.duration)}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
