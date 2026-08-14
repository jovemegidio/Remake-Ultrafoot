"use client"

// RANKINGS — tela própria, separada da Central de Gestão.
//
// Gestão é o que o técnico DECIDE; ranking é o que ele CONSULTA. Ver o
// comentário de `components/rankings-mundiais.tsx`.

import { GameHeader } from "@/components/game-header"
import { RankingsMundiais } from "@/components/rankings-mundiais"
import { useGameState } from "@/lib/save-system"
import { getTeamByShort, serieATeams } from "@/lib/teams-data"

export default function RankingsPage() {
  const { state } = useGameState()
  const team = getTeamByShort(state.selectedTeamShort ?? "") ?? serieATeams[0]

  return (
    <div className="min-h-screen bg-[#07090d] text-white">
      <GameHeader team={team} />
      <main className="mx-auto max-w-7xl p-5 pb-24">
        <div className="mb-5">
          <h1 className="text-2xl font-black">Rankings</h1>
          <p className="text-sm text-white/50">Técnicos, clubes, seleções e academias do mundo.</p>
        </div>
        <RankingsMundiais state={state} />
      </main>
    </div>
  )
}
