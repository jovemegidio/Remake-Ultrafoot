// Verifica a navegacao do header: clicar em "Escritorio" (secao pai) e a tecla W.
//
// Bug relatado: nao conseguia sair para o Escritorio, nem clicando nem pela tecla "W".
// A tecla W nunca foi implementada (o keycap era so decorativo); e o clique usava <Link>
// do Next, que no export estatico dentro do Tauri as vezes nao navega. Ambos passam a
// usar hardNavigate.
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

{const p=await newPage();await p.goto(`${base}/competicoes/`,{waitUntil:"networkidle",timeout:30000});await p.waitForTimeout(1500)
 await p.getByRole("link",{name:/escritorio/i}).first().click().catch(()=>{});await p.waitForTimeout(1500)
 P(p.url())==="/financas/"?ok('clique "Escritorio" -> /financas'):fail(`clique "Escritorio" foi para ${P(p.url())} (esperado /financas)`);await p.close()}

{const p=await newPage();await p.goto(`${base}/competicoes/`,{waitUntil:"networkidle",timeout:30000});await p.waitForTimeout(1500)
 await p.locator("body").click({position:{x:500,y:400}});await p.keyboard.press("w");await p.waitForTimeout(1500)
 P(p.url())==="/financas/"?ok("tecla W -> /financas"):fail(`tecla W ficou em ${P(p.url())} (esperado /financas)`);await p.close()}

{const p=await newPage();await p.goto(`${base}/mercado/`,{waitUntil:"networkidle",timeout:30000});await p.waitForTimeout(1500)
 await p.locator("body").click({position:{x:500,y:400}});await p.keyboard.press("w");await p.waitForTimeout(1500)
 P(p.url())==="/transferencias/"?ok("tecla W -> /transferencias"):fail(`tecla W ficou em ${P(p.url())}`);await p.close()}

await browser.close();srv.close()
console.log(failures?`\nRESULTADO: ${failures} problema(s) de navegacao`:"\nRESULTADO: OK — navegacao do header funcionando")
process.exitCode=failures?1:0
