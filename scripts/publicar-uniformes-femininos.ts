// Publica UNIFORMES DE CLUBE FEMININO pelo canal de atualização.
//
//   node node_modules/tsx/dist/cli.mjs scripts/publicar-uniformes-femininos.ts \
//     --pasta "<pasta da liga>" --liga frauen_bundesliga [--exportar kits.json]
//
// ⚠️ POR QUE NÃO DÁ PARA USAR O `publicar-uniformes-pasta.mjs` AQUI — e por que
// usá-lo seria pior do que não publicar:
//
//   O universo dele é o POOL MASCULINO (`imported-bf2026`). Solto sobre a pasta
//   "Germany - Frauen Bundesliga", "bayern_women_1.png" casa com o Bayern
//   MASCULINO e a camisa feminina vai para a chave `bayern_munich` — o time
//   masculino passa a jogar com ela, e o feminino continua sem uniforme algum.
//   Nenhum erro aparece: o casamento é legítimo pela regra dele.
//
// O universo daqui é `construirTimesFemininos`, o mesmo que monta os clubes
// femininos no jogo, e a chave publicada é a `<masculino>__fem`.
//
// ⚠️ E A CHAVE `__fem` FUNCIONA POR UM DETALHE QUE VALE CONFERIR SE ALGUÉM MEXER
// EM `getCamisaUrl`: ele consulta `getTeamOverride(fileKey)` com a chave INTEIRA
// antes de descascar o sufixo (`chaveDeAssetMasculina`). É essa ordem que deixa
// o clube feminino ter uniforme PRÓPRIO sem tocar no do clube-mãe. Se a
// descascada subir para antes do override, todo este lote fica invisível — e,
// pior, passaria a valer para o masculino.
//
// A variante vem do fim do nome, como nas outras pastas, mas aqui há um marcador
// de gênero no meio do caminho: `bayern_women_1`, `ajax_w2`, `boavista_fem1`,
// `alhama1f`. Ele é arrancado do slug antes do casamento.

import { statSync } from "node:fs"
import { readFile, readdir, writeFile } from "node:fs/promises"
import path from "node:path"
import sharp from "sharp"
import { LIGAS_FEMININAS, SUFIXO_FEMININO, construirTimesFemininos } from "../lib/futebol-feminino"

const args = process.argv.slice(2)
const opt = (n: string) => (args.includes(n) ? args[args.indexOf(n) + 1] : "")
const PASTA = opt("--pasta")
const LIGA = opt("--liga")
const MAPA = opt("--mapa")
const EXPORTAR = opt("--exportar")
const RESUMO = args.includes("--resumo")

if (!PASTA || !LIGA) {
  console.error('uso: --pasta "<pasta>" --liga <id> [--mapa mapa.json] [--exportar kits.json]')
  console.error(`ligas: ${LIGAS_FEMININAS.map(l => l.id).join(", ")}`)
  process.exit(1)
}
if (!LIGAS_FEMININAS.some(l => l.id === LIGA)) {
  console.error(`--liga ${LIGA} desconhecida. Use uma de: ${LIGAS_FEMININAS.map(l => l.id).join(", ")}`)
  process.exit(1)
}

// O universo é montado exatamente como o jogo monta (sem resolver o masculino:
// aqui só interessam `file_key` e `nome`, que não dependem dele).
const universo = construirTimesFemininos(() => undefined, new Set()).filter(t => t.divisao === LIGA)
if (!universo.length) {
  console.error(`a liga ${LIGA} não tem clube nenhum — nada a casar`)
  process.exit(1)
}

const VARIANTES: [RegExp, "home" | "away" | "third"][] = [
  [/^1$/, "home"],
  [/^2$/, "away"],
  [/^3$/, "third"],
]

const semAcento = (s: string) => (s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "")
const norm = (s: string) => semAcento(s).toLowerCase().replace(/[^a-z0-9]/g, "")

// Palavra de sociedade cai dos dois lados, como no casamento de escudo. Aqui ela
// é multilíngue de propósito: a pasta é europeia e sul-americana ao mesmo tempo.
const SOCIEDADE = new Set([
  "fc", "cf", "sc", "ac", "ec", "sv", "vfl", "vfb", "tsg", "bsc", "ssc", "as", "ss", "us",
  "afc", "cd", "ud", "sd", "rcd", "club", "clube", "calcio", "futebol", "football", "feminino",
  "femenino", "femminile", "frauen", "women", "vrouwen", "dames", "damen", "sport", "sporting",
  "atletico", "associacao", "asociacion", "societa", "esporte", "de", "do", "da", "of",
])

