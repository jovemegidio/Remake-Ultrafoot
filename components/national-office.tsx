"use client"

import Link from "next/link"
import Image from "next/image"
import {
  Flag,
  Trophy,
  Crown,
  Users,
  Play,
  ChevronRight,
  ArrowLeftRight,
  Swords,
  Globe,
} from "lucide-react"
import { GameHeader } from "@/components/game-header"
import { TeamCrest } from "@/components/team-crest"
import { cn } from "@/lib/utils"
import { hardNavigate } from "@/lib/hard-navigation"
import { useUserTeam, useGameState } from "@/lib/save-system"
import { useNationalTeam } from "@/lib/use-national-team"
import { voltarAoClube } from "@/lib/career-moves"
import { getTeamByShort } from "@/lib/teams-data"
import { getNationalStrength, CONFEDERATION_LABEL } from "@/lib/national-teams"
import { prepararPartidaDaSelecao } from "@/lib/partida-da-selecao"

/**
 * OFFICE DA SELEÇÃO (Task 2 — seleção como time pleno).
 *
 * Espelha a estrutura do escritório do clube (manchete, próximo compromisso,
 * lista de tarefas e painéis laterais), porém com os dados da SELEÇÃO: competição
 * em disputa, convocação, amistosos, títulos e retrospecto. A gestão detalhada
 * (tabela, convocar a dedo, contraproposta) segue na página /selecao — aqui o
 * office concentra o "dia a dia" e o acesso rápido. Um seletor volta ao clube.
 */
