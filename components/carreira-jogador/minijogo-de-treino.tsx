"use client"

/**
 * O MINI-GAME DE TREINO — de uma barra para três estações (1.0.377).
 *
 * ─── O QUE ELE ERA ──────────────────────────────────────────────────────────
 *
 * Uma barra, um cursor indo e voltando, um botão. Parar na faixa verde dava
 * precisão 1, parar na ponta dava 0. Funcionava — e era um único teste de
 * reflexo, repetido igual em toda rodada da carreira inteira. Depois de cinco
 * tentativas o jogador já sabia o ritmo do cursor e acertava sempre; a partir
 * dali, clicar era imposto e não jogado.
 *
 * ─── O QUE ELE É AGORA ──────────────────────────────────────────────────────
 *
 * Três estações em sequência, e a nota final é a MÉDIA das três:
 *
 *   1. TEMPO     a barra de sempre, mas rápida. Mede reflexo.
 *   2. FORÇA     cursor que sobe e desce; parar dentro de uma janela estreita.
 *                Mede controle — errar para mais é tão fácil quanto para menos.
 *   3. MIRA      três alvos acendem em ordem e o jogador confirma no aceso.
 *                Mede atenção, que é a única das três que não vira automatismo.
 *
 * ⚠️ AS TRÊS MEDEM COISAS DIFERENTES DE PROPÓSITO. Três barras iguais em fila
 * seriam o mesmo teste três vezes — mais longo, não mais difícil. E como a nota
 * é média, um erro não zera a rodada: o treino continua valendo alguma coisa,
 * que é o que impede o jogador de recarregar o save atrás da tentativa perfeita.
 *
 * ─── O FEEDBACK ─────────────────────────────────────────────────────────────
 *
 * Cada estação responde na hora com PERFEITO / BOM / FRACO e a cor
 * correspondente, e a moldura pisca no acerto. Antes, o resultado só aparecia
 * como um número no relatório de treino, depois de tudo — o jogador executava
 * três segundos de jogo e recebia a resposta em outra tela.
 */

import { useCallback, useEffect, useRef, useState } from "react"
import { Crosshair, Gauge, Play, Square, Timer } from "lucide-react"
import { useTranslation } from "@/lib/i18n"
import { cn } from "@/lib/utils"

type Estacao = "tempo" | "forca" | "mira"
const ESTACOES: Estacao[] = ["tempo", "forca", "mira"]

/**
 * Nota de uma estação vira rótulo.
 *
 * ⚠️ AS TRÊS PALAVRAS SÃO CAIXA-ALTA E CURTAS, e não são frase. Elas aparecem
 * por 700 ms num quadrado de 40 px; qualquer coisa mais longa não é lida a
 * tempo e vira ruído colorido.
 */
function leitura(p: number, t: { perfeito: string; bom: string; fraco: string }): { texto: string; classe: string } {
  if (p >= 0.82) return { texto: t.perfeito, classe: "text-emerald-300" }
  if (p >= 0.5) return { texto: t.bom, classe: "text-amber-300" }
  return { texto: t.fraco, classe: "text-rose-300" }
}

