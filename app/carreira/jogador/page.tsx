"use client"

// A TELA DA CARREIRA DE JOGADOR.
//
// Uma tela só, de propósito. O modo tem cinco coisas para dizer e todas cabem
// numa leitura: onde eu jogo, se eu vou jogar, o que me cobram, como eu evoluo
// e quem me quer. Espalhar isso por seis rotas (como o modo de técnico faz, e
// ali faz sentido) transformaria um modo de partida-a-partida numa peregrinação
// de menus entre uma rodada e outra.

import { useMemo, useState } from "react"
import {
  Award, BarChart3, CalendarDays, ChevronRight, Flag, Play, Star, Target, TrendingUp, Users,
} from "lucide-react"
import { GameHeader } from "@/components/game-header"
import { GameSidebar } from "@/components/game-sidebar"
import { Button } from "@/components/ui/button"
import { TeamCrest } from "@/components/team-crest"
import { useGameState } from "@/lib/save-system"
import { hardNavigate } from "@/lib/hard-navigation"
import { useTelaGamepad } from "@/hooks/use-tela-gamepad"
import { cn } from "@/lib/utils"
import {
  aceitarProposta, encerrarTemporada, fazerPedido, gastarPonto, jogarProximaRodada,
  mediaDaTemporada, minutosEsperados, papelNoElenco, recusarPropostas,
  type AtributosDoAtleta, type EstadoCarreiraDeJogador,
} from "@/lib/carreira-de-jogador"

const ATRIBUTOS: { chave: keyof AtributosDoAtleta; nome: string }[] = [
  { chave: "ritmo", nome: "Ritmo" },
  { chave: "finalizacao", nome: "Finalização" },
  { chave: "passe", nome: "Passe" },
  { chave: "drible", nome: "Drible" },
  { chave: "defesa", nome: "Defesa" },
  { chave: "fisico", nome: "Físico" },
]

/** Nota do treinador (0–100) nas cinco estrelas que o jogador reconhece. */
function Estrelas({ nota }: { nota: number }) {
  const cheias = nota / 20
  return (
    <div className="flex items-center gap-1">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          className={cn("h-4 w-4", cheias >= i + 1 ? "fill-amber-400 text-amber-400" : cheias >= i + 0.5 ? "fill-amber-400/50 text-amber-400" : "text-white/20")}
        />
      ))}
    </div>
  )
}

function corDaNota(nota: number): string {
  return nota >= 8 ? "text-emerald-400" : nota >= 7 ? "text-[var(--brand)]" : nota >= 6 ? "text-amber-300" : "text-red-400"
}

