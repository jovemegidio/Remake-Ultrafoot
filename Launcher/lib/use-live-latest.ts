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
    fetch("https://api.github.com/repos/jovemegidio/Ultrafoot26/releases/latest", {
      headers: { Accept: "application/vnd.github+json" },
      cache: "no-store",
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((j: { tag_name?: string; assets?: { name: string; size: number; browser_download_url: string }[] } | null) => {
        if (!alive || !j) return
        const version = String(j.tag_name ?? "").replace(/^build-/, "").trim()
        if (!/^\d+\.\d+\.\d+$/.test(version)) return
        const asset = (j.assets ?? []).find((a) => /_x64-setup\.exe$/i.test(a.name))
        setLive({
          version,
          sizeMb: asset ? Math.round(asset.size / (1024 * 1024)) : 0,
          downloadUrl: asset?.browser_download_url ?? "",
        })
      })
      .catch(() => { /* offline: mantem o estatico */ })
    return () => { alive = false }
  }, [enabled])

  return live
}
