// LEVA OS CODIGOS EMITIDOS PARA A TABELA `licencas` DA VPS.
//
//   node scripts/publicar-licencas-na-vps.mjs            # mostra o que faria
//   node scripts/publicar-licencas-na-vps.mjs --publicar
//
// ⚠️ POR QUE ISTO EXISTE — e por que esquecer disto quebra a venda inteira.
//
// `gerar-codigos.mjs` emite o codigo e o registra no CSV de vendas. So isso.
// Mas o jogo NAO confere o codigo por matematica: ele chama `/licenca/ativar`,
// que procura a linha na tabela `licencas` e devolve um certificado assinado.
// Codigo que nao esta na tabela recebe "codigo invalido" — com a chave certa na
// mao do comprador.
//
// Em 07/09/2026 essa distancia entre "emitido" e "publicado" custou caro: a
// migracao de servidor criou um banco vazio, os 503 codigos ja vendidos ficaram
// so no CSV, e TODO comprador recebia erro. O CSV era a unica copia que existia
// — e foi ele que salvou a operacao. Depois disso, emitir sem publicar deixou de
// ser um passo esquecivel para ser um passo com script proprio.
//
// O QUE ESTE SCRIPT NAO FAZ, DE PROPOSITO:
//
//   · nao emite nada. A emissao mora em `gerar-codigos.mjs`, e a numeracao de
//     serie sai do CSV. Dois lugares emitindo dariam a mesma serie a duas
//     pessoas.
//   · nao importa nada sem CONFERIR antes. Cada codigo e validado contra o
//     segredo HMAC; um codigo que nao valida vira licenca fantasma no banco, que
//     e pior que codigo faltando — ninguem descobre.
//   · nao desamarra maquina. O INSERT e `OR IGNORE`: rodar de novo nao mexe em
//     quem ja ativou.

import { createHmac } from "node:crypto"
import { execFileSync } from "node:child_process"
import { readFileSync, existsSync, writeFileSync } from "node:fs"
import path from "node:path"
import os from "node:os"

const ALFABETO = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"
const PREFIXO = "UF26"

const ARQ_SEGREDO = path.join(os.homedir(), ".ultrafoot-keys", "ultrafoot-license.secret")
const ARQ_LEDGER = path.join(os.homedir(), ".ultrafoot-keys", "licencas-emitidas.csv")

// O MESMO servidor e a MESMA chave do `deploy-tudo.mjs`.
const VPS = process.env.ULTRAFOOT_VPS ?? "root@31.97.64.102"
const CHAVE = process.env.ULTRAFOOT_VPS_KEY
  ?? path.join(os.homedir(), ".ssh", "id_ed25519_vps")
const BANCO = "/var/lib/ultrafoot/auth.db"

const publicar = process.argv.includes("--publicar")

// ── A mesma aritmetica do gerador e do servidor ───────────────────────────────
//
// Reproduzida aqui, e nao importada, porque as tres implementacoes (este script,
// `gerar-codigos.mjs` e `services/auth-server/server.py`) precisam concordar bit
// a bit. Se divergirem, este script recusa o codigo que o gerador emitiu — e o
// erro aparece AQUI, antes de o codigo ir para a mao de alguem.
function lerBits(grupos, inicio, quantos) {
  let valor = 0
  for (let bit = inicio; bit < inicio + quantos; bit++) {
    const g = grupos[Math.floor(bit / 5)] ?? 0
    valor = valor * 2 + ((g >> (4 - (bit % 5))) & 1)
  }
  return valor
}

function macCurto(buf) {
  let alto = 0
  for (let i = 0; i < 5; i++) alto = alto * 256 + buf[i]
  return alto * 32 + (buf[5] >> 3)
}

