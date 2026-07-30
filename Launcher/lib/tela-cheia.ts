"use client"

// TELA CHEIA DO LAUNCHER.
//
// O launcher passou a ABRIR em tela cheia (`fullscreen: true` em
// src-tauri/tauri.conf.json). Isso tem uma consequência que o config sozinho não
// resolve: em tela cheia o Tauri esconde a decoração da janela — some a barra de
// título e, com ela, o X. E este launcher nunca teve botão de fechar/minimizar
// próprio (só o "fechar para a bandeja" das preferências, que depende do X).
//
// Sem uma saída, o jogador ficaria preso numa janela sem controles, dependendo
// de saber Alt+F4. Por isso a tela cheia vem acompanhada de dois atalhos, os
// mesmos que qualquer jogo usa:
//
//   Esc / F11  → alterna tela cheia (volta a ter barra de título e X)
//
// `isTauri` protege o navegador: o launcher também roda como site (a vitrine em
// Next.js), e lá `window.__TAURI_INTERNALS__` não existe — importar a API do
// Tauri fora do app desktop quebraria a página inteira.

const isTauri = () =>
  typeof window !== "undefined" &&
  Boolean((window as unknown as Record<string, unknown>).__TAURI_INTERNALS__)

/** Alterna tela cheia. Devolve o estado novo, ou `null` fora do app desktop. */
export async function alternarTelaCheia(): Promise<boolean | null> {
  if (!isTauri()) return null
  try {
    const { getCurrentWindow } = await import("@tauri-apps/api/window")
    const janela = getCurrentWindow()
    const agora = await janela.isFullscreen()
    await janela.setFullscreen(!agora)
    return !agora
  } catch {
    // Permissão ausente ou API indisponível: não trava o launcher por causa de
    // um atalho de conforto.
    return null
  }
}

/**
 * Liga os atalhos de tela cheia. Devolve a função de limpeza (para o `useEffect`).
 *
 * Esc só SAI da tela cheia — nunca entra. Entrar por Esc seria surpreendente, e
 * Esc é a tecla que o jogador aperta para fechar um diálogo: se ele também
 * alternasse a janela, fechar as Preferências jogaria a tela inteira junto.
 */
export function ligarAtalhosDeTelaCheia(): () => void {
  if (typeof window === "undefined") return () => {}

  const aoTeclar = async (e: KeyboardEvent) => {
    if (e.key === "F11") {
      e.preventDefault()
      await alternarTelaCheia()
      return
    }
    if (e.key !== "Escape" || !isTauri()) return
    // Um diálogo aberto tem prioridade sobre a janela: o Esc é dele.
    if (document.querySelector("[role='dialog'],[data-state='open']")) return
    try {
      const { getCurrentWindow } = await import("@tauri-apps/api/window")
      const janela = getCurrentWindow()
      if (await janela.isFullscreen()) {
        e.preventDefault()
        await janela.setFullscreen(false)
      }
    } catch { /* atalho de conforto: falhar aqui nao pode quebrar a tela */ }
  }

  window.addEventListener("keydown", aoTeclar)
  return () => window.removeEventListener("keydown", aoTeclar)
}
