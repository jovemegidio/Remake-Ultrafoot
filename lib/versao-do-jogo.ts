"use client"

// A VERSAO DO JOGO, para mostrar na tela.
//
// Duas fontes, nesta ordem:
//   1. o instalador (Tauri `getVersion()`), que e a verdade do que foi instalado
//      na maquina — inclusive depois de uma atualizacao automatica;
//   2. NEXT_PUBLIC_VERSAO_DO_JOGO, injetada no build a partir do package.json
//      (next.config.mjs), que atende a web e o primeiro render do desktop.
//
// Nao existe uma terceira constante escrita a mao de proposito: numero de versao
// repetido em varios lugares envelhece em um deles e passa a mentir.

import { useEffect, useState } from "react"
import { isTauri } from "@/lib/game-asset"

/** Versao do build. Vazia so se o build tiver sido feito sem o next.config. */
export const VERSAO_DO_BUILD: string = process.env.NEXT_PUBLIC_VERSAO_DO_JOGO ?? ""

/**
 * Versao para exibir. Comeca na do build (render imediato, sem piscar) e troca
 * pela do instalador quando o Tauri responde.
 */
export function useVersaoDoJogo(): string {
  const [versao, setVersao] = useState(VERSAO_DO_BUILD)

  useEffect(() => {
    if (!isTauri()) return
    let vivo = true
    void import("@tauri-apps/api/app")
      .then(({ getVersion }) => getVersion())
      .then(v => { if (vivo && v) setVersao(v) })
      .catch(() => { /* sem Tauri disponivel: fica a versao do build */ })
    return () => { vivo = false }
  }, [])

  return versao
}
