// Chaves do canal que servem a MESMA imagem — gêmeo legítimo ou clube errado?
//
//   node scripts/auditar-imagens-repetidas.mjs --manifesto elencos.json [--pool]
//
// Publicar o mesmo arquivo em duas chaves é rotina e correto: o clube existe no
// pool e no catálogo curado, e a tela consulta ora um, ora outro
// (`veloclube_bra` + `veloclube_sp`). O MESMO mecanismo, quando o gêmeo é
// resolvido por NOME, atravessa fronteira e publica a camisa de um clube em
// cima de outro — foi assim que `nacional_uru` (Montevidéu) passou a vestir a
// camisa listrada do Atlético Nacional da Colômbia, e nada acusou.
//
// Este script não decide: ele REDUZ a lista. Só o par cujos nomes não se
// parecem precisa de olho humano, e é ele que sai marcado.

import { readFileSync } from "node:fs"
import path from "node:path"

const arg = (n, padrao = "") => {
  const i = process.argv.indexOf(n)
  return i >= 0 ? process.argv[i + 1] : padrao
}
const MANIFESTO = arg("--manifesto")
if (!MANIFESTO) { console.error("uso: --manifesto elencos.json"); process.exit(1) }

const RAIZ = path.resolve(import.meta.dirname, "..")
const manifesto = JSON.parse(readFileSync(MANIFESTO, "utf-8"))

// Nome de cada chave, para o julgamento sair legível. O manifesto guarda nome só
// de quem o painel editou; o pool tem o resto.
const nomes = new Map()
try {
  const seed = JSON.parse(readFileSync(path.join(RAIZ, "data/seeds/imported-bf2026.json"), "utf-8"))
  for (const t of seed.teams ?? []) if (t.fileKey) nomes.set(t.fileKey, t.nome)
} catch { /* sem pool: segue só com o manifesto */ }
for (const [k, t] of Object.entries(manifesto.times || {})) if (t?.nome) nomes.set(k, t.nome)

const semAcento = (s) => (s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "")
const norm = (s) => semAcento(s).toLowerCase().replace(/[^a-z0-9]/g, "")

/** Duas chaves são o mesmo clube? Nome igual, ou um contido no outro, ou a
 *  chave de um contida na do outro (`veloclube_bra` x `veloclube_sp`). */
const PAIS_NO_FIM = /_(bra|arg|ita|esp|ing|ale|fra|por|col|uru|per|par|chi|equ|mex|eua|jap|chn|ara|sue|fin|est|bel|bol|ven|cze|tur)$/i

function mesmoClube(a, b) {
  // ⚠️ SUFIXO DE PAIS DIFERENTE NUNCA E O MESMO CLUBE — e o descarte que mais
  // importa aqui. Sem ele `nacional_uru` e `nacional_col` viram "gemeo" (o
  // radical e o mesmo) e o caso some do relatorio, que foi exatamente o que
  // aconteceu: o Nacional de Montevideu esta no ar com a camisa listrada do
  // Atletico Nacional da Colombia desde um lote antigo.
  const [pa, pb] = [a.match(PAIS_NO_FIM)?.[1]?.toLowerCase(), b.match(PAIS_NO_FIM)?.[1]?.toLowerCase()]
  if (pa && pb && pa !== pb) return false

  const [na, nb] = [norm(nomes.get(a) ?? a), norm(nomes.get(b) ?? b)]
  if (na && nb && (na === nb || na.includes(nb) || nb.includes(na))) return true
  const [ka, kb] = [norm(a.replace(PAIS_NO_FIM, "")), norm(b.replace(PAIS_NO_FIM, ""))]
  return Boolean(ka && kb && (ka === kb || ka.includes(kb) || kb.includes(ka)))
}

function grupos(extrair) {
  const porSha = new Map()
  for (const [fk, t] of Object.entries(manifesto.times || {})) {
    for (const url of extrair(t)) {
      const sha = (url || "").split("/").pop()
      if (!sha) continue
      if (!porSha.has(sha)) porSha.set(sha, new Set())
      porSha.get(sha).add(fk)
    }
  }
  return [...porSha.entries()].filter(([, k]) => k.size > 1).map(([sha, k]) => [sha, [...k]])
}

const relatar = (titulo, lista) => {
  const suspeitos = lista.filter(([, chaves]) => chaves.some((a, i) => chaves.some((b, j) => j > i && !mesmoClube(a, b))))
  console.log(`\n${titulo}: ${lista.length} imagens em mais de uma chave; ${suspeitos.length} com nomes que NAO batem`)
  for (const [sha, chaves] of suspeitos) {
    console.log(`  ${sha.slice(0, 12)}  ${chaves.map(k => `${k} [${nomes.get(k) ?? "?"}]`).join("  |  ")}`)
  }
}

relatar("ESCUDO", grupos(t => [t.logoUrl]))
relatar("UNIFORME", grupos(t => Object.values(t.kits || {}).map(k => k.imageUrl)))
