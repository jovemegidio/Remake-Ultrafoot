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
  console.error('uso: --pasta "caminho" [--exportar saida.json] [file_key="arquivo"]')
  process.exit(1)
}

// Pares `file_key=arquivo` resolvem a mao o que o casamento automatico recusou.
const MANUAIS = new Map()
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
const SOCIEDADE = new Set([
  "fc", "ac", "sc", "ec", "cf", "cd", "ca", "afc", "cfc", "sac",
  "calcio", "club", "clube", "futebol", "futbol", "football", "esporte",
  "esportivo", "esportiva", "sociedade", "associacao",
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
}

/** "A.C Monza - ITA.png" -> { nome: "A.C Monza", sufixo: "ITA" } */
function partesDoArquivo(arquivo) {
  const base = arquivo.replace(/\.(png|webp|jpg|jpeg)$/i, "")
  const m = base.match(/^(.*?)\s*-\s*([A-Za-z]{2,4})$/)
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
      pais: t.pais ?? "",
      estado: t.estado ?? "",
      sufixo: (fileKey.split("_").at(-1) ?? "").toLowerCase(),
    })
  }
  return lista
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
const ambiguos = []
const semClube = []
const contraditos = []

for (const arquivo of arquivos) {
  const { nome, sufixo } = partesDoArquivo(arquivo)

  let alvo = null
  if (MANUAIS.has(arquivo)) {
    const fk = MANUAIS.get(arquivo)
    alvo = CLUBES.find(c => c.fileKey === fk)
    if (!alvo) {
      console.error(`file_key inexistente no seed: "${fk}" (par manual de "${arquivo}")`)
      process.exit(1)
    }
  } else {
    const chave = chaveNome(nome)
    const mesmoNome = CLUBES.filter(c => c.chave === chave)
    const validos = mesmoNome.filter(c => !contradiz(c, sufixo))
    if (validos.length === 1) alvo = validos[0]
    else if (mesmoNome.length === 0) semClube.push(arquivo)
    else if (validos.length === 0) contraditos.push(`${arquivo} (${mesmoNome.map(c => c.fileKey).join(", ")})`)
    else ambiguos.push(`${arquivo} -> ${validos.map(c => `${c.fileKey} (${c.nome})`).join(" | ")}`)
  }
  if (!alvo) continue

  // `contain` com fundo transparente: escudo nao e quadrado, e esticar ou cortar
  // deforma. O PNG paletizado sai em poucos KB — 500x500 cheios sao 150 KB, e
  // com 23 clubes isso e a diferenca entre 3 MB e 300 KB no manifesto.
  const png = await sharp(path.join(PASTA, arquivo))
    .resize(LADO, LADO, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png({ compressionLevel: 9, palette: true })
    .toBuffer()

  itens.push({ file_key: alvo.fileKey, escudo_data: `data:image/png;base64,${png.toString("base64")}` })
  casados.push(`${arquivo} -> ${alvo.nome} [${alvo.fileKey}]${MANUAIS.has(arquivo) ? "  (par manual)" : ""}`)
}

console.log(`arquivos de imagem na pasta: ${arquivos.length}`)
console.log(`CASADOS: ${casados.length}`)
for (const c of casados) console.log(`   ${c}`)
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

const kb = (itens.reduce((s, i) => s + i.escudo_data.length, 0) / 1024).toFixed(0)
console.log(`\n${itens.length} escudos prontos (~${kb} KB em base64)`)

if (!SAIDA) {
  console.log("Ensaio. Use --exportar <arquivo> para gravar o pacote.")
  process.exit(0)
}
writeFileSync(SAIDA, JSON.stringify({ clubes: itens }), "utf-8")
console.log(`Exportado para ${SAIDA}`)
