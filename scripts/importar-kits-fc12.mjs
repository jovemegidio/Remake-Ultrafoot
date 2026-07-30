// IMPORTA UM PACOTE DE UNIFORMES FC'12 PARA O BANCO DE ATUALIZACOES.
//
//   node scripts/importar-kits-fc12.mjs "<pasta do pacote>"            # simula
//   node scripts/importar-kits-fc12.mjs "<pasta do pacote>" --enviar   # envia
//
// Precisa de ULTRAFOOT_ADMIN_TOKEN (token de uma conta administradora).
//
// O QUE E UM PACOTE FC'12: uma pasta com PNGs 420x420 nomeados por slug de
// clube (`corinthians_1.png`) mais um `config.xml` que diz, para cada arquivo,
// se ele e casa/fora/terceiro. Nos lemos o config.xml em vez de adivinhar pelo
// sufixo: o numero nao e constante entre pacotes (ha clube com `_2` de terceiro)
// e adivinhar poe o uniforme errado no clube certo — erro que so aparece em
// campo, no meio de uma partida.
//
// CREDITO: os pacotes trazem os autores no proprio config.xml (ex.: "Made by
// marcodoglio94 & Stefanowls from FM Slovakia"). O script extrai e mostra, para
// o credito acompanhar a publicacao.
//
// O QUE ELE NAO FAZ: adivinhar clube. Slug sem correspondencia em MAPA fica de
// fora e e listado no fim. Casar por semelhanca de nome e exatamente como se
// importa uniforme para o clube errado.

import { readFileSync, readdirSync, existsSync } from "node:fs"
import path from "node:path"

const PASTA = process.argv[2]
const enviar = process.argv.includes("--enviar")
const BASE = process.env.ULTRAFOOT_ATU_URL || "https://ultrafoot.179-198-103-30.sslip.io"
const TOKEN = process.env.ULTRAFOOT_ADMIN_TOKEN || ""

if (!PASTA) {
  console.error('uso: node scripts/importar-kits-fc12.mjs "<pasta>" [--enviar]')
  process.exit(1)
}

/** slug do pacote -> fileKey do jogo. Conferido contra imported-bf2026.json. */
const MAPA = {
  atletico_mineiro: "atleticomg_bra",
  atletico_paranaense: "atleticopr_bra",
  bahia: "bahia",
  botafogo: "botafogorj_bra",
  chapecoense: "chapecoense_bra",
  clube_do_remo: "remo",
  corinthians: "corinthians_bra",
  coritiba: "coritiba_bra",
  cruzeiro: "cruzeiro_bra",
  flamengo: "flarj",
  fluminense: "flurj",
  gremio: "gremio",
  mirassol: "miirassol_sp",   // sim, com dois "i" no seed — nao e engano
  palmeiras: "palmeiras",
  rb_bragantino: "bragantino_bra",
  santos: "santos",
  sao_paolo: "saopaulo_bra",  // o pacote escreve "paolo"
  sc_internacional: "internacional_bra",
  vasco_gama: "vasco",
  vitoria_ec: "vitoria",
}

const VARIANTE = { home: "home", away: "away", third: "third" }

function lerConfig(pasta) {
  const cfg = path.join(pasta, "config.xml")
  if (!existsSync(cfg)) return { mapas: [], autores: "" }
  const xml = readFileSync(cfg, "utf-8")
  const autores = (xml.match(/<!--\s*(Made by[^>]*?)\s*-->/i) || [])[1] || ""
  const mapas = []
  for (const m of xml.matchAll(/<record\s+from="([^"]+)"\s+to="([^"]+)"\s*\/>/g)) {
    const arquivo = m[1]
    const destino = m[2]
    const v = (destino.match(/kits\/(home|away|third)/) || [])[1]
    if (v) mapas.push({ arquivo, variante: VARIANTE[v] })
  }
  return { mapas, autores }
}

const { mapas, autores } = lerConfig(PASTA)
if (!mapas.length) {
  console.error(`nao achei mapeamentos em ${path.join(PASTA, "config.xml")}`)
  process.exit(1)
}

// Agrupa por clube: um POST por clube, com as tres variantes juntas. Enviar
// variante a variante faria a ultima sobrescrever as anteriores (o servidor
// grava o objeto `kits` inteiro).
const porClube = new Map()
const semMapa = new Set()
let semArquivo = 0

for (const { arquivo, variante } of mapas) {
  const slug = arquivo.replace(/_\d+b?$/, "")
  const fileKey = MAPA[slug]
  if (!fileKey) { semMapa.add(slug); continue }
  const png = path.join(PASTA, `${arquivo}.png`)
  if (!existsSync(png)) { semArquivo++; continue }
  const b64 = readFileSync(png).toString("base64")
  if (!porClube.has(fileKey)) porClube.set(fileKey, { file_key: fileKey, kits: {} })
  porClube.get(fileKey).kits[variante] = { data: `data:image/png;base64,${b64}` }
}

const clubes = [...porClube.values()]
const bytes = clubes.reduce((a, c) => a + Object.values(c.kits).reduce((x, k) => x + k.data.length, 0), 0)

console.log(`Pacote : ${PASTA}`)
if (autores) console.log(`Autores: ${autores}`)
console.log(`Clubes : ${clubes.length}`)
console.log(`Kits   : ${clubes.reduce((a, c) => a + Object.keys(c.kits).length, 0)}`)
console.log(`Bruto  : ${(bytes / 1024 / 1024).toFixed(1)} MB em base64`)
if (semMapa.size) console.log(`\nSlugs SEM correspondencia (ficam de fora): ${[...semMapa].join(", ")}`)
if (semArquivo) console.log(`Mapeamentos sem PNG no disco: ${semArquivo}`)

if (!enviar) {
  console.log("\nNada foi enviado. Rode com --enviar para valer.")
  process.exit(0)
}
if (!TOKEN) {
  console.error("\nERRO: defina ULTRAFOOT_ADMIN_TOKEN.")
  process.exit(1)
}

// Um clube por requisicao: 3 PNGs de 100 KB em base64 ja passam de 400 KB, e um
// lote com os 20 estouraria o limite do servidor.
let ok = 0
for (const clube of clubes) {
  const r = await fetch(`${BASE}/atualizacoes/admin/clube/salvar`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${TOKEN}` },
    body: JSON.stringify(clube),
  })
  const dado = await r.json().catch(() => ({}))
  if (!r.ok) {
    const motivo = r.status === 404 ? "token sem permissao de administrador" : (dado.erro || r.status)
    console.error(`\n${clube.file_key} FALHOU: ${motivo}`)
    process.exit(1)
  }
  ok++
  process.stdout.write(`  ${ok}/${clubes.length} — ${clube.file_key}          \r`)
}
console.log(`\n\nOK — ${ok} clubes com uniforme novo no banco.`)
console.log("Abra o painel e clique em Publicar para os jogadores receberem.")
