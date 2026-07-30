// CRIA NO SEED os clubes que existem no pacote FC'12 mas nao no jogo.
//
//   node scripts/criar-clubes-fc12.mjs <pasta-scratch> <ligas-regex>            # simula
//   node scripts/criar-clubes-fc12.mjs <pasta-scratch> <ligas-regex> --aplicar  # grava
//
// POR QUE NO SEED E NAO NO BANCO DE ATUALIZACOES: o manifesto do servidor so
// SOBREPOE clube existente (`applyTeamOverride` decora o que ja esta em
// `allTeams`, que sai de imported-bf2026.json). Clube novo publicado no
// manifesto simplesmente nao aparece — nao da erro, nao acontece nada. Para
// existir, tem de entrar no seed, e o seed viaja no build.
//
// DE ONDE VEM CADA CAMPO — nada aqui e chutado:
//   nome      : titulo oficial resolvido no sortitoutsi pelo FM ID do config.xml
//   cor1/cor2 : as duas cores dominantes do PROPRIO uniforme de casa (sharp)
//   pais/liga : do nome do pacote
//   jogadores : VAZIO de proposito. O motor preenche ate o minimo jogavel com
//               ensurePlayableSquad, usando a geracao de nomes do proprio jogo.
//               Inventar 1.300 atletas seria pior: nome falso de gente real.
//   prestigio : faixa baixa fixa por divisao — e um palpite, e esta assumido.

import { readFileSync, writeFileSync, readdirSync, existsSync, statSync, copyFileSync } from "node:fs"
import path from "node:path"
import sharp from "sharp"

const RAIZ = path.resolve(import.meta.dirname, "..")
const D = process.argv[2]
const FILTRO = new RegExp(process.argv[3] || ".", "i")
const aplicar = process.argv.includes("--aplicar")
const PACKS = `${D}/fc12/packs`
const SEED = path.join(RAIZ, "data", "seeds", "imported-bf2026.json")

const dec = (s) => (s || "").replace(/&#0?39;|&apos;/g, "'").replace(/&amp;/g, "&")
  .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n))
const norm = (s) => dec(s).normalize("NFD").replace(/[̀-ͯ]/g, "")
  .toLowerCase().replace(/[^a-z0-9]/g, "")

const seed = JSON.parse(readFileSync(SEED, "utf-8"))
const porNome = new Map()
for (const t of seed.teams) {
  const k = norm(t.nome); if (!k) continue
  if (!porNome.has(k)) porNome.set(k, []); porNome.get(k).push(t.fileKey)
}
const clubesJogo = [...porNome.entries()].filter(([k]) => k.length >= 5)
const chavesUsadas = new Set(seed.teams.map((t) => t.fileKey))
const idsUsados = new Set(seed.teams.map((t) => t.id))

const GEN = /\b(club|clube|atletico|athletico|deportivo|deportes|sociedad|sporting|futbol|football|kulübü|spor|futebol|de|del|da|do|y|e)\b/gi
const SIG = /\b(fc|cf|sc|ac|ec|cd|ca|afc|sk|fk|if|bk|as|ud|sd|cs|rc|jk|saf|sad|sa)\b/gi
function jaExiste(nome) {
  const n = dec(nome).trim()
  for (const v of [n, n.replace(SIG, " ").replace(/\s+/g, " ").trim(),
                   n.replace(SIG, " ").replace(GEN, " ").replace(/\s+/g, " ").trim()]) {
    const a = porNome.get(norm(v)); if (a?.length) return true
  }
  const alvo = norm(n)
  return clubesJogo.some(([k]) => alvo.includes(k))
}

/** Pais e liga a partir do nome da pasta do pacote. */
const LIGAS = {
  "china-super-league": ["China", "Chinese Super League", "Série A"],
  "estonia-a-le-coq-premium-liiga": ["Estônia", "Meistriliiga", "Série A"],
  "faroe-islands-meistaradeildin": ["Ilhas Faroé", "Betri deildin", "Série A"],
  "georgia-crystalbet-erovnuli-liga": ["Geórgia", "Erovnuli Liga", "Série A"],
  "georgia-erovnuli-liga-2": ["Geórgia", "Erovnuli Liga 2", "Série B"],
  "latvia-virsliga": ["Letônia", "Virsliga", "Série A"],
  "lithuania-toplyga": ["Lituânia", "A Lyga", "Série A"],
}
function ligaDe(pasta) {
  for (const [k, v] of Object.entries(LIGAS)) if (pasta.includes(k)) return v
  return null
}

