// FOTOGRAFA A CARREIRA DE ATLETA — e clica no menu, para ver o que o jogador vê.
//
// ⚠️ POR QUE ELE EXISTE. O usuário relatou que "as configurações do menu na
// carreira de jogador não funcionam". Lendo o código, o item existe, o `href` é
// `/configuracoes` e a navegação é a mesma de todas as telas — ou seja, pelo
// código está tudo certo, e mesmo assim ele viu não funcionar. Quando o código
// diz uma coisa e o usuário vê outra, quem está errado é a leitura do código.
//
// Este script monta um save COM carreira de atleta (o modo só existe com ele),
// abre a tela, abre o menu e clica no item — e fotografa o resultado.
//
// Uso: node scripts/foto-carreira-atleta.mjs [destino.png]

import { chromium } from "@playwright/test"
import { createServer } from "node:http"
import { readFile, stat } from "node:fs/promises"
import { existsSync } from "node:fs"
import path from "node:path"

const outDir = path.resolve("out")
const publicDir = path.resolve("public")
const destino = process.argv[2] ?? "atleta.png"

const mime = new Map([
  [".html", "text/html; charset=utf-8"], [".js", "text/javascript"], [".css", "text/css"],
  [".json", "application/json"], [".png", "image/png"], [".jpg", "image/jpeg"],
  [".webp", "image/webp"], [".svg", "image/svg+xml"], [".ico", "image/x-icon"],
  [".woff2", "font/woff2"], [".mp3", "audio/mpeg"],
])

function resolver(url) {
  const limpo = decodeURIComponent(url.split("?")[0])
  const rota = limpo === "/" ? "/index.html" : limpo
  const bruto = path.join(outDir, rota)
  if (existsSync(bruto)) return bruto
  if (!path.extname(rota)) {
    const idx = path.join(outDir, rota, "index.html")
    if (existsSync(idx)) return idx
  }
  const doPublic = path.join(publicDir, rota)
  if (existsSync(doPublic)) return doPublic
  return bruto
}

const servidor = createServer(async (req, res) => {
  try {
    const alvo = path.resolve(resolver(req.url ?? "/"))
    const st = await stat(alvo)
    const arquivo = st.isDirectory() ? path.join(alvo, "index.html") : alvo
    res.writeHead(200, {
      "content-type": mime.get(path.extname(arquivo).toLowerCase()) ?? "application/octet-stream",
      "cache-control": "no-store",
    })
    res.end(await readFile(arquivo))
  } catch { res.writeHead(404); res.end("nao encontrado") }
})

// ⚠️ A CARREIRA DE ATLETA VEM DO MOTOR, gerada por 
// (tsx) e lida aqui como JSON — um  nao importa . Um save inventado
// a mao testaria a minha ideia da estrutura, e nao a estrutura.
const SAVE = JSON.parse(await readFile("C:/save-atleta.json", "utf-8"))

await new Promise(r => servidor.listen(0, "127.0.0.1", r))
const base = `http://127.0.0.1:${servidor.address().port}`

const navegador = await chromium.launch()
const pagina = await navegador.newPage({ viewport: { width: 1440, height: 900 } })
const erros = []
pagina.on("pageerror", e => erros.push(`JS: ${e.message}`))
pagina.on("console", m => { if (m.type() === "error") erros.push(`console: ${m.text().slice(0, 140)}`) })

// ⚠️ A CHAVE LEGADA NÃO BASTA — e foi por isso que a primeira reprodução falhou.
//
// O jogo guarda o save em `ultrafoot:save:<careerId>` e aponta a carreira aberta
// em `ultrafoot:active-career`. Escrevendo só `ultrafoot:save`, o jogo não vê
// carreira nenhuma e manda para o menu inicial — foi exatamente o que a foto
// mostrou, e por um instante pareceu que a tela do atleta estava quebrada.
await pagina.addInitScript(s => {
  const id = s.careerId ?? "career-teste-menu"
  const comId = { ...s, careerId: id }
  window.localStorage.setItem("ultrafoot:active-career", id)
  window.localStorage.setItem(`ultrafoot:save:${id}`, JSON.stringify(comId))
  window.localStorage.setItem("ultrafoot:save", JSON.stringify(comId))
  // O aceite de termos também mora no storage: sem ele o modal cobre a tela.
  // ⚠️ A chave e a versao sao as de `lib/legal.ts` — chutar o nome (foi o que eu
  // fiz na primeira tentativa) deixa o modal de pe e a foto sai do modal.
  window.localStorage.setItem("ultrafoot:legal-acceptance", "2026-07-19")
}, SAVE)
await pagina.goto(`${base}/carreira/jogador`, { waitUntil: "networkidle" })
await pagina.waitForTimeout(2000)

