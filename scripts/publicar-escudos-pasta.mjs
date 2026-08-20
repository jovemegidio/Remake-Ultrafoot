// PREPARA ESCUDOS DE UMA PASTA PARA O CANAL DE ATUALIZACAO.
//
//   node scripts/publicar-escudos-pasta.mjs --pasta "C:/Users/.../Escudos" \
//     --exportar escudos.json  [ saoraimundo_pa="São Raimundo - BRA" ... ]
//
// Irmao do publicar-fotos-catalogo.mjs, para a outra metade da atualizacao: la e
// o rosto do atleta, aqui e o escudo do clube. A saida e o mesmo tipo de pacote
// que o carregador da VPS consome — `{ clubes: [{ file_key, escudo_data }] }`.
//
// Nao confundir com import-escudos-pasta.mjs: aquele grava em public/escudos e
// so vale na PROXIMA build. Este publica pelo canal, e chega a quem ja instalou.
//
// ⚠️ RODE DE UM DIRETORIO COM node_modules (C:\Ultrafoot). O `sharp` nao existe
// no G: (o Google Drive corrompe o node_modules), e sem ele nao ha como reduzir
// os 500x500 originais.
//
// ⚠️ ARQUIVO SEM EXTENSAO CONTA. Quatro dos 23 escudos do primeiro lote vieram
// sem `.png` no nome (o download perdeu a extensao). Filtrar por extensao
// deixaria Brasiliense, Juventus Jaragua, Real Noroeste e Sao Raimundo de fora e
// o relatorio nem os mencionaria. Aqui o filtro e a ASSINATURA do arquivo.
//
// O CASAMENTO, e por que ele recusa em vez de chutar:
//   * nome do arquivo e `Nome do Clube - SUFIXO`, onde o sufixo e UF (RJ, PE) ou
//     pais (BRA, ITA);
//   * palavras de sociedade (FC, AC, SC, EC, Calcio, Clube...) caem dos DOIS
//     lados antes de comparar — e o que junta "A.C Monza" com "Monza",
//     "UDINESE Calcio" com "Udinese" e "Amazonas" com "Amazonas FC";
//   * mais de um clube com o mesmo nome e AMBIGUIDADE, nao empate: o arquivo e
//     recusado e precisa de um par `file_key="nome do arquivo"` na linha de
//     comando. Escudo errado e pior do que escudo faltando — ja aconteceu de o
//     escudo do Santos Laguna ir parar na Vila Belmiro.

import { readFileSync, writeFileSync, readdirSync, statSync } from "node:fs"
import path from "node:path"
import sharp from "sharp"

const RAIZ = path.resolve(import.meta.dirname, "..")
const LADO = 256 // maior tamanho que qualquer tela do jogo usa (TeamCrest vai a 176)

const arg = nome => {
  const i = process.argv.indexOf(nome)
  return i >= 0 ? process.argv[i + 1] : ""
}

const PASTA = arg("--pasta")
const SAIDA = arg("--exportar")

if (!PASTA) {
  console.error('uso: --pasta "caminho" [--exportar saida.json] [--pares pares.json] [file_key="arquivo"]')
  process.exit(1)
}

// Pares `file_key=arquivo` resolvem a mao o que o casamento automatico recusou.
//
// ⚠️ ACIMA DE UMA DUZIA, USE `--pares pares.json`. Sao ~125 pares hoje, e metade
// tem acento nos dois lados ("Águia - Pará.png" -> `aguiapa_bra`,
// "Curicó Unido" , a chave `operário_por`): o console do Windows entrega esses
// bytes em CP1252 e o par simplesmente NAO casa com o nome do arquivo — sem
// erro, o escudo so nao aparece no pacote. O JSON e lido como UTF-8 e nao passa
// pelo shell. Formato: { "file_key": "Arquivo.png", ... }
//
// ⚠️ E PRECISA HAVER COMO DIZER "ESTE ARQUIVO NAO VAI" (`_excluir`). A pasta tem
// segunda arte do mesmo clube ("S.D Eibar" e "SD Eibar") e homonimo de outro
// pais que o seed nao tem ("Al-Faisaly SC" e o de Amman, o do seed e o saudita):
// os dois caem na mesma chave e a trava de duplicado derruba OS DOIS. Sem lista
// de exclusao nao ha como ficar com um — o clube acaba sem escudo nenhum.
const MANUAIS = new Map()
const EXCLUIDOS = new Set()
const PARES = arg("--pares")
if (PARES) {
  for (const [fk, arquivo] of Object.entries(JSON.parse(readFileSync(PARES, "utf-8")))) {
    if (fk === "_excluir") { for (const f of arquivo) EXCLUIDOS.add(String(f).trim()); continue }
    // Chave com `_` na frente e comentario: e onde fica registrado COMO cada
    // grupo de pares foi decidido, que e a parte que nao da para reconstruir
    // depois. JSON nao tem comentario; isto e o substituto.
    if (fk.startsWith("_")) continue
    MANUAIS.set(String(arquivo).trim(), fk.trim())
  }
}
for (const a of process.argv.slice(2)) {
  if (a.startsWith("--") || !a.includes("=")) continue
  const i = a.indexOf("=")
  MANUAIS.set(a.slice(i + 1).trim(), a.slice(0, i).trim())
}

