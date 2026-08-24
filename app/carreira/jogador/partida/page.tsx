"use client"

// A PARTIDA DO ATLETA — PRÉ-JOGO E AO VIVO.
//
// ⚠️ POR QUE ESTA TELA FOI REFEITA (pedido do usuário, com print): "refaça essa
// tela porque o certo deve ser a tela de pré-jogo > partida ao vivo".
//
// O que existia era uma COLUNA de 3/4 de largura: um cartão de placar em texto,
// o campo, a narração e os botões, empilhados num `max-w-3xl` que rolava. Do
// lado do técnico, a mesma partida tem DUAS telas — o pré-jogo (fundo de
// estádio, os dois escudos frente a frente, competição e rodada no alto) e o ao
// vivo (barra de transmissão com escudo, sigla, placar e relógio; o campo
// ocupando a tela; a narração ao lado). Era a diferença que fazia o modo de
// atleta parecer um protótipo do modo de verdade.
//
// Agora são as duas fases, com a MESMA linguagem visual do modo de técnico
// (ver app/partida e app/partida/ao-vivo):
//
//   fase "pre"  → fundo `pre-jogo-fundo.webp`, cabeçalho de competição, os dois
//                 clubes frente a frente e o SEU cartão no meio (expectativa de
//                 minutos, forma, confiança) — porque no pré-jogo do atleta a
//                 pergunta é "eu vou jogar?", não "que escalação eu monto?".
//   fase "vivo" → barra de transmissão + campo + narração + as decisões.
//
// ⚠️ E O PLACAR NÃO ENTREGA MAIS O FIM. O cabeçalho antigo mostrava
// `golsPro–golsContra`, que é o placar FINAL (o motor resolve a partida antes de
// a tela abrir): dava para ler "2–4" aos 12 minutos. Agora ele é contado a
// partir da narração até o minuto do lance atual — o mesmo cuidado que a
// narração já tinha. Ver `placarAte`.
//
// ⚠️ NADA AQUI SIMULA DE NOVO. O placar já está fechado e os momentos já estão
// sorteados; esta tela ENCENA, como o motor 3D do modo de técnico.

import { useEffect, useMemo, useState } from "react"
import { ArrowRight, Flag, Play, Trophy } from "lucide-react"

import { GameHeader } from "@/components/game-header"
import { Button } from "@/components/ui/button"
import { TeamCrest } from "@/components/team-crest"
import { CampoDoAtleta } from "@/components/match/campo-do-atleta"
import { MiraDoAtleta, type TipoDaMiraDoAtleta } from "@/components/carreira-jogador/mira-do-atleta"
import { useGameState } from "@/lib/save-system"
import { getTeamByFileKey, getTeamByShort } from "@/lib/teams-data"
import { getCompetitionLogo } from "@/lib/competition-logo"
import { hardNavigate } from "@/lib/hard-navigation"
import { useTelaGamepad } from "@/hooks/use-tela-gamepad"
import { useTranslation } from "@/lib/i18n"
import { cn } from "@/lib/utils"
import { concluirPartidaDoAtleta, economiaDoAtleta, minutosEsperados } from "@/lib/carreira-de-jogador"
import { decidirMomento, partidaTerminou, type LanceNarrado } from "@/lib/partida-do-atleta"

/**
 * O placar ATÉ um minuto, contado da narração.
 *
 * Sem narração (partida de save antigo) não há como reconstruir o caminho do
 * jogo: aí o placar final é o único que existe, e é melhor mostrá-lo do que
 * mostrar 0–0 numa partida que terminou 3–1.
 */
function placarAte(
  narracao: LanceNarrado[] | undefined,
  minuto: number,
  acabou: boolean,
  final: { pro: number; contra: number },
): { pro: number; contra: number } {
  if (!narracao || narracao.length === 0) return final
  if (acabou) return final
  const ate = narracao.filter(l => l.minuto <= minuto)
  return {
    pro: ate.filter(l => l.tipo === "gol-pro").length,
    contra: ate.filter(l => l.tipo === "gol-contra").length,
  }
}

