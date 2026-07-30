// Imagens ilustrativas das noticias.
//
// Antes usava picsum.photos: banco de fotos ALEATORIO (paisagens, comida, etc), sem
// nenhuma relacao com futebol — e no Tauri retornava null, deixando a noticia sem capa.
// Agora usa o proprio acervo de futebol do jogo (estadio, tunel, gramado), escolhido
// por categoria e de forma deterministica pelo seed: a mesma noticia sempre mostra a
// mesma capa. Funciona offline, sem servico externo e sem chave de API.

/**
 * Gera um seed numerico estavel a partir de uma string (ex: id da noticia).
 * Usa um hash simples (djb2) para distribuir bem os valores.
 */
export function seedFromString(input: string): number {
  let hash = 5381
  for (let i = 0; i < input.length; i++) {
    hash = (hash * 33) ^ input.charCodeAt(i)
  }
  // Garante valor positivo
  return Math.abs(hash >>> 0)
}

// Acervo local (public/images/*). Todas embutidas no frontend, entao carregam offline.
const STADIUM = "/images/stadium-bg.webp"
const STADIUM_NIGHT = "/images/stadium-night.png"
const TUNNEL = "/images/stadium-tunnel.png"
const PITCH = "/images/field-bg.webp"
const LEAGUES = "/images/leagues-ultrafoot.jpg"

// Capas por categoria de noticia. Varias opcoes = variedade sem perder o contexto.
const NEWS_IMAGES: Record<string, string[]> = {
  transfer: [TUNNEL, STADIUM],
  injury: [PITCH],
  match: [STADIUM_NIGHT, STADIUM, PITCH],
  highlight: [STADIUM_NIGHT, STADIUM],
  ranking: [LEAGUES, STADIUM],
  announcement: [TUNNEL, STADIUM_NIGHT],
}

const DEFAULT_IMAGES = [STADIUM, STADIUM_NIGHT, PITCH]

/**
 * Resolve a capa de uma noticia.
 *
 * @param category - Categoria da noticia (transfer, injury, match, highlight, ...).
 * @param seed - Seed deterministico (normalmente derivado do id da noticia).
 * @returns Caminho local da imagem. Nunca retorna null — sempre ha uma capa de futebol.
 */
export function getNewsImageUrl(category: string, seed: number): string {
  const pool = NEWS_IMAGES[category] ?? DEFAULT_IMAGES
  const combined = (seed ^ seedFromString(category)) >>> 0
  return pool[combined % pool.length]
}