// ─── Normalizacao ────────────────────────────────────────────────────────────

const semAcento = s => (s ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "")
const norm = s => semAcento(s).toLowerCase().replace(/[^a-z0-9]/g, "")

// ⚠️ SO PALAVRA INTEIRA. Tirar "sc" de dentro do nome mutilaria Fluminense; o
// que cai e o token isolado ("Amazonas FC" -> "Amazonas"), nunca um pedaco.
//
// ⚠️ "ATLETICO" NAO ENTRA AQUI, por mais que pareca palavra de sociedade. No
// Brasil ela e o nome: tirando-a, "Atletico-GO" viraria so "go" e deixaria de
// casar com o arquivo "AtleticoGO" — e, pior, Atletico-MG, -GO e -PR ficariam
// com a mesma chave.
//
// ⚠️ A LISTA E MULTILINGUE PORQUE A PASTA E. "Club de Deportes Iquique",
// "Clube Desportivo Nacional", "Sivasspor Kulübü", "Sport Clube Beira-Mar": sem
// derrubar essas palavras, 160 clubes que EXISTEM no jogo saiam como "sem clube
// no seed", porque o seed guarda so "Iquique", "Nacional", "Sivasspor".
const SOCIEDADE = new Set([
  "fc", "ac", "sc", "ec", "cf", "cd", "ca", "afc", "cfc", "sac", "ad", "sd",
  "ud", "cdr", "gdr", "sad", "as", "us", "ss", "aa",
  "calcio", "club", "clube", "futebol", "futbol", "football", "esporte",
  "esportivo", "esportiva", "sociedade", "associacao",
  "deportes", "deportivo", "deportiva", "desportivo", "desportiva", "desportos",
  "social", "recreativa", "recreativo", "sporting", "sport", "kulubu", "spor",
  "de", "da", "do", "del", "y", "e",
])

/**
 * Nome comparavel: sem acento, sem pontuacao e sem palavra de sociedade.
 *
 * ⚠️ A PONTUACAO CAI DENTRO DA PALAVRA, nao separa palavra. Quebrar em `.`
 * transformava "A.C Monza" em tres tokens ("a", "c", "monza"), nenhum deles a
 * sigla `ac` da lista — e o Monza saia como "sem clube no seed".
 *
 * ⚠️ MAS O HIFEN SEPARA. O seed escreve "Independencia-AC" e o arquivo,
 * "Independencia AC": sem quebrar no hifen, um vira "independenciaac" e o outro
 * "independencia". Quebrar tambem nao junta clubes distintos — "Botafogo-PB"
 * continua "botafogopb", diferente de "botafogo", porque UF nao e palavra de
 * sociedade e nunca cai.
 */
function chaveNome(nome) {
  const palavras = semAcento(nome ?? "")
    .split(/[\s–-]+/)
    .map(p => p.toLowerCase().replace(/[^a-z0-9]/g, ""))
    .filter(Boolean)
  const uteis = palavras.filter(p => !SOCIEDADE.has(p))
  // Nome que SO tem palavra de sociedade (raro, mas existe): melhor comparar o
  // nome cheio do que uma chave vazia, que casaria com qualquer outro vazio.
  return (uteis.length ? uteis : palavras).join("")
}

const UFS = new Set(["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"])

