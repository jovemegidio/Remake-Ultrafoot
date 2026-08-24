"use client"

// O ESCRITÓRIO DO ATLETA — a primeira das quatro telas do modo.
//
// ⚠️ ELA NÃO ROLA MAIS, e essa é a correção que o usuário pediu com print
// ("remover o scroll do office do jogador"). A versão anterior era uma coluna
// que crescia para baixo: as abas empilhavam painel sobre painel, o fim do
// último cartão passava por baixo da barra de controle e da barra do FC Hub, e
// o que sobrava era uma faixa preta no rodapé.
//
// A correção não é aumentar o `padding-bottom` (já se tentou duas vezes: pb-14
// → pb-36). É a tela caber: `AtletaShell` fixa a altura em `h-screen`, esta grade
// divide o que sobra em colunas de altura inteira e QUEM ROLA É O PAINEL, por
// dentro. Ver components/carreira-jogador/atleta-shell.
//
// ⚠️ E AS ABAS VIRARAM TELAS. Evolução, calendário e trajetória saíram daqui
// para rotas próprias — era o que o menu do cabeçalho já prometia e não
// entregava (ver o comentário do shell).

import { useEffect, useMemo, useState } from "react"
import {
  BarChart3, Battery, BriefcaseBusiness, CalendarDays, ChevronRight, Flag, Handshake, Heart, Newspaper,
  Play, Star, Target, TrendingUp, Users, Wallet,
} from "lucide-react"

import { AtletaShell, PainelDoAtleta, rotaDaAbaAntiga } from "@/components/carreira-jogador/atleta-shell"
import { GameHeader } from "@/components/game-header"
import { Button } from "@/components/ui/button"
import { TeamCrest } from "@/components/team-crest"
import { useGameState } from "@/lib/save-system"
import { useGameManager } from "@/lib/use-game-manager"
import { getTeamByFileKey } from "@/lib/teams-data"
import { hardNavigate } from "@/lib/hard-navigation"
import { useTelaGamepad } from "@/hooks/use-tela-gamepad"
import { useTranslation } from "@/lib/i18n"
import { cn } from "@/lib/utils"
import { conversasDoMomento, responderConversa, rotuloDoInterlocutor } from "@/lib/conversas-do-atleta"
import { formatCurrency } from "@/lib/currency"
import {
  aceitarProposta, avancarSemanaSemClube, comprarEnergia, contrapropor, descartarProposta, economiaDoAtleta, encerrarTemporada,
  entrevistaDaVez, fazerPedido, jogarProximaRodada, mediaDaTemporada, minutosEsperados,
  papelNoElenco, potencialVisivel, recusarPropostas, reputacaoDeTreinador, responderEntrevista,
  resumoDaCarreira, trocarEmpresario, fazerAposta, interagirComParceira, EMPRESARIOS,
  type EstadoCarreiraDeJogador, type PedidoDaNegociacao, type PropostaDeClube,
} from "@/lib/carreira-de-jogador"

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

/** Cartão da faixa de números do topo. Compacto: ele não pode roubar altura. */
function Numero({ icone, rotulo, children, nota }: { icone: React.ReactNode; rotulo: string; children: React.ReactNode; nota?: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/55 px-3.5 py-2.5 backdrop-blur-sm">
      <div className="flex items-center gap-2 text-[10px] uppercase tracking-wide text-white/45">
        {icone}{rotulo}
      </div>
      <div className="mt-1 text-xl font-black leading-tight">{children}</div>
      {nota && <p className="text-[10px] uppercase tracking-wide text-white/35">{nota}</p>}
    </div>
  )
}

/** Os quatro pedidos que o agente pode levar à mesa, com o rótulo da tela. */
const PEDIDOS: { id: PedidoDaNegociacao; rotulo: string }[] = [
  { id: "salario", rotulo: "+ salário" },
  { id: "luvas", rotulo: "+ luvas" },
  { id: "status", rotulo: "+ status" },
  { id: "temporadas", rotulo: "+ tempo" },
]

