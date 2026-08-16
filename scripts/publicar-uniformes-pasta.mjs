// Publica UNIFORMES de uma pasta pelo canal de atualizacao.
//
// Irmao de publicar-escudos-pasta.mjs e publicar-fotos-catalogo.mjs: le a pasta,
// descobre o clube e a variante pelo NOME DO ARQUIVO, converte para webp e
// exporta o pacote que o carregar-uniformes.py grava no banco da VPS.
//
// ⚠️ POR PADRAO NAO REDUZ (`--reduzir` liga os 256px). Reduzir foi reprovado
// pelo usuario; ver a nota na conversao, la embaixo.
//
//   node scripts/publicar-uniformes-pasta.mjs --pasta "C:\\...\\Portuguesa" \
//     [--clube portuguesa_bra] [--divisoes b,c,d] [--exportar uniformes.json]
//
// ⚠️ SO RODA DE UM DIRETORIO COM node_modules (C:\Ultrafoot) — o `sharp` nao
// existe no G:. Editar aqui e copiar para la, como os outros dois.
//
// ─── DUAS CONVENCOES DE NOME, porque as duas pastas reais usam uma cada ──────
//
//   "Portuguesa 1 Casa.png"  -> palavra da variante no fim
//   "abcrn_1.png" / "acgoianiense1.png" -> SLUG do clube + numero (1/2/3)
//
// A variante vem do FIM do nome nos dois casos. Sem isso a arte de fora entraria
// como principal e o clube jogaria a temporada inteira com o uniforme errado,
// sem erro nenhum.
//
// ⚠️ O SLUG NAO E O fileKey. "abcrn" e `abcrn_bra`, "oeste" e `oestesp_bra` (que
// no seed se chama "Osasco Sporting"), "novorizontino" e `novorinzontino_sp`
// (typo no proprio seed). O casamento e por CAMADAS de prova, da mais forte para
// a mais fraca, e para no primeiro nivel que devolve UM candidato:
//
//   1. fileKey inteiro           ("santos" -> `santos`)
//   2. fileKey sem o `_bra`      ("bragantino" -> `bragantino_bra`)
//   3. nome do clube (+ UF)      ("saoluizrs" -> `saoluiz_rs`)
//   4. nome sem palavra de sociedade   (o mais fraco: "ferroviaria")
//
// A camada 1 nao precisa de prova de origem; a 4 casa clubes DIFERENTES com
// facilidade ("Vitoria Sport Clube" x "Vitoria"), por isso vem por ultimo e so
// vale quando e unica. Empate em qualquer camada NAO e chutado: o clube sai no
// relatorio como ambiguo e resolve-se no MAPA_MANUAL ou com --clube.

import { readFile, readdir, writeFile } from "node:fs/promises"
import { readFileSync, statSync } from "node:fs"
import path from "node:path"
import sharp from "sharp"

const args = process.argv.slice(2)
const opt = (nome) => (args.includes(nome) ? args[args.indexOf(nome) + 1] : null)
const pasta = opt("--pasta")
const clubeForcado = opt("--clube")
const exportar = opt("--exportar")
// Divisoes pedidas (b,c,d). Vazio = todas.
const divisoesPedidas = (opt("--divisoes") ?? "").split(",").map(s => s.trim().toLowerCase()).filter(Boolean)
// Pais da pasta (ARG, ITA, ESP...). Vazio = pasta brasileira, o comportamento
// original. Ver PAISES_PASTA logo abaixo.
const paisPedido = (opt("--pais") ?? "").trim().toUpperCase()
// Subpastas contam? As ligas menores vem em grupos ("Group A", "Grupo 1
// Galicia", "Bayernliga Nord") e sem isto a pasta de cima parece vazia.
const recursivo = args.includes("--recursivo")
const RESUMO = args.includes("--resumo")
// Reduzir para 256px? Ver a nota grande na conversao — por padrao NAO reduz.
const reduzir = args.includes("--reduzir")
if (!pasta) {
  console.error('uso: node scripts/publicar-uniformes-pasta.mjs --pasta "<pasta>" [--pais ITA] [--recursivo] [--clube <fileKey>] [--divisoes b,c,d] [--resumo] [--exportar <arquivo.json>]')
  process.exit(1)
}

// Lado usado SO com `--reduzir`. 256 e o formato de public/kits-imported, que e
// o que o jogo ja desenha; a arte de origem vem em 420x420 ou ~450x560.
const LADO = 256

const RAIZ = path.resolve(import.meta.dirname, "..")