// Sufixo de pais no nome do arquivo -> como o pais aparece no seed. Serve de
// VALIDACAO, nao de desempate: um nome que casou mas mora em outro pais e um
// homonimo, e homonimo e o jeito mais comum de colar o escudo errado.
const PAISES = {
  BRA: { pais: ["brasil"], sufixos: ["bra"] },
  ITA: { pais: ["italia"], sufixos: ["ita", "it"] },
  ARG: { pais: ["argentina"], sufixos: ["arg"] },
  POR: { pais: ["portugal"], sufixos: ["por", "pt"] },
  ING: { pais: ["inglaterra"], sufixos: ["ing", "eng"] },
  ESP: { pais: ["espanha"], sufixos: ["esp"] },
  ALE: { pais: ["alemanha"], sufixos: ["ale", "ger"] },
  FRA: { pais: ["franca"], sufixos: ["fra"] },
  HOL: { pais: ["holanda"], sufixos: ["hol", "ned"] },
  EUA: { pais: ["estados unidos"], sufixos: ["eua"] },
  MEX: { pais: ["mexico"], sufixos: ["mex"] },
  URU: { pais: ["uruguai"], sufixos: ["uru"] },
  COL: { pais: ["colombia"], sufixos: ["col"] },
  CHI: { pais: ["chile"], sufixos: ["chi"] },
  PAR: { pais: ["paraguai"], sufixos: ["par"] },
  BOL: { pais: ["bolivia"], sufixos: ["bol"] },
  EQU: { pais: ["equador"], sufixos: ["equ"] },
  VEN: { pais: ["venezuela"], sufixos: ["ven"] },
  // ⚠️ O SEED NAO USA O MESMO CODIGO DO ARQUIVO. Arabia Saudita e `ARA` no
  // campo `pais` (o arquivo diz ARB) e Cazaquistao e `CAZ` (o arquivo diz KAZ);
  // varios paises guardam o nome por extenso e outros a sigla. Por isso cada
  // entrada aceita as DUAS formas, e os valores abaixo saem de consulta ao
  // proprio seed, nao de chute.
  ARB: { pais: ["ara"], sufixos: ["ara"] },
  TUR: { pais: ["turquia"], sufixos: ["tur"] },
  GRE: { pais: ["grecia"], sufixos: ["gre"] },
  CYP: { pais: ["cyp"], sufixos: ["cyp"] },
  KAZ: { pais: ["caz"], sufixos: ["caz"] },
  AZE: { pais: ["azb"], sufixos: ["aze", "azb"] },
  NOR: { pais: ["noruega"], sufixos: ["nor"] },
  DEN: { pais: ["dinamarca", "den"], sufixos: ["den"] },
  CZE: { pais: ["cze"], sufixos: ["cze"] },
  PER: { pais: ["peru"], sufixos: ["per"] },
  RUS: { pais: ["russia"], sufixos: ["rus"] },
  SUI: { pais: ["suica"], sufixos: ["sui"] },
  BEL: { pais: ["belgica"], sufixos: ["bel"] },
  AUT: { pais: ["austria"], sufixos: ["aut"] },
  SUE: { pais: ["suecia"], sufixos: ["sue"] },
  UCR: { pais: ["ucrania"], sufixos: ["ucr"] },
  ESC: { pais: ["escocia"], sufixos: ["esc"] },
  CRO: { pais: ["croacia"], sufixos: ["cro"] },
  SER: { pais: ["servia"], sufixos: ["ser", "srb"] },
  // ⚠️ O SUFIXO QUE O ARQUIVO USA TAMBEM PRECISA SER CHAVE AQUI. A tabela e
  // consultada pelo texto depois do tracinho: `EQU` existia, mas a pasta escreve
  // `ECU`, e por isso "Aucas - ECU.png" virava o clube "Aucas - ECU" — 15
  // equatorianos que EXISTEM no seed sairam como "sem clube", sem erro nenhum.
  ECU: { pais: ["equador"], sufixos: ["equ", "ecu"] },
  CHILE: { pais: ["chile"], sufixos: ["chi"] },
  CROACIA: { pais: ["croacia"], sufixos: ["cro"] },
}

/** "A.C Monza - ITA.png" -> { nome: "A.C Monza", sufixo: "ITA" } */
function partesDoArquivo(arquivo) {
  const base = arquivo.replace(/\.(png|webp|jpg|jpeg)$/i, "")
  // ⚠️ O SUFIXO NEM SEMPRE E SIGLA. A pasta tambem escreve o pais por extenso
  // ("- CHILE", "- Croacia"), e com o limite de 4 letras esses arquivos ficavam
  // com o pais grudado no nome do clube ("Dinamo Zagreb - Croacia"). Abrir o
  // limite nao afrouxa nada: o token so vale se for uma UF ou uma chave da
  // tabela PAISES, que continua sendo a trava.
  const m = base.match(/^(.*?)\s*-\s*([A-Za-z]{2,10})$/)
  if (m) {
    const suf = m[2].toUpperCase()
    if (UFS.has(suf) || PAISES[suf]) return { nome: m[1].trim(), sufixo: suf }
  }
  return { nome: base.trim(), sufixo: null }
}

