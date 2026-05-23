"use client"

import Link from "next/link"
import { Trophy, ChevronRight, BarChart3, Home, Star, Zap, Mic } from "lucide-react"
import { TeamCrest } from "@/components/team-crest"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { Team } from "@/lib/teams-data"
import type { MatchState } from "@/lib/match-engine"
import { motion, AnimatePresence } from "framer-motion"

interface MatchResultModalProps {
  open: boolean
  homeTeam: Team
  awayTeam: Team
  state: MatchState
  userSide: "home" | "away"
  isFinal?: boolean
  onClose: () => void
}

export function MatchResultModal({
  open,
  homeTeam,
  awayTeam,
  state,
  userSide,
  isFinal,
  onClose,
}: MatchResultModalProps) {
  if (!open) return null

  const userGoals = userSide === "home" ? state.home.goals : state.away.goals
  const oppGoals = userSide === "home" ? state.away.goals : state.home.goals
  const result: "win" | "draw" | "loss" =
    userGoals > oppGoals ? "win" : userGoals < oppGoals ? "loss" : "draw"

  const userTeam = userSide === "home" ? homeTeam : awayTeam

  const resultConfig = {
    win: {
      label: "VITORIA",
      subtitle: "Parabens pela conquista!",
      color: "#1db954",
      gradient: "from-[#1db954]",
    },
    draw: {
      label: "EMPATE",
      subtitle: "Um ponto conquistado",
      color: "#eab308",
      gradient: "from-yellow-500",
    },
    loss: {
      label: "DERROTA",
      subtitle: "A proxima sera melhor",
      color: "#ef4444",
      gradient: "from-red-500",
    },
  }[result]

  // Calcular rating da partida baseado em estatisticas
  const userStats = userSide === "home" ? state.home : state.away
  const matchRating = Math.min(10, Math.max(5, 
    6 + (userGoals * 0.5) + (userStats.shotsOnTarget * 0.1) + (result === "win" ? 1 : result === "draw" ? 0.3 : -0.5)
  )).toFixed(1)

  return (
    <AnimatePresence>
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-xl p-4"
      >
        {/* Background Effects */}
        <div className="absolute inset-0 overflow-hidden">
          {/* Gradient orbs */}
          <div 
            className="absolute top-1/4 left-1/4 w-[600px] h-[600px] rounded-full blur-[150px] opacity-20"
            style={{ backgroundColor: resultConfig.color }}
          />
          <div 
            className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] rounded-full blur-[120px] opacity-15"
            style={{ backgroundColor: userTeam.cor1 }}
          />
          
          {/* Grid pattern */}
          <div className="absolute inset-0 opacity-[0.03]" style={{
            backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`,
            backgroundSize: '60px 60px'
          }} />
        </div>

        <motion.div 
          initial={{ scale: 0.9, y: 20 }}
          animate={{ scale: 1, y: 0 }}
          transition={{ type: "spring", damping: 20, stiffness: 300 }}
          className="relative w-full max-w-3xl"
        >
          {/* Main Card */}
          <div className="relative rounded-2xl bg-[#0a0a0a]/95 border border-white/10 overflow-hidden shadow-2xl backdrop-blur-sm">
            
            {/* Top accent line */}
            <div 
              className={cn("h-1 w-full bg-gradient-to-r to-transparent", resultConfig.gradient)}
            />

            {/* Hero Section */}
            <div className="relative px-8 pt-10 pb-8">
              {/* Result Badge */}
              <motion.div 
                initial={{ y: -20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.1 }}
                className="text-center mb-8"
              >
                <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/5 border border-white/10 mb-4">
                  <div className="w-2 h-2 rounded-full bg-white/40 animate-pulse" />
                  <span className="text-[10px] font-bold tracking-[0.3em] text-white/50 uppercase">
                    Fim de Jogo
                  </span>
                </div>
                
                <h1 
                  className="text-6xl sm:text-7xl font-black tracking-tight"
                  style={{ 
                    color: resultConfig.color,
                    textShadow: `0 0 80px ${resultConfig.color}40`
                  }}
                >
                  {resultConfig.label}
                </h1>
                <p className="text-sm text-white/40 mt-2">{resultConfig.subtitle}</p>
              </motion.div>

              {/* Teams & Score */}
              <motion.div 
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.2 }}
                className="flex items-center justify-center gap-4 sm:gap-8"
              >
                {/* Home Team */}
                <div className="flex flex-col items-center gap-3 flex-1">
                  <div className="relative">
                    <div 
                      className="absolute inset-0 blur-2xl opacity-30 scale-150"
                      style={{ backgroundColor: homeTeam.cor1 }}
                    />
                    <TeamCrest team={homeTeam} size="xl" />
                    {userSide === "home" && (
                      <div className="absolute -bottom-1 -right-1 px-1.5 py-0.5 rounded bg-[#1db954] text-[8px] font-bold text-black">
                        SEU TIME
                      </div>
                    )}
                  </div>
                  <span className="text-sm font-bold text-white/80 uppercase tracking-wider">
                    {homeTeam.curto}
                  </span>
                </div>

                {/* Score */}
                <div className="flex items-center gap-2 sm:gap-4 px-4 sm:px-8 py-4 rounded-2xl bg-white/5 border border-white/10">
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: 0.3, type: "spring" }}
                    className={cn(
                      "text-5xl sm:text-7xl font-black tabular-nums leading-none",
                      state.home.goals > state.away.goals ? "text-white" : "text-white/30"
                    )}
                  >
                    {state.home.goals}
                  </motion.div>
                  <div className="flex flex-col items-center gap-1">
                    <div className="w-px h-8 bg-white/20" />
                    <span className="text-xs font-light text-white/30">VS</span>
                    <div className="w-px h-8 bg-white/20" />
                  </div>
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: 0.35, type: "spring" }}
                    className={cn(
                      "text-5xl sm:text-7xl font-black tabular-nums leading-none",
                      state.away.goals > state.home.goals ? "text-white" : "text-white/30"
                    )}
                  >
                    {state.away.goals}
                  </motion.div>
                </div>

                {/* Away Team */}
                <div className="flex flex-col items-center gap-3 flex-1">
                  <div className="relative">
                    <div 
                      className="absolute inset-0 blur-2xl opacity-30 scale-150"
                      style={{ backgroundColor: awayTeam.cor1 }}
                    />
                    <TeamCrest team={awayTeam} size="xl" />
                    {userSide === "away" && (
                      <div className="absolute -bottom-1 -right-1 px-1.5 py-0.5 rounded bg-[#1db954] text-[8px] font-bold text-black">
                        SEU TIME
                      </div>
                    )}
                  </div>
                  <span className="text-sm font-bold text-white/80 uppercase tracking-wider">
                    {awayTeam.curto}
                  </span>
                </div>
              </motion.div>

              {/* Match Rating Badge */}
              <motion.div 
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.4 }}
                className="absolute top-6 right-6 flex flex-col items-center"
              >
                <div className="text-[10px] font-bold text-white/40 uppercase tracking-wider mb-1">Nota</div>
                <div 
                  className="w-14 h-14 rounded-xl flex items-center justify-center text-xl font-black"
                  style={{ 
                    backgroundColor: `${resultConfig.color}20`,
                    color: resultConfig.color,
                    border: `2px solid ${resultConfig.color}40`
                  }}
                >
                  {matchRating}
                </div>
              </motion.div>
            </div>

            {/* Stats Section */}
            <motion.div 
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.5 }}
              className="px-6 pb-6"
            >
              <div className="rounded-xl bg-white/[0.03] border border-white/5 overflow-hidden">
                <div className="grid grid-cols-3 gap-px bg-white/5">
                  <StatCard 
                    label="POSSE" 
                    home={`${state.home.possession}%`} 
                    away={`${state.away.possession}%`}
                    homeWin={state.home.possession > state.away.possession}
                  />
                  <StatCard 
                    label="FINALIZACOES" 
                    home={state.home.shots} 
                    away={state.away.shots}
                    homeWin={state.home.shots > state.away.shots}
                  />
                  <StatCard 
                    label="NO ALVO" 
                    home={state.home.shotsOnTarget} 
                    away={state.away.shotsOnTarget}
                    homeWin={state.home.shotsOnTarget > state.away.shotsOnTarget}
                  />
                </div>
                <div className="grid grid-cols-3 gap-px bg-white/5">
                  <StatCard 
                    label="xG" 
                    home={state.home.xG.toFixed(2)} 
                    away={state.away.xG.toFixed(2)}
                    homeWin={state.home.xG > state.away.xG}
                  />
                  <StatCard 
                    label="ESCANTEIOS" 
                    home={state.home.corners} 
                    away={state.away.corners}
                    homeWin={state.home.corners > state.away.corners}
                  />
                  <StatCard 
                    label="FALTAS" 
                    home={state.home.fouls} 
                    away={state.away.fouls}
                    homeWin={state.home.fouls < state.away.fouls}
                  />
                </div>
              </div>
            </motion.div>

            {/* Actions */}
            <motion.div 
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.6 }}
              className="px-6 pb-6 pt-2 flex flex-col sm:flex-row items-center gap-3 justify-center border-t border-white/5"
            >
              {isFinal && result === "win" && (
                <Link href="/campeao" className="w-full sm:w-auto">
                  <Button
                    size="lg"
                    className="w-full sm:w-auto bg-gradient-to-r from-yellow-500 via-amber-400 to-yellow-500 text-black hover:opacity-90 font-bold tracking-wider shadow-lg shadow-yellow-500/20"
                  >
                    <Trophy className="mr-2 h-5 w-5" />
                    CERIMONIA DE CAMPEAO
                    <ChevronRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
              )}
              <Link href="/imprensa" className="w-full sm:w-auto">
                <Button
                  size="lg"
                  className="w-full sm:w-auto bg-gradient-to-r from-[#1db954] to-[#1ed760] text-black hover:opacity-90 font-bold"
                >
                  <Mic className="mr-2 h-4 w-4" />
                  Coletiva de Imprensa
                  <ChevronRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
              <Link href="/" className="w-full sm:w-auto">
                <Button
                  size="lg"
                  className="w-full sm:w-auto bg-white/5 border border-white/10 text-white hover:bg-white/10 font-medium"
                >
                  <Home className="mr-2 h-4 w-4 text-white/60" />
                  Dashboard
                </Button>
              </Link>
              <Button
                size="lg"
                onClick={onClose}
                className="w-full sm:w-auto bg-white/5 border border-white/10 text-white hover:bg-white/10 font-medium"
              >
                <BarChart3 className="mr-2 h-4 w-4 text-white/60" />
                Estatisticas
              </Button>
            </motion.div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}

function StatCard({
  label,
  home,
  away,
  homeWin,
}: {
  label: string
  home: string | number
  away: string | number
  homeWin: boolean
}) {
  return (
    <div className="bg-[#0a0a0a] p-4 flex flex-col">
      <div className="text-[9px] font-bold tracking-wider text-white/30 mb-3 text-center uppercase">
        {label}
      </div>
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <span className={cn(
            "text-lg sm:text-xl font-bold tabular-nums",
            homeWin ? "text-[#1db954]" : "text-white/60"
          )}>
            {home}
          </span>
          {homeWin && <Zap className="h-3 w-3 text-[#1db954]" />}
        </div>
        <div className="flex items-center gap-2">
          {!homeWin && <Zap className="h-3 w-3 text-[#1db954]" />}
          <span className={cn(
            "text-lg sm:text-xl font-bold tabular-nums",
            !homeWin ? "text-[#1db954]" : "text-white/60"
          )}>
            {away}
          </span>
        </div>
      </div>
      {/* Progress bar */}
      <div className="mt-2 h-1 rounded-full bg-white/5 overflow-hidden flex">
        <div 
          className={cn(
            "h-full transition-all",
            homeWin ? "bg-[#1db954]" : "bg-white/20"
          )}
          style={{ width: `${typeof home === 'number' && typeof away === 'number' ? (home / (home + away + 0.01)) * 100 : 50}%` }}
        />
        <div 
          className={cn(
            "h-full transition-all",
            !homeWin ? "bg-[#1db954]" : "bg-white/20"
          )}
          style={{ width: `${typeof home === 'number' && typeof away === 'number' ? (away / (home + away + 0.01)) * 100 : 50}%` }}
        />
      </div>
    </div>
  )
}
