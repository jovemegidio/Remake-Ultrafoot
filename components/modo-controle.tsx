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

import { useEffect } from "react"
import { usePathname } from "next/navigation"
import { GamepadControlsBar, useGamepadDetection } from "@/components/gamepad-controls-bar"
import { GamepadNavegacaoGlobal } from "@/components/gamepad-navegacao-global"

/** Telas que montam a propria barra com acoes especificas — nao duplicar. */
const COM_BARRA_PROPRIA = ["/partida", "/pre-office"]

export function ModoControle() {
  const { connected } = useGamepadDetection()
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
  return (
    <>
      <GamepadNavegacaoGlobal />
      {!temBarraPropria && <GamepadControlsBar />}
    </>
  )
}