// ─── Universo de clubes ──────────────────────────────────────────────────────
//
// ⚠️ NAO E O lib/teams-data.ts (que o publicar-fotos-catalogo usa): la moram 79
// clubes, e 20 dos 23 escudos deste lote nao estao entre eles. O universo de
// verdade e o seed importado, com quase 3 mil clubes.
//
// ⚠️ O CAMPO `pais` NEM SEMPRE E UM PAIS. Nos clubes vindos do pool ele carrega
// a UF ("GO", "SE") e as vezes lixo do proprio arquivo ("SANTACRUZRN", "TREM").
// Por isso a validacao aceita tres provas de origem — pais, UF e sufixo do
// file_key — e so REJEITA quando alguma delas contradiz.
function clubes() {
  const seed = JSON.parse(readFileSync(path.join(RAIZ, "data/seeds/imported-bf2026.json"), "utf-8"))
  const lista = []
  for (const t of seed.teams ?? []) {
    const fileKey = t.fileKey ?? t.file_key
    if (!fileKey || !t.nome) continue
    lista.push({
      fileKey,
      nome: t.nome,
      chave: chaveNome(t.nome),
      // Nome sem palavra derrubada: e ele que dispensa a prova de origem.
      cru: norm(t.nome),
      pais: t.pais ?? "",
      estado: t.estado ?? "",
      sufixo: (fileKey.split("_").at(-1) ?? "").toLowerCase(),
    })
  }
  return lista
}

// ─── O CATALOGO CURADO, e por que ele decide se o escudo aparece ─────────────
//
// ⚠️ MESMO ERRO QUE JA ANULOU 17 UNIFORMES (ver publicar-uniformes-pasta.mjs).
// O universo de casamento aqui e o POOL, mas quem a TELA desenha nas Series
// A/B/C/D sao os arrays CURADOS de lib/teams-data.ts — e o mesmo clube costuma
// existir nos dois com chaves DIFERENTES ("Santa Cruz" e `santa` no pool e
// `santacruz_pe` no curado). Publicando so na chave do pool, o escudo vai para
// uma chave que o jogo nunca consulta, sem erro nenhum.
//
// O pool NAO e inutil: clube que so existe la e desenhado por essa chave mesmo
// (`completarLigaComPool`). Por isso a saida leva as DUAS chaves.
// ⚠️ OS DOIS CATALOGOS SAO LIDOS SEPARADAMENTE, e nao concatenados, porque
// a ORIGEM do clube curado e a unica prova de pais que existe para metade
// deles: `lib/teams-data.ts` e o catalogo BRASILEIRO e seus clubes nao tem
// campo `pais` nenhum (o Guarani de Campinas se chama so "Guarani" e nada no
// objeto diz Brasil), enquanto `lib/international-teams.ts` traz `pais`.
// Sem essa distincao o escudo do Guarani do PARAGUAI era publicado tambem na
// chave do Guarani de Campinas — e como o canal vence o embutido, apagava da
// tela o escudo certo, que viaja dentro da build.
const CATALOGOS = [
  { arquivo: "lib/teams-data.ts", brasileiro: true },
  { arquivo: "lib/international-teams.ts", brasileiro: false },
]
const curadoPorNome = new Map()
const chavesCuradas = new Set()
// Cada clube curado e um objeto sem chaves aninhadas — `{...}` sem `{` dentro basta.
for (const catalogo of CATALOGOS) {
  const fonte = readFileSync(path.join(RAIZ, catalogo.arquivo), "utf-8")
  for (const m of fonte.matchAll(/\{[^{}]*\}/g)) {
  const fk = m[0].match(/file_key:\s*"([^"]+)"/)
  const nm = m[0].match(/(?:^|[\s,{])nome:\s*"([^"]+)"/) // `estadio_nome` tambem casa "nome:"
  if (!fk || !nm) continue
  chavesCuradas.add(fk[1])
  const k = norm(nm[1])
  const pais = m[0].match(/(?:^|[\s,{])pais:\s*"([^"]+)"/)
  if (!curadoPorNome.has(k)) curadoPorNome.set(k, { fileKey: fk[1], pais: pais?.[1] ?? "", brasileiro: catalogo.brasileiro })
  }
}

/** A chave curada equivalente a este clube do pool, se houver e for outra. */
function gemeoCurado(alvo) {
  if (chavesCuradas.has(alvo.fileKey)) return null
  const g = curadoPorNome.get(norm(alvo.nome))
  return g && g.fileKey !== alvo.fileKey ? g : null
}

/**
 * O clube do pool e o curado sao do MESMO pais?
 *
 * ⚠️ SO SERVE PARA DESEMPATAR COLISAO. "Everton" existe duas vezes no pool
 * (`everton_ing` e `everton_chi`) e as duas caem no MESMO curado `everton`, que
 * e o de Goodison Park. Sem desempate, quem entrasse por ultimo no laco ficava
 * com a chave — e o escudo do Everton de Viña del Mar apareceria na Premier
 * League, sem erro nenhum. Comparo o sufixo do fileKey do pool com o `pais` do
 * curado pela mesma tabela PAISES que a validacao de origem ja usa.
 */
