// Copia as logos das competicoes do pack de referencia (sortitoutsi/logos/Competicoes)
// para public/competicoes/<slug>.png, que e o que o jogo consome.
//
// Os arquivos do pack vem como "Nome Com Patrocinador__<ID>.png" e o nome NAO bate
// com o do jogo (ex.: "Paulistao Sicredi" vs "Campeonato Paulista"), por isso o match
// e por palavras-chave, nao por igualdade. O que nao casar e listado como FALTANDO
// para resolvermos manualmente em vez de silenciosamente cair num fallback.
//
// Uso: node scripts/copy-competition-logos.mjs

import { readdirSync, copyFileSync, mkdirSync, existsSync } from "node:fs"
import { join } from "node:path"

const SRC = "sortitoutsi/logos/Competicoes"
const OUT = "public/competicoes"

// slug usado pelo jogo -> palavras-chave que devem aparecer no nome do arquivo
const WANTED = {
  // Nacionais
  "brasileirao-serie-a": ["brasileirao betano"],
  "brasileirao-serie-b": ["brasileirao serie b"],
  "brasileirao-serie-c": ["brasileirao serie c"],
  "brasileirao-serie-d": ["brasileirao serie d"],
  "copa-do-brasil": ["copa betano do brasil"],
  // Continentais / mundiais
  "libertadores": ["conmebol libertadores"],
  "sul-americana": ["conmebol sudamericana"],
  "mundial-de-clubes": ["fifa club world cup"],
  "champions-league": ["uefa champions league"],
  "intercontinental": ["intercontinental"],
  // Estaduais (ESTADO_CAMPEONATO em lib/use-game-manager.ts)
  "campeonato-paulista": ["paulistao sicredi"],
  "campeonato-carioca": ["carioca superbet"],
  "campeonato-gaucho": ["gaucho", "gaúcho"],
  "campeonato-mineiro": ["campeonato mineiro"],
  "campeonato-baiano": ["campeonato baiano"],
  "campeonato-paranaense": ["paranaense"],
  "campeonato-pernambucano": ["pernambucano"],
  "campeonato-cearense": ["cearense"],
  "campeonato-goiano": ["goiano"],
  "campeonato-catarinense": ["catarinense"],
  "campeonato-alagoano": ["alagoano"],
  "campeonato-paraense": ["paraense"],
  "campeonato-amazonense": ["amazonense"],
  "campeonato-brasiliense": ["brasiliense", "candango"],
  "campeonato-capixaba": ["capixaba"],
  "campeonato-mato-grossense": ["mato-grossense", "matogrossense", "mato grossense"],
  "campeonato-potiguar": ["potiguar"],
  "campeonato-paraibano": ["paraibano"],
  "campeonato-maranhense": ["maranhense"],
  "campeonato-piauiense": ["piauiense"],
  "campeonato-sergipano": ["sergipano"],
  "campeonato-rondoniense": ["rondoniense"],
  "campeonato-amapaense": ["amapaense"],
}

// Exclui variantes que nao sao a competicao principal (base, feminino, 2a divisao...)
const EXCLUDE = /sub-?\d|sub\s|feminin|women|u-?\d\d|\bserie b\b|\bserie c\b|a2|a3|a4|segunda|2a divisao|juniores|junior/i

const norm = (s) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()

if (!existsSync(SRC)) {
  console.error(`Pasta de referencia nao encontrada: ${SRC}`)
  process.exit(1)
}
mkdirSync(OUT, { recursive: true })

const files = readdirSync(SRC).filter((f) => f.toLowerCase().endsWith(".png"))
const missing = []
let copied = 0

for (const [slug, keywords] of Object.entries(WANTED)) {
  // Serie B/C/D precisam casar mesmo batendo no EXCLUDE, entao tratamos a parte.
  const allowSerie = /serie-[bcd]$/.test(slug)

  const byKeyword = (f) => {
    const n = norm(f)
    if (n.includes("alt_comp")) return false // variante alternativa do logo
    return keywords.some((k) => n.includes(norm(k)))
  }

  // 1a passada: so a competicao principal (sem base/feminino/2a divisao).
  let candidates = files.filter((f) => byKeyword(f) && (allowSerie || !EXCLUDE.test(norm(f))))
  let relaxed = false

  // 2a passada: aceita a variante de base. Para estaduais o logo do Sub-20 e o da
  // MESMA federacao estadual, entao serve — mas marcamos para nao passar batido.
  if (candidates.length === 0) {
    candidates = files.filter(byKeyword)
    relaxed = candidates.length > 0
  }

  if (candidates.length === 0) {
    missing.push(slug)
    continue
  }

  // Prefere o nome mais curto = geralmente a competicao principal, sem sufixos.
  candidates.sort((a, b) => a.length - b.length)
  copyFileSync(join(SRC, candidates[0]), join(OUT, `${slug}.png`))
  copied++
  console.log(`${relaxed ? "~~" : "OK"}  ${slug.padEnd(26)} <- ${candidates[0]}${relaxed ? "  (variante de base)" : ""}`)
}

console.log(`\n${copied} logos copiadas para ${OUT}`)
if (missing.length) {
  console.log(`\nFALTANDO (${missing.length}) — nao existem no pack de referencia:`)
  for (const m of missing) console.log(`  - ${m}`)
}
