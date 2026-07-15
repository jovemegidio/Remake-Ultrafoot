// Compressao de imagens importadas (escudos/uniformes) ANTES de irem pro save.
//
// Problema que isto resolve: o editor de clubes guardava a imagem importada em tamanho
// ORIGINAL como base64 no persistent-store (ultrafoot-clubs.json). Uma foto de alguns MB
// virava um base64 gigante; com varios clubes editados o save passava de 100 MB e o jogo
// TRAVAVA/dava erro ao carregar. Aqui reduzimos a imagem para um lado maximo pequeno e
// re-encodamos, cortando o tamanho em ordens de grandeza sem diferenca visivel num escudo.
//
// Roda so no cliente (usa <canvas>/<Image>). Fora do browser, devolve a original.

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })
}

/**
 * Reduz uma imagem (data URL) para no maximo `maxSize`px no maior lado e re-encoda como PNG
 * (preserva transparencia de escudos/camisas). So substitui se o resultado ficar MENOR que
 * o original. SVG passa intacto (e vetorial e leve; rasterizar perderia qualidade).
 */
export async function compressImageDataUrl(dataUrl: string, maxSize = 256): Promise<string> {
  if (!dataUrl.startsWith("data:image/")) return dataUrl
  if (dataUrl.startsWith("data:image/svg")) return dataUrl
  if (typeof document === "undefined") return dataUrl

  try {
    const img = await loadImage(dataUrl)
    const largest = Math.max(img.width, img.height) || maxSize
    const scale = Math.min(1, maxSize / largest)
    const w = Math.max(1, Math.round(img.width * scale))
    const h = Math.max(1, Math.round(img.height * scale))

    const canvas = document.createElement("canvas")
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext("2d")
    if (!ctx) return dataUrl
    ctx.drawImage(img, 0, 0, w, h)

    const out = canvas.toDataURL("image/png")
    return out.length < dataUrl.length ? out : dataUrl
  } catch {
    // Se qualquer coisa falhar (imagem invalida, etc.), nao arrisca perder a importacao.
    return dataUrl
  }
}
