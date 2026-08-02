"use client"

// Botao flutuante de MINIMIZAR — o caminho de volta para a area de trabalho sem
// depender do Alt+Tab.
//
// Fica fora da EaActionBar de proposito: aquela barra pertence ao escritorio da
// carreira e some na splash, no editor e antes da escolha do clube. Sair do jogo
// precisa funcionar em QUALQUER tela, senao continua valendo o Alt+Tab nos
// lugares onde a barra nao aparece.
//
// So aparece no app nativo: no navegador nao existe janela para minimizar.

import { useCallback, useEffect, useState } from "react"
import { Minus } from "lucide-react"
import { minimizarJogo, observarRestauracao } from "@/lib/minimizar"
import { isTauri } from "@/lib/game-asset"

export function BotaoMinimizar() {
  // `isTauri()` le o window, entao so pode decidir depois de montar — no
  // servidor o valor seria outro e a hidratacao quebraria (#418).
  const [nativo, setNativo] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    setNativo(isTauri())
  }, [])

  // Devolve a tela cheia quando a janela volta.
  useEffect(() => observarRestauracao(), [])

  const acionar = useCallback(async () => {
    setErro(null)
    try {
      await minimizarJogo()
    } catch (e) {
      // O ERRO PRECISA APARECER. Se a permissao `core:window:allow-minimize`
      // faltar no capabilities, o Tauri nega a chamada — e um botao mudo faria
      // o jogador achar que o jogo travou. Mesmo motivo do `setErroAoAbrir` no
      // launcher.
      setErro(typeof e === "string" ? e : (e as Error)?.message || "não consegui minimizar")
    }
  }, [])

  // Atalho de teclado, para quem prefere o teclado. Ctrl+M e o que o Windows
  // usa para minimizar e nao conflita com nada do jogo (F11 ja e tela cheia).
  useEffect(() => {
    if (!nativo) return
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.ctrlKey && (e.key === "m" || e.key === "M")) {
        e.preventDefault()
        void acionar()
      }
    }
    document.addEventListener("keydown", aoTeclar)
    return () => document.removeEventListener("keydown", aoTeclar)
  }, [nativo, acionar])

  if (!nativo) return null

  return (
    <>
      <button
        type="button"
        onClick={() => void acionar()}
        title="Minimizar (Ctrl+M)"
        aria-label="Minimizar o jogo"
        className="fixed right-3 top-3 z-[60] flex h-8 w-8 items-center justify-center rounded-md
                   border border-white/10 bg-black/40 text-white/60 backdrop-blur-sm
                   transition-colors hover:bg-black/60 hover:text-white
                   focus-visible:outline focus-visible:outline-2 focus-visible:outline-white/40"
      >
        <Minus className="h-4 w-4" />
      </button>

      {erro && (
        <div
          role="alert"
          className="fixed right-3 top-14 z-[60] max-w-xs rounded-md border border-red-500/30
                     bg-red-950/90 px-3 py-2 text-xs text-red-100 backdrop-blur-sm"
        >
          {erro}
          <button
            type="button"
            onClick={() => setErro(null)}
            className="ml-2 underline underline-offset-2 hover:no-underline"
          >
            ok
          </button>
        </div>
      )}
    </>
  )
}
