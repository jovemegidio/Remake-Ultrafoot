// Publica UNIFORMES DE SELECAO pelo canal de atualizacao.
//
//   node scripts/publicar-uniformes-selecoes.mjs                    # ensaio
//   node scripts/publicar-uniformes-selecoes.mjs --exportar uniformes-selecoes.json
//   node scripts/publicar-uniformes-selecoes.mjs --pasta "<outra pasta>"
//
// ⚠️ SO RODA DE UM DIRETORIO COM node_modules (C:\Ultrafoot) — o `sharp` nao
// existe no G:. Editar no G: e copiar para la, como os irmaos.
//
// ─── Por que nao dava para usar o publicar-uniformes-pasta.mjs ──────────────
//
// Aquele resolve CLUBE por slug, em camadas de prova (fileKey, nome, UF...).
// Selecao nao e clube: a chave dela e `nation_<id>` e nao esta em `allTeams`.
// Passar as pastas de selecao por ele cairia em "SEM CLUBE NO SEED" — ou, pior,
// casaria "georgia" com algum clube homonimo.
//
// ─── O casamento aqui e por TABELA, e nao por adivinhacao ───────────────────
//
// Os arquivos vem em INGLES (`france1.png`, `czech2.png`) e os ids do jogo em
// portugues (`franca`, `tchequia`). Nao ha regra que ligue os dois: e tabela
// escrita a mao, conferida uma vez. Um pais que nao esta na tabela sai no
// relatorio como IGNORADO — nunca chutado, porque publicar a camisa da Croacia
// na Eslovaquia e um erro que ninguem percebe ate ver o jogo.
//
// A variante vem do NUMERO no fim: 1 = casa, 2 = fora, 3 = terceiro.

import { readdir, writeFile } from "node:fs/promises"
import { statSync, existsSync } from "node:fs"
import path from "node:path"
import sharp from "sharp"

const args = process.argv.slice(2)
const opt = (nome) => (args.includes(nome) ? args[args.indexOf(nome) + 1] : null)
const exportar = opt("--exportar")
const pastaUnica = opt("--pasta")

const RAIZ = path.resolve(import.meta.dirname, "..")

// Mesmo formato de public/kits-imported, que e o que o jogo ja desenha.
const LADO = 256

// ⚠️ A ARTE MORA NO G:, O `sharp` MORA NO C:.
//
// `sortitoutsi/` tem ~17 GB e por isso fica FORA do sync G:->C: (ver o
// sync-para-build). Mas o `sharp` so existe onde houve `npm install`, ou seja em
// C:\Ultrafoot. Entao este script roda do C: lendo do G: — e a raiz da arte e
// um parametro, nao o diretorio do script.
const RAIZ_DA_ARTE_PADRAO = "G:/Outros computadores/Meu laptop/Trabalho/Ultrafoot - PC"
const raizDaArte = opt("--raiz") ?? (existsSync(path.join(RAIZ, "sortitoutsi")) ? RAIZ : RAIZ_DA_ARTE_PADRAO)

const PASTAS_PADRAO = [
  path.join(raizDaArte, "sortitoutsi", "Nations_-_UEFA", "Nations - UEFA"),
  path.join(raizDaArte, "sortitoutsi", "Nations_-_CONCACAF", "Nations - CONCACAF"),
  // A CAF veio em outra pasta (Pictures), fora do sortitoutsi.
  "C:/Users/SnyX/Pictures/Nations_-_CAF/Nations - CAF",
]

/**
 * slug do arquivo (ingles) -> id da selecao no jogo (portugues).
 *
 * So estao aqui os paises que o jogo REALMENTE tem em NATIONAL_TEAMS. Os outros
 * (Andorra, Gibraltar, Anguilla...) existem nas pastas mas nao no catalogo — nao
 * adianta publicar camisa de selecao que ninguem pode escalar.
 */
const SLUG_PARA_SELECAO = {
  // UEFA
  england: "inglaterra",
  spain: "espanha",
  italy: "italia",
  france: "franca",
  germany: "alemanha",
  portugal: "portugal",
  netherlands: "holanda",
  belgium: "belgica",
  turkey: "turquia",
  russia: "russia",
  scotland: "escocia",
  austria: "austria",
  bosnia: "bosnia",
  croatia: "croacia",
  czech: "tchequia",
  norway: "noruega",
  sweden: "suecia",
  switzerland: "suica",
  // CONCACAF
  mexico: "mexico",
  usa: "estados_unidos",
  canada: "canada",
  curacao: "curacao",
  haiti: "haiti",
  panama: "panama",

  // ─── Acrescentadas com as 49 selecoes novas (05/08/2026) ──────────────
  albania: "albania",
  andorra: "andorra",
  armenia: "armenia",
  azerbaijan: "azerbaijao",
  barbados: "barbados",
  belarus: "bielorrussia",
  bulgaria: "bulgaria",
  costa_rica: "costa_rica",
  cyprus: "chipre",
  denmark: "dinamarca",
  dominican_republic: "republica_dominicana",
  elsalvador: "el_salvador",
  estonia: "estonia",
  faroe_islands: "ilhas_faroe",
  finland: "finlandia",
  frenchguyana: "guiana_francesa",
  georgia: "georgia",
  greece: "grecia",
  guadeloupe: "guadalupe",
  guatemala: "guatemala",
  guyana: "guiana",
  honduras: "honduras",
  hungary: "hungria",
  iceland: "islandia",
  ireland: "irlanda",
  israel: "israel",
  jamaica: "jamaica",
  kazakhstan: "cazaquistao",
  kosovo: "kosovo",
  latvia: "letonia",
  lithuania: "lituania",
  luxembourg: "luxemburgo",
  martinique: "martinica",
  moldova: "moldavia",
  montenegro: "montenegro",
  north_macedonia: "macedonia_do_norte",
  northern_ireland: "irlanda_do_norte",
  poland: "polonia",
  puertorico: "porto_rico",
  romania: "romenia",
  saintlucia: "santa_lucia",
  serbia: "servia",
  slovakia: "eslovaquia",
  slovenia: "eslovenia",
  st_vincent: "sao_vicente",
  suriname: "suriname",
  trinidad: "trinidad_e_tobago",
  ukraine: "ucrania",
  wales: "pais_de_gales",

  // ─── CONMEBOL (06/08/2026) ────────────────────────────────────────────
  // As dez, todas no catalogo do jogo. So `brazil`, `ecuador`, `paraguay` e
  // `uruguay` mudam de grafia; as outras seis sao iguais nos dois lados e
  // estao aqui de proposito, para a tabela continuar sendo a lista COMPLETA do
  // que sai da pasta (slug ausente e ignorado em silencio, e "ignorado" e o
  // mesmo desfecho de "escrito diferente").
  argentina: "argentina",
  bolivia: "bolivia",
  brazil: "brasil",
  chile: "chile",
  colombia: "colombia",
  ecuador: "equador",
  paraguay: "paraguai",
  peru: "peru",
  uruguay: "uruguai",
  venezuela: "venezuela",

  // ─── CAF (05/08/2026) ─────────────────────────────────────────────────
  algeria: "argelia",
  cape_verde: "cabo_verde",
  dr_congo: "congo_dr",
  egypt: "egito",
  ghana: "gana",
  ivory_coast: "costa_do_marfim",
  morocco: "marrocos",
  senegal: "senegal",
  south_africa: "africa_do_sul",
  tunisia: "tunisia",
}

