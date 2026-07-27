// Importa as fotos curadas de Jogadores/<Clube>/<Nome do Jogador>.webp para o
// jogo: copia para public/jogadores/ e registra em data/seeds/faces-manifest.json.
//
// Por que o manifesto: getPlayerPhotoUrl() consulta o manifesto ANTES do
// Transfermarkt, entao uma foto registrada aqui tem prioridade sobre a foto
// remota. A chave e o nome normalizado (normalizePlayerKey), igual ao do jogo.
//
// ⚠️ O QUE ESTE SCRIPT PROTEGE: o nome do ARQUIVO tem que casar com o nome do
// atleta no elenco, senao a foto entra no manifesto e NUNCA e consultada — falha
// silenciosa, o tipo de erro que custa caro porque parece ter funcionado. Ex.:
// a pasta traz "Alexander Barbosa.webp" e o elenco do Palmeiras tem "Alexander
// Barboza". Cada arquivo e conferido contra o elenco do proprio clube e os
// divergentes saem num relatorio, com sugestao quando ha sobrenome em comum.
//
// Uso:
//   node scripts/import-fotos-pasta.mjs --dry-run   (só relata, não escreve)
//   node scripts/import-fotos-pasta.mjs

import { existsSync } from "node:fs"
import { copyFile, mkdir, readFile, readdir, writeFile } from "node:fs/promises"
import path from "node:path"

const dryRun = process.argv.includes("--dry-run")
const ORIGEM = path.resolve("Jogadores")
const DESTINO = path.resolve("public/jogadores")
const MANIFESTO = path.resolve("data/seeds/faces-manifest.json")
const ELENCOS = path.resolve("data/seeds/real-squads-tm.json")

// Mesma normalizacao de lib/player-photos.ts (normalizePlayerKey). Precisa ser
// identica: e a chave que o jogo usa para procurar a foto.
const slug = (nome) =>
  nome.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim()
    .replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "")

const sobrenome = (nome) => slug(nome).split("-").filter(Boolean).at(-1) ?? ""

// Sufixos de tratamento que o Transfermarkt costuma omitir ("Neymar Jr" -> "Neymar").
const SUFIXOS = new Set(["jr", "junior", "filho", "neto", "j"])

/**
 * Formas alternativas da MESMA grafia, para o arquivo casar com o elenco sem
 * renomear nada na pasta. Só variação ortográfica — nunca troca de pessoa:
 *   • sufixo de tratamento removido: "Neymar Jr"        -> "neymar"
 *   • z/s intercambiáveis (pt/es):   "Alexander Barbosa" -> "alexander-barboza"
 * Só é aceita quando resolve para UM único atleta do elenco (ver uso adiante).
 */
function variantes(nome) {
  const base = slug(nome)
  const partes = base.split("-").filter(Boolean)
  const semSufixo = partes.length > 1 && SUFIXOS.has(partes.at(-1))
    ? partes.slice(0, -1).join("-")
    : null
  const formas = new Set([base, semSufixo].filter(Boolean))
  for (const forma of [...formas]) {
    formas.add(forma.replaceAll("z", "s"))
    formas.add(forma.replaceAll("s", "z"))
  }
  formas.delete(base)
  return [...formas]
}

if (!existsSync(ORIGEM)) throw new Error(`pasta nao encontrada: ${ORIGEM}`)

const manifesto = JSON.parse(await readFile(MANIFESTO, "utf8"))
const elencos = JSON.parse(await readFile(ELENCOS, "utf8"))

// clube normalizado -> nomes do elenco. A chave do seed e "CURTO|nome do clube".
const elencoPorClube = new Map()
for (const [chave, jogadores] of Object.entries(elencos)) {
  const nomeClube = slug(chave.split("|")[1] ?? "")
  if (!nomeClube || !Array.isArray(jogadores)) continue
  elencoPorClube.set(nomeClube, jogadores.filter((j) => j?.n))
}

/** Elenco do clube da pasta, tolerando "São Paulo" x "sao paulo" e plural. */
function acharElenco(nomePasta) {
  const alvo = slug(nomePasta)
  if (elencoPorClube.has(alvo)) return elencoPorClube.get(alvo)
  for (const [nome, jogadores] of elencoPorClube) {
    if (nome === alvo || nome.includes(alvo) || alvo.includes(nome)) return jogadores
  }
  return null
}

const pastas = (await readdir(ORIGEM, { withFileTypes: true }))
  .filter((e) => e.isDirectory())
  .map((e) => e.name)

const importados = []
const divergentes = []
let semElenco = 0

