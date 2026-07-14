// Reproduz: "os nomes dos jogadores nao aparecem no Gerenciamento".
//
// Compara o elenco RENDERIZADO em /elenco/gerenciamento com os jogadores REAIS do
// clube no seed. Se a tela mostrar nomes que nao existem no elenco do time, ela esta
// caindo no elenco MOCK (buildElencoPlayers volta playersData/benchData quando nao
// encontra >= 11 jogadores reais).
//
// Roda para varios clubes, para separar "bug do time europeu" de "bug geral".
//
// Uso: npm run build:qa && node scripts/qa-squad-names.mjs

import { chromium } from "@playwright/test"
import { createServer } from "node:http"
import { readFile, stat, readFile as rf } from "node:fs/promises"
import { existsSync, readFileSync } from "node:fs"
import path from "node:path"
import { assertFreshBuild } from "./qa-lib.mjs"

assertFreshBuild()

const outDir = path.resolve("out")
const mime = new Map([
  [".html", "text/html; charset=utf-8"], [".js", "text/javascript"], [".css", "text/css"],
  [".json", "application/json"], [".png", "image/png"], [".jpg", "image/jpeg"],
  [".svg", "image/svg+xml"], [".woff2", "font/woff2"],
])
function resolveReq(u) {
  const d = decodeURIComponent(u.split("?")[0])
  const c = d === "/" ? "/index.html" : d
  const r = path.join(outDir, c)
  if (existsSync(r)) return r
  if (!path.extname(c)) {
    const i = path.join(outDir, c, "index.html")
    if (existsSync(i)) return i
  }
  return r
}
const srv = createServer(async (q, s) => {
  try {
    const t = path.resolve(resolveReq(q.url ?? "/"))
    const st = await stat(t)
    const fp = st.isDirectory() ? path.join(t, "index.html") : t
    const b = await readFile(fp)
    s.writeHead(200, { "content-type": mime.get(path.extname(fp).toLowerCase()) ?? "application/octet-stream", "cache-control": "no-store" })
    s.end(b)
  } catch { s.writeHead(404); s.end("nf") }
})
await new Promise((r) => srv.listen(0, "127.0.0.1", r))
const base = `http://127.0.0.1:${srv.address().port}`

// Fonte da verdade do elenco:
//  - clubes das ligas importadas (La Liga, Premier, Italia, Franca, Serie B/C) usam o
//    ELENCO REAL do CSV (data/seeds/real-positions.json). Ex.: Barcelona mostra o Barca
//    de verdade, que difere do seed antigo — o seed nao e mais a verdade para eles.
//  - os demais seguem o seed (imported-bf2026.json).
const seed = JSON.parse(readFileSync("data/seeds/imported-bf2026.json", "utf8"))
const seedTeams = seed.teams ?? []
const realPositions = JSON.parse(readFileSync("data/seeds/real-positions.json", "utf8"))

// Mesma normalizacao de clube do jogo (tira "FC"/"AC" etc): "Barcelona" -> "barcelona".
function clubKey(s) {
  return (s || "")
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase().replace(/[^a-z0-9]/g, "")
    .replace(/^(fc|cf|ac|as|rc|sc|ss|afc|rcd|ud|cd|sv|ogc|losc|stade)/, "")
    .replace(/(fc|cf|cfc|ac|sc|afc|club)$/, "")
    .replace(/^olympiquede/, "olympique")
}

function realSquad(nome) {
  const real = realPositions[clubKey(nome)]
  if (real?.length) return real.map((p) => p.nome).filter(Boolean)
  const t = seedTeams.find((x) => (x.nome || "").toLowerCase() === nome.toLowerCase())
  return (t?.jogadores ?? []).map((p) => p.nome).filter(Boolean)
}

// short = como o save identifica; nome = como o teams-data chama.
const CLUBS = [
  { short: "JVT", nome: "Juventus" },
  { short: "BAR", nome: "Barcelona" },
  { short: "PAL", nome: "Palmeiras" },
  { short: "FLA", nome: "Flamengo" },
]

// A tela mostra SOBRENOME ("Vlahovic"); o seed guarda o nome completo ("Dusan Vlahovic").
const surname = (n) => n.trim().split(/\s+/).pop().toLowerCase()

// O elenco do RB Bragantino e o default do bug: a pagina cai em getTeamByShort("BGT")
// quando o save ainda nao hidratou. Se estes nomes aparecem para OUTRO clube, o
// useState congelou o elenco errado.
const BGT_MARKERS = ["nascimento", "sant’anna", "sant'anna", "vanderlan"]

const browser = await chromium.launch({ headless: true })
let failures = 0
const squads = new Map()

