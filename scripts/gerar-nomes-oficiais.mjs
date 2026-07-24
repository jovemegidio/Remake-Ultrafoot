// Gera o NOME OFICIAL de cada clube (data/seeds/club-official-names.json).
//
// O jogo tinha um campo de nome so — o curto, de exibicao ("Flamengo"). Faltava
// o nome do clube de verdade ("Clube de Regatas do Flamengo"), que e o que
// aparece em tabela oficial, sumula e no editor.
//
// Duas fontes, nesta ordem:
//   1. CURADO — escrito a mao para os clubes que o jogador reconhece. O slug do
//      Transfermarkt nao entrega "Sport Club Corinthians Paulista"; entrega
//      "corinthians-sao-paulo". Para esses, o dado tem de ser correto, nao
//      derivado.
//   2. SLUG DO TM — para os ~2.000 restantes. Vira "FC Bayern München",
//      "SE Palmeiras": bem melhor que so "Bayern Munich", e sem inventar.
//
//   node scripts/gerar-nomes-oficiais.mjs

import { readFile, writeFile } from "node:fs/promises"
import path from "node:path"

const TM = path.resolve("data/seeds/tm-squads.json")
const SEED = path.resolve("data/seeds/imported-bf2026.json")
const OUT = path.resolve("data/seeds/club-official-names.json")

