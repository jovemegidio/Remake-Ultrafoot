// PREPARA UNIFORMES DE PASTAS POR LIGA PARA O CANAL DE ATUALIZACAO.
//
//   node scripts/publicar-camisas-pasta.mjs --raiz "C:/Users/.../Camisas" \
//     --exportar camisas.json  [ file_key=slug ... ]
//
// Irmao do publicar-escudos-pasta.mjs. As diferencas que importam:
//
//  * O PAIS VEM DA PASTA, nao do nome do arquivo. "Italy - Serie A" diz Italia
//    para todos os 62 arquivos de dentro — prova de origem muito mais forte do
//    que a sigla que os escudos traziam, e de graca.
//  * Cada clube tem ATE TRES arquivos: `<slug>_1` titular, `_2` reserva,
//    `_3` terceiro. O pacote sai com os tres na mesma entrada do clube.
//  * ⚠️ WEBP COM PERDA, e isto foi MEDIDO (10 camisas, 256px):
//        png paletizado 24,8 KB | webp sem perda 43,8 KB | webp q90 13,1 KB
//    O oposto do escudo, onde o PNG ganhou — escudo aqui e monocromatico e de
//    area chapada, camisa tem gradiente e textura. Nao copie a escolha de la.
//  * 256px porque a maior tela que desenha camisa usa 150x188 (app/novo-jogo).
//    Guardar 420px seria triplicar a copia local para ninguem ver a diferenca.
//
// A COPIA LOCAL E O GARGALO, nao o servidor: no app instalado a webview nao
// alcanca a VPS, entao a camisa so aparece se couber na copia local (ver
// lib/atualizacao-elencos). Por isso o tamanho de cada arquivo importa tanto.

import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from "node:fs"
import path from "node:path"
import sharp from "sharp"

const RAIZ_REPO = path.resolve(import.meta.dirname, "..")
const LADO = 256

const arg = (nome) => {
  const i = process.argv.indexOf(nome)
  return i >= 0 ? process.argv[i + 1] : ""
}
const RAIZ = arg("--raiz")
const SAIDA = arg("--exportar")
// A raiz costuma ter MAIS ligas do que se quer publicar (ha `Lower_leagues` e
// `Regionalliga` soltas la). Sem esta trava o script varre tudo e publica liga
// que ninguem pediu.
const SOMENTE = arg("--somente") ? new Set(arg("--somente").split(",").map((s) => s.trim())) : null
if (!RAIZ) {
  console.error('uso: --raiz "C:/.../Camisas" [--exportar saida.json] [file_key=slug]')
  process.exit(1)
}

const MANUAIS = new Map()
for (const a of process.argv.slice(2)) {
  if (a.startsWith("--") || !a.includes("=")) continue
  const i = a.indexOf("=")
  MANUAIS.set(a.slice(i + 1).trim(), a.slice(0, i).trim())
}

// ─── Normalizacao (a mesma do publicar-escudos-pasta) ────────────────────────

const semAcento = (s) => (s ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "")
const norm = (s) => semAcento(s).toLowerCase().replace(/[^a-z0-9]/g, "")

const SOCIEDADE = new Set([
  "fc", "ac", "sc", "ec", "cf", "cd", "ca", "afc", "cfc", "sac", "ad", "sd",
  "ud", "as", "us", "ss", "aa", "ss", "ssd", "asd", "rc", "sv", "tsv", "fsv",
  "vfb", "vfl", "sg", "spvgg", "bsc", "kfc", "msv",
  "calcio", "club", "clube", "futebol", "futbol", "football", "esporte",
  "esportivo", "sociedade", "associacao", "deportivo", "deportes", "sporting",
  "sport", "kulubu", "spor", "de", "da", "do", "del", "y", "e", "und",
])

function chaveNome(nome) {
  const palavras = semAcento(nome ?? "")
    .split(/[\s–_-]+/)
    .map((p) => p.toLowerCase().replace(/[^a-z0-9]/g, ""))
    .filter(Boolean)
  const uteis = palavras.filter((p) => !SOCIEDADE.has(p))
  return (uteis.length ? uteis : palavras).join("")
}

// ─── Pais a partir do nome da pasta ──────────────────────────────────────────
//
// A pasta e a fonte de verdade da origem. `sufixos` sao os finais de file_key
// que o jogo usa; `pais` sao os valores do campo `pais` no seed — que mistura
// nome por extenso e sigla, e por isso aceita mais de uma forma.
const LIGAS = {
  England: { pais: ["inglaterra"], sufixos: ["ing", "eng"] },
  France: { pais: ["franca"], sufixos: ["fra", "fr"] },
  Germany: { pais: ["alemanha"], sufixos: ["ale", "ger"] },
  Italy: { pais: ["italia"], sufixos: ["ita", "it"] },
  Spain: { pais: ["espanha"], sufixos: ["esp"] },
}

const VARIANTE = { 1: "home", 2: "away", 3: "third" }

