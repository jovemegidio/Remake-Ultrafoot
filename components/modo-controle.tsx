"use client"

// MODO CONTROLE — o jogo muda de cara quando um controle e conectado.
//
// Ate aqui a barra de comandos existia, mas so duas telas a montavam
// (`/partida` e `/pre-office`, ambas com acoes proprias). Nas outras 62 o
// jogador nao tinha nem a barra nem navegacao: ligar o controle nao mudava
// nada. Este componente e o interruptor unico do "modo controle":
//
//   - liga a navegacao global (D-pad/analogico, A, B, LB/RB, LT/RT);
//   - mostra a barra de comandos da tela em que o jogador esta;
//   - marca <html data-controle="on">, para o CSS engrossar o anel de foco e
//     dar alvos maiores enquanto o controle estiver na mao.
//
// Some sozinho quando o controle e desconectado — nada fica preso no teclado.

import { useEffect, useSyncExternalStore } from "react"
import { usePathname } from "next/navigation"
import { GamepadControlsBar, useGamepadDetection } from "@/components/gamepad-controls-bar"
import { GamepadNavegacaoGlobal } from "@/components/gamepad-navegacao-global"
import { pilhaDeDicas } from "@/lib/input/hints"

/** Telas que montam a propria barra com acoes especificas — nao duplicar. */
const COM_BARRA_PROPRIA = ["/partida", "/pre-office"]

/**
 * A tela atual publicou dicas proprias?
 *
 * Decide QUAL barra aparece. As telas que usam `useTelaGamepad` publicam dicas
 * derivadas do que declaram (ver hooks/use-tela-gamepad); para elas vale a barra
 * contextual nova, que sabe do modal aberto e do contexto de input. As outras
 * continuam com a barra por rota, que ja funciona hoje — assim a migracao e
 * gradual e ninguem fica sem barra no meio do caminho.
 */
function useTelaTemDicasProprias(): boolean {
  return useSyncExternalStore(
    cb => pilhaDeDicas.observar(cb),
    () => pilhaDeDicas.atual().length > 0,
    () => false,
  )
}

export function ModoControle() {
  const { connected } = useGamepadDetection()
  const temDicasProprias = useTelaTemDicasProprias()
  const pathname = usePathname() ?? ""

  useEffect(() => {
    const raiz = document.documentElement
    if (connected) raiz.setAttribute("data-controle", "on")
    else raiz.removeAttribute("data-controle")
    return () => raiz.removeAttribute("data-controle")
  }, [connected])

  if (!connected) return null

  // Comparacao EXATA: `/partida/ao-vivo` e `/partida/escalacao` nao montam barra
  // propria e precisam da global — casar por prefixo as deixaria sem nenhuma.
  const temBarraPropria = COM_BARRA_PROPRIA.includes(pathname.replace(/\/$/, ""))
  // Tres barras possiveis e no maximo UMA na tela: a da propria rota
  // (/partida, /pre-office), a contextual nova (quando a tela publica dicas) ou
  // a por rota. Duas ao mesmo tempo empilhariam faixas no rodape.
  const mostrarBarraPorRota = !temBarraPropria && !temDicasProprias
  return (
    <>
      <GamepadNavegacaoGlobal />
      {mostrarBarraPorRota && <GamepadControlsBar />}
    </>
  )
}
