"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { Trophy, Star, Sparkles, Home, ArrowRight, Crown, Medal } from "lucide-react"
import { TeamCrest } from "@/components/team-crest"
import { Button } from "@/components/ui/button"
import { useUserTeam } from "@/lib/save-system"
import { useGameManager, getLeagueName } from "@/lib/use-game-manager"
import { cn } from "@/lib/utils"

// ─────────────────────────────────────────────────────────────────────────────
// Tipos
// ─────────────────────────────────────────────────────────────────────────────

interface PendingChampion {
  competition: string
  season: string
  type: "league" | "cup"
  stats: { won: number; drawn: number; lost: number; goalsFor: number } | null
}

// ─────────────────────────────────────────────────────────────────────────────
// Confete em CSS — sem dependências externas
// ─────────────────────────────────────────────────────────────────────────────

interface Particle {
  id: number
  left: number
  delay: number
  duration: number
  color: string
  size: number
  rotate: number
}

function useConfetti(count = 80): Particle[] {
  return useMemo(() => {
    const colors = ["#1db954", "#fbbf24", "#ef4444", "#3b82f6", "#a855f7", "#fff"]
    return Array.from({ length: count }).map((_, i) => ({
      id: i,
      left: Math.random() * 100,
      delay: Math.random() * 4,
      duration: 4 + Math.random() * 4,
      color: colors[Math.floor(Math.random() * colors.length)],
      size: 4 + Math.random() * 8,
      rotate: Math.random() * 360,
    }))
  }, [count])
}

