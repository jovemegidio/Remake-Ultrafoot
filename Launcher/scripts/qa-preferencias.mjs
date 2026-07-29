// QA das preferências do launcher — tema e FONTE, num navegador de verdade.
//
//   node scripts/qa-preferencias.mjs
//
// Existe porque eu "corrigi" a troca de fonte uma vez raciocinando sobre
// especificidade de CSS, e a fonte continuou não trocando. Aqui a pergunta é
// respondida pelo próprio motor de renderização: qual é o `font-family`
// COMPUTADO de um texto real depois de aplicar a preferência.
//
// Roda sobre o `out/` já buildado — é exatamente o que vai para o instalador.

import { chromium } from "@playwright/test"
import { createServer } from "node:http"
import { readFile } from "node:fs/promises"
import path from "node:path"

const RAIZ = path.resolve(import.meta.dirname, "..")
const SAIDA = path.join(RAIZ, "out")

// SERVIR POR HTTP, nao abrir por file://.
//
// A exportacao do Next referencia `/_next/...` com caminho ABSOLUTO. Sob
// `file://` isso aponta para a raiz do disco, nada carrega, e a pagina fica sem
// CSS nenhum — foi o que aconteceu na primeira tentativa: TUDO falhou, inclusive
// o tema, que funciona. Um teste que falha por motivo errado e pior que teste
// nenhum.
const TIPOS = {
  ".html": "text/html", ".js": "text/javascript", ".css": "text/css",
  ".json": "application/json", ".woff2": "font/woff2", ".png": "image/png",
  ".svg": "image/svg+xml", ".jpg": "image/jpeg", ".ico": "image/x-icon",
}
const servidor = createServer(async (req, res) => {
  try {
    const url = decodeURIComponent((req.url ?? "/").split("?")[0])
    let arquivo = path.join(SAIDA, url === "/" ? "index.html" : url)
    if (!path.extname(arquivo)) arquivo = path.join(arquivo, "index.html")
    const dados = await readFile(arquivo)
    res.writeHead(200, { "Content-Type": TIPOS[path.extname(arquivo)] ?? "application/octet-stream" })
    res.end(dados)
  } catch {
    res.writeHead(404).end("nao encontrado")
  }
})
await new Promise(ok => servidor.listen(4599, ok))
const PAGINA = "http://127.0.0.1:4599/"

let falhas = 0
const checar = (nome, ok, detalhe = "") => {
  if (!ok) falhas++
  console.log(`${ok ? "OK   " : "FALHA"} ${nome}${detalhe ? "  — " + detalhe : ""}`)
}

const navegador = await chromium.launch()
const pagina = await navegador.newPage()
await pagina.goto(PAGINA)
// O launcher monta em cliente; sem esperar, medimos a tela de carregamento.
await pagina.waitForTimeout(2500)

async function aplicar(prefs) {
  await pagina.evaluate((p) => {
    localStorage.setItem("ultrafoot-launcher:preferencias", JSON.stringify(p))
  }, prefs)
  await pagina.reload()
  await pagina.waitForTimeout(2500)
}

const fonteDe = (seletor) =>
  pagina.evaluate((s) => {
    const el = document.querySelector(s)
    return el ? getComputedStyle(el).fontFamily : "(elemento nao encontrado)"
  }, seletor)

const varDe = (nome) =>
  pagina.evaluate((n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim(), nome)

// ─── Fonte padrão ────────────────────────────────────────────────────────────
const padraoBody = await fonteDe("body")
console.log(`   fonte do body com o padrão: ${padraoBody}`)

// ─── Trocar para uma fonte bem diferente ─────────────────────────────────────
await aplicar({ tema: "ultrafoot", fonte: "playfair", tamanhoTexto: 100 })
const comPlayfair = await fonteDe("body")
console.log(`   fonte do body com Playfair: ${comPlayfair}`)
checar("trocar a fonte muda o font-family computado do body",
  comPlayfair !== padraoBody && /playfair/i.test(comPlayfair), comPlayfair)

// Um texto qualquer dentro da árvore precisa herdar — não adianta só o body.
const comPlayfairTexto = await fonteDe("h1, h2, p, span")
checar("o texto da tela também usa a fonte escolhida",
  /playfair/i.test(comPlayfairTexto), comPlayfairTexto)

// ─── Outra fonte, para garantir que não é coincidência ───────────────────────
await aplicar({ tema: "ultrafoot", fonte: "bebas", tamanhoTexto: 100 })
const comBebas = await fonteDe("body")
checar("uma segunda fonte também é aplicada", /bebas/i.test(comBebas), comBebas)

// ─── Tema ────────────────────────────────────────────────────────────────────
await aplicar({ tema: "brasa", fonte: "padrao", tamanhoTexto: 100 })
const primaria = await varDe("--primary")
checar("o tema troca a cor primária", primaria.toLowerCase().includes("ff8a4c"), primaria)

// O FUNDO e o que diferencia um tema do outro — checar so a cor de destaque
// deixaria passar 20 temas praticamente identicos, que foi a reclamacao.
const fundoDoTema = () => pagina.evaluate(() => {
  const alvo = document.querySelector(".launcher-shell") ?? document.body
  return getComputedStyle(alvo).backgroundImage
})
const fundoBrasa = await fundoDoTema()
checar("o tema pinta um fundo proprio", fundoBrasa.includes("gradient"), fundoBrasa.slice(0, 60))

await aplicar({ tema: "oceano", fonte: "padrao", tamanhoTexto: 100 })
const fundoOceano = await fundoDoTema()
checar("temas diferentes tem fundos diferentes", fundoOceano !== fundoBrasa,
  fundoOceano === fundoBrasa ? "os dois sao iguais" : "ok")

// ─── Tamanho do texto ────────────────────────────────────────────────────────
await aplicar({ tema: "ultrafoot", fonte: "padrao", tamanhoTexto: 130 })
const raizFonte = await pagina.evaluate(() => getComputedStyle(document.documentElement).fontSize)
checar("o tamanho do texto é aplicado na raiz", raizFonte === "20.8px", raizFonte)

await navegador.close()
servidor.close()
console.log(falhas === 0 ? "\nRESULTADO: TUDO OK" : `\nRESULTADO: ${falhas} FALHA(S)`)
process.exit(falhas === 0 ? 0 : 1)