const palavras = (s: string) => semAcento(s).toLowerCase().split(/[^a-z0-9]+/).filter(Boolean)
const semSociedade = (s: string) => palavras(s).filter(p => !SOCIEDADE.has(p)).join("")

// Marcador de gênero no nome do arquivo. ⚠️ Só no FIM ou no COMEÇO do slug: um
// `w` solto no meio de "wolfsburg" não é marcador, e arrancá-lo destruiria o
// nome do clube.
const semMarcador = (slug: string) =>
  slug
    .replace(/[\s_-]*(women|womens|woman|feminino|femenino|femminile|frauen|vrouwen|dames|fem|fut|w|f)$/i, "")
    .replace(/^(wfc|fcw)[\s_-]*/i, "")
    .replace(/[\s_-]+$/, "")

/** Variante + slug do clube, a partir do nome do arquivo. */
function partes(arquivo: string): { slug: string | null; variante: "home" | "away" | "third" | null } {
  const base = arquivo.replace(/\.[a-z0-9]+$/i, "")
  // ⚠️ A ALTERNANCIA VAI DO MAIOR PARA O MENOR: "abcrn1feminino" (pasta
  // "Brasil - Kits/Brasil Femininos - 2D") tem o marcador por extenso, e com
  // `f` antes de `feminino` o backtracking resolve, mas a ordem explicita
  // deixa claro o que a regra cobre.
  // "alhama1f" e "alhama_1": o dígito é o último token útil, com um marcador de
  // gênero opcional grudado depois dele.
  const m = base.match(/^(.*?)[\s_-]*(\d)[\s_-]*(?:feminino|femenino|femminile|womens|women|frauen|fem|fut|w|f)?$/i)
  if (!m) return { slug: null, variante: null }
  const variante = VARIANTES.find(([re]) => re.test(m[2]))?.[1] ?? null
  if (!variante) return { slug: null, variante: null }
  const slug = semMarcador(m[1].replace(/[\s_-]+(19|20)?\d{2}$/, ""))
  return { slug: slug || m[1], variante }
}

const manual = new Map<string, string>()
async function lerMapa() {
  if (!MAPA) return
  for (const [chave, valor] of Object.entries(JSON.parse(await readFile(path.resolve(MAPA), "utf8")) as Record<string, string>)) {
    if (chave.startsWith("_")) continue
    const [prefixo, slug] = chave.includes(":") ? chave.split(":") : [null, chave]
    if (prefixo && prefixo !== LIGA) continue
    manual.set(norm(slug), String(valor))
  }
}

/** Índices do universo, do mais forte para o mais fraco. */
const porNome = new Map<string, typeof universo>()
const porBase = new Map<string, typeof universo>()
const porNomeSemSociedade = new Map<string, typeof universo>()
for (const t of universo) {
  const base = t.file_key.slice(0, -SUFIXO_FEMININO.length)
  const juntar = (m: Map<string, typeof universo>, k: string) => {
    if (!k) return
    if (!m.has(k)) m.set(k, [])
    if (!m.get(k)!.includes(t)) m.get(k)!.push(t)
  }
  juntar(porNome, norm(t.nome))
  juntar(porBase, norm(base))
  // `barcelona_esp` e `bayern_munich`: o sufixo de país/cidade não aparece no
  // nome do arquivo, então a chave sem ele é a segunda sonda.
  juntar(porBase, norm(base.replace(/_[a-z]{2,4}$/i, "")))
  juntar(porNomeSemSociedade, semSociedade(t.nome))
}

interface Casamento { time: (typeof universo)[number]; via: string }
function casar(slug: string): Casamento | { ambiguo: string[] } | null {
  const alvo = norm(slug)
  const m = manual.get(alvo)
  if (m) {
    const t = universo.find(x => x.file_key === m || x.file_key === `${m}${SUFIXO_FEMININO}`)
    if (!t) throw new Error(`--mapa aponta para ${m}, que não existe na liga ${LIGA}`)
    return { time: t, via: "mapa manual" }
  }
  for (const [indice, via] of [[porNome, "nome"], [porBase, "chave do clube-mãe"], [porNomeSemSociedade, "nome sem palavra de sociedade"]] as const) {
    const chave = via === "nome sem palavra de sociedade" ? semSociedade(slug) : alvo
    const achados = indice.get(chave)
    if (achados?.length === 1) return { time: achados[0], via }
    if (achados && achados.length > 1) return { ambiguo: achados.map(t => t.file_key) }
  }
  // Camada final: contenção por nome, mínimo de 4 letras e só se devolver UM.
  // É a que resolve "bayern" -> "Bayern de Munique" e "atleticomadrid" ->
  // "Atlético de Madrid".
  if (alvo.length >= 4) {
    const contidos = universo.filter(t => {
      const n = norm(t.nome)
      return n.includes(alvo) || alvo.includes(n)
    })
    if (contidos.length === 1) return { time: contidos[0], via: "contenção no nome" }
    if (contidos.length > 1) return { ambiguo: contidos.map(t => t.file_key) }
  }
  return null
}