function normalizar(bruto) {
  const limpo = String(bruto ?? "").toUpperCase().replace(/[^0-9A-Z-]/g, "")
  if (!limpo.startsWith(PREFIXO)) return limpo
  // As trocas do Crockford valem SO para o corpo: no prefixo, o U de "UF26"
  // viraria V e todo codigo legitimo seria recusado.
  const corpo = limpo.slice(PREFIXO.length)
    .replace(/O/g, "0").replace(/I/g, "1").replace(/L/g, "1").replace(/U/g, "V")
  return PREFIXO + corpo
}

/** (serie, lote) do codigo, ou null se ele nao bate com o segredo. */
function conferir(bruto, segredo) {
  const partes = normalizar(bruto).split("-")
  if (partes.length !== 4 || partes[0] !== PREFIXO) return null
  const texto = partes.slice(1).join("")
  if (texto.length !== 15) return null

  const grupos = []
  for (const ch of texto) {
    const i = ALFABETO.indexOf(ch)
    if (i < 0) return null
    grupos.push(i)
  }

  const serie = lerBits(grupos, 0, 24)
  const lote = lerBits(grupos, 24, 6)
  const recebido = lerBits(grupos, 30, 45)
  const esperado = macCurto(createHmac("sha256", segredo).update(`${serie}:${lote}`).digest())
  return recebido === esperado ? { serie, lote } : null
}

// ── Leitura do CSV de vendas ──────────────────────────────────────────────────

if (!existsSync(ARQ_SEGREDO)) {
  console.error(`FALHA: segredo nao encontrado em ${ARQ_SEGREDO}`)
  process.exit(1)
}
if (!existsSync(ARQ_LEDGER)) {
  console.error(`FALHA: nenhum codigo emitido — ${ARQ_LEDGER} nao existe`)
  process.exit(1)
}

const segredo = readFileSync(ARQ_SEGREDO, "utf8").trim()
const linhas = readFileSync(ARQ_LEDGER, "utf8").trim().split("\n").slice(1)

const bons = []
const ruins = []
for (const linha of linhas) {
  // O campo `para` pode ter virgula dentro das aspas; os quatro primeiros campos
  // nao tem, entao dividir pelos tres primeiros separadores basta.
  const [serieCsv, , codigoCsv] = linha.split(",")
  const codigo = normalizar(codigoCsv)
  const r = conferir(codigo, segredo)
  if (r && r.serie === Number(serieCsv)) bons.push({ codigo, serie: r.serie, lote: r.lote })
  else ruins.push(codigoCsv)
}

console.log("PUBLICAR LICENCAS NA VPS\n")
console.log(`  no CSV .........: ${linhas.length}`)
console.log(`  conferidos ok ..: ${bons.length}`)
console.log(`  RECUSADOS ......: ${ruins.length}${ruins.length ? "  " + ruins.slice(0, 3).join(", ") : ""}`)
if (bons.length) {
  const series = bons.map(b => b.serie)
  const lotes = [...new Set(bons.map(b => b.lote))].sort((a, b) => a - b)
  console.log(`  series .........: ${Math.min(...series)}..${Math.max(...series)}   lotes: ${lotes.join(", ")}`)
}

// ⚠️ UM codigo recusado ja e motivo para PARAR. Ou o segredo aqui nao e o que
// emitiu o CSV, ou alguem editou a planilha a mao — e nos dois casos importar o
// resto as cegas espalha o problema em vez de mostra-lo.
if (ruins.length) {
  console.error("\nFALHA: ha codigo no CSV que nao valida com este segredo.")
  console.error("Nao importei nada. Confira se e o segredo certo antes de seguir.")
  process.exit(1)
}

if (!publicar) {
  console.log("\nNada foi enviado. Rode com --publicar para valer.")
  process.exit(0)
}

// ── Envio ─────────────────────────────────────────────────────────────────────
//
// Roda como o usuario `ultrafoot`: o banco e dele, e um import feito por root
// deixaria os arquivos -wal/-shm com dono errado e o servico sem conseguir
// escrever depois.
const tmpLocal = path.join(os.tmpdir(), "ultrafoot-licencas.json")
writeFileSync(tmpLocal, JSON.stringify(bons), "utf8")

