// IMPORTA BANDEIRAS PARA `public/flags/<iso2>.webp`.
//
// ⚠️ DUAS ARMADILHAS, AS DUAS ENCONTRADAS NO ACERVO DE VERDADE (18/08/2026):
//
//  1. O MESMO ACERVO TEM DOIS PADRÕES DE NOME. Uma parte é `Brazil.png`; a
//     outra é `Flag_of_Chile_Flat_Round-256x256.png`. Converter direto pelo nome
//     do arquivo gerava `flag-of-chile-flat-round-256x256.webp`, que nenhuma
//     tela do jogo jamais pediria.
//
//  2. O JOGO PEDE POR CÓDIGO, NÃO POR NOME. As telas montam `/flags/${code}` a
//     partir de siglas (`br`, `gb-eng`, `sa`). Um acervo nomeado por país é
//     invisível para elas — foi por isso que o jogo tinha SÓ DEZ bandeiras e a
//     tela de pré-jogo mostrava um Brasil borrado enquanto 71 arquivos bons
//     esperavam numa pasta.
//
// Uso:
//   node scripts/importar-bandeiras.mjs "<pasta de origem>" [--aplicar]

import { readdirSync, statSync, existsSync, mkdirSync, writeFileSync } from "node:fs"
import path from "node:path"
import sharp from "sharp"

const origem = process.argv[2]
const aplicar = process.argv.includes("--aplicar")
const DESTINO = "public/flags"

if (!origem) {
  console.error('uso: node scripts/importar-bandeiras.mjs "<pasta>" [--aplicar]')
  process.exit(1)
}