// ─── Universo de clubes ──────────────────────────────────────────────────────

function carregarClubes() {
  const seed = JSON.parse(readFileSync(path.join(RAIZ_REPO, "data/seeds/imported-bf2026.json"), "utf-8"))
  return (seed.teams ?? [])
    .filter((t) => (t.fileKey ?? t.file_key) && t.nome)
    .map((t) => {
      const fileKey = t.fileKey ?? t.file_key
      return {
        fileKey,
        nome: t.nome,
        chave: chaveNome(t.nome),
        cru: norm(t.nome),
        pais: t.pais ?? "",
        sufixo: (fileKey.split("_").at(-1) ?? "").toLowerCase(),
      }
    })
}

const TODOS_SUFIXOS = new Set(Object.values(LIGAS).flatMap((l) => l.sufixos))
const TODOS_PAISES = new Set(Object.values(LIGAS).flatMap((l) => l.pais))

/**
 * Escada de origem: 2 = e desta liga; 1 = nao da para saber; 0 = e de OUTRO pais.
 *
 * ⚠️ O NIVEL 1 EXISTE PORQUE O POOL TEM O CAMPO `pais` GIRADO. Chelsea guarda
 * `pais: "CHELSEA"`, Fulham `"FULHAM"`, Sunderland `"SUNDERLAND"`, e o file_key
 * deles nao tem sufixo de pais — ou seja, os maiores clubes da Premier League
 * nao sao "provavelmente ingleses" para nenhuma regra. Exigir prova jogava todos
 * fora; aceitar qualquer um vestia o Arsenal com a camisa do Arsenal Tula, da
 * Russia. Quem tem prova ganha de quem nao tem, e quem e de outro pais sai.
 */
function nivelDeOrigem(clube, liga) {
  if (!liga) return 1
  if (liga.pais.some((p) => norm(clube.pais) === norm(p))) return 2
  if (liga.sufixos.includes(clube.sufixo)) return 2
  const paisConhecido = TODOS_PAISES.has(norm(clube.pais)) ||
    /^(bra|arg|por|hol|bel|rus|tur|ara|chi|per|col|uru|mex|eua|usa|gre|sui|aut|den|nor|sue|pol|cze|ucr|esc|irl|cro|ser)$/.test(clube.sufixo) ||
    TODOS_SUFIXOS.has(clube.sufixo)
  return paisConhecido ? 0 : 1
}

/** Fica so com quem tem o maior nivel de origem; ninguem, se todos sao de fora. */
function porMelhorOrigem(candidatos, liga) {
  const comNota = candidatos.map((c) => ({ c, n: nivelDeOrigem(c, liga) })).filter((x) => x.n > 0)
  if (!comNota.length) return []
  const max = Math.max(...comNota.map((x) => x.n))
  return comNota.filter((x) => x.n === max).map((x) => x.c)
}

// ─── Leitura das pastas ──────────────────────────────────────────────────────

/**
 * Uma pasta de liga -> { slug: { 1: caminho, 2: ..., 3: ... } }
 *
 * ⚠️ DESCE NAS SUBPASTAS. Serie C vem dividida em "Group A/B/C" e a Oberliga em
 * "Bayernliga Nord", "Bremenliga", "Hessenliga"... Lendo so o primeiro nivel,
 * essas duas ligas apareciam com 3 e 14 arquivos em vez de centenas.
 * A subpasta "Alt" fica de fora de proposito: sao uniformes alternativos do
 * MESMO clube, e entrariam brigando com o titular pela mesma chave.
 *
 * ⚠️ DOIS PADROES DE NOME. Italia e Alemanha usam `slug_1.png`; a Espanha usa
 * `Celta1.png`, sem o tracinho. So o primeiro padrao deixava La Liga inteira
 * de fora sem uma linha de aviso.
 */
function lerPasta(dir, porSlug = new Map()) {
  for (const entrada of readdirSync(dir)) {
    const cheio = path.join(dir, entrada)
    if (statSync(cheio).isDirectory()) {
      if (entrada.toLowerCase() !== "alt") lerPasta(cheio, porSlug)
      continue
    }
    const m = entrada.match(/^(.*?)_?([123])\.png$/i)
    if (!m) continue // config.xml e nomes fora do padrao
    const [, slug, n] = m
    if (!slug) continue
    if (!porSlug.has(slug)) porSlug.set(slug, {})
    porSlug.get(slug)[n] = cheio
  }
  return porSlug
}

const CLUBES = carregarClubes()

// As pastas vem em pares "X_-_Y/X - Y"; aceitamos as duas formas.
const pastas = []
for (const entrada of readdirSync(RAIZ)) {
  if (SOMENTE && !SOMENTE.has(entrada)) continue
  const dir = path.join(RAIZ, entrada)
  if (!existsSync(dir) || !statSync(dir).isDirectory()) continue
  const dentro = path.join(dir, entrada.replace(/_/g, " "))
  pastas.push(existsSync(dentro) && statSync(dentro).isDirectory() ? dentro : dir)
}