for (const pasta of pastas) {
  const elenco = acharElenco(pasta)
  if (!elenco) {
    semElenco++
    console.warn(`! ${pasta}: nao achei este clube em real-squads-tm.json — nomes nao conferidos`)
  }
  const porSlug = new Map((elenco ?? []).map((j) => [slug(j.n), j.n]))
  const overallPorSlug = new Map((elenco ?? []).map((j) => [slug(j.n), j.o ?? 0]))
  const porSobrenome = new Map()
  for (const j of elenco ?? []) {
    const s = sobrenome(j.n)
    if (s && !porSobrenome.has(s)) porSobrenome.set(s, j.n)
  }

  const arquivos = (await readdir(path.join(ORIGEM, pasta))).filter((f) => /\.(webp|png|jpe?g)$/i.test(f))
  for (const arquivo of arquivos) {
    const nomeAtleta = arquivo.replace(/\.(webp|png|jpe?g)$/i, "")
    const ext = path.extname(arquivo).toLowerCase()
    let chave = slug(nomeAtleta)
    let via = null

    if (elenco && !porSlug.has(chave)) {
      // Grafia diferente entre a pasta e o elenco. Aceita a variante SO se ela
      // apontar para exatamente um atleta — ambiguidade vai para o relatorio em
      // vez de arriscar colar a foto na pessoa errada.
      const achadas = variantes(nomeAtleta).filter((v) => porSlug.has(v))
      const unicas = [...new Set(achadas)]
      if (unicas.length === 1) {
        via = porSlug.get(unicas[0])
        chave = unicas[0]
      } else {
        divergentes.push({
          clube: pasta,
          arquivo,
          sugestao: porSobrenome.get(sobrenome(nomeAtleta)) ?? null,
          ambiguo: unicas.length > 1,
        })
        continue // nao registra o que o jogo nao vai consultar
      }
    }

    importados.push({
      chave,
      clube: pasta,
      via,
      overall: overallPorSlug.get(chave) ?? 0,
      origem: path.join(ORIGEM, pasta, arquivo),
      destino: path.join(DESTINO, `${chave}${ext}`),
      url: `/jogadores/${chave}${ext}`,
      substitui: Boolean(manifesto.entries[chave]),
    })
  }
}

// HOMONIMOS entre clubes. A chave do manifesto e o NOME normalizado, entao dois
// atletas diferentes com o mesmo nome (Allan do Corinthians e Allan do Palmeiras)
// disputam a mesma entrada e um sobrescreveria a foto do outro em silencio. Fica
// o de MAIOR overall — a mesma convencao que lib/player-photos.ts ja aplica no
// mapa do Transfermarkt, onde o craque e quem aparece nas telas.
const homonimos = []
const porChave = new Map()
for (const item of importados) {
  const atual = porChave.get(item.chave)
  if (!atual) { porChave.set(item.chave, item); continue }
  const vencedor = item.overall > atual.overall ? item : atual
  const perdedor = vencedor === item ? atual : item
  porChave.set(item.chave, vencedor)
  homonimos.push({ chave: item.chave, vencedor, perdedor })
}
const finais = [...porChave.values()]

console.log(`\npastas: ${pastas.length}   fotos casadas: ${importados.length}   a registrar: ${finais.length}   divergentes: ${divergentes.length}`)

if (homonimos.length) {
  console.log(`\n── HOMONIMOS: uma entrada por nome, fica o de maior overall ──`)
  for (const h of homonimos) {
    console.log(`  "${h.chave}": fica ${h.vencedor.clube} (o${h.vencedor.overall}) · fora ${h.perdedor.clube} (o${h.perdedor.overall})`)
  }
}
if (semElenco) console.log(`clubes sem elenco no seed: ${semElenco}`)

const porVariante = importados.filter((i) => i.via)
if (porVariante.length) {
  console.log(`\n── GRAFIA AJUSTADA (arquivo x elenco) ──`)
  for (const i of porVariante) console.log(`  ${i.clube}/${path.basename(i.origem)}   → "${i.via}"`)
}

if (divergentes.length) {
  console.log(`\n── NOME NAO ENCONTRADO NO ELENCO (foto NAO importada) ──`)
  for (const d of divergentes) {
    const nota = d.ambiguo
      ? "   (varios atletas possiveis — renomeie o arquivo)"
      : d.sugestao ? `   → renomear para "${d.sugestao}"?` : "   (sem sugestao)"
    console.log(`  ${d.clube}/${d.arquivo}${nota}`)
  }
}

const substituicoes = finais.filter((i) => i.substitui).length
if (substituicoes) console.log(`\n${substituicoes} foto(s) vao SUBSTITUIR uma entrada ja existente no manifesto.`)

if (dryRun) {
  console.log("\n--dry-run: nada foi escrito.")
  process.exit(0)
}

await mkdir(DESTINO, { recursive: true })
for (const item of finais) {
  await copyFile(item.origem, item.destino)
  manifesto.entries[item.chave] = item.url
}
manifesto.available = Object.keys(manifesto.entries).length
manifesto.generatedAt = new Date().toISOString()
await writeFile(MANIFESTO, `${JSON.stringify(manifesto, null, 2)}\n`, "utf8")

console.log(`\nOK: ${finais.length} foto(s) em public/jogadores/ e registradas no manifesto.`)
console.log(`manifesto agora tem ${manifesto.available} entradas.`)
