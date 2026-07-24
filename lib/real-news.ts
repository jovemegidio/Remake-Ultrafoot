"use client"

// NOTICIAS REAIS — o jogador acompanha o futebol de verdade dentro do jogo.
//
// O feed do escritorio sempre mostrou noticia GERADA (ficticia, sobre o proprio
// save). Isso continua sendo o certo no OFFLINE — e o unico conteudo possivel e
// combina com a carreira. Mas com internet da para trazer manchete de verdade.
//
// POR QUE O PLUGIN HTTP: o webview do Tauri aplica CORS e nenhum feed RSS de
// portal libera o dominio do jogo. `fetch` do navegador falharia sempre. O
// plugin faz a requisicao no lado NATIVO, onde CORS nao existe. A permissao em
// capabilities/default.json e ESCOPADA aos dominios de noticia — o jogo nao
// ganha rede aberta.
//
// Tudo aqui e best-effort: sem internet, sem plugin, feed fora do ar ou XML
// estranho, a funcao devolve [] e quem chama mostra a noticia in-game. Nenhuma
// falha de rede pode quebrar o escritorio.

import { storeGet, storeSet } from "@/lib/persistent-store"

export interface RealNewsItem {
  titulo: string
  link: string
  fonte: string
  publicadoEm: number
}

const CACHE_KEY = "ultrafoot:real-news"
const CACHE_TTL_MS = 30 * 60 * 1000 // 30 min: manchete nao muda a cada minuto

// Feeds em ordem de preferencia. O primeiro que responder vence.
const FEEDS: { url: string; fonte: string }[] = [
  { url: "https://ge.globo.com/rss/futebol/", fonte: "ge" },
  { url: "https://news.google.com/rss/search?q=futebol+brasileiro&hl=pt-BR&gl=BR&ceid=BR:pt-419", fonte: "Google Notícias" },
]

function estaNoTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window
}

/** Extrai <item><title>/<link>/<pubDate> de um RSS, sem dependencia de parser. */
function parseRss(xml: string, fonte: string): RealNewsItem[] {
  const itens: RealNewsItem[] = []
  const blocos = xml.split(/<item[\s>]/i).slice(1)
  for (const bloco of blocos.slice(0, 12)) {
    const tituloBruto = /<title>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/i.exec(bloco)?.[1]
    const link = /<link>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/link>/i.exec(bloco)?.[1]
    const data = /<pubDate>([\s\S]*?)<\/pubDate>/i.exec(bloco)?.[1]
    if (!tituloBruto) continue
    const titulo = tituloBruto
      .replace(/<[^>]+>/g, "")
      .replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'")
      .replace(/&lt;/g, "<").replace(/&gt;/g, ">")
      .trim()
    if (!titulo) continue
    const ts = data ? Date.parse(data) : NaN
    itens.push({
      titulo,
      link: (link ?? "").trim(),
      fonte,
      publicadoEm: Number.isFinite(ts) ? ts : Date.now(),
    })
  }
  return itens
}

function lerCache(): { itens: RealNewsItem[]; em: number } | null {
  try {
    const raw = storeGet(CACHE_KEY)
    if (!raw) return null
    const d = JSON.parse(raw) as { itens: RealNewsItem[]; em: number }
    return Array.isArray(d?.itens) ? d : null
  } catch { return null }
}

/**
 * Manchetes reais. Devolve [] quando nao ha internet/plugin — quem chama deve
 * cair na noticia in-game (modo offline).
 *
 * @param forcar ignora o cache de 30 min.
 */
export async function buscarNoticiasReais(forcar = false): Promise<RealNewsItem[]> {
  const cache = lerCache()
  if (!forcar && cache && Date.now() - cache.em < CACHE_TTL_MS) return cache.itens
  if (!estaNoTauri()) return cache?.itens ?? []

  try {
    // Import dinamico: no navegador (dev/web) o modulo nao existe e nao pode
    // quebrar o bundle.
    const { fetch: tauriFetch } = await import("@tauri-apps/plugin-http")
    for (const feed of FEEDS) {
      try {
        const res = await tauriFetch(feed.url, { method: "GET", connectTimeout: 8000 })
        if (!res.ok) continue
        const xml = await res.text()
        const itens = parseRss(xml, feed.fonte)
        if (itens.length > 0) {
          storeSet(CACHE_KEY, JSON.stringify({ itens, em: Date.now() }))
          return itens
        }
      } catch { /* tenta o proximo feed */ }
    }
  } catch { /* plugin ausente: segue com o cache/offline */ }

  // Sem rede agora: a ultima manchete baixada ainda serve (melhor que nada).
  return cache?.itens ?? []
}

/** Ha manchete real guardada? Usado para decidir o modo sem esperar a rede. */
export function temNoticiaRealEmCache(): boolean {
  return (lerCache()?.itens?.length ?? 0) > 0
}
