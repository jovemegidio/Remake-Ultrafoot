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

/**
 * A OUTRA forma da mesma URL: caminho simples <-> protocolo do Tauri.
 *
 * ⚠️ POR QUE ISTO EXISTE (relato: "as fotos nao aparecem no app instalado, em
 * outro computador").
 *
 * O jogo e EXPORT ESTATICO: o HTML e pre-renderizado no build, onde `window` nao
 * existe. Naquele instante `isTauri()` e falso e a URL sai como `/jogadores/x.png`,
 * gravada no HTML. Dentro do aplicativo esse caminho NAO resolve — o
 * `prune-export-music.mjs` remove `out/jogadores` do frontend embutido (as fotos
 * viajam como *resources*, alcancaveis so por `game-asset://`). O React 18 nao
 * corrige atributos divergentes na hidratacao, entao o `src` errado podia
 * permanecer e a imagem virava 404 silencioso -> iniciais.
 *
 * O inverso tambem acontece: uma URL de protocolo gravada num contexto onde o
 * Tauri nao esta presente (versao web, navegador) nao carrega.
 *
 * Em vez de depender de acertar o ambiente na primeira tentativa, o
 * `PlayerAvatar` tenta a outra forma quando a primeira falha. Devolve `null`
 * quando nao ha alternativa (http, data, blob).
 */
export function gameAssetUrlAlternativa(url: string): string | null {
  if (!url) return null
  if (url.startsWith(TAURI_ASSET_PREFIX)) {
    const caminho = url.slice(TAURI_ASSET_PREFIX.length)
    return caminho.startsWith("/") ? caminho : `/${caminho}`
  }
  if (url.startsWith("/")) return `${TAURI_ASSET_PREFIX}${url}`
  return null
}
