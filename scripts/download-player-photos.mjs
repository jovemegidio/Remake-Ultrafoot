// ─────────────────────────────────────────────────────────────────────────────
// Baixa FOTOS DE JOGADORES dos sites oficiais dos clubes brasileiros.
//
// Por que os sites dos clubes (e nao Transfermarkt):
//   o jogo guarda APELIDOS ("Yuri Alberto", "Memphis", "Arthurzinho") e os sites
//   dos clubes usam exatamente esses nomes — o TM usa nome legal completo, o que
//   derrubava a taxa de match.
//
// As paginas de elenco sao renderizadas por JavaScript, entao usamos Playwright
// (headless) em vez de fetch/curl.
//
// Fluxo:
//   1. le os times BR + seus jogadores de data/seeds/bf2026-teams.json
//   2. renderiza a pagina de elenco de cada clube e extrai candidatos {nome, img}
//   3. casa o nome do site com o nome do jogo (normalizado)
//   4. baixa a foto -> public/jogadores/{slug}.jpg
//   5. registra em data/seeds/player_photo_overrides.json  (SEM esse mapa o jogo
//      NAO mostra a foto, mesmo com o arquivo no disco)
//
// Uso:
//   node scripts/download-player-photos.mjs                # todos os clubes do mapa
//   node scripts/download-player-photos.mjs --club palmeiras
//   node scripts/download-player-photos.mjs --dry          # nao baixa, so relata
// ─────────────────────────────────────────────────────────────────────────────
import { chromium } from "@playwright/test"
import { readFile, writeFile, mkdir } from "node:fs/promises"
import { existsSync } from "node:fs"
import path from "node:path"

const ROOT = process.cwd()
const SEEDS = path.join(ROOT, "data", "seeds", "bf2026-teams.json")
const OVERRIDES = path.join(ROOT, "data", "seeds", "player_photo_overrides.json")
const PHOTOS_DIR = path.join(ROOT, "public", "jogadores")

// Paginas oficiais de elenco. Chave = fileKey do time no jogo.
const CLUB_SQUAD_URLS = {
  palmeiras:          "https://www.palmeiras.com.br/elenco/",
  corinthians_bra:    "https://www.corinthians.com.br/futebol/elenco",
  saopaulo_bra:       "https://www.saopaulofc.net/futebol-masculino/elenco/",
  santos:             "https://www.santosfc.com.br/elenco/",
  flarj:              "https://www.flamengo.com.br/elenco",
  flurj:              "https://www.fluminense.com.br/elenco/",
  botafogorj_bra:     "https://www.botafogo.com.br/elenco",
  vasco:              "https://www.vasco.com.br/elenco/",
  gremio:             "https://gremio.net/elenco/",
  internacional_bra:  "https://www.internacional.com.br/elenco",
  cruzeiro_bra:       "https://www.cruzeiro.com.br/elenco/",
  atleticomg_bra:     "https://www.atletico.com.br/elenco/",
  bahia:              "https://www.esporteclubebahia.com.br/elenco/",
  fortaleza:          "https://www.fortalezaec.net/elenco",
  vitoria:            "https://www.ecvitoria.com.br/elenco/",
  atleticopr_bra:     "https://athletico.com.br/elenco/",
}

// Mesma normalizacao de lib/player-photos.ts (normalizePlayerKey).
function normalizeKey(name) {
  return String(name)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
}

const args = process.argv.slice(2)
const onlyClub = args.includes("--club") ? args[args.indexOf("--club") + 1] : null
const dryRun = args.includes("--dry")

const teams = JSON.parse(await readFile(SEEDS, "utf8"))
const teamList = Array.isArray(teams) ? teams : Object.values(teams)

const overrides = existsSync(OVERRIDES)
  ? JSON.parse(await readFile(OVERRIDES, "utf8"))
  : {}

await mkdir(PHOTOS_DIR, { recursive: true })