function mesmoPais(alvo, curado) {
  if (!curado.pais) return false
  const alvoPais = norm(curado.pais)
  for (const { pais, sufixos } of Object.values(PAISES)) {
    if (!pais.some(p => norm(p) === alvoPais)) continue
    return sufixos.includes(alvo.sufixo)
  }
  return false
}

/**
 * O pais do clube do pool CONTRADIZ o do curado?
 *
 * ⚠️ `mesmoPais` acima so era consultado quando DOIS clubes do pool disputavam
 * a mesma chave curada. Com um candidato so, o gemeo era dado sem conferir
 * nada — e foi assim que o escudo do Guarani do PARAGUAI foi publicado tambem
 * em `guaranisp_bra`, que e o Guarani de Campinas (o curado se chama so
 * "Guarani"). O clube brasileiro tem escudo embutido correto, e o canal vence
 * o embutido: publicar ali APAGA o certo da tela.
 *
 * Diferente de `mesmoPais`, aqui a ausencia de prova NAO reprova: chave do
 * pool com sufixo de UF (`santacruz_pe`) ou sem sufixo nenhum e o caso comum
 * do gemeo legitimo. So reprova quando o sufixo e de OUTRO pais conhecido.
 */
function contradizPaisDoCurado(alvo, curado) {
  const doAlvoQualquer = Object.entries(PAISES).find(([, v]) => v.sufixos.includes(alvo.sufixo))
  // Curado do catalogo BRASILEIRO nao tem campo `pais`: a prova e a origem do
  // arquivo. Chave do pool com sufixo de pais estrangeiro contradiz.
  if (!curado.pais) return Boolean(curado.brasileiro && doAlvoQualquer && doAlvoQualquer[0] !== "BRA")
  const doCurado = Object.entries(PAISES).find(([, v]) => v.pais.some(x => norm(x) === norm(curado.pais)))
  if (!doCurado) return false
  if (doCurado[1].sufixos.includes(alvo.sufixo)) return false
  return Boolean(doAlvoQualquer && doAlvoQualquer[0] !== doCurado[0])
}

/** O sufixo do arquivo CONTRADIZ a origem deste clube? */
function contradiz(clube, sufixo) {
  if (!sufixo) return false

  if (UFS.has(sufixo)) {
    const uf = (clube.estado || clube.pais || "").toUpperCase()
    // UF desconhecida nao contradiz nada — boa parte do pool nao guarda estado.
    if (!UFS.has(uf)) return false
    return uf !== sufixo
  }

  const alvo = PAISES[sufixo]
  if (!alvo) return false
  const pais = norm(clube.pais)
  if (alvo.pais.some(p => pais === norm(p))) return false
  if (alvo.sufixos.includes(clube.sufixo)) return false
  // Clube brasileiro do pool guarda a UF no campo `pais`; para BRA isso confirma.
  if (sufixo === "BRA" && UFS.has((clube.pais || "").toUpperCase())) return false
  // Sem prova a favor, so rejeito se houver prova CONTRA: outro pais reconhecido.
  const outro = Object.values(PAISES).some(p =>
    p !== alvo && (p.pais.some(n => pais === norm(n)) || p.sufixos.includes(clube.sufixo)))
  return outro
}

/**
 * Quanta prova A FAVOR o sufixo do arquivo da para este clube.
 *   2 = a UF bate exatamente
 *   1 = o pais bate (e a UF do arquivo implica Brasil)
 *   0 = nada prova nem desmente
 *  -1 = o sufixo CONTRADIZ
 */
function prova(clube, sufixo) {
  if (contradiz(clube, sufixo)) return -1
  if (!sufixo) return 0

  if (UFS.has(sufixo)) {
    if ((clube.estado || "").toUpperCase() === sufixo) return 2
    if ((clube.pais || "").toUpperCase() === sufixo) return 2
    // UF no arquivo quer dizer clube BRASILEIRO — e isso ja separa o Boavista
    // do Rio do Boavista do Porto.
    if (norm(clube.pais) === "brasil" || clube.sufixo === "bra") return 1
    return 0
  }

  const alvo = PAISES[sufixo]
  if (!alvo) return 0
  if (alvo.pais.some(p => norm(clube.pais) === norm(p))) return 1
  if (alvo.sufixos.includes(clube.sufixo)) return 1
  // Clube brasileiro do pool guarda a UF no campo `pais` ("AM", "SE"): para
  // BRA isso e prova a favor, nao ausencia de prova.
  if (sufixo === "BRA" && UFS.has((clube.pais || "").toUpperCase())) return 1
  return 0
}

