"use client"

import { useState } from "react"

// CARREIRA DE BASE (Sub-20).
//
// A tela mostrava campanha e elenco e mais nada: "Rodada 3/19" com um 19 escrito
// à mão, nenhum adversário, nenhuma tabela e nenhuma copa. Quem dirigia a base
// não sabia contra quem jogava nem em que posição estava — as três perguntas que
// o modo profissional responde na primeira dobra da tela.
//
// Agora ela lê a MESMA temporada do profissional (calendário, classificação e
// mata-mata montados por `lib/youth-career-engine`).

import { Award, BriefcaseBusiness, CalendarDays, GraduationCap, Play, Trophy, Users, Swords, type LucideIcon } from "lucide-react"
import { GameHeader } from "@/components/game-header"
import { GameSidebar } from "@/components/game-sidebar"
import { Button } from "@/components/ui/button"
import { TeamCrest } from "@/components/team-crest"
import { useGameState } from "@/lib/save-system"
import {
  acceptProfessionalOffer, candidatosAPromocao, finishYouthSeason, proximaPartidaDaBase,
  simulateYouthRound, vagasNoProfissional,
} from "@/lib/youth-career-engine"
import { useGameManager } from "@/lib/use-game-manager"
import { useGameEngine } from "@/lib/game-engine"
import { hardNavigate } from "@/lib/hard-navigation"
import { saveMatchContext } from "@/lib/match-context"
import { allTeams, getTeamByShort } from "@/lib/teams-data"
import { academiasDaDivisao } from "@/lib/youth-career-engine"
import { RankingDeAcademias } from "@/components/base/ranking-de-academias"
import { useTranslation } from "@/lib/i18n"
import { useTelaGamepad } from "@/hooks/use-tela-gamepad"
import { cn } from "@/lib/utils"
import { formatCurrency } from "@/lib/currency"

