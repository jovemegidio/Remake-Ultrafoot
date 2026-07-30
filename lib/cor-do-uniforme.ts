"use client"

// COR REAL DA CAMISA ESCOLHIDA.
//
// O radar sempre pintou os jogadores com `getKitColors(team, variante)`, que
// deriva a cor das DUAS cores cadastradas do clube: casa = cor1, visitante =
// cor2, terceiro = um cinza-quase-preto fixo. Isso ignora a arte de verdade.
// Resultado do relato: o Fluminense entra com o TERCEIRO uniforme (vermelho) e
// o radar pinta o time de preto; o Palmeiras escolhe o visitante (branco) e o
// radar continua verde.
//
// Aqui a cor sai da PROPRIA IMAGEM da camisa que a pessoa selecionou: lemos o
// PNG num canvas e tiramos a cor dominante do TRONCO (o peito da camisa, sem
// mangas, gola nem numero). Quando o clube nao tem arte — 25 clubes nao tem —,
// a camisa desenhada (DrawnKit) ja usa getKitColors, entao cair nela mantem
// radar e camisa combinando de qualquer jeito.
//
// Sobre CORS: o canvas fica "manchado" (e getImageData lanca) se a imagem vier
// de outra origem sem Access-Control-Allow-Origin. As duas origens do jogo
// mandam `*` — o protocolo game-asset:// do Tauri (src-tauri/src/lib.rs) e o
// raw.githubusercontent.com da web —, por isso o crossOrigin="anonymous"
// abaixo funciona. Se algum dia parar de funcionar, a leitura falha em silencio
// e volta o comportamento antigo; nunca quebra a partida.

import { useEffect, useState } from "react"
import { getCamisaUrl, isKitVariantAvailable, type Team } from "@/lib/teams-data"
import { getKitColors, type KitVariant } from "@/components/match/kit-image"

/** Cor ja lida por URL. Uma camisa e lida uma vez por sessao. */
const cache = new Map<string, string | null>()
const emVoo = new Map<string, Promise<string | null>>()

function paraHex(r: number, g: number, b: number): string {
  return `#${[r, g, b].map(c => c.toString(16).padStart(2, "0")).join("")}`
}

/**
 * Cor dominante do tronco da camisa.
 *
 * Amostra so a faixa central da arte (peito/barriga) porque e ali que esta a
 * cor que a pessoa reconhece como "a cor do time". Mangas e gola costumam ser
 * da cor secundaria, e o numero/escudo no peito e ruido.
 *
 * As cores sao agrupadas em baldes de 5 bits por canal antes de votar: sem
 * isso, um degrade de sombra vira centenas de cores distintas e nenhuma vence.
 */
async function lerCorDominante(url: string): Promise<string | null> {
  if (typeof window === "undefined" || !url) return null
  if (/^data:image\/svg/i.test(url)) return null

  const img = new Image()
  img.crossOrigin = "anonymous"
  img.decoding = "async"
  img.src = url

  try {
    await img.decode()
  } catch {
    return null
  }
  if (!img.naturalWidth || !img.naturalHeight) return null

  const LADO = 48
  const canvas = document.createElement("canvas")
  canvas.width = LADO
  canvas.height = LADO
  const ctx = canvas.getContext("2d", { willReadFrequently: true })
  if (!ctx) return null
  ctx.drawImage(img, 0, 0, LADO, LADO)

  let dados: Uint8ClampedArray
  try {
    dados = ctx.getImageData(0, 0, LADO, LADO).data
  } catch {
    // Canvas manchado (imagem sem CORS): sem leitura, sem cor.
    return null
  }

  const x0 = Math.round(LADO * 0.34)
  const x1 = Math.round(LADO * 0.66)
  const y0 = Math.round(LADO * 0.38)
  const y1 = Math.round(LADO * 0.78)

  const votos = new Map<number, { n: number; r: number; g: number; b: number }>()
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const i = (y * LADO + x) * 4
      if (dados[i + 3] < 200) continue // fundo transparente da arte
      const r = dados[i]
      const g = dados[i + 1]
      const b = dados[i + 2]
      const balde = ((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3)
      const atual = votos.get(balde)
      if (atual) {
        atual.n++
        atual.r += r
        atual.g += g
        atual.b += b
      } else {
        votos.set(balde, { n: 1, r, g, b })
      }
    }
  }
  if (!votos.size) return null

  let vencedor: { n: number; r: number; g: number; b: number } | null = null
  for (const v of votos.values()) if (!vencedor || v.n > vencedor.n) vencedor = v
  if (!vencedor) return null
  return paraHex(
    Math.round(vencedor.r / vencedor.n),
    Math.round(vencedor.g / vencedor.n),
    Math.round(vencedor.b / vencedor.n),
  )
}

/** Cor dominante da arte, com cache por URL. `null` quando nao da para ler. */
export function corDominanteDoKit(url: string): Promise<string | null> {
  if (cache.has(url)) return Promise.resolve(cache.get(url)!)
  const jaPedida = emVoo.get(url)
  if (jaPedida) return jaPedida
  const promessa = lerCorDominante(url)
    .catch(() => null)
    .then(cor => {
      cache.set(url, cor)
      emVoo.delete(url)
      return cor
    })
  emVoo.set(url, promessa)
  return promessa
}

/**
 * Cor com que o time entra em campo, para o radar e para o aviso de cores
 * parecidas. Comeca na estimativa por cor1/cor2 (sincrona, para o radar nunca
 * piscar sem cor) e troca pela cor lida da arte assim que ela chega.
 */
export function useCorDoUniforme(team: Team | null | undefined, variant: KitVariant): string {
  const estimada = team ? getKitColors(team, variant).body : "#888888"
  const [cor, setCor] = useState(estimada)

  useEffect(() => {
    if (!team) return
    setCor(estimada)
    if (!isKitVariantAvailable(team.file_key, variant)) return
    const url = getCamisaUrl(team.file_key, variant, team.nome)
    if (!url) return
    let vivo = true
    void corDominanteDoKit(url).then(lida => {
      if (vivo && lida) setCor(lida)
    })
    return () => { vivo = false }
    // `estimada` deriva de team+variant; as duas chaves abaixo bastam.
  }, [team, variant, estimada])

  return cor
}