/** Cartão de proposta. O mesmo em fim de temporada e no mercado de agente livre. */
function CartaoDaProposta({
  proposta, comMesa, onAceitar, onContrapor, onDescartar,
}: {
  proposta: PropostaDeClube
  /** A mesa de negociação só existe para quem está sem clube. */
  comMesa: boolean
  onAceitar: () => void
  onContrapor: (pedido: PedidoDaNegociacao) => void
  onDescartar: () => void
}) {
  const retirada = Boolean(proposta.negociacao?.retirada)
  return (
    <div className={cn(
      "rounded-2xl border p-4",
      retirada ? "border-white/[.07] bg-black/30 opacity-60" : "border-[var(--brand)]/25 bg-[var(--brand)]/5",
    )}>
      <div className="flex items-center gap-3">
        <TeamCrest fileKey={proposta.clubeFileKey} size="md" />
        <div className="min-w-0">
          <p className="truncate font-black">{proposta.clubeNome}</p>
          <p className="text-[11px] text-white/45">
            Prestígio {proposta.prestigio} · promete {proposta.statusPrometido}
          </p>
        </div>
      </div>
      <p className="mt-2.5 text-sm text-white/75">
        {formatCurrency(proposta.salarioSemanal)}/semana · {proposta.temporadas} temporada(s)
        {(proposta.luvas ?? 0) > 0 && <> · luvas {formatCurrency(proposta.luvas ?? 0)}</>}
      </p>
      <p className="mt-1 text-[11px] text-white/40">{proposta.motivo}</p>

      {comMesa && proposta.negociacao?.ultimaResposta && (
        <p className={cn(
          "mt-2.5 rounded-lg border px-3 py-2 text-[11px]",
          retirada ? "border-red-400/25 bg-red-400/[.07] text-red-200/85" : "border-white/10 bg-black/30 text-white/70",
        )}>
          {proposta.negociacao.ultimaResposta}
        </p>
      )}

      {comMesa && !retirada && (
        <>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {PEDIDOS.map(p => (
              <button
                key={p.id}
                onClick={() => onContrapor(p.id)}
                className="rounded-lg border border-white/12 bg-black/35 px-2.5 py-1 text-[11px] font-bold text-white/70 transition-colors hover:border-[var(--brand)]/40 hover:text-white"
              >
                {p.rotulo}
              </button>
            ))}
          </div>
          <p className="mt-1.5 text-[10px] text-white/35">
            Paciência do clube: {Math.max(0, proposta.negociacao?.paciencia ?? 0)} · cada pedido gasta uma.
          </p>
        </>
      )}

      <div className="mt-3 flex gap-2">
        <Button className="flex-1" disabled={retirada} onClick={onAceitar}>Assinar</Button>
        {comMesa && (
          <Button variant="outline" size="sm" onClick={onDescartar}>Recusar</Button>
        )}
      </div>
    </div>
  )
}

