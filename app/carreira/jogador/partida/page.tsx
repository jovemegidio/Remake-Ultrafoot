"use client"

// VIVER A PARTIDA — os momentos em que a bola passa pelo seu atleta.
//
// A partida já foi decidida pelo motor (o placar está fechado antes de a tela
// abrir). O que acontece aqui é a sua PARTICIPAÇÃO dentro dele: cada momento
// para o jogo e pergunta o que você faz. A nota sobe e desce na hora, e um gol
// seu sai dos gols que o time fez — nunca de fora deles.

import { useState } from "react"
import { ArrowRight, Trophy } from "lucide-react"
import { GameHeader } from "@/components/game-header"
import { Button } from "@/components/ui/button"
import { useGameState } from "@/lib/save-system"
import { hardNavigate } from "@/lib/hard-navigation"
import { useTelaGamepad } from "@/hooks/use-tela-gamepad"
import { useTranslation } from "@/lib/i18n"
import { cn } from "@/lib/utils"
import { concluirPartidaDoAtleta } from "@/lib/carreira-de-jogador"
import { decidirMomento, partidaTerminou } from "@/lib/partida-do-atleta"
import { CampoDoAtleta } from "@/components/match/campo-do-atleta"

export default function PartidaDoAtletaPage() {
  useTelaGamepad({ aoVoltar: () => hardNavigate("/carreira/jogador") })
  const { state, setState } = useGameState()
  const t = useTranslation()
  const carreira = state.carreiraDeJogador
  const partida = carreira?.partidaEmCurso
  const [ultimo, setUltimo] = useState<string | null>(null)

  if (!carreira || !partida) {
    return (
      <main className="h-dvh overflow-y-auto bg-[#06090d] text-white">
        <GameHeader />
        <div className="p-10 text-center">
          <p className="text-white/70">Nenhuma partida em andamento.</p>
          <Button className="mt-4" onClick={() => hardNavigate("/carreira/jogador")}>Voltar à carreira</Button>
        </div>
      </main>
    )
  }

  const momento = partida.momentos[partida.atual]
  const acabou = partidaTerminou(partida)
  /** Até onde a narração pode ser lida sem entregar o que ainda não aconteceu. */
  const minutoAtual = momento?.minuto ?? 90

  // ⚠️ A SIGLA DO ADVERSARIO NAO ESTA NA PARTIDA EM CURSO — ela guarda so o
  // NOME. Em vez de acrescentar o campo (o que exigiria migrar as partidas ja
  // em andamento nos saves), ela sai do proprio fixture que originou a partida,
  // que e a fonte de onde o nome tambem veio.
  const fixture = carreira.calendario.find(f => f.id === partida.fixtureId)
  const adversarioCurto = fixture
    ? (partida.emCasa ? fixture.awayCurto : fixture.homeCurto)
    : ""

  const decidir = (escolhaId: string) => {
    const r = decidirMomento(carreira, partida, escolhaId)
    setUltimo(r.resultado.narracao)
    setState({ carreiraDeJogador: { ...carreira, partidaEmCurso: r.partida } })
  }

  const encerrar = () => {
    setState({ carreiraDeJogador: concluirPartidaDoAtleta(carreira) })
    hardNavigate("/carreira/jogador")
  }

  return (
    <main className="h-dvh overflow-y-auto bg-[#06090d] text-white">
      <GameHeader />
      <div className="mx-auto max-w-3xl px-5 pb-14 pt-20">

        {/* Placar e nota viva — os dois números que importam durante o jogo. */}
        <header className="mb-6 rounded-2xl border border-white/10 bg-white/[.04] p-5 text-center">
          <p className="text-xs font-black uppercase tracking-[.25em] text-[var(--brand)]">
            {partida.competicao} · rodada {partida.rodada}
          </p>
          <h1 className="mt-2 text-3xl font-black">
            {partida.emCasa ? carreira.clubeNome : partida.adversario}
            <span className="mx-3 text-white/40">
              {partida.emCasa ? partida.golsPro : partida.golsContra}–{partida.emCasa ? partida.golsContra : partida.golsPro}
            </span>
            {partida.emCasa ? partida.adversario : carreira.clubeNome}
          </h1>
          <div className="mt-3 flex items-center justify-center gap-6 text-sm">
            <span className="text-white/50">
              {partida.titular ? t.carreiraDeJogador.titular : t.carreiraDeJogador.entrou_do_banco} · {partida.minutos}′
            </span>
            <span className={cn(
              "text-2xl font-black",
              partida.nota >= 8 ? "text-emerald-400" : partida.nota >= 7 ? "text-[var(--brand)]" : partida.nota >= 6 ? "text-amber-300" : "text-red-400",
            )}>
              {partida.nota.toFixed(1)}
            </span>
            <span className="text-white/50">{partida.gols}G · {partida.assistencias}A</span>
          </div>
        </header>

        {/* ── O CAMPO (1.0.338) ────────────────────────────────────────────
            O modo atleta era a unica partida do jogo sem campo nenhum. Ele
            ENCENA o que ja foi decidido — placar fechado, momentos sorteados —
            exatamente como o motor 3D faz na partida do tecnico. */}
        {adversarioCurto && (
          <div className="mb-5 overflow-hidden rounded-2xl border border-white/10 bg-black/30">
            <CampoDoAtleta
              atleta={carreira.atleta}
              clubeFileKey={carreira.clubeFileKey}
              adversarioCurto={adversarioCurto}
              emCasa={partida.emCasa}
              tipoDoMomento={momento?.tipo}
            />
            <p className="border-t border-white/[.06] px-4 py-2 text-center text-[11px] text-white/35">
              {acabou
                ? t.carreiraDeJogador.apito_final
                : momento
                  ? `${momento.minuto}′ — a bola chega em você.`
                  : t.carreiraDeJogador.aguardando_proximo_lance}
            </p>
          </div>
        )}

        {/* ── A NARRAÇÃO (1.0.353) ─────────────────────────────────────────
            ⚠️ O usuário pediu a partida "como a tela ao vivo do técnico" e depois
            foi direto: "sem narração". Estava certo — o modo tinha campo e tinha
            as decisões dele, mas o jogo em volta acontecia no escuro: o placar
            aparecia pronto no cabeçalho e ninguém contava QUANDO os gols saíram.

            Ela é revelada até o minuto do lance atual: ler agora que o
            adversário vai marcar aos 80' estragaria a partida que ainda não
            aconteceu. No fim, a súmula inteira fica visível. */}
        {(partida.narracaoDaPartida?.length ?? 0) > 0 && (
          <section className="mb-5 rounded-2xl border border-white/10 bg-black/30 p-4">
            <h2 className="mb-2 text-xs font-black uppercase tracking-wide text-white/40">
              {t.carreiraDeJogador.narracao}
            </h2>
            <div className="max-h-[220px] space-y-1.5 overflow-auto">
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
            </div>
          </section>
        )}

        {ultimo && (
          <p className="mb-4 rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-center text-sm text-white/75">
            {ultimo}
          </p>
        )}

        {!acabou && momento ? (
          <section className="rounded-2xl border border-[var(--brand)]/25 bg-[var(--brand)]/[.05] p-5">
            <p className="text-sm font-bold text-white/85">{momento.narracao}</p>
            <div className="mt-4 space-y-2">
              {momento.escolhas.map(e => (
                <button
                  key={e.id}
                  onClick={() => decidir(e.id)}
                  className="flex w-full items-center justify-between gap-3 rounded-xl border border-white/10 bg-black/30 p-4 text-left transition-colors hover:border-[var(--brand)]/40 hover:bg-[var(--brand)]/[.08]"
                >
                  <span className="text-sm text-white/85">{e.texto}</span>
                  <span className="shrink-0 text-[10px] uppercase tracking-wide text-white/35">
                    {e.risco >= 0.55 ? "alto risco" : e.risco >= 0.35 ? "risco médio" : "seguro"}
                  </span>
                </button>
              ))}
            </div>
          </section>
        ) : (
          <section className="rounded-2xl border border-amber-400/30 bg-amber-400/10 p-5 text-center">
            <Trophy className="mx-auto h-8 w-8 text-amber-300" />
            <h2 className="mt-3 text-xl font-black">{t.carreiraDeJogador.fim_de_jogo}</h2>
            <p className="mt-1 text-sm text-white/65">
              Sua partida: nota {partida.nota.toFixed(1)} · {partida.gols} gol(s) · {partida.assistencias} assistência(s) em {partida.minutos} minutos.
            </p>
            <Button className="mt-4 bg-[var(--brand)] text-[var(--brand-ink)] hover:bg-[#00d9b0]" onClick={encerrar}>
              <ArrowRight className="mr-2 h-4 w-4" /> Voltar à carreira
            </Button>
          </section>
        )}

        {partida.historico.length > 0 && (
          <section className="mt-6">
            <h2 className="mb-2 text-xs font-black uppercase tracking-wide text-white/40">O que você fez</h2>
            <div className="space-y-1">
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
    </main>
  )
}