export function NationalOffice() {
  const { team: nation } = useUserTeam()
  const { state, setState } = useGameState()
  const {
    nationalTeam,
    career,
    currentCompetition,
    userNextFixture,
    availableCompetitions,
    playNextRound,
    nationalFriendlies,
  } = useNationalTeam()

  const clubShort = state.selectedTeamShort
  const club = clubShort ? getTeamByShort(clubShort) : null
  const strength = nationalTeam ? getNationalStrength(nationalTeam) : 0

  // Cada item tem TELA PROPRIA (antes os tres caiam no mesmo /selecao, e
  // "Amistosos" ia parar na tela de amistosos de CLUBE, que no modo selecao nao
  // tem elenco para carregar). A gestao do contrato segue na /selecao.
  const tasks = [
    { href: "/selecao/convocacao", icon: Users, label: "Convocação", highlight: false },
    { href: "/selecao/competicoes", icon: Trophy, label: "Competições da seleção", highlight: false },
    { href: "/selecao/amistosos", icon: Swords, label: "Amistosos de preparação", highlight: false },
    { href: "/selecao", icon: Flag, label: "Contrato e gestão da seleção", highlight: false },
  ]

  const oppName = userNextFixture && nationalTeam
    ? (userNextFixture.homeId === nationalTeam.id ? userNextFixture.awayName : userNextFixture.homeName)
    : null

  return (
    <div className="relative h-screen pb-20 md:pb-12 bg-[#050508] flex flex-col overflow-hidden">
      {/* Mesmo fundo do escritório do clube, para a estrutura ser a mesma. */}
      <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
        <Image src="/images/office-bg-1.webp" alt="" fill priority unoptimized className="object-cover" />
        <div className="absolute inset-0 bg-[#050508]/72" />
      </div>

      <div className="relative z-10 flex min-h-0 flex-1 flex-col">
        <GameHeader team={nation} />

        <main className="flex-1 p-4 overflow-y-auto space-y-4">
          {/* Seletor clube ↔ seleção */}
          <div className="flex flex-wrap items-center gap-3 rounded-xl border border-[var(--brand)]/25 bg-[var(--brand)]/[0.05] p-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[var(--brand)]/15">
              <Flag className="h-5 w-5 text-[var(--brand)]" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-white">Modo seleção — {nation.nome}</p>
              <p className="truncate text-xs text-white/55">
                {club ? `Você segue com contrato no ${club.nome}.` : "Sem clube no momento — dedicação exclusiva à seleção."}
              </p>
            </div>
            {club ? (
              <button
                onClick={() => voltarAoClube({ setSaveState: (p) => setState(p as Parameters<typeof setState>[0]), navigate: hardNavigate })}
                className="flex shrink-0 items-center gap-2 rounded-lg bg-white/[0.06] px-3 py-2 text-xs font-semibold text-white/80 transition-colors hover:bg-white/[0.12]"
              >
                <ArrowLeftRight className="h-3.5 w-3.5" />
                Voltar ao {club.curto}
              </button>
            ) : (
              // Sem clube (ex.: demitido — caso Diniz): oferece o caminho de volta
              // ao mercado de clubes, sem forçar a saída da seleção.
              <button
                onClick={() => hardNavigate("/treinador")}
                className="flex shrink-0 items-center gap-2 rounded-lg bg-white/[0.06] px-3 py-2 text-xs font-semibold text-white/80 transition-colors hover:bg-white/[0.12]"
              >
                <ArrowLeftRight className="h-3.5 w-3.5" />
                Procurar clube
              </button>
            )}
          </div>

          <section className="grid gap-6 lg:grid-cols-[1.2fr_1fr] items-start">
            {/* Coluna esquerda: identidade, próximo compromisso, tarefas */}
            <div>
              <div className="flex items-center gap-4">
                <TeamCrest team={nation} size="xl" />
                <div>
                  <h1 className="text-3xl md:text-4xl font-extrabold uppercase tracking-tight text-white">{nation.nome}</h1>
                  <p className="mt-1 text-xs font-semibold uppercase tracking-wider text-[var(--brand)]">
                    {nationalTeam ? CONFEDERATION_LABEL[nationalTeam.confederation] : "Seleção nacional"}
                  </p>
                </div>
              </div>

              {/* Próximo compromisso */}
              {currentCompetition && userNextFixture ? (
                <div className="mt-6 rounded-2xl border border-[var(--brand)]/20 bg-gradient-to-b from-[var(--brand)]/[0.07] to-transparent p-5">
                  <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-[var(--brand)]">
                    <Trophy className="h-3.5 w-3.5" /> {currentCompetition.competitionName}
                  </div>
                  <h2 className="mt-2 text-xl font-black text-white">{userNextFixture.stage} · vs {oppName}</h2>
                  <p className="mt-1 text-sm text-white/55">Temporada {currentCompetition.season}</p>
                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    {/* Fluxo completo, igual ao do clube: pré-jogo, partida ao
                        vivo, coletiva e volta para o escritório da seleção. */}
                    <button
                      onClick={() => {
                        if (!nationalTeam || !currentCompetition || !userNextFixture) return
                        hardNavigate(prepararPartidaDaSelecao(nationalTeam, userNextFixture, currentCompetition))
                      }}
                      className="inline-flex items-center gap-2 rounded-xl bg-[var(--brand)] px-5 py-3 text-sm font-black text-[var(--brand-ink)] transition-all hover:brightness-110"
                    >
                      <Play className="h-4 w-4 fill-current" /> Jogar partida
                    </button>
                    <button
                      onClick={() => playNextRound()}
                      className="inline-flex items-center gap-2 rounded-xl border border-white/15 px-5 py-3 text-sm font-semibold text-white/70 transition-all hover:bg-white/5 hover:text-white"
                    >
                      Simular rodada
                    </button>
                  </div>
                </div>
              ) : availableCompetitions.length > 0 ? (
                <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
                  <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-white/50">
                    <Globe className="h-3.5 w-3.5 text-[var(--brand)]" /> Sem competição em disputa
                  </div>
                  <h2 className="mt-2 text-lg font-black text-white">Inicie uma competição pela seleção</h2>
                  <p className="mt-1 text-sm text-white/55">Escolha um torneio ou eliminatória na gestão da seleção.</p>
                  <Link href="/selecao/competicoes" className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[var(--brand)] px-5 py-3 text-sm font-black text-[var(--brand-ink)] transition-all hover:brightness-110">
                    <Trophy className="h-4 w-4" /> Ver competições
                  </Link>
                </div>
              ) : null}

              {/* Lista de tarefas */}
              <div className="mt-7 space-y-px">
                {tasks.map((task, i) => (
                  <Link
                    key={i}
                    href={task.href}
                    className="group flex items-center gap-3 border-b border-white/[0.06] px-4 py-3.5 transition-colors hover:bg-white/5"
                  >
                    <task.icon className="h-5 w-5 shrink-0 text-white/50" />
                    <span className="flex-1 text-sm font-medium text-white">{task.label}</span>
                    <ChevronRight className="h-4 w-4 text-white/30 transition-transform group-hover:translate-x-0.5" />
                  </Link>
                ))}
              </div>
            </div>

            {/* Coluna direita: retrospecto, títulos, força */}
            <div className="space-y-5">
              <section className="rounded-xl bg-[#0c0c10] border border-white/[0.04] p-5">
                <div className="mb-4 flex items-center gap-2 text-xs font-medium text-white/60">
                  <Flag className="h-4 w-4 text-[var(--brand)]" /> Retrospecto
                </div>
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <p className="text-xl font-bold tabular-nums text-white">{career.matchesPlayed}</p>
                    <p className="text-[10px] uppercase tracking-wide text-white/40">Jogos</p>
                  </div>
                  <div>
                    <p className="text-xl font-bold tabular-nums text-white">{career.wins}-{career.draws}-{career.losses}</p>
                    <p className="text-[10px] uppercase tracking-wide text-white/40">V-E-D</p>
                  </div>
                  <div>
                    <p className="text-xl font-bold tabular-nums text-[var(--brand)]">{strength}</p>
                    <p className="text-[10px] uppercase tracking-wide text-white/40">Força</p>
                  </div>
                </div>
              </section>

              <section className="rounded-xl bg-[#0c0c10] border border-white/[0.04] p-5">
                <div className="mb-3 flex items-center gap-2 text-xs font-medium text-white/60">
                  <Crown className="h-4 w-4 text-[#ffd700]" /> Títulos ({career.titles.length})
                </div>
                {career.titles.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {career.titles.map((titulo, i) => (
                      <span key={i} className="flex items-center gap-1 rounded-md border border-[var(--brand)]/20 bg-[var(--brand)]/10 px-2 py-1 text-[11px] text-[var(--brand)]">
                        <Crown className="h-3 w-3" /> {titulo.competition} {titulo.season}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-white/40">Nenhum título ainda. Conquiste um torneio para construir sua história.</p>
                )}
              </section>

              {nationalFriendlies.length > 0 && (
                <section className="rounded-xl bg-[#0c0c10] border border-white/[0.04] p-5">
                  <div className="mb-3 flex items-center gap-2 text-xs font-medium text-white/60">
                    <Swords className="h-4 w-4 text-[var(--brand)]" /> Últimos amistosos
                  </div>
                  <div className="space-y-1.5">
                    {/* O save guarda os amistosos do MAIS NOVO para o mais velho
                        (`[novo, ...prev]`). O `slice(-3).reverse()` que estava aqui
                        mostrava justamente os TRES MAIS ANTIGOS — o resultado que
                        acabava de sair nunca aparecia. */}
                    {nationalFriendlies.slice(0, 3).map((f, i) => {
                      const r = f.userScore > f.oppScore ? "V" : f.userScore < f.oppScore ? "D" : "E"
                      return (
                        <div key={i} className="flex items-center gap-3 rounded-lg bg-black/25 px-3 py-2">
                          <span className={cn("flex h-6 w-6 shrink-0 items-center justify-center rounded text-[11px] font-black",
                            r === "V" ? "bg-[var(--brand)]/20 text-[var(--brand)]" : r === "D" ? "bg-red-400/20 text-red-300" : "bg-white/10 text-white/60")}>{r}</span>
                          <span className="w-14 shrink-0 font-mono text-sm text-white">{f.userScore} x {f.oppScore}</span>
                          <span className="min-w-0 flex-1 truncate text-sm text-white/70">{f.opponentName}</span>
                        </div>
                      )
                    })}
                  </div>
                </section>
              )}
            </div>
          </section>
        </main>
      </div>
    </div>
  )
}
