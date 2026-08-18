// A BANDEIRA DE UM PAÍS — WebP quando existe, PNG antigo quando não.
//
// ⚠️ POR QUE ESTE MÓDULO EXISTE. Em 18/08/2026 o jogo tinha DEZ bandeiras em
// `public/flags` — `br`, `de`, `es`, `fr`, `gb-eng`, `it`, `mx`, `pt`, `sa`,
// `us` — e cada tela montava o caminho na mão, com `.png` cravado. A tela de
// pré-jogo mostrava um Brasil borrado porque era o único arquivo que existia
// para pedir.
//
// Chegaram 71 bandeiras novas, em WebP e de melhor qualidade. Mas elas cobrem de
// "Afghanistan" a "Grenada": `it`, `mx`, `pt`, `sa` e `us` continuam só no PNG
// antigo. Trocar `.png` por `.webp` em todo lugar apagaria essas cinco da tela —
// o tipo de regressão que ninguém vê até abrir a tela certa.
//
// Aqui a decisão é por CÓDIGO, contra o manifesto gerado na importação. Quando a
// próxima leva de arquivos chegar, basta rodar `importar-bandeiras.mjs` de novo:
// o manifesto cresce e as telas passam a usar o arquivo melhor sozinhas.

import manifesto from "@/public/flags/manifest.json"

const COM_WEBP = new Set(manifesto as string[])

/**
 * Apelidos que o jogo usa e que não são ISO-2.
 *
 * As quatro britânicas são seleções separadas no futebol e não têm código de
 * país próprio; `BRA`/`ARG` aparecem em dados que usam ISO-3.
 */
const APELIDOS: Record<string, string> = {
  eng: "gb-eng", sct: "gb-sct", wal: "gb-wls", nir: "gb-nir",
  bra: "br", arg: "ar", ale: "de", esp: "es", ing: "gb-eng", fra: "fr",
  ita: "it", por: "pt", uru: "uy", chi: "cl", col: "co", par: "py",
  eua: "us", mex: "mx",
}

/** Normaliza o que as telas passam: "BR", "bra", "gb-eng" — tudo vira um código. */
export function codigoDaBandeira(entrada: string | undefined | null): string {
  const bruto = (entrada ?? "").trim().toLowerCase()
  if (!bruto) return ""
  return APELIDOS[bruto] ?? bruto
}

/**
 * O caminho da bandeira. Devolve `null` quando não há arquivo nenhum — e quem
 * chama DEVE tratar isso, porque desenhar um `<img>` quebrado é pior do que não
 * desenhar bandeira alguma.
 */
export function bandeiraUrl(entrada: string | undefined | null): string | null {
  const codigo = codigoDaBandeira(entrada)
  if (!codigo) return null
  if (COM_WEBP.has(codigo)) return `/flags/${codigo}.webp`
  // Os dez originais continuam valendo enquanto o acervo novo não os alcança.
  if (LEGADAS.has(codigo)) return `/flags/${codigo}.png`
  return null
}

/** As que existiam antes do acervo novo, e que ainda não têm WebP. */
const LEGADAS = new Set(["br", "de", "es", "fr", "gb-eng", "it", "mx", "pt", "sa", "us"])

/** Quantas bandeiras o jogo consegue mostrar hoje. Usado pelo gate. */
export function totalDeBandeiras(): number {
  return new Set([...COM_WEBP, ...LEGADAS]).size
}
