"use client"

// CARREIRA ONLINE — a tela do mundo compartilhado (e do clube compartilhado).
//
// ⚠️ O QUE É COMPARTILHADO, E POR QUE ISSO EXIGIU SERVIDOR. Três coisas: a VAGA
// (dois clubes iguais não existem), o MERCADO (o atleta comprado some da lista
// do vizinho no mesmo instante) e o CLUBE (até quatro pessoas dentro dele, uma
// por papel). Nenhuma se resolve no cliente — é por isso que este modo esperou o
// relay, enquanto Rush e Eventos, que são regra sobre o motor local, saíram
// antes.
//
// ⚠️ A PARTIDA É JOGADA AQUI, COM A SEMENTE DE LÁ. O relay não tem motor. Ele
// sorteia uma semente por confronto e diz as duas forças; `semearMotorDePartida`
// faz o motor do jogo produzir a MESMA partida nas duas máquinas. Sem isso, cada
// lado veria um placar e a tabela dependeria de quem clicou primeiro.
//
// ⚠️ OS BOTÕES SAEM DE `permissoes`, NÃO DO PAPEL. Quem decide o que cada papel
// pode é o servidor; a tela só mostra. Deduzir aqui criaria duas regras que
// divergem na primeira mudança — e a que vale seria sempre a outra.
//
// ⚠️ E NÃO ENCOSTA NO SAVE. O elenco anunciado é uma CÓPIA do nome e do overall:
// vender aqui não tira ninguém da sua carreira. É o que o gate
// `test-online-nao-toca-no-save` cobra.

import { useCallback, useEffect, useMemo, useState } from "react"
import { Coins, Eye, Globe2, Loader2, Play, Store, Trophy, Users } from "lucide-react"
import { GameHeader } from "@/components/game-header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { TeamCrest } from "@/components/team-crest"
import { hardNavigate } from "@/lib/hard-navigation"
import { useTelaGamepad } from "@/hooks/use-tela-gamepad"
import { useTranslation } from "@/lib/i18n"
import { cn } from "@/lib/utils"
import { useGameState } from "@/lib/save-system"
import { useUserTeam } from "@/lib/time-da-carreira"
import { allTeams, getTeamByFileKey, type Team } from "@/lib/teams-data"
import { getPlayersForTeam } from "@/lib/players-data"
import {
  createInitialState, startMatch, tickMinute, semearMotorDePartida, type MatchState,
} from "@/lib/match-engine"
import {
  abrirRodada, anunciarAtleta, comprarAnuncio, definirTetoDeCompra, enviarPlacarDoMundo,
  entrarNoMundo, espiarAdversario, estadoDoMundo, papeisLivresDoClube, sairDoMundo,
  type EstadoDoMundo, type PapelNoClube, type PartidaDoMundo, type RelatorioDoOlheiro,
} from "@/lib/carreira-online"

/**
 * A PARTIDA DO MUNDO, jogada com a semente do servidor.
 *
 * A semente é reposta em `null` no fim, sempre: ela é um estado GLOBAL do motor
 * (`semearMotorDePartida`), e deixá-la ligada faria a próxima partida da
 * carreira do jogador sair do mesmo sorteio — um jogo previsível, e ninguém
 * ligaria uma coisa na outra.
 */
function jogarComSemente(partida: PartidaDoMundo, casa: Team, fora: Team): { casa: number; fora: number } {
  semearMotorDePartida(partida.semente)
  try {
    const config = {
      homeTeam: casa,
      awayTeam: fora,
      homeRating: partida.forcaCasa,
      awayRating: partida.forcaFora,
      durationMinutes: 90,
    }
    let estado: MatchState = startMatch(createInitialState())
    let voltas = 0
    while (estado.phase !== "fulltime" && voltas++ < 140) {
      if (estado.pendingVar || estado.pendingPenalty) {
        estado = { ...estado, pendingVar: null, pendingPenalty: null }
      }
      estado = tickMinute(estado, config)
    }
    return { casa: estado.home.goals, fora: estado.away.goals }
  } finally {
    semearMotorDePartida(null)
  }
}