// ⚠️ SLUG QUE SO A PESSOA DECODIFICA. Sigla nao diz o nome, e adivinhar poe a
// camisa no clube errado. Cada linha aqui foi conferida a mao.
const MAPA_MANUAL = new Map(Object.entries({
  acgoianiense: "atleticogo_bra",     // Atletico Goianiense
  athparanaense: "atleticopr_bra",    // Athletico Paranaense
  atleticomineiro: "atleticomg_bra",
  alagoinhas: "atleticoalagoinhas_bra",
  novorizontino: "novorinzontino_sp", // typo no seed, nao no arquivo
  oeste: "oestesp_bra",               // no seed se chama "Osasco Sporting"
  santacruzpe: "santa",               // Santa Cruz-PE
  tremap: "ap_trem",
  juventudesamas: "juventudema_bra",  // Juventude Samas-MA
  anapolisfc: "anapolisgo_bra",
  fccascavel: "cascavel_pr",
  lagarto: "lagarto_se",              // no seed o nome virou o do estadio ("Barretão")
}))


const VARIANTES_POR_PALAVRA = [
  [/^(casa|home|principal|1)$/i, "home"],
  [/^(fora|away|visitante|reserva|2)$/i, "away"],
  [/^(terceiro|third|3)$/i, "third"],
]

/**
 * Variante + slug do clube, a partir do nome do arquivo.
 *
 * ⚠️ O NUMERO PODE VIR COLADO: "acgoianiense1.png" nao tem separador, e testar o
 * nome inteiro contra /1/ acusaria "home" em qualquer arquivo com 1 no nome.
 * Por isso o numero final e arrancado como token proprio, antes de tudo.
 *
 * ⚠️ E O QUE SOBRA AINDA PODE TER ANO: "saoluizrs_22_1.png" deixa "saoluizrs_22".
 * Dois digitos no fim, depois de underscore, sao temporada — nunca clube.
 */
function partes(arquivo) {
  const base = arquivo.replace(/\.[a-z0-9]+$/i, "")
  // O DIGITO FINAL vem primeiro, com ou sem separador — e o caso dominante
  // ("goias1.png", "abcrn_1.png"). Sem esta regra propria, um `([a-z0-9]+)$`
  // engole o nome inteiro e nenhum arquivo colado tem variante.
  let m = base.match(/^(.*?)[\s_-]*(\d)$/)
  let ultimo = m?.[2] ?? null
  if (!m) {
    // Palavra no fim, separada ("Portuguesa 1 Casa.png").
    m = base.match(/^(.*?)[\s_-]+([a-z]+)$/i)
    ultimo = m?.[2] ?? base
  }
  let variante = null
  if (m) for (const [re, v] of VARIANTES_POR_PALAVRA) if (re.test(m[2])) { variante = v; break }
  if (!variante) return { slug: null, variante: null, ultimo }
  // ⚠️ O QUE SOBRA AINDA PODE TER ANO: "saoluizrs_22_1.png" deixa "saoluizrs_22".
  // Dois digitos no fim, depois de separador, sao temporada — nunca clube.
  const slug = m[1].replace(/[\s_-]+(19|20)?\d{2}$/, "").replace(/[\s_-]+$/, "")
  return { slug: slug || m[1], variante }
}

const UFS = new Set(["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"])

const semAcento = (s) => (s ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "")
const norm = (s) => semAcento(s).toLowerCase().replace(/[^a-z0-9]/g, "")