// ⚠️ O IMPORTADOR VAI COMO ARQUIVO, NAO COMO `python3 -c "<string>"`.
//
// A primeira versao passava o programa em `-c` com `JSON.stringify`, e as
// quebras de linha chegavam na VPS como os dois caracteres `\` e `n`: o Python
// morria com "unexpected character after line continuation character". Como
// arquivo nao ha nada para escapar.
const importador = `
import json, sqlite3, time
itens = json.load(open("/tmp/ultrafoot-licencas.json", encoding="utf-8"))
agora = int(time.time())
con = sqlite3.connect(${JSON.stringify(BANCO)})
antes = con.execute("SELECT COUNT(*) FROM licencas").fetchone()[0]
novos = 0
for it in itens:
    cur = con.execute(
        "INSERT OR IGNORE INTO licencas (codigo, conta_id, serie, emitida_em, device, ativada_em, revogada)"
        " VALUES (?, NULL, ?, ?, NULL, NULL, 0)",
        (it["codigo"], it["serie"], agora))
    novos += cur.rowcount
con.commit()
depois = con.execute("SELECT COUNT(*) FROM licencas").fetchone()[0]
amarradas = con.execute("SELECT COUNT(*) FROM licencas WHERE device IS NOT NULL").fetchone()[0]
maior = con.execute("SELECT MAX(serie) FROM licencas").fetchone()[0]
print(f"  antes: {antes}   inseridos: {novos}   agora: {depois}")
print(f"  ja ativadas (device amarrado): {amarradas}")
print(f"  proxima serie que o servidor emitiria: {maior + 1}")
print(f"TOTAL_NA_VPS={depois}")
`

const ssh = ["-i", CHAVE, "-o", "ConnectTimeout=20", "-o", "StrictHostKeyChecking=accept-new"]
const tmpPy = path.join(os.tmpdir(), "ultrafoot-importar-licencas.py")
writeFileSync(tmpPy, importador, "utf8")

console.log("\n→ enviando a lista conferida e o importador")
execFileSync("scp", ["-i", CHAVE, "-o", "ConnectTimeout=20", "-o", "StrictHostKeyChecking=accept-new",
  tmpLocal, tmpPy, `${VPS}:/tmp/`], { stdio: "inherit" })

console.log("→ importando (como o usuario ultrafoot)")
const saida = execFileSync("ssh", [...ssh, VPS,
  "sudo -u ultrafoot python3 /tmp/ultrafoot-importar-licencas.py;"
  + " rm -f /tmp/ultrafoot-licencas.json /tmp/ultrafoot-importar-licencas.py"],
  { encoding: "utf8" })
process.stdout.write(saida)

// ⚠️ CONFERIR ANTES DE ANUNCIAR — e nao "o comando nao explodiu".
//
// A primeira versao imprimia "PRONTO" mesmo quando o Python remoto morria de
// erro de sintaxe: o `ssh` devolvia 0 porque o `rm` seguinte funcionou, e o
// script cantou vitoria em cima de uma importacao que nao aconteceu. E o mesmo
// erro que ja fez este projeto anunciar cadeia de testes verde estando vermelha.
const m = saida.match(/^TOTAL_NA_VPS=(\d+)$/m)
if (!m) {
  console.error("\nFALHA: a VPS nao confirmou o total. NAO considere publicado.")
  process.exit(1)
}
const naVps = Number(m[1])
if (naVps < bons.length) {
  console.error(`\nFALHA: a VPS tem ${naVps} licencas, e o CSV tem ${bons.length}.`)
  process.exit(1)
}

console.log(`\nPRONTO. As ${bons.length} licencas do CSV existem na VPS (${naVps} no total) e ativam.`)
