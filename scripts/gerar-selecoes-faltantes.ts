// GERA AS ENTRADAS DAS SELECOES QUE FALTAM no catalogo.
//
// A arte de uniformes (sortitoutsi) cobre bem mais paises do que
// `NATIONAL_TEAMS`: UEFA tem 18 de 55 membros e CONCACAF 6 de 41. Este script
// olha os dois lados e imprime, pronto para colar, so o que falta.
//
//   npx tsx scripts/gerar-selecoes-faltantes.ts
//
// ⚠️ AS CORES SAEM DA PROPRIA ARTE, nao da minha cabeca.
//
// Escrever "a Polonia e branca e vermelha" de memoria e chutar sobre 37 paises —
// e chute errado nao da erro, so aparece um dia como camisa de cor errada. O
// uniforme 1 (casa) e o 2 (fora) ja SAO a fonte: extraimos a cor dominante de
// cada um. Se a arte nao existir, o pais sai marcado como SEM COR e nao entra.
//
// ⚠️ E O `countryKey` TEM DE CASAR COM O SEED. De nada adianta cadastrar a
// Polonia se o `nac` dos atletas diz "Polônia" e a chave diz "Polonia": o pool
// (que agora e por nacionalidade) devolveria zero e a selecao jogaria com nomes
// inventados. Por isso cada candidato e conferido contra as nacionalidades que
// REALMENTE existem no banco, e o script reporta quantos atletas cada um teria.
import { readdirSync, existsSync } from "node:fs"
import path from "node:path"
import sharp from "sharp"
import { allTeams } from "../lib/teams-data"
import { getPlayersForTeam } from "../lib/players-data"
import { NATIONAL_TEAMS } from "../lib/national-teams"

const RAIZ_ARTE = "G:/Outros computadores/Meu laptop/Trabalho/Ultrafoot - PC"
const PASTAS: Array<{ dir: string; conf: string }> = [
  { dir: path.join(RAIZ_ARTE, "sortitoutsi", "Nations_-_UEFA", "Nations - UEFA"), conf: "UEFA" },
  { dir: path.join(RAIZ_ARTE, "sortitoutsi", "Nations_-_CONCACAF", "Nations - CONCACAF"), conf: "CONCACAF" },
]

