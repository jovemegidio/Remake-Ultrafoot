"use client"

import {
  Heart,
  ListMusic,
  Maximize2,
  Mic2,
  MonitorSpeaker,
  Pause,
  Play,
  Repeat,
  Shuffle,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
} from "lucide-react"
import { useState, useRef, useEffect } from "react"
import { Slider } from "@/components/ui/slider"
import { cn } from "@/lib/utils"

interface Track {
  id: number
  title: string
  artist: string
  duration: number
  coverGradient: [string, string]
}

const playlist: Track[] = [
  { id: 1, title: "CHAMPIONS ANTHEM", artist: "EA Sports FC", duration: 234, coverGradient: ["#1db954", "#191414"] },
  { id: 2, title: "ULTIMATE TEAM", artist: "Hans Zimmer", duration: 312, coverGradient: ["#e91e63", "#9c27b0"] },
  { id: 3, title: "MATCHDAY VIBES", artist: "The Score", duration: 198, coverGradient: ["#ff5722", "#e91e63"] },
  { id: 4, title: "GLORY NIGHTS", artist: "Two Steps From Hell", duration: 267, coverGradient: ["#2196f3", "#00bcd4"] },
  { id: 5, title: "STADIUM ENERGY", artist: "Imagine Dragons", duration: 245, coverGradient: ["#ffc107", "#ff9800"] },
]

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, "0")}`
}

export function MusicPlayer() {
  const [playing, setPlaying] = useState(false)
  const [progress, setProgress] = useState(45)
  const [volume, setVolume] = useState(70)
  const [muted, setMuted] = useState(false)
  const [liked, setLiked] = useState(false)
  const [shuffle, setShuffle] = useState(false)
  const [repeat, setRepeat] = useState<"off" | "all" | "one">("off")
  const [currentTrack] = useState(0)
  const [expanded, setExpanded] = useState(false)

  const track = playlist[currentTrack]
  const currentTime = (progress / 100) * track.duration

  return (
    <div
      className={cn(
        "fixed z-50 transition-all duration-300 ease-out",
        expanded
          ? "bottom-0 left-16 right-0 h-24"
          : "bottom-4 left-20 right-4 max-w-sm"
      )}
    >
      {/* Compact Spotify-style player */}
      {!expanded && (
        <div
          className="group relative overflow-hidden rounded-lg bg-[#181818] border border-[#282828] shadow-2xl cursor-pointer hover:bg-[#282828] transition-colors"
          onClick={() => setExpanded(true)}
        >
          <div className="flex items-center gap-3 p-2 pr-3">
            {/* Album art */}
            <div
              className="relative h-14 w-14 shrink-0 rounded overflow-hidden"
              style={{
                background: `linear-gradient(135deg, ${track.coverGradient[0]}, ${track.coverGradient[1]})`,
              }}
            >
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-6 h-6 rounded-full bg-black/30 flex items-center justify-center">
                  <div className="w-2 h-2 rounded-full bg-white" />
                </div>
              </div>
              {/* Animated bars */}
              {playing && (
                <div className="absolute bottom-1 right-1 flex items-end gap-0.5 h-3">
                  {[0.6, 1, 0.4, 0.8].map((height, i) => (
                    <div
                      key={i}
                      className="w-0.5 bg-[#1db954] rounded-full animate-pulse"
                      style={{
                        height: `${height * 100}%`,
                        animationDelay: `${i * 0.15}s`,
                        animationDuration: "0.5s",
                      }}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Track info */}
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-sm text-white truncate">
                {track.title}
              </div>
              <div className="text-xs text-[#b3b3b3] truncate">
                {track.artist}
              </div>
              {/* Progress bar mini */}
              <div className="mt-1.5 h-1 bg-[#404040] rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#1db954] rounded-full transition-all"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>

            {/* Controls */}
            <div className="flex items-center gap-1">
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  setLiked(!liked)
                }}
                className={cn(
                  "p-2 rounded-full transition-colors",
                  liked ? "text-[#1db954]" : "text-[#b3b3b3] hover:text-white"
                )}
              >
                <Heart className={cn("h-4 w-4", liked && "fill-current")} />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  setPlaying(!playing)
                }}
                className="p-2 rounded-full bg-white text-black hover:scale-105 transition-transform"
              >
                {playing ? (
                  <Pause className="h-4 w-4" />
                ) : (
                  <Play className="h-4 w-4 translate-x-0.5" />
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Expanded full player bar */}
      {expanded && (
        <div className="h-full bg-gradient-to-b from-[#181818] to-[#121212] border-t border-[#282828] px-4">
          <div className="h-full flex items-center justify-between gap-4">
            {/* Left: Now playing */}
            <div className="flex items-center gap-4 w-[30%] min-w-[180px]">
              <div
                className="relative h-14 w-14 shrink-0 rounded shadow-lg cursor-pointer group"
                onClick={() => setExpanded(false)}
                style={{
                  background: `linear-gradient(135deg, ${track.coverGradient[0]}, ${track.coverGradient[1]})`,
                }}
              >
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-6 h-6 rounded-full bg-black/30 flex items-center justify-center">
                    <div className="w-2 h-2 rounded-full bg-white" />
                  </div>
                </div>
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                  <Maximize2 className="h-4 w-4 text-white" />
                </div>
              </div>
              <div className="min-w-0">
                <div className="font-semibold text-sm text-white truncate hover:underline cursor-pointer">
                  {track.title}
                </div>
                <div className="text-xs text-[#b3b3b3] truncate hover:underline cursor-pointer">
                  {track.artist}
                </div>
              </div>
              <button
                onClick={() => setLiked(!liked)}
                className={cn(
                  "p-1.5 transition-colors",
                  liked ? "text-[#1db954]" : "text-[#b3b3b3] hover:text-white"
                )}
              >
                <Heart className={cn("h-4 w-4", liked && "fill-current")} />
              </button>
            </div>

            {/* Center: Controls + progress */}
            <div className="flex flex-col items-center gap-2 flex-1 max-w-[722px]">
              {/* Playback controls */}
              <div className="flex items-center gap-4">
                <button
                  onClick={() => setShuffle(!shuffle)}
                  className={cn(
                    "p-1 transition-colors",
                    shuffle ? "text-[#1db954]" : "text-[#b3b3b3] hover:text-white"
                  )}
                >
                  <Shuffle className="h-4 w-4" />
                </button>
                <button className="p-1 text-[#b3b3b3] hover:text-white transition-colors">
                  <SkipBack className="h-5 w-5" />
                </button>
                <button
                  onClick={() => setPlaying(!playing)}
                  className="p-2 rounded-full bg-white text-black hover:scale-105 transition-transform"
                >
                  {playing ? (
                    <Pause className="h-5 w-5" />
                  ) : (
                    <Play className="h-5 w-5 translate-x-0.5" />
                  )}
                </button>
                <button className="p-1 text-[#b3b3b3] hover:text-white transition-colors">
                  <SkipForward className="h-5 w-5" />
                </button>
                <button
                  onClick={() => {
                    const modes: ("off" | "all" | "one")[] = ["off", "all", "one"]
                    const idx = modes.indexOf(repeat)
                    setRepeat(modes[(idx + 1) % 3])
                  }}
                  className={cn(
                    "p-1 relative transition-colors",
                    repeat !== "off" ? "text-[#1db954]" : "text-[#b3b3b3] hover:text-white"
                  )}
                >
                  <Repeat className="h-4 w-4" />
                  {repeat === "one" && (
                    <span className="absolute -top-1 -right-1 text-[8px] font-bold text-[#1db954]">
                      1
                    </span>
                  )}
                </button>
              </div>

              {/* Progress bar */}
              <div className="w-full flex items-center gap-2 text-[11px] text-[#a7a7a7]">
                <span className="w-10 text-right tabular-nums">{formatTime(currentTime)}</span>
                <div className="flex-1 group">
                  <Slider
                    value={[progress]}
                    onValueChange={(v) => setProgress(v[0] ?? 0)}
                    max={100}
                    step={0.1}
                    className="cursor-pointer [&_[role=slider]]:h-3 [&_[role=slider]]:w-3 [&_[role=slider]]:opacity-0 group-hover:[&_[role=slider]]:opacity-100 [&_[role=slider]]:transition-opacity [&_[role=slider]]:bg-white [&_[role=slider]]:border-0 [&_.bg-primary]:bg-[#1db954] group-hover:[&_.bg-primary]:bg-[#1db954] [&_.bg-primary]:bg-white [&_.bg-secondary]:bg-[#4d4d4d]"
                  />
                </div>
                <span className="w-10 tabular-nums">{formatTime(track.duration)}</span>
              </div>
            </div>

            {/* Right: Volume + extras */}
            <div className="flex items-center justify-end gap-3 w-[30%] min-w-[180px]">
              <button className="p-1 text-[#b3b3b3] hover:text-white transition-colors">
                <Mic2 className="h-4 w-4" />
              </button>
              <button className="p-1 text-[#b3b3b3] hover:text-white transition-colors">
                <ListMusic className="h-4 w-4" />
              </button>
              <button className="p-1 text-[#b3b3b3] hover:text-white transition-colors">
                <MonitorSpeaker className="h-4 w-4" />
              </button>
              <div className="flex items-center gap-1 w-32">
                <button
                  onClick={() => setMuted(!muted)}
                  className="p-1 text-[#b3b3b3] hover:text-white transition-colors"
                >
                  {muted || volume === 0 ? (
                    <VolumeX className="h-4 w-4" />
                  ) : (
                    <Volume2 className="h-4 w-4" />
                  )}
                </button>
                <Slider
                  value={[muted ? 0 : volume]}
                  onValueChange={(v) => {
                    setVolume(v[0] ?? 0)
                    if (muted) setMuted(false)
                  }}
                  max={100}
                  step={1}
                  className="flex-1 cursor-pointer [&_[role=slider]]:h-3 [&_[role=slider]]:w-3 [&_[role=slider]]:bg-white [&_[role=slider]]:border-0 [&_.bg-primary]:bg-white [&_.bg-secondary]:bg-[#4d4d4d] hover:[&_.bg-primary]:bg-[#1db954]"
                />
              </div>
              <button
                onClick={() => setExpanded(false)}
                className="p-1 text-[#b3b3b3] hover:text-white transition-colors"
              >
                <Maximize2 className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default MusicPlayer
