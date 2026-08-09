// CRIA NO SEED os clubes que completam ligas que o jogo JÁ TEM.
//
//   node scripts/criar-clubes-faltantes.mjs --kits C:/uf-kits-src            # ensaio
//   node scripts/criar-clubes-faltantes.mjs --kits C:/uf-kits-src --aplicar
//
// ⚠️ O QUE ESTE SCRIPT NÃO FAZ: elenco real. O Transfermarkt não responde a
// fetch automatizado desta máquina (testado: HTTP 000), então não há de onde
// tirar os atletas verdadeiros. `jogadores` sai VAZIO e o motor completa com
// `ensurePlayableSquad`, usando a geração de nomes do próprio jogo — a mesma
// decisão do `criar-clubes-fc12.mjs`, e pelo mesmo motivo: inventar 800 atletas
// seria pôr nome falso em gente real.
//
// O QUE É DADO DE VERDADE AQUI:
//   • nome, cidade e sigla: tabela curada abaixo (clubes conhecidos, conferidos
//     um a um — não derivados do slug do arquivo, que daria "Saint Etienne" e
//     "Gruether Fuerth");
//   • cor1/cor2: as duas cores dominantes do PRÓPRIO uniforme de casa (sharp),
//     igual ao criar-clubes-fc12;
//   • divisão: a pasta da liga diz.
//
// ⚠️ SIGLA É CHAVE VISÍVEL e colide. "MIR" já é o Mirassol, "BAR" já é o
// Barcelona. O script confere contra o catálogo e ajusta antes de gravar — uma
// sigla repetida faz dois clubes diferentes parecerem o mesmo na tabela.

import { readFileSync, writeFileSync, existsSync, copyFileSync, readdirSync, statSync } from "node:fs"
import path from "node:path"
import sharp from "sharp"

const RAIZ = path.resolve(import.meta.dirname, "..")
const SEED = path.join(RAIZ, "data", "seeds", "imported-bf2026.json")
const args = process.argv.slice(2)
const opt = n => (args.includes(n) ? args[args.indexOf(n) + 1] : null)
const KITS = opt("--kits") ?? "C:/uf-kits-src"
const APLICAR = args.includes("--aplicar")

/**
 * Os 38 que faltam para as ligas ficarem do tamanho real.
 * base = nome do arquivo do pack (sem o _1/_2/_3).
 */
const CLUBES = {
  "France_-_Ligue_2": { pais: "França", liga: "Ligue 2", divisao: "ligue_2", prestigio: 44, times: {
    amiens: ["Amiens SC", "AMS", "Amiens"],
    bastia: ["SC Bastia", "BST", "Bastia"],
    laval: ["Stade Lavallois", "LAV", "Laval"],
    le_mans: ["Le Mans FC", "LMS", "Le Mans"],
    montpellier: ["Montpellier HSC", "MHS", "Montpellier"],
    reims: ["Stade de Reims", "REM", "Reims"],
    saint_etienne: ["AS Saint-Étienne", "ASS", "Saint-Étienne"],
    troyes: ["ESTAC Troyes", "TRY", "Troyes"],
  } },
  "Germany_-_Bundesliga_2": { pais: "Alemanha", liga: "2. Bundesliga", divisao: "bundesliga_2", prestigio: 46, times: {
    bochum: ["VfL Bochum", "BOC", "Bochum"],
    elversberg: ["SV Elversberg", "ELV", "Elversberg"],
    fortuna_dusseldorf: ["Fortuna Düsseldorf", "F95", "Düsseldorf"],
    gruether_fuerth: ["SpVgg Greuther Fürth", "SGF", "Fürth"],
    kiel: ["Holstein Kiel", "KIE", "Kiel"],
    paderborn: ["SC Paderborn 07", "SCP", "Paderborn"],
    preussen_muenster: ["Preußen Münster", "PRM", "Münster"],
    schalke: ["FC Schalke 04", "S04", "Gelsenkirchen"],
  } },
  "Italy_-_Serie_B": { pais: "Itália", liga: "Serie B", divisao: "serie_b_ita", prestigio: 46, times: {
    bari: ["SSC Bari", "BRI", "Bari"],
    frosinone: ["Frosinone Calcio", "FRO", "Frosinone"],
    juvestabia: ["SS Juve Stabia", "JST", "Castellammare"],
    monza: ["AC Monza", "MNZ", "Monza"],
    pescara: ["Delfino Pescara", "PSC", "Pescara"],
    reggiana: ["AC Reggiana", "RGG", "Reggio Emilia"],
    spezia: ["Spezia Calcio", "SPZ", "La Spezia"],
    venezia: ["Venezia FC", "VNZ", "Veneza"],
  } },
  "Spain_-_Liga_Hypermotion": { pais: "Espanha", liga: "LaLiga Hypermotion", divisao: "la_liga_2", prestigio: 45, times: {
    cultural: ["Cultural Leonesa", "CUL", "León"],
    deportivo_coruna: ["Deportivo La Coruña", "DEP", "A Coruña"],
    huesca: ["SD Huesca", "HUE", "Huesca"],
    las_palmas: ["UD Las Palmas", "LPA", "Las Palmas"],
    leganes: ["CD Leganés", "LEG", "Leganés"],
    malaga: ["Málaga CF", "MLG", "Málaga"],
    mirandes: ["CD Mirandés", "MRD", "Miranda de Ebro"],
    racing_santander: ["Racing Santander", "RSA", "Santander"],
    valladolid: ["Real Valladolid", "VLL", "Valladolid"],
    zaragoza: ["Real Zaragoza", "ZAR", "Zaragoza"],
  } },
  "Portugal_-_Primeira_Liga": { pais: "Portugal", liga: "Primeira Liga", divisao: "primeira_liga", prestigio: 52, times: {
    alverca: ["FC Alverca", "ALV", "Alverca"],
    avs: ["AVS Futebol SAD", "AVS", "Vila das Aves"],
    gilvicente: ["Gil Vicente FC", "GIL", "Barcelos"],
    tondela: ["CD Tondela", "TND", "Tondela"],
  } },
}

