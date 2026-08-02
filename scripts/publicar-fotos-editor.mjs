// PUBLICA NA VPS OS ROSTOS LICENCIADOS NO EDITOR DE EQUIPES.
//
//   node scripts/publicar-fotos-editor.mjs                      # so mostra o que faria
//   node scripts/publicar-fotos-editor.mjs --clube corinthians   # filtra por clube
//   node scripts/publicar-fotos-editor.mjs --enviar              # envia de verdade
//   node scripts/publicar-fotos-editor.mjs --enviar --publicar   # envia E publica
//
// O QUE ELE RESOLVE: um rosto licenciado no editor so chegava aos outros
// jogadores DENTRO DO BUILD (via scripts/bake-user-player-photos.mjs). Licenciar
// um elenco custava um instalador de 660 MB para todo mundo baixar. Por aqui a
// mesma foto vira um arquivo de poucos KB no servidor de atualizacoes, e o jogo
// a recebe pelo aviso de atualizacao de elenco — SEM mexer na versao do jogo.
//
// PRECISA de um token de administrador (o mesmo login do jogo):
//   ULTRAFOOT_ADMIN_TOKEN=<token> node scripts/publicar-fotos-editor.mjs --enviar
// Pegue o token entrando no painel e copiando de sessionStorage.
//
// ⚠️ DE ONDE VEM O DADO — e por que NAO e a chave `ultrafoot:player-photo:`:
// aquela e indexada so pelo NOME, e o servidor precisa do CLUBE para montar a
// chave `fileKey__nome`. Quem carrega os dois e `ultrafoot:player-override:`,
// que o editor grava com o clube embutido na propria chave e a foto ja
// comprimida a 320px em `faceDataUrl`. Ver app/editar/page.tsx (salvar atleta).
//
// UM POST POR ATLETA, de proposito: /admin/importar so entende clubes, e o teto
// de corpo do servidor e 12 MB. Sequencial para o erro apontar onde parou.

import { readFileSync, writeFileSync } from "node:fs"
import path from "node:path"
import os from "node:os"

const SAVE = path.join(
  process.env.APPDATA || path.join(os.homedir(), "AppData/Roaming"),
  "com.ultrafoot.remake",
  "ultrafoot-clubs.json",
)
const BASE = process.env.ULTRAFOOT_ATU_URL || "https://ultrafoot.179-198-103-30.sslip.io"
const TOKEN = process.env.ULTRAFOOT_ADMIN_TOKEN || ""

const PREFIXO_OV = "ultrafoot:player-override:"
const PREFIXO_FOTO = "ultrafoot:player-photo:"

const enviar = process.argv.includes("--enviar")
const publicar = process.argv.includes("--publicar")
const tudo = process.argv.includes("--tudo")
const clubeFiltro = (process.argv[process.argv.indexOf("--clube") + 1] || "").toLowerCase()
const filtrando = process.argv.includes("--clube")

function ler() {
  try {
    return JSON.parse(readFileSync(SAVE, "utf-8"))
  } catch (e) {
    console.error(`nao consegui ler o save do editor em ${SAVE}: ${e.message}`)
    process.exit(1)
  }
}

/**
 * Nome legivel a partir das chaves de foto.
 *
 * A chave do override guarda o nome SEM separador ("vitorroque"); a de foto usa
 * hifen ("vitor-roque"). Cruzando as duas da para mandar "Vitor Roque" para o
 * painel em vez de "vitorroque". Isto e so estetica: o servidor normaliza o que
 * receber, entao a chave final e a mesma nos dois casos — errar aqui nao
 * descasa nada.
 */
function montarNomes(bruto) {
  const mapa = new Map()
  for (const chave of Object.keys(bruto)) {
    if (!chave.startsWith(PREFIXO_FOTO)) continue
    const comHifen = chave.slice(PREFIXO_FOTO.length)
    const semSeparador = comHifen.replace(/-/g, "")
    if (!mapa.has(semSeparador)) {
      mapa.set(
        semSeparador,
        comHifen.split("-").filter(Boolean).map(p => p[0].toUpperCase() + p.slice(1)).join(" "),
      )
    }
  }
  return mapa
}

