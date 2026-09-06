"use client"

import { useEffect, useState } from "react"

export interface LiveLatest {
  version: string
  sizeMb: number
  /** Vazio fora do Windows — ver o comentario no `setLive`. */
  downloadUrl: string
}

function ehWindows(): boolean {
  if (typeof navigator === "undefined") return true
  return /Windows/i.test(navigator.userAgent)
}

/**
 * Busca a versao REAL mais recente direto do release do GitHub, em RUNTIME (no
 * client). Como o launcher e export estatico, um fetch server-side "assaria" a
 * versao no build e voltaria a envelhecer — por isso a busca precisa ser aqui,
 * no navegador/webview do app. Assim o launcher mostra sempre a versao atual
 * (mesma fonte do auto-updater). Se falhar (offline), devolve null e a UI cai no
 * dado estatico.
 *
 * `enabled` desliga a consulta no modo offline — sem rede, o launcher nao gasta
 * tempo em fetch que so pode falhar.
 */
export function useLiveLatest(enabled = true): LiveLatest | null {
  const [live, setLive] = useState<LiveLatest | null>(null)

  useEffect(() => {
    if (!enabled) return
    let alive = true

    // Servidor proprio primeiro, GitHub como RESERVA. O servidor e uma maquina
    // so: caindo ela, sem esta reserva o launcher ficaria preso na versao
    // estatica embutida e ninguem veria atualizacao. Os dois publicam o mesmo
    // formato de latest.json.
    const FONTES = [
      "https://ultrafoot.zyntraerp.com.br/downloads/latest.json",
      "https://github.com/jovemegidio/Ultrafoot26/releases/latest/download/latest.json",
    ]

    type Latest = { version?: string; sizeMb?: number; platforms?: Record<string, { url?: string }> }

    void (async () => {
      for (const url of FONTES) {
        try {
          const r = await fetch(url, { cache: "no-store" })
          if (!r.ok) continue
          const j = (await r.json()) as Latest | null
          if (!alive) return
          const version = String(j?.version ?? "").trim()
          if (!/^\d+\.\d+\.\d+$/.test(version)) continue
          setLive({
            version,
            sizeMb: Number(j?.sizeMb) || 0,
            // A URL do latest.json e SO DO WINDOWS. Linux e macOS baixam do
            // release `desktop-*` (.AppImage/.dmg), e quem resolve isso e o
            // comando Rust `fetch_latest`. Entregar a URL daqui fora do Windows
            // fazia o Linux baixar um .exe e salva-lo como AppImage.
            downloadUrl: ehWindows() ? j?.platforms?.["windows-x86_64"]?.url ?? "" : "",
          })
          return
        } catch { /* tenta a proxima fonte */ }
      }
      // Nenhuma fonte respondeu: mantem o dado estatico do build.
    })()

    return () => { alive = false }
  }, [enabled])

  return live
}