export default function CarreiraDeJogadorPage() {
  useTelaGamepad({ aoVoltar: () => hardNavigate("/") })
  const { state, setState } = useGameState()
  const t = useTranslation()
  const { initializeNewGame } = useGameManager()
  const carreira = state.carreiraDeJogador
  const [respostaDaConversa, setRespostaDaConversa] = useState<string>("")

  // ⚠️ COMPATIBILIDADE COM O `?aba=` (1.0.358). As abas viraram rotas, mas link
  // antigo — de save, de recado ou de um menu que não recarregou — continua
  // chegando aqui com a query. Em vez de abrir a tela errada em silêncio, ela
  // leva para a tela nova.
  useEffect(() => {
    const destino = rotaDaAbaAntiga(new URLSearchParams(window.location.search).get("aba"))
    if (destino) hardNavigate(destino, true)
  }, [])

  const proxima = useMemo(
    () => carreira?.calendario.find(f => !f.played && f.isUserMatch),
    [carreira],
  )
  const mataMataPendente = useMemo(
    () => !proxima && !carreira?.temporadaEncerrada
      && [carreira?.copa, carreira?.continental].some(b => b && !b.champion && b.userEliminatedAtRound === undefined),
    [proxima, carreira],
  )

  if (!carreira) {
    return (
      <main className="h-screen overflow-y-auto bg-[#06090d] text-white">
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
  const semClube = carreira.semClube
  const media = mediaDaTemporada(carreira)
  const papel = papelNoElenco(carreira.notaDoTreinador)
  const jogosNaCarreira = carreira.historico.reduce((n, h) => n + h.jogos, 0) + carreira.temporadaAtual.jogos
  const faixaDePotencial = potencialVisivel(atleta, jogosNaCarreira)
  const resumo = resumoDaCarreira(carreira)
  const entrevista = entrevistaDaVez(carreira)
  const conversas = conversasDoMomento(carreira)
  const temPropostas = carreira.propostas.length > 0
  const economia = economiaDoAtleta(carreira)

  // ── Os botões do canto direito. Sem clube, o tempo passa por semana. ──
  const acoes = carreira.aposentado ? null : semClube ? (
    <Button
      onClick={() => aplicar(avancarSemanaSemClube(carreira))}
      className="bg-[var(--brand)] text-[var(--brand-ink)] hover:bg-[#00d9b0]"
    >
      <ChevronRight className="mr-2 h-4 w-4" /> Avançar semana
    </Button>
  ) : (
    <>
      {!carreira.temporadaEncerrada && (
        <>
          <Button
            onClick={() => {
              const comPartida = jogarProximaRodada(carreira, { viver: true })
              setState({ carreiraDeJogador: comPartida })
              if (comPartida.partidaEmCurso) hardNavigate("/carreira/jogador/partida")
            }}
            className="bg-[var(--brand)] text-[var(--brand-ink)] hover:bg-[#00d9b0]"
          >
            <Play className="mr-2 h-4 w-4" /> Viver a partida
          </Button>
          <Button variant="outline" onClick={() => aplicar(jogarProximaRodada(carreira))}>Simular rodada</Button>
        </>
      )}
      {carreira.temporadaEncerrada && (
        <Button onClick={() => aplicar(encerrarTemporada(carreira))}>
          <ChevronRight className="mr-2 h-4 w-4" /> Encerrar temporada
        </Button>
      )}
    </>
  )

  return (
    <AtletaShell carreira={carreira} ativa="escritorio" acoes={acoes}>
      <div className="flex h-full min-h-0 flex-col gap-3">

        {/* ── A faixa de números. Compacta de propósito: cada pixel dela sai da
             altura dos painéis, e são eles que contam a temporada. ── */}
        <section className="grid shrink-0 gap-2.5 sm:grid-cols-3 lg:grid-cols-7">
          <Numero icone={<Star className="h-3.5 w-3.5 text-[var(--brand)]" />} rotulo={t.carreiraDeJogador.nota_do_treinador} nota={semClube ? t.carreiraDeJogador.sem_clube_min : papel}>
            <Estrelas nota={carreira.notaDoTreinador} />
          </Numero>
          <Numero icone={<BarChart3 className="h-3.5 w-3.5 text-[var(--brand)]" />} rotulo={t.carreiraDeJogador.media_na_temporada}>
            <span className={corDaNota(media)}>{media > 0 ? media.toFixed(2) : "—"}</span>
          </Numero>
          <Numero icone={<Target className="h-3.5 w-3.5 text-[var(--brand)]" />} rotulo={t.carreiraDeJogador.gols_assistencias}>
            {carreira.temporadaAtual.gols} / {carreira.temporadaAtual.assistencias}
          </Numero>
          <Numero icone={<Users className="h-3.5 w-3.5 text-[var(--brand)]" />} rotulo={t.carreiraDeJogador.jogos_titular}>
            {carreira.temporadaAtual.jogos} <span className="text-sm text-white/40">({carreira.temporadaAtual.titularidades})</span>
          </Numero>
          <Numero icone={<TrendingUp className="h-3.5 w-3.5 text-[var(--brand)]" />} rotulo={t.carreiraDeJogador.overall_teto}>
            {atleta.overall} <span className="text-sm text-white/40">/ {faixaDePotencial.min}–{faixaDePotencial.max}</span>
          </Numero>
          <Numero icone={<Battery className="h-3.5 w-3.5 text-amber-300" />} rotulo="Energia">
            {economia.energia}<span className="text-sm text-white/40">/{economia.energiaMaxima}</span>
          </Numero>
          <Numero icone={<Wallet className="h-3.5 w-3.5 text-emerald-300" />} rotulo="Carteira">
            <span className="text-base">{formatCurrency(economia.dinheiro)}</span>
          </Numero>
        </section>

        {/* ── CARREIRA ENCERRADA. Ocupa a tela: não há mais temporada para ver. ── */}
        {carreira.aposentado ? (
          <PainelDoAtleta titulo={t.carreiraDeJogador.carreira_encerrada} icone={<Star className="h-5 w-5 text-amber-300" />} className="min-h-0 flex-1">
            <p className="text-sm text-white/70">
              {resumo.jogos} jogos · {resumo.gols} gols · {resumo.assistencias} assistências ·{" "}
              {resumo.titulos.length} títulos · {resumo.premios.length} prêmios individuais ·{" "}
              {resumo.selecao.jogos} jogos pela seleção · auge em {resumo.overallMaximo} de overall.
            </p>
            {/* O MESMO save continua: o atleta aposentado vira o técnico do
                último clube, com a reputação que construiu em campo. */}
            <div className="mt-5 flex flex-wrap items-center gap-3">
              <Button
                onClick={() => {
                  const time = getTeamByFileKey(resumo.ultimoClubeFileKey)
                  if (!time) return
                  initializeNewGame(time.curto, atleta.nome, {
                    modalidade: "profissional",
                    carreiraDeJogador: { ...carreira, aposentado: true },
                  }, time.file_key)
                  hardNavigate("/?career=1")
                }}
                className="bg-[var(--brand)] text-[var(--brand-ink)] hover:bg-[#00d9b0]"
              >
                <BriefcaseBusiness className="mr-2 h-4 w-4" />
                Tornar-se treinador do {carreira.clubeNome}
              </Button>
              <span className="text-[11px] text-white/45">
                Reputação de estreia: {reputacaoDeTreinador(resumo)} — construída pelo que você fez como atleta.
              </span>
            </div>
          </PainelDoAtleta>
        ) : semClube ? (

          /* ── SEM CLUBE (1.0.358) ────────────────────────────────────────
             O escritório do atleta livre. Não há próxima partida nem meta de
             temporada: o que existe é o cartaz, o telefone e a mesa. */
          <div className="grid min-h-0 flex-1 gap-3 lg:grid-cols-3">
            <PainelDoAtleta
              titulo={t.carreiraDeJogador.sem_clube}
              icone={<Handshake className="h-5 w-5 text-amber-300" />}
              acessorio={<span className="text-[11px] text-white/40">semana {semClube.semanas}</span>}
            >
              <p className="text-sm text-white/70">{semClube.motivo} — saiu do {semClube.ultimoClubeNome}.</p>
              <div className="mt-4">
                <div className="flex items-center justify-between text-[11px] uppercase tracking-wide text-white/45">
                  <span>Cartaz no mercado</span><b className="text-white/75">{semClube.cartaz}</b>
                </div>
                <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-white/10">
                  <div
                    className={cn("h-full rounded-full", semClube.cartaz >= 62 ? "bg-emerald-400" : semClube.cartaz >= 38 ? "bg-[var(--brand)]" : "bg-amber-400")}
                    style={{ width: `${semClube.cartaz}%` }}
                  />
                </div>
                <p className="mt-2 text-[11px] leading-relaxed text-white/45">
                  É o que o seu desempenho no {semClube.ultimoClubeNome} comprou. Ele decide o
                  TAMANHO de quem liga — e cai a cada semana parado, porque quem não joga some do radar.
                </p>
              </div>

              <div className="mt-4 border-t border-white/10 pt-3 text-[11px] text-white/45">
                <p>Empresário: <b className="text-white/70">{carreira.empresario.nome}</b> · negociação {carreira.empresario.negociacao} · influência {carreira.empresario.influencia} · exterior {carreira.empresario.redeInternacional}</p>
                <p className="mt-1">Forma: <b className="text-white/70">{Math.round(carreira.forma)}</b> — sem treino de grupo ela cede.</p>
              </div>

              <div className="mt-4 border-t border-white/10 pt-3">
                <p className="text-[11px] font-bold uppercase tracking-wide text-white/40">Diário do mercado</p>
                <div className="mt-2 space-y-1.5">
                  {semClube.diario.map(linha => (
                    <p key={`${linha.semana}-${linha.texto.slice(0, 24)}`} className="text-[12px] leading-relaxed text-white/60">
                      <span className="mr-1.5 font-mono text-white/30">S{linha.semana}</span>{linha.texto}
                    </p>
                  ))}
                </div>
              </div>
            </PainelDoAtleta>

            <PainelDoAtleta
              titulo={t.carreiraDeJogador.propostas_na_mesa}
              icone={<Handshake className="h-5 w-5 text-[var(--brand)]" />}
              className="lg:col-span-2"
              acessorio={<span className="text-[11px] text-white/40">{carreira.propostas.length} na mesa</span>}
            >
              {carreira.propostas.length === 0 ? (
                <p className="py-10 text-center text-sm leading-relaxed text-white/40">
                  Nenhuma proposta ainda. Avance a semana: o telefone toca conforme o seu cartaz —
                  e não tocar também é uma resposta do mercado.
                </p>
              ) : (
                <div className="grid gap-3 md:grid-cols-2">
                  {carreira.propostas.map(p => (
                    <CartaoDaProposta
                      key={p.id}
                      proposta={p}
                      comMesa
                      onAceitar={() => aplicar(aceitarProposta(carreira, p.id))}
                      onContrapor={pedido => aplicar(contrapropor(carreira, p.id, pedido))}
                      onDescartar={() => aplicar(descartarProposta(carreira, p.id))}
                    />
                  ))}
                </div>
              )}
            </PainelDoAtleta>
          </div>

        ) : temPropostas ? (

          /* ── PROPOSTAS DE FIM DE TEMPORADA. Elas param a tela: é a decisão
               mais pesada do modo, e não divide espaço com o resto. ── */
          <div className="grid min-h-0 flex-1 gap-3 lg:grid-cols-3">
            <PainelDoAtleta
              titulo={t.carreiraDeJogador.propostas_na_mesa}
              icone={<Handshake className="h-5 w-5 text-[var(--brand)]" />}
              className="lg:col-span-2"
              acessorio={
                <Button variant="outline" size="sm" onClick={() => aplicar(recusarPropostas(carreira))}>
                  Ficar no clube
                </Button>
              }
            >
              <div className="grid gap-3 md:grid-cols-2">
                {carreira.propostas.map(p => (
                  <CartaoDaProposta
                    key={p.id}
                    proposta={p}
                    comMesa={false}
                    onAceitar={() => aplicar(aceitarProposta(carreira, p.id))}
                    onContrapor={() => undefined}
                    onDescartar={() => undefined}
                  />
                ))}
              </div>
            </PainelDoAtleta>

            <PainelDoAtleta titulo={t.carreiraDeJogador.repercussao} acessorio={<span className="text-[11px] text-white/40">reputação {carreira.reputacao ?? 30}</span>}>
              {(carreira.repercussao?.length ?? 0) === 0 ? (
                <p className="text-sm leading-relaxed text-white/45">{t.carreiraDeJogador.repercussao_vazia}</p>
              ) : (
                <div className="space-y-2">
                  {(carreira.repercussao ?? []).map(post => (
                    <div key={post.id} className="rounded-xl bg-black/30 p-3">
                      <p className="text-[11px] font-bold text-sky-300">{post.autor}</p>
                      <p className="mt-0.5 text-[13px] text-white/75">{post.texto}</p>
                    </div>
                  ))}
                </div>
              )}
            </PainelDoAtleta>
          </div>

        ) : (

          /* ── A TEMPORADA CORRENDO: três colunas de altura inteira. ── */
          <div className="grid min-h-0 flex-1 gap-3 lg:grid-cols-3">

            {/* PRÓXIMA PARTIDA + contrato + empresário. */}
            <PainelDoAtleta titulo={t.carreiraDeJogador.proxima_partida} icone={<CalendarDays className="h-5 w-5 text-[var(--brand)]" />}>
              {proxima ? (
                <>
                  <p className="text-lg font-bold">
                    {proxima.homeCurto === carreira.clubeCurto ? proxima.awayNome : proxima.homeNome}
                  </p>
                  <p className="text-xs text-white/45">
                    {proxima.homeCurto === carreira.clubeCurto ? t.carreiraDeJogador.em_casa : t.carreiraDeJogador.fora} · rodada {proxima.round} · {proxima.competition}
                  </p>
                  <p className="mt-3 text-xs text-white/45">Expectativa do treinador</p>
                  <p className="text-sm font-bold text-[var(--brand)]">{minutosEsperados(carreira)}</p>

                  <div className="mt-3 rounded-xl border border-white/10 bg-black/25 p-3">
                    <p className="text-[10px] font-black uppercase tracking-wide text-white/40">Aposta da rodada</p>
                    {carreira.apostaAtiva ? (
                      <p className="mt-1 text-xs text-amber-200/80">
                        {carreira.apostaAtiva.palpite} · {formatCurrency(carreira.apostaAtiva.valor)} · x{carreira.apostaAtiva.multiplicador}
                      </p>
                    ) : (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {(["vitoria", "empate", "derrota"] as const).map(palpite => (
                          <button key={palpite} onClick={() => aplicar(fazerAposta(carreira, palpite, Math.max(100, Math.floor(economia.dinheiro * 0.1))))} className="rounded-lg border border-white/10 bg-white/[.04] px-2 py-1 text-[10px] font-bold capitalize text-white/65 hover:border-amber-300/40">
                            {palpite}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {(carreira.suspensao?.partidasRestantes ?? 0) > 0 && (
                    <p className="mt-3 rounded-lg border border-red-400/25 bg-red-400/[.08] px-3 py-2 text-xs text-red-200/85">
                      Suspenso por {carreira.suspensao!.motivo}: fica de fora de{" "}
                      {carreira.suspensao!.partidasRestantes} partida{carreira.suspensao!.partidasRestantes > 1 ? "s" : ""}.
                    </p>
                  )}
                  {(carreira.lesao?.semanasRestantes ?? 0) > 0 && (
                    <p className="mt-2 rounded-lg border border-amber-400/25 bg-amber-400/[.08] px-3 py-2 text-xs text-amber-100/85">
                      Lesão {carreira.lesao!.gravidade}: {carreira.lesao!.semanasRestantes} semana(s) de recuperação.
                    </p>
                  )}
                  {(carreira.amarelosAcumulados ?? 0) >= 3 && !carreira.suspensao && (
                    <p className="mt-2 text-[11px] text-amber-300/70">
                      {carreira.amarelosAcumulados} amarelos — o quinto suspende.
                    </p>
                  )}
                </>
              ) : (
                <p className="text-white/45">
                  {mataMataPendente
                    ? t.carreiraDeJogador.liga_encerrada_mata_mata
                    : t.carreiraDeJogador.temporada_concluida}
                </p>
              )}

              {(carreira.copa || carreira.continental) && (
                <div className="mt-4 space-y-1.5 border-t border-white/10 pt-3">
                  {[carreira.copa, carreira.continental].filter(Boolean).map(chave => {
                    const bracket = chave!
                    const campeao = bracket.champion === carreira.clubeNome
                    const eliminado = bracket.userEliminatedAtRound !== undefined
                    return (
                      <p key={bracket.competition} className="flex items-center justify-between gap-3 text-xs">
                        <span className="text-white/55">{bracket.competition}</span>
                        <span className={cn(
                          "font-bold",
                          campeao ? "text-[var(--brand)]" : eliminado ? "text-white/35" : "text-amber-300/85",
                        )}>
                          {campeao ? "campeão!"
                            : eliminado ? "eliminado"
                              : bracket.champion ? "encerrada"
                                : `na disputa · ${bracket.currentCupRound}ª fase`}
                        </span>
                      </p>
                    )
                  })}
                </div>
              )}

              <div className="mt-4 flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={() => aplicar(fazerPedido(carreira, "mais_minutos"))}>Pedir minutos</Button>
                <Button variant="outline" size="sm" onClick={() => aplicar(fazerPedido(carreira, "transferencia"))}>Pedir transferência</Button>
                {carreira.pedido !== "nenhum" && (
                  <Button variant="ghost" size="sm" onClick={() => aplicar(fazerPedido(carreira, "nenhum"))}>Retirar pedido</Button>
                )}
              </div>

              <div className="mt-4 space-y-1 border-t border-white/10 pt-3 text-[11px] text-white/45">
                <p>
                  Contrato até <b className="text-white/70">{carreira.contrato.ateTemporada}</b> ·{" "}
                  {formatCurrency(carreira.contrato.salarioSemanal)}/semana
                  {carreira.contrato.statusPrometido ? ` · prometido: ${carreira.contrato.statusPrometido}` : ""}
                </p>
                {(carreira.contrato.bonusPorGol ?? 0) > 0 && (
                  <p>
                    Bônus: {formatCurrency((carreira.contrato.bonusPorGol ?? 0))} por gol ·{" "}
                    {formatCurrency((carreira.contrato.bonusPorTitulo ?? 0))} por título
                  </p>
                )}
                <p>Ganhos na temporada: <b className="text-emerald-300/80">{formatCurrency(carreira.ganhosDaTemporada)}</b></p>
                <div className="flex items-center gap-1.5 pt-1">
                  <Button variant="outline" size="sm" onClick={() => aplicar(comprarEnergia(carreira, 25))}>+25 energia · {formatCurrency(4_000)}</Button>
                  <Button variant="outline" size="sm" onClick={() => aplicar(comprarEnergia(carreira, 60))}>+60 · {formatCurrency(8_500)}</Button>
                </div>
                <p className="pt-1">
                  Empresário: <b className="text-white/70">{carreira.empresario.nome}</b> ·{" "}
                  negociação {carreira.empresario.negociacao} · influência {carreira.empresario.influencia} ·{" "}
                  exterior {carreira.empresario.redeInternacional} · {carreira.empresario.comissao}% de comissão
                </p>
                <select
                  value={carreira.empresario.nome}
                  onChange={e => aplicar(trocarEmpresario(carreira, e.target.value))}
                  aria-label={t.carreiraDeJogador.trocar_de_empresario}
                  className="mt-1 h-9 w-full rounded-lg border border-white/15 bg-black/50 px-2 text-[11px] text-white"
                >
                  {EMPRESARIOS.map(emp => (
                    <option key={emp.nome} value={emp.nome}>
                      {emp.nome} — {emp.comissao}% · neg {emp.negociacao} / infl {emp.influencia} / ext {emp.redeInternacional}
                    </option>
                  ))}
                </select>
              </div>
            </PainelDoAtleta>

            {/* METAS + a conversa da vez (imprensa e vestiário). */}
            <div className="flex min-h-0 flex-col gap-3">
              <PainelDoAtleta titulo={t.carreiraDeJogador.metas_da_temporada} icone={<Target className="h-5 w-5 text-[var(--brand)]" />} className="min-h-0 flex-1">
                <div className="space-y-3">
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
                    Seleção {carreira.selecao.nivel === "sub20" ? t.carreiraDeJogador.sub20 : "principal"} · {carreira.selecao.jogos} jogos, {carreira.selecao.gols} gols
                  </p>
                )}

                <div className="mt-4 border-t border-white/10 pt-3">
                  <p className="flex items-center gap-2 text-[11px] font-black uppercase tracking-wide text-pink-200/75"><Heart className="h-4 w-4" />Relacionamento</p>
                  {carreira.parceira ? (
                    <>
                      <p className="mt-1 text-sm font-bold">{carreira.parceira.nome} · {carreira.parceira.fase.replace("_", " ")}</p>
                      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/10"><div className="h-full bg-pink-400" style={{ width: `${carreira.parceira.afinidade}%` }} /></div>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        <button onClick={() => aplicar(interagirComParceira(carreira, "conversar"))} className="rounded-lg border border-white/10 px-2 py-1 text-[10px]">Conversar</button>
                        <button onClick={() => aplicar(interagirComParceira(carreira, "encontro"))} className="rounded-lg border border-white/10 px-2 py-1 text-[10px]">Encontro</button>
                        <button onClick={() => aplicar(interagirComParceira(carreira, "presente"))} className="rounded-lg border border-white/10 px-2 py-1 text-[10px]">Presente</button>
                      </div>
                    </>
                  ) : (
                    <button onClick={() => aplicar(interagirComParceira(carreira, "conhecer"))} className="mt-2 rounded-lg border border-pink-300/25 bg-pink-300/[.06] px-3 py-1.5 text-xs text-pink-100/80">Conhecer alguem</button>
                  )}
                </div>
              </PainelDoAtleta>

              {(entrevista || conversas.length > 0) && (
                <PainelDoAtleta
                  titulo={entrevista ? t.carreiraDeJogador.entrevista : t.carreiraDeJogador.conversas}
                  icone={entrevista
                    ? <Newspaper className="h-5 w-5 text-sky-300" />
                    : <Users className="h-5 w-5 text-violet-300" />}
                  className="min-h-0 flex-1"
                >
                  {entrevista && (
                    <>
                      <p className="text-[11px] text-white/40">{entrevista.contexto}</p>
                      <p className="mt-2 text-sm font-bold text-white/85">“{entrevista.pergunta}”</p>
                      <div className="mt-3 space-y-2">
                        {entrevista.respostas.map(r => (
                          <button
                            key={r.tom}
                            onClick={() => aplicar(responderEntrevista(carreira, entrevista.id, r.tom))}
                            className="w-full rounded-xl border border-white/10 bg-black/30 p-3 text-left transition-colors hover:border-sky-400/40 hover:bg-sky-400/[.08]"
                          >
                            <p className="text-[13px] text-white/80">“{r.texto}”</p>
                            <p className="mt-1 text-[10px] uppercase tracking-wide text-sky-200/60">{r.efeito}</p>
                          </button>
                        ))}
                      </div>
                    </>
                  )}

                  {respostaDaConversa && (
                    <p className="mt-3 rounded-xl border border-white/10 bg-black/40 px-4 py-2.5 text-sm text-white/75">
                      {respostaDaConversa}
                    </p>
                  )}

                  {conversas.map(c => (
                    <div key={c.id} className="mt-3 rounded-xl border border-white/10 bg-black/25 p-3">
                      <p className="text-[10px] font-black uppercase tracking-wider text-violet-200/70">
                        {rotuloDoInterlocutor(c.com)} · {c.quem}
                      </p>
                      <p className="mt-0.5 text-[11px] text-white/40">{c.assunto}</p>
                      <p className="mt-1.5 text-sm text-white/85">“{c.fala}”</p>
                      <div className="mt-2.5 space-y-1.5">
                        {c.escolhas.map(e => (
                          <button
                            key={e.id}
                            onClick={() => {
                              const d = responderConversa(carreira, c.id, e.id)
                              setRespostaDaConversa(d.texto)
                              aplicar(d.estado)
                            }}
                            className="w-full rounded-lg border border-white/10 bg-black/40 p-2.5 text-left text-[13px] text-white/80 transition-colors hover:border-violet-400/40 hover:bg-violet-400/[.08]"
                          >
                            {e.texto}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </PainelDoAtleta>
              )}
            </div>

            {/* REPERCUSSÃO + ÚLTIMAS ATUAÇÕES. */}
            <div className="flex min-h-0 flex-col gap-3">
              <PainelDoAtleta
                titulo={t.carreiraDeJogador.repercussao}
                className="min-h-0 flex-1"
                acessorio={<span className="text-[11px] text-white/40">reputação {carreira.reputacao ?? 30} · torcida {carreira.torcida ?? 50}</span>}
              >
                {(carreira.repercussao?.length ?? 0) === 0 ? (
                  <p className="text-sm leading-relaxed text-white/45">{t.carreiraDeJogador.repercussao_vazia}</p>
                ) : (
                  <div className="space-y-2">
                    {(carreira.repercussao ?? []).map(post => (
                      <div key={post.id} className="rounded-xl bg-black/30 p-3">
                        <p className="text-[11px] font-bold text-sky-300">{post.autor}</p>
                        <p className="mt-0.5 text-[13px] text-white/75">{post.texto}</p>
                      </div>
                    ))}
                  </div>
                )}
              </PainelDoAtleta>

              <PainelDoAtleta titulo={t.carreiraDeJogador.ultimas_atuacoes} className="min-h-0 flex-1">
                {carreira.ultimasPartidas.length === 0 && (
                  <p className="py-6 text-center text-white/35">Ainda sem partidas nesta carreira.</p>
                )}
                <div className="space-y-2">
                  {carreira.ultimasPartidas.map(p => (
                    <div key={`${p.temporada}-${p.rodada}`} className="rounded-xl bg-black/30 p-3">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-sm font-bold">{p.casa ? "vs" : "@"} {p.adversario}</span>
                        <span className="text-sm text-white/60">{p.golsPro}–{p.golsContra}</span>
                      </div>
                      <p className="mt-1 text-[11px] text-white/45">
                        {p.minutos > 0
                          ? <>{p.titular ? t.carreiraDeJogador.titular : t.carreiraDeJogador.entrou} · {p.minutos}′ · {p.gols}G {p.assistencias}A{p.cartao ? ` · cartão ${p.cartao}` : ""}</>
                          : t.carreiraDeJogador.nao_saiu_do_banco}
                        {p.minutos > 0 && <span className={cn("ml-2 font-black", corDaNota(p.nota))}>{p.nota.toFixed(1)}</span>}
                      </p>
                    </div>
                  ))}
                </div>
              </PainelDoAtleta>
            </div>
          </div>
        )}
      </div>
    </AtletaShell>
  )
}
