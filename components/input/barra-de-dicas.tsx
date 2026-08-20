"use client"

// BARRA DE DICAS — a linha de baixo que ensina os botoes da tela atual.
//
// So aparece em Modo Controle. Em mouse e teclado ela seria uma faixa ocupando
// espaco para ensinar botoes que ninguem tem na mao.
//
// ── Por que ela nao "flutua" por cima do conteudo ───────────────────────────
// Ela reserva altura de verdade (`--uf-hint-bar` no padding do corpo, ver
// app/globals.css). Barra flutuante tapa a ultima linha de toda tabela do jogo,
// e a ultima linha e justamente onde o D-pad chega no fim de uma lista — o
// jogador desce ate o fim e o item selecionado fica escondido atras da barra
// que deveria estar ajudando.

import { useSyncExternalStore } from "react"

import { cn } from "@/lib/utils"
import { ROTULO_DA_ACAO } from "@/lib/input/actions"
import { pilhaDeDicas, type DicaDeControle } from "@/lib/input/hints"
import { pilhaDeContextos, type InputContext } from "@/lib/input/contexts"
import { useModoControle } from "@/hooks/use-input"
import { GlifoDaAcao } from "./glifo"

const VAZIO: readonly DicaDeControle[] = []

function useDicasAtuais(): readonly DicaDeControle[] {
  return useSyncExternalStore(
    cb => pilhaDeDicas.observar(cb),
    () => pilhaDeDicas.atual(),
    () => VAZIO,
  )
}

function useContextoAtual(): InputContext {
  return useSyncExternalStore(
    cb => pilhaDeContextos.observar(cb),
    () => pilhaDeContextos.topo(),
    () => "GLOBAL" as InputContext,
  )
}

export function BarraDeDicas() {
  const modoControle = useModoControle()
  const dicas = useDicasAtuais()
  const contexto = useContextoAtual()

  if (!modoControle || !dicas.length) return null

  return (
    <div
      // `data-gamepad-exclude` e `aria-hidden` de proposito: a barra ENSINA
      // botoes, ela nao e um destino. Sem isto, a navegacao espacial de
      // fallback (use-tela-gamepad) mandava o foco para dentro dela e o jogador
      // ficava preso na propria legenda.
      data-gamepad-exclude=""
      aria-hidden="true"
      className={cn(
        "fixed inset-x-0 bottom-0 z-50 pointer-events-none",
        "flex items-center justify-center gap-[clamp(0.75rem,2vw,2rem)]",
        "border-t border-white/10 bg-black/80 backdrop-blur-md",
        "px-4 text-white/80",
      )}
      style={{ height: "var(--uf-hint-bar, 44px)" }}
    >
      {dicas.map(dica => (
        <span
          key={dica.acao}
          className={cn(
            "inline-flex items-center gap-[0.45em] whitespace-nowrap",
            "text-[calc(0.78rem*var(--uf-font-scale,1))] font-medium tracking-wide",
            dica.inativa && "opacity-35",
          )}
        >
          <GlifoDaAcao acao={dica.acao} contexto={contexto} tamanho="sm" />
          {dica.rotulo ?? ROTULO_DA_ACAO[dica.acao]}
        </span>
      ))}
    </div>
  )
}