// `--mapa arquivo.json` acrescenta pares `slug: fileKey` sem mexer no script.
// Sao ~29 pastas de liga e cada uma traz o seu punhado de slugs indecifraveis
// ("internazionale_milano", "hellas", "atalanta_bergamasca"); deixar isso no
// codigo transformaria o MAPA_MANUAL num catalogo. Chave comecada por `_` e
// comentario (JSON nao tem comentario), como no --pares dos escudos.
//
// ⚠️ A CHAVE E NAMESPACED POR PAIS (`"COL:nacional"`), e isso nao e enfeite. O
// mesmo slug quer dizer clubes diferentes em pastas diferentes: "nacional" e o
// Atlético Nacional na Colômbia e o Nacional da Madeira em Portugal;
// "fortaleza" e o Fortaleza CEIF na Colômbia e o Leão do Pici no Brasil. Um
// mapa global poria a camisa colombiana no Fortaleza — e o mapa manual e
// consultado ANTES de tudo, entao nenhuma trava posterior pegaria isso.
// Chave sem prefixo vale para qualquer pasta; use so quando o slug for unico.
//
// O valor pode ser uma LISTA: o primeiro item e o clube do pool que decide nome
// e divisao, e os demais sao chaves onde a mesma camisa tambem e publicada. E
// como se declara o gemeo curado que o casamento por nome nao acha: o pool
// chama "Liverpool Football Club" e o curado, so "Liverpool"; "Wolverhampton" e
// "Wolves" nem se parecem. Sem a chave curada, a Premier League do jogo continua
// desenhando a camisa antiga — a mesma falha silenciosa de sempre.
const CHAVES_EXTRA = new Map() // fileKey do pool -> [outras chaves]
const MAPA_EXTRA = opt("--mapa")
if (MAPA_EXTRA) {
  for (const [chave, valor] of Object.entries(JSON.parse(readFileSync(path.resolve(MAPA_EXTRA), "utf8")))) {
    if (chave.startsWith("_")) continue
    const [prefixo, slug] = chave.includes(":") ? chave.split(":") : [null, chave]
    if (prefixo && prefixo.toUpperCase() !== paisPedido) continue
    const [principal, ...extras] = Array.isArray(valor) ? valor : [valor]
    MAPA_MANUAL.set(norm(slug), String(principal))
    if (extras.length) CHAVES_EXTRA.set(String(principal), extras.map(String))
  }
}

// ⚠️ SO PALAVRA INTEIRA, e "atletico" NAO entra: no Brasil ela e o nome, e sem
// ela Atletico-GO/-MG/-PR ficam com a mesma chave. (Mesma lista do script de
// escudos, pelo mesmo motivo.)
const SOCIEDADE = new Set([
  "fc", "ac", "sc", "ec", "cf", "cd", "ca", "afc", "cfc", "ad", "sd", "ud",
  "as", "us", "ss", "aa", "clube", "club", "futebol", "esporte", "esportivo",
  "esportiva", "sociedade", "associacao", "desportivo", "desportiva",
  "recreativo", "recreativa", "de", "da", "do", "e",
])

/** Nome comparavel sem as palavras de sociedade. O hifen SEPARA palavra (o seed
 *  escreve "Botafogo-PB"); o ponto, nao ("A.C Monza"). */
function chaveNome(nome) {
  const palavras = semAcento(nome ?? "").split(/[\s\u2013-]+/)
    .map(p => p.toLowerCase().replace(/[^a-z0-9]/g, "")).filter(Boolean)
  const uteis = palavras.filter(p => !SOCIEDADE.has(p))
  return (uteis.length ? uteis : palavras).join("")
}

const seed = JSON.parse(await readFile(path.join(RAIZ, "data/seeds/imported-bf2026.json"), "utf8"))
const times = (seed.teams ?? []).filter(t => t.fileKey && t.nome)
const porFileKey = new Map(times.map(t => [t.fileKey, t]))

// ─── O CATALOGO CURADO, e por que ele decide se a camisa aparece ─────────────
//
// ⚠️ ESTE E O ERRO QUE CUSTOU UM LOTE INTEIRO. O universo de casamento e o POOL
// (imported-bf2026, ~3 mil clubes), mas quem a TELA desenha nas Series A/B/C/D
// sao os arrays CURADOS de lib/teams-data.ts — e o mesmo clube costuma existir
// nos dois, com chaves DIFERENTES: "Santa Cruz" e `santa` no pool e
// `santacruz_pe` no curado; "Trem" e `ap_trem` e `trem_ap`. Publicando so na
// chave do pool, 17 dos 83 clubes do primeiro lote receberam uma camisa que o
// jogo nunca consulta — sem erro nenhum, como sempre.
//
// O pool NAO e inutil: clube que so existe la e mostrado por essa chave mesmo
// (`completarLigaComPool`). Por isso a saida leva as DUAS chaves quando as duas
// existem, em vez de trocar uma pela outra.
const fonteCurada = await readFile(path.join(RAIZ, "lib/teams-data.ts"), "utf8")
  + "\n" + await readFile(path.join(RAIZ, "lib/international-teams.ts"), "utf8")
const curadoPorNome = new Map()
const curadoPorChave = new Map()
const chavesCuradas = new Set()
// Cada clube curado e um objeto sem chaves aninhadas — `{...}` sem `{` dentro basta.
for (const m of fonteCurada.matchAll(/\{[^{}]*\}/g)) {
  const fk = m[0].match(/file_key:\s*"([^"]+)"/)
  const nm = m[0].match(/(?:^|[\s,{])nome:\s*"([^"]+)"/) // `estadio_nome` tambem casa "nome:"
  if (!fk || !nm) continue
  chavesCuradas.add(fk[1])
  const k = norm(nm[1])
  if (!curadoPorNome.has(k)) curadoPorNome.set(k, fk[1])
  const ck = norm(fk[1])
  if (!curadoPorChave.has(ck)) curadoPorChave.set(ck, fk[1])
}