// ⚠️ SÃO DOIS PORTÕES ANTES DA TELA, e a primeira execução deste script parou no
// primeiro: um aceite de TERMOS DE USO cobre tudo num perfil novo, e depois vem
// o modal de novidades da versão. Fotografar sem dispensar os dois produz uma
// imagem do modal — foi o que aconteceu, e por um instante pareceu que a tela do
// atleta estava preta.
for (let i = 0; i < 6; i++) {
  const termos = pagina.getByRole("button", { name: /aceito os termos|aceitar/i })
  if (await termos.count() === 0) break
  await termos.first().click({ timeout: 2000 }).catch(() => {})
  await pagina.waitForTimeout(400)
}

// Dispensa o modal de novidades, que cobre a tela.
for (let i = 0; i < 20; i++) {
  const b = pagina.getByRole("button", { name: /avan[cç]ar|fechar|come[cç]ar/i })
  if (await b.count() === 0) break
  await b.first().click({ timeout: 2000 }).catch(() => {})
  await pagina.waitForTimeout(200)
}
await pagina.keyboard.press("Escape").catch(() => {})

// ⚠️ TRES PORTOES ANTES DA TELA, e cada tentativa deste script achou um novo:
// aceite de TERMOS, a ABERTURA ("APRESENTA...") e o modal de NOVIDADES. Duas
// fotos saidas daqui pareciam "tela preta do atleta" e eram, na verdade, a
// abertura rodando. Fotografar cedo demais nao mede a tela: mede a espera.
for (let i = 0; i < 24; i++) {
  const texto = (await pagina.locator("body").innerText().catch(() => "")) || ""
  if (!/APRESENTA|simulacao de gerenciamento|simulação de gerenciamento/i.test(texto)) break
  await pagina.keyboard.press("Space").catch(() => {})
  await pagina.mouse.click(720, 450).catch(() => {})
  await pagina.waitForTimeout(700)
}
await pagina.waitForTimeout(1500)

await pagina.waitForTimeout(2500)
await pagina.screenshot({ path: destino })
console.log(`escritorio: ${destino}`)

// ⚠️ FOTO PRETA NAO E DIAGNOSTICO. Ela pode ser tela quebrada, render atrasado
// ou fundo por cima do conteudo — e as tres exigem correcoes diferentes. O texto
// visivel separa os casos: com texto, a tela existe e o problema e de camada.
const texto = (await pagina.locator("body").innerText().catch(() => "")) || ""
console.log(`texto visivel: ${texto.replace(/\s+/g, " ").trim().slice(0, 160) || "(NENHUM)"}`)
console.log(`caracteres: ${texto.trim().length}`)

// ── Agora o MENU ──
// O botao do menu no cabecalho nao tem rotulo de texto — e um icone. Procura
// pelo `aria-label` e, se nao houver, pelo atalho de teclado que o abre.
let menu = pagina.locator('[aria-label*="enu" i], [title*="enu" i]').first()
if (await menu.count() === 0) menu = pagina.getByRole("button").nth(1)
if (await menu.count() > 0) {
  await menu.click({ timeout: 3000 }).catch(() => {})
  await pagina.waitForTimeout(900)
  await pagina.screenshot({ path: destino.replace(/\.png$/, "-menu.png") })

  const item = pagina.getByRole("button", { name: /configurac/i }).first()
  const achou = await item.count()
  console.log(`item "Configuracoes" no menu: ${achou > 0 ? "encontrado" : "NAO ENCONTRADO"}`)
  if (achou > 0) {
    await item.click({ timeout: 3000 }).catch(() => {})
    await pagina.waitForTimeout(2500)
    console.log(`url apos clicar: ${pagina.url().replace(base, "")}`)
    await pagina.screenshot({ path: destino.replace(/\.png$/, "-config.png") })
  }
} else {
  console.log("botao de menu nao encontrado na tela do atleta")
}

if (erros.length) {
  console.log(`\n${erros.length} erro(s) na tela:`)
  for (const e of [...new Set(erros)].slice(0, 6)) console.log(`   ${e}`)
} else {
  console.log("\nnenhum erro de console/JS")
}

await navegador.close()
servidor.close()