/** Fica so com quem tem a MAIOR prova a favor — e ninguem, se todos contradizem. */
function porMaiorProva(candidatos, sufixo) {
  const comNota = candidatos.map(c => ({ c, n: prova(c, sufixo) })).filter(x => x.n >= 0)
  if (!comNota.length) return []
  const max = Math.max(...comNota.map(x => x.n))
  return comNota.filter(x => x.n === max).map(x => x.c)
}

// ─── Leitura da pasta ────────────────────────────────────────────────────────

const ASSINATURAS = [
  { tipo: "image/png", mime: "png", bytes: [0x89, 0x50, 0x4e, 0x47] },
  { tipo: "image/jpeg", mime: "jpg", bytes: [0xff, 0xd8, 0xff] },
  { tipo: "image/webp", mime: "webp", bytes: [0x52, 0x49, 0x46, 0x46] },
]

function ehImagem(caminho) {
  if (!statSync(caminho).isFile()) return false
  const cabeca = readFileSync(caminho).subarray(0, 4)
  return ASSINATURAS.some(a => a.bytes.every((b, i) => cabeca[i] === b))
}

const CLUBES = clubes()
const arquivos = readdirSync(PASTA).filter(f => ehImagem(path.join(PASTA, f)))

const itens = []
const casados = []
const comGemeo = []
const disputados = []
const ambiguos = []
const semClube = []
const contraditos = []
const duplicados = []

// ─── Primeiro passe: so resolve o clube de cada arquivo ──────────────────────
//
// Separado do recorte de propriedade: com 442 arquivos, redimensionar antes de
// saber que dois deles disputam o mesmo clube seria trabalho jogado fora — e,
// pior, o segundo sobrescreveria o primeiro em silencio no pacote.
const resolvidos = []
const excluidos = []
for (const arquivo of arquivos) {
  if (EXCLUIDOS.has(arquivo)) { excluidos.push(arquivo); continue }
  const { nome, sufixo } = partesDoArquivo(arquivo)

  if (MANUAIS.has(arquivo)) {
    const fk = MANUAIS.get(arquivo)
    const alvo = CLUBES.find(c => c.fileKey === fk)
    if (!alvo) {
      console.error(`file_key inexistente no seed: "${fk}" (par manual de "${arquivo}")`)
      process.exit(1)
    }
    resolvidos.push({ arquivo, alvo, sufixo, manual: true })
    continue
  }

  // ⚠️ O CLUBE CUJO NOME JA TRAZ A UF VENCE, E VEM ANTES DE TUDO.
  //
  // Isto custou o escudo do Flamengo. "Flamengo - PI.png" foi lido como
  // nome="Flamengo" + sufixo="PI", e o unico clube chamado "Flamengo" no pool e
  // o `flarj`, do Rio. O sufixo PI nao o CONTRADIZ (o seed nao guarda UF para
  // ele), entao a regra de origem aprovou — e o Flamengo do Rio passou a
  // ostentar o escudo do Flamengo do Piaui, publicado e conferido no ar.
  //
  // Mas `flamengopi_bra` ("Flamengo PI") existe no pool, e sempre existiu: la a
  // UF faz parte do NOME. Comparar o nome do arquivo COM o sufixo colado acha
  // esse clube de primeira, e isso e prova muito mais forte do que "ninguem
  // desmentiu". Vale para os 7 casos da pasta — Fluminense-PI, Juventus-SP,
  // Porto-PE, Sampaio Corrêa-RJ, São José-SP e Vitória-PE eram os outros, e
  // todos precisavam de par manual justamente por isto.
  if (sufixo) {
    const comUf = CLUBES.filter(c => c.cru === norm(nome + sufixo))
    if (comUf.length === 1) {
      resolvidos.push({ arquivo, alvo: comUf[0], sufixo, manual: false, viaUf: true })
      continue
    }
  }

  const chave = chaveNome(nome)
  // ⚠️ DERRUBAR PALAVRA DE SOCIEDADE APROXIMA CLUBES DIFERENTES. "Vitória Sport
  // Clube" (Guimarães) vira "vitoria" e cai em cima do Vitória do Barradão —
  // que no seed se chama so "Vitória", entao a igualdade e legitima pela regra e
  // ainda assim e outro clube. Nao deu escudo errado por sorte: o arquivo com UF
  // venceu o desempate de duplicados.
  //
  // A trava: um casamento que SO existiu porque palavras cairam precisa de PROVA
  // a favor da origem (o pais/UF do arquivo batendo com o do clube). Casamento
  // que ja valia com o nome cru nao precisa de nada — e o proprio nome.
  const cru = norm(nome)
  const mesmoNome = CLUBES.filter(c =>
    c.chave === chave && (c.cru === cru || prova(c, sufixo) >= 1))
  // ⚠️ PROVA A FAVOR VENCE AUSENCIA DE PROVA CONTRA. Antes eu so descartava quem
  // o sufixo CONTRADIZ, e sobrava empate onde a sigla ja dizia tudo: "BoaVista -
  // RJ" ficava entre o brasileiro e o portugues, e "Deportes Santa Cruz - CHI"
  // entrava na briga do Santa Cruz de Pernambuco. Entre um clube que BATE com a
  // sigla e outro que apenas nao a contradiz, o primeiro ganha.
  const validos = porMaiorProva(mesmoNome, sufixo)
  if (validos.length === 1) resolvidos.push({ arquivo, alvo: validos[0], sufixo, manual: false })
  else if (mesmoNome.length === 0) semClube.push(arquivo)
  else if (validos.length === 0) contraditos.push(`${arquivo} (${mesmoNome.map(c => c.fileKey).join(", ")})`)
  else ambiguos.push(`${arquivo} -> ${validos.map(c => `${c.fileKey} (${c.nome})`).join(" | ")}`)
}

