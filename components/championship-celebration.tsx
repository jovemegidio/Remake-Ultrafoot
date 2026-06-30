"use client"

import { useState, useEffect, useContext } from "react"
import { Trophy, Star, Sparkles, Medal, PartyPopper, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { TeamCrest } from "@/components/team-crest"
import { ControllerButton, ControllerToolbar, ControllerTypeContext } from "@/components/controller-buttons"
import { cn } from "@/lib/utils"
import { type Team } from "@/lib/teams-data"
import { getCompetitionTheme, type CompetitionId } from "@/lib/competition-themes"

interface ChampionshipCelebrationProps {
  team: Team
  competition: CompetitionId
  season: string
  finalScore?: { home: number; away: number }
  opponent?: Team
  stats?: {
    wins: number
    draws: number
    losses: number
    goalsScored: number
    goalsConceded: number
    topScorer?: { name: string; goals: number }
    topAssists?: { name: string; assists: number }
  }
  onClose: () => void
}

export function ChampionshipCelebration({
  team,
  competition,
  season,
  finalScore,
  opponent,
  stats,
  onClose,
}: ChampionshipCelebrationProps) {
  const controllerType = useContext(ControllerTypeContext)
  const theme = getCompetitionTheme(competition)
  const [showConfetti, setShowConfetti] = useState(true)
  const [animationStage, setAnimationStage] = useState(0)

  // Animation stages
  useEffect(() => {
    const timers = [
      setTimeout(() => setAnimationStage(1), 500),
      setTimeout(() => setAnimationStage(2), 1200),
      setTimeout(() => setAnimationStage(3), 2000),
      setTimeout(() => setAnimationStage(4), 3000),
    ]
    return () => timers.forEach(t => clearTimeout(t))
  }, [])

  // Generate confetti particles
  const confettiParticles = Array.from({ length: 60 }).map((_, i) => ({
    id: i,
    x: Math.random() * 100,
    delay: Math.random() * 3,
    duration: 3 + Math.random() * 2,
    color: i % 5 === 0 ? theme.colors.primary : i % 3 === 0 ? theme.colors.secondary : i % 2 === 0 ? "#ffd700" : "#ffffff",
    size: 4 + Math.random() * 8,
    rotation: Math.random() * 360,
  }))

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden"
      style={{ background: theme.colors.background }}
    >
      {/* Animated background glow */}
      <div 
        className="absolute inset-0 opacity-30"
        style={{
          background: `radial-gradient(circle at 50% 30%, ${theme.colors.primary} 0%, transparent 70%)`,
        }}
      />

      {/* Confetti */}
      {showConfetti && (
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          {confettiParticles.map((particle) => (
            <div
              key={particle.id}
              className="absolute top-0 animate-confetti"
              style={{
                left: `${particle.x}%`,
                animationDelay: `${particle.delay}s`,
                animationDuration: `${particle.duration}s`,
              }}
            >
              <div
                className="rounded-sm"
                style={{
                  width: particle.size,
                  height: particle.size,
                  backgroundColor: particle.color,
                  transform: `rotate(${particle.rotation}deg)`,
                }}
              />
            </div>
          ))}
        </div>
      )}

      {/* Sparkle effects */}
      <div className="absolute inset-0 pointer-events-none">
        {Array.from({ length: 20 }).map((_, i) => (
          <Sparkles
            key={i}
            className="absolute animate-pulse text-yellow-400/50"
            style={{
              top: `${Math.random() * 100}%`,
              left: `${Math.random() * 100}%`,
              animationDelay: `${Math.random() * 2}s`,
              width: 12 + Math.random() * 12,
              height: 12 + Math.random() * 12,
            }}
          />
        ))}
      </div>

      {/* Main content */}
      <div className="relative z-10 flex flex-col items-center max-w-4xl mx-auto px-6">
        {/* Trophy animation */}
        <div className={cn(
          "relative mb-8 transition-all duration-1000",
          animationStage >= 1 ? "opacity-100 scale-100" : "opacity-0 scale-50"
        )}>
          <div 
            className="relative p-8 rounded-full"
            style={{
              background: `radial-gradient(circle, ${theme.colors.primary}40 0%, transparent 70%)`,
            }}
          >
            <Trophy 
              className="h-32 w-32 text-yellow-400 drop-shadow-2xl animate-bounce"
              style={{ animationDuration: "2s" }}
            />
            <div className="absolute inset-0 flex items-center justify-center">
              <div 
                className="absolute w-48 h-48 rounded-full animate-ping opacity-20"
                style={{ backgroundColor: theme.colors.primary }}
              />
            </div>
          </div>
        </div>

        {/* Title */}
        <div className={cn(
          "text-center mb-8 transition-all duration-700",
          animationStage >= 2 ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
        )}>
          <div 
            className="text-sm font-bold uppercase tracking-[0.3em] mb-2"
            style={{ color: theme.colors.textSecondary }}
          >
            {theme.shortName} {season}
          </div>
          <h1 className="text-5xl md:text-7xl font-black text-white mb-4 drop-shadow-lg">
            CAMPEAO!
          </h1>
          <div 
            className="inline-flex items-center gap-3 px-6 py-2 rounded-full border"
            style={{ 
              backgroundColor: `${theme.colors.primary}20`,
              borderColor: `${theme.colors.primary}40`,
            }}
          >
            <Star className="h-5 w-5 text-yellow-400 fill-yellow-400" />
            <span className="text-lg font-bold text-white">{theme.name}</span>
            <Star className="h-5 w-5 text-yellow-400 fill-yellow-400" />
          </div>
        </div>

        {/* Team display */}
        <div className={cn(
          "flex items-center gap-6 mb-8 transition-all duration-700",
          animationStage >= 2 ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
        )}>
          <TeamCrest team={team} size="xl" />
          <div>
            <div className="text-3xl font-black text-white">{team.nome}</div>
            <div className="text-sm text-white/60">{team.cidade}, {team.estado}</div>
          </div>
        </div>

        {/* Final score (if provided) */}
        {finalScore && opponent && (
          <div className={cn(
            "bg-black/40 backdrop-blur-sm rounded-2xl p-6 mb-8 border border-white/10 transition-all duration-700",
            animationStage >= 3 ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
          )}>
            <div className="text-[10px] text-white/40 uppercase tracking-wider text-center mb-4">
              Final
            </div>
            <div className="flex items-center gap-8">
              <div className="flex items-center gap-4">
                <TeamCrest team={team} size="lg" />
                <span className="text-lg font-bold text-white">{team.curto}</span>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-5xl font-black text-white">{finalScore.home}</span>
                <span className="text-2xl text-white/30">-</span>
                <span className="text-5xl font-black text-white">{finalScore.away}</span>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-lg font-bold text-white">{opponent.curto}</span>
                <TeamCrest team={opponent} size="lg" />
              </div>
            </div>
          </div>
        )}

        {/* Stats */}
        {stats && (
          <div className={cn(
            "grid grid-cols-2 md:grid-cols-4 gap-4 mb-8 w-full max-w-2xl transition-all duration-700",
            animationStage >= 3 ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
          )}>
            <div className="bg-white/5 rounded-xl p-4 text-center border border-white/10">
              <div className="text-3xl font-black text-[#00ffc8]">{stats.wins}</div>
              <div className="text-xs text-white/50">Vitorias</div>
            </div>
            <div className="bg-white/5 rounded-xl p-4 text-center border border-white/10">
              <div className="text-3xl font-black text-white/60">{stats.draws}</div>
              <div className="text-xs text-white/50">Empates</div>
            </div>
            <div className="bg-white/5 rounded-xl p-4 text-center border border-white/10">
              <div className="text-3xl font-black text-red-400">{stats.losses}</div>
              <div className="text-xs text-white/50">Derrotas</div>
            </div>
            <div className="bg-white/5 rounded-xl p-4 text-center border border-white/10">
              <div className="text-3xl font-black text-white">
                {stats.goalsScored}:{stats.goalsConceded}
              </div>
              <div className="text-xs text-white/50">Saldo de Gols</div>
            </div>
          </div>
        )}

        {/* Top performers */}
        {stats?.topScorer && stats?.topAssists && (
          <div className={cn(
            "flex gap-6 mb-8 transition-all duration-700",
            animationStage >= 4 ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
          )}>
            <div className="bg-gradient-to-br from-yellow-500/20 to-yellow-600/10 rounded-xl p-4 border border-[#ffd700]/30 flex items-center gap-4">
              <Medal className="h-8 w-8 text-yellow-400" />
              <div>
                <div className="text-[10px] text-yellow-400/60 uppercase tracking-wider">Artilheiro</div>
                <div className="text-sm font-bold text-white">{stats.topScorer.name}</div>
                <div className="text-lg font-black text-yellow-400">{stats.topScorer.goals} gols</div>
              </div>
            </div>
            <div className="bg-gradient-to-br from-blue-500/20 to-blue-600/10 rounded-xl p-4 border border-blue-500/30 flex items-center gap-4">
              <PartyPopper className="h-8 w-8 text-blue-400" />
              <div>
                <div className="text-[10px] text-blue-400/60 uppercase tracking-wider">Garcom</div>
                <div className="text-sm font-bold text-white">{stats.topAssists.name}</div>
                <div className="text-lg font-black text-blue-400">{stats.topAssists.assists} assists</div>
              </div>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className={cn(
          "flex gap-4 transition-all duration-700",
          animationStage >= 4 ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
        )}>
          <Button
            variant="outline"
            onClick={() => setShowConfetti(!showConfetti)}
            className="border-white/20 bg-transparent text-white hover:bg-white/10"
          >
            {showConfetti ? "Parar Confetes" : "Confetes!"}
          </Button>
          <Button
            onClick={onClose}
            className="px-8 font-bold"
            style={{ 
              backgroundColor: theme.colors.primary,
              color: theme.colors.primary === "#ffd700" || theme.colors.primary === "#c0c0c0" ? "#000" : "#fff"
            }}
          >
            Continuar
          </Button>
        </div>
      </div>

      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute top-6 right-6 p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white/60 hover:text-white transition"
      >
        <X className="h-6 w-6" />
      </button>

      {/* Controller toolbar */}
      <div className="absolute bottom-0 left-0 right-0">
        <ControllerToolbar
          visible={true}
          controller={controllerType}
          actions={[
            { button: "A", label: "Continuar" },
            { button: "B", label: "Fechar" },
            { button: "Y", label: "Compartilhar" },
          ]}
          className="bg-black/40 backdrop-blur-sm border-t border-white/10"
        />
      </div>

      {/* Confetti animation styles */}
      <style jsx global>{`
        @keyframes confetti {
          0% {
            transform: translateY(-10vh) rotate(0deg);
            opacity: 1;
          }
          100% {
            transform: translateY(110vh) rotate(720deg);
            opacity: 0;
          }
        }
        .animate-confetti {
          animation: confetti linear infinite;
        }
      `}</style>
    </div>
  )
}