/**
 * A chave curada equivalente a este clube do pool, se houver e for outra.
 *
 * ⚠️ O NOME DO POOL SOZINHO NAO ACHA. O pool escreve "Liverpool Football Club",
 * "Tottenham Hotspur" e "Wolverhampton"; o curado escreve "Liverpool",
 * "Tottenham" e "Wolves" — e sem a chave curada a Premier League do jogo
 * continua desenhando a camisa antiga, calada. O SLUG DO ARQUIVO e a segunda
 * sonda, e e boa justamente porque a pasta usa o apelido, que e o que o catalogo
 * curado costuma guardar ("liverpool", "wolves", "brighton", "tottenham").
 */
function gemeoCurado(time, slug) {
  if (chavesCuradas.has(time.fileKey)) return null
  const g = curadoPorNome.get(norm(time.nome))
    ?? (slug ? curadoPorChave.get(norm(slug)) ?? curadoPorNome.get(norm(slug)) : null)
  return g && g !== time.fileKey ? g : null
}

// ─── Divisao ─────────────────────────────────────────────────────────────────
//
// ⚠️ O CAMPO `divisao` DO SEED NAO SERVE: TODO clube esta gravado como "Série A"
// (os 2.994). Quem sabe a divisao de 2026 e data/seeds/division_overrides_2026,
// que lista os clubes POR NOME.
const DIVISOES = JSON.parse(readFileSync(path.join(RAIZ, "data/seeds/division_overrides_2026.json"), "utf8"))
const divisaoDoNome = new Map()
for (const [chave, nomes] of Object.entries(DIVISOES)) {
  const letra = chave.replace("serie_", "")
  for (const n of nomes) divisaoDoNome.set(norm(n), letra)
}
// ⚠️ O SLUG DO ARQUIVO E A SEGUNDA CHANCE. Dezenas de clubes do pool tem o campo
// `nome` trocado pelo do estadio — `lagarto_se` se chama "Barretão" —, e como o
// override lista por nome, esses clubes cairiam como "sem divisao" e o uniforme
// deles nunca sairia, sem nada acusar. O slug do arquivo ("lagarto") acha.
const divisaoDe = (time, slug) =>
  divisaoDoNome.get(norm(time.nome)) ?? (slug ? divisaoDoNome.get(norm(slug)) ?? null : null)

// ⚠️ PROVA DE BRASILIDADE, usada SO PARA DESEMPATAR homonimo (Guarani-SP x
// Guarani do Paraguai, Portuguesa x Portuguesa da Venezuela).
//
// ⚠️ NAO SERVE DE FILTRO GERAL: o campo `pais` do seed guarda lixo em dezenas de
// clubes brasileiros ("CAXIAS", "JUVENTUDE", "FORTALEZA", "SANTA"), e exigir
// esta prova de todo mundo derrubou 16 clubes de B/C/D que estavam certos.
// Tampouco da para usar a DIVISAO como indicio de brasilidade: o override casa
// por nome e o xara paraguaio saia classificado como Serie C.
const ehBrasileiro = (t) =>
  norm(t.pais) === "brasil" || /_bra$/i.test(t.fileKey) || UFS.has((t.estado || t.pais || "").toUpperCase())