/** slug em ingles -> [id, nome exibido, codigo FIFA, countryKey candidato]. */
const PAISES: Record<string, [string, string, string, string]> = {
  // ─── UEFA ───────────────────────────────────────────────────────────────
  poland: ["polonia", "Polonia", "POL", "Polônia"],
  denmark: ["dinamarca", "Dinamarca", "DEN", "Dinamarca"],
  serbia: ["servia", "Servia", "SRB", "Sérvia"],
  ukraine: ["ucrania", "Ucrania", "UKR", "Ucrânia"],
  greece: ["grecia", "Grecia", "GRE", "Grécia"],
  hungary: ["hungria", "Hungria", "HUN", "Hungria"],
  ireland: ["irlanda", "Irlanda", "IRL", "Irlanda"],
  wales: ["pais_de_gales", "Pais de Gales", "WAL", "País de Gales"],
  romania: ["romenia", "Romenia", "ROU", "Romênia"],
  slovakia: ["eslovaquia", "Eslovaquia", "SVK", "Eslováquia"],
  slovenia: ["eslovenia", "Eslovenia", "SVN", "Eslovênia"],
  iceland: ["islandia", "Islandia", "ISL", "Islândia"],
  finland: ["finlandia", "Finlandia", "FIN", "Finlândia"],
  albania: ["albania", "Albania", "ALB", "Albânia"],
  bulgaria: ["bulgaria", "Bulgaria", "BUL", "Bulgária"],
  belarus: ["bielorrussia", "Bielorrussia", "BLR", "Bielorrússia"],
  georgia: ["georgia", "Georgia", "GEO", "Geórgia"],
  armenia: ["armenia", "Armenia", "ARM", "Armênia"],
  azerbaijan: ["azerbaijao", "Azerbaijao", "AZE", "Azerbaijão"],
  estonia: ["estonia", "Estonia", "EST", "Estônia"],
  latvia: ["letonia", "Letonia", "LVA", "Letônia"],
  lithuania: ["lituania", "Lituania", "LTU", "Lituânia"],
  luxembourg: ["luxemburgo", "Luxemburgo", "LUX", "Luxemburgo"],
  malta: ["malta", "Malta", "MLT", "Malta"],
  moldova: ["moldavia", "Moldavia", "MDA", "Moldávia"],
  montenegro: ["montenegro", "Montenegro", "MNE", "Montenegro"],
  north_macedonia: ["macedonia_do_norte", "Macedonia do Norte", "MKD", "Macedônia do Norte"],
  northern_ireland: ["irlanda_do_norte", "Irlanda do Norte", "NIR", "Irlanda do Norte"],
  cyprus: ["chipre", "Chipre", "CYP", "Chipre"],
  kosovo: ["kosovo", "Kosovo", "KVX", "Kosovo"],
  israel: ["israel", "Israel", "ISR", "Israel"],
  kazakhstan: ["cazaquistao", "Cazaquistao", "KAZ", "Cazaquistão"],
  faroe_islands: ["ilhas_faroe", "Ilhas Faroe", "FRO", "Ilhas Faroé"],
  andorra: ["andorra", "Andorra", "AND", "Andorra"],
  gibraltar: ["gibraltar", "Gibraltar", "GIB", "Gibraltar"],
  liechtenstein: ["liechtenstein", "Liechtenstein", "LIE", "Liechtenstein"],
  san_marino: ["san_marino", "San Marino", "SMR", "San Marino"],
  // ─── CONCACAF ───────────────────────────────────────────────────────────
  costa_rica: ["costa_rica", "Costa Rica", "CRC", "Costa Rica"],
  honduras: ["honduras", "Honduras", "HON", "Honduras"],
  jamaica: ["jamaica", "Jamaica", "JAM", "Jamaica"],
  trinidad: ["trinidad_e_tobago", "Trinidad e Tobago", "TRI", "Trinidad e Tobago"],
  elsalvador: ["el_salvador", "El Salvador", "SLV", "El Salvador"],
  guatemala: ["guatemala", "Guatemala", "GUA", "Guatemala"],
  nicaragua: ["nicaragua", "Nicaragua", "NCA", "Nicarágua"],
  cuba: ["cuba", "Cuba", "CUB", "Cuba"],
  dominican_republic: ["republica_dominicana", "Republica Dominicana", "DOM", "República Dominicana"],
  suriname: ["suriname", "Suriname", "SUR", "Suriname"],
  guyana: ["guiana", "Guiana", "GUY", "Guiana"],
  belize: ["belize", "Belize", "BLZ", "Belize"],
  bermuda: ["bermudas", "Bermudas", "BER", "Bermudas"],
  barbados: ["barbados", "Barbados", "BRB", "Barbados"],
  bahamas: ["bahamas", "Bahamas", "BAH", "Bahamas"],
  aruba: ["aruba", "Aruba", "ARU", "Aruba"],
  grenada: ["granada", "Granada", "GRN", "Granada"],
  st_vincent: ["sao_vicente", "Sao Vicente e Granadinas", "VIN", "São Vicente e Granadinas"],
  st_kitts: ["sao_cristovao", "Sao Cristovao e Nevis", "SKN", "São Cristóvão e Nevis"],
  saintlucia: ["santa_lucia", "Santa Lucia", "LCA", "Santa Lúcia"],
  dominica: ["dominica", "Dominica", "DMA", "Dominica"],
  antigua: ["antigua", "Antigua e Barbuda", "ATG", "Antígua e Barbuda"],
  montserrat: ["montserrat", "Montserrat", "MSR", "Montserrat"],
  anguilla: ["anguilla", "Anguilla", "AIA", "Anguilla"],
  cayman: ["ilhas_cayman", "Ilhas Cayman", "CAY", "Ilhas Cayman"],
  turks: ["turks_e_caicos", "Turks e Caicos", "TCA", "Turks e Caicos"],
  british_virgin_islands: ["ilhas_virgens_britanicas", "Ilhas Virgens Britanicas", "VGB", "Ilhas Virgens Britânicas"],
  us_virgin_islands: ["ilhas_virgens_americanas", "Ilhas Virgens Americanas", "VIR", "Ilhas Virgens Americanas"],
  puertorico: ["porto_rico", "Porto Rico", "PUR", "Porto Rico"],
  bonaire: ["bonaire", "Bonaire", "BOE", "Bonaire"],
  sintmaarten: ["sint_maarten", "Sint Maarten", "SMA", "Sint Maarten"],
  saint_martin: ["sao_martinho", "Sao Martinho", "SMT", "São Martinho"],
  martinique: ["martinica", "Martinica", "MTQ", "Martinica"],
  guadeloupe: ["guadalupe", "Guadalupe", "GLP", "Guadalupe"],
  frenchguyana: ["guiana_francesa", "Guiana Francesa", "GYF", "Guiana Francesa"],
}

