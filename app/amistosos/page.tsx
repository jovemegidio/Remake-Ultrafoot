"use client"

// Amistosos de clube / pre-temporada: escolha um adversario e jogue um amistoso.
// NAO conta para a temporada (sem tabela, sem avancar a semana) — e treino. O contexto
// leva a flag `friendly`, que a tela da partida respeita.

import { useEffect, useMemo, useState } from "react"
import { Search, Swords, ArrowRightLeft, Home, Plane, CalendarDays, Trophy } from "lucide-react"
import { GameHeader } from "@/components/game-header"
import { TeamCrest } from "@/components/team-crest"
import { useGameState } from "@/lib/save-system"
import { useUserTeam, useManagingNational } from "@/lib/time-da-carreira"
import { allTeams, type Team } from "@/lib/teams-data"
import { saveMatchContext } from "@/lib/match-context"
import { TorneioAmistosoPanel } from "@/components/torneio-amistoso-panel"
import { hardNavigate } from "@/lib/hard-navigation"
import { cn } from "@/lib/utils"
import { useTelaGamepad } from "@/hooks/use-tela-gamepad"

function norm(s: string) {
  return (s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
}

const DIAS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"]
const MESES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"]

/** Datas jogaveis a partir da semana atual da carreira: os proximos sabados.
 *  O calendario da carreira comeca em 1 de janeiro da temporada; cada semana = 7 dias. */
function proximasDatas(season: number, week: number, quantas = 8): { label: string; iso: string }[] {
  const base = new Date(season, 0, 1 + Math.max(0, week - 1) * 7)
  // Anda ate o proximo sabado (dia 6).
  const ateSabado = (6 - base.getDay() + 7) % 7
  const primeiro = new Date(base.getTime() + ateSabado * 86400000)
  return Array.from({ length: quantas }, (_, i) => {
    const d = new Date(primeiro.getTime() + i * 7 * 86400000)
    return {
      label: `${DIAS[d.getDay()]}, ${d.getDate()} ${MESES[d.getMonth()]}`,
      iso: d.toISOString().slice(0, 10),
    }
  })
}

export default function AmistososPage() {
  // Controle: convencao unica (B volta). Ver hooks/use-tela-gamepad.ts.
  useTelaGamepad({ aoVoltar: () => hardNavigate("/") })

  const { team: userTeam } = useUserTeam()
  const { state, setState } = useGameState()
  // Dois modos na mesma tela: o amistoso avulso que ja existia e o TORNEIO
  // criavel. Se ha torneio em andamento, a tela abre nele — e o que o tecnico
  // veio fazer.
  const [modo, setModo] = useState<"avulso" | "torneio">(
    state.torneioAmistoso ? "torneio" : "avulso",
  )
  // MODO SELEÇÃO: esta tela monta uma partida AO VIVO entre dois clubes do banco.
  // Com a seleção como time atual não há elenco de clube para carregar — o
  // amistoso de seleção é simulado e tem tela própria.
  const { isNational } = useManagingNational()
  useEffect(() => { if (isNational) hardNavigate("/selecao/amistosos") }, [isNational])
  const [query, setQuery] = useState("")
  const [userIsHome, setUserIsHome] = useState(true)

  const datas = useMemo(
    () => proximasDatas(state.season ?? 2026, state.week ?? 1),
    [state.season, state.week],
  )
  const [dataIdx, setDataIdx] = useState(0)

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
      // A data escolhida vai no rotulo da partida (o amistoso segue sem contar
      // para a temporada — nao avanca a semana).
      round: `Amistoso · ${datas[dataIdx]?.label ?? "Pré-temporada"}`,
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

        {/* Modo: amistoso avulso ou torneio criavel */}
        <div className="mb-5 flex items-center gap-2">
          <button
            onClick={() => setModo("avulso")}
            className={cn("flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold transition-all",
              modo === "avulso" ? "border-primary bg-primary/15 text-primary" : "border-white/10 bg-white/[0.03] text-white/50 hover:bg-white/[0.06]")}
          >
            <Swords className="h-4 w-4" /> Jogo avulso
          </button>
          <button
            onClick={() => setModo("torneio")}
            className={cn("flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold transition-all",
              modo === "torneio" ? "border-primary bg-primary/15 text-primary" : "border-white/10 bg-white/[0.03] text-white/50 hover:bg-white/[0.06]")}
          >
            <Trophy className="h-4 w-4" /> Torneio
            {state.torneioAmistoso && <span className="rounded bg-primary/25 px-1.5 text-[10px]">em andamento</span>}
          </button>
        </div>

        {modo === "torneio" ? (
          <TorneioAmistosoPanel
            torneio={state.torneioAmistoso}
            clubeDoUsuario={userTeam.curto}
            onSalvar={(t) => setState({ torneioAmistoso: t })}
            onJogar={(jogo, nomeDoTorneio, rotulo) => {
              const souMandante = jogo.mandanteCurto === userTeam.curto
              saveMatchContext({
                homeShort: jogo.mandanteCurto,
                awayShort: jogo.visitanteCurto,
                homeKit: "home",
                awayKit: "away",
                competition: nomeDoTorneio,
                round: rotulo,
                // Amistoso: nao conta para a temporada nem avanca a semana. O
                // marcador `torneio` e o que faz o placar voltar para a tabela.
                friendly: true,
                torneio: {
                  rodada: jogo.rodada,
                  mandanteCurto: jogo.mandanteCurto,
                  visitanteCurto: jogo.visitanteCurto,
                },
                duration: 90,
                ...(souMandante ? {} : {}),
              })
              hardNavigate("/partida/ao-vivo")
            }}
          />
        ) : (
        <>
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

        {/* Data do amistoso */}
        <div className="mb-4">
          <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-white/40">
            <CalendarDays className="h-3.5 w-3.5" /> Data do jogo
          </div>
          <div className="flex flex-wrap gap-2">
            {datas.map((d, i) => (
              <button
                key={d.iso}
                onClick={() => setDataIdx(i)}
                className={cn("rounded-lg border px-3 py-2 text-sm font-semibold transition-all",
                  dataIdx === i ? "border-primary bg-primary/15 text-primary" : "border-white/10 bg-white/[0.03] text-white/50 hover:bg-white/[0.06]")}
              >
                {d.label}
              </button>
            ))}
          </div>
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
        </>
        )}
      </main>
    </div>
  )
}