for (const club of CLUBS) {
  const real = realSquad(club.nome).map(surname)
  const page = await browser.newPage()

  await page.addInitScript((short) => {
    const save = {
      version: 4, selectedTeamShort: short, managerName: "QA", season: 2026, week: 0,
      language: "pt-BR", selectedUniform: "home", createdAt: Date.now(), updatedAt: Date.now(),
      multiplayerEnabled: false, managers: [], activeManagerId: null,
      controllerType: "playstation", controllerBindings: {},
    }
    // NOTA: aqui o localStorage e SINCRONO, entao o save ja esta disponivel no primeiro
    // render. Isto testa o caminho normal: cada clube deve receber o SEU elenco.
    //
    // O bug original so aparecia com hidratacao ASSINCRONA (o persistent-store do Tauri
    // le do disco). Tentei simular atrasando o getItem, mas isso envenena o cache interno
    // do store e a pagina fica presa em "carregando" — a simulacao media o proprio erro
    // dela. O bug foi entao morto na origem: a pagina nao tem mais time default ("BGT"),
    // logo nao existe caminho que monte elenco de um clube errado, sincrono ou nao.
    localStorage.setItem("ultrafoot:save", JSON.stringify(save))
    sessionStorage.setItem("ultrafoot:session-active", "true")
  }, club.short)

  // As DUAS telas que montam elenco. A escalacao tinha uma copia byte a byte do
  // gerenciamento — e o mesmo bug. Se uma divergir da outra, o teste pega.
  const ROTAS = ["/elenco/gerenciamento/", "/partida/escalacao/"]
  let text = ""
  for (const rota of ROTAS) {
    await page.goto(`${base}${rota}`, { waitUntil: "networkidle", timeout: 30000 })
    await page.waitForTimeout(1500)
    const t = await page.evaluate(() => document.body.innerText.toLowerCase())
    text += " " + t
    squads.set(`${club.short}${rota}`, t.slice(0, 900))
  }

  const found = real.filter((s) => text.includes(s))
  const pct = real.length ? Math.round((found.length / real.length) * 100) : 0
  const label = `${club.nome} (${club.short})`.padEnd(22)

  // 1) O elenco do Bragantino nao pode vazar para outro clube.
  const leaked = club.short !== "BGT" && BGT_MARKERS.filter((m) => text.includes(m)).length >= 2
  if (leaked) {
    console.log(`XX ${label} mostra o elenco do RB BRAGANTINO (default "BGT" congelado pelo useState)`)
    failures++
  } else if (real.length === 0) {
    console.log(`?? ${label} sem elenco no seed — nada a comparar`)
  } else if (pct < 40) {
    console.log(`XX ${label} so ${found.length}/${real.length} (${pct}%) dos jogadores do clube aparecem`)
    failures++
  } else {
    console.log(`OK ${label} ${found.length}/${real.length} (${pct}%) jogadores do clube na tela`)
  }

  await page.close()
}

// 2) Dois clubes DIFERENTES nao podem renderizar o mesmo elenco — era o sintoma
//    (todo clube exibindo os jogadores do Bragantino).
//    So comparamos a MESMA tela entre clubes distintos: o mesmo clube em telas
//    diferentes DEVE ter o mesmo elenco (e o ponto do fix), entao nao e falha.
const keys = [...squads.keys()]
for (let i = 0; i < keys.length; i++) {
  for (let j = i + 1; j < keys.length; j++) {
    const [aShort, aRota] = [keys[i].slice(0, 3), keys[i].slice(3)]
    const [bShort, bRota] = [keys[j].slice(0, 3), keys[j].slice(3)]
    if (aShort === bShort) continue      // mesmo clube: elenco igual e o esperado
    if (aRota !== bRota) continue        // compara tela contra a mesma tela
    if (squads.get(keys[i]) === squads.get(keys[j])) {
      console.log(`XX ${aShort} e ${bShort} renderizam o MESMO elenco em ${aRota}`)
      failures++
    }
  }
}

// 3) SEM SAVE (o estado do primeiro render, antes da hidratacao no Tauri).
//
//    Este e o cheque que prova o fix. O bug era um time DEFAULT: sem save, a pagina caia
//    em getTeamByShort("BGT") e montava o elenco do RB Bragantino — que o useState entao
//    congelava para sempre, mesmo depois do clube real chegar.
//    Nao da para simular a hidratacao assincrona do Tauri neste harness (o localStorage
//    do navegador e sincrono), mas da para testar o ESTADO EQUIVALENTE: sem time, a tela
//    NAO pode inventar um elenco. Deve dizer que esta carregando.
{
  const page = await browser.newPage()
  await page.addInitScript(() => {
    localStorage.removeItem("ultrafoot:save")          // sem save = sem time
    sessionStorage.setItem("ultrafoot:session-active", "true")
  })

  for (const rota of ["/elenco/gerenciamento/", "/partida/escalacao/"]) {
    await page.goto(`${base}${rota}`, { waitUntil: "networkidle", timeout: 30000 })
    await page.waitForTimeout(1200)
    const text = (await page.evaluate(() => document.body.innerText)).toLowerCase()

    const leaked = BGT_MARKERS.filter((m) => text.includes(m)).length >= 2
    if (leaked) {
      console.log(`XX sem save, ${rota} monta o elenco do RB BRAGANTINO (time default)`)
      failures++
    } else if (!text.includes("carregando")) {
      console.log(`XX sem save, ${rota} nao mostra "carregando" — o que ela esta exibindo?`)
      failures++
    } else {
      console.log(`OK sem save, ${rota} aguarda o time (nao inventa elenco)`)
    }
  }
  await page.close()
}

await browser.close()
srv.close()

console.log(failures ? `\nRESULTADO: ${failures} problema(s)` : "\nRESULTADO: OK — cada clube com o seu elenco")
process.exitCode = failures ? 1 : 0