/**
 * O nome da fase pelo numero de clubes vivos.
 *
 * ⚠️ OS ROTULOS VEM DA TRADUCAO, nao chumbados aqui. A primeira versao desta
 * funcao devolvia "Final"/"Semifinal" em texto direto e a catraca de traducao
 * reprovou o build na hora (5574 -> 5578). O portao estava certo: rotulo que o
 * jogador le e frase do jogo, e este jogo se propoe a falar 126 idiomas.
 *
 * ⚠️ Chave maior que oito nao existe (`MAXIMO_NO_MATA_MATA` no relay), entao
 * "oitavas" nunca aparece. Se o teto subir, este rotulo tem de subir junto —
 * senao a tela diz "Mata-mata" generico numa fase que tem nome.
 */
function nomeDaFase(vivos: number, rotulos: {
  final: string; semifinal: string; quartas: string; mata_mata: string
}): string {
  if (vivos <= 2) return rotulos.final
  if (vivos <= 4) return rotulos.semifinal
  if (vivos <= 8) return rotulos.quartas
  return rotulos.mata_mata
}

export default function CarreiraOnlinePage() {
  useTelaGamepad({ aoVoltar: () => hardNavigate("/online") })
  const t = useTranslation()
  const { state } = useGameState()
  const { team: meuTime } = useUserTeam()

  const [mundo, setMundo] = useState<EstadoDoMundo | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [ocupado, setOcupado] = useState(false)
  const [erro, setErro] = useState("")
  const [busca, setBusca] = useState("")
  const [preco, setPreco] = useState("20")
  const [teto, setTeto] = useState("")
  const [relatorio, setRelatorio] = useState<RelatorioDoOlheiro | null>(null)
  // Entrar no clube de um amigo: o clube escolhido e os papéis que sobraram nele.
  const [clubeDeAmigo, setClubeDeAmigo] = useState<{ fileKey: string; nome: string } | null>(null)
  const [papeisLivres, setPapeisLivres] = useState<PapelNoClube[]>([])

  const managerId = state.careerId ?? "convidado"
  const recarregar = useCallback(async () => {
    const novo = await estadoDoMundo(managerId)
    setMundo(novo)
    setCarregando(false)
  }, [managerId])
  useEffect(() => { void recarregar() }, [recarregar])

  const sou = mundo?.sou ?? null
  const clube = mundo?.meuClube ?? null
  const podeJogar = mundo?.permissoes?.jogar ?? false
  const podeNegociar = mundo?.permissoes?.negociar ?? false
  const ocupados = useMemo(() => new Set(mundo?.clubesOcupados ?? []), [mundo?.clubesOcupados])

  const livres = useMemo(() => {
    const alvo = busca.trim().toLowerCase()
    const base = allTeams.filter(c => !ocupados.has(c.file_key))
    const filtrados = alvo ? base.filter(c => c.nome.toLowerCase().includes(alvo)) : base
    return [...filtrados].sort((a, b) => b.prestigio - a.prestigio).slice(0, 18)
  }, [ocupados, busca])

  /** O confronto desta rodada que ainda não tem placar. */
  const minhaPartida = useMemo(
    () => mundo?.minhasPartidas.find(p => p.rodada === mundo.rodada && !p.placar) ?? null,
    [mundo],
  )

  const comAcao = async (acao: () => Promise<{ erro?: string }>) => {
    setOcupado(true); setErro("")
    const r = await acao()
    if (r.erro) setErro(r.erro)
    await recarregar()
    setOcupado(false)
  }

  const entrar = (time: Team, papel: PapelNoClube = "tecnico") => comAcao(async () => entrarNoMundo({
    managerId,
    managerName: state.managerName || t.carreiraOnline.tecnico,
    clube: { fileKey: time.file_key, nome: time.nome },
    forca: time.prestigio,
    papel,
  }))

  const entrarNoClubeDeAmigo = (papel: PapelNoClube) => comAcao(async () => {
    if (!clubeDeAmigo) return {}
    const time = getTeamByFileKey(clubeDeAmigo.fileKey)
    return entrarNoMundo({
      managerId,
      managerName: state.managerName || t.carreiraOnline.tecnico,
      clube: { fileKey: clubeDeAmigo.fileKey, nome: clubeDeAmigo.nome },
      forca: time?.prestigio ?? 60,
      papel,
    })
  })

  const escolherClubeDeAmigo = async (linha: { fileKey: string; clube: string }) => {
    setClubeDeAmigo({ fileKey: linha.fileKey, nome: linha.clube })
    setPapeisLivres(await papeisLivresDoClube(linha.fileKey))
  }

  const jogar = () => comAcao(async () => {
    if (!minhaPartida) return {}
    // Os dois clubes vêm do servidor, inclusive o meu: usar o do save aqui
    // abriria a porta para os dois lados simularem com times diferentes.
    const casa = getTeamByFileKey(minhaPartida.casa)
    const fora = getTeamByFileKey(minhaPartida.fora)
    if (!casa || !fora) return { erro: t.carreiraOnline.clube_desconhecido }
    const placar = jogarComSemente(minhaPartida, casa, fora)
    return enviarPlacarDoMundo({
      matchId: minhaPartida.matchId,
      managerId,
      golsCasa: placar.casa,
      golsFora: placar.fora,
    })
  })

  const espiar = async () => {
    setOcupado(true); setErro("")
    const r = await espiarAdversario(managerId)
    if ("erro" in r) setErro(r.erro); else setRelatorio(r)
    setOcupado(false)
  }

  /** O elenco do clube — a lista de quem dá para anunciar. */
  const meuElenco = useMemo(() => {
    if (!clube) return []
    const time = getTeamByFileKey(clube.fileKey)
    if (!time) return []
    return getPlayersForTeam(time).slice(0, 30)
  }, [clube])

  const nomeDoPapel = (papel: string) => t.carreiraOnline.papeis[papel as PapelNoClube] ?? papel

  if (!state.multiplayerEnabled) {
    return (
      <main className="h-screen overflow-y-auto bg-[#06090d] text-white">
        <GameHeader />
        <div className="mx-auto max-w-xl px-5 pt-28 text-center">
          <h1 className="text-2xl font-black">{t.carreiraOnline.online_desligado}</h1>
          <Button className="mt-5" onClick={() => hardNavigate("/configuracoes")}>
            {t.carreiraOnline.abrir_configuracoes}
          </Button>
        </div>
      </main>
    )
  }

  return (
    <main className="h-screen overflow-y-auto bg-[#06090d] text-white">
      <GameHeader />
      <div className="mx-auto max-w-[1050px] px-5 pb-16 pt-20">
        <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-[.25em] text-[var(--brand)]">{t.carreiraOnline.online}</p>
            <h1 className="mt-1 flex items-center gap-2 text-3xl font-black">
              <Globe2 className="text-[var(--brand)]" />{t.carreiraOnline.titulo}
            </h1>
            <p className="mt-1 max-w-2xl text-sm text-white/50">{t.carreiraOnline.explicacao}</p>
          </div>
          {mundo && (
            <span className="rounded-full border border-white/10 bg-black/40 px-3 py-1 text-[11px] text-white/55">
              {mundo.ocupadas}/{mundo.vagas} {t.carreiraOnline.vagas}
              {" · "}{t.carreiraOnline.temporada} {mundo.temporada ?? 1}
              {" · "}{mundo.fase === "mata" && mundo.mataMata
                ? nomeDaFase(mundo.mataMata.faseAtual, t.carreiraOnline)
                : `${t.carreiraOnline.rodada} ${mundo.rodada}${mundo.rodadasDaTemporada ? `/${mundo.rodadasDaTemporada}` : ""}`}
            </span>
          )}
        </header>

        {/* O FIM DA TEMPORADA TINHA DE SIGNIFICAR ALGUMA COISA. Ate a 1.0.379 o
            mundo girava sem termino — sem campeao e com a tabela nunca zerando.
            A virada acontece no servidor ao abrir a rodada seguinte; sem isto
            aqui, ela aconteceria e ninguem ficaria sabendo. So aparece quando ja
            existe temporada encerrada. */}
        {mundo?.historico && mundo.historico.length > 0 && (
          <p className="-mt-2 flex items-center gap-2 rounded-lg border border-[#ffd700]/30 bg-[#ffd700]/10 px-3 py-2 text-xs text-[#ffd700]">
            <Trophy className="h-4 w-4 shrink-0" />
            <span>
              {t.carreiraOnline.campeao_anterior}: <b>{mundo.historico[0].nomeDoCampeao}</b>
              {" ("}{mundo.historico[0].pontos}{")"}
              {mundo.historico[0].nomeDoCampeaoDaCopa && (
                <>
                  {" · "}{t.carreiraOnline.campeao_da_copa}: <b>{mundo.historico[0].nomeDoCampeaoDaCopa}</b>
                </>
              )}
            </span>
          </p>
        )}

        {carregando ? (
          <p className="flex items-center gap-2 text-sm text-white/45">
            <Loader2 className="h-4 w-4 animate-spin" />{t.carreiraOnline.carregando}
          </p>
        ) : !mundo ? (
          <p className="rounded-2xl border border-amber-300/25 bg-amber-300/[.06] p-5 text-sm text-amber-100/80">
            {t.carreiraOnline.sem_servidor}
          </p>
        ) : !sou ? (
          <section className="rounded-2xl border border-white/10 bg-white/[.04] p-5">
            <h2 className="text-xl font-black">{t.carreiraOnline.escolha_a_vaga}</h2>
            <p className="mt-1 text-sm text-white/50">{t.carreiraOnline.vaga_explicacao}</p>

            {meuTime && !ocupados.has(meuTime.file_key) && (
              <Button
                onClick={() => void entrar(meuTime)}
                disabled={ocupado}
                className="mt-4 w-full bg-[var(--brand)] py-5 font-black text-[var(--brand-ink)] hover:bg-[#00d9b0]"
              >
                {t.carreiraOnline.entrar_com} {meuTime.nome}
              </Button>
            )}

            <Input
              value={busca}
              onChange={e => setBusca(e.target.value)}
              placeholder={t.carreiraOnline.procurar_clube}
              className="mt-4 bg-black/40"
            />
            <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {livres.map(c => (
                <button
                  key={c.file_key}
                  onClick={() => void entrar(c)}
                  disabled={ocupado}
                  className="flex items-center gap-3 rounded-xl border border-white/10 bg-black/30 p-3 text-left transition-colors hover:border-[var(--brand)]/50 disabled:opacity-40"
                >
                  <TeamCrest fileKey={c.file_key} size="sm" />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-bold">{c.nome}</span>
                    <span className="block text-[11px] text-white/40">{c.prestigio} {t.carreiraOnline.forca}</span>
                  </span>
                </button>
              ))}
            </div>

            {/* CARREIRA COOPERATIVA E DIRETORIA ONLINE: entrar no clube de outra
                pessoa não é outro mundo — é um papel livre no MESMO clube. */}
            {mundo.tabela.length > 0 && (
              <div className="mt-6 rounded-xl border border-white/10 bg-black/25 p-4">
                <h3 className="flex items-center gap-2 text-sm font-black">
                  <Users className="h-4 w-4 text-[var(--brand)]" />{t.carreiraOnline.entrar_num_clube_existente}
                </h3>
                <p className="mt-1 text-[12px] text-white/45">{t.carreiraOnline.clube_existente_explicacao}</p>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {mundo.tabela.map(l => (
                    <button
                      key={l.fileKey}
                      onClick={() => void escolherClubeDeAmigo(l)}
                      className={cn(
                        "flex items-center gap-3 rounded-lg border p-2.5 text-left",
                        clubeDeAmigo?.fileKey === l.fileKey ? "border-[var(--brand)]/50 bg-[var(--brand)]/[.07]" : "border-white/10 bg-black/30",
                      )}
                    >
                      <TeamCrest fileKey={l.fileKey} size="sm" />
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-bold">{l.clube}</span>
                        <span className="block truncate text-[11px] text-white/40">
                          {Object.entries(l.papeis).map(([papel, quem]) => `${nomeDoPapel(papel)}: ${quem?.nome}`).join(" · ")}
                        </span>
                      </span>
                    </button>
                  ))}
                </div>
                {clubeDeAmigo && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {papeisLivres.length === 0 ? (
                      <p className="text-[12px] text-white/40">{t.carreiraOnline.clube_lotado}</p>
                    ) : papeisLivres.map(papel => (
                      <Button key={papel} size="sm" variant="outline" disabled={ocupado} onClick={() => void entrarNoClubeDeAmigo(papel)}>
                        {t.carreiraOnline.entrar_como} {nomeDoPapel(papel)}
                      </Button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </section>
        ) : (
          <>
            <section className="mb-5 rounded-2xl border border-[var(--brand)]/25 bg-[var(--brand)]/[.06] p-5">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <TeamCrest fileKey={sou.fileKey} size="lg" />
                  <div>
                    <p className="text-lg font-black">{clube?.nome}</p>
                    <p className="text-[11px] text-white/50">
                      {t.carreiraOnline.voce_e} <b className="text-[var(--brand)]">{nomeDoPapel(sou.papel)}</b>
                      {" · "}{t.carreiraOnline.forca} {clube ? clube.forcaBase : 0}
                      {" · "}{clube?.reforcos.length ?? 0} {t.carreiraOnline.reforcos}
                    </p>
                  </div>
                </div>
                <span className="flex items-center gap-2 rounded-full border border-white/10 bg-black/40 px-3 py-1 text-sm font-black">
                  <Coins className="h-4 w-4 text-[var(--brand)]" />{clube?.caixa} {t.carreiraOnline.milhoes}
                </span>
                <Button variant="outline" disabled={ocupado} onClick={() => void comAcao(async () => { await sairDoMundo(managerId); return {} })}>
                  {t.carreiraOnline.deixar_o_mundo}
                </Button>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                {(["tecnico", "diretor", "presidente", "olheiro"] as PapelNoClube[]).map(papel => {
                  const quem = mundo.papeisDoMeuClube[papel]
                  return (
                    <span
                      key={papel}
                      className={cn(
                        "rounded-full border px-3 py-1 text-[11px]",
                        quem ? "border-white/15 bg-black/35 text-white/70" : "border-dashed border-white/10 text-white/30",
                      )}
                    >
                      {nomeDoPapel(papel)}: {quem ? quem.nome : t.carreiraOnline.vago}
                    </span>
                  )
                })}
              </div>
              {clube?.tetoDeCompra != null && (
                <p className="mt-2 text-[11px] text-amber-200/70">
                  {t.carreiraOnline.teto_vigente} {clube.tetoDeCompra} {t.carreiraOnline.milhoes}
                </p>
              )}
            </section>

            <section className="mb-5 rounded-2xl border border-white/10 bg-white/[.04] p-5">
              <h2 className="flex items-center gap-2 text-xl font-black">
                <Play className="text-[var(--brand)]" />{t.carreiraOnline.sua_rodada}
              </h2>
              {minhaPartida ? (
                <>
                  <div className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-black/30 p-4">
                    <span className="min-w-0 flex-1 truncate text-sm font-bold">{minhaPartida.nomeCasa}</span>
                    <span className="font-mono text-white/35">×</span>
                    <span className="min-w-0 flex-1 truncate text-right text-sm font-bold">{minhaPartida.nomeFora}</span>
                  </div>
                  <p className="mt-2 text-[11px] text-white/35">{t.carreiraOnline.semente_explicacao}</p>
                  {podeJogar ? (
                    <Button
                      onClick={() => void jogar()}
                      disabled={ocupado}
                      className="mt-3 w-full bg-[var(--brand)] py-5 font-black text-[var(--brand-ink)] hover:bg-[#00d9b0]"
                    >
                      {ocupado ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                      {t.carreiraOnline.jogar_a_partida}
                    </Button>
                  ) : (
                    <p className="mt-3 rounded-xl border border-white/10 bg-black/25 p-3 text-sm text-white/50">
                      {t.carreiraOnline.quem_joga_e_o_tecnico} {mundo.papeisDoMeuClube.tecnico?.nome}
                    </p>
                  )}
                  {mundo.permissoes?.espiar && (
                    <Button variant="outline" className="mt-2 w-full" disabled={ocupado} onClick={() => void espiar()}>
                      <Eye className="mr-2 h-4 w-4" />{t.carreiraOnline.relatorio_do_olheiro}
                    </Button>
                  )}
                  {relatorio && (
                    <div className="mt-2 rounded-xl border border-white/10 bg-black/30 p-3 text-[12px] text-white/60">
                      <b className="text-white">{relatorio.clube}</b> · {t.carreiraOnline.forca} {relatorio.forca} ·{" "}
                      {relatorio.caixa} {t.carreiraOnline.milhoes}
                      {relatorio.reforcos.length > 0 && (
                        <span className="block">
                          {relatorio.reforcos.map(r => `${r.nome} (${r.posicao} ${r.overall})`).join(" · ")}
                        </span>
                      )}
                    </div>
                  )}
                </>
              ) : (
                <>
                  <p className="mt-2 text-sm text-white/50">
                    {mundo.pendentes > 0 ? `${t.carreiraOnline.esperando_outros} (${mundo.pendentes})` : t.carreiraOnline.rodada_encerrada}
                  </p>
                  <Button
                    variant="outline"
                    className="mt-3 w-full"
                    disabled={ocupado || mundo.pendentes > 0 || mundo.ocupadas < 2 || !mundo.permissoes?.abrirRodada}
                    onClick={() => void comAcao(async () => abrirRodada(managerId))}
                  >
                    {mundo.permissoes?.abrirRodada
                      ? t.carreiraOnline.abrir_proxima_rodada
                      : `${t.carreiraOnline.quem_abre_e_o_presidente} ${mundo.papeisDoMeuClube.presidente?.nome ?? ""}`}
                  </Button>
                </>
              )}

              {mundo.minhasPartidas.filter(p => p.placar).length > 0 && (
                <div className="mt-4 space-y-1.5">
                  {mundo.minhasPartidas.filter(p => p.placar).map(p => (
                    <div key={p.matchId} className="flex items-center gap-3 text-[13px] text-white/60">
                      <span className="w-8 text-right font-mono text-white/30">{p.rodada}</span>
                      <span className="min-w-0 flex-1 truncate">{p.nomeCasa}</span>
                      <span className="font-mono font-black text-white">{p.placar?.casa}–{p.placar?.fora}</span>
                      <span className="min-w-0 flex-1 truncate text-right">{p.nomeFora}</span>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {mundo.permissoes?.definirTeto && (
              <section className="mb-5 rounded-2xl border border-white/10 bg-black/25 p-5">
                <h2 className="text-sm font-black uppercase tracking-wide text-white/45">{t.carreiraOnline.mesa_do_presidente}</h2>
                <p className="mt-1 text-[12px] text-white/45">{t.carreiraOnline.teto_explicacao}</p>
                <div className="mt-3 flex items-center gap-2">
                  <Input
                    value={teto}
                    onChange={e => setTeto(e.target.value.replace(/[^0-9]/g, ""))}
                    className="w-28 bg-black/40 text-center font-mono"
                    aria-label={t.carreiraOnline.teto}
                  />
                  <Button size="sm" disabled={ocupado} onClick={() => void comAcao(async () => definirTetoDeCompra({ managerId, teto: teto === "" ? null : Number(teto) }))}>
                    {t.carreiraOnline.definir_teto}
                  </Button>
                  <Button size="sm" variant="outline" disabled={ocupado} onClick={() => { setTeto(""); void comAcao(async () => definirTetoDeCompra({ managerId, teto: null })) }}>
                    {t.carreiraOnline.sem_teto}
                  </Button>
                </div>
              </section>
            )}

            <section className="mb-5 rounded-2xl border border-white/10 bg-white/[.03] p-5">
              <h2 className="flex items-center gap-2 text-xl font-black">
                <Store className="text-[var(--brand)]" />{t.carreiraOnline.mercado}
              </h2>
              <p className="mt-1 text-sm text-white/50">
                {podeNegociar ? t.carreiraOnline.mercado_explicacao : `${t.carreiraOnline.quem_negocia_e_o_diretor} ${mundo.papeisDoMeuClube.diretor?.nome ?? ""}`}
              </p>

              {mundo.mercado.length === 0 ? (
                <p className="mt-3 text-sm text-white/40">{t.carreiraOnline.mercado_vazio}</p>
              ) : (
                <div className="mt-3 space-y-2">
                  {mundo.mercado.map(a => (
                    <div key={a.anuncioId} className="flex flex-wrap items-center gap-3 rounded-xl border border-white/10 bg-black/30 p-3">
                      <span className="w-10 text-center font-mono text-[11px] text-white/40">{a.atleta.posicao}</span>
                      <span className="min-w-0 flex-1 truncate text-sm font-bold">{a.atleta.nome}</span>
                      <span className="font-mono text-sm text-white/60">{a.atleta.overall}</span>
                      <span className="text-[11px] text-white/35">{a.vendedor}</span>
                      <span className="font-mono text-sm font-black text-[var(--brand)]">{a.preco}</span>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={ocupado || !podeNegociar || a.clube === sou.fileKey || (clube?.caixa ?? 0) < a.preco}
                        onClick={() => void comAcao(async () => comprarAnuncio({ managerId, anuncioId: a.anuncioId }))}
                      >
                        {a.clube === sou.fileKey ? t.carreiraOnline.seu : t.carreiraOnline.comprar}
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              {podeNegociar && (
                <>
                  <h3 className="mt-5 text-xs font-black uppercase tracking-wide text-white/40">{t.carreiraOnline.anunciar}</h3>
                  <div className="mt-2 flex items-center gap-2">
                    <Input
                      value={preco}
                      onChange={e => setPreco(e.target.value.replace(/[^0-9]/g, ""))}
                      className="w-28 bg-black/40 text-center font-mono"
                      aria-label={t.carreiraOnline.preco}
                    />
                    <span className="text-[11px] text-white/40">{t.carreiraOnline.preco_em_milhoes}</span>
                  </div>
                  <div className="mt-2 grid max-h-56 gap-2 overflow-y-auto sm:grid-cols-2">
                    {meuElenco.map(j => (
                      <button
                        key={`${j.nome}-${j.pos}`}
                        disabled={ocupado}
                        onClick={() => void comAcao(async () => anunciarAtleta({
                          managerId,
                          atleta: {
                            id: String(j.ft ?? `${sou.fileKey}-${j.nome}`),
                            nome: j.nome,
                            posicao: String(j.pos),
                            overall: j.base,
                          },
                          preco: Number(preco) || 1,
                        }))}
                        className="flex items-center gap-2 rounded-lg border border-white/10 bg-black/25 p-2 text-left text-[13px] hover:border-[var(--brand)]/40 disabled:opacity-40"
                      >
                        <span className="w-9 text-center font-mono text-[10px] text-white/40">{j.pos}</span>
                        <span className="min-w-0 flex-1 truncate font-bold">{j.nome}</span>
                        <span className="font-mono text-white/55">{j.base}</span>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </section>
          </>
        )}

        {erro && (
          <p className="mb-5 rounded-xl border border-red-400/25 bg-red-400/[.06] p-3 text-sm text-red-200">
            {t.carreiraOnline.erros[erro as keyof typeof t.carreiraOnline.erros] ?? erro}
          </p>
        )}

        {mundo && mundo.tabela.length > 0 && (
          <section className="rounded-2xl border border-white/10 bg-white/[.03] p-5">
            <h2 className="flex items-center gap-2 text-xl font-black">
              <Trophy className="text-[var(--brand)]" />{t.carreiraOnline.tabela}
            </h2>
            <table className="mt-3 w-full text-sm">
              <thead className="text-[11px] uppercase tracking-wide text-white/40">
                <tr>
                  <th className="p-2 text-left">#</th>
                  <th className="p-2 text-left">{t.carreiraOnline.clube}</th>
                  <th className="p-2 text-left">{t.carreiraOnline.comissao}</th>
                  <th className="p-2">P</th><th className="p-2">J</th>
                  <th className="p-2">V</th><th className="p-2">E</th><th className="p-2">D</th>
                  <th className="p-2">SG</th>
                </tr>
              </thead>
              <tbody>
                {mundo.tabela.map(l => (
                  <tr key={l.fileKey} className={cn("border-t border-white/5", l.fileKey === sou?.fileKey && "bg-[var(--brand)]/10")}>
                    <td className="p-2 text-white/40">{l.posicao}</td>
                    <td className="p-2 font-medium">{l.clube}</td>
                    <td className="p-2 text-[12px] text-white/55">
                      {Object.values(l.papeis).map(q => q?.nome).filter(Boolean).join(", ")}
                    </td>
                    <td className="p-2 text-center font-black">{l.pontos}</td>
                    <td className="p-2 text-center text-white/60">{l.j}</td>
                    <td className="p-2 text-center text-white/60">{l.v}</td>
                    <td className="p-2 text-center text-white/60">{l.e}</td>
                    <td className="p-2 text-center text-white/60">{l.d}</td>
                    <td className="p-2 text-center text-white/60">{l.saldo > 0 ? `+${l.saldo}` : l.saldo}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-4 text-center text-[11px] text-white/30">{t.carreiraOnline.nao_toca_na_carreira}</p>
          </section>
        )}
      </div>
    </main>
  )
}
