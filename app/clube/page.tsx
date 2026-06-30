// PHASE 23 — Clube: estádio, CT, base, gramado, médico, marketing, análise
// Status: skeleton. Engine em lib/infrastructure-engine.ts.

"use client"

import { Building2, Dumbbell, Sprout, Sparkles, HeartPulse, Megaphone, BarChart3, MapPin } from "lucide-react"
import { GameSidebar } from "@/components/game-sidebar"
import { GameHeader } from "@/components/game-header"
import { useUserTeam } from "@/lib/save-system"

const FACILITIES = [
  { key: "stadium",        icon: Building2,    name: "Estádio",          impact: "Bilheteria, atendimento, sócios" },
  { key: "training_center",icon: Dumbbell,     name: "CT",               impact: "Multiplicador de treino" },
  { key: "youth_academy",  icon: Sprout,       name: "Base",             impact: "Qualidade da peneira" },
  { key: "pitch",          icon: Sparkles,     name: "Gramado",          impact: "Risco de lesão" },
  { key: "medical",        icon: HeartPulse,   name: "Médico",           impact: "Velocidade de recuperação" },
  { key: "marketing",      icon: Megaphone,    name: "Marketing",        impact: "Multiplicador de patrocínio" },
  { key: "analysis_center",icon: BarChart3,    name: "Centro de análise",impact: "Precisão do scouting" },
]

export default function ClubePage() {
  const { team } = useUserTeam()

  return (
    <div className="min-h-screen pl-[72px] pb-24 bg-[#0a0a0a]">
      <GameSidebar />
      <GameHeader team={team} />
      <main className="p-6 space-y-6">
        <header className="flex items-center gap-3">
          <Building2 className="h-7 w-7 text-blue-400" />
          <div>
            <h1 className="text-3xl font-bold text-white tracking-tight">CLUBE</h1>
            <p className="text-white/50 mt-1 flex items-center gap-2">
              <MapPin className="h-3.5 w-3.5" />
              {team.cidade ?? team.pais} · {team.estadio || "Estádio"}
            </p>
          </div>
        </header>

        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 text-amber-200/80 text-sm">
          Skeleton (Fase 23). Engine: <code className="font-mono">lib/infrastructure-engine.ts</code>. Upgrades de instalações afetam receita, evolução, lesões, moral, torcida.
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {FACILITIES.map(f => (
            <div key={f.key} className="rounded-xl bg-[#141414] border border-white/5 p-5">
              <f.icon className="h-6 w-6 text-[#1db954]" />
              <div className="mt-3 text-base font-semibold text-white">{f.name}</div>
              <div className="mt-1 text-xs text-white/40">{f.impact}</div>
              <div className="mt-3 flex items-center justify-between">
                <span className="text-xs text-white/30 font-mono">Nível 1/10</span>
                <button className="text-xs text-white/40 px-2 py-1 rounded bg-white/5" disabled>—</button>
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  )
}