// Nomes oficiais escritos a mao. Chave = nome de exibicao normalizado.
const CURADO = {
  // ── Brasil: Serie A e grandes ──────────────────────────────────────────
  "flamengo": "Clube de Regatas do Flamengo",
  "vasco da gama": "Club de Regatas Vasco da Gama",
  "corinthians": "Sport Club Corinthians Paulista",
  "palmeiras": "Sociedade Esportiva Palmeiras",
  "sao paulo": "São Paulo Futebol Clube",
  "santos": "Santos Futebol Clube",
  "fluminense": "Fluminense Football Club",
  "botafogo": "Botafogo de Futebol e Regatas",
  "gremio": "Grêmio Foot-Ball Porto Alegrense",
  "internacional": "Sport Club Internacional",
  "cruzeiro": "Cruzeiro Esporte Clube",
  "atletico-mg": "Clube Atlético Mineiro",
  "atletico mineiro": "Clube Atlético Mineiro",
  "america-mg": "América Futebol Clube (MG)",
  "america mineiro": "América Futebol Clube (MG)",
  "bahia": "Esporte Clube Bahia",
  "vitoria": "Esporte Clube Vitória",
  "sport": "Sport Club do Recife",
  "sport recife": "Sport Club do Recife",
  "nautico": "Clube Náutico Capibaribe",
  "santa cruz": "Santa Cruz Futebol Clube",
  "fortaleza": "Fortaleza Esporte Clube",
  "ceara": "Ceará Sporting Club",
  "athletico-pr": "Club Athletico Paranaense",
  "athletico paranaense": "Club Athletico Paranaense",
  "coritiba": "Coritiba Foot Ball Club",
  "parana": "Paraná Clube",
  "chapecoense": "Associação Chapecoense de Futebol",
  "avai": "Avaí Futebol Clube",
  "figueirense": "Figueirense Futebol Clube",
  "criciuma": "Criciúma Esporte Clube",
  "juventude": "Esporte Clube Juventude",
  "goias": "Goiás Esporte Clube",
  "atletico-go": "Atlético Clube Goianiense",
  "vila nova": "Vila Nova Futebol Clube",
  "cuiaba": "Cuiabá Esporte Clube",
  "bragantino": "Red Bull Bragantino",
  "rb bragantino": "Red Bull Bragantino",
  "ponte preta": "Associação Atlética Ponte Preta",
  "guarani": "Guarani Futebol Clube",
  "portuguesa": "Associação Portuguesa de Desportos",
  "mirassol": "Mirassol Futebol Clube",
  "novorizontino": "Grêmio Novorizontino",
  "gremio novorizontino": "Grêmio Novorizontino",
  "sao bernardo": "São Bernardo Futebol Clube",
  "remo": "Clube do Remo",
  "paysandu": "Paysandu Sport Club",
  "abc": "ABC Futebol Clube",
  "america-rn": "América Futebol Clube (RN)",
  "csa": "Centro Sportivo Alagoano",
  "crb": "Clube de Regatas Brasil",
  "sampaio correa": "Sampaio Corrêa Futebol Clube",
  "operario-pr": "Operário Ferroviário Esporte Clube",
  "londrina": "Londrina Esporte Clube",
  "brusque": "Brusque Futebol Clube",
  "ituano": "Ituano Futebol Clube",
  "botafogo-sp": "Botafogo Futebol Clube (SP)",
  "botafogo-pb": "Botafogo Futebol Clube (PB)",
  "confianca": "Associação Desportiva Confiança",
  "altos": "Altos Esporte Clube",
  "volta redonda": "Volta Redonda Futebol Clube",
  "olaria": "Olaria Atlético Clube",
  "bangu": "Bangu Atlético Clube",
  "madureira": "Madureira Esporte Clube",
  "nova iguacu": "Nova Iguaçu Futebol Clube",
  "boavista": "Boavista Sport Club",
  "portuguesa-rj": "Associação Atlética Portuguesa (RJ)",
  "tombense": "Tombense Futebol Clube",
  "caxias": "Sociedade Esportiva e Recreativa Caxias",
  "ypiranga-rs": "Ypiranga Futebol Clube",
  "sao jose-rs": "Esporte Clube São José",
  "amazonas": "Amazonas Futebol Clube",
  "manaus": "Manaus Futebol Clube",
  "tocantinopolis": "Tocantinópolis Esporte Clube",
  "ferroviario": "Ferroviário Atlético Clube",
  "floresta": "Floresta Esporte Clube",
  "maranhao": "Maranhão Atlético Clube",
  "moto club": "Moto Club de São Luís",
  "river-pi": "River Atlético Clube",
  "aparecidense": "Associação Atlética Aparecidense",
  "anapolis": "Anápolis Futebol Clube",
  "brasiliense": "Brasiliense Futebol Clube",
  "gama": "Sociedade Esportiva do Gama",
  "juventus": "Clube Atlético Juventus",

  // ── Europa ─────────────────────────────────────────────────────────────
  "liverpool": "Liverpool Football Club",
  "manchester united": "Manchester United Football Club",
  "manchester city": "Manchester City Football Club",
  "arsenal": "Arsenal Football Club",
  "chelsea": "Chelsea Football Club",
  "tottenham": "Tottenham Hotspur Football Club",
  "newcastle": "Newcastle United Football Club",
  "everton": "Everton Football Club",
  "aston villa": "Aston Villa Football Club",
  "west ham": "West Ham United Football Club",
  "real madrid": "Real Madrid Club de Fútbol",
  "barcelona": "Futbol Club Barcelona",
  "atletico madrid": "Club Atlético de Madrid",
  "sevilla": "Sevilla Fútbol Club",
  "valencia": "Valencia Club de Fútbol",
  "real betis": "Real Betis Balompié",
  "athletic bilbao": "Athletic Club",
  "real sociedad": "Real Sociedad de Fútbol",
  "villarreal": "Villarreal Club de Fútbol",
  "juventus turim": "Juventus Football Club",
  "inter milan": "Football Club Internazionale Milano",
  "ac milan": "Associazione Calcio Milan",
  "napoli": "Società Sportiva Calcio Napoli",
  "roma": "Associazione Sportiva Roma",
  "lazio": "Società Sportiva Lazio",
  "fiorentina": "ACF Fiorentina",
  "atalanta": "Atalanta Bergamasca Calcio",
  "bayern munich": "Fußball-Club Bayern München",
  "bayern munchen": "Fußball-Club Bayern München",
  "borussia dortmund": "Ballspielverein Borussia 09 Dortmund",
  "rb leipzig": "RasenBallsport Leipzig",
  "bayer leverkusen": "Bayer 04 Leverkusen",
  "union berlin": "1. FC Union Berlin",
  "schalke 04": "FC Schalke 04",
  "psg": "Paris Saint-Germain Football Club",
  "paris saint-germain": "Paris Saint-Germain Football Club",
  "marseille": "Olympique de Marseille",
  "lyon": "Olympique Lyonnais",
  "monaco": "Association Sportive de Monaco",
  "lille": "Lille Olympique Sporting Club",
  "rennes": "Stade Rennais Football Club",
  "benfica": "Sport Lisboa e Benfica",
  "porto": "Futebol Clube do Porto",
  "sporting": "Sporting Clube de Portugal",
  "ajax": "Amsterdamsche Football Club Ajax",
  "psv": "Philips Sport Vereniging",
  "feyenoord": "Feyenoord Rotterdam",
  "celtic": "The Celtic Football Club",
  "rangers": "Rangers Football Club",

  // ── America do Sul ─────────────────────────────────────────────────────
  "boca juniors": "Club Atlético Boca Juniors",
  "river plate": "Club Atlético River Plate",
  "racing club": "Racing Club de Avellaneda",
  "independiente": "Club Atlético Independiente",
  "san lorenzo": "Club Atlético San Lorenzo de Almagro",
  "velez sarsfield": "Club Atlético Vélez Sarsfield",
  "penarol": "Club Atlético Peñarol",
  "nacional": "Club Nacional de Football",
  "colo colo": "Club Social y Deportivo Colo-Colo",
  "universidad de chile": "Club Universidad de Chile",
  "atletico nacional": "Atlético Nacional",
  "millonarios": "Millonarios Fútbol Club",
  "olimpia": "Club Olimpia",
  "cerro porteno": "Club Cerro Porteño",
  "ldu quito": "Liga Deportiva Universitaria de Quito",
  "barcelona guayaquil": "Barcelona Sporting Club",
  "alianza lima": "Club Alianza Lima",
  "universitario": "Club Universitario de Deportes",
  "the strongest": "Club The Strongest",
  "bolivar": "Club Bolívar",
}