async function listar(raiz: string, base = ""): Promise<string[]> {
  const saida: string[] = []
  for (const item of await readdir(path.join(raiz, base), { withFileTypes: true })) {
    const rel = base ? path.join(base, item.name) : item.name
    if (item.isDirectory()) saida.push(...(await listar(raiz, rel)))
    else if (/\.(png|jpe?g|webp)$/i.test(item.name)) saida.push(rel)
  }
  return saida
}

async function main() {
  await lerMapa()
  const arquivos = (await listar(PASTA)).sort()
  const porClube = new Map<string, { nome: string; kits: Record<string, { origem: string; mtime: number }> }>()
  const semVariante: string[] = []
  const semClube: string[] = []
  const ambiguos: string[] = []

  for (const rel of arquivos) {
    const arquivo = path.basename(rel)
    const { slug, variante } = partes(arquivo)
    if (!slug || !variante) { semVariante.push(rel); continue }
    let achado: ReturnType<typeof casar>
    try { achado = casar(slug) } catch (e) { console.error(String(e)); process.exit(1) }
    if (!achado) { semClube.push(`${rel} (slug "${slug}")`); continue }
    if ("ambiguo" in achado) { ambiguos.push(`${rel} (slug "${slug}") -> ${achado.ambiguo.join(", ")}`); continue }

    const chave = achado.time.file_key
    if (!porClube.has(chave)) porClube.set(chave, { nome: `${achado.time.nome} [${achado.via}]`, kits: {} })
    const alvo = porClube.get(chave)!
    const mtime = statSync(path.join(PASTA, rel)).mtimeMs
    // ⚠️ Arquivo repetido para a mesma variante é temporada diferente, não lixo:
    // vence o mais novo (mesma regra do lote FenixCAP).
    if (!alvo.kits[variante] || alvo.kits[variante].mtime < mtime) {
      alvo.kits[variante] = { origem: path.join(PASTA, rel), mtime }
    }
  }

  const clubes: { file_key: string; kits: Record<string, { data: string }> }[] = []
  let pecas = 0
  for (const [file_key, dados] of [...porClube.entries()].sort()) {
    const kits: Record<string, { data: string }> = {}
    const rotulos: string[] = []
    for (const [variante, k] of Object.entries(dados.kits)) {
      // Sem redução e `effort: 4`, como nos outros lotes: reduzir foi reprovado
      // pelo usuário (a listra fina vira borrão) e o effort 6 custa 54x o tempo.
      const buf = await sharp(k.origem).webp({ quality: 90, effort: 4 }).toBuffer()
      kits[variante] = { data: `data:image/webp;base64,${buf.toString("base64")}` }
      rotulos.push(`${variante} ${(buf.length / 1024).toFixed(0)}KB`)
      pecas++
    }
    clubes.push({ file_key, kits })
    if (!RESUMO) console.log(`  ${dados.nome} (${file_key}): ${rotulos.join(" | ")}`)
  }

  console.log(`\n${clubes.length} clubes | ${pecas} pecas | liga ${LIGA} (${universo.length} clubes no jogo)`)
  const semUniforme = universo.filter(t => !porClube.has(t.file_key))
  if (semUniforme.length) console.log(`SEM ARQUIVO NA PASTA (${semUniforme.length}): ${semUniforme.map(t => t.nome).join(", ")}`)
  if (semClube.length) { console.log("\nSEM CLUBE NESTA LIGA:"); for (const s of semClube) console.log("  " + s) }
  if (ambiguos.length) { console.log("\nAMBIGUO (resolva no --mapa):"); for (const a of ambiguos) console.log("  ? " + a) }
  if (semVariante.length) { console.log("\nSEM VARIANTE RECONHECIVEL:"); for (const s of semVariante) console.log("  " + s) }

  if (EXPORTAR) {
    await writeFile(path.resolve(EXPORTAR), JSON.stringify({ clubes }, null, 1), "utf8")
    console.log(`\nExportado para ${path.resolve(EXPORTAR)}`)
  } else {
    console.log("\nEnsaio. Use --exportar <arquivo> para gravar o pacote.")
  }
}

main().catch(e => { console.error(e); process.exit(1) })
