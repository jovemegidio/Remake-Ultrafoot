"use client"

/**
 * BARRAS ARCADE — força e efeito deixam de ser `<input type="range">` (1.0.377).
 *
 * ─── O QUE ESTAVA ERRADO ────────────────────────────────────────────────────
 *
 * A mira da 1.0.374 já tinha força e efeito, e eles já entravam na física de
 * verdade (`lib/fisica-do-chute`). O problema era outro: os dois eram sliders
 * de formulário. Um slider é o controle certo para ajustar o volume — ele
 * PERMITE acertar exatamente o valor que você quer, sem pressa e sem erro. É
 * exatamente o oposto do que um chute precisa ser.
 *
 * ⚠️ NUM CHUTE, A DIFICULDADE É O PRODUTO. Se o jogador pode arrastar a força
 * até 74 com calma e conferir o número antes de soltar, não existe execução —
 * existe configuração. O relato do usuário ("feedback mais arcade mobile") é a
 * descrição de um sintoma cuja causa é essa.
 *
 * ─── OS DOIS MODOS, E POR QUE SÃO DOIS ──────────────────────────────────────
 *
 * `carga`      o cursor sobe do mínimo ao máximo e VOLTA, em laço. O jogador
 *              solta quando quer. É a barra de força de qualquer jogo de
 *              futebol desde sempre, e a razão de ela funcionar é que errar
 *              para mais é tão fácil quanto errar para menos.
 *
 * `varredura`  o cursor varre a barra inteira nos dois sentidos e o jogador
 *              trava onde der. É o efeito: você não escolhe a curva, você
 *              tenta pegá-la.
 *
 * ⚠️ E EXISTE UM TERCEIRO MODO, `manual`, QUE NÃO É PREGUIÇA. Teclado e
 * controle continuam ajustando por passos (W/S, LT/RT), e quem usa leitor de
 * tela precisa de um alvo com valor. Um jogo que só aceita reflexo exclui quem
 * não tem; a barra em movimento é o padrão, o ajuste fino continua existindo.
 *
 * ─── A ZONA BOA ─────────────────────────────────────────────────────────────
 *
 * A faixa verde não é decoração nem é "o valor certo": é a faixa em que a
 * física perde menos precisão (ver `potenciaReal` e `efeitoReal`). Mostrá-la é
 * honestidade — o jogador tem de saber para onde está mirando o dedo. Acertar
 * fora dela não é proibido, e às vezes é o que o lance pede.
 */

import { useEffect, useRef, useState } from "react"
import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

const SEGMENTOS = 28

export type ModoDaBarra = "manual" | "carga" | "varredura"

