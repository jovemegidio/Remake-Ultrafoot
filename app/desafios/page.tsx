"use client"

import { Trophy, Award, Clock, CheckCircle2 } from "lucide-react"
import { GameSidebar } from "@/components/game-sidebar"
import { GameHeader } from "@/components/game-header"
import { useGameState, useUserTeam } from "@/lib/save-system"
import { CHALLENGES, startChallenge, type ChallengeId, type ChallengeProgress } from "@/lib/challenge-engine"

const DIFF_COLORS: Record<string, string> = {
  facil: "text-green-400 bg-green-400/10",
  medio: "text-blue-400 bg-blue-400/10",
  dificil: "text-orange-400 bg-orange-400/10",
  lendario: "text-purple-400 bg-purple-400/10",
}

export default function DesafiosPage() {
  const { team } = useUserTeam()
  const { state, setState } = useGameState()
  const active = state.activeChallenge

  const activate = (id: ChallengeId) => {
    const config = CHALLENGES.find(challenge => challenge.id === id)
    if (!config) return
    const prepared = startChallenge(id, state)
    const progress: ChallengeProgress = {
      challengeId: id,
      startedAt: Date.now(),
      startSeason: state.season,
      currentSeason: state.season,
      goals: config.goals.map(goal => ({ ...goal })),
      failed: false,
      completed: false,
    }
    setState({ ...prepared, activeChallenge: progress })
  }

  return (
    <div className="min-h-screen pl-[72px] pb-24 bg-[#0a0a0a]">
      <GameSidebar />
      <GameHeader team={team} />
      <main className="p-6 space-y-6">
        <header className="flex items-center gap-3">
          <Trophy className="h-7 w-7 text-yellow-400" />
          <div>
            <h1 className="text-3xl font-bold text-white tracking-tight">DESAFIOS</h1>
            <p className="text-white/50 mt-1">Cenários com metas, prazo e recompensa</p>
          </div>
        </header>

        {active && <div className="rounded-xl border border-[#1db954]/25 bg-[#1db954]/8 p-4 text-sm text-white flex items-center gap-3"><CheckCircle2 className="h-5 w-5 text-[#1db954]" /><span>Desafio ativo: <strong>{CHALLENGES.find(c => c.id === active.challengeId)?.nome}</strong> · iniciado em {active.startSeason}</span></div>}

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {CHALLENGES.map(c => (
            <div key={c.id} className="rounded-xl bg-[#141414] border border-white/5 p-5 hover:border-white/15 transition">
              <div className="flex items-start justify-between">
                <Award className="h-6 w-6 text-[#1db954]" />
                <span className={`text-xs font-bold px-2 py-1 rounded ${DIFF_COLORS[c.difficulty]}`}>{c.difficulty.toUpperCase()}</span>
              </div>
              <div className="mt-4 text-base font-semibold text-white">{c.nome}</div>
              <div className="mt-1 text-xs text-white/40 font-mono">{c.id}</div>
              <button onClick={() => activate(c.id)} disabled={Boolean(active && !active.completed && !active.failed)} className="mt-4 w-full rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-35 px-3 py-2 text-xs text-white/70 transition flex items-center justify-center gap-2">
                <Clock className="h-3.5 w-3.5" />
                {active?.challengeId === c.id ? "Desafio em andamento" : "Iniciar desafio"}
              </button>
            </div>
          ))}
        </div>
      </main>
    </div>
  )
}
