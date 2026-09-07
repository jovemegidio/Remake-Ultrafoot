// PUBLICAÇÃO DE ATUALIZAÇÃO DE ELENCOS — o "squad update" do Ultrafoot.
//
//   node scripts/publicar-atualizacao-elencos.mjs            # confere e mostra o que vai
//   node scripts/publicar-atualizacao-elencos.mjs --publicar  # envia de verdade
//
// A FONTE é data/atualizacoes/elencos.json (versionado no git). Aqui a gente só
// valida, numera e envia — para os dois canais, VPS e GitHub, na mesma ordem do
// resto da distribuição.
//
// POR QUE ISTO EXISTE. Corrigir uma transferência ou um escudo exigia publicar o
// jogo inteiro (meio giga) e esperar todo mundo baixar. Este arquivo tem alguns
// KB e chega na próxima vez que a pessoa abre o jogo.
//
// A NUMERAÇÃO NÃO PODE RETROCEDER: o cliente só aceita `versao` MAIOR do que a
// que já tem (lib/atualizacao-elencos). Publicar um número igual ou menor não
// dá erro visível — simplesmente não chega em ninguém, que é o pior tipo de
// falha. Por isso o número sai do que está NO AR, não do arquivo local.

import { execFileSync } from "node:child_process"
import { readFileSync, writeFileSync, mkdirSync } from "node:fs"
import path from "node:path"

const RAIZ = path.resolve(import.meta.dirname, "..")
const FONTE = path.join(RAIZ, "data", "atualizacoes", "elencos.json")

const URL_VPS = "https://ultrafoot.zyntraerp.com.br/atualizacoes/elencos.json"
const DESTINO_VPS = "/var/www/ultrafoot/atualizacoes/elencos.json"
const REPO = "jovemegidio/Ultrafoot26"
const TAG = "elencos"

const publicar = process.argv.includes("--publicar")

function ler() {
  try {
    return JSON.parse(readFileSync(FONTE, "utf-8"))
  } catch (e) {
    console.error(`nao consegui ler ${FONTE}: ${e.message}`)
    process.exit(1)
  }
}

/** Recusa o que o cliente não saberia usar — melhor falhar aqui do que no jogo. */
function validar(a) {
  const problemas = []
  if (a.times && typeof a.times !== "object") problemas.push("`times` precisa ser objeto")
  if (a.jogadores && typeof a.jogadores !== "object") problemas.push("`jogadores` precisa ser objeto")
  if (a.transferencias && !Array.isArray(a.transferencias)) problemas.push("`transferencias` precisa ser lista")

  for (const [i, t] of (a.transferencias ?? []).entries()) {
    if (!t.nome) problemas.push(`transferencia #${i}: falta \`nome\``)
    // Sem `de` nem `para` a linha não faz nada — e passaria despercebida.
    if (!t.de && !t.para) problemas.push(`transferencia #${i} (${t.nome}): precisa de \`de\` ou \`para\``)
    if (t.base !== undefined && (t.base < 30 || t.base > 99)) {
      problemas.push(`transferencia #${i} (${t.nome}): \`base\` fora de 30..99`)
    }
  }
  for (const chave of Object.keys(a.jogadores ?? {})) {
    // A chave é `fileKey__nomenormalizado`; sem os dois underscores o override
    // nunca casa com atleta nenhum e a edição some sem aviso.
    if (!chave.includes("__")) problemas.push(`jogador "${chave}": chave precisa ser fileKey__nomenormalizado`)
  }
  return problemas
}

function versaoNoAr() {
  try {
    const saida = execFileSync("curl", ["-s", "--max-time", "20", URL_VPS], { encoding: "utf-8" })
    const n = JSON.parse(saida)?.versao
    return typeof n === "number" ? n : 0
  } catch {
    return 0
  }
}

const atualizacao = ler()
const problemas = validar(atualizacao)
if (problemas.length) {
  console.error("A atualizacao tem problemas:")
  for (const p of problemas) console.error(`  • ${p}`)
  process.exit(1)
}

