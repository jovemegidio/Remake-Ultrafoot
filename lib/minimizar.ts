"use client"

// MINIMIZAR O JOGO — ir e vir sem Alt+Tab.
//
// Por que precisa existir: o jogo roda em tela cheia, e em tela cheia o Windows
// esconde a barra de titulo. Sem barra, some o botao de minimizar, e o unico
// caminho de volta para a area de trabalho era o Alt+Tab. Quem nao conhece o
// atalho ficava preso na janela.
//
// EM TELA CHEIA, MINIMIZAR SOZINHO NAO BASTA. O Windows trata a janela em
// fullscreen como dona da tela inteira: minimizada, ela costuma voltar sozinha
// ou deixar a area de trabalho piscando por baixo. Por isso saimos da tela
// cheia ANTES de minimizar — e ao restaurar, devolvemos a tela cheia, para o
// jogador achar o jogo do jeito que deixou.
//
// A PERMISSAO E O PONTO QUE FALHA CALADO. `core:window:default` do Tauri v2 NAO
// inclui `allow-minimize`. Sem declarar em capabilities/default.json a chamada e
// negada em silencio — exatamente o que aconteceu com `allow-destroy` e deixou o
// jogo impossivel de fechar ("nao consigo fechar o jogo nem no alt f4"). Por
// isso aqui a falha nunca e engolida: quem chama recebe o erro.

import { isTauri } from "@/lib/game-asset"
import { isFullscreenEnabled, setFullscreen } from "@/lib/fullscreen"

/** Estava em tela cheia quando minimizou? Restaura no mesmo estado. */
let restaurarEmTelaCheia = false

/**
 * Minimiza a janela do jogo.
 *
 * Lanca se nao conseguir — a UI precisa poder avisar. Um botao que nao faz nada
 * e pior do que nao ter botao: o jogador clica, nada acontece, e ele nao tem
 * como saber se o jogo travou.
 */
export async function minimizarJogo(): Promise<void> {
  if (!isTauri()) {
    // No navegador (dev/web) nao existe minimizar. Nao e erro: a UI so nao
    // oferece o botao fora do app nativo.
    return
  }

  const { getCurrentWindow } = await import("@tauri-apps/api/window")
  const janela = getCurrentWindow()

  // Sai da tela cheia primeiro (ver o comentario do topo). Guarda a preferencia
  // em memoria, e NAO no store: gravar "fullscreen=0" aqui faria o jogo abrir
  // em janela na proxima vez que fosse iniciado minimizado.
  restaurarEmTelaCheia = isFullscreenEnabled()
  if (restaurarEmTelaCheia) {
    try {
      await janela.setFullscreen(false)
    } catch {
      // Se nao sair da tela cheia, minimizar ainda vale a pena: no pior caso o
      // jogador volta pela barra de tarefas.
    }
  }

  await janela.minimize()
}

/**
 * Devolve a tela cheia depois que a janela volta.
 *
 * Chamado pelo listener de foco (ver `observarRestauracao`), nao pelo jogador.
 */
export async function aoRestaurar(): Promise<void> {
  if (!restaurarEmTelaCheia) return
  restaurarEmTelaCheia = false
  if (!isTauri()) return
  try {
    await setFullscreen(true)
  } catch (e) {
    console.warn("[minimizar] nao consegui devolver a tela cheia:", e)
  }
}

/**
 * Liga o retorno automatico da tela cheia. Devolve a funcao de desligar.
 *
 * Usa o evento de foco da JANELA (Tauri), nao o `focus` do documento: em tela
 * cheia o WebView nem sempre dispara o do documento ao ser restaurado.
 */
export function observarRestauracao(): () => void {
  if (!isTauri()) return () => {}

  let parar: (() => void) | undefined
  let cancelado = false

  void import("@tauri-apps/api/window").then(({ getCurrentWindow }) => {
    if (cancelado) return
    void getCurrentWindow()
      .onFocusChanged(({ payload: focada }) => {
        if (focada) void aoRestaurar()
      })
      .then((fn) => {
        if (cancelado) fn()
        else parar = fn
      })
  })

  return () => {
    cancelado = true
    parar?.()
  }
}