export default function PartidaDoAtletaPage() {
  const { state, setState } = useGameState()
  const t = useTranslation()
  const carreira = state.carreiraDeJogador
  const partida = carreira?.partidaEmCurso
  const [ultimo, setUltimo] = useState<string | null>(null)
  /** A tela começa no pré-jogo, como a do técnico. */
  const [fase, setFase] = useState<"pre" | "vivo">("pre")
  useTelaGamepad({ aoVoltar: () => hardNavigate("/carreira/jogador"), quando: fase === "pre" })

  // Enter / A começam a partida, igual ao overlay de pré-jogo do modo técnico.
  useEffect(() => {
    if (fase !== "pre") return
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key === "Enter") { e.preventDefault(); setFase("vivo") }
    }
    const aoBotao = (e: Event) => {
      if ((e as CustomEvent<{ button: string }>).detail?.button === "A") setFase("vivo")
    }
    window.addEventListener("keydown", aoTeclar)
    window.addEventListener("gamepad:button", aoBotao)
    return () => {
      window.removeEventListener("keydown", aoTeclar)
      window.removeEventListener("gamepad:button", aoBotao)
    }
  }, [fase])

  const fixture = useMemo(
    () => carreira?.calendario.find(f => f.id === partida?.fixtureId),
    [carreira, partida],
  )

  if (!carreira || !partida) {
    return (
      <main className="h-screen overflow-y-auto bg-[#06090d] text-white">
        <GameHeader />
        <div className="p-10 text-center">
          <p className="text-white/70">{t.carreiraDeJogador.nenhuma_partida_em_andamento}</p>
          <Button className="mt-4" onClick={() => hardNavigate("/carreira/jogador")}>{t.carreiraDeJogador.voltar_a_carreira}</Button>
        </div>
      </main>
    )
  }

  const momento = partida.momentos[partida.atual]
  const acabou = partidaTerminou(partida)
  const minutoAtual = momento?.minuto ?? 90

  // ⚠️ A SIGLA DO ADVERSARIO NAO ESTA NA PARTIDA EM CURSO — ela guarda so o
  // NOME. Em vez de acrescentar o campo (o que exigiria migrar as partidas ja
  // em andamento nos saves), ela sai do proprio fixture que originou a partida.
  const eSelecao = partida.origem === "selecao"
  const adversarioCurto = fixture
    ? (partida.emCasa ? fixture.awayCurto : fixture.homeCurto)
    : eSelecao ? carreira.clubeCurto : ""

  const meuClube = getTeamByFileKey(carreira.clubeFileKey)
  const adversario = adversarioCurto ? getTeamByShort(adversarioCurto) : undefined
  const casa = partida.emCasa ? meuClube : adversario
  const fora = partida.emCasa ? adversario : meuClube
  const nomeCasa = eSelecao ? `Seleção de ${carreira.atleta.nacionalidade}` : casa?.nome ?? (partida.emCasa ? carreira.clubeNome : partida.adversario)
  const nomeFora = eSelecao ? partida.adversario : fora?.nome ?? (partida.emCasa ? partida.adversario : carreira.clubeNome)
  const logoDaCompeticao = getCompetitionLogo(partida.competicao)

  const corrido = placarAte(
    partida.narracaoDaPartida,
    minutoAtual,
    acabou,
    { pro: partida.golsPro, contra: partida.golsContra },
  )
  const golsCasa = partida.emCasa ? corrido.pro : corrido.contra
  const golsFora = partida.emCasa ? corrido.contra : corrido.pro

  const decidir = (escolhaId: string, precisaoMira = 1) => {
    const r = decidirMomento(carreira, partida, escolhaId, precisaoMira)
    setUltimo(r.resultado.narracao)
    setState({ carreiraDeJogador: { ...carreira, partidaEmCurso: r.partida } })
  }

  const encerrar = () => {
    setState({ carreiraDeJogador: concluirPartidaDoAtleta(carreira) })
    hardNavigate("/carreira/jogador")
  }

  // ── FASE 1: PRÉ-JOGO ─────────────────────────────────────────────────────
  if (fase === "pre") {
    return (
      <div className="fixed inset-0 flex flex-col overflow-hidden bg-[#050508] text-white">
        {/* O MESMO fundo da tela de pré-jogo do técnico: imagem fixa, nunca arte
            por clube (que falta justamente nos times menores). */}
        <div aria-hidden className="absolute inset-0">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_38%,#132534_0%,#070a0f_72%)]" />
          <div
            className="absolute inset-0 bg-cover bg-center"
            style={{ backgroundImage: "url(/images/pre-jogo/pre-jogo-fundo.webp)" }}
          />
          <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/35 to-black/75" />
        </div>

        {/* Cabeçalho: competição e rodada, como no pré-jogo do técnico. */}
        <div className="relative z-10 flex items-center gap-4 px-8 pt-6">
          {logoDaCompeticao && (
            <img src={logoDaCompeticao} alt="" className="h-9 w-auto max-w-[130px] object-contain" />
          )}
          <div className="flex flex-col leading-tight">
            <h1 className="text-lg font-black tracking-tight">{partida.competicao}</h1>
            <div className="flex items-center gap-2 text-xs font-semibold text-white/55">
              <span className="uppercase tracking-wider text-[var(--brand)]">Rodada {partida.rodada}</span>
              <span className="h-3 w-px bg-white/20" />
              <span className="text-white/50">{partida.emCasa ? t.carreiraDeJogador.em_casa : t.carreiraDeJogador.fora_de_casa}</span>
            </div>
          </div>
        </div>

        {/* Os dois clubes frente a frente, e VOCÊ no meio. */}
        <div className="relative z-10 flex flex-1 items-center justify-center gap-6 px-6 xl:gap-14">
          <div className="flex w-56 flex-col items-center gap-3 text-center">
            {eSelecao ? <Flag className="h-24 w-24 text-emerald-300" /> : <TeamCrest team={casa} size="3xl" />}
            <p className="text-lg font-black leading-tight">{nomeCasa}</p>
            <p className="text-[11px] uppercase tracking-wider text-white/40">Mandante</p>
          </div>

          <div className="w-[22rem] max-w-[90vw] rounded-2xl border border-white/10 bg-black/55 p-5 backdrop-blur-sm">
            <p className="text-center text-[10px] font-black uppercase tracking-[.25em] text-[var(--brand)]">
              O seu jogo
            </p>
            <p className="mt-2 text-center text-2xl font-black">{carreira.atleta.nome}</p>
            <p className="text-center text-[11px] text-white/45">
              {carreira.atleta.posicao} · overall {carreira.atleta.overall}
            </p>

            <div className="mt-4 space-y-2 text-sm">
              <p className="flex items-center justify-between">
                <span className="text-white/50">Expectativa</span>
                <b className="text-[var(--brand)]">{partida.titular ? t.carreiraDeJogador.titular : minutosEsperados(carreira)}</b>
              </p>
              <p className="flex items-center justify-between">
                <span className="text-white/50">Forma</span><b>{Math.round(carreira.forma)}</b>
              </p>
              <p className="flex items-center justify-between">
                <span className="text-white/50">{t.carreiraDeJogador.confianca_do_treinador}</span><b>{Math.round(carreira.notaDoTreinador)}</b>
              </p>
              <p className="flex items-center justify-between">
                <span className="text-white/50">{t.carreiraDeJogador.lances_curtos_previstos}</span><b>{partida.aoVivo?.metaDeLances ?? partida.momentos.length}</b>
              </p>
              <p className="flex items-center justify-between">
                <span className="text-white/50">Energia</span><b>{economiaDoAtleta(carreira).energia}/{economiaDoAtleta(carreira).energiaMaxima}</b>
              </p>
            </div>

            <button
              onClick={() => setFase("vivo")}
              className="mt-5 flex w-full items-center justify-center gap-3 rounded-xl bg-[var(--brand)] py-3.5 text-base font-black text-[var(--brand-ink)] shadow-lg shadow-[var(--brand)]/25 transition-all hover:bg-[#00e6b5] active:scale-[0.98]"
            >
              <Play className="h-5 w-5 fill-current" /> ENTRAR EM CAMPO
            </button>
            <p className="mt-2 text-center text-[11px] text-white/30">
              Pressione <kbd className="rounded bg-white/10 px-2 py-0.5 text-white/50">Enter</kbd> ou o botão A do controle
            </p>
          </div>

          <div className="flex w-56 flex-col items-center gap-3 text-center">
            {eSelecao ? <Flag className="h-24 w-24 text-sky-300" /> : <TeamCrest team={fora} size="3xl" />}
            <p className="text-lg font-black leading-tight">{nomeFora}</p>
            <p className="text-[11px] uppercase tracking-wider text-white/40">Visitante</p>
          </div>
        </div>

        <div className="relative z-10 flex items-center justify-between px-8 pb-6 text-[11px] text-white/40">
          <button onClick={() => hardNavigate("/carreira/jogador")} className="transition-colors hover:text-white/70">
            Esc · voltar ao escritório
          </button>
          <span>{carreira.clubeNome} · Temporada {carreira.temporada}</span>
        </div>
      </div>
    )
  }

  // ── FASE 2: AO VIVO ──────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 flex flex-col overflow-hidden bg-gradient-to-br from-[#1a3d3d] via-[#0d2626] to-[#051515] text-white">

      {/* A BARRA DE TRANSMISSÃO — a mesma do ao vivo do técnico: escudo, sigla,
          números, relógio. Uma barra só, cor do clube em filete. */}
      <header className="relative z-10 shrink-0 px-4 pb-3 pt-4 sm:px-8">
        <div className="mx-auto flex w-fit flex-col items-center gap-1.5">
          <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/35">
            {logoDaCompeticao && <img src={logoDaCompeticao} alt="" className="h-4 w-4 object-contain opacity-70" />}
            {partida.competicao} · rodada {partida.rodada}
          </div>

          <div className="flex items-stretch overflow-hidden rounded-lg border border-white/[0.08] bg-[#0b0e14]/90 shadow-[0_8px_28px_rgba(0,0,0,0.45)] backdrop-blur-sm">
            <div className="flex items-center gap-2.5 py-2 pl-3 pr-4 sm:gap-3 sm:pl-4 sm:pr-5">
              <span className="h-7 w-[3px] rounded-full sm:h-8" style={{ backgroundColor: casa?.cor1 ?? "#00ffc8" }} />
              {eSelecao ? <Flag className="h-7 w-7 text-emerald-300" /> : <TeamCrest team={casa} size="sm" />}
              <span className="text-lg font-bold tracking-wide sm:text-2xl">{eSelecao ? carreira.atleta.nacionalidade.slice(0, 3).toUpperCase() : casa?.curto ?? t.carreiraDeJogador.casa_sigla}</span>
            </div>

            <div className="flex items-center gap-2.5 border-x border-white/[0.08] bg-white/[0.03] px-4 py-2 sm:gap-3 sm:px-6">
              <span className="text-2xl font-bold tabular-nums sm:text-3xl">{golsCasa}</span>
              <span className="text-lg font-light text-white/25 sm:text-xl">:</span>
              <span className="text-2xl font-bold tabular-nums sm:text-3xl">{golsFora}</span>
            </div>

            <div className="flex items-center gap-2.5 py-2 pl-4 pr-3 sm:gap-3 sm:pl-5 sm:pr-4">
              <span className="text-lg font-bold tracking-wide sm:text-2xl">{eSelecao ? partida.adversario.slice(0, 3).toUpperCase() : fora?.curto ?? t.carreiraDeJogador.fora_sigla}</span>
              {eSelecao ? <Flag className="h-7 w-7 text-sky-300" /> : <TeamCrest team={fora} size="sm" />}
              <span className="h-7 w-[3px] rounded-full sm:h-8" style={{ backgroundColor: fora?.cor1 ?? "#ffffff" }} />
            </div>

            <div className="flex min-w-[62px] items-center justify-center bg-white/[0.06] px-3 sm:min-w-[76px] sm:px-4">
              <span className="text-base font-bold tabular-nums text-white/90 sm:text-lg">
                {acabou ? 90 : minutoAtual}
              </span>
              <span className="text-base font-bold text-white/90 sm:text-lg">&apos;</span>
            </div>
          </div>

          {/* A SUA linha, embaixo da barra: é o placar que interessa ao modo. */}
          <span className="whitespace-nowrap rounded-full border border-white/[0.08] bg-black/40 px-3 py-0.5 text-[10px] font-semibold uppercase tracking-[.14em] text-white/50">
            {partida.titular ? t.carreiraDeJogador.titular : t.carreiraDeJogador.entrou_do_banco} · {partida.minutos}′ ·{" "}
            <b className={cn(
              partida.nota >= 8 ? "text-emerald-400" : partida.nota >= 7 ? "text-[var(--brand)]" : partida.nota >= 6 ? "text-amber-300" : "text-red-400",
            )}>
              nota {partida.nota.toFixed(1)}
            </b>{" "}
            · {partida.gols}G {partida.assistencias}A
          </span>
        </div>
      </header>

      {/* Área principal: campo à esquerda, narração e decisão à direita. */}
      <div className="flex min-h-0 flex-1 gap-4 px-4 pb-4 sm:px-8">

        <div className="flex min-h-0 flex-1 flex-col gap-3">
          {adversarioCurto && (
            /* ⚠️ O CAMPO TEM PROPORÇÃO FIXA (16/9) e a tela tem altura fixa: sem
               `min-h-0` + `items-center` no invólucro, ele empurraria a caixa de
               decisão para fora da janela — o mesmo tipo de estouro que a barra
               de controle já causou no escritório. Aqui ele CENTRALIZA e, na
               janela baixa, é aparado igualmente em cima e embaixo. */
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-white/10 bg-black/30">
              <div className="flex min-h-0 flex-1 items-center justify-center overflow-hidden">
                <CampoDoAtleta
                  atleta={carreira.atleta}
                  clubeFileKey={carreira.clubeFileKey}
                  adversarioCurto={adversarioCurto}
                  emCasa={partida.emCasa}
                  tipoDoMomento={momento?.tipo}
                />
              </div>
              <p className="shrink-0 border-t border-white/[.06] px-4 py-2 text-center text-[11px] text-white/35">
                {acabou
                  ? t.carreiraDeJogador.apito_final
                  : momento
                    ? `${momento.minuto}′ — a bola chega em você.`
                    : t.carreiraDeJogador.aguardando_proximo_lance}
              </p>
            </div>
          )}

          {/* A DECISÃO. É o que o modo tem de próprio: enquanto o técnico mexe
              na prancheta, o atleta escolhe o que fazer com a bola no pé. */}
          {!acabou && momento ? (
            <section className="shrink-0 rounded-2xl border border-[var(--brand)]/25 bg-[var(--brand)]/[.05] p-4">
              <p className="text-sm font-bold text-white/85">{momento.narracao}</p>
              {partida.aoVivo?.lancePendente && ["finalizacao", "falta", "penalti", "defesa", "saida_do_gol", "penalti_defensivo"].includes(partida.aoVivo.lancePendente.tipo) && (
                <MiraDoAtleta
                  tipo={partida.aoVivo.lancePendente.tipo as TipoDaMiraDoAtleta}
                  lanceId={partida.aoVivo.lancePendente.id}
                  aoFinalizar={precisao => decidir(
                    partida.aoVivo?.lancePendente?.tipo === "falta" ? "bater_falta"
                      : partida.aoVivo?.lancePendente?.tipo === "penalti" ? "bater_penalti"
                        : partida.aoVivo?.lancePendente?.tipo === "defesa" ? "mergulhar"
                          : partida.aoVivo?.lancePendente?.tipo === "saida_do_gol" ? "abafar"
                            : partida.aoVivo?.lancePendente?.tipo === "penalti_defensivo" ? "defender_penalti"
                        : "chutar",
                    precisao,
                  )}
                />
              )}
              <div className="mt-3 grid gap-2 md:grid-cols-3">
                {momento.escolhas.filter(e => {
                  const tipo = partida.aoVivo?.lancePendente?.tipo
                  if (!["finalizacao", "falta", "penalti", "defesa", "saida_do_gol", "penalti_defensivo"].includes(tipo ?? "")) return true
                  return !["chutar", "ajeitar", "bater_falta", "bater_penalti", "mergulhar", "abafar", "defender_penalti"].includes(e.id)
                }).map(e => (
                  <button
                    key={e.id}
                    onClick={() => decidir(e.id)}
                    className="flex flex-col gap-1 rounded-xl border border-white/10 bg-black/30 p-3 text-left transition-colors hover:border-[var(--brand)]/40 hover:bg-[var(--brand)]/[.08]"
                  >
                    <span className="text-sm text-white/85">{e.texto}</span>
                    <span className="text-[10px] uppercase tracking-wide text-white/35">
                      {e.risco >= 0.55 ? t.carreiraDeJogador.alto_risco : e.risco >= 0.35 ? t.carreiraDeJogador.risco_medio : "seguro"}
                    </span>
                  </button>
                ))}
              </div>
              {ultimo && (
                <p className="mt-3 rounded-xl border border-white/10 bg-black/40 px-4 py-2.5 text-sm text-white/75">{ultimo}</p>
              )}
            </section>
          ) : (
            <section className="shrink-0 rounded-2xl border border-amber-400/30 bg-amber-400/10 p-4 text-center">
              <Trophy className="mx-auto h-7 w-7 text-amber-300" />
              <h2 className="mt-2 text-xl font-black">{t.carreiraDeJogador.fim_de_jogo}</h2>
              <p className="mt-1 text-sm text-white/65">
                {partida.emCasa ? carreira.clubeNome : partida.adversario} {partida.emCasa ? partida.golsPro : partida.golsContra}
                {" – "}
                {partida.emCasa ? partida.golsContra : partida.golsPro} {partida.emCasa ? partida.adversario : carreira.clubeNome}
                {" · "}sua partida: nota {partida.nota.toFixed(1)} · {partida.gols} gol(s) · {partida.assistencias} assistência(s) em {partida.minutos} minutos.
              </p>
              <Button className="mt-3 bg-[var(--brand)] text-[var(--brand-ink)] hover:bg-[#00d9b0]" onClick={encerrar}>
                <ArrowRight className="mr-2 h-4 w-4" /> Voltar à carreira
              </Button>
            </section>
          )}
        </div>

        {/* Coluna da direita: narração ao vivo e o que você fez. */}
        <div className="hidden w-[22rem] shrink-0 flex-col gap-3 lg:flex">
          <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#1a2a2a]/60 backdrop-blur-sm">
            <h2 className="shrink-0 border-b border-white/[.06] px-4 py-2.5 text-xs font-black uppercase tracking-wide text-white/45">
              {t.carreiraDeJogador.narracao}
            </h2>
            <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto px-4 py-3">
              {(partida.narracaoDaPartida ?? [])
                .filter(l => acabou || l.minuto <= minutoAtual)
                .map((l, i) => (
                  <div key={`${l.minuto}-${i}`} className="flex items-baseline gap-3 text-[13px]">
                    <span className="w-9 shrink-0 text-right font-mono text-white/35">{l.minuto}&apos;</span>
                    <span className={cn(
                      l.tipo === "gol-pro" ? "font-bold text-emerald-400"
                        : l.tipo === "gol-contra" ? "text-red-400"
                          : l.tipo === "voce" ? "text-[var(--brand)]"
                            : "text-white/60",
                    )}>
                      {l.texto}
                    </span>
                  </div>
                ))}
              {(partida.narracaoDaPartida?.length ?? 0) === 0 && (
                <p className="py-8 text-center text-sm text-white/30">{t.carreiraDeJogador.o_jogo_vai_comecar}</p>
              )}
            </div>
          </section>

          {partida.historico.length > 0 && (
            <section className="flex max-h-[38%] min-h-0 flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#1a2a2a]/60 backdrop-blur-sm">
              <h2 className="shrink-0 border-b border-white/[.06] px-4 py-2.5 text-xs font-black uppercase tracking-wide text-white/45">
                O que você fez
              </h2>
              <div className="min-h-0 flex-1 space-y-1 overflow-y-auto px-3 py-2">
                {partida.historico.map((h, i) => (
                  <div key={i} className="flex items-center justify-between gap-3 rounded-lg bg-black/25 px-3 py-2 text-[12px]">
                    <span className="text-white/70">{h.minuto}′ {h.texto}</span>
                    <b className={h.delta >= 0 ? "text-emerald-400" : "text-red-400"}>
                      {h.delta >= 0 ? "+" : ""}{h.delta.toFixed(1)}
                    </b>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  )
}
