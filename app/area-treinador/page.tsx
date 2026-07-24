"use client"

import Image from "next/image"
import Link from "next/link"
import {
  ArrowRight,
  CalendarDays,
  ClipboardList,
  Dumbbell,
  Pencil,
  Play,
  ShieldCheck,
  Target,
  Trophy,
  Users,
} from "lucide-react"
import { GameHeader } from "@/components/game-header"
import { TeamCrest } from "@/components/team-crest"
import { useGameManager } from "@/lib/use-game-manager"
import { cn } from "@/lib/utils"

const shortcuts = [
  { href: "/calendario", label: "Calendário", detail: "Agenda e próximos compromissos", icon: CalendarDays },
  { href: "/elenco", label: "Elenco", detail: "Plantel, funções e condição", icon: Users },
  { href: "/treinamento", label: "Treinamento", detail: "Planos e evolução semanal", icon: Dumbbell },
  { href: "/editar", label: "Editor", detail: "Identidade, uniformes e atletas", icon: Pencil },
]

export default function CoachAreaPage() {
  const {
    userTeam,
    seasonCalendar,
    currentStandings,
    currentSeason,
    currentWeek,
    userPosition,
  } = useGameManager()

  if (!userTeam) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#050508] px-6 text-center">
        <ShieldCheck className="size-8 text-[#00ffc8]" />
        <div>
          <h1 className="text-xl font-black text-white">Nenhuma carreira ativa</h1>
          <p className="mt-2 text-sm text-white/50">Selecione ou crie uma carreira para abrir a Área do Treinador.</p>
        </div>
        <Link href="/splash?menu=1" className="rounded-xl bg-[#00ffc8] px-5 py-3 text-sm font-black text-[#050508]">Ir para o menu</Link>
      </main>
    )
  }

  const nextMatch = seasonCalendar.nextUserMatch
  const played = seasonCalendar.fixtures.filter((fixture) => fixture.isUserMatch && fixture.played)
  const wins = played.filter((fixture) => {
    const isHome = fixture.homeTeam.curto === userTeam.curto
    const scored = isHome ? fixture.homeScore ?? 0 : fixture.awayScore ?? 0
    const conceded = isHome ? fixture.awayScore ?? 0 : fixture.homeScore ?? 0
    return scored > conceded
  }).length
  const points = currentStandings.find((entry) => entry.teamShort === userTeam.curto)?.points ?? 0
  const opponent = nextMatch
    ? nextMatch.homeTeam.curto === userTeam.curto
      ? nextMatch.awayTeam
      : nextMatch.homeTeam
    : null
  const isHome = nextMatch?.homeTeam.curto === userTeam.curto

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-[#050508] text-white">
      <div className="pointer-events-none fixed inset-0">
        <Image src="/images/office-bg-1.png" alt="" fill priority className="object-cover opacity-30" />
        <div className="absolute inset-0 bg-[#050508]/80" />
      </div>

      <div className="relative z-10">
        <GameHeader team={userTeam} />
        <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
          <section className="flex flex-col gap-5 rounded-2xl border border-white/10 bg-[#0b0d10]/90 p-5 shadow-2xl backdrop-blur-xl md:flex-row md:items-center md:justify-between md:p-7">
            <div className="flex items-center gap-4">
              <div className="flex size-20 shrink-0 items-center justify-center rounded-2xl border border-[#00ffc8]/20 bg-[#00ffc8]/5">
                <TeamCrest team={userTeam} size="lg" />
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-xs font-bold uppercase tracking-[0.24em] text-[#00ffc8]">Área do treinador</span>
                <h1 className="text-balance text-2xl font-black tracking-tight sm:text-3xl">Comando do {userTeam.nome}</h1>
                <p className="text-sm leading-relaxed text-white/50">Temporada {currentSeason} · Semana {currentWeek} · visão executiva do clube</p>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2 sm:min-w-72">
              {[
                [userPosition > 0 ? `${userPosition}º` : "—", "Posição"],
                [String(points), "Pontos"],
                [String(wins), "Vitórias"],
              ].map(([value, label]) => (
                <div key={label} className="rounded-xl border border-white/8 bg-white/[0.03] p-3 text-center">
                  <div className="text-xl font-black tabular-nums">{value}</div>
                  <div className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-white/35">{label}</div>
                </div>
              ))}
            </div>
          </section>

          <section className="grid gap-6 lg:grid-cols-[1.35fr_0.65fr]">
            <article className="overflow-hidden rounded-2xl border border-white/10 bg-[#0b0d10]/90">
              <header className="flex items-center justify-between border-b border-white/8 px-5 py-4">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#00ffc8]">Próximo compromisso</p>
                  <h2 className="mt-1 text-lg font-bold">Preparação da partida</h2>
                </div>
                {nextMatch && <span className="rounded-full bg-white/5 px-3 py-1 text-xs text-white/50">Rodada {nextMatch.round}</span>}
              </header>
              {nextMatch && opponent ? (
                <div className="flex flex-col gap-6 p-5 sm:p-6">
                  <div className="flex items-center justify-between gap-4 rounded-xl bg-white/[0.03] p-4">
                    <div className="flex items-center gap-4">
                      <TeamCrest team={opponent} size="lg" />
                      <div>
                        <div className="text-xs font-semibold uppercase tracking-wider text-white/40">{isHome ? "Em casa" : "Fora de casa"}</div>
                        <div className="mt-1 text-xl font-black">{opponent.nome}</div>
                        <div className="mt-1 text-sm text-white/45">{nextMatch.competition}</div>
                      </div>
                    </div>
                    <Trophy className="size-6 text-[#ffd700]" aria-hidden="true" />
                  </div>
                  <div className="flex flex-col gap-3 sm:flex-row">
                    <Link href="/partida" className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#00ffc8] px-5 py-3 text-sm font-black text-[#050508] transition-transform hover:-translate-y-0.5">
                      <Play className="size-4" aria-hidden="true" /> Preparar partida
                    </Link>
                    <Link href="/elenco/taticas" className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-bold transition-colors hover:bg-white/10">
                      <ClipboardList className="size-4" aria-hidden="true" /> Rever tática
                    </Link>
                  </div>
                </div>
              ) : (
                <div className="p-8 text-center text-sm text-white/45">Nenhuma partida agendada no momento.</div>
              )}
            </article>

            <aside className="rounded-2xl border border-white/10 bg-[#0b0d10]/90 p-5">
              <div className="flex items-center gap-3">
                <div className="flex size-10 items-center justify-center rounded-xl bg-[#00ffc8]/10 text-[#00ffc8]"><Target className="size-5" /></div>
                <div><p className="text-[10px] font-bold uppercase tracking-wider text-white/35">Foco da semana</p><h2 className="font-bold">Plano de trabalho</h2></div>
              </div>
              <div className="mt-5 flex flex-col gap-2">
                {["Definir a equipe titular", "Revisar condição do elenco", "Analisar o próximo adversário"].map((task, index) => (
                  <div key={task} className="flex items-center gap-3 rounded-xl border border-white/6 bg-white/[0.025] p-3">
                    <span className={cn("flex size-6 items-center justify-center rounded-full text-xs font-black", index === 0 ? "bg-[#00ffc8] text-[#050508]" : "bg-white/8 text-white/45")}>{index + 1}</span>
                    <span className="text-sm text-white/75">{task}</span>
                  </div>
                ))}
              </div>
            </aside>
          </section>

          <section>
            <div className="mb-3 flex items-center justify-between">
              <div><p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#00ffc8]">Central de comando</p><h2 className="mt-1 text-xl font-black">Acesso rápido</h2></div>
              <ShieldCheck className="size-5 text-white/30" />
            </div>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {shortcuts.map((item) => (
                <Link key={item.href} href={item.href} className="group flex min-h-32 flex-col justify-between rounded-2xl border border-white/8 bg-[#0b0d10]/90 p-4 transition-all hover:-translate-y-0.5 hover:border-[#00ffc8]/30 hover:bg-[#101417]">
                  <div className="flex items-start justify-between"><item.icon className="size-5 text-[#00ffc8]" /><ArrowRight className="size-4 text-white/25 transition-transform group-hover:translate-x-1 group-hover:text-[#00ffc8]" /></div>
                  <div><h3 className="font-bold">{item.label}</h3><p className="mt-1 text-sm leading-relaxed text-white/40">{item.detail}</p></div>
                </Link>
              ))}
            </div>
          </section>
        </main>
      </div>
    </div>
  )
}