/** As duas cores dominantes do uniforme, ignorando transparente e quase-branco/preto. */
async function coresDoKit(png) {
  try {
    const { data, info } = await sharp(png).resize(64, 64, { fit: "inside" })
      .ensureAlpha().raw().toBuffer({ resolveWithObject: true })
    const cont = new Map()
    for (let i = 0; i < data.length; i += info.channels) {
      const [r, g, b, a] = [data[i], data[i + 1], data[i + 2], data[i + 3]]
      if (a < 200) continue
      // agrupa em blocos de 32 para nao contar mil tons do mesmo azul
      const k = `${r >> 5},${g >> 5},${b >> 5}`
      if (!cont.has(k)) cont.set(k, { n: 0, r: 0, g: 0, b: 0 })
      const c = cont.get(k); c.n++; c.r += r; c.g += g; c.b += b
    }
    const ord = [...cont.values()].sort((a, b) => b.n - a.n)
      .map((c) => ({ n: c.n, r: Math.round(c.r / c.n), g: Math.round(c.g / c.n), b: Math.round(c.b / c.n) }))
    const hex = (c) => "#" + [c.r, c.g, c.b].map((v) => v.toString(16).padStart(2, "0")).join("")
    if (!ord.length) return ["#1b1b1b", "#ffffff"]
    const principal = ord[0]
    const seg = ord.find((c) => Math.abs(c.r - principal.r) + Math.abs(c.g - principal.g) + Math.abs(c.b - principal.b) > 120) || ord[1] || principal
    return [hex(principal), hex(seg)]
  } catch {
    return ["#1b1b1b", "#ffffff"]
  }
}

const nomes = new Map()
for (const l of readFileSync(`${D}/fmid-nomes.tsv`, "utf-8").split("\n")) {
  const [id, n] = l.split("\t"); if (id && n) nomes.set(id.trim(), n.trim())
}

function* configs(dir) {
  for (const n of readdirSync(dir)) {
    const p = path.join(dir, n)
    if (!statSync(p).isDirectory()) continue
    if (existsSync(path.join(p, "config.xml"))) yield p
    else yield* configs(p)
  }
}

const novos = []
const kitsNovos = []
for (const pastaLiga of readdirSync(PACKS)) {
  if (!FILTRO.test(pastaLiga)) continue
  const info = ligaDe(pastaLiga)
  if (!info) continue
  const [pais, liga, divisao] = info
  for (const pasta of configs(path.join(PACKS, pastaLiga))) {
    const xml = readFileSync(path.join(pasta, "config.xml"), "utf-8")
    const porFm = new Map()
    for (const m of xml.matchAll(/<record\s+from="([^"]+)"\s+to="graphics\/pictures\/team\/(\d+)\/kits\/(home|away|third)"/g)) {
      const png = path.join(pasta, `${m[1]}.png`)
      if (!existsSync(png)) continue
      if (!porFm.has(m[2])) porFm.set(m[2], {})
      porFm.get(m[2])[m[3]] = png
    }
    for (const [fmId, kits] of porFm) {
      const nome = nomes.get(fmId)
      if (!nome || jaExiste(nome)) continue
      const limpo = dec(nome)
      let fileKey = norm(limpo).slice(0, 22) + "_" + pais.slice(0, 3).toLowerCase().replace(/[^a-z]/g, "")
      while (chavesUsadas.has(fileKey)) fileKey += "x"
      let id = "bf_" + fileKey
      while (idsUsados.has(id)) id += "x"
      chavesUsadas.add(fileKey); idsUsados.add(id)
      const [cor1, cor2] = await coresDoKit(kits.home || Object.values(kits)[0])
      novos.push({
        id, nome: limpo,
        curto: norm(limpo).slice(0, 8).toUpperCase(),
        cor1, cor2,
        estadio: "", tecnico: "",
        pais, liga, divisao,
        prestigio: divisao === "Série B" ? 38 : 45,
        saldo: 250000,
        escudo: "", escudoDisponivel: false,
        jogadores: [],          // o motor preenche (ensurePlayableSquad)
        source: "FC12-2026-27",
        fileKey,
      })
      kitsNovos.push({ fileKey, kits })
    }
  }
}

console.log(`${aplicar ? "APLICADO" : "SIMULACAO"} — ${novos.length} clubes novos`)
const porPais = {}
for (const c of novos) porPais[c.pais] = (porPais[c.pais] || 0) + 1
for (const [p, n] of Object.entries(porPais)) console.log(`  ${String(n).padStart(3)}  ${p}`)
console.log("\nAmostra:")
for (const c of novos.slice(0, 12)) console.log(`  ${c.nome.padEnd(30)} ${c.cor1} ${c.cor2}  ${c.fileKey}`)

if (aplicar) {
  const bak = SEED + ".bak-clubes"
  if (!existsSync(bak)) copyFileSync(SEED, bak)
  seed.teams.push(...novos)
  seed.count = seed.teams.length
  writeFileSync(SEED, JSON.stringify(seed))
  writeFileSync(`${D}/plano-kits-novos.json`,
    JSON.stringify(kitsNovos.map((k) => ({ fileKey: k.fileKey, kits: k.kits })), null, 1))
  console.log(`\nseed: ${seed.teams.length} clubes (backup em ${path.basename(bak)})`)
  console.log(`kits dos novos em plano-kits-novos.json`)
}