// ─── PASTA ESTRANGEIRA: prova de origem OBRIGATORIA ──────────────────────────
//
// ⚠️ TODO O CASAMENTO ACIMA FOI ESCRITO PARA UMA PASTA BRASILEIRA, e a camada 4
// ("nome sem sociedade") casa clube diferente com facilidade. Solto sobre uma
// pasta italiana, "roma1.png" acha o Roma-GO antes do Roma da Itália e a camisa
// vai para o clube errado sem erro nenhum — o mesmo tipo de falha silenciosa que
// ja custou um lote inteiro (ver a nota da chave curada).
//
// Com `--pais`, o universo e RECORTADO antes de qualquer camada: so entra clube
// com prova A FAVOR daquele pais (nome do pais no seed ou sufixo do fileKey).
// Nao e "nao contradiz" — e prova positiva, porque aqui a duvida sempre resolve
// para o brasileiro, que e o homonimo mais provavel no pool.
//
// Os valores de `pais` saem de CONSULTA ao seed, nao de chute: ele mistura nome
// por extenso ("Inglaterra"), sigla de tres ("CHN", "ARA") e de duas ("IT",
// "FR"), as vezes no mesmo pais.
const PAISES_PASTA = {
  BRA: { pais: ["brasil", "br"], sufixos: ["bra"] },
  ARG: { pais: ["argentina", "ar"], sufixos: ["arg", "ar"] },
  ITA: { pais: ["italia", "it"], sufixos: ["ita", "it"] },
  ESP: { pais: ["espanha", "es"], sufixos: ["esp"] },
  ING: { pais: ["inglaterra", "eng"], sufixos: ["ing", "eng"] },
  ALE: { pais: ["alemanha", "ger", "de"], sufixos: ["ale", "ger"] },
  FRA: { pais: ["franca", "fr"], sufixos: ["fra", "fr"] },
  POR: { pais: ["portugal", "pt"], sufixos: ["por", "pt"] },
  CHI: { pais: ["chile"], sufixos: ["chi"] },
  COL: { pais: ["colombia"], sufixos: ["col"] },
  EQU: { pais: ["equador"], sufixos: ["equ", "ecu"] },
  JAP: { pais: ["japao", "jpn"], sufixos: ["jap", "jpn"] },
  CHN: { pais: ["china", "chn"], sufixos: ["chn", "chi_na"] },
  // Ligas que entraram no lote de 15/08. O `pais` do seed e o nome por extenso
  // OU a propria sigla (ha 33 clubes com pais "ARA" e 1 com "Arabia Saudita"),
  // por isso as duas formas entram — a mesma licao do lote mundial de escudos.
  BEL: { pais: ["belgica", "bel"], sufixos: ["bel"] },
  EST: { pais: ["estonia", "est"], sufixos: ["est"] },
  FIN: { pais: ["finlandia", "fin"], sufixos: ["fin"] },
  PAR: { pais: ["paraguai", "par"], sufixos: ["par"] },
  PER: { pais: ["peru", "per"], sufixos: ["per"] },
  ARA: { pais: ["arabia saudita", "ara", "sau"], sufixos: ["ara", "sau"] },
  SUE: { pais: ["suecia", "sue"], sufixos: ["sue"] },
  URU: { pais: ["uruguai", "uru"], sufixos: ["uru"] },
}
if (paisPedido && !PAISES_PASTA[paisPedido]) {
  console.error(`--pais ${paisPedido} desconhecido. Use um de: ${Object.keys(PAISES_PASTA).join(", ")}`)
  process.exit(1)
}
const ehDoPais = (t) => {
  // ⚠️ `--pais BRA` NAO PODE SER SO A TABELA. O clube brasileiro guarda a UF em
  // `pais`/`estado` ("SP", "RS") e o fileKey termina nela (`miirassol_sp`), nao
  // em `_bra` — pela tabela, metade do Brasil ficaria de fora do proprio
  // universo. Para o Brasil vale o teste que ja existia.
  if (paisPedido === "BRA") return ehBrasileiro(t)
  const p = PAISES_PASTA[paisPedido]
  const sufixo = (t.fileKey.split("_").at(-1) ?? "").toLowerCase()
  return p.pais.includes(norm(t.pais)) || p.sufixos.includes(sufixo)
}

// ─── Camadas de casamento ────────────────────────────────────────────────────
const universo = paisPedido ? times.filter(ehDoPais) : times
if (paisPedido) {
  console.log(`Pasta de ${paisPedido}: ${universo.length} clubes do pool com prova de origem (de ${times.length}).\n`)
}