const norm = s => (s ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "")
  .toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "")

/** As duas cores dominantes do uniforme, ignorando transparente e quase-branco/preto. */
async function coresDoKit(png) {
  const { data, info } = await sharp(png).resize(64, 64, { fit: "inside" }).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  const cont = new Map()
  for (let i = 0; i < data.length; i += info.channels) {
    const [r, g, b, a] = [data[i], data[i + 1], data[i + 2], data[i + 3]]
    if (a < 200) continue
    const soma = r + g + b
    if (soma > 720 || soma < 40) continue          // quase-branco / quase-preto
    const k = `${r >> 4},${g >> 4},${b >> 4}`      // quantiza para agrupar tons
    const atual = cont.get(k) ?? { n: 0, r: 0, g: 0, b: 0 }
    atual.n++; atual.r += r; atual.g += g; atual.b += b
    cont.set(k, atual)
  }
  const top = [...cont.values()].sort((a, b) => b.n - a.n).slice(0, 2)
  const hex = c => "#" + [c.r / c.n, c.g / c.n, c.b / c.n].map(v => Math.round(v).toString(16).padStart(2, "0")).join("")
  return [top[0] ? hex(top[0]) : "#1f2937", top[1] ? hex(top[1]) : "#ffffff"]
}

/** Acha `<base>_1.png` ou `<base>1.png` dentro da pasta da liga. */
function kitDe(pastaLiga, base) {
  const raiz = path.join(KITS, pastaLiga)
  if (!existsSync(raiz)) return null
  const achar = dir => {
    for (const n of readdirSync(dir)) {
      const p = path.join(dir, n)
      if (statSync(p).isDirectory()) { if (n.toLowerCase() !== "alt") { const r = achar(p); if (r) return r } ; continue }
      if (n === `${base}_1.png` || n === `${base}1.png`) return p
    }
    return null
  }
  return achar(raiz)
}

const seed = JSON.parse(readFileSync(SEED, "utf-8"))
const lista = Array.isArray(seed) ? seed : (seed.teams ?? seed.clubes ?? [])
console.log(`seed atual: ${lista.length} clubes`)

const siglasUsadas = new Set(lista.map(t => String(t.curto ?? "").toUpperCase()))
const chavesUsadas = new Set(lista.map(t => String(t.file_key ?? t.fileKey ?? "")))
const nomesUsados = new Set(lista.map(t => norm(t.nome)))

const novos = []
const pulados = []
for (const [pastaLiga, cfg] of Object.entries(CLUBES)) {
  for (const [base, [nome, siglaBase, cidade]] of Object.entries(cfg.times)) {
    if (nomesUsados.has(norm(nome))) { pulados.push(`${nome} (ja existe)`); continue }
    const kit = kitDe(pastaLiga, base)
    if (!kit) { pulados.push(`${nome} (sem camisa em ${pastaLiga})`); continue }
    const [cor1, cor2] = await coresDoKit(kit)

    // SIGLA sem colisao (ver o aviso no cabecalho).
    let curto = siglaBase.toUpperCase()
    let n = 1
    while (siglasUsadas.has(curto)) { curto = (siglaBase.slice(0, 2) + String(n)).toUpperCase(); n++ }
    siglasUsadas.add(curto)

    let fileKey = `${norm(nome).slice(0, 22)}_${norm(cfg.pais).slice(0, 3)}`
    while (chavesUsadas.has(fileKey)) fileKey += "x"
    chavesUsadas.add(fileKey)

    novos.push({
      id: `uf_${fileKey}`,
      nome, curto, cidade,
      cor1, cor2,
      estadio: "", tecnico: "",
      pais: cfg.pais, liga: cfg.liga, divisao: cfg.divisao,
      prestigio: cfg.prestigio,
      torcida: 500000,
      saldo: 3000000,
      escudo: "", escudoDisponivel: false,
      file_key: fileKey,
      jogadores: [],   // o motor preenche — ver o aviso do cabecalho
      source: "faltantes-2026",
    })
  }
}

console.log(`\nNOVOS: ${novos.length}`)
for (const c of novos) console.log(`  ${c.nome.padEnd(26)} ${c.curto.padEnd(4)} ${c.cor1} ${c.cor2}  ${c.divisao}`)
if (pulados.length) { console.log(`\nPULADOS (${pulados.length}):`); for (const p of pulados) console.log(`  ${p}`) }

if (!APLICAR) { console.log("\nEnsaio. Use --aplicar para gravar no seed."); process.exit(0) }

const bak = SEED + ".bak-clubes-faltantes"
if (!existsSync(bak)) copyFileSync(SEED, bak)
lista.push(...novos)
writeFileSync(SEED, JSON.stringify(Array.isArray(seed) ? lista : seed))
console.log(`\ngravado: ${novos.length} clubes novos (backup em ${path.basename(bak)})`)
