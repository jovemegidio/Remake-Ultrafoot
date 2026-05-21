"use client"

import { useState, useCallback, useEffect } from "react"
import { ChevronLeft, ChevronRight, Play, Calendar, MapPin, Clock } from "lucide-react"
import { TeamCrest } from "@/components/team-crest"
import { CarouselDots, useGamepadConnected } from "@/components/controller-buttons"
import { cn } from "@/lib/utils"
import type { Team } from "@/lib/teams-data"
import type { GamepadButtonName } from "@/hooks/use-gamepad"

interface Match {
  home: Team
  away: Team
  date: string
  time: string
  competition: string
  matchday?: number
  stadium?: string
}

interface MatchCarouselProps {
  matches: Match[]
  userTeam: Team
  className?: string
}

export function MatchCarousel({ matches, userTeam, className }: MatchCarouselProps) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [direction, setDirection] = useState<"left" | "right" | null>(null)
  const [isAnimating, setIsAnimating] = useState(false)

  // Filter out matches with undefined teams
  const validMatches = matches.filter(m => m.home && m.away)
  
  if (validMatches.length === 0) {
    return (
      <section className={cn("rounded-xl bg-[#141414] border border-white/5 p-6", className)}>
        <div className="text-center text-white/40">Nenhuma partida disponivel</div>
      </section>
    )
  }

  const currentMatch = validMatches[currentIndex % validMatches.length]

  const navigate = useCallback((newDirection: "left" | "right") => {
    if (isAnimating) return

    const newIndex = newDirection === "right" 
      ? (currentIndex + 1) % validMatches.length
      : (currentIndex - 1 + validMatches.length) % validMatches.length

    setDirection(newDirection)
    setIsAnimating(true)

    setTimeout(() => {
      setCurrentIndex(newIndex)
      setIsAnimating(false)
    }, 300)
  }, [currentIndex, validMatches.length, isAnimating])

  const goToNext = useCallback(() => navigate("right"), [navigate])
  const goToPrev = useCallback(() => navigate("left"), [navigate])

  // Listen for gamepad actions (LB/RB for navigation)
  useEffect(() => {
    const handleGamepadAction = (e: CustomEvent<{ action: string }>) => {
      const action = e.detail.action
      if (action === "LB") {
        goToPrev()
      } else if (action === "RB") {
        goToNext()
      }
    }

    window.addEventListener("gamepad:action", handleGamepadAction as EventListener)
    return () => {
      window.removeEventListener("gamepad:action", handleGamepadAction as EventListener)
    }
  }, [goToPrev, goToNext])

  const getDayName = (dateStr: string) => {
    const days = ["DOMINGO", "SEGUNDA", "TERCA", "QUARTA", "QUINTA", "SEXTA", "SABADO"]
    const months = ["JAN", "FEV", "MAR", "ABR", "MAI", "JUN", "JUL", "AGO", "SET", "OUT", "NOV", "DEZ"]
    
    // Parse date like "Jan 15" -> day and month
    const parts = dateStr.split(" ")
    const monthIndex = months.findIndex(m => parts[0].toUpperCase().startsWith(m))
    const day = parseInt(parts[1])
    
    // For demo, return a random weekday based on day number
    return days[day % 7]
  }

  const formatDateDisplay = (dateStr: string) => {
    const parts = dateStr.split(" ")
    return {
      day: parts[1] || "15",
      month: parts[0] || "Jan"
    }
  }

  const dateDisplay = formatDateDisplay(currentMatch.date)

  return (
    <section className={cn("rounded-xl bg-[#141414] border border-white/5 overflow-hidden", className)}>
      {/* Header with date navigation - FIFA style */}
      <div className="relative bg-gradient-to-r from-[#1a1a1a] to-[#141414] border-b border-white/5">
        {/* Navigation arrows */}
        <button
          onClick={goToPrev}
          disabled={isAnimating}
          className="absolute left-3 top-1/2 -translate-y-1/2 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-white/5 text-white/60 hover:bg-white/10 hover:text-white transition-all disabled:opacity-50"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>

        <button
          onClick={goToNext}
          disabled={isAnimating}
          className="absolute right-3 top-1/2 -translate-y-1/2 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-white/5 text-white/60 hover:bg-white/10 hover:text-white transition-all disabled:opacity-50"
        >
          <ChevronRight className="h-5 w-5" />
        </button>

        {/* Date display with animation */}
        <div className="relative overflow-hidden py-4 px-16">
          <div
            className={cn(
              "flex flex-col items-center transition-all duration-300 ease-out",
              isAnimating && direction === "right" && "animate-slide-out-left",
              isAnimating && direction === "left" && "animate-slide-out-right",
              !isAnimating && "animate-slide-in"
            )}
          >
            <div className="flex items-center gap-2 text-[#1db954] text-sm font-bold tracking-wider">
              <Calendar className="h-4 w-4" />
              {getDayName(currentMatch.date)}, {dateDisplay.month.toUpperCase()} {dateDisplay.day}
            </div>
            <div className="flex items-center gap-3 mt-1">
              <span className="text-[10px] text-white/40 uppercase tracking-wider">
                Rodada {currentMatch.matchday || currentIndex + 1}
              </span>
              <span className="w-1 h-1 rounded-full bg-white/20" />
              <span className="text-[10px] text-white/40 uppercase tracking-wider">
                {currentMatch.competition}
              </span>
            </div>
          </div>
        </div>

        {/* Match indicators - FIFA style with controller buttons (auto-detect gamepad) */}
        <div className="flex justify-center pb-3">
          <CarouselDots 
            total={validMatches.length}
            current={currentIndex}
            onSelect={(i) => {
              if (i !== currentIndex && !isAnimating) {
                setDirection(i > currentIndex ? "right" : "left")
                setIsAnimating(true)
                setTimeout(() => {
                  setCurrentIndex(i)
                  setIsAnimating(false)
                }, 300)
              }
            }}
          />
        </div>
      </div>

      {/* Match content with slide animation */}
      <div className="relative overflow-hidden">
        <div
          className={cn(
            "p-6 transition-all duration-300 ease-out",
            isAnimating && direction === "right" && "animate-slide-out-left",
            isAnimating && direction === "left" && "animate-slide-out-right",
            !isAnimating && "animate-slide-in"
          )}
        >
          {/* Competition badge */}
          <div className="flex justify-center mb-4">
            <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10">
              <span className="text-[10px] font-medium text-white/60 uppercase tracking-wider">
                {currentMatch.competition}
              </span>
              <span className="text-[10px] text-[#1db954] font-semibold">
                Hoje
              </span>
            </div>
          </div>

          {/* Teams matchup */}
          <div className="flex items-center justify-between">
            {/* Home team */}
            <div className="flex flex-col items-center gap-3 flex-1">
              <div className="relative">
                {currentMatch.home && <TeamCrest team={currentMatch.home} size="2xl" />}
                {currentMatch.home?.curto === userTeam?.curto && (
                  <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-[#1db954] flex items-center justify-center">
                    <span className="text-[8px] font-bold text-black">YOU</span>
                  </div>
                )}
              </div>
              <div className="text-center">
                <div className="text-lg font-bold text-white tracking-wide">
                  {currentMatch.home?.curto || "TBD"}
                </div>
                <div className="text-[10px] text-white/40 uppercase tracking-wider mt-0.5">
                  {currentMatch.home?.curto === userTeam?.curto ? "Seu time" : "Casa"}
                </div>
              </div>
            </div>

            {/* VS divider */}
            <div className="flex flex-col items-center px-6">
              <div className="text-3xl font-black text-white/10 tracking-tighter">VS</div>
              <div className="flex items-center gap-2 mt-2 text-white/60">
                <Clock className="h-3 w-3" />
                <span className="text-sm font-medium">{currentMatch.time}</span>
              </div>
            </div>

            {/* Away team */}
            <div className="flex flex-col items-center gap-3 flex-1">
              <div className="relative">
                {currentMatch.away && <TeamCrest team={currentMatch.away} size="2xl" />}
                {currentMatch.away?.curto === userTeam?.curto && (
                  <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-[#1db954] flex items-center justify-center">
                    <span className="text-[8px] font-bold text-black">YOU</span>
                  </div>
                )}
              </div>
              <div className="text-center">
                <div className="text-lg font-bold text-white tracking-wide">
                  {currentMatch.away?.curto || "TBD"}
                </div>
                <div className="text-[10px] text-white/40 uppercase tracking-wider mt-0.5">
                  {currentMatch.away?.curto === userTeam?.curto ? "Seu time" : "Visitante"}
                </div>
              </div>
            </div>
          </div>

          {/* Stadium info */}
          {currentMatch.stadium && (
            <div className="flex items-center justify-center gap-2 mt-4 text-white/40">
              <MapPin className="h-3 w-3" />
              <span className="text-xs">{currentMatch.stadium}</span>
            </div>
          )}
        </div>
      </div>

      {/* Action buttons - sem icones de controle (aparecem na barra inferior) */}
      <div className="flex items-center gap-2 p-4 pt-0">
        <button className="flex-1 flex items-center justify-center gap-2 py-3 rounded-lg bg-[#1db954] text-black text-sm font-bold hover:bg-[#1ed760] transition-all hover:scale-[1.02] active:scale-[0.98]">
          <Play className="h-4 w-4" />
          <span>Jogar Partida</span>
        </button>
        <button className="flex-1 flex items-center justify-center gap-2 py-3 rounded-lg bg-white/5 text-white/70 text-sm font-medium hover:bg-white/10 transition-colors">
          <Calendar className="h-4 w-4" />
          <span>Simular</span>
        </button>
      </div>
    </section>
  )
}