export default function CarreiraDeJogadorPage() {
  useTelaGamepad({ aoVoltar: () => hardNavigate("/") })
  const { state, setState } = useGameState()
  const carreira = state.carreiraDeJogador
  const [aba, setAba] = useState<"temporada" | "evolucao" | "tabela" | "historico">("temporada")

  const proxima = useMemo(
    () => carreira?.calendario.find(f => !f.played && f.isUserMatch),
    [carreira],
  )

  if (!carreira) {
    return (
      <main className="h-dvh overflow-y-auto bg-[#06090d] text-white">
        <GameHeader />
        <div className="p-10 text-center">
          <p className="text-white/70">Nenhuma carreira de jogador ativa neste save.</p>
          <Button className="mt-4" onClick={() => hardNavigate("/novo-jogo")}>Criar carreira</Button>
        </div>
      </main>
    )
  }

  const aplicar = (novo: EstadoCarreiraDeJogador) => setState({ carreiraDeJogador: novo })
  const { atleta } = carreira
  const media = mediaDaTemporada(carreira)
  const papel = papelNoElenco(carreira.notaDoTreinador)
  const posicaoNaTabela = Math.max(1, carreira.tabela.findIndex(l => l.curto === carreira.clubeCurto) + 1)

  return (
    <main className="h-dvh overflow-y-auto bg-[#06090d] text-white">
      <GameHeader />
      <GameSidebar />
      <div className="mx-auto max-w-[1500px] px-5 pb-14 pt-20 lg:pl-24">

        {/* ── Cabeçalho: quem, onde e em que pé está ── */}
        <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div className="flex items-center gap-4">
            <TeamCrest fileKey={carreira.clubeFileKey} size="xl" />
            <div>
              <p className="text-xs font-black uppercase tracking-[.25em] text-[var(--brand)]">
                {atleta.posicao} · {atleta.idade} anos · {atleta.nacionalidade}
              </p>
              <h1 className="mt-1 text-3xl font-black">{atleta.nome}</h1>
              <p className="mt-1 text-white/50">
                {carreira.clubeNome} · {carreira.ligaNome} · Temporada {carreira.temporada}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {!carreira.aposentado && !carreira.temporadaEncerrada && (
              <Button onClick={() => aplicar(jogarProximaRodada(carreira))} className="bg-[var(--brand)] text-[var(--brand-ink)] hover:bg-[#00d9b0]">
                <Play className="mr-2 h-4 w-4" /> Jogar rodada
              </Button>
            )}
            {carreira.temporadaEncerrada && !carreira.aposentado && (
              <Button onClick={() => aplicar(encerrarTemporada(carreira))}>
                <ChevronRight className="mr-2 h-4 w-4" /> Encerrar temporada
              </Button>
            )}
          </div>
        </header>

        {carreira.aposentado && (
          <section className="mb-6 rounded-2xl border border-amber-400/30 bg-amber-400/10 p-5">
            <h2 className="font-black">Carreira encerrada</h2>
            <p className="mt-1 text-sm text-white/65">
              {carreira.historico.reduce((n, h) => n + h.jogos, 0)} jogos · {carreira.historico.reduce((n, h) => n + h.gols, 0)} gols ·{" "}
              {carreira.historico.reduce((n, h) => n + h.assistencias, 0)} assistências · {carreira.titulos.length} títulos ·{" "}
              {carreira.selecao.jogos} jogos pela seleção.
            </p>
          </section>
        )}

        {/* ── Os cinco números que o modo inteiro gira em torno ── */}
        <section className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <div className="rounded-2xl border border-white/10 bg-white/[.04] p-4">
            <Star className="h-5 w-5 text-[var(--brand)]" />
            <p className="mt-3 text-xs text-white/45">Nota do treinador</p>
            <div className="mt-1 flex items-center gap-2">
              <Estrelas nota={carreira.notaDoTreinador} />
            </div>
            <p className="mt-1 text-[11px] uppercase tracking-wide text-white/40">{papel}</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[.04] p-4">
            <BarChart3 className="h-5 w-5 text-[var(--brand)]" />
            <p className="mt-3 text-xs text-white/45">Média na temporada</p>
            <p className={cn("mt-1 text-2xl font-black", corDaNota(media))}>{media > 0 ? media.toFixed(2) : "—"}</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[.04] p-4">
            <Target className="h-5 w-5 text-[var(--brand)]" />
            <p className="mt-3 text-xs text-white/45">Gols / assistências</p>
            <p className="mt-1 text-2xl font-black">{carreira.temporadaAtual.gols} / {carreira.temporadaAtual.assistencias}</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[.04] p-4">
            <Users className="h-5 w-5 text-[var(--brand)]" />
            <p className="mt-3 text-xs text-white/45">Jogos (titular)</p>
            <p className="mt-1 text-2xl font-black">{carreira.temporadaAtual.jogos} <span className="text-base text-white/40">({carreira.temporadaAtual.titularidades})</span></p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[.04] p-4">
            <TrendingUp className="h-5 w-5 text-[var(--brand)]" />
            <p className="mt-3 text-xs text-white/45">Overall / potencial</p>
            <p className="mt-1 text-2xl font-black">{atleta.overall} <span className="text-base text-white/40">/ {atleta.potencial}</span></p>
          </div>
        </section>

        {/* ── PROPOSTAS. Aparecem no fim da temporada e param a tela: é a
             decisão mais pesada do modo. ── */}
        {carreira.propostas.length > 0 && (
          <section className="mb-6">
            <h2 className="mb-3 text-xl font-black">Propostas na mesa</h2>
            <div className="grid gap-3 md:grid-cols-3">
              {carreira.propostas.map(p => (
                <div key={p.id} className="rounded-2xl border border-[var(--brand)]/25 bg-[var(--brand)]/5 p-5">
                  <div className="flex items-center gap-3">
                    <TeamCrest fileKey={p.clubeFileKey} size="md" />
                    <div>
                      <p className="font-black">{p.clubeNome}</p>
                      <p className="text-xs text-white/45">Prestígio {p.prestigio}</p>
                    </div>
                  </div>
                  <p className="mt-3 text-sm text-white/70">
                    R$ {p.salarioSemanal.toLocaleString("pt-BR")}/semana · {p.temporadas} temporadas
                  </p>
                  <p className="mt-1 text-[11px] text-white/40">{p.motivo}</p>
                  <Button className="mt-3 w-full" onClick={() => aplicar(aceitarProposta(carreira, p.id))}>Aceitar</Button>
                </div>
              ))}
            </div>
            <Button variant="outline" className="mt-3" onClick={() => aplicar(recusarPropostas(carreira))}>Ficar no clube</Button>
          </section>
        )}

        {/* ── Abas ── */}
        <nav className="mb-4 flex flex-wrap gap-2">
          {([["temporada", "Temporada"], ["evolucao", "Evolução"], ["tabela", "Classificação"], ["historico", "Trajetória"]] as const).map(([id, rotulo]) => (
            <button
              key={id}
              onClick={() => setAba(id)}
              className={cn(
                "rounded-xl border px-4 py-2 text-xs font-bold uppercase tracking-wide transition-colors",
                aba === id ? "border-[var(--brand)]/50 bg-[var(--brand)]/10 text-white" : "border-white/10 bg-black/30 text-white/55 hover:text-white",
              )}
            >
              {rotulo}
            </button>
          ))}
        </nav>

        {aba === "temporada" && (
          <div className="grid gap-5 lg:grid-cols-3">
            {/* PRÓXIMA PARTIDA + previsão de minutos: o jogador precisa saber
                ANTES se vai entrar — é o que dá sentido a pedir mais minutos. */}
            <section className="rounded-2xl border border-white/10 bg-white/[.03] p-5">
              <h2 className="flex items-center gap-2 text-xl font-black"><CalendarDays className="text-[var(--brand)]" />Próxima partida</h2>
              {proxima ? (
                <>
                  <p className="mt-3 text-lg font-bold">
                    {proxima.homeCurto === carreira.clubeCurto ? proxima.awayNome : proxima.homeNome}
                  </p>
                  <p className="text-xs text-white/45">
                    {proxima.homeCurto === carreira.clubeCurto ? "Em casa" : "Fora"} · rodada {proxima.round} · {proxima.competition}
                  </p>
                  <p className="mt-4 text-xs text-white/45">Expectativa do treinador</p>
                  <p className="text-sm font-bold text-[var(--brand)]">{minutosEsperados(carreira)}</p>
                </>
              ) : (
                <p className="mt-3 text-white/45">Temporada concluída. Encerre para virar o ano.</p>
              )}
              <div className="mt-5 flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={() => aplicar(fazerPedido(carreira, "mais_minutos"))}>Pedir minutos</Button>
                <Button variant="outline" size="sm" onClick={() => aplicar(fazerPedido(carreira, "transferencia"))}>Pedir transferência</Button>
                {carreira.pedido !== "nenhum" && (
                  <Button variant="ghost" size="sm" onClick={() => aplicar(fazerPedido(carreira, "nenhum"))}>Retirar pedido</Button>
                )}
              </div>
              <p className="mt-3 text-[11px] text-white/35">
                Contrato até {carreira.contrato.ateTemporada} · R$ {carreira.contrato.salarioSemanal.toLocaleString("pt-BR")}/semana
              </p>
            </section>

            {/* METAS */}
            <section className="rounded-2xl border border-white/10 bg-white/[.03] p-5">
              <h2 className="flex items-center gap-2 text-xl font-black"><Target className="text-[var(--brand)]" />Metas da temporada</h2>
              <div className="mt-4 space-y-3">
                {carreira.metas.map(meta => (
                  <div key={meta.id}>
                    <div className="flex items-center justify-between gap-3 text-sm">
                      <span className={meta.cumprida ? "text-emerald-400" : "text-white/70"}>{meta.descricao}</span>
                      <b className="text-white/50">{meta.progresso}/{meta.alvo}</b>
                    </div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/10">
                      <div
                        className={cn("h-full rounded-full", meta.cumprida ? "bg-emerald-400" : "bg-[var(--brand)]")}
                        style={{ width: `${Math.min(100, (meta.progresso / Math.max(0.01, meta.alvo)) * 100)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
              {carreira.selecao.convocada && (
                <p className="mt-4 flex items-center gap-2 rounded-lg border border-emerald-400/25 bg-emerald-400/10 px-3 py-2 text-[11px] text-emerald-200/80">
                  <Flag className="h-3.5 w-3.5" />
                  Seleção {carreira.selecao.nivel === "sub20" ? "Sub-20" : "principal"} · {carreira.selecao.jogos} jogos, {carreira.selecao.gols} gols
                </p>
              )}
            </section>

            {/* ÚLTIMAS PARTIDAS */}
            <section className="rounded-2xl border border-white/10 bg-white/[.03] p-5">
              <h2 className="text-xl font-black">Últimas atuações</h2>
              <div className="mt-4 max-h-[360px] space-y-2 overflow-auto">
                {carreira.ultimasPartidas.length === 0 && <p className="py-8 text-center text-white/35">Ainda sem partidas nesta carreira.</p>}
                {carreira.ultimasPartidas.map(p => (
                  <div key={`${p.temporada}-${p.rodada}`} className="rounded-xl bg-black/30 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm font-bold">{p.casa ? "vs" : "@"} {p.adversario}</span>
                      <span className="text-sm text-white/60">{p.golsPro}–{p.golsContra}</span>
                    </div>
                    <p className="mt-1 text-[11px] text-white/45">
                      {p.minutos > 0
                        ? <>{p.titular ? "Titular" : "Entrou"} · {p.minutos}′ · {p.gols}G {p.assistencias}A{p.cartao ? ` · cartão ${p.cartao}` : ""}</>
                        : "Não saiu do banco"}
                      {p.minutos > 0 && <span className={cn("ml-2 font-black", corDaNota(p.nota))}>{p.nota.toFixed(1)}</span>}
                    </p>
                  </div>
                ))}
              </div>
            </section>
          </div>
        )}

        {aba === "evolucao" && (
          <div className="grid gap-5 lg:grid-cols-2">
            <section className="rounded-2xl border border-white/10 bg-white/[.03] p-5">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-xl font-black">Atributos</h2>
                <span className="rounded-full border border-[var(--brand)]/30 bg-[var(--brand)]/10 px-3 py-1 text-xs font-bold text-[var(--brand)]">
                  {carreira.crescimento.pontosDisponiveis} pontos
                </span>
              </div>
              <p className="mt-1 text-[11px] text-white/40">
                Nível {carreira.crescimento.nivel} · pontos saem de minutos jogados, gols e notas altas.
                Atributo acima de 75 custa 2 pontos; acima de 85, três. O teto é o seu potencial ({atleta.potencial}).
              </p>
              <div className="mt-4 space-y-3">
                {ATRIBUTOS.map(({ chave, nome }) => (
                  <div key={chave} className="flex items-center gap-3">
                    <span className="w-28 text-sm text-white/60">{nome}</span>
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/10">
                      <div className="h-full rounded-full bg-[var(--brand)]" style={{ width: `${atleta.atributos[chave]}%` }} />
                    </div>
                    <b className="w-8 text-right">{atleta.atributos[chave]}</b>
                    <Button
                      size="sm" variant="outline"
                      disabled={carreira.crescimento.pontosDisponiveis <= 0 || atleta.atributos[chave] >= 99}
                      onClick={() => aplicar(gastarPonto(carreira, chave))}
                    >+</Button>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-2xl border border-white/10 bg-white/[.03] p-5">
              <h2 className="text-xl font-black">Recados</h2>
              <div className="mt-4 max-h-[420px] space-y-2 overflow-auto">
                {carreira.recados.map(r => (
                  <div key={r.id} className="rounded-xl bg-black/30 p-3">
                    <p className="text-[11px] font-bold uppercase tracking-wide text-[var(--brand)]">{r.de}</p>
                    <p className="mt-1 text-sm text-white/75">{r.texto}</p>
                    <p className="mt-1 text-[10px] text-white/30">Temporada {r.temporada} · rodada {r.rodada}</p>
                  </div>
                ))}
              </div>
            </section>
          </div>
        )}

        {aba === "tabela" && (
          <section className="rounded-2xl border border-white/10 bg-white/[.03] p-5">
            <h2 className="text-xl font-black">{carreira.ligaNome} · {carreira.temporada}</h2>
            <p className="mt-1 text-xs text-white/45">Seu clube está em {posicaoNaTabela}º.</p>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[560px] text-sm">
                <thead className="text-[11px] uppercase tracking-wide text-white/40">
                  <tr><th className="p-2 text-left">#</th><th className="p-2 text-left">Clube</th><th className="p-2">P</th><th className="p-2">J</th><th className="p-2">V</th><th className="p-2">E</th><th className="p-2">D</th><th className="p-2">SG</th></tr>
                </thead>
                <tbody>
                  {carreira.tabela.map((l, i) => (
                    <tr key={l.curto} className={cn("border-t border-white/5", l.curto === carreira.clubeCurto && "bg-[var(--brand)]/10")}>
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

        {aba === "historico" && (
          <section className="rounded-2xl border border-white/10 bg-white/[.03] p-5">
            <h2 className="flex items-center gap-2 text-xl font-black"><Award className="text-[var(--brand)]" />Trajetória</h2>
            {carreira.historico.length === 0 ? (
              <p className="py-10 text-center text-white/35">Encerre a primeira temporada para começar a escrever sua história.</p>
            ) : (
              <div className="mt-4 overflow-x-auto">
                <table className="w-full min-w-[720px] text-sm">
                  <thead className="text-[11px] uppercase tracking-wide text-white/40">
                    <tr><th className="p-2 text-left">Temporada</th><th className="p-2 text-left">Clube</th><th className="p-2">J</th><th className="p-2">G</th><th className="p-2">A</th><th className="p-2">Média</th><th className="p-2">Pos.</th><th className="p-2 text-left">Conquistas</th></tr>
                  </thead>
                  <tbody>
                    {carreira.historico.map(h => (
                      <tr key={`${h.temporada}-${h.clubeNome}`} className="border-t border-white/5">
                        <td className="p-2">{h.temporada}</td>
                        <td className="p-2">{h.clubeNome}</td>
                        <td className="p-2 text-center">{h.jogos}</td>
                        <td className="p-2 text-center">{h.gols}</td>
                        <td className="p-2 text-center">{h.assistencias}</td>
                        <td className={cn("p-2 text-center font-bold", corDaNota(h.notaMedia))}>{h.notaMedia.toFixed(2)}</td>
                        <td className="p-2 text-center">{h.posicaoNaLiga}º</td>
                        <td className="p-2 text-white/60">{[...h.titulos, ...h.premios].join(" · ") || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}
      </div>
    </main>
  )
}
