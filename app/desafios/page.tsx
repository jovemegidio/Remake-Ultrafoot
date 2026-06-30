// PHASE 3 — Modo Desafios
// Status: skeleton. Lista cenários definidos em lib/challenge-engine.ts.

"use client"

import { Trophy, Award, Clock, AlertTriangle } from "lucide-react"
import { GameSidebar } from "@/components/game-sidebar"
import { GameHeader } from "@/components/game-header"
import { useUserTeam } from "@/lib/save-system"

const CHALLENGES_PREVIEW = [
  { id: "save_relegation", nome: "Salvar do rebaixamento", difficulty: "dificil" },
  { id: "promote_division", nome: "Subir divisão", difficulty: "medio" },
  { id: "small_state", nome: "Ganhar estadual pequeno", difficulty: "medio" },
  { id: "u23_only", nome: "Apenas Sub-23", difficulty: "lendario" },
  { id: "cup_no_signings", nome: "Copa sem contratar", difficulty: "dificil" },
  { id: "qualify_continental", nome: "Classificar continental", difficulty: "medio" },
  { id: "rebuild_giant", nome: "Reconstruir gigante", difficulty: "dificil" },
  { id: "cut_payroll", nome: "Reduzir folha salarial", difficulty: "medio" },
] as const

const DIFF_COLORS: Record<string, string> = {
  facil: "text-green-400 bg-green-400/10",
  medio: "text-blue-400 bg-blue-400/10",
  dificil: "text-orange-400 bg-orange-400/10",
  lendario: "text-purple-400 bg-purple-400/10",
}

export default function DesafiosPage() {
  const { team } = useUserTeam()

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

        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 text-amber-200/80 text-sm flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
          <span>Skeleton (Fase 3). Estrutura definida em <code className="font-mono text-amber-100">lib/challenge-engine.ts</code>. Iniciar desafio ainda não implementado.</span>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {CHALLENGES_PREVIEW.map(c => (
            <div key={c.id} className="rounded-xl bg-[#141414] border border-white/5 p-5 hover:border-white/15 transition">
              <div className="flex items-start justify-between">
                <Award className="h-6 w-6 text-[#1db954]" />
                <span className={`text-xs font-bold px-2 py-1 rounded ${DIFF_COLORS[c.difficulty]}`}>{c.difficulty.toUpperCase()}</span>
              </div>
              <div className="mt-4 text-base font-semibold text-white">{c.nome}</div>
              <div className="mt-1 text-xs text-white/40 font-mono">{c.id}</div>
              <button className="mt-4 w-full rounded-lg bg-white/5 hover:bg-white/10 px-3 py-2 text-xs text-white/60 transition flex items-center justify-center gap-2" disabled>
                <Clock className="h-3.5 w-3.5" />
                Em desenvolvimento
              </button>
            </div>
          ))}
        </div>
      </main>
    </div>
  )
}