export function BarraArcade({
  rotulo,
  icone,
  valor,
  aoMudar,
  min,
  max,
  /** Início e fim da faixa em que a física castiga menos. */
  zonaBoa,
  modo = "manual",
  /** Velocidade do cursor em unidades por quadro. Mais alto = mais difícil. */
  velocidade = 2.2,
  cor = "amber",
  desabilitado,
}: {
  rotulo: string
  icone?: ReactNode
  valor: number
  aoMudar: (v: number) => void
  min: number
  max: number
  zonaBoa?: [number, number]
  modo?: ModoDaBarra
  velocidade?: number
  cor?: "amber" | "cyan"
  desabilitado?: boolean
}) {
  const [correndo, setCorrendo] = useState(false)
  const cursor = useRef(valor)
  const direcao = useRef(1)
  const [, redesenhar] = useState(0)

  /**
   * ⚠️ O CURSOR VIVE NUM `ref`, NÃO NO ESTADO. Ele se move a cada 24 ms; guardá-lo
   * em `useState` faria o React reconciliar a árvore 40 vezes por segundo com o
   * componente inteiro, e a barra ficaria travada exatamente na tela em que a
   * fluidez é o ponto. O estado que existe (`redesenhar`) é só um contador para
   * pedir um quadro — o valor real sai sempre do ref.
   */
  useEffect(() => {
    if (!correndo || desabilitado) return
    const id = window.setInterval(() => {
      const proximo = cursor.current + direcao.current * velocidade
      if (proximo >= max) { cursor.current = max; direcao.current = -1 }
      else if (proximo <= min) { cursor.current = min; direcao.current = 1 }
      else cursor.current = proximo
      redesenhar(n => n + 1)
    }, 24)
    return () => window.clearInterval(id)
  }, [correndo, desabilitado, max, min, velocidade])

  useEffect(() => { if (!correndo) cursor.current = valor }, [valor, correndo])

  const posicao = ((cursor.current - min) / (max - min)) * 100
  const naZona = zonaBoa ? cursor.current >= zonaBoa[0] && cursor.current <= zonaBoa[1] : false

  const acionar = () => {
    if (desabilitado || modo === "manual") return
    if (!correndo) {
      cursor.current = modo === "carga" ? min : (min + max) / 2
      direcao.current = 1
      setCorrendo(true)
      return
    }
    setCorrendo(false)
    aoMudar(Math.round(cursor.current))
  }

  const acento = cor === "amber" ? "bg-amber-300" : "bg-cyan-300"
  const acentoTexto = cor === "amber" ? "text-amber-300" : "text-cyan-300"

  return (
    <div className={cn("rounded-xl border border-white/10 bg-black/45 p-2.5", desabilitado && "opacity-35")}>
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-white/50">
          {icone}{rotulo}
        </span>
        <span className={cn("text-[15px] font-black tabular-nums leading-none", correndo && naZona ? "text-emerald-300" : acentoTexto)}>
          {Math.round(correndo ? cursor.current : valor)}
        </span>
      </div>

      {/* A barra segmentada. Segmentos e não gradiente: o olho conta blocos
          muito melhor do que estima posição num degradê, e a leitura precisa
          acontecer em menos de meio segundo. */}
      <button
        type="button"
        aria-label={rotulo}
        onClick={acionar}
        disabled={desabilitado || modo === "manual"}
        className="relative flex h-6 w-full items-stretch gap-[2px] overflow-hidden rounded-md bg-white/[.06] p-[3px] disabled:cursor-default"
      >
        {zonaBoa && (
          <span
            aria-hidden
            className="pointer-events-none absolute inset-y-0 bg-emerald-400/15"
            style={{
              left: `${((zonaBoa[0] - min) / (max - min)) * 100}%`,
              width: `${((zonaBoa[1] - zonaBoa[0]) / (max - min)) * 100}%`,
            }}
          />
        )}
        {Array.from({ length: SEGMENTOS }).map((_, i) => {
          const aceso = (i / SEGMENTOS) * 100 <= posicao
          return (
            <span
              key={i}
              className={cn(
                "flex-1 rounded-[1px] transition-colors duration-75",
                aceso ? (naZona && correndo ? "bg-emerald-400" : acento) : "bg-white/[.07]",
              )}
            />
          )
        })}
        <span
          aria-hidden
          className="pointer-events-none absolute inset-y-0 w-[2px] bg-white shadow-[0_0_8px_2px_rgba(255,255,255,.55)]"
          style={{ left: `${Math.max(0, Math.min(99.5, posicao))}%` }}
        />
      </button>
    </div>
  )
}

/**
 * O CARIMBO DO DESFECHO — o "GOL!" que faltava.
 *
 * ⚠️ ISTO NÃO É ENFEITE, É A RESPOSTA À AÇÃO. Antes, o resultado do chute
 * chegava ao jogador como uma linha de texto no histórico do lance, na mesma
 * fonte de todo o resto. Um jogo em que a bola entra e nada acontece na tela
 * ensina o jogador a não olhar para a tela.
 */
export function CarimboDoLance({
  texto, tom,
}: { texto: string; tom: "gol" | "defesa" | "trave" | "fora" }) {
  const cor =
    tom === "gol" ? "text-emerald-300 border-emerald-300/60 shadow-[0_0_40px_rgba(74,222,128,.35)]"
    : tom === "defesa" ? "text-amber-300 border-amber-300/60"
    : tom === "trave" ? "text-pink-300 border-pink-300/60"
    : "text-rose-300 border-rose-400/60"

  return (
    <div className="pointer-events-none absolute inset-0 z-30 grid place-items-center">
      <div
        className={cn(
          "animate-scale-in rounded-2xl border-2 bg-black/70 px-6 py-2.5 text-3xl font-black uppercase tracking-[.12em] backdrop-blur-sm",
          cor,
        )}
      >
        {texto}
      </div>
    </div>
  )
}
