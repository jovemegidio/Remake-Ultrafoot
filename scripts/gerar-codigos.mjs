// EMISSÃO DE CÓDIGOS DE REGISTRO.
//
// É aqui que você gera os códigos que vai entregar aos compradores.
//
//   node scripts/gerar-codigos.mjs --quantidade 50
//   node scripts/gerar-codigos.mjs --quantidade 10 --lote 3 --para "Loja do Zé"
//   node scripts/gerar-codigos.mjs --revogar 1042
//
// O segredo mestre fica FORA do repositório, em
// C:\Users\<voce>\.ultrafoot-keys\ultrafoot-license.secret — junto da chave do
// updater. Nunca comite esse arquivo: quem o tiver emite códigos à vontade.
//
// Cada emissão é registrada em .ultrafoot-keys/licencas-emitidas.csv, que é a
// sua planilha de vendas: série, lote, código, data e para quem foi. Quando
// alguém pedir suporte com um código, é ali que você confere.
//
// A numeração NUNCA reinicia: o próximo número de série sai do CSV. Duas séries
// iguais dariam o mesmo código a duas pessoas.

import { createHmac } from "node:crypto"
import { readFileSync, writeFileSync, existsSync, appendFileSync, mkdirSync } from "node:fs"
import path from "node:path"
import os from "node:os"

const ALFABETO = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"
const PREFIXO = "UF26"

const PASTA_CHAVES = path.join(os.homedir(), ".ultrafoot-keys")
const ARQ_SEGREDO = path.join(PASTA_CHAVES, "ultrafoot-license.secret")
const ARQ_LEDGER = path.join(PASTA_CHAVES, "licencas-emitidas.csv")
const ARQ_REVOGADOS = path.resolve("data/seeds/licencas-revogadas.json")

function arg(nome, padrao = null) {
  const i = process.argv.indexOf(`--${nome}`)
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : padrao
}

function segredo() {
  if (!existsSync(ARQ_SEGREDO)) {
    console.error(`Segredo nao encontrado em ${ARQ_SEGREDO}`)
    console.error("Crie um (e guarde em lugar seguro):")
    console.error(`  node -e "require('fs').writeFileSync(String.raw\`${ARQ_SEGREDO}\`, require('crypto').randomBytes(32).toString('base64'))"`)
    process.exit(1)
  }
  return readFileSync(ARQ_SEGREDO, "utf8").trim()
}

// MESMA aritmetica de lib/license.ts, de proposito sem BigInt: se as duas
// implementacoes divergirem num bit, o codigo emitido aqui e recusado no jogo.
const BITS_POR_CARACTERE = 5

function macCurto(buf) {
  let alto = 0
  for (let i = 0; i < 5; i++) alto = alto * 256 + buf[i]
  return alto * 32 + (buf[5] >> 3)
}

function escreverBits(grupos, inicio, quantos, valor) {
  for (let i = 0; i < quantos; i++) {
    const bit = inicio + i
    const indice = Math.floor(bit / BITS_POR_CARACTERE)
    const deslocamento = BITS_POR_CARACTERE - 1 - (bit % BITS_POR_CARACTERE)
    const umOuZero = Math.floor(valor / Math.pow(2, quantos - 1 - i)) % 2
    if (umOuZero) grupos[indice] = (grupos[indice] ?? 0) | (1 << deslocamento)
  }
}

function montarCodigo(serie, lote, chave) {
  const mac = macCurto(createHmac("sha256", chave).update(`${serie}:${lote}`).digest())
  const grupos = new Array(15).fill(0)
  escreverBits(grupos, 0, 24, serie)
  escreverBits(grupos, 24, 6, lote)
  escreverBits(grupos, 30, 45, mac)
  const t = grupos.map(g => ALFABETO[g]).join("")
  return `${PREFIXO}-${t.slice(0, 5)}-${t.slice(5, 10)}-${t.slice(10, 15)}`
}

/** Proximo numero de serie: continua de onde o CSV parou. */
function proximaSerie() {
  if (!existsSync(ARQ_LEDGER)) return 1001
  const linhas = readFileSync(ARQ_LEDGER, "utf8").trim().split("\n").slice(1)
  let maior = 1000
  for (const l of linhas) {
    const n = Number(l.split(",")[0])
    if (Number.isFinite(n) && n > maior) maior = n
  }
  return maior + 1
}

function revogar(serie) {
  const atual = existsSync(ARQ_REVOGADOS) ? JSON.parse(readFileSync(ARQ_REVOGADOS, "utf8")) : []
  if (atual.includes(serie)) { console.log(`Serie ${serie} ja estava revogada.`); return }
  atual.push(serie)
  writeFileSync(ARQ_REVOGADOS, JSON.stringify(atual.sort((a, b) => a - b), null, 2))
  console.log(`Serie ${serie} revogada. Ela para de funcionar na PROXIMA build publicada.`)
}

function main() {
  const paraRevogar = arg("revogar")
  if (paraRevogar) return revogar(Number(paraRevogar))

  const quantidade = Number(arg("quantidade", "1"))
  const lote = Number(arg("lote", "1"))
  const para = arg("para", "")

  if (!Number.isFinite(quantidade) || quantidade < 1 || quantidade > 5000) {
    console.error("--quantidade precisa ser entre 1 e 5000"); process.exit(1)
  }
  if (!Number.isFinite(lote) || lote < 0 || lote > 63) {
    console.error("--lote precisa ser entre 0 e 63"); process.exit(1)
  }

  const chave = segredo()
  mkdirSync(PASTA_CHAVES, { recursive: true })
  if (!existsSync(ARQ_LEDGER)) appendFileSync(ARQ_LEDGER, "serie,lote,codigo,emitido_em,para\n")

  const inicio = proximaSerie()
  const quando = new Date().toISOString()
  const emitidos = []
  for (let i = 0; i < quantidade; i++) {
    const serie = inicio + i
    const codigo = montarCodigo(serie, lote, chave)
    emitidos.push({ serie, codigo })
    appendFileSync(ARQ_LEDGER, `${serie},${lote},${codigo},${quando},"${String(para).replace(/"/g, "'")}"\n`)
  }

  console.log(`${quantidade} codigo(s) emitidos no lote ${lote}${para ? ` para ${para}` : ""}:\n`)
  for (const e of emitidos) console.log(`  ${e.codigo}   (serie ${e.serie})`)
  console.log(`\nRegistrado em: ${ARQ_LEDGER}`)
  console.log("Os codigos so funcionam em builds feitas COM este mesmo segredo.")
}

main()
