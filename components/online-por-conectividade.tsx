"use client"

// O ONLINE LIGA SOZINHO QUANDO HÁ INTERNET.
//
// ⚠️ O PEDIDO, LITERAL (18/08/2026): "o modo online deve estar ativo só do fato
// do jogador abrir o launcher com wifi ligado". Até aqui era o contrário: o
// online vinha DESLIGADO e só existia depois de o jogador achar
// Configurações → Configurações online e virar um interruptor que ninguém sabia
// existir. Foi por isso que os modos online pareciam não existir.
//
// ⚠️ E LIGAR SOZINHO NÃO PODE VIRAR DESOBEDIÊNCIA. Quem entrou nas Configurações
// e DESLIGOU tem de continuar desligado — senão o jogo religa a cada boot e a
// pessoa perde a confiança no próprio painel de ajustes. A distinção mora em
// `multiplayerDefinidoPeloJogador`: ausente = nunca decidiu, e aí a internet
// decide; presente = decidiu, e aí ela manda.
//
// ⚠️ `navigator.onLine` NÃO É "TEM INTERNET": ele diz apenas que existe uma
// interface de rede ativa. Wi-Fi de hotel com portal, cabo sem roteador e VPN
// caída respondem `true`. Por isso ele é só o primeiro filtro — o que confirma é
// alcançar o servidor do jogo. Ligar o online sem servidor alcançável entregaria
// um menu que abre e não conecta, que é pior do que o menu escondido.

import { useEffect } from "react"
import { useGameState } from "@/lib/save-system"

/** O manifesto do jogo na VPS: pequeno, público e sempre no ar. Serve de ping. */
const ALVO = "https://ultrafoot.179-198-103-30.sslip.io/downloads/latest.json"

export function OnlinePorConectividade() {
  const { state, setState } = useGameState()

  useEffect(() => {
    // Já decidiu? A escolha dele manda, e o assunto acaba aqui.
    if (state.multiplayerDefinidoPeloJogador) return
    // Já está ligado? Nada a fazer.
    if (state.multiplayerEnabled) return
    if (typeof navigator !== "undefined" && navigator.onLine === false) return

    let cancelado = false
    const conferir = async () => {
      try {
        // ⚠️ `no-store` e timeout curto: isto roda no boot, e um servidor lento
        // não pode segurar a abertura do jogo. Falhou, fica offline — o jogador
        // continua com o interruptor manual em Configurações.
        const controle = new AbortController()
        const relogio = setTimeout(() => controle.abort(), 4000)
        const resposta = await fetch(`${ALVO}?cb=${Date.now()}`, {
          cache: "no-store",
          signal: controle.signal,
        })
        clearTimeout(relogio)
        if (!resposta.ok || cancelado) return
        // Conferência pelo CORPO, não pelo status: o nginx deste site devolve
        // 200 com a página do jogo para caminho inexistente (ver deploy-tudo).
        const corpo = await resposta.json() as { version?: string }
        if (!corpo?.version || cancelado) return
        setState({ multiplayerEnabled: true })
      } catch {
        // Sem rede alcançável: segue offline, em silêncio. Não é erro do jogador.
      }
    }

    void conferir()
    // Voltou a rede no meio da sessão? Tenta de novo — o caso do notebook que
    // abriu o jogo antes de o Wi-Fi conectar.
    const aoVoltar = () => { void conferir() }
    window.addEventListener("online", aoVoltar)
    return () => { cancelado = true; window.removeEventListener("online", aoVoltar) }
  }, [state.multiplayerDefinidoPeloJogador, state.multiplayerEnabled, setState])

  return null
}
