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
import { buscarJson } from "@/lib/buscar-json"
import { isTauri } from "@/lib/game-asset"

/** O manifesto do jogo na VPS: pequeno, público e sempre no ar. Serve de ping. */
const ALVO = "https://ultrafoot.179-198-103-30.sslip.io/downloads/latest.json"

/**
 * ESTA MÁQUINA PODE FALAR COM A VPS?
 *
 * ⚠️ ISTO NÃO É DETALHE DE AMBIENTE — ERA O DEFEITO. Dentro do Tauri a página
 * roda em `tauri.localhost` e QUALQUER pedido à VPS é cross-origin; o nginx de
 * `/downloads/` não manda `Access-Control-Allow-Origin`, então o `fetch` da
 * webview é barrado antes de sair (é o que `lib/buscar-json.ts` documenta e
 * resolve fazendo a requisição pelo lado NATIVO). Com `fetch` cru, o online
 * simplesmente NUNCA ligava sozinho no jogo instalado — a funcionalidade inteira
 * dependia de um pedido que o navegador recusa.
 *
 * Fora do Tauri o caminho nativo não existe. Aí só faz sentido perguntar quando
 * a página VEIO da própria VPS (versão web), porque é o único caso em que o
 * pedido é same-origin. Num `localhost` de desenvolvimento ou na auditoria de
 * telas, pingar produção só produz erro de console — que foi exatamente o ruído
 * que afogou a auditoria de 40 telas.
 */
function podeConsultarAVps(): boolean {
  if (isTauri()) return true
  if (typeof window === "undefined") return false
  return window.location.origin === new URL(ALVO).origin
}

export function OnlinePorConectividade() {
  const { state, setState } = useGameState()

  useEffect(() => {
    // Já decidiu? A escolha dele manda, e o assunto acaba aqui.
    if (state.multiplayerDefinidoPeloJogador) return
    // Já está ligado? Nada a fazer.
    if (state.multiplayerEnabled) return
    if (typeof navigator !== "undefined" && navigator.onLine === false) return

    if (!podeConsultarAVps()) return

    let cancelado = false
    const conferir = async () => {
      // ⚠️ `buscarJson`, e não `fetch`: dentro do Tauri ele faz a requisição pelo
      // lado nativo, onde CORS não existe. O timeout curto continua valendo —
      // isto roda no boot e um servidor lento não pode segurar a abertura do
      // jogo. Falhou, fica offline: o jogador segue com o interruptor manual em
      // Configurações.
      const corpo = await buscarJson<{ version?: string }>(`${ALVO}?cb=${Date.now()}`, 4000)
      if (cancelado) return
      // Conferência pelo CORPO, não pelo status: o nginx deste site devolve
      // 200 com a página do jogo para caminho inexistente (ver deploy-tudo).
      if (!corpo?.version) return
      setState({ multiplayerEnabled: true })
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
