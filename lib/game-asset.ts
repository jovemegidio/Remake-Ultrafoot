// Utilitario centralizado para resolver URLs de assets do jogo.
// No ambiente web (navegador / Next.js) os assets sao servidos diretamente.
// Dentro do app Tauri eles sao servidos pelo protocolo customizado "game-asset://".

// Detecta se o codigo esta rodando dentro do app desktop Tauri.
export function isTauri(): boolean {
  if (typeof window === "undefined") return false
  // @ts-expect-error - propriedades injetadas pelo runtime do Tauri
  return typeof window.__TAURI__ !== "undefined" || typeof window.__TAURI_INTERNALS__ !== "undefined"
}

// Prefixo do protocolo customizado registrado no Tauri (ver src-tauri/src/lib.rs)
const TAURI_ASSET_PREFIX = "game-asset://localhost"

/**
 * Resolve a URL de um asset do jogo.
 *
 * @param raw - Caminho local (ex: "/escudos/flamengo.png") ou URL completa.
 * @returns A URL pronta para uso no ambiente atual.
 */
export function gameAssetUrl(raw: string): string {
  if (!raw) return raw

  // URLs absolutas (http/https, data, blob) sao retornadas como estao.
  if (/^(https?:|data:|blob:|game-asset:)/i.test(raw)) {
    return raw
  }

  // No ambiente web, basta usar o caminho relativo a partir da raiz publica.
  if (!isTauri()) {
    return raw.startsWith("/") ? raw : `/${raw}`
  }

  // Dentro do Tauri, usa o protocolo customizado.
  const path = raw.startsWith("/") ? raw : `/${raw}`
  return `${TAURI_ASSET_PREFIX}${path}`
}