// ─── Dois arquivos para o mesmo clube ────────────────────────────────────────
//
// ⚠️ ACONTECE, E ANTES PASSAVA DESPERCEBIDO: a pasta tem "Amazonas - BRA.png" e
// "Amazonas.png", "CRB - BRA.png" e "CRB.png", "Marcilio Dias - BRA.png" e
// "- SC.png". Sem tratamento, os dois entram no pacote com o mesmo file_key e
// vale o ULTIMO — escolha ao acaso da ordem alfabetica.
//
// Quando os bytes sao iguais, nao ha o que decidir. Quando diferem, vence o
// sufixo MAIS ESPECIFICO (UF > pais > nenhum), porque quem escreveu a UF sabia
// de qual dos homonimos estava falando. Empate de especificidade nao e
// desempatavel por regra nenhuma: os dois ficam de fora e aparecem no relatorio.
const forca = s => (!s ? 0 : UFS.has(s) ? 2 : 1)
const porClube = new Map()
for (const r of resolvidos) {
  if (!porClube.has(r.alvo.fileKey)) porClube.set(r.alvo.fileKey, [])
  porClube.get(r.alvo.fileKey).push(r)
}

const escolhidos = []
for (const [fileKey, lista] of porClube) {
  if (lista.length === 1) { escolhidos.push(lista[0]); continue }
  const bytes = lista.map(r => readFileSync(path.join(PASTA, r.arquivo)))
  const iguais = bytes.every(b => b.equals(bytes[0]))
  if (iguais) {
    escolhidos.push(lista[0])
    duplicados.push(`${fileKey}: ${lista.map(r => r.arquivo).join(" = ")} (identicos, usei o primeiro)`)
    continue
  }
  const max = Math.max(...lista.map(r => forca(r.sufixo)))
  const melhores = lista.filter(r => forca(r.sufixo) === max)
  if (melhores.length === 1) {
    escolhidos.push(melhores[0])
    duplicados.push(`${fileKey}: usei "${melhores[0].arquivo}" (sufixo mais especifico); ignorei ${lista.filter(r => r !== melhores[0]).map(r => `"${r.arquivo}"`).join(", ")}`)
  } else {
    duplicados.push(`⚠️ ${fileKey}: ${melhores.map(r => `"${r.arquivo}"`).join(" x ")} — imagens DIFERENTES e mesma especificidade, NENHUM publicado`)
  }
}