export function MinijogoDeTreino({ desabilitado, aoConcluir }: {
  desabilitado?: boolean
  aoConcluir: (precisao: number) => void
}) {
  const t = useTranslation()
  const rotulos = {
    perfeito: t.carreiraDeJogador.nota_perfeito,
    bom: t.carreiraDeJogador.nota_bom,
    fraco: t.carreiraDeJogador.nota_fraco,
  }

  const [estacao, setEstacao] = useState(0)
  const [ativo, setAtivo] = useState(false)
  const [notas, setNotas] = useState<number[]>([])
  const [flash, setFlash] = useState<number | null>(null)

  const [cursor, setCursor] = useState(0)
  const cursorRef = useRef(0)
  const direcao = useRef(1)
  /** Qual dos três alvos está aceso na estação de mira. */
  const [aceso, setAceso] = useState(0)
  const acesoRef = useRef(0)
  /** O alvo que o jogador precisa pegar — sorteado ao entrar na estação. */
  const alvo = useRef(0)

  const atual = ESTACOES[Math.min(estacao, 2)]
  const terminou = notas.length >= 3

  // ── O MOTOR DE CADA ESTAÇÃO ───────────────────────────────────────────────
  //
  // ⚠️ UM INTERVALO SÓ, COM VELOCIDADE POR ESTAÇÃO. Três laços separados (um
  // por estação) sobreviveriam a uma troca de estação sem serem limpos e
  // rodariam dois ao mesmo tempo — o tipo de defeito que aparece como "a barra
  // acelerou sozinha" depois de dez rodadas e ninguém consegue reproduzir.
  useEffect(() => {
    if (!ativo || terminou) return
    const passo = atual === "tempo" ? 3.4 : 2.1
    const id = window.setInterval(() => {
      if (atual === "mira") {
        acesoRef.current = (acesoRef.current + 1) % 3
        setAceso(acesoRef.current)
        return
      }
      const proximo = cursorRef.current + direcao.current * passo
      if (proximo >= 100 || proximo <= 0) direcao.current *= -1
      cursorRef.current = Math.max(0, Math.min(100, proximo))
      setCursor(cursorRef.current)
    }, atual === "mira" ? 420 : 24)
    return () => window.clearInterval(id)
  }, [ativo, atual, terminou])

  const notaDaEstacao = useCallback((): number => {
    if (atual === "mira") return acesoRef.current === alvo.current ? 1 : 0.15
    // A janela da força é ESTREITA (±22 em torno de 70) e a do tempo é larga
    // (±50 em torno de 50): sem a diferença, as duas seriam o mesmo teste.
    const centro = atual === "forca" ? 70 : 50
    const largura = atual === "forca" ? 22 : 50
    return Math.max(0, 1 - Math.abs(cursorRef.current - centro) / largura)
  }, [atual])

  const acionar = useCallback(() => {
    if (desabilitado || terminou) return

    if (!ativo) {
      cursorRef.current = 0
      direcao.current = 1
      acesoRef.current = 0
      // ⚠️ SORTEIO LOCAL E NÃO SEMEADO, e aqui isso é correto: este é um teste
      // de REFLEXO do jogador de verdade, não um evento da carreira. Semear
      // pelo save tornaria o alvo previsível para quem recarrega — o oposto do
      // que o determinismo protege no resto do modo.
      alvo.current = Math.floor(Math.random() * 3)
      setCursor(0)
      setAceso(0)
      setAtivo(true)
      return
    }

    const nota = notaDaEstacao()
    setAtivo(false)
    setFlash(nota)
    window.setTimeout(() => setFlash(null), 700)

    const proximas = [...notas, nota]
    setNotas(proximas)

    if (proximas.length >= 3) {
      const media = proximas.reduce((s, n) => s + n, 0) / proximas.length
      aoConcluir(Math.max(0, Math.min(1, media)))
    } else {
      setEstacao(e => e + 1)
    }
  }, [ativo, aoConcluir, desabilitado, notaDaEstacao, notas, terminou])

  useEffect(() => {
    const teclado = (e: KeyboardEvent) => {
      if ((e.key === " " || e.key === "Enter") && (ativo || document.activeElement?.getAttribute("data-treino") === "true")) {
        e.preventDefault()
        acionar()
      }
    }
    const controle = (e: Event) => {
      if ((e as CustomEvent<{ button: string }>).detail?.button === "A" && ativo) acionar()
    }
    window.addEventListener("keydown", teclado)
    window.addEventListener("gamepad:button", controle)
    return () => {
      window.removeEventListener("keydown", teclado)
      window.removeEventListener("gamepad:button", controle)
    }
  }, [acionar, ativo])

  const rotuloDaEstacao =
    atual === "tempo" ? t.carreiraDeJogador.estacao_tempo
      : atual === "forca" ? t.carreiraDeJogador.estacao_forca
        : t.carreiraDeJogador.estacao_mira

  const IconeDaEstacao = atual === "tempo" ? Timer : atual === "forca" ? Gauge : Crosshair

  return (
    <div className={cn(
      "mt-3 rounded-xl border bg-black/40 p-3 transition-colors duration-200",
      flash !== null
        ? (flash >= 0.82 ? "border-emerald-400/60" : flash >= 0.5 ? "border-amber-300/50" : "border-rose-400/50")
        : "border-white/10",
    )}>
      {/* As três estações, com a nota de cada uma assim que ela sai. */}
      <div className="mb-2 flex items-center gap-1.5">
        {ESTACOES.map((e, i) => (
          <div
            key={e}
            className={cn(
              "flex-1 rounded-md px-1.5 py-1 text-center text-[9px] font-black uppercase tracking-wider transition-colors",
              i < notas.length ? `bg-white/[.07] ${leitura(notas[i], rotulos).classe}`
                : i === estacao ? "bg-[var(--brand)]/15 text-[var(--brand)]"
                  : "bg-white/[.03] text-white/25",
            )}
          >
            {i < notas.length ? leitura(notas[i], rotulos).texto : i + 1}
          </div>
        ))}
      </div>

      {terminou ? (
        <p className="py-2 text-center text-[11px] text-white/45">{t.carreiraDeJogador.uma_tentativa_por_rodada}</p>
      ) : (
        <>
          <p className="mb-1.5 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-white/45">
            <IconeDaEstacao className="h-3 w-3 text-[var(--brand)]" /> {rotuloDaEstacao}
          </p>

          {atual === "mira" ? (
            /* Os três alvos. O que está ACESO é onde o jogo está; o que tem
               anel é o que precisa ser pego. Mostrar os dois é o que transforma
               reflexo em atenção — o jogador tem de ESPERAR o certo. */
            <div className="flex justify-center gap-3 py-1">
              {[0, 1, 2].map(i => (
                <div
                  key={i}
                  className={cn(
                    "grid h-11 w-11 place-items-center rounded-full border-2 transition-all duration-100",
                    aceso === i && ativo ? "scale-110 border-white bg-white/25" : "border-white/15 bg-white/[.04]",
                    alvo.current === i && ativo && "ring-2 ring-[var(--brand)] ring-offset-2 ring-offset-black",
                  )}
                >
                  <Crosshair className={cn("h-4 w-4", aceso === i && ativo ? "text-white" : "text-white/25")} />
                </div>
              ))}
            </div>
          ) : (
            <div className="relative h-5 overflow-hidden rounded-full bg-rose-500/20">
              {/* A faixa boa muda de largura conforme a estação — é a diferença
                  entre as duas estações visível num detalhe. */}
              {atual === "forca" ? (
                <>
                  <div className="absolute inset-y-0 left-[48%] w-[44%] bg-amber-300/25" />
                  <div className="absolute inset-y-0 left-[62%] w-[16%] bg-emerald-400/70" />
                </>
              ) : (
                <>
                  <div className="absolute inset-y-0 left-[34%] w-[32%] bg-amber-300/30" />
                  <div className="absolute inset-y-0 left-[44%] w-[12%] bg-emerald-400/70" />
                </>
              )}
              <div
                className="absolute inset-y-0 w-1 -translate-x-1/2 bg-white shadow-[0_0_10px_2px_rgba(255,255,255,.6)]"
                style={{ left: `${cursor}%` }}
              />
            </div>
          )}

          <button
            data-treino="true"
            disabled={desabilitado}
            onClick={acionar}
            className="mt-2.5 flex w-full items-center justify-center gap-2 rounded-lg border border-[var(--brand)]/25 px-3 py-2 text-xs font-bold text-[var(--brand)] disabled:opacity-30"
          >
            {ativo ? <Square className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
            {ativo
              ? (atual === "mira" ? t.carreiraDeJogador.confirmar_no_alvo : t.carreiraDeJogador.parar_na_faixa_verde)
              : t.carreiraDeJogador.iniciar_desafio_de_precisao}
          </button>
        </>
      )}
    </div>
  )
}