const camadas = [
  { nome: "fileKey", chave: (t) => [norm(t.fileKey)] },
  // ⚠️ ESTA CAMADA SO TIRAVA `_bra`, apesar do nome. Numa pasta estrangeira ela
  // nunca fazia nada: `malmo_sue`, `levadia_est` e `hammarby_sue` existem no
  // seed e os arquivos se chamam "malmo1.png", "levadia1.png" — a Allsvenskan
  // inteira saiu como "SEM CLUBE NO SEED" (2 clubes de 14) porque o sufixo
  // continuava colado. Tirar o sufixo DO PAIS PEDIDO (que veio do proprio seed,
  // logo acima) e a mesma prova de sempre, so que para a pasta certa.
  {
    nome: "fileKey sem pais",
    chave: (t) => {
      const sufixos = paisPedido ? PAISES_PASTA[paisPedido].sufixos : ["bra"]
      const re = new RegExp(`_(${[...sufixos, "bra"].join("|")})$`, "i")
      return [norm(t.fileKey.replace(re, ""))]
    },
  },
  {
    nome: "nome",
    chave: (t) => {
      const uf = norm(t.estado || ((t.pais ?? "").length === 2 ? t.pais : ""))
      return uf ? [norm(t.nome), norm(t.nome) + uf] : [norm(t.nome)]
    },
  },
  {
    nome: "nome sem sociedade",
    chave: (t) => {
      const uf = norm(t.estado || ((t.pais ?? "").length === 2 ? t.pais : ""))
      return uf ? [chaveNome(t.nome), chaveNome(t.nome) + uf] : [chaveNome(t.nome)]
    },
  },
  // ⚠️ ULTIMO RECURSO, E SO POR fileKey INTEIRO. O recorte por pais derruba o
  // clube cujo `pais` no seed e lixo e cujo fileKey nao tem sufixo de pais —
  // `lyon` esta gravado com pais "LYON" e `porto` com pais "Brasil", e os dois
  // sairiam da propria liga. fileKey e unico e igual por inteiro ao slug ja e
  // prova suficiente (a camada 1 nunca exigiu origem); vem por ULTIMO para que
  // qualquer casamento dentro do pais ganhe dele.
  { nome: "fileKey no pool inteiro", universo: times, chave: (t) => [norm(t.fileKey)] },
  // ⚠️ CONTENCAO, E SO DENTRO DO PAIS PEDIDO. O seed guarda o nome longo
  // ("Flora Tallinn", "Parnu JK Vaprus", "Hamburgo SV") e a pasta usa o apelido
  // ("flora", "vaprus", "hamburg"); nenhuma camada de igualdade junta os dois.
  // Aqui o slug so precisa ESTAR DENTRO do fileKey ou do nome — e por isso vem
  // por ultimo, exige 5 letras e vale apenas se devolver UM clube. Sem o
  // recorte por pais isto casaria clube de outro continente, entao fica
  // desligado quando nao ha `--pais`.
  { nome: "contido no nome (dentro do pais)", contido: true },
].map(c => {
  if (c.contido) return { ...c, mapa: new Map() }
  const mapa = new Map()
  for (const t of (c.universo ?? universo)) {
    for (const k of c.chave(t)) {
      if (!k || k.length < 3) continue
      if (!mapa.has(k)) mapa.set(k, [])
      if (!mapa.get(k).includes(t)) mapa.get(k).push(t)
    }
  }
  return { ...c, mapa }
})

/** Devolve { time } | { ambiguo: [...] } | { nada: true } */
function acharClube(slug) {
  if (clubeForcado) {
    const t = porFileKey.get(clubeForcado)
    if (!t) throw new Error(`--clube ${clubeForcado} nao existe no seed`)
    return { time: t }
  }
  const manual = MAPA_MANUAL.get(norm(slug))
  if (manual) {
    const t = porFileKey.get(manual)
    if (!t) throw new Error(`MAPA_MANUAL aponta para ${manual}, que nao existe no seed`)
    return { time: t, via: "mapa manual" }
  }
  const alvo = norm(slug)
  let ambiguo = null
  for (const camada of camadas) {
    let c
    if (camada.contido) {
      if (!paisPedido || alvo.length < 5) continue
      c = universo.filter(t => norm(t.fileKey).includes(alvo) || norm(t.nome).includes(alvo))
    } else {
      c = camada.mapa.get(alvo)
    }
    if (!c?.length) continue
    if (c.length === 1) return { time: c[0], via: camada.nome }
    // ⚠️ PASTA BRASILEIRA: homonimo estrangeiro nao e candidato. E o que separa
    // Portuguesa da Venezuela, Guarani do Paraguai e Santos Laguna. Numa pasta
    // com `--pais` esse desempate nao existe: o universo ja e so daquele pais, e
    // preferir o brasileiro seria exatamente o erro que o recorte evita.
    if (!paisPedido) {
      const br = c.filter(ehBrasileiro)
      if (br.length === 1) return { time: br[0], via: `${camada.nome} (so o brasileiro)` }
      ambiguo = ambiguo ?? (br.length ? br : c)
      continue
    }
    ambiguo = ambiguo ?? c
  }
  return ambiguo ? { ambiguo } : { nada: true }
}