const VARIANTE_POR_NUMERO = { 1: "home", 2: "away", 3: "third" }

const pastas = pastaUnica ? [pastaUnica] : PASTAS_PADRAO
for (const p of pastas) {
  if (!existsSync(p)) {
    console.error(`pasta nao encontrada: ${p}`)
    process.exit(1)
  }
}

// ─── Leitura ────────────────────────────────────────────────────────────────

const porSelecao = new Map()
const ignorados = new Map()
const semVariante = []

for (const pasta of pastas) {
  const arquivos = (await readdir(pasta)).filter(a => /\.png$/i.test(a))
  for (const arquivo of arquivos) {
    const m = /^([a-z_]+?)(\d)\.png$/i.exec(arquivo)
    if (!m) { semVariante.push(`${path.basename(pasta)}/${arquivo}`); continue }
    const [, slug, numero] = m
    const variante = VARIANTE_POR_NUMERO[Number(numero)]
    if (!variante) { semVariante.push(`${path.basename(pasta)}/${arquivo}`); continue }

    const selecao = SLUG_PARA_SELECAO[slug.toLowerCase()]
    if (!selecao) {
      ignorados.set(slug, (ignorados.get(slug) ?? 0) + 1)
      continue
    }

    const origem = path.join(pasta, arquivo)
    const quando = statSync(origem).mtimeMs
    if (!porSelecao.has(selecao)) porSelecao.set(selecao, {})
    const alvo = porSelecao.get(selecao)
    // Mesma variante em duas pastas/arquivos: vence o mais recente.
    if (!alvo[variante] || quando > alvo[variante].quando) {
      alvo[variante] = { arquivo, origem, quando }
    }
  }
}

// ─── Conversao ──────────────────────────────────────────────────────────────

const clubes = []
for (const [selecao, kits] of [...porSelecao.entries()].sort()) {
  const saida = {}
  const linhas = []
  for (const [v, k] of Object.entries(kits)) {
    // `trim` antes do resize: a margem transparente varia por arquivo e sem
    // ⚠️ SEM REDUZIR, pelo mesmo motivo do uniforme de clube: reduzir 420 -> 256
    // ja foi reprovado ("qualidade terrivel"). O `trim()` saiu junto — ele so
    // fazia sentido antes de um resize que igualasse as dimensoes de novo.
    //
    // ⚠️ `effort: 4`, E NAO 6 — MEDIDO. Nestas artes (COM canal alfa) o effort 6
    // liga uma busca cara no plano de transparencia e custa 4.027 ms por imagem
    // contra 74 ms no 4 (54x) para economizar 3% de bytes.
    const buf = await sharp(k.origem).webp({ quality: 90, effort: 4 }).toBuffer()
    saida[v] = { data: `data:image/webp;base64,${buf.toString("base64")}` }
    linhas.push(`${v} ${(buf.length / 1024).toFixed(0)}KB`)
  }
  const fileKey = `nation_${selecao}`
  console.log(`  ${fileKey.padEnd(26)} ${linhas.join(" | ")}`)
  clubes.push({ file_key: fileKey, kits: saida })
}

const pecas = clubes.reduce((s, c) => s + Object.keys(c.kits).length, 0)
console.log(`\n${clubes.length} selecoes | ${pecas} pecas`)

if (ignorados.size) {
  console.log(`\nIGNORADOS — pais sem selecao no jogo (${ignorados.size}):`)
  console.log("  " + [...ignorados.keys()].sort().join(", "))
}
if (semVariante.length) {
  console.log(`\nSEM VARIANTE RECONHECIVEL (${semVariante.length}):`)
  console.log("  " + semVariante.join("\n  "))
}

if (!exportar) {
  console.log("\nEnsaio. Use --exportar <arquivo> para gravar o pacote.")
} else {
  await writeFile(path.resolve(exportar), JSON.stringify({ clubes }, null, 1), "utf8")
  console.log(`\nExportado para ${path.resolve(exportar)}`)
}
