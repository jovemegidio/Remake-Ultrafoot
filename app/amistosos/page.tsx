"use client"

// Amistosos de clube / pre-temporada: escolha um adversario e jogue um amistoso.
// NAO conta para a temporada (sem tabela, sem avancar a semana) — e treino. O contexto
// leva a flag `friendly`, que a tela da partida respeita.

import { useMemo, useState } from "react"
import { Search, Swords, ArrowRightLeft, Home, Plane } from "lucide-react"
import { GameHeader } from "@/components/game-header"
import { TeamCrest } from "@/components/team-crest"
import { useUserTeam } from "@/lib/save-system"
import { allTeams, type Team } from "@/lib/teams-data"
import { saveMatchContext } from "@/lib/match-context"
import { hardNavigate } from "@/lib/hard-navigation"
import { cn } from "@/lib/utils"
import { useTelaGamepad } from "@/hooks/use-tela-gamepad"

function norm(s: string) {
  return (s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
}

export default function AmistososPage() {
  // Controle: convencao unica (B volta). Ver hooks/use-tela-gamepad.ts.
  useTelaGamepad({ aoVoltar: () => hardNavigate("/") })

  const { team: userTeam } = useUserTeam()
  const [query, setQuery] = useState("")
  const [userIsHome, setUserIsHome] = useState(true)

  const opponents = useMemo(() => {
    const q = norm(query.trim())
    return allTeams
      .filter((t) => t.curto !== userTeam.curto && !/ II$/.test(t.nome))
      .filter((t) => !q || norm(t.nome).includes(q) || norm(t.curto).includes(q))
      .sort((a, b) => b.prestigio - a.prestigio)
      .slice(0, 60)
  }, [query, userTeam.curto])

  const playFriendly = (opp: Team) => {
    saveMatchContext({
      homeShort: userIsHome ? userTeam.curto : opp.curto,
      awayShort: userIsHome ? opp.curto : userTeam.curto,
      homeKit: "home",
      awayKit: userIsHome ? "away" : "home",
      competition: "Amistoso",
      round: "Pré-temporada",
      friendly: true,
      duration: 90,
    })
    hardNavigate("/partida/ao-vivo")
  }

  return (
    <div className="h-screen bg-[#050508] flex flex-col overflow-hidden">
      <GameHeader team={userTeam} />
      <main className="flex-1 overflow-y-auto p-4 md:p-6">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/15 ring-1 ring-primary/30">
            <Swords className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white leading-tight">Amistosos</h1>
            <p className="text-sm text-white/50">Jogos de treino — não contam para a temporada.</p>
          </div>
        </div>

        {/* Mando de campo */}
        <div className="mb-4 flex items-center gap-2">
          <button
            onClick={() => setUserIsHome(true)}
            className={cn("flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold transition-all",
              userIsHome ? "border-primary bg-primary/15 text-primary" : "border-white/10 bg-white/[0.03] text-white/50 hover:bg-white/[0.06]")}
          >
            <Home className="h-4 w-4" /> {userTeam.curto} em casa
          </button>
          <button
            onClick={() => setUserIsHome(false)}
            className={cn("flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold transition-all",
              !userIsHome ? "border-primary bg-primary/15 text-primary" : "border-white/10 bg-white/[0.03] text-white/50 hover:bg-white/[0.06]")}
          >
            <Plane className="h-4 w-4" /> {userTeam.curto} fora
          </button>
        </div>

        {/* Busca */}
        <div className="mb-4 flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3">
          <Search className="h-4 w-4 text-white/30" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar adversário..."
            className="w-full bg-transparent py-3 text-sm text-white placeholder:text-white/30 focus:outline-none"
          />
        </div>

        {/* Lista de adversarios */}
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {opponents.map((opp) => (
            <button
              key={opp.curto + opp.file_key}
              onClick={() => playFriendly(opp)}
              className="group flex items-center gap-3 rounded-xl border border-white/[0.08] bg-white/[0.03] p-3 text-left transition-all hover:border-primary/40 hover:bg-white/[0.06]"
            >
              <TeamCrest team={opp} size="md" />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold text-white">{opp.nome}</div>
                <div className="text-[11px] text-white/40">{opp.pais ?? opp.estado ?? ""} · Prestígio {opp.prestigio}</div>
              </div>
              <ArrowRightLeft className="h-4 w-4 text-white/20 transition-colors group-hover:text-primary" />
            </button>
          ))}
          {opponents.length === 0 && (
            <p className="col-span-full py-8 text-center text-sm text-white/40">Nenhum adversário encontrado.</p>
          )}
        </div>
      </main>
    </div>
  )
}
