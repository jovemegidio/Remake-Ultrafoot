// Confere, um a um, se o clube "que falta" REALMENTE falta no seed.
//
//   node scripts/clubes-faltantes-conferir.mjs --lista faltando.txt [--json saida.json]
//
// ⚠️ "NAO CASOU" NAO QUER DIZER "NAO EXISTE". O casamento do canal e proposital-
// mente estrito (o nome do clube tem de TERMINAR o nome formal), e por isso ele
// erra para o lado de recusar: "Alagoinhas Atlético Clube" nao casa com
// "Atlético Alagoinhas" — mesmas palavras, ordem trocada — e o clube ESTA la.
// Criar em cima disso geraria duplicata, que e exatamente o que nao se quer.
//
// Aqui a busca e frouxa de proposito (palavras em comum, em qualquer ordem) e
// NAO decide nada: ela separa "provavelmente ja existe" de "sem nenhum
// parecido", para a decisao ser tomada olhando.

import { readFileSync, writeFileSync } from "node:fs"
import path from "node:path"

const arg = (n) => { const i = process.argv.indexOf(n); return i >= 0 ? process.argv[i + 1] : "" }
const lista = arg("--lista")
const json = arg("--json")
if (!lista) { console.error('uso: --lista <arquivo.txt> [--json saida.json]'); process.exit(1) }

const RAIZ = path.resolve(import.meta.dirname, "..")
const POOL = JSON.parse(readFileSync(path.join(RAIZ, "data/seeds/imported-bf2026.json"), "utf-8")).teams ?? []
const fonteCurada = readFileSync(path.join(RAIZ, "lib/teams-data.ts"), "utf-8")
  + "\n" + readFileSync(path.join(RAIZ, "lib/international-teams.ts"), "utf-8")
const curados = []
for (const m of fonteCurada.matchAll(/\{[^{}]*\}/g)) {
  const fk = m[0].match(/file_key:\s*"([^"]+)"/)
  const nm = m[0].match(/(?:^|[\s,{])nome:\s*"([^"]+)"/)
  if (fk && nm) curados.push({ fileKey: fk[1], nome: nm[1], curado: true })
}
const universo = [...POOL.map(t => ({ fileKey: t.fileKey, nome: t.nome, pais: t.pais, estado: t.estado })), ...curados]

const semAcento = s => (s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "")
// Palavras que TODO clube tem: nao contam como parecenca.
const RUIDO = new Set([
  "esporte", "esportes", "esportivo", "esportiva", "sport", "sporting", "clube", "club", "cl",
  "futebol", "football", "foot", "ball", "fc", "ec", "ac", "sc", "aa", "ad", "se", "cf", "cr",
  "associacao", "sociedade", "desportivo", "desportiva", "desportos", "desp", "atletico", "atletica",
  "recreativo", "recreativa", "cultural", "regatas", "saf", "ltda", "sa", "de", "do", "da", "dos",
  "das", "e", "the", "of", "and", "gremio", "uniao", "academia", "centro", "real",
])
// ⚠️ O SEED ABREVIA O ADJETIVO DE ESTADO E ISSO CRIA UM PONTO CEGO ENORME.
// "Clube Atlético Mineiro SAF" nao tem UMA palavra em comum com "Atlético-MG"
// depois que "atletico" e "clube" saem como ruido — e o Galo saiu na lista de
// "criar". O mesmo com Goianiense/GO, Cearense/CE, Paranaense/PR. Aqui o
// adjetivo tambem vale pela sigla, dos dois lados.
const ADJETIVO_UF = {
  acreano: "ac", acriano: "ac", alagoano: "al", amapaense: "ap", amazonense: "am",
  baiano: "ba", cearense: "ce", brasiliense: "df", capixaba: "es", goiano: "go",
  goianiense: "go", maranhense: "ma", matogrossense: "mt", sulmatogrossense: "ms",
  mineiro: "mg", paraense: "pa", paraibano: "pb", paranaense: "pr", pernambucano: "pe",
  piauiense: "pi", carioca: "rj", fluminense: "rj", potiguar: "rn", gaucho: "rs",
  rondoniense: "ro", roraimense: "rr", catarinense: "sc", paulista: "sp",
  paulistano: "sp", sergipano: "se", tocantinense: "to",
}
const tokens = s => semAcento(s).toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter(Boolean)
const fortes = s => {
  const t = tokens(s)
  const UF2 = new Set(Object.values(ADJETIVO_UF))
  const r = t.filter(x => (x.length >= 3 || UF2.has(x)) && !RUIDO.has(x))
  for (const x of t) if (ADJETIVO_UF[x]) r.push(ADJETIVO_UF[x])
  return r
}

const indice = new Map()
for (const t of universo) {
  for (const w of new Set([...fortes(t.nome), ...fortes(t.fileKey.replace(/[_-]/g, " "))])) {
    if (!indice.has(w)) indice.set(w, [])
    indice.get(w).push(t)
  }
}

const linhas = readFileSync(lista, "utf-8").split(/\r?\n/).map(s => s.trim()).filter(Boolean)
const parecidos = [], semNada = []

for (const nome of linhas) {
  const alvo = fortes(nome)
  const pontos = new Map()
  for (const w of new Set(alvo)) {
    for (const t of indice.get(w) ?? []) pontos.set(t, (pontos.get(t) ?? 0) + w.length)
  }
  let melhores = [...pontos].sort((a, b) => b[1] - a[1]).slice(0, 4)
  // ⚠️ SEGUNDA PASSADA, SEM O FILTRO DE RUIDO. "Sport Club do Recife" tem
  // "recife" como unica palavra forte, e o seed guarda o clube como so "Sport":
  // zero palavras em comum, e o Leao saiu como "criar". Quando a passada normal
  // nao acha nada, vale qualquer palavra de 4+ letras, ruido inclusive.
  if (!melhores.length) {
    const cru = new Map()
    for (const w of new Set(tokens(nome).filter(t => t.length >= 4))) {
      for (const t of universo) {
        if (tokens(t.nome).includes(w) || tokens(t.fileKey.replace(/[_-]/g, " ")).includes(w)) {
          cru.set(t, (cru.get(t) ?? 0) + w.length)
        }
      }
    }
    melhores = [...cru].sort((a, b) => b[1] - a[1]).slice(0, 4)
  }
  if (!melhores.length) { semNada.push(nome); continue }
  parecidos.push({ nome, candidatos: melhores.map(([t, p]) => ({ fileKey: t.fileKey, nome: t.nome, uf: t.estado || t.pais || "", pontos: p })) })
}

console.log(`${linhas.length} nomes | ${parecidos.length} com algum parecido no seed | ${semNada.length} sem NENHUM parecido\n`)
console.log("=== TEM PARECIDO (conferir antes de criar) ===")
for (const p of parecidos) {
  console.log(`  ${p.nome}`)
  for (const c of p.candidatos) console.log(`      ${c.pontos.toString().padStart(3)}  ${c.fileKey}  "${c.nome}"  ${c.uf}`)
}
console.log("\n=== SEM NENHUM PARECIDO (candidatos a criar) ===")
for (const n of semNada) console.log(`  ${n}`)

if (json) {
  writeFileSync(json, JSON.stringify({ parecidos, semNada }, null, 1), "utf-8")
  console.log(`\nGravado em ${json}`)
}
