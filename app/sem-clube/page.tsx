"use client"

import { useMemo, useState } from "react"
import { Briefcase, CalendarDays, ChevronRight, Trophy } from "lucide-react"
import { useGameState } from "@/lib/save-system"
import { useGameEngine } from "@/lib/game-engine"
import { allTeams, type Team } from "@/lib/teams-data"
import { hardNavigate } from "@/lib/hard-navigation"
import { buildCareerStats } from "@/lib/hall-of-fame-engine"
import { ofertasParaDesempregado, coachStandingScore } from "@/lib/coach-market"

type RoundResult = { home: Team; away: Team; homeGoals: number; awayGoals: number }

function hash(value: string): number {
  let h = 2166136261
  for (const c of value) h = Math.imul(h ^ c.charCodeAt(0), 16777619)
  return h >>> 0
}

export default function UnemployedCareerPage() {
  const { state, setState } = useGameState()
  const engine = useGameEngine()
  const [round, setRound] = useState(Math.max(1, state.week + 1))
  const [phase, setPhase] = useState<"ready" | "results" | "offers">("ready")

  // Reputacao do tecnico — o que faz uma otima temporada valer no mercado.
  const standing = useMemo(() => {
    const historia = state.seasonHistory ?? []
    const rep = historia.length ? buildCareerStats(historia).reputation : 0
    return {
      reputation: rep,
      totalTitles: (state.coachTotalTitles ?? 0) + (state.coachLegacy?.totalTitles ?? 0),
      reputationLevel: state.coachLegacy?.reputationLevel ?? 0,
    }
  }, [state.seasonHistory, state.coachTotalTitles, state.coachLegacy])

  const score = useMemo(() => coachStandingScore(standing), [standing])

  const results = useMemo<RoundResult[]>(() => {
    const brazil = allTeams.filter(t => t.divisao === "serie_a")
    const rotated = [...brazil].sort((a, b) => hash(`${round}:${a.curto}`) - hash(`${round}:${b.curto}`))
    const out: RoundResult[] = []
    for (let i = 0; i + 1 < rotated.length; i += 2) {
      out.push({
        home: rotated[i], away: rotated[i + 1],
        homeGoals: hash(`${round}:${rotated[i].curto}:H`) % 5,
        awayGoals: hash(`${round}:${rotated[i + 1].curto}:A`) % 4,
      })
    }
    return out
  }, [round])

  // Propostas ancoradas na reputacao: campeao recebe grandes, iniciante recebe
  // modestos. A rodada e a semente, entao "recusar e continuar" traz outro lote.
  const offers = useMemo(
    () => ofertasParaDesempregado(allTeams, standing, round),
    [standing, round],
  )

  const continueFromResults = () => {
    setState({ week: round })
    setPhase("offers")
  }

  const declineAll = () => {
    setRound(value => value + 1)
    setPhase("ready")
  }

  const accept = (team: Team) => {
    engine.initializeGame(team.curto)
    useGameEngine.setState({ currentWeek: round, currentSeason: state.season })
    setState({
      selectedTeamShort: team.curto,
      divisionOverride: undefined,
      week: round,
      fixtures: [],
      standings: [],
      squadPlayers: undefined,
      youthPlayers: undefined,
      youthCareer: undefined,
    })
    hardNavigate("/")
  }

  return (
    <main className="min-h-screen bg-[#05090b] px-5 py-8 text-white">
      <div className="mx-auto max-w-5xl">
        <header className="mb-7 flex items-center justify-between border-b border-white/10 pb-5">
          <div><p className="text-xs font-black uppercase tracking-[.22em] text-[#00ffc8]">Carreira do treinador</p><h1 className="mt-1 text-3xl font-black">Aguardando novo clube</h1></div>
          <div className="flex items-center gap-2 rounded-xl bg-white/5 px-4 py-3 text-sm text-white/60"><CalendarDays className="h-4 w-4 text-[#00ffc8]" /> Temporada {state.season} · Rodada {round}</div>
        </header>

        {phase === "ready" && <section className="rounded-2xl border border-white/10 bg-white/[.035] p-10 text-center"><Trophy className="mx-auto h-12 w-12 text-[#00ffc8]" /><h2 className="mt-4 text-2xl font-black">O futebol continua</h2><p className="mx-auto mt-2 max-w-xl text-white/55">Mesmo sem clube, todas as competições seguem sendo simuladas. Acompanhe a rodada enquanto as diretorias avaliam seu nome.</p><button onClick={() => setPhase("results")} className="mt-7 rounded-xl bg-[#00ffc8] px-7 py-3 font-black text-black">Simular rodada</button></section>}

        {phase === "results" && <section><h2 className="mb-4 text-xl font-black">Resultados da rodada</h2><div className="grid gap-2 md:grid-cols-2">{results.map(game => <div key={`${game.home.curto}-${game.away.curto}`} className="grid grid-cols-[1fr_auto_1fr] items-center rounded-xl border border-white/8 bg-white/[.035] px-4 py-3 text-sm"><span className="text-right font-bold">{game.home.nome}</span><strong className="mx-4 rounded-lg bg-black/40 px-3 py-1 text-lg">{game.homeGoals} : {game.awayGoals}</strong><span className="font-bold">{game.away.nome}</span></div>)}</div><button onClick={continueFromResults} className="ml-auto mt-6 flex items-center gap-2 rounded-xl bg-[#00ffc8] px-6 py-3 font-black text-black">Continuar <ChevronRight className="h-4 w-4" /></button></section>}

        {phase === "offers" && <section><div className="mb-5 flex items-end justify-between"><div><p className="text-xs font-black uppercase tracking-wider text-[#00ffc8]">Mercado de treinadores</p><h2 className="text-2xl font-black">Propostas recebidas</h2></div><div className="text-right text-xs text-white/45">Sua reputação<div className="text-lg font-black text-white">{score >= 80 ? "Elite" : score >= 60 ? "Consolidada" : score >= 35 ? "Em ascensão" : "Iniciante"}</div></div></div><div className="grid gap-4 md:grid-cols-3">{offers.map(team => <article key={team.file_key} className="rounded-2xl border border-white/10 bg-white/[.04] p-5"><Briefcase className="h-7 w-7 text-[#00ffc8]" /><h3 className="mt-4 text-lg font-black">{team.nome}</h3><p className="mt-1 text-sm text-white/45">{String(team.divisao).replaceAll("_", " ")} · Prestígio {team.prestigio}</p><p className="mt-4 text-sm leading-6 text-white/65">A diretoria abriu o cargo e deseja conversar com você para assumir imediatamente.</p><button onClick={() => accept(team)} className="mt-5 w-full rounded-lg bg-[#00ffc8] py-2.5 text-sm font-black text-black">Aceitar proposta</button></article>)}</div><button onClick={declineAll} className="mt-6 rounded-lg border border-white/15 px-5 py-2.5 text-sm font-bold text-white/65 hover:bg-white/5">Recusar e continuar simulando</button></section>}
      </div>
    </main>
  )
}