// ─── Nacionalidades que REALMENTE existem no banco ───────────────────────────
const chave = (v: string) => v.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim()
const porNac = new Map<string, number>()
for (const t of allTeams) {
  for (const p of getPlayersForTeam(t)) {
    const n = (p.nac ?? "").trim()
    if (n) porNac.set(chave(n), (porNac.get(chave(n)) ?? 0) + 1)
  }
}

const jaTem = new Set(NATIONAL_TEAMS.map(n => n.id))

/** Cor dominante da arte, ignorando o fundo transparente. */
async function corDominante(arquivo: string): Promise<string | null> {
  if (!existsSync(arquivo)) return null
  const { data, info } = await sharp(arquivo)
    .trim()
    .resize(48, 48, { fit: "cover" })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })
  const baldes = new Map<string, { n: number; r: number; g: number; b: number }>()
  for (let i = 0; i < data.length; i += info.channels) {
    const [r, g, b, a] = [data[i], data[i + 1], data[i + 2], data[i + 3]]
    if (a < 200) continue                       // fundo
    if (r > 240 && g > 240 && b > 240) continue // branco de contorno/numero
    if (r < 18 && g < 18 && b < 18) continue    // preto de contorno
    const k = `${r >> 5}-${g >> 5}-${b >> 5}`
    const at = baldes.get(k)
    if (at) { at.n++; at.r += r; at.g += g; at.b += b }
    else baldes.set(k, { n: 1, r, g, b })
  }
  if (!baldes.size) return null
  const top = [...baldes.values()].sort((a, b) => b.n - a.n)[0]
  const hex = (v: number) => Math.round(v / top.n).toString(16).padStart(2, "0")
  return `#${hex(top.r)}${hex(top.g)}${hex(top.b)}`
}

async function main() {
  const linhas: string[] = []
  const semArte: string[] = []
  const semAtleta: string[] = []

  for (const { dir, conf } of PASTAS) {
    if (!existsSync(dir)) { console.error(`pasta ausente: ${dir}`); continue }
    const slugs = new Set(
      readdirSync(dir).filter(a => /\.png$/i.test(a)).map(a => a.replace(/\d\.png$/i, "")),
    )
    for (const slug of [...slugs].sort()) {
      const info = PAISES[slug]
      if (!info) continue
      const [id, nome, code, countryKey] = info
      if (jaTem.has(id)) continue

      const cor1 = await corDominante(path.join(dir, `${slug}1.png`))
      const cor2 = await corDominante(path.join(dir, `${slug}2.png`))
      if (!cor1) { semArte.push(nome); continue }

      const atletas = porNac.get(chave(countryKey)) ?? 0
      if (atletas === 0) semAtleta.push(`${nome} (${countryKey})`)

      // ⚠️ SO ENTRA QUEM TEM ATLETA DE VERDADE (decisao do usuario).
      //
      // Cadastrar uma selecao sem nenhum atleta no banco a faria jogar com nomes
      // do `fallbackNationalPlayers` — que e exatamente o defeito que acabamos de
      // tirar de 27 selecoes. Micronacao sem dado fica de fora ate alguem
      // importar elenco real para ela. `--todas` inclui todo mundo.
      if (atletas === 0 && !process.argv.includes("--todas")) continue

      linhas.push(
        `  { id: "${id}", name: "${nome}", code: "${code}", confederation: "${conf}", ` +
        `cor1: "${cor1}", cor2: "${cor2 ?? "#ffffff"}", countryKey: "${countryKey}" },` +
        `${atletas ? ` // ${atletas} atletas reais` : "  // SEM atleta real no seed"}`,
      )
    }
  }

  console.log(`── ${linhas.length} selecoes para acrescentar ──\n`)
  console.log(linhas.join("\n"))
  if (semArte.length) console.log(`\nSEM ARTE (nao entram): ${semArte.join(", ")}`)
  if (semAtleta.length) console.log(`\n⚠️ SEM ATLETA REAL NO SEED (${semAtleta.length}) — vao jogar com nomes gerados:\n  ${semAtleta.join(", ")}`)

}

main().catch(e => { console.error(e); process.exit(1) })