// ─── Gemeo curado: um por chave, e so com prova de origem quando ha disputa ──
//
// Dois clubes do pool podem reivindicar a MESMA chave curada (o caso Everton).
// Resolvo antes de gravar qualquer coisa: com disputa, so leva a chave quem for
// do mesmo pais do curado; se ninguem for, ou se mais de um for, ninguem leva e
// o caso sai no relatorio.
const reivindicacoes = new Map()
for (const e of escolhidos) {
  const g = gemeoCurado(e.alvo)
  if (!g) continue
  if (!reivindicacoes.has(g.fileKey)) reivindicacoes.set(g.fileKey, { curado: g, candidatos: [] })
  reivindicacoes.get(g.fileKey).candidatos.push(e)
}
const gemeoDe = new Map() // fileKey do pool -> chave curada aprovada
for (const [chave, { curado, candidatos }] of reivindicacoes) {
  if (candidatos.length === 1) {
    const unico = candidatos[0]
    if (contradizPaisDoCurado(unico.alvo, curado)) {
      disputados.push(`⚠️ ${chave}: NAO recebeu o escudo de ${unico.alvo.fileKey} — o curado e de "${curado.pais}" e a chave do pool e de outro pais`)
      continue
    }
    gemeoDe.set(unico.alvo.fileKey, chave)
    continue
  }
  const doPais = candidatos.filter(c => mesmoPais(c.alvo, curado))
  if (doPais.length === 1) {
    gemeoDe.set(doPais[0].alvo.fileKey, chave)
    disputados.push(`${chave}: ficou com ${doPais[0].alvo.fileKey} (mesmo pais do curado, "${curado.pais}"); fora ${candidatos.filter(c => c !== doPais[0]).map(c => c.alvo.fileKey).join(", ")}`)
  } else {
    disputados.push(`⚠️ ${chave}: disputada por ${candidatos.map(c => c.alvo.fileKey).join(" x ")} sem desempate por pais — NENHUM levou a chave curada`)
  }
}

// ─── Segundo passe: recorte e base64 ─────────────────────────────────────────
for (const { arquivo, alvo, manual } of escolhidos) {
  // `contain` com fundo transparente: escudo nao e quadrado, e esticar ou cortar
  // deforma.
  //
  // ⚠️ PNG PALETIZADO, E ISSO FOI MEDIDO. Tentei webp sem perda achando que
  // encolheria a copia local (que no app e a unica coisa que aparece, e vive
  // dentro do save de 60 MB): saiu MAIOR — 11,3 MB contra 9,5 MB nos mesmos 388
  // escudos. Estes escudos sao monocromaticos e de area chapada, exatamente o
  // caso em que a paleta do PNG ganha. Nao troque sem medir de novo.
  const png = await sharp(path.join(PASTA, arquivo))
    .resize(LADO, LADO, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png({ compressionLevel: 9, palette: true })
    .toBuffer()

  const dataUrl = `data:image/png;base64,${png.toString("base64")}`
  itens.push({ file_key: alvo.fileKey, escudo_data: dataUrl })
  const gemeo = gemeoDe.get(alvo.fileKey)
  if (gemeo) {
    itens.push({ file_key: gemeo, escudo_data: dataUrl })
    comGemeo.push(`${alvo.fileKey} + ${gemeo} [${alvo.nome}]`)
  }
  casados.push(`${arquivo} -> ${alvo.nome} [${alvo.fileKey}${gemeo ? " + " + gemeo : ""}]${manual ? "  (par manual)" : ""}`)
}

const RESUMO = process.argv.includes("--resumo")

console.log(`arquivos de imagem na pasta: ${arquivos.length}`)
console.log(`CASADOS: ${casados.length}`)
if (!RESUMO) for (const c of casados) console.log(`   ${c}`)
if (duplicados.length) {
  console.log(`\nMESMO CLUBE EM MAIS DE UM ARQUIVO:`)
  for (const d of duplicados) console.log(`   ${d}`)
}
if (ambiguos.length) {
  console.log(`\nAMBIGUOS (nenhum escudo destes vai no pacote) — resolva com file_key="arquivo":`)
  for (const a of ambiguos) console.log(`   ${a}`)
}
if (contraditos.length) {
  console.log(`\nSUFIXO NAO BATE com a origem do clube (recusados):`)
  for (const c of contraditos) console.log(`   ${c}`)
}
if (semClube.length) {
  console.log(`\nSEM CLUBE com esse nome no seed:`)
  for (const s of semClube) console.log(`   ${s}`)
}
if (excluidos.length) {
  console.log(`\nEXCLUIDOS de proposito (--pares "_excluir"): ${excluidos.join(", ")}`)
}
if (comGemeo.length) {
  console.log(`\nPUBLICADOS TAMBEM NA CHAVE CURADA (${comGemeo.length}) — sem isto a tela nao mostraria:`)
  if (!RESUMO) for (const g of comGemeo) console.log(`   ${g}`)
}
if (disputados.length) {
  console.log(`\nCHAVE CURADA DISPUTADA por mais de um clube do pool:`)
  for (const d of disputados) console.log(`   ${d}`)
}

const kb = (itens.reduce((s, i) => s + i.escudo_data.length, 0) / 1024).toFixed(0)
console.log(`\n${itens.length} escudos prontos (~${kb} KB em base64)`)

if (!SAIDA) {
  console.log("Ensaio. Use --exportar <arquivo> para gravar o pacote.")
  process.exit(0)
}
writeFileSync(SAIDA, JSON.stringify({ clubes: itens }), "utf-8")
console.log(`Exportado para ${SAIDA}`)