// ─── Leitura da pasta ────────────────────────────────────────────────────────
//
// Com `--recursivo` os nomes vem RELATIVOS a pasta raiz ("Group A/roma_1.png").
// Quem quebra o nome so olha o basename; o caminho relativo existe para o
// relatorio e para abrir o arquivo.
async function listar(dir, prefixo = "") {
  const saida = []
  for (const item of await readdir(dir, { withFileTypes: true })) {
    const rel = prefixo ? `${prefixo}/${item.name}` : item.name
    if (item.isDirectory()) {
      if (recursivo) saida.push(...await listar(path.join(dir, item.name), rel))
      continue
    }
    if (/\.(png|jpe?g|webp)$/i.test(item.name)) saida.push(rel)
  }
  return saida
}
const arquivos = await listar(pasta)
if (arquivos.length === 0) {
  console.error("pasta sem imagem")
  process.exit(1)
}

const porClube = new Map()
const semVariante = []
const semClube = []
const ambiguos = []
const foraDaDivisao = new Map()
const duplicados = []

for (const arquivo of arquivos.sort()) {
  const { slug, variante, ultimo } = partes(path.basename(arquivo))
  if (!variante) { semVariante.push(`${arquivo}${ultimo ? ` (fim: "${ultimo}")` : ""}`); continue }

  let achado
  try {
    achado = acharClube(slug)
  } catch (e) {
    semClube.push(`${arquivo}: ${e.message}`)
    continue
  }
  if (achado.ambiguo) {
    ambiguos.push(`${slug}: ${achado.ambiguo.map(t => `${t.fileKey}[${t.nome}/${t.estado || t.pais}]`).join("  ")}`)
    continue
  }
  if (achado.nada) { semClube.push(`${arquivo} (slug "${slug}")`); continue }

  const time = achado.time
  const div = divisaoDe(time, slug)
  if (divisoesPedidas.length && !divisoesPedidas.includes(div ?? "")) {
    const chave = `${time.fileKey} [${time.nome}] — ${div ? `Serie ${div.toUpperCase()}` : "sem divisao no override"}`
    foraDaDivisao.set(chave, (foraDaDivisao.get(chave) ?? 0) + 1)
    continue
  }

  if (!porClube.has(time.fileKey)) porClube.set(time.fileKey, { time, div, via: achado.via, slug, kits: {} })
  const alvo = porClube.get(time.fileKey)
  const origem = path.join(pasta, arquivo)
  const quando = statSync(origem).mtimeMs
  const anterior = alvo.kits[variante]
  if (anterior) {
    // ⚠️ DOIS ARQUIVOS PARA A MESMA VARIANTE: a pasta tem "amazonas1.png" E
    // "amazonas_1.png", que sao o MESMO clube em temporadas diferentes (2024 e
    // 2022). Vence o mais RECENTE — a ordem alfabetica acertava por acaso,
    // porque "1" vem antes de "_" na tabela, e erraria na primeira pasta que
    // usasse outra convencao.
    const fica = quando > anterior.quando ? { arquivo, origem, quando } : anterior
    const sai = fica === anterior ? arquivo : anterior.arquivo
    duplicados.push(`${time.fileKey}/${variante}: fica "${fica.arquivo}" (${new Date(fica.quando).toISOString().slice(0, 10)}), ignorado "${sai}"`)
    alvo.kits[variante] = fica
    continue
  }
  alvo.kits[variante] = { arquivo, origem, quando }
}

