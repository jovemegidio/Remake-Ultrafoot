"use client"

// BUSCA DE MANIFESTO — o transporte das atualizacoes.
//
// POR QUE NAO E SO `fetch`: dentro do Tauri a pagina roda em tauri.localhost, e
// qualquer requisicao para a VPS e CROSS-ORIGIN. O nginx que serve
// /atualizacoes/ e /downloads/ NAO manda Access-Control-Allow-Origin (so o
// auth-server manda, e por isso que a conta funciona), entao o fetch da webview
// e barrado antes mesmo de sair. O plugin http faz a requisicao no lado NATIVO,
// onde nao existe CORS — e o mesmo motivo que lib/updater.ts ja documentava.
//
// Fora do Tauri (navegador, dev, export web) nao ha plugin: cai no fetch comum.
//
// ATENCAO: o caminho nativo respeita a allowlist de
// src-tauri/capabilities/default.json. URL nova aqui exige entrada la, senao a
// chamada e negada.

import { isTauri } from "@/lib/game-asset"

/**
 * Le JSON de uma URL com timeout. Devolve null em qualquer falha — quem chama
 * trata "sem atualizacao" e "sem rede" do mesmo jeito, e nada disso pode
 * derrubar o jogo.
 */
export async function buscarJson<T>(url: string, ms: number): Promise<T | null> {
  const controle = new AbortController()
  const alarme = setTimeout(() => controle.abort(), ms)
  try {
    const requisitar = await escolherFetch()
    const r = await requisitar(url, { signal: controle.signal, cache: "no-store" })
    if (!r.ok) return null
    return (await r.json()) as T
  } catch {
    return null
  } finally {
    clearTimeout(alarme)
  }
}

export type Requisitar = (url: string, init: RequestInit) => Promise<Response>

/**
 * O `fetch` certo para o ambiente: o nativo dentro do Tauri, o do navegador
 * fora dele. Exportado porque o save na nuvem precisa do MESMO desvio — ele
 * tambem fala com a VPS, so que com PUT e resposta grande.
 */
export async function fetchDoAmbiente(): Promise<Requisitar> {
  return escolherFetch()
}

async function escolherFetch(): Promise<Requisitar> {
  if (typeof window !== "undefined" && isTauri()) {
    try {
      const { fetch: nativo } = await import("@tauri-apps/plugin-http")
      return nativo as unknown as Requisitar
    } catch {
      // Plugin indisponivel: melhor tentar pela webview do que desistir.
    }
  }
  return fetch
}
