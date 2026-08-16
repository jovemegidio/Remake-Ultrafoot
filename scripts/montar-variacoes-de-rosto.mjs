// Monta a arvore que o publicar-fotos-catalogo.mjs sabe ler, a partir das
// pastas de VARIACAO DE ROSTO (o mesmo atleta renderizado no uniforme de N
// clubes).
//
//   node scripts/montar-variacoes-de-rosto.mjs --pasta "<raiz>" --saida "<arvore>" \
//     --nomes "Robinho Jr=Robinho Junior,Zé Ivaldo=Zé Ivaldo"
//
// A origem esta INVERTIDA em relacao ao catalogo: la e uma pasta por CLUBE com
// os atletas dentro; aqui e uma pasta por ATLETA com os clubes dentro
// (`robinhojr-palmeiras.png`). Este script vira a arvore do avesso e devolve a
// linha de comando pronta — assim o recorte peitoral, o webp e a chave curada
// continuam vindo de um lugar so, em vez de virarem uma segunda copia.
//
// ⚠️ O NOME DA PASTA NAO E O NOME DO ATLETA NO JOGO. A pasta diz "Robinho Jr" e
// o elenco diz "Robinho Junior"; a chave e `fileKey__nome_normalizado`, entao a
// diferenca deixa a foto orfa sem erro nenhum. Por isso `--nomes`.

import { readdirSync, mkdirSync, copyFileSync, rmSync, existsSync } from "node:fs"
import { readFileSync } from "node:fs"
import path from "node:path"

const arg = (n) => { const i = process.argv.indexOf(n); return i >= 0 ? process.argv[i + 1] : "" }
const RAIZ = path.resolve(import.meta.dirname, "..")
const pasta = arg("--pasta")
const saida = arg("--saida")
if (!pasta || !saida) {
  console.error('uso: --pasta "<raiz das variacoes>" --saida "<arvore>" [--nomes "Pasta=Nome no jogo,..."]')
  process.exit(1)
}

const NOMES = new Map(
  (arg("--nomes") || "").split(",").map(p => p.trim()).filter(Boolean)
    .map(p => { const i = p.indexOf("="); return [p.slice(0, i).trim(), p.slice(i + 1).trim()] }),
)

const norm = s => (s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "")

// Mesmo universo do resto do canal: o pool e o catalogo curado.
const POOL = JSON.parse(readFileSync(path.join(RAIZ, "data/seeds/imported-bf2026.json"), "utf-8")).teams ?? []
const fonteCurada = readFileSync(path.join(RAIZ, "lib/teams-data.ts"), "utf-8")
  + "\n" + readFileSync(path.join(RAIZ, "lib/international-teams.ts"), "utf-8")
const curados = []
for (const m of fonteCurada.matchAll(/\{[^{}]*\}/g)) {
  const fk = m[0].match(/file_key:\s*"([^"]+)"/)
  const nm = m[0].match(/(?:^|[\s,{])nome:\s*"([^"]+)"/)
  if (fk && nm) curados.push({ fileKey: fk[1], nome: nm[1] })
}

// ⚠️ SIGLA E APELIDO NAO SE ADIVINHAM. Cada linha aqui foi conferida contra o
// pool; sem ela o slug cai em clube nenhum (ou, pior, em outro clube).
const MANUAL = new Map(Object.entries({
  athletic: "athleticclub_mg",            // Athletic Club (MG), nao o Bilbao
  "athletic-bilbao": "atleticobilbao_esp",
  "atletico-madrid": "atleticomadrid_esp",
  atleticogo: "atleticogo_bra",
  atleticomineiro: "atleticomg_bra",
  atleticopr: "atleticopr_bra",
  bocajr: "bocajuniors_arg",
  caixiassc: "caxiasc_bra",               // Caxias de Joinville (SC)
  estudiantesba: "EstudiantesDeCaseros_arg",  // "BA" = Buenos Aires (Caseros)
  figuerense: "figueirense_sc",
  fckoln: "fckoln_ale",
  gremiors: "gremio",
  gremionovohorizontino: "novorinzontino_sp",
  internacionalrs: "internacional_bra",
  newellsoldboys: "newoldboys_ar",
  rbleipzig: "leipzig_ale",
  saobernardo: "saobernardo_sp",
  "sãopaulo": "saopaulo_bra",
  vilanova: "vilago",
  operario: "operario_pr",
  floresta: "floresta_ce",
  avai: "avai_bra",
  amazonas: "amazonas_am",
  barcelona: "barcelona_esp",
  everton: "everton_ing",
  gimnasia: "gimnasialp_arg",             // Gimnasia de La Plata
  instituto: "Instituto_arg",
  velez: "velezsarsfield_arg",
  lanus: "lanus_arg",
  estudiantes: "estudiantes_ar",           // Estudiantes de La Plata
  riverplate: "riverplate_arg",
  hamburgo: "hamburgo_ale",
  vitoria: "vitoria",
  sport: "sport",
  remo: "remo_pa",
  vasco: "vasco",
  bragantino: "bragantino_bra",
  augsburg: "augsburg_ale",
  freiburg: "freiburg_ale",
  paderborn: "paderborn_ale",
  botafogorj: "botafogorj_bra",
}))

const porFileKey = new Map(POOL.filter(t => t.fileKey).map(t => [norm(t.fileKey), t]))
const porNome = new Map()
for (const t of POOL) {
  const k = norm(t.nome)
  if (k && !porNome.has(k)) porNome.set(k, t)
}
for (const c of curados) {
  const k = norm(c.nome)
  if (k && !porNome.has(k)) porNome.set(k, { fileKey: c.fileKey, nome: c.nome })
}

function acharClube(slug) {
  const m = MANUAL.get(slug)
  if (m) {
    const existe = porFileKey.has(norm(m)) || curados.some(c => c.fileKey === m)
    if (!existe) throw new Error(`MANUAL: "${slug}" -> "${m}" nao existe no pool nem no curado`)
    return m
  }
  const a = norm(slug)
  return porFileKey.get(a)?.fileKey ?? porNome.get(a)?.fileKey ?? null
}

if (existsSync(saida)) rmSync(saida, { recursive: true, force: true })
mkdirSync(saida, { recursive: true })

const semClube = new Set()
const pares = new Map() // fileKey -> pasta

for (const jogador of readdirSync(pasta, { withFileTypes: true }).filter(d => d.isDirectory())) {
  const nomeNoJogo = NOMES.get(jogador.name) ?? jogador.name
  for (const arquivo of readdirSync(path.join(pasta, jogador.name)).filter(f => /\.png$/i.test(f))) {
    const slug = arquivo.replace(/\.png$/i, "").split("-").slice(1).join("-")
    const fileKey = acharClube(slug)
    if (!fileKey) { semClube.add(slug); continue }
    const destino = path.join(saida, fileKey)
    mkdirSync(destino, { recursive: true })
    copyFileSync(path.join(pasta, jogador.name, arquivo), path.join(destino, `${nomeNoJogo}.png`))
    pares.set(fileKey, destino)
  }
}

console.log(`${pares.size} clubes | ${semClube.size} slugs sem clube: ${[...semClube].sort().join(", ")}`)
console.log(`\nNOMES publicados: ${[...new Set([...NOMES.values()])].join(", ")}`)
console.log(`\nPares para o publicar-fotos-catalogo.mjs (--pares-de ${saida}):`)
for (const [fk, p] of pares) console.log(`${fk}=${p}`)