const norm = s => (s || "")
  .normalize("NFD").replace(/[̀-ͯ]/g, "")
  .toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()

// Siglas que ficam MAIUSCULAS ao derivar do slug.
const SIGLAS = new Set(["fc", "sc", "ec", "ac", "cr", "se", "ca", "cd", "cf", "ud", "sd", "rc", "as", "ss", "afc", "bsc", "psv", "vfb", "vfl", "tsv", "fsv", "sv", "kv", "kaa", "rsc", "nk", "hnk", "fk", "ofk", "ks", "us", "ssc", "acf", "aik", "sk", "if", "bk", "ff", "hb", "gd", "cs", "ad"])
// Sufixos de cidade/estado que o TM cola no slug e nao fazem parte do nome.
const SUFIXO_CIDADE = /-(rio-de-janeiro|sao-paulo|belo-horizonte|porto-alegre|curitiba|salvador|recife|fortaleza|goiania|manaus|belem|brasilia|campinas|santos|guayaquil|buenos-aires|montevideo|santiago|bogota|lima|quito|asuncion|caracas|la-paz|mexico|[a-z]{2}-?)$/

function doSlug(slug) {
  if (!slug) return null
  const limpo = slug.replace(/-+$/, "").replace(SUFIXO_CIDADE, "")
  const palavras = limpo.split("-").filter(Boolean)
  if (palavras.length === 0) return null
  return palavras
    .map(p => SIGLAS.has(p) ? p.toUpperCase() : p.charAt(0).toUpperCase() + p.slice(1))
    .join(" ")
}

async function main() {
  const tm = JSON.parse(await readFile(TM, "utf8"))
  const seed = JSON.parse(await readFile(SEED, "utf8"))
  const clubs = tm.clubs ?? tm

  // nome normalizado -> slug do TM
  const slugPorNome = new Map()
  for (const [chave, dados] of Object.entries(clubs)) {
    if (!dados?.url) continue
    const nome = chave.split("|")[1]
    const slug = dados.url.split("/")[3]
    if (nome && slug) slugPorNome.set(norm(nome), slug)
  }

  const saida = {}
  const porNomeSaida = {}
  let deCurado = 0, deSlug = 0, semNada = 0
  for (const team of seed.teams ?? []) {
    const fileKey = team.fileKey ?? team.file_key
    if (!fileKey) continue
    const k = norm(team.nome)
    const curado = CURADO[k]
    if (curado) { saida[fileKey] = curado; porNomeSaida[k] = curado; deCurado++; continue }
    const derivado = doSlug(slugPorNome.get(k))
    // O derivado so vale se ENRIQUECER o nome de exibicao — o nome curto tem de
    // aparecer dentro dele. Sem esta trava, um casamento errado do TM virava
    // nome oficial errado: "CEFAT Tirol" recebia "Gremio Pague Menos". Nome
    // oficial errado e pior que nao ter nome oficial.
    const enriquece = derivado
      && norm(derivado) !== k
      && norm(derivado).includes(k.split(" ")[0])
      && norm(derivado).length >= k.length
    if (enriquece) { saida[fileKey] = derivado; porNomeSaida[k] = derivado; deSlug++; continue }
    semNada++
  }

  // Os clubes CURADOS entram no indice por nome mesmo que nao existam no seed:
  // o teams-data tem clubes proprios (Liverpool, etc.) com outro file_key.
  for (const [k, v] of Object.entries(CURADO)) porNomeSaida[k] = v
  await writeFile(OUT, JSON.stringify({ byKey: saida, byName: porNomeSaida }))
  console.log(`clubes no seed        : ${(seed.teams ?? []).length}`)
  console.log(`nome oficial CURADO   : ${deCurado}`)
  console.log(`nome oficial do slug  : ${deSlug}`)
  console.log(`sem nome oficial      : ${semNada} (fica so o nome de exibicao)`)
  console.log(`indice por nome       : ${Object.keys(porNomeSaida).length}`)
  console.log(`arquivo               : ${OUT}`)
}

main().catch(e => { console.error(e); process.exit(1) })
