// Verifica a navegacao do header: a tecla "W" (e o clique na secao pai) devem ABRIR
// um MENU de navegacao com as paginas do jogo; escolher um item navega; Esc fecha.
//
// Historico: o bug original era "nao conseguia sair para o Escritorio, nem clicando
// nem pela tecla W" (W era so um keycap decorativo). Primeiro W passou a navegar direto
// para a secao pai; depois o usuario pediu explicitamente que W abrisse um MENU com as
// opcoes de todas as paginas. Este teste cobre esse contrato novo.
import { chromium } from "@playwright/test"
import { createServer } from "node:http"
import { readFile, stat } from "node:fs/promises"
import { existsSync } from "node:fs"
import path from "node:path"
import { assertFreshBuild } from "./qa-lib.mjs"
assertFreshBuild()
const outDir = path.resolve("out")
const mime = new Map([[".html","text/html; charset=utf-8"],[".js","text/javascript"],[".css","text/css"],[".json","application/json"],[".png","image/png"],[".jpg","image/jpeg"],[".svg","image/svg+xml"],[".woff2","font/woff2"]])
function rr(u){const d=decodeURIComponent(u.split("?")[0]);const c=d==="/"?"/index.html":d;const r=path.join(outDir,c);if(existsSync(r))return r;if(!path.extname(c)){const i=path.join(outDir,c,"index.html");if(existsSync(i))return i}return r}
const srv=createServer(async(q,s)=>{try{const t=path.resolve(rr(q.url??"/"));const st=await stat(t);const fp=st.isDirectory()?path.join(t,"index.html"):t;const b=await readFile(fp);s.writeHead(200,{"content-type":mime.get(path.extname(fp).toLowerCase())??"application/octet-stream","cache-control":"no-store"});s.end(b)}catch{s.writeHead(404);s.end("nf")}})
await new Promise(r=>srv.listen(0,"127.0.0.1",r))
const base=`http://127.0.0.1:${srv.address().port}`
const browser=await chromium.launch({headless:true})
let failures=0
const ok=m=>console.log("OK "+m), fail=m=>{console.log("XX "+m);failures++}
async function newPage(){const p=await browser.newPage();await p.addInitScript(()=>{localStorage.setItem("ultrafoot:save",JSON.stringify({version:4,selectedTeamShort:"FLA",managerName:"QA",season:2026,week:0,language:"pt-BR",selectedUniform:"home",createdAt:Date.now(),updatedAt:Date.now(),multiplayerEnabled:false,managers:[],activeManagerId:null,controllerType:"playstation",controllerBindings:{}}));sessionStorage.setItem("ultrafoot:session-active","true")});return p}
const P=x=>new URL(x).pathname
const menu=p=>p.getByText("Ir para",{exact:true})

// 1) Tecla W abre o menu de navegacao
{const p=await newPage();await p.goto(`${base}/competicoes/`,{waitUntil:"networkidle",timeout:30000});await p.waitForTimeout(1200)
 await p.locator("body").click({position:{x:500,y:400}});await p.keyboard.press("w");await p.waitForTimeout(600)
 ;(await menu(p).isVisible().catch(()=>false))?ok("tecla W abre o menu de navegacao"):fail("tecla W nao abriu o menu");await p.close()}

// 2) Escolher um item do menu navega para a pagina
{const p=await newPage();await p.goto(`${base}/competicoes/`,{waitUntil:"networkidle",timeout:30000});await p.waitForTimeout(1200)
 await p.locator("body").click({position:{x:500,y:400}});await p.keyboard.press("w");await p.waitForTimeout(600)
 await p.getByRole("button",{name:/^Financas$/i}).click().catch(()=>{});await p.waitForTimeout(1500)
 P(p.url())==="/financas/"?ok('menu -> "Financas" navega para /financas'):fail(`menu -> Financas foi para ${P(p.url())}`);await p.close()}

// 3) Esc fecha o menu
{const p=await newPage();await p.goto(`${base}/mercado/`,{waitUntil:"networkidle",timeout:30000});await p.waitForTimeout(1200)
 await p.locator("body").click({position:{x:500,y:400}});await p.keyboard.press("w");await p.waitForTimeout(500)
 const opened=await menu(p).isVisible().catch(()=>false)
 await p.keyboard.press("Escape");await p.waitForTimeout(500)
 const closed=!(await menu(p).isVisible().catch(()=>false))
 ;(opened&&closed)?ok("Esc fecha o menu de navegacao"):fail(`Esc nao fechou o menu (aberto=${opened} fechado=${closed})`);await p.close()}

// 4) Clique na secao pai (breadcrumb) tambem abre o menu
{const p=await newPage();await p.goto(`${base}/competicoes/`,{waitUntil:"networkidle",timeout:30000});await p.waitForTimeout(1200)
 await p.getByRole("button",{name:/escritorio/i}).first().click().catch(()=>{});await p.waitForTimeout(600)
 ;(await menu(p).isVisible().catch(()=>false))?ok("clique na secao pai abre o menu"):fail("clique na secao pai nao abriu o menu");await p.close()}

await browser.close();srv.close()
console.log(failures?`\nRESULTADO: ${failures} problema(s) de navegacao`:"\nRESULTADO: OK — menu de navegacao (W) funcionando")
process.exitCode=failures?1:0
