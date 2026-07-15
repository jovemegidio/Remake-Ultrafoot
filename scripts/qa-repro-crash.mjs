// Reproduz o carregamento do OFFICE com o save REAL do usuario e captura o erro de JS.
//
// "This page couldn't load" no WebView2 apos selecionar o time = a pagina do office falha
// ao renderizar/hidratar. Aqui servimos o build (out/), injetamos o store do usuario no
// localStorage (o persistent-store cai nele fora do Tauri), navegamos para "/" e
// capturamos console.error, pageerror e travas.
//
// Uso: node scripts/qa-repro-crash.mjs "<pasta com uf-store-all.json>"

import { chromium } from "@playwright/test"
import { createServer } from "node:http"
import { readFile, stat } from "node:fs/promises"
import { existsSync } from "node:fs"
import path from "node:path"

const STORE_DIR = process.argv[2]
if (!STORE_DIR) { console.error("informe a pasta do uf-store-all.json"); process.exit(1) }

const storeAll = JSON.parse(await readFile(path.join(STORE_DIR, "uf-store-all.json"), "utf8"))

const outDir = path.resolve("out")
const mime = new Map([[".html","text/html; charset=utf-8"],[".js","text/javascript"],[".css","text/css"],[".json","application/json"],[".png","image/png"],[".jpg","image/jpeg"],[".svg","image/svg+xml"],[".woff2","font/woff2"]])
function rr(u){const d=decodeURIComponent(u.split("?")[0]);const c=d==="/"?"/index.html":d;const r=path.join(outDir,c);if(existsSync(r))return r;if(!path.extname(c)){const i=path.join(outDir,c,"index.html");if(existsSync(i))return i}return r}
const srv=createServer(async(q,s)=>{try{const t=path.resolve(rr(q.url??"/"));const st=await stat(t);const fp=st.isDirectory()?path.join(t,"index.html"):t;const b=await readFile(fp);s.writeHead(200,{"content-type":mime.get(path.extname(fp).toLowerCase())??"application/octet-stream","cache-control":"no-store"});s.end(b)}catch{s.writeHead(404);s.end("nf")}})
await new Promise(r=>srv.listen(0,"127.0.0.1",r))
const base=`http://127.0.0.1:${srv.address().port}`

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage()

const errors = []
page.on("console", (m) => { if (m.type() === "error") errors.push("CONSOLE: " + m.text()) })
page.on("pageerror", (e) => errors.push("PAGEERROR: " + (e.stack || e.message)))

// Injeta o store do usuario no localStorage ANTES de qualquer script rodar.
// Injeta SO o estado do jogo (save + engine + chaves pequenas). As imagens base64
// (ultrafoot:logo:*, team-override) nao sao necessarias para o office carregar e estouram
// a cota do localStorage do navegador — no Tauri elas ficam em arquivo, sem cota.
const slim = Object.fromEntries(
  Object.entries(storeAll).filter(
    ([k]) => !k.startsWith("ultrafoot:logo:") && !k.startsWith("ultrafoot:team-override:"),
  ),
)
await page.addInitScript((store) => {
  for (const [k, v] of Object.entries(store)) {
    try { localStorage.setItem(k, typeof v === "string" ? v : JSON.stringify(v)) }
    catch (e) { console.error("skip " + k + ": " + e.message) }
  }
  sessionStorage.setItem("ultrafoot:session-active", "true")
}, slim)

console.log("navegando para o OFFICE (/) com o save real...")
try {
  await page.goto(`${base}/`, { waitUntil: "networkidle", timeout: 20000 })
} catch (e) {
  errors.push("GOTO: " + e.message)
}
await page.waitForTimeout(2500)

// Estado final: ficou no office, redirecionou, ou travou?
const finalUrl = page.url()
const bodyText = await page.evaluate(() => document.body.innerText.slice(0, 200)).catch(() => "(sem body)")

console.log("\nURL final:", finalUrl.replace(base, "") || "/")
console.log("conteudo:", JSON.stringify(bodyText.replace(/\s+/g, " ").trim()))

console.log("\n=== ERROS CAPTURADOS (" + errors.length + ") ===")
if (errors.length === 0) console.log("(nenhum erro de JS — o office carregou)")
for (const e of errors.slice(0, 12)) console.log("  " + e.replace(/\n/g, "\n    ").slice(0, 400))

await browser.close()
srv.close()
process.exitCode = errors.length ? 1 : 0
