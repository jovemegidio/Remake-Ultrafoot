"use client"

import { useEffect, useState } from "react"

export interface LiveLatest {
  version: string
  sizeMb: number
  downloadUrl: string
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
      "https://ultrafoot.72-61-145-52.sslip.io/downloads/latest.json",
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
            downloadUrl: j?.platforms?.["windows-x86_64"]?.url ?? "",
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