export default function YouthCareerPage() {
  // ⚠️ A CARREIRA DE BASE NASCEU CHUMBADA EM PORTUGUÊS. O gancho entra na
  // 1.0.377 junto com o ranking de academias, e leva as 14 primeiras chaves.
  const tb = useTranslation().baseSub20
  const { state, setState } = useGameState()
  const { initializeNewGame } = useGameManager()
  // Controle: convencao unica (B volta). Ver hooks/use-tela-gamepad.ts.
  //
  // ⚠️ O B LEVAVA A /base — a academia de quem dirige o PROFISSIONAL, que a
  // 1.0.351 tirou do menu desta modalidade justamente por escrever no mesmo
  // `state.youthPlayers` que e o elenco desta carreira. Numa carreira de base
  // esta tela E a casa: o B nao tem para onde voltar.
  const carreiraDeBaseAtiva = Boolean(state.youthCareer?.active)
  useTelaGamepad({ aoVoltar: () => hardNavigate(carreiraDeBaseAtiva ? "/base/carreira" : "/base") })
  // QUEM VOCE ENTREGA AO PROFISSIONAL — a decisão que a modalidade tomava
  // sozinha até a 1.0.351 (os primeiros da lista com 19+). Ver
  // `finishYouthSeason`.
  const [promovidos, setPromovidos] = useState<string[]>([])
  const career = state.youthCareer
  const players = state.youthPlayers ?? []
  const nivelDaAcademia = useGameEngine(st => st.clubInfrastructure?.youth) ?? 1

  if (!career) {
    return (
      <main className="h-dvh overflow-y-auto bg-[#06090d] text-white">
        <GameHeader />
        <div className="p-10 text-center">
          <p>{tb.sem_carreira_sub20}</p>
          <Button className="mt-4" onClick={() => hardNavigate("/novo-jogo")}>{tb.criar_carreira}</Button>
        </div>
      </main>
    )
  }

  const apply = (next: ReturnType<typeof simulateYouthRound>) => setState(next)
  const elegiveis = career.seasonFinished ? candidatosAPromocao(state) : []
  const vagas = vagasNoProfissional(career)
  const proxima = proximaPartidaDaBase(career)
  const totalDeRodadas = career.calendario?.reduce((n, f) => Math.max(n, f.round), 0) ?? 19
  const tabela = career.tabela ?? []
  const posicao = tabela.findIndex(l => l.curto === career.clubCurto) + 1

  /**
   * Jogar a partida AO VIVO.
   *
   * O adversário sai do CALENDÁRIO — antes era `pool[(round*7+season)%n]`, um
   * clube qualquer do país sorteado na hora, então a partida jogada não era a
   * partida que a competição previa.
   */
  const playMatch = () => {
    const fixture = proxima
    const advCurto = fixture
      ? (fixture.homeCurto === career.clubCurto ? fixture.awayCurto : fixture.homeCurto)
      : undefined
    const opponent = advCurto
      ? getTeamByShort(advCurto)
      : (() => {
          const parent = getTeamByShort(career.clubCurto)
          const pool = allTeams.filter(t => t.curto !== career.clubCurto && (!parent?.pais || t.pais === parent.pais))
          return pool[(career.round * 7 + career.currentSeason) % Math.max(1, pool.length)]
        })()
    if (!opponent) return
    const emCasa = !fixture || fixture.homeCurto === career.clubCurto
    saveMatchContext({
      homeShort: emCasa ? career.clubCurto : opponent.curto,
      awayShort: emCasa ? opponent.curto : career.clubCurto,
      homeKit: "home", awayKit: "away",
      competition: fixture?.competition ?? career.ligaNome ?? career.currentCompetition ?? "Campeonato Sub-20",
      round: `Rodada ${(fixture?.round ?? career.round) + (fixture ? 0 : 1)}`,
      duration: 90, weather: "sunny", matchMode: "normal", friendly: false, youth: true,
    })
    hardNavigate("/partida/ao-vivo")
  }

  const toggleStarter = (id: string) => {
    const ids = career.startingPlayerIds ?? players.slice(0, 11).map(p => p.id)
    const next = ids.includes(id) ? ids.filter(x => x !== id) : ids.length < 11 ? [...ids, id] : ids
    setState({ youthCareer: { ...career, startingPlayerIds: next } })
  }

  const accept = (id: string) => {
    const offer = career.professionalOffers.find(o => o.id === id)
    if (!offer) return
    const archived = acceptProfessionalOffer(state, id).youthCareer
    initializeNewGame(offer.clubCurto, state.managerName, { youthCareer: archived, modalidade: "profissional" })
    hardNavigate("/")
  }

  return (
    <main className="h-dvh overflow-y-auto bg-[#06090d] text-white">
      <GameHeader />
      <GameSidebar />
      <div className="mx-auto max-w-[1500px] px-5 pb-12 pt-20 lg:pl-20">

        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div className="flex items-center gap-4">
            <TeamCrest teamShort={career.clubCurto} size="lg" />
            <div>
              <p className="text-xs font-black uppercase tracking-[.25em] text-[var(--brand)]">{tb.trajetoria_na_base}</p>
              <h1 className="uf-heading mt-1 text-3xl font-black">{career.clubNome}</h1>
              <p className="mt-1 text-white/50">
                Temporada {career.currentSeason} · {career.ligaNome ?? career.currentCompetition}
                {career.pais ? ` · ${career.pais}` : ""}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              disabled={career.seasonFinished || (career.startingPlayerIds?.length ?? 11) !== 11}
              onClick={playMatch}
              className="bg-[var(--brand)] text-[var(--brand-ink)] hover:bg-[#00d9b0]"
            >
              <Swords className="mr-2 h-4 w-4" />Jogar partida
            </Button>
            <Button disabled={career.seasonFinished} onClick={() => apply(simulateYouthRound(state))} variant="outline">
              <Play className="mr-2 h-4 w-4" />Simular rodada
            </Button>
          </div>
        </div>

        <section className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {([
            [tb.rodada, `${career.round}/${totalDeRodadas}`, Play],
            [tb.posicao_na_tabela, posicao > 0 ? `${posicao}º` : "—", Trophy],
            [tb.campanha, `${career.wins}V ${career.draws}E ${career.losses}D`, Award],
            [tb.reputacao, Math.round(career.coachReputation), BriefcaseBusiness],
            [tb.atletas, players.length, Users],
          ] as [string, string | number, LucideIcon][]).map(([label, value, Icon]) => (
            <div key={label} className="rounded-2xl border border-white/10 bg-white/[.04] p-4">
              <Icon className="h-5 w-5 text-[var(--brand)]" />
              <p className="mt-3 text-xs text-white/45">{label}</p>
              <p className="mt-1 text-xl font-black">{value}</p>
            </div>
          ))}
        </section>

        {proxima && (
          <section className="mb-6 rounded-2xl border border-white/10 bg-white/[.03] p-5">
            <h2 className="flex items-center gap-2 text-lg font-black"><CalendarDays className="h-5 w-5 text-[var(--brand)]" />{tb.proxima_partida}</h2>
            <p className="mt-2 text-lg font-bold">
              {proxima.homeCurto === career.clubCurto ? proxima.awayNome : proxima.homeNome}
            </p>
            <p className="text-xs text-white/45">
              {proxima.homeCurto === career.clubCurto ? tb.em_casa : tb.fora} · rodada {proxima.round} · {proxima.competition}
            </p>
          </section>
        )}

        {career.seasonFinished && (
          <section className="mb-6 rounded-2xl border border-amber-400/30 bg-amber-400/10 p-5">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="font-black">{tb.temporada_concluida}</h2>
                <p className="text-sm text-white/60">
                  {elegiveis.length > 0
                    ? `Escolha quem sobe ao profissional — o clube abriu ${vagas} vaga${vagas > 1 ? "s" : ""}.`
                    : tb.sem_atleta_para_subir}
                </p>
              </div>
              <Button onClick={() => apply(finishYouthSeason(state, promovidos))}>
                {promovidos.length > 0 ? `Promover ${promovidos.length} e encerrar` : tb.encerrar_temporada}
              </Button>
            </div>

            {/* ⚠️ ATÉ AQUI ISTO NÃO EXISTIA. `finishYouthSeason` promovia os
                primeiros da lista com 19 anos ou mais e a decisão mais
                importante do modo acontecia sem o técnico. Quem não sobe e já
                passou dos 20 deixa a base — é o que dá peso à escolha. */}
            {elegiveis.length > 0 && (
              <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {elegiveis.map(p => {
                  const escolhido = promovidos.includes(p.id)
                  const cheio = promovidos.length >= vagas && !escolhido
                  return (
                    <button
                      key={p.id}
                      disabled={cheio}
                      onClick={() => setPromovidos(atual => atual.includes(p.id)
                        ? atual.filter(x => x !== p.id)
                        : [...atual, p.id])}
                      className={cn(
                        "flex items-center justify-between gap-3 rounded-xl border p-3 text-left transition-colors",
                        escolhido ? "border-[var(--brand)]/40 bg-[var(--brand)]/10" : "border-white/10 bg-black/25",
                        cheio && "opacity-35",
                      )}
                    >
                      <span>
                        <b className="block text-sm">{p.name}</b>
                        <span className="text-xs text-white/45">{p.position} · {p.age} anos</span>
                      </span>
                      <span className="text-right text-xs">
                        <b className="block text-base">{p.overall}</b>
                        <span className="text-[var(--brand)]">POT {p.potential}</span>
                      </span>
                    </button>
                  )
                })}
              </div>
            )}
            {elegiveis.length > 0 && (
              <p className="mt-3 text-[11px] text-white/40">
                Quem ficar de fora e já tiver 20 anos ou mais deixa a categoria.
              </p>
            )}
          </section>
        )}

        {/* ── RANKING DE ACADEMIAS E CALENDARIO INTERNACIONAL (1.0.377) ────
             ⚠️ VEM ANTES DAS PROPOSTAS DE PROPOSITO. A proposta para o
             profissional e a saida da modalidade; o ranking e a razao de ficar.
             Pondo o convite primeiro, a tela sugere que o objetivo da carreira
             de base e sair dela. */}
        <section className="mb-6">
          <RankingDeAcademias
            clubesDaDivisao={academiasDaDivisao(String(career.divisao ?? ""), career.clubCurto)}
            minha={{
              clubeCurto: career.clubCurto,
              clubeNome: career.clubNome,
              fileKey: getTeamByShort(career.clubCurto)?.file_key ?? career.clubCurto,
              pais: career.pais ?? "Brasil",
              // ⚠️ A FONTE E `clubInfrastructure.youth`, a MESMA que `/base`
              // le (`app/base/page.tsx:151`). Ler outro campo aqui daria dois
              // niveis de academia discordando na mesma partida.
              nivelAcademia: nivelDaAcademia,
              formados: career.alumni.length,
              titulosDeBase: career.titles.length,
              aproveitamento: career.matches > 0
                ? Math.round(((career.wins * 3 + career.draws) / (career.matches * 3)) * 100)
                : 0,
              temporada: career.currentSeason,
            }}
          />
        </section>

        {career.professionalOffers.length > 0 && (
          <section className="mb-6">
            <h2 className="uf-heading mb-3 text-xl font-black">{tb.propostas_para_o_profissional}</h2>
            <div className="grid gap-3 md:grid-cols-2">
              {career.professionalOffers.map(o => (
                <div key={o.id} className="flex items-center justify-between gap-4 rounded-2xl border border-[var(--brand)]/25 bg-[var(--brand)]/5 p-5">
                  <div>
                    <p className="font-black">{o.clubNome}</p>
                    <p className="text-xs text-white/50">
                      {o.role === "head_coach" ? "Técnico principal" : "Comissão profissional"} · {formatCurrency(o.monthlySalary)}/mês · {o.contractMonths} meses
                    </p>
                    <p className="mt-2 text-[11px] text-white/40">Metas: {o.objectives.join(" · ")}</p>
                  </div>
                  <Button onClick={() => accept(o.id)}>{tb.aceitar}</Button>
                </div>
              ))}
            </div>
          </section>
        )}

        <div className="grid gap-5 lg:grid-cols-2">
          {tabela.length > 0 && (
            <section className="rounded-2xl border border-white/10 bg-white/[.03] p-5 lg:col-span-2">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="uf-heading text-xl font-black">{career.ligaNome}</h2>
                {career.copa && (
                  <p className="text-xs text-white/45">
                    {career.copaNome}: {career.copa.champion
                      ? (career.copa.champion === career.clubCurto ? "campeão!" : "eliminado")
                      : `em disputa (${career.copa.currentCupRound}ª fase)`}
                  </p>
                )}
              </div>
              <div className="mt-4 overflow-x-auto">
                <table className="w-full min-w-[560px] text-sm">
                  <thead className="text-[11px] uppercase tracking-wide text-white/40">
                    <tr><th className="p-2 text-left">#</th><th className="p-2 text-left">{tb.academia}</th><th className="p-2">P</th><th className="p-2">J</th><th className="p-2">V</th><th className="p-2">E</th><th className="p-2">D</th><th className="p-2">SG</th></tr>
                  </thead>
                  <tbody>
                    {tabela.map((l, i) => (
                      <tr key={l.curto} className={cn("border-t border-white/5", l.curto === career.clubCurto && "bg-[var(--brand)]/10")}>
                        <td className="p-2 text-white/40">{i + 1}</td>
                        <td className="p-2 font-medium">{l.nome}</td>
                        <td className="p-2 text-center font-black">{l.points}</td>
                        <td className="p-2 text-center text-white/60">{l.played}</td>
                        <td className="p-2 text-center text-white/60">{l.won}</td>
                        <td className="p-2 text-center text-white/60">{l.drawn}</td>
                        <td className="p-2 text-center text-white/60">{l.lost}</td>
                        <td className="p-2 text-center text-white/60">{l.goalDiff}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          <section className="rounded-2xl border border-white/10 bg-white/[.03] p-5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="uf-heading flex items-center gap-2 text-xl font-black"><GraduationCap className="text-[var(--brand)]" />{tb.elenco_sub20}</h2>
              <select
                value={career.formation ?? "4-3-3"}
                onChange={e => setState({ youthCareer: { ...career, formation: e.target.value } })}
                className="rounded-lg border border-white/10 bg-black/50 p-2 text-xs"
              >
                <option>4-3-3</option><option>4-4-2</option><option>4-2-3-1</option><option>3-5-2</option>
              </select>
            </div>
            <p className="mt-2 text-xs text-white/40">
              Selecione exatamente 11 titulares. A média deles é a força do time na simulação e na partida ao vivo.
            </p>
            <div className="mt-4 max-h-[430px] space-y-2 overflow-auto">
              {players.toSorted((a, b) => b.potential - a.potential).map(p => {
                const starter = (career.startingPlayerIds ?? players.slice(0, 11).map(x => x.id)).includes(p.id)
                return (
                  <button
                    key={p.id}
                    onClick={() => toggleStarter(p.id)}
                    className={cn(
                      "grid w-full grid-cols-[auto_1fr_auto_auto] items-center gap-4 rounded-xl p-3 text-left",
                      starter ? "border border-[var(--brand)]/25 bg-[var(--brand)]/10" : "border border-transparent bg-black/30",
                    )}
                  >
                    <span className={cn("text-[9px] font-black", starter ? "text-[var(--brand)]" : "text-white/25")}>{starter ? "TIT" : "RES"}</span>
                    <div>
                      <p className="font-bold">{p.name}</p>
                      <p className="text-xs text-white/40">{p.position} · {p.age} anos</p>
                    </div>
                    <b>{p.overall}</b>
                    <span className="text-[var(--brand)]">POT {p.potential}</span>
                  </button>
                )
              })}
            </div>
          </section>

          <section className="rounded-2xl border border-white/10 bg-white/[.03] p-5">
            <h2 className="uf-heading text-xl font-black">{tb.seu_legado}</h2>
            <p className="mt-1 text-sm text-white/45">Atletas treinados por você continuam sendo acompanhados após sair da base.</p>
            <div className="mt-4 max-h-[430px] space-y-2 overflow-auto">
              {career.alumni.length === 0 ? (
                <p className="py-10 text-center text-white/35">Conclua uma temporada para formar sua primeira geração.</p>
              ) : career.alumni.map(a => (
                <div key={a.playerId} className="rounded-xl bg-black/30 p-3">
                  <div className="flex justify-between gap-3">
                    <b>{a.playerName}</b>
                    <span className="text-sm text-[var(--brand)]">{a.currentClub}</span>
                  </div>
                  <p className="mt-1 text-xs text-white/45">
                    {a.nationalTeamCaps} jogos pela seleção · {a.careerTitles.length} títulos · {a.worldCupTitles} Copa do Mundo
                  </p>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </main>
  )
}
