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
 * ESTA MAQUINA CONSEGUE FALAR COM ESTA URL?
 *
 * ⚠️ FORA DO TAURI, PEDIDO CROSS-ORIGIN PARA A VPS NAO TEM COMO DAR CERTO. O
 * nginx que serve `/downloads/` e `/atualizacoes/` NAO manda
 * `Access-Control-Allow-Origin` — so o `/auth` manda, e e por isso que a conta
 * funciona no navegador. Tentar assim mesmo nao "tenta a sorte": ele so imprime
 * um erro de CORS no console, um por consumidor, em toda tela.
 *
 * Era esse barulho que afogava a auditoria de telas (40 de 40 reprovadas). E a
 * licao que veio junto: calar o aviso no teste era esconder o sintoma — o lugar
 * de nao fazer o pedido impossivel e AQUI, onde o pedido nasce.
 *
 * Dentro do Tauri tudo passa: a requisicao sai pelo lado nativo, onde CORS nao
 * existe. Ver `escolherFetch`.
 */
export function alcancavelDaqui(url: string): boolean {
  if (typeof window === "undefined") return false
  if (isTauri()) return true
  try {
    const alvo = new URL(url, window.location.href)
    if (alvo.origin === window.location.origin) return true
    // Unico caminho da VPS que responde com CORS.
    return alvo.pathname.startsWith("/auth")
  } catch {
    return false
  }
}

/**
 * Le JSON de uma URL com timeout. Devolve null em qualquer falha — quem chama
 * trata "sem atualizacao" e "sem rede" do mesmo jeito, e nada disso pode
 * derrubar o jogo.
 */
export async function buscarJson<T>(url: string, ms: number): Promise<T | null> {
  if (!alcancavelDaqui(url)) return null
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
