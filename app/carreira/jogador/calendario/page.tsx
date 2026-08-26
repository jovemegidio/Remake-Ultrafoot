"use client"

// CALENDÁRIO E TABELA DO ATLETA — a segunda tela do modo.
//
// ⚠️ O PEDIDO, NA LETRA: "calendário deveria abrir o mesmo calendário do
// profissional só que adaptado pra carreira do jogador com tabela embutida".
//
// O que se copia do calendário do técnico é a LINGUAGEM: grade de mês em vidro,
// abas de mês no topo, escudo do adversário na célula do dia, placar quando já
// passou, cor por competição, e a coluna lateral com o próximo compromisso. O
// que se ACRESCENTA é o que só existe aqui — a SUA linha em cada jogo: minutos,
// nota e participação. Um calendário de atleta que não diz se ele jogou seria o
// calendário do clube, não o dele.
//
// ⚠️ A TABELA VEM JUNTO, na mesma tela ("com tabela embutida"): ela é a terceira
// coluna, rolando por dentro. Antes classificação era outra aba, e o atleta
// tinha de sair do calendário para saber em que posição o time estava.
//
// ⚠️ E A DATA SAI DA RODADA. O `MatchFixture` do modo atleta guarda `round`, não
// dia nem mês (ver lib/career-types) — a data de cada jogo vem de `getGameDate`,
// a MESMA função que o resto do jogo usa para transformar rodada em dia. Duas
// contas diferentes para a mesma rodada dariam duas datas para o mesmo jogo.

import { useEffect, useMemo, useRef, useState } from "react"
import { CalendarDays, ChevronLeft, ChevronRight, Trophy } from "lucide-react"

import { AtletaShell, PainelDoAtleta } from "@/components/carreira-jogador/atleta-shell"
import { GameHeader } from "@/components/game-header"
import { Button } from "@/components/ui/button"
import { TeamCrest } from "@/components/team-crest"
import { useGameState } from "@/lib/save-system"
import { getTeamByShort } from "@/lib/teams-data"
import { getGameDate } from "@/lib/game-date"
import { hardNavigate } from "@/lib/hard-navigation"
import { useControleDoAtleta } from "@/hooks/use-controle-do-atleta"
import { useTranslation } from "@/lib/i18n"
import { cn } from "@/lib/utils"
import type { MatchFixture } from "@/lib/career-types"

const DIAS_DA_SEMANA = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"]
const MESES_CURTOS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"]

/** Cor da célula por competição — a mesma ideia do calendário do técnico. */
function coresDaCompeticao(nome: string): { fundo: string; borda: string } {
  const n = nome.toLowerCase()
  if (n.includes("libertadores") || n.includes("champions")) return { fundo: "rgba(56,189,248,0.22)", borda: "rgba(56,189,248,0.55)" }
  if (n.includes("copa")) return { fundo: "rgba(244,114,182,0.20)", borda: "rgba(244,114,182,0.50)" }
  if (n.includes("sul-americana") || n.includes("europa")) return { fundo: "rgba(251,191,36,0.20)", borda: "rgba(251,191,36,0.50)" }
  return { fundo: "rgba(0,255,200,0.16)", borda: "rgba(0,255,200,0.45)" }
}

