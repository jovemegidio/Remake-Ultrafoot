// Utilitario para gerar URLs de imagens ilustrativas das noticias.
// No ambiente web usa o servico picsum.photos com seed deterministico,
// garantindo que a mesma noticia sempre mostre a mesma imagem.
// Dentro do app Tauri offline retorna null para usar o fallback visual.

import { isTauri } from "@/lib/game-asset"

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

/**
 * Resolve a URL de uma imagem ilustrativa para uma noticia.
 *
 * @param category - Categoria da noticia (transfer, injury, match, etc.).
 * @param seed - Seed deterministico (normalmente derivado do id da noticia).
 * @param width - Largura desejada da imagem.
 * @param height - Altura desejada da imagem.
 * @returns A URL da imagem, ou null quando offline (Tauri) para usar fallback.
 */
export function getNewsImageUrl(
  category: string,
  seed: number,
  width = 800,
  height = 450,
): string | null {
  // No app desktop offline nao ha acesso a servicos externos de imagem.
  if (isTauri()) return null

  // picsum.photos aceita um seed para retornar sempre a mesma imagem.
  // A categoria entra no seed para variar entre tipos de noticia.
  const categorySeed = seedFromString(category)
  const combinedSeed = (seed ^ categorySeed) >>> 0

  return `https://picsum.photos/seed/${combinedSeed}/${width}/${height}`
}