const porClube = new Map()
const casados = []
const ambiguos = []
const semClube = []
let arquivos = 0

for (const dir of pastas) {
  const nomeLiga = path.basename(dir)
  const chaveLiga = Object.keys(LIGAS).find((k) => nomeLiga.startsWith(k))
  const liga = LIGAS[chaveLiga]
  const slugs = lerPasta(dir)
  for (const [slug, variantes] of slugs) {
    arquivos += Object.keys(variantes).length

    let alvo = null
    if (MANUAIS.has(slug)) {
      alvo = CLUBES.find((c) => c.fileKey === MANUAIS.get(slug))
      if (!alvo) {
        console.error(`file_key inexistente no seed: "${MANUAIS.get(slug)}" (par manual de "${slug}")`)
        process.exit(1)
      }
    } else {
      const chave = chaveNome(slug)
      const cru = norm(slug)
      // A pasta diz o pais, e e por ele que o homonimo de fora cai — o jeito
      // classico de vestir o time errado. Nome CRU antes de nome sem palavra de
      // sociedade: casar por igualdade literal nao precisa de desempate.
      const exatos = porMelhorOrigem(CLUBES.filter((c) => c.cru === cru), liga)
      const validos = exatos.length ? exatos : porMelhorOrigem(CLUBES.filter((c) => c.chave === chave), liga)
      if (validos.length === 1) alvo = validos[0]
      else if (validos.length === 0) semClube.push(`${nomeLiga}: ${slug}`)
      else ambiguos.push(`${nomeLiga}: ${slug} -> ${validos.map((c) => c.fileKey).join(" | ")}`)
    }
    if (!alvo) continue

    if (porClube.has(alvo.fileKey)) {
      ambiguos.push(`${nomeLiga}: ${slug} -> ${alvo.fileKey} JA usado por outro arquivo`)
      continue
    }
    porClube.set(alvo.fileKey, { alvo, variantes, slug, liga: nomeLiga })
    casados.push(`${nomeLiga}: ${slug} -> ${alvo.nome} [${alvo.fileKey}] (${Object.keys(variantes).sort().join("+")})`)
  }
}

// ─── Recorte e pacote ────────────────────────────────────────────────────────

// ⚠️ O ENSAIO NAO CODIFICA. Sao ~700 camisas; codificar para depois jogar fora
// fazia o ensaio levar mais de dez minutos, e ensaio que demora nao e rodado —
// e justamente ele que mostra clube casado errado antes de ir para o ar.
const itens = []
if (SAIDA) {
  for (const [fileKey, { variantes }] of porClube) {
    const kits = {}
    for (const [n, caminho] of Object.entries(variantes)) {
      // ⚠️ SEM REDUZIR. A primeira versao reduzia 420 -> 256 e o resultado foi
      // reprovado na hora ("qualidade terrivel"): a listra do PSG perdia
      // saturacao e a trama de losangos virava borrao. E a REDUCAO que estraga,
      // nao o webp — a 420 com o mesmo q90 fica indistinguivel do original.
      // Custa 31 KB por camisa em vez de 15; e o orcamento da copia local em
      // lib/atualizacao-elencos foi ajustado para caber.
      const img = await sharp(caminho)
        // ⚠️ effort 4, e nao 6: nestas artes COM alfa o 6 custa 4.027 ms por
        // imagem contra 74 ms, para economizar 3% de bytes. Medido em 06/08/26.
        .webp({ quality: 90, effort: 4 })
        .toBuffer()
      kits[VARIANTE[n]] = { data: `data:image/webp;base64,${img.toString("base64")}` }
    }
    itens.push({ file_key: fileKey, kits })
  }
}

console.log(`pastas lidas      : ${pastas.length}`)
console.log(`arquivos de camisa: ${arquivos}`)
console.log(`CLUBES CASADOS    : ${casados.length}`)
for (const c of casados) console.log(`   ${c}`)
if (ambiguos.length) {
  console.log(`\nAMBIGUOS (fora do pacote) — resolva com file_key=slug:`)
  for (const a of ambiguos) console.log(`   ${a}`)
}
if (semClube.length) {
  console.log(`\nSEM CLUBE no pais desta liga (${semClube.length}):`)
  for (const s of semClube) console.log(`   ${s}`)
}

if (!SAIDA) {
  console.log(`\n${porClube.size} clubes seriam vestidos. Ensaio — nao codifiquei nada.`)
  console.log("Use --exportar <arquivo> para gravar o pacote.")
  process.exit(0)
}
const mb = itens.reduce((s, i) => s + Object.values(i.kits).reduce((a, k) => a + k.data.length, 0), 0) / 1024 / 1024
console.log(`\n${itens.length} clubes vestidos, ${mb.toFixed(1)} MB em base64`)
writeFileSync(SAIDA, JSON.stringify({ clubes: itens }), "utf-8")
console.log(`Exportado para ${SAIDA}`)