const noAr = versaoNoAr()
atualizacao.versao = Math.max(noAr + 1, Number(atualizacao.versao) || 1)
atualizacao.publicado_em = Math.floor(Date.now() / 1000)

const resumo = {
  versao: atualizacao.versao,
  times: Object.keys(atualizacao.times ?? {}).length,
  jogadores: Object.keys(atualizacao.jogadores ?? {}).length,
  transferencias: (atualizacao.transferencias ?? []).length,
  ligas: Object.keys(atualizacao.ligas ?? {}).length,
}
console.log(`No ar: versao ${noAr}. Vai subir: versao ${atualizacao.versao}.`)
console.table(resumo)

if (!publicar) {
  console.log("\nNada foi enviado. Rode com --publicar para valer.")
  process.exit(0)
}

const saida = path.join(RAIZ, "data", "atualizacoes", ".publicado.json")
mkdirSync(path.dirname(saida), { recursive: true })
const corpo = JSON.stringify(atualizacao, null, 2)
writeFileSync(saida, corpo)

// GitHub primeiro: é a reserva, e ficar com a reserva à frente por alguns
// segundos é inofensivo. O contrário — VPS nova e reserva velha — faz quem cai
// no fallback receber dado desatualizado.
// O `#elencos.json` no fim NÃO é enfeite: o gh nomeia o asset pelo nome do
// ARQUIVO, e o arquivo local é `.publicado.json`. O ponto inicial vira
// "default." na normalização do GitHub, então o asset saía como
// `default.publicado.json` — e a URL de reserva do cliente
// (…/download/elencos/elencos.json) respondia 404. A reserva ficou morta desde
// a primeira publicação, calada, porque nada aqui conferia o lado do GitHub.
console.log("\nEnviando para o GitHub…")
execFileSync("gh", ["release", "upload", TAG, `${saida}#elencos.json`, "--repo", REPO, "--clobber"], { stdio: "inherit" })

// Conferência do GitHub pelo CORPO, mesma regra da VPS: um 404 aqui é o canal
// de reserva inteiro fora do ar sem ninguém perceber.
const URL_GITHUB = `https://github.com/${REPO}/releases/download/${TAG}/elencos.json`
const reserva = execFileSync("curl", ["-sL", "--max-time", "20", `${URL_GITHUB}?cb=${Date.now()}`], { encoding: "utf-8" })
let versaoReserva = 0
try { versaoReserva = JSON.parse(reserva)?.versao ?? 0 } catch { /* veio HTML/404 */ }
if (versaoReserva !== atualizacao.versao) {
  console.error(`\nFALHOU: a reserva do GitHub responde ${versaoReserva || "(nao e JSON)"} em vez de ${atualizacao.versao}.`)
  process.exit(1)
}

console.log("Enviando para a VPS…")
const chave = process.env.ULTRAFOOT_VPS_KEY
if (!chave) {
  console.error("defina ULTRAFOOT_VPS_KEY com o caminho da chave SSH")
  process.exit(1)
}
execFileSync("ssh", ["-i", chave, "root@31.97.64.102",
  `mkdir -p ${path.posix.dirname(DESTINO_VPS)} && cat > ${DESTINO_VPS}`],
  { input: corpo, stdio: ["pipe", "inherit", "inherit"] })

// Conferência pelo CORPO, não pelo status: o nginx deste site responde 200 com
// o index.html do jogo para caminho inexistente, então "HTTP 200" não prova nada.
const conferido = execFileSync("curl", ["-s", "--max-time", "20", `${URL_VPS}?cb=${Date.now()}`], { encoding: "utf-8" })
let versaoConferida = 0
try { versaoConferida = JSON.parse(conferido)?.versao ?? 0 } catch { /* veio HTML */ }

if (versaoConferida !== atualizacao.versao) {
  console.error(`\nFALHOU: a VPS ainda responde versao ${versaoConferida || "(nao e JSON)"}.`)
  process.exit(1)
}
console.log(`\nOK — versao ${atualizacao.versao} no ar nos dois canais.`)