// ─── Conversao ───────────────────────────────────────────────────────────────
const clubes = []
const comGemeo = []
const disputadas = []
const chavesUsadas = new Set([...porClube.keys()])
for (const { time, div, via, slug, kits } of [...porClube.values()].sort((a, b) => a.time.nome.localeCompare(b.time.nome))) {
  const saida = {}
  const linhas = []
  for (const [v, k] of Object.entries(kits)) {
    // ⚠️ POR PADRAO NAO REDUZ, e a razao e uma REPROVACAO, nao uma medicao.
    // Reduzir 420 -> 256 ja foi tentado e recusado na hora ("qualidade
    // terrivel"): a listra do PSG perde saturacao e a trama de losangos vira
    // borrao. Quem estraga e a REDUCAO, nao o webp — a 420 com o mesmo q90 fica
    // indistinguivel do original. Custa ~26 KB por camisa em vez de ~14, e o
    // orcamento da copia local em lib/atualizacao-elencos foi ajustado para
    // caber. A mesma nota esta em scripts/publicar-camisas-pasta.mjs.
    //
    // `--reduzir` existe para o rabo da tabela (Oberliga, Tercera, Serie D),
    // onde ninguem olha de perto e o que importa e caber.
    //
    // ⚠️ E O `trim()` SO VALE COM REDUCAO. Ele tira a margem transparente, que
    // varia por arquivo; sem redimensionar depois, cada camisa sairia com uma
    // dimensao diferente e a tela desenharia uma maior que a outra.
    const buf = reduzir
      ? await sharp(k.origem)
        .trim()
        .resize(LADO, LADO, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .webp({ quality: 90 })
        .toBuffer()
      // ⚠️ `effort: 4`, E NAO 6 — MEDIDO, e ha um abismo entre os dois. Nestas
      // artes (420x420 COM canal alfa) o effort 6 liga uma busca cara no plano
      // de transparencia e custa 4.027 ms por imagem contra 74 ms no 4 (54x)
      // para economizar 1 KB em 31 (3%). Em 2.208 pecas e a diferenca entre 3
      // minutos e 2,5 HORAS. Nao suba este numero sem cronometrar COM alfa.
      : await sharp(k.origem).webp({ quality: 90, effort: 4 }).toBuffer()
    saida[v] = { data: `data:image/webp;base64,${buf.toString("base64")}` }
    linhas.push(`${v} ${(buf.length / 1024).toFixed(0)}KB`)
  }
  // O gemeo achado por nome e as chaves declaradas a mao entram juntos, sem
  // repetir: as duas respondem a mesma pergunta ("que chave a tela consulta?").
  const outras = [...new Set([gemeoCurado(time, slug), ...(CHAVES_EXTRA.get(time.fileKey) ?? [])].filter(k => k && k !== time.fileKey))]
  if (!RESUMO) console.log(`  ${time.nome} (${[time.fileKey, ...outras].join(" + ")}) ${div ? "[" + div.toUpperCase() + "]" : ""}: ${linhas.join(" | ")}   ← ${via}`)
  clubes.push({ file_key: time.fileKey, kits: saida })
  // A MESMA arte na chave curada: e ela que a tela consulta nas divisoes.
  for (const chave of outras) {
    // ⚠️ DOIS CLUBES DO POOL PODEM APONTAR PARA A MESMA CHAVE CURADA (foi o caso
    // do Everton nos escudos: o de Liverpool e o de Viña del Mar). O segundo
    // sobrescreveria o primeiro em silencio; aqui ele nao entra e sai no
    // relatorio para ser decidido a mao.
    if (chavesUsadas.has(chave)) { disputadas.push(`${chave}: ja tomada; ${time.fileKey} [${time.nome}] NAO a levou`); continue }
    chavesUsadas.add(chave)
    clubes.push({ file_key: chave, kits: saida })
    comGemeo.push(`${time.fileKey} + ${chave} [${time.nome}]`)
  }
}

console.log(`\n${clubes.length} chaves (${clubes.length - comGemeo.length} clubes) | ${clubes.reduce((s, c) => s + Object.keys(c.kits).length, 0)} pecas`)
if (comGemeo.length) {
  console.log(`\nPUBLICADO NAS DUAS CHAVES — pool + curada (${comGemeo.length}):`)
  for (const g of comGemeo) console.log("  = " + g)
}
if (disputadas.length) { console.log("\nCHAVE CURADA DISPUTADA por mais de um clube:"); for (const d of disputadas) console.log("  ! " + d) }
if (duplicados.length) { console.log("\nARQUIVO REPETIDO PARA A MESMA VARIANTE:"); for (const d of duplicados) console.log("  ! " + d) }
if (ambiguos.length) { console.log("\nAMBIGUO (resolva no MAPA_MANUAL ou com --clube):"); for (const a of ambiguos) console.log("  ? " + a) }
if (semClube.length) { console.log("\nSEM CLUBE NO SEED:"); console.log("  " + semClube.join("\n  ")) }
if (semVariante.length) { console.log("\nSEM VARIANTE RECONHECIVEL:"); console.log("  " + semVariante.join("\n  ")) }
if (foraDaDivisao.size) {
  console.log(`\nFORA DAS DIVISOES PEDIDAS (${divisoesPedidas.join(",")}): ${foraDaDivisao.size} clubes`)
  for (const [k, n] of foraDaDivisao) console.log(`  - ${k} (${n} arquivos)`)
}

if (!exportar) {
  console.log("\nEnsaio. Use --exportar <arquivo> para gravar o pacote.")
} else {
  await writeFile(path.resolve(exportar), JSON.stringify({ clubes }, null, 1), "utf8")
  console.log(`\nExportado para ${path.resolve(exportar)}`)
}
