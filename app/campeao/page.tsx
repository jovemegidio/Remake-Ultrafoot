"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { Trophy, Star, Home, ArrowRight, Crown, Medal } from "lucide-react"
import { TeamCrest } from "@/components/team-crest"
import { Cutscene } from "@/components/cutscene"
import { Button } from "@/components/ui/button"
import { useUserTeam, useGameState } from "@/lib/save-system"
import { useRequireTeam } from "@/lib/use-require-team"
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
    const colors = ["#00ffc8", "#fbbf24", "#ef4444", "#3b82f6", "#a855f7", "#fff"]
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
  useRequireTeam()
  const { team, hydrated } = useUserTeam()
  const { currentSeason } = useGameManager()
  const { state: gameState } = useGameState()
  const managerName = gameState.managerName || "Técnico"
  const router = useRouter()
  const [hover, setHover] = useState(false)
  const [cutsceneDone, setCutsceneDone] = useState(false)

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
      <div className="min-h-screen bg-[#050508] flex items-center justify-center text-white/40 text-sm">
        Carregando...
      </div>
    )
  }

  // Cutscene de titulo antes da tela de campeao
  if (!cutsceneDone) {
    return <Cutscene src="/cutscenes/champion.mp4" onComplete={() => setCutsceneDone(true)} />
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

      {/* Raios de luz atrás do troféu (godrays) — toque de transmissão. */}
      <div className="pointer-events-none absolute inset-0 z-0 flex items-start justify-center">
        <div
          className="mt-[-10vh] h-[130vh] w-[70vw] opacity-25"
          style={{
            background: "conic-gradient(from 180deg at 50% 0%, transparent 0deg, rgba(251,191,36,0.14) 12deg, transparent 24deg, transparent 40deg, rgba(251,191,36,0.1) 55deg, transparent 70deg, transparent 300deg, rgba(251,191,36,0.1) 315deg, transparent 330deg, transparent 348deg, rgba(251,191,36,0.14) 355deg, transparent 360deg)",
          }}
        />
      </div>

      <div className="relative z-20 flex min-h-screen flex-col items-center justify-center px-6 py-12">
        {/* Selo superior — competição + temporada, com régua dourada (broadcast). */}
        <div className="mb-8 flex flex-col items-center gap-3 animate-fade-in">
          <div className="flex items-center gap-4">
            <span className="h-px w-10 bg-gradient-to-r from-transparent to-yellow-400/70" />
            <span className="text-[11px] font-black uppercase tracking-[0.42em] text-yellow-400/90">Campeões · Temporada {seasonLabel}</span>
            <span className="h-px w-10 bg-gradient-to-l from-transparent to-yellow-400/70" />
          </div>
        </div>

        {/* CAMPEÃO + competição */}
        <h1
          className="text-6xl sm:text-8xl md:text-9xl font-black tracking-tighter text-center leading-[0.9]"
          style={{
            backgroundImage: "linear-gradient(180deg, #fff8dc 0%, #fbbf24 38%, #f59e0b 68%, #a55a09 100%)",
            WebkitBackgroundClip: "text",
            backgroundClip: "text",
            color: "transparent",
            textShadow: "0 0 90px rgba(251,191,36,0.35)",
          }}
        >
          CAMPEÃO
        </h1>
        <div className="mt-3 flex items-center gap-3 text-center">
          <Medal className="h-4 w-4 text-yellow-400" />
          <span className="text-sm sm:text-base font-bold uppercase tracking-[0.2em] text-white/85">{competitionName}</span>
        </div>

        {/* Palco: troféu majestoso sobre pedestal com reflexo. */}
        <div
          className="mt-10 flex flex-col items-center transition-transform duration-500"
          style={{ transform: hover ? "scale(1.015)" : "scale(1)" }}
          onMouseEnter={() => setHover(true)}
          onMouseLeave={() => setHover(false)}
        >
          <div className="relative">
            {/* Halo do troféu */}
            <div className="absolute left-1/2 top-1/2 h-64 w-64 -translate-x-1/2 -translate-y-1/2 rounded-full opacity-60 blur-3xl" style={{ background: "radial-gradient(circle, rgba(251,191,36,0.55) 0%, transparent 70%)" }} />
            <Trophy
              className="relative h-36 w-36 sm:h-44 sm:w-44 animate-champ-glow"
              style={{ color: "#fbbf24", filter: "drop-shadow(0 12px 30px rgba(251,191,36,0.55))" }}
            />
            {/* Reflexo do troféu no pedestal */}
            <Trophy
              aria-hidden
              className="absolute left-1/2 top-full h-36 w-36 sm:h-44 sm:w-44 -translate-x-1/2 scale-y-[-1] opacity-15 blur-[2px]"
              style={{ color: "#fbbf24", maskImage: "linear-gradient(to bottom, black, transparent 70%)", WebkitMaskImage: "linear-gradient(to bottom, black, transparent 70%)" }}
            />
          </div>
          {/* Pedestal */}
          <div className="mt-2 h-2 w-56 rounded-full bg-gradient-to-r from-transparent via-yellow-400/50 to-transparent" />
          <div className="mt-1 h-px w-72 bg-gradient-to-r from-transparent via-white/15 to-transparent" />

          {/* Clube: crest coroado + nome */}
          <div className="mt-8 flex flex-col items-center gap-3">
            <div className="relative">
              <div className="absolute inset-0 scale-150 rounded-full opacity-45 blur-3xl" style={{ background: `radial-gradient(circle, ${team.cor1} 0%, transparent 70%)` }} />
              <div className="relative">
                <TeamCrest team={team} size="xl" />
                <Crown className="absolute -top-7 left-1/2 h-10 w-10 -translate-x-1/2 text-yellow-400 drop-shadow-[0_0_12px_rgba(251,191,36,0.7)]" />
              </div>
            </div>
            <div className="text-center">
              <div className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tight text-white">{team.nome.toUpperCase()}</div>
              <div className="mt-1.5 text-xs uppercase tracking-[0.25em] text-white/45">
                {[team.cidade, team.estado].filter(Boolean).join(" · ")}
              </div>
              <div className="mt-2 text-sm text-yellow-400/80">Sob o comando de <span className="font-semibold text-white/90">{managerName}</span></div>
            </div>
          </div>

          {/* Painel de estatísticas (broadcast) — só com stats reais. */}
          {stats.won > 0 || stats.drawn > 0 || stats.lost > 0 || stats.goalsFor > 0 ? (
            <div className="mt-9 grid w-full max-w-3xl grid-cols-2 gap-3 sm:grid-cols-4">
              <Stat label="VITÓRIAS" value={String(stats.won)} icon={Star} color="#00ffc8" />
              <Stat label="EMPATES" value={String(stats.drawn)} icon={Star} color="#eab308" />
              <Stat label="DERROTAS" value={String(stats.lost)} icon={Star} color="#ef4444" />
              <Stat label="GOLS" value={String(stats.goalsFor)} icon={Star} color="#3b82f6" />
            </div>
          ) : null}
        </div>

        {/* Mensagem + ação */}
        <p className="mt-11 max-w-xl text-center text-base leading-relaxed text-white/75 text-pretty">
          Uma temporada para entrar para a história. A torcida do <strong className="text-white">{team.nome}</strong> levará esta conquista para sempre.
        </p>
        <div className="mt-9">
          <Button
            size="lg"
            onClick={() => router.push("/")}
            className="bg-gradient-to-r from-yellow-500 to-amber-400 text-black hover:opacity-90 font-black tracking-wider shadow-lg shadow-yellow-500/30"
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
        @keyframes champ-glow {
          0%, 100% { transform: translateY(0); filter: drop-shadow(0 12px 30px rgba(251,191,36,0.5)); }
          50% { transform: translateY(-6px); filter: drop-shadow(0 20px 42px rgba(251,191,36,0.75)); }
        }
        .animate-champ-glow {
          animation: champ-glow 3.4s ease-in-out infinite;
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