function coletar(bruto) {
  const nomes = montarNomes(bruto)
  const itens = []
  for (const [chave, valor] of Object.entries(bruto)) {
    if (!chave.startsWith(PREFIXO_OV)) continue
    let ov
    try {
      ov = typeof valor === "string" ? JSON.parse(valor) : valor
    } catch {
      continue
    }
    if (!ov?.faceDataUrl || !String(ov.faceDataUrl).startsWith("data:image/")) continue

    const id = chave.slice(PREFIXO_OV.length)
    const corte = id.indexOf("__")
    if (corte < 0) continue
    const fileKey = id.slice(0, corte)
    const nomeNorm = id.slice(corte + 2)
    if (!fileKey || !nomeNorm) continue
    if (filtrando && !fileKey.toLowerCase().includes(clubeFiltro)) continue

    const corpo = {
      file_key: fileKey,
      nome_original: nomes.get(nomeNorm) || nomeNorm,
      foto_data: ov.faceDataUrl,
    }
    // Por padrao vai SO a foto. Nome, posicao e overall mudam o jogo de todo
    // mundo e merecem um pedido explicito.
    if (tudo) {
      if (ov.nome) corpo.nome = ov.nome
      if (ov.pos) corpo.pos = ov.pos
      if (typeof ov.base === "number") corpo.base = ov.base
      if (typeof ov.idade === "number") corpo.idade = ov.idade
      if (ov.nac) corpo.nac = ov.nac
    }
    itens.push({ fileKey, nome: corpo.nome_original, bytes: ov.faceDataUrl.length, corpo })
  }
  return itens.sort((a, b) => a.fileKey.localeCompare(b.fileKey) || a.nome.localeCompare(b.nome))
}

async function postar(rota, corpo) {
  const r = await fetch(`${BASE}/atualizacoes${rota}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${TOKEN}` },
    body: JSON.stringify(corpo),
  })
  const texto = await r.text()
  if (!r.ok) {
    // 404 aqui quase sempre e token sem `admin`, nao rota errada: o servidor
    // esconde a area administrativa de quem nao e admin.
    throw new Error(`${r.status} ${texto.slice(0, 200)}`)
  }
  return texto
}

const bruto = ler()
const itens = coletar(bruto)

if (!itens.length) {
  console.log(
    filtrando
      ? `Nenhum rosto licenciado no editor para "${clubeFiltro}".`
      : "Nenhum rosto licenciado no editor.",
  )
  process.exit(0)
}

const porClube = new Map()
for (const i of itens) porClube.set(i.fileKey, (porClube.get(i.fileKey) || 0) + 1)
const totalMb = (itens.reduce((s, i) => s + i.bytes, 0) / 1024 / 1024).toFixed(1)

console.log(`${itens.length} rostos em ${porClube.size} clubes (~${totalMb} MB em base64):`)
for (const [clube, n] of [...porClube].sort((a, b) => b[1] - a[1])) {
  console.log(`  ${clube.padEnd(32)} ${n}`)
}

// ─── Saida em arquivo, para a carga rodar NA VPS ─────────────────────────────
//
// O caminho por HTTP exige um token de administrador. Quando ele nao esta a mao,
// vale o mesmo desvio que a carga inicial ja usava (services/atualizacoes-server/
// importar-seed.py): exportar aqui, subir o arquivo e gravar direto no SQLite do
// servidor. Evita tambem mandar ~5 MB de base64 por requisicao.
const exportarPara = process.argv.includes("--exportar")
  ? process.argv[process.argv.indexOf("--exportar") + 1]
  : ""

if (exportarPara) {
  writeFileSync(exportarPara, JSON.stringify({ jogadores: itens.map(i => i.corpo) }), "utf-8")
  console.log(`\nExportado para ${exportarPara} (${itens.length} atletas).`)
  process.exit(0)
}

if (!enviar) {
  console.log("\nEnsaio. Rode com --enviar para mandar, e --publicar para publicar em seguida.")
  console.log("Sem token de admin: --exportar <arquivo> e carregue na VPS.")
  process.exit(0)
}

if (!TOKEN) {
  console.error("\nfalta ULTRAFOOT_ADMIN_TOKEN — sem token o servidor responde 404.")
  process.exit(1)
}

let ok = 0
const falhas = []
for (const [n, item] of itens.entries()) {
  try {
    await postar("/admin/jogador/salvar", item.corpo)
    ok++
  } catch (e) {
    falhas.push(`${item.fileKey} / ${item.nome}: ${e.message}`)
  }
  if ((n + 1) % 10 === 0 || n === itens.length - 1) {
    process.stdout.write(`\r  enviados ${n + 1}/${itens.length}`)
  }
}
console.log(`\n${ok} rostos gravados${falhas.length ? `, ${falhas.length} falharam` : ""}.`)
for (const f of falhas.slice(0, 10)) console.log(`  ! ${f}`)

if (!publicar) {
  // Nao e rascunho (o servidor grava com rascunho=0), mas tambem nao esta no ar:
  // o manifesto que o jogo baixa so e reescrito por /admin/publicar.
  console.log("\nGravado no banco — ainda NAO chegou a jogador nenhum.")
  console.log("Publique pelo painel, ou rode de novo com --publicar.")
  process.exit(falhas.length ? 1 : 0)
}

// ⚠️ A versao do manifesto sai de MAX(versao)+1 no servidor e nunca pode empatar:
// numero igual ou menor nao da erro, simplesmente nao chega em ninguem.
const resposta = await postar("/admin/publicar", { notas: `Rostos licenciados (${ok} atletas)` })
console.log(`\nPublicado: ${resposta}`)
console.log("O jogo oferece o pacote no proximo boot (aviso no canto inferior direito).")
process.exit(falhas.length ? 1 : 0)