const browser = await chromium.launch({ headless: true })
const ctx = await browser.newContext({
  viewport: { width: 1440, height: 2200 },
  userAgent:
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36",
})

const summary = []

for (const [fileKey, url] of Object.entries(CLUB_SQUAD_URLS)) {
  if (onlyClub && fileKey !== onlyClub) continue

  const team = teamList.find(t => t.fileKey === fileKey)
  if (!team || !Array.isArray(team.players) || team.players.length === 0) {
    summary.push({ fileKey, status: "sem jogadores no seed", baixadas: 0 })
    continue
  }

  // nome-normalizado -> nome original do jogo
  const wanted = new Map(team.players.map(p => [normalizeKey(p), p]))

  const page = await ctx.newPage()
  let candidates = []
  try {
    await page.goto(url, { waitUntil: "networkidle", timeout: 45000 })
    await page.waitForTimeout(2500) // deixa lazy-load/carrossel montar

    // Heuristica generica: toda imagem que tenha um nome plausivel por perto
    // (alt, title, ou o texto do card/figure que a contem).
    candidates = await page.evaluate(() => {
      const out = []
      const imgs = Array.from(document.querySelectorAll("img"))
      for (const img of imgs) {
        const src = img.currentSrc || img.src || img.getAttribute("data-src") || ""
        if (!src || src.startsWith("data:")) continue
        // ignora icones/logos minusculos
        const w = img.naturalWidth || img.width || 0
        const h = img.naturalHeight || img.height || 0
        if (w && h && (w < 60 || h < 60)) continue

        const card = img.closest("figure, article, li, .card, [class*='player'], [class*='jogador'], [class*='atleta']")
        const nearText = card ? (card.innerText || "").trim().split("\n")[0] : ""
        const name = (img.alt || img.title || nearText || "").trim()
        if (!name || name.length < 3 || name.length > 40) continue
        out.push({ name, src })
      }
      return out
    })
  } catch (e) {
    summary.push({ fileKey, status: "falha ao abrir: " + String(e.message).split("\n")[0], baixadas: 0 })
    await page.close()
    continue
  }

  // Casa candidatos do site com os jogadores do jogo
  const matches = new Map() // slug -> src
  for (const c of candidates) {
    const slug = normalizeKey(c.name)
    if (wanted.has(slug) && !matches.has(slug)) matches.set(slug, c.src)
  }

  let baixadas = 0
  for (const [slug, src] of matches) {
    const dest = path.join(PHOTOS_DIR, `${slug}.jpg`)
    if (dryRun) { baixadas++; continue }
    try {
      const resp = await ctx.request.get(src, { timeout: 25000 })
      if (!resp.ok()) continue
      const buf = await resp.body()
      if (buf.length < 2000) continue // provavelmente placeholder
      await writeFile(dest, buf)
      overrides[slug] = `/jogadores/${slug}.jpg`
      baixadas++
    } catch { /* ignora foto individual que falhar */ }
  }

  summary.push({
    fileKey,
    status: "ok",
    jogadoresNoJogo: team.players.length,
    candidatosNoSite: candidates.length,
    baixadas,
  })
  console.log(`${fileKey.padEnd(20)} elenco=${String(team.players.length).padStart(3)}  candidatos=${String(candidates.length).padStart(3)}  fotos=${baixadas}`)
  await page.close()
}

await browser.close()

if (!dryRun) {
  await writeFile(OVERRIDES, JSON.stringify(overrides, null, 2))
}

console.log("\n===== RESUMO =====")
const total = summary.reduce((s, r) => s + (r.baixadas || 0), 0)
for (const r of summary) {
  if (r.status !== "ok") console.log(`FALHA ${r.fileKey}: ${r.status}`)
}
console.log(`\nFotos baixadas: ${total}${dryRun ? " (dry-run, nada gravado)" : ""}`)
console.log(`Mapa de overrides: ${Object.keys(overrides).length} entradas`)