/** Tira o nome do país dos dois padrões de arquivo. */
function paisDoArquivo(nome) {
  const base = nome.replace(/\.(png|jpe?g|webp)$/i, "")
  const verboso = base.match(/^flag[_-]of[_-](.+?)[_-]flat[_-]round/i)
  const bruto = verboso ? verboso[1] : base
  return bruto
    .replace(/[_-]+/g, " ")
    .replace(/\s*\d+x\d+\s*$/i, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase()
}

/**
 * País → ISO-2 (o código que o jogo usa). Inglaterra, Escócia, País de Gales e
 * Irlanda do Norte NÃO têm ISO-2 próprio e o futebol as trata como seleções
 * separadas: usam os códigos `gb-eng` e afins, que é o que as telas já pedem.
 */
const CODIGO = {
  afghanistan: "af", albania: "al", algeria: "dz", andorra: "ad", angola: "ao",
  "antigua and barbuda": "ag", argentina: "ar", armenia: "am", artsakh: "artsakh",
  australia: "au", austria: "at", azerbaijan: "az", bahamas: "bs", bahrain: "bh",
  bangladesh: "bd", barbados: "bb", belarus: "by", belgium: "be", belize: "bz",
  benin: "bj", bhutan: "bt", bolivia: "bo", "bosnia and herzegovina": "ba",
  botswana: "bw", brazil: "br", brunei: "bn", bulgaria: "bg", "burkina faso": "bf",
  burundi: "bi", cambodia: "kh", cameroon: "cm", canada: "ca", "cape verde": "cv",
  "central african republic": "cf", chad: "td", chile: "cl", colombia: "co",
  comoros: "km", "cook islands": "ck", "costa rica": "cr", croatia: "hr",
  cuba: "cu", cyprus: "cy", "czech republic": "cz", "c te divoire": "ci",
  "cote divoire": "ci", "cote d ivoire": "ci", "côte divoire": "ci",
  "democratic republic of congo": "cd", denmark: "dk", djibouti: "dj",
  dominica: "dm", "dominican republic": "do", "east timor": "tl", ecuador: "ec",
  egypt: "eg", "el salvador": "sv", england: "gb-eng", "equatorial guinea": "gq",
  eritrea: "er", estonia: "ee", eswatini: "sz", ethiopia: "et",
  "federated states of micronesia": "fm", fiji: "fj", finland: "fi", france: "fr",
  gabon: "ga", gambia: "gm", georgia: "ge", germany: "de", ghana: "gh",
  greece: "gr", grenada: "gd",
  // ── daqui para baixo o acervo ainda não chegou, mas o mapa já espera ──
  guatemala: "gt", guinea: "gn", haiti: "ht", honduras: "hn", hungary: "hu",
  iceland: "is", india: "in", indonesia: "id", iran: "ir", iraq: "iq",
  ireland: "ie", israel: "il", italy: "it", jamaica: "jm", japan: "jp",
  jordan: "jo", kazakhstan: "kz", kenya: "ke", kuwait: "kw", latvia: "lv",
  lebanon: "lb", libya: "ly", lithuania: "lt", luxembourg: "lu", malaysia: "my",
  mali: "ml", malta: "mt", mexico: "mx", moldova: "md", montenegro: "me",
  morocco: "ma", mozambique: "mz", namibia: "na", netherlands: "nl",
  "new zealand": "nz", nicaragua: "ni", nigeria: "ng", "north macedonia": "mk",
  "northern ireland": "gb-nir", norway: "no", oman: "om", pakistan: "pk",
  panama: "pa", paraguay: "py", peru: "pe", philippines: "ph", poland: "pl",
  portugal: "pt", qatar: "qa", romania: "ro", russia: "ru", "saudi arabia": "sa",
  scotland: "gb-sct", senegal: "sn", serbia: "rs", singapore: "sg",
  slovakia: "sk", slovenia: "si", "south africa": "za", "south korea": "kr",
  spain: "es", sweden: "se", switzerland: "ch", syria: "sy", thailand: "th",
  tunisia: "tn", turkey: "tr", ukraine: "ua", "united arab emirates": "ae",
  "united states": "us", uruguay: "uy", uzbekistan: "uz", venezuela: "ve",
  vietnam: "vn", wales: "gb-wls", zambia: "zm", zimbabwe: "zw",
}

const arquivos = readdirSync(origem).filter(f => /\.(png|jpe?g)$/i.test(f))
const semMapa = []
const paraConverter = []

for (const arquivo of arquivos) {
  const pais = paisDoArquivo(arquivo)
  const codigo = CODIGO[pais]
  if (!codigo) { semMapa.push(`${arquivo}  (lido como "${pais}")`); continue }
  paraConverter.push({ arquivo, pais, codigo })
}

console.log(`${arquivos.length} arquivo(s) em ${origem}`)
console.log(`  reconhecidos ... ${paraConverter.length}`)
console.log(`  sem mapa ....... ${semMapa.length}`)
for (const s of semMapa.slice(0, 10)) console.log(`     ${s}`)
if (semMapa.length > 10) console.log(`     ... e mais ${semMapa.length - 10}`)

if (!aplicar) {
  console.log("\nEnsaio. Nada foi escrito. Repita com --aplicar.")
  process.exit(0)
}

if (!existsSync(DESTINO)) mkdirSync(DESTINO, { recursive: true })
let antes = 0, depois = 0
for (const { arquivo, codigo } of paraConverter) {
  const de = path.join(origem, arquivo)
  const para = path.join(DESTINO, `${codigo}.webp`)
  antes += statSync(de).size
  await sharp(de).webp({ quality: 92, alphaQuality: 100, effort: 6 }).toFile(para)
  depois += statSync(para).size
}
// ─── Manifesto ───────────────────────────────────────────────────────────────
//
// ⚠️ O ACERVO CHEGA POR PARTES. Hoje ele cobre de "Afghanistan" a "Grenada": os
// códigos `it`, `mx`, `pt`, `sa` e `us` ainda só têm o PNG antigo. Trocar todas
// as telas para `.webp` de uma vez apagaria essas bandeiras da tela.
//
// O manifesto é o que permite conviver: quem tem WebP usa WebP, quem não tem
// segue no PNG, e a próxima leva de arquivos entra sem tocar em código.
const codigos = [...new Set(paraConverter.map(c => c.codigo))].sort()
writeFileSync(path.join(DESTINO, "manifest.json"), JSON.stringify(codigos, null, 2) + "\n")

console.log(`\n${paraConverter.length} bandeira(s) em ${DESTINO}: `
  + `${(antes / 1024).toFixed(0)} KB -> ${(depois / 1024).toFixed(0)} KB`)
console.log(`manifesto com ${codigos.length} codigo(s) em ${DESTINO}/manifest.json`)
