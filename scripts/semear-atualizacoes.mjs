// CARGA INICIAL DO BANCO DE ATUALIZACOES.
//
//   node scripts/semear-atualizacoes.mjs                # so mostra o que faria
//   node scripts/semear-atualizacoes.mjs --enviar       # envia de verdade
//   node scripts/semear-atualizacoes.mjs --enviar --limite 50
//
// De onde vem o dado: data/seeds/team-overrides.json — as edicoes de clube que
// hoje viajam DENTRO do build (30 MB, com escudo e uniforme em base64). Este
// script leva isso para o banco do servidor, onde a imagem vira arquivo e o
// manifesto passa a ter so a URL.
//
// PRECISA de um token de administrador (o mesmo login do jogo):
//   ULTRAFOOT_ADMIN_TOKEN=<token>  node scripts/semear-atualizacoes.mjs --enviar
// Pegue o token entrando no painel e copiando de sessionStorage, ou faca um
// POST /auth/login e use o campo `token` da resposta.
//
// EM LOTES, e nao tudo de uma vez: o corpo com todos os clubes passaria de 30 MB
// numa unica requisicao — o nginx corta e o servidor engasga. Cada lote vai
// pequeno o bastante para caber no limite e para o erro apontar onde parou.

import { readFileSync } from "node:fs"
import path from "node:path"

const RAIZ = path.resolve(import.meta.dirname, "..")
const FONTE = path.join(RAIZ, "data", "seeds", "team-overrides.json")
const BASE = process.env.ULTRAFOOT_ATU_URL || "https://ultrafoot.179-198-103-30.sslip.io"
const TOKEN = process.env.ULTRAFOOT_ADMIN_TOKEN || ""

const enviar = process.argv.includes("--enviar")
const limite = Number(process.argv[process.argv.indexOf("--limite") + 1]) || 0
// 12 MB e o teto do servidor; 6 MB por lote deixa folga para o overhead do JSON.
const TETO_LOTE = 6 * 1024 * 1024

function ler() {
  try {
    return JSON.parse(readFileSync(FONTE, "utf-8"))
  } catch (e) {
    console.error(`nao consegui ler ${FONTE}: ${e.message}`)
    process.exit(1)
  }
}

/** So o que o servidor entende; o resto do seed nao interessa aqui. */
function converter(fileKey, ov) {
  const clube = { file_key: fileKey }
  if (ov.nome) clube.nome = ov.nome
  if (ov.nomeOficial) clube.nome_oficial = ov.nomeOficial
  if (ov.curto) clube.curto = ov.curto
  if (ov.cor1) clube.cor1 = ov.cor1
  if (ov.cor2) clube.cor2 = ov.cor2
  if (typeof ov.prestigio === "number") clube.prestigio = ov.prestigio
  if (ov.estadio_nome) clube.estadio_nome = ov.estadio_nome
  if (typeof ov.estadio_cap === "number") clube.estadio_cap = ov.estadio_cap
  if (ov.patrocinador) clube.patrocinador = ov.patrocinador
  // O servidor so aceita data URL base64: e o que o editor do jogo produz.
  if (typeof ov.logoUrl === "string" && ov.logoUrl.startsWith("data:")) {
    clube.escudo_data = ov.logoUrl
  }
  const kits = {}
  for (const variante of ["home", "away", "third"]) {
    const k = ov.kits?.[variante]
    if (!k) continue
    const saida = {}
    if (k.primary) saida.primary = k.primary
    if (k.secondary) saida.secondary = k.secondary
    if (k.pattern) saida.pattern = k.pattern
    if (k.disabled) saida.disabled = true
    if (typeof k.imageUrl === "string" && k.imageUrl.startsWith("data:")) saida.data = k.imageUrl
    if (Object.keys(saida).length) kits[variante] = saida
  }
  if (Object.keys(kits).length) clube.kits = kits
  return clube
}

const seed = ler()
let chaves = Object.keys(seed)
if (limite) chaves = chaves.slice(0, limite)

const clubes = []
let comEscudo = 0
let comKit = 0
for (const fk of chaves) {
  const c = converter(fk, seed[fk] || {})
  // Um registro so com file_key nao acrescenta nada ao manifesto.
  if (Object.keys(c).length <= 1) continue
  if (c.escudo_data) comEscudo++
  if (c.kits) comKit++
  clubes.push(c)
}

const tamanho = Buffer.byteLength(JSON.stringify(clubes))
console.log(`Fonte : ${path.relative(RAIZ, FONTE)}`)
console.log(`Clubes: ${clubes.length} (de ${Object.keys(seed).length} no seed)`)
console.log(`        ${comEscudo} com escudo, ${comKit} com uniforme`)
console.log(`Bruto : ${(tamanho / 1024 / 1024).toFixed(1)} MB em base64`)
console.log(`Destino: ${BASE}/atualizacoes/admin/importar`)

if (!enviar) {
  console.log("\nNada foi enviado. Rode com --enviar para valer.")
  process.exit(0)
}
if (!TOKEN) {
  console.error("\nERRO: defina ULTRAFOOT_ADMIN_TOKEN com um token de administrador.")
  process.exit(1)
}

// Monta lotes pelo TAMANHO, nao pela contagem: um clube com escudo grande pesa
// mais que dez sem imagem, e lote por contagem estouraria o limite sem aviso.
const lotes = []
let atual = []
let atualBytes = 0
for (const c of clubes) {
  const bytes = Buffer.byteLength(JSON.stringify(c))
  if (atual.length && atualBytes + bytes > TETO_LOTE) {
    lotes.push(atual)
    atual = []
    atualBytes = 0
  }
  atual.push(c)
  atualBytes += bytes
}
if (atual.length) lotes.push(atual)

console.log(`\nEnviando em ${lotes.length} lote(s)…`)
let importados = 0
for (let i = 0; i < lotes.length; i++) {
  const r = await fetch(`${BASE}/atualizacoes/admin/importar`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${TOKEN}` },
    body: JSON.stringify({ clubes: lotes[i] }),
  })
  const dado = await r.json().catch(() => ({}))
  if (!r.ok) {
    // 404 aqui e "token sem permissao de admin" — o servidor esconde a area.
    const motivo = r.status === 404 ? "token sem permissao de administrador" : (dado.erro || r.status)
    console.error(`\nLote ${i + 1}/${lotes.length} FALHOU: ${motivo}`)
    console.error(`Importados ate aqui: ${importados}. Corrija e rode de novo —`)
    console.error("a importacao e idempotente (mesmo file_key sobrescreve, mesma imagem nao duplica).")
    process.exit(1)
  }
  importados += dado.importados ?? 0
  process.stdout.write(`  lote ${i + 1}/${lotes.length} — ${importados} clubes\r`)
}

console.log(`\n\nOK — ${importados} clubes no banco.`)
console.log("Agora abra o painel e clique em Publicar para os jogadores receberem:")
console.log(`  ${BASE}/atualizacoes/painel`)
