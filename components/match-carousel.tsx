"use client"

import { useState, useCallback, useEffect } from "react"
import { ChevronLeft, ChevronRight, Play, Monitor, Calendar, MapPin, Clock } from "lucide-react"
import { TeamCrest } from "@/components/team-crest"
import { CarouselDots } from "@/components/controller-buttons"
import { cn } from "@/lib/utils"
import type { Team } from "@/lib/teams-data"
import Link from "next/link"

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
  const currentMatch = validMatches.length > 0 ? validMatches[currentIndex % validMatches.length] : null

  const navigate = useCallback((newDirection: "left" | "right") => {
    if (isAnimating || validMatches.length === 0) return

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

  if (!currentMatch) {
    return (
      <section className={cn("rounded-xl bg-[#0c0c10] border border-white/[0.04] p-6", className)}>
        <div className="text-center text-white/40">Nenhuma partida disponivel</div>
      </section>
    )
  }

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
    <section className={cn("rounded-xl bg-[#0c0c10] border border-white/[0.04] overflow-hidden", className)}>
      {/* Header with date navigation - FIFA style - compact */}
      <div className="relative bg-gradient-to-r from-[#1a1a1a] to-[#141414] border-b border-white/[0.04]">
        {/* Navigation arrows */}
        <button
          onClick={goToPrev}
          disabled={isAnimating}
          className="absolute left-2 top-1/2 -translate-y-1/2 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-white/5 text-white/60 hover:bg-white/10 hover:text-white transition-all disabled:opacity-50"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>

        <button
          onClick={goToNext}
          disabled={isAnimating}
          className="absolute right-2 top-1/2 -translate-y-1/2 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-white/5 text-white/60 hover:bg-white/10 hover:text-white transition-all disabled:opacity-50"
        >
          <ChevronRight className="h-4 w-4" />
        </button>

        {/* Date display with animation */}
        <div className="relative overflow-hidden py-3 px-14">
          <div
            className={cn(
              "flex flex-col items-center transition-all duration-300 ease-out",
              isAnimating && direction === "right" && "animate-slide-out-left",
              isAnimating && direction === "left" && "animate-slide-out-right",
              !isAnimating && "animate-slide-in"
            )}
          >
            <div className="flex items-center gap-2 text-[#00ffc8] text-xs font-bold tracking-wider">
              <Calendar className="h-3.5 w-3.5" />
              {getDayName(currentMatch.date)}, RODADA {currentMatch.matchday || currentIndex + 1}
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-[10px] text-white/40 uppercase tracking-wider">
                {currentMatch.competition}
              </span>
            </div>
          </div>
        </div>

        {/* Match indicators */}
        <div className="flex justify-center pb-2">
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
            "px-4 py-3 transition-all duration-300 ease-out",
            isAnimating && direction === "right" && "animate-slide-out-left",
            isAnimating && direction === "left" && "animate-slide-out-right",
            !isAnimating && "animate-slide-in"
          )}
        >
          {/* Competition badge */}
          <div className="flex justify-center mb-2">
            <div className="flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-white/5 border border-white/10">
              <span className="text-[10px] font-medium text-white/60 uppercase tracking-wider">
                {currentMatch.competition}
              </span>
              <span className="text-[10px] text-[#00ffc8] font-semibold">
                Hoje
              </span>
            </div>
          </div>

          {/* Teams matchup - inline compact */}
          <div className="flex items-center justify-center gap-6">
            {/* Home team */}
            <div className="flex flex-col items-center gap-2">
              <div className="relative">
                {currentMatch.home && <TeamCrest team={currentMatch.home} size="xl" />}
                {currentMatch.home?.curto === userTeam?.curto && (
                  <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-[#00ffc8] flex items-center justify-center">
                    <span className="text-[7px] font-bold text-black">YOU</span>
                  </div>
                )}
              </div>
              <div className="text-center">
                <div className="text-sm font-bold text-white tracking-wide max-w-[120px] truncate">
                  {currentMatch.home?.nome || "A definir"}
                </div>
                <div className="text-[9px] text-white/40 uppercase tracking-wider">
                  {currentMatch.home?.curto === userTeam?.curto ? "Seu time" : "Mandante"}
                </div>
              </div>
            </div>

            {/* VS divider */}
            <div className="flex flex-col items-center px-2">
              <div className="text-2xl font-black text-white/15 tracking-tighter">VS</div>
            </div>

            {/* Away team */}
            <div className="flex flex-col items-center gap-2">
              <div className="relative">
                {currentMatch.away && <TeamCrest team={currentMatch.away} size="xl" />}
                {currentMatch.away?.curto === userTeam?.curto && (
                  <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-[#00ffc8] flex items-center justify-center">
                    <span className="text-[7px] font-bold text-black">YOU</span>
                  </div>
                )}
              </div>
              <div className="text-center">
                <div className="text-sm font-bold text-white tracking-wide max-w-[120px] truncate">
                  {currentMatch.away?.nome || "A definir"}
                </div>
                <div className="text-[9px] text-white/40 uppercase tracking-wider">
                  {currentMatch.away?.curto === userTeam?.curto ? "Seu time" : "Visitante"}
                </div>
              </div>
            </div>
          </div>

          {/* Stadium info */}
          {currentMatch.stadium && (
            <div className="flex items-center justify-center gap-1.5 mt-2 text-white/40">
              <MapPin className="h-2.5 w-2.5" />
              <span className="text-[10px]">{currentMatch.stadium}</span>
            </div>
          )}
        </div>
      </div>

      {/* Action buttons - EA FC style */}
      <div className="flex items-center gap-3 px-4 pb-4">
        <Link 
          href="/partida" 
          className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-lg bg-gradient-to-r from-[#00ffc8] to-[#00c8ff] text-black text-sm font-bold hover:from-[#33ffd4] hover:to-[#33d4ff] transition-all hover:scale-[1.02] active:scale-[0.98] shadow-[0_0_20px_rgba(0,255,200,0.3)]"
        >
          <Play className="h-4 w-4 fill-current" />
          <span>Jogar Partida</span>
        </Link>
        <Link 
          href="/partida/ao-vivo?simulate=true" 
          className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-lg border-2 border-white/20 bg-white/5 text-white text-sm font-medium hover:border-[#00ffc8]/50 hover:bg-white/10 hover:text-[#00ffc8] transition-all hover:scale-[1.02] active:scale-[0.98]"
        >
          <Monitor className="h-4 w-4" />
          <span>Simular</span>
        </Link>
      </div>
    </section>
  )
}