export default function CalendarioDoAtletaPage() {
  useControleDoAtleta({ rota: "/carreira/jogador/calendario" })
  const { state } = useGameState()
  const t = useTranslation()
  const carreira = state.carreiraDeJogador
  const MESES = t.carreiraDeJogador.meses

  /** Os jogos DELE, com a data derivada da rodada. */
  const jogos = useMemo(() => {
    if (!carreira) return []
    return carreira.calendario
      .filter(f => f.isUserMatch)
      .map(f => ({ fixture: f, data: getGameDate(carreira.temporada, f.round) }))
      .sort((a, b) => a.data.getTime() - b.data.getTime())
  }, [carreira])

  const mesesComJogo = useMemo(() => {
    const meses = new Set(jogos.map(j => j.data.getMonth()))
    return meses.size > 0 ? [...meses].sort((a, b) => a - b) : [0]
  }, [jogos])

  /** Abre no mês do PRÓXIMO jogo: é onde o atleta está, não onde o ano começou. */
  const mesInicial = useMemo(() => {
    const proximo = jogos.find(j => !j.fixture.played)
    return (proximo ?? jogos[jogos.length - 1])?.data.getMonth() ?? mesesComJogo[0]
  }, [jogos, mesesComJogo])

  const [mes, setMes] = useState<number>(mesInicial)

  // ⚠️ O SAVE CHEGA DEPOIS DO PRIMEIRO RENDER. `useState(mesInicial)` lia uma
  // carreira ainda vazia e travava o calendário em JANEIRO — o print de teste
  // abriu em janeiro com o próximo jogo em fevereiro. Este efeito puxa o mês uma
  // vez, quando o dado chega, sem desfazer a navegação manual depois (é a mesma
  // solução do calendário do técnico, com a mesma `ref` de controle).
  const mesJaSincronizado = useRef<number | null>(null)
  useEffect(() => {
    if (mesJaSincronizado.current === mesInicial) return
    mesJaSincronizado.current = mesInicial
    setMes(mesInicial)
  }, [mesInicial])

  if (!carreira) {
    return (
      <main className="h-screen overflow-y-auto bg-[#06090d] text-white">
        <GameHeader />
        <div className="p-10 text-center">
          <p className="text-white/70">{t.carreiraDeJogador.nenhuma_carreira_de_jogador_ativa_neste}</p>
          <Button className="mt-4" onClick={() => hardNavigate("/novo-jogo")}>{t.carreiraDeJogador.criar_carreira}</Button>
        </div>
      </main>
    )
  }

  const proxima = jogos.find(j => !j.fixture.played)
  const posicaoNaTabela = Math.max(1, carreira.tabela.findIndex(l => l.curto === carreira.clubeCurto) + 1)

  /** A minha linha naquela partida — o que separa este calendário do do clube. */
  const minhaAtuacao = (f: MatchFixture) =>
    carreira.ultimasPartidas.find(p => p.rodada === f.round && p.temporada === carreira.temporada)

  // ── A grade do mês: 42 casas começando no domingo da primeira semana. ──
  const ano = new Date(carreira.temporada, mes, 1).getFullYear()
  const primeiro = new Date(ano, mes, 1)
  const diasNoMes = new Date(ano, mes + 1, 0).getDate()
  const deslocamento = primeiro.getDay()
  const celulas = Array.from({ length: 42 }, (_, i) => {
    const dia = i - deslocamento + 1
    const doMes = dia >= 1 && dia <= diasNoMes
    const jogo = doMes
      ? jogos.find(j => j.data.getMonth() === mes && j.data.getDate() === dia)
      : undefined
    return { dia, doMes, jogo }
  })

  const jogosDoMes = jogos.filter(j => j.data.getMonth() === mes)

  return (
    <AtletaShell carreira={carreira} ativa="calendario">
      <div className="flex h-full min-h-0 gap-3">

        {/* ── COLUNA DA ESQUERDA: o compromisso e o que ele significa ── */}
        <div className="hidden w-[19rem] shrink-0 flex-col gap-3 xl:flex">
          <PainelDoAtleta titulo={t.carreiraDeJogador.proximo_compromisso} icone={<CalendarDays className="h-5 w-5 text-[var(--brand)]" />} className="shrink-0">
            {proxima ? (
              <>
                <div className="flex items-center gap-3">
                  <TeamCrest
                    team={getTeamByShort(
                      proxima.fixture.homeCurto === carreira.clubeCurto ? proxima.fixture.awayCurto : proxima.fixture.homeCurto,
                    ) ?? undefined}
                    size="lg"
                  />
                  <div className="min-w-0">
                    <p className="truncate text-lg font-bold">
                      {proxima.fixture.homeCurto === carreira.clubeCurto ? proxima.fixture.awayNome : proxima.fixture.homeNome}
                    </p>
                    <p className="text-[11px] text-white/45">
                      {proxima.fixture.homeCurto === carreira.clubeCurto ? t.carreiraDeJogador.em_casa : t.carreiraDeJogador.fora} · rodada {proxima.fixture.round}
                    </p>
                  </div>
                </div>
                <p className="mt-3 text-[11px] uppercase tracking-wide text-white/40">
                  {DIAS_DA_SEMANA[proxima.data.getDay()]}, {proxima.data.getDate()} de {MESES[proxima.data.getMonth()]}
                </p>
                <p className="text-[11px] text-white/45">{proxima.fixture.competition}</p>
              </>
            ) : (
              <p className="text-sm text-white/45">{t.carreiraDeJogador.sem_jogos_pela_frente}</p>
            )}
          </PainelDoAtleta>

          {(carreira.copa || carreira.continental) && (
            <PainelDoAtleta titulo={t.carreiraDeJogador.mata_mata} icone={<Trophy className="h-5 w-5 text-amber-300" />} className="shrink-0">
              <div className="space-y-1.5">
                {[carreira.copa, carreira.continental].filter(Boolean).map(chave => {
                  const bracket = chave!
                  const campeao = bracket.champion === carreira.clubeNome
                  const eliminado = bracket.userEliminatedAtRound !== undefined
                  return (
                    <p key={bracket.competition} className="flex items-center justify-between gap-3 text-xs">
                      <span className="text-white/55">{bracket.competition}</span>
                      <span className={cn("font-bold", campeao ? "text-[var(--brand)]" : eliminado ? "text-white/35" : "text-amber-300/85")}>
                        {campeao ? "campeão!" : eliminado ? "eliminado" : bracket.champion ? "encerrada" : `${bracket.currentCupRound}ª fase`}
                      </span>
                    </p>
                  )
                })}
              </div>
              <p className="mt-2 text-[10px] leading-relaxed text-white/35">
                O mata-mata não tem data no calendário da liga: ele cai nas rodadas-gatilho da temporada.
              </p>
            </PainelDoAtleta>
          )}

          <PainelDoAtleta titulo={`${MESES[mes]} em números`} className="min-h-0 flex-1">
            <div className="space-y-2 text-sm">
              <p className="flex items-center justify-between"><span className="text-white/50">{t.carreiraDeJogador.jogos_no_mes}</span><b>{jogosDoMes.length}</b></p>
              <p className="flex items-center justify-between">
                <span className="text-white/50">{t.carreiraDeJogador.voce_jogou}</span>
                <b>{jogosDoMes.filter(j => (minhaAtuacao(j.fixture)?.minutos ?? 0) > 0).length}</b>
              </p>
              <p className="flex items-center justify-between">
                <span className="text-white/50">{t.carreiraDeJogador.gols_no_mes}</span>
                <b>{jogosDoMes.reduce((n, j) => n + (minhaAtuacao(j.fixture)?.gols ?? 0), 0)}</b>
              </p>
              <p className="flex items-center justify-between">
                <span className="text-white/50">{t.carreiraDeJogador.assistencias}</span>
                <b>{jogosDoMes.reduce((n, j) => n + (minhaAtuacao(j.fixture)?.assistencias ?? 0), 0)}</b>
              </p>
            </div>
            <div className="mt-4 border-t border-white/10 pt-3">
              <p className="text-[10px] font-bold uppercase tracking-wide text-white/40">{t.carreiraDeJogador.legenda}</p>
              <div className="mt-2 space-y-1.5 text-[11px] text-white/50">
                <p><span className="mr-2 inline-block h-2.5 w-2.5 rounded-sm bg-[rgba(0,255,200,0.45)]" />{t.carreiraDeJogador.competicao_liga}</p>
                <p><span className="mr-2 inline-block h-2.5 w-2.5 rounded-sm bg-[rgba(244,114,182,0.5)]" />{t.carreiraDeJogador.competicao_copa_nacional}</p>
                <p><span className="mr-2 inline-block h-2.5 w-2.5 rounded-sm bg-[rgba(56,189,248,0.55)]" />{t.carreiraDeJogador.competicao_continental}</p>
              </div>
            </div>
          </PainelDoAtleta>
        </div>

        {/* ── A GRADE DO MÊS ── */}
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <div className="mb-2 flex shrink-0 items-center gap-2">
            <button
              onClick={() => {
                const i = mesesComJogo.indexOf(mes)
                setMes(mesesComJogo[Math.max(0, i - 1)])
              }}
              className="grid h-8 w-8 place-items-center rounded-lg border border-white/10 bg-black/30 text-white/60 transition-colors hover:text-white"
              aria-label={t.carreiraDeJogador.mes_anterior}
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <div className="flex min-w-0 flex-1 gap-1 overflow-x-auto">
              {mesesComJogo.map(m => (
                <button
                  key={m}
                  onClick={() => setMes(m)}
                  className={cn(
                    "shrink-0 rounded-lg px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide transition-colors",
                    m === mes ? "bg-[var(--brand)]/15 text-[var(--brand)]" : "text-white/40 hover:text-white/70",
                  )}
                >
                  {MESES_CURTOS[m]}
                </button>
              ))}
            </div>
            <button
              onClick={() => {
                const i = mesesComJogo.indexOf(mes)
                setMes(mesesComJogo[Math.min(mesesComJogo.length - 1, i + 1)])
              }}
              className="grid h-8 w-8 place-items-center rounded-lg border border-white/10 bg-black/30 text-white/60 transition-colors hover:text-white"
              aria-label={t.carreiraDeJogador.proximo_mes}
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-white/10 bg-white/[.06] backdrop-blur-md">
            <div className="grid shrink-0 grid-cols-7 border-b border-white/10">
              {DIAS_DA_SEMANA.map(d => (
                <div key={d} className="p-2 text-center text-[10px] font-bold uppercase tracking-wider text-white/40">{d}</div>
              ))}
            </div>
            <div className="grid min-h-0 flex-1 auto-rows-fr grid-cols-7">
              {celulas.map((celula, i) => {
                const f = celula.jogo?.fixture
                const emCasa = f?.homeCurto === carreira.clubeCurto
                const adversario = f ? getTeamByShort(emCasa ? f.awayCurto : f.homeCurto) : null
                const minha = f ? minhaAtuacao(f) : undefined
                const cores = f ? coresDaCompeticao(f.competition) : null
                const golsPro = emCasa ? f?.homeGoals : f?.awayGoals
                const golsContra = emCasa ? f?.awayGoals : f?.homeGoals
                const eProxima = f && f.id === proxima?.fixture.id
                return (
                  <div
                    key={i}
                    className={cn(
                      "relative min-h-0 overflow-hidden border-b border-r border-white/5",
                      !celula.doMes && "opacity-25",
                    )}
                  >
                    <span className={cn(
                      "absolute left-1.5 top-1 text-[11px] font-bold",
                      f ? "text-white" : "text-white/35",
                    )}>
                      {celula.doMes ? celula.dia : ""}
                    </span>
                    {f && cores && (
                      <div
                        title={`${emCasa ? t.carreiraDeJogador.em_casa : t.carreiraDeJogador.fora} · ${emCasa ? f.awayNome : f.homeNome} · ${f.competition}${f.played ? ` · ${golsPro}–${golsContra}` : ""}`}
                        className={cn(
                          "absolute inset-x-1 bottom-1 top-5 flex flex-col items-center justify-center gap-0.5 rounded-lg border",
                          eProxima && "ring-1 ring-[var(--brand)]",
                        )}
                        style={{ backgroundColor: cores.fundo, borderColor: cores.borda }}
                      >
                        {adversario && <TeamCrest team={adversario} size="sm" />}
                        {f.played ? (
                          <span className={cn(
                            "text-[11px] font-black tabular-nums",
                            (golsPro ?? 0) > (golsContra ?? 0) ? "text-emerald-300"
                              : (golsPro ?? 0) === (golsContra ?? 0) ? "text-white/70" : "text-red-300",
                          )}>
                            {golsPro}–{golsContra}
                          </span>
                        ) : (
                          <span className="text-[9px] font-bold uppercase tracking-wide text-white/45">
                            {emCasa ? "casa" : "fora"}
                          </span>
                        )}
                        {/* A SUA linha, curta o bastante para caber na célula. */}
                        {minha && (
                          <span className="text-[9px] leading-none text-white/60">
                            {minha.minutos > 0
                              ? `${minha.minutos}′ · ${minha.nota.toFixed(1)}${minha.gols > 0 ? ` · ${minha.gols}G` : ""}`
                              : "banco"}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* ── A TABELA EMBUTIDA (o pedido explícito) ── */}
        <div className="hidden w-[24rem] shrink-0 lg:block">
          <PainelDoAtleta
            titulo={carreira.ligaNome}
            className="h-full"
            acessorio={<span className="text-[11px] text-white/40">você em {posicaoNaTabela}º</span>}
            contentClassName="px-2 py-2"
          >
            <table className="w-full text-[12px]">
              <thead className="text-[10px] uppercase tracking-wide text-white/40">
                <tr>
                  <th className="p-1.5 text-left">#</th>
                  <th className="p-1.5 text-left">{t.carreiraDeJogador.coluna_clube}</th>
                  <th className="p-1.5">P</th><th className="p-1.5">J</th>
                  <th className="p-1.5">V</th><th className="p-1.5">E</th>
                  <th className="p-1.5">D</th><th className="p-1.5">SG</th>
                </tr>
              </thead>
              <tbody>
                {carreira.tabela.map((l, i) => (
                  <tr key={l.curto} className={cn("border-t border-white/5", l.curto === carreira.clubeCurto && "bg-[var(--brand)]/10")}>
                    <td className="p-1.5 text-white/40">{i + 1}</td>
                    <td className="max-w-[9rem] truncate p-1.5 font-medium">{l.nome}</td>
                    <td className="p-1.5 text-center font-black">{l.points}</td>
                    <td className="p-1.5 text-center text-white/55">{l.played}</td>
                    <td className="p-1.5 text-center text-white/55">{l.won}</td>
                    <td className="p-1.5 text-center text-white/55">{l.drawn}</td>
                    <td className="p-1.5 text-center text-white/55">{l.lost}</td>
                    <td className="p-1.5 text-center text-white/55">{l.goalDiff}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </PainelDoAtleta>
        </div>
      </div>
    </AtletaShell>
  )
}