function Confetti() {
  const particles = useConfetti(120)
  return (
    <div className="pointer-events-none fixed inset-0 z-10 overflow-hidden">
      {particles.map(p => (
        <span
          key={p.id}
          className="absolute top-0 block animate-confetti"
          style={{
            left: `${p.left}%`,
            backgroundColor: p.color,
            width: `${p.size}px`,
            height: `${p.size * 1.6}px`,
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.duration}s`,
            transform: `rotate(${p.rotate}deg)`,
          }}
        />
      ))}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Página
// ─────────────────────────────────────────────────────────────────────────────

export default function CampeaoPage() {
  const { team, hydrated } = useUserTeam()
  const { currentSeason } = useGameManager()
  const router = useRouter()
  const [hover, setHover] = useState(false)

  // Lê dados do campeonato ganho do localStorage e limpa após leitura
  const [champion, setChampion] = useState<PendingChampion | null>(null)
  useEffect(() => {
    const raw = localStorage.getItem("ultrafoot-pending-champion")
    if (raw) {
      try {
        setChampion(JSON.parse(raw))
      } catch {}
      localStorage.removeItem("ultrafoot-pending-champion")
    }
  }, [])

  const seasonLabel = champion?.season ?? `${currentSeason}/${String(currentSeason + 1).slice(-2)}`
  const competitionName = champion?.competition ?? getLeagueName(team.curto)

  const stats = champion?.stats ?? { won: 0, drawn: 0, lost: 0, goalsFor: 0 }

  useEffect(() => {
    document.body.style.background = "#000"
    return () => {
      document.body.style.background = ""
    }
  }, [])

  useEffect(() => {
    const handler = (e: Event) => {
      const btn = (e as CustomEvent).detail?.button
      if (btn === "A" || btn === "B" || btn === "START") router.push("/")
    }
    window.addEventListener("gamepad:button", handler)
    return () => window.removeEventListener("gamepad:button", handler)
  }, [router])

  if (!hydrated) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center text-white/40 text-sm">
        Carregando...
      </div>
    )
  }

  return (
    <div
      className="relative min-h-screen overflow-hidden"
      style={{
        background: `radial-gradient(ellipse at top, ${team.cor1}30 0%, #0a0a0a 50%, #000 100%)`,
      }}
    >
      {/* Confete */}
      <Confetti />

      {/* Holofotes */}
      <div className="pointer-events-none absolute inset-0 z-0">
        <div
          className="absolute top-0 left-1/4 h-[120vh] w-[40vw] -rotate-12 opacity-30 blur-3xl"
          style={{
            background: `linear-gradient(180deg, ${team.cor1}80 0%, transparent 70%)`,
          }}
        />
        <div
          className="absolute top-0 right-1/4 h-[120vh] w-[40vw] rotate-12 opacity-30 blur-3xl"
          style={{
            background: `linear-gradient(180deg, ${team.cor2 === "#ffffff" ? "#fbbf24" : team.cor2}80 0%, transparent 70%)`,
          }}
        />
      </div>

      {/* Padrão diagonal */}
      <div className="pointer-events-none absolute inset-0 z-0 opacity-[0.03]">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage:
              "repeating-linear-gradient(45deg, white 0, white 1px, transparent 0, transparent 50%)",
            backgroundSize: "12px 12px",
          }}
        />
      </div>

      <div className="relative z-20 flex min-h-screen flex-col items-center justify-center px-6 py-12">
        {/* Mensagem de cabeçalho */}
        <div className="mb-6 flex items-center gap-2 text-[11px] font-bold tracking-[0.5em] text-yellow-400 animate-fade-in">
          <Sparkles className="h-3 w-3" />
          TEMPORADA {seasonLabel}
          <Sparkles className="h-3 w-3" />
        </div>

        {/* CAMPEÃO */}
        <h1
          className="text-7xl sm:text-8xl md:text-9xl font-black tracking-tighter text-center leading-none"
          style={{
            backgroundImage: `linear-gradient(180deg, #fbbf24 0%, #f59e0b 40%, #b45309 100%)`,
            WebkitBackgroundClip: "text",
            backgroundClip: "text",
            color: "transparent",
            textShadow: "0 0 80px rgba(251,191,36,0.4)",
          }}
        >
          CAMPEÃO
        </h1>

        {/* Time */}
        <div
          className="mt-12 flex flex-col items-center gap-6 transition-transform duration-500"
          style={{ transform: hover ? "scale(1.02)" : "scale(1)" }}
          onMouseEnter={() => setHover(true)}
          onMouseLeave={() => setHover(false)}
        >
          {/* Crest com glow */}
          <div className="relative">
            <div
              className="absolute inset-0 blur-3xl opacity-50 rounded-full scale-150"
              style={{ background: `radial-gradient(circle, ${team.cor1} 0%, transparent 70%)` }}
            />
            <div className="relative">
              <TeamCrest team={team} size="2xl" />
              {/* Coroa */}
              <div className="absolute -top-8 left-1/2 -translate-x-1/2">
                <Crown className="h-12 w-12 text-yellow-400 drop-shadow-[0_0_12px_rgba(251,191,36,0.6)]" />
              </div>
            </div>
          </div>

          {/* Nome do clube */}
          <div className="text-center">
            <div className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tight text-white">
              {team.nome.toUpperCase()}
            </div>
            <div className="mt-2 text-sm text-white/60 tracking-wider">
              {team.cidade}, {team.estado}
            </div>
          </div>

          {/* Troféu animado */}
          <div className="relative my-4">
            <div className="absolute inset-0 blur-2xl opacity-60 rounded-full" style={{ background: "#fbbf24" }} />
            <Trophy
              className="relative h-32 w-32 sm:h-40 sm:w-40 animate-bounce"
              style={{
                color: "#fbbf24",
                filter: "drop-shadow(0 0 24px rgba(251,191,36,0.8))",
                animationDuration: "2s",
              }}
            />
          </div>

          {/* Conquista */}
          <div className="flex flex-wrap items-center justify-center gap-3 max-w-2xl">
            <div className="flex items-center gap-3 rounded-full border border-yellow-500/30 bg-yellow-500/10 px-5 py-2.5 backdrop-blur-sm">
              <Medal className="h-4 w-4 text-yellow-400" />
              <span className="text-sm font-bold text-white">{competitionName}</span>
              <span className="text-xs text-yellow-400/80 tracking-wider">{seasonLabel}</span>
            </div>
          </div>

          {/* Estatísticas da temporada — só exibe se houver stats reais */}
          {stats.won > 0 || stats.drawn > 0 || stats.lost > 0 || stats.goalsFor > 0 ? (
            <div className="mt-8 grid grid-cols-2 sm:grid-cols-4 gap-3 max-w-3xl w-full">
              <Stat label="VITÓRIAS" value={String(stats.won)} icon={Star} color="#1db954" />
              <Stat label="EMPATES" value={String(stats.drawn)} icon={Star} color="#eab308" />
              <Stat label="DERROTAS" value={String(stats.lost)} icon={Star} color="#ef4444" />
              <Stat label="GOLS" value={String(stats.goalsFor)} icon={Star} color="#3b82f6" />
            </div>
          ) : null}
        </div>

        {/* Mensagem inferior */}
        <div className="mt-12 text-center max-w-2xl">
          <p className="text-base text-white/80 leading-relaxed text-pretty">
            Uma temporada para entrar para a história. Os torcedores do{" "}
            <strong className="text-white">{team.nome}</strong> levarão essa conquista pelo
            resto da vida.
          </p>
        </div>

        {/* Ações */}
        <div className="mt-10 flex flex-col sm:flex-row gap-3">
          <Button
            size="lg"
            onClick={() => router.push("/")}
            className="bg-gradient-to-r from-yellow-500 to-amber-400 text-black hover:opacity-90 font-bold tracking-wider shadow-lg shadow-yellow-500/30"
          >
            <Home className="mr-2 h-5 w-5" />
            CONTINUAR CARREIRA
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </div>

      <style jsx>{`
        @keyframes confetti-fall {
          0% {
            transform: translateY(-20vh) rotate(0deg);
            opacity: 1;
          }
          100% {
            transform: translateY(110vh) rotate(720deg);
            opacity: 0;
          }
        }
        .animate-confetti {
          animation: confetti-fall linear infinite;
        }
        @keyframes fade-in {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in {
          animation: fade-in 0.6s ease-out both;
        }
      `}</style>
    </div>
  )
}

function Stat({
  label,
  value,
  icon: Icon,
  color,
}: {
  label: string
  value: string
  icon: React.ComponentType<{ className?: string }>
  color: string
}) {
  return (
    <div className="rounded-xl bg-white/5 border border-white/10 backdrop-blur-md p-4 text-center">
      <span style={{ color }}><Icon className="mx-auto mb-1.5 h-3.5 w-3.5" /></span>
      <div className="text-3xl font-black tabular-nums text-white">{value}</div>
      <div className="text-[10px] font-bold tracking-[0.2em] text-white/50 mt-1">{label}</div>
    </div>
  )
}
