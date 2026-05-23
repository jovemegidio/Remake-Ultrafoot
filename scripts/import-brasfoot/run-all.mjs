/**
 * ETAPA 3 — BF2026-27 import pipeline
 *
 * Run: node scripts/import-brasfoot/run-all.mjs
 *
 * Outputs:
 *  - public/escudos/      (team shield PNGs)
 *  - public/escudos-mini/ (mini shields)
 *  - public/escudos-selecoes/ (national team shields)
 *  - public/trofeus/      (trophy PNGs)
 *  - data/seeds/bf2026-teams.json
 *  - data/seeds/bf2026-leagues.json
 *  - assets-missing.md
 */

import { readdirSync, readFileSync, writeFileSync, copyFileSync, existsSync, mkdirSync } from "fs"
import { join, basename } from "path"
import { parseBan } from "./parse-ban.mjs"
import { parseCfg, parseCes } from "./parse-cfg.mjs"

import { fileURLToPath } from "url"
import { dirname } from "path"

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, "..", "..")
const BF_ROOT = join(ROOT, "BF2026-27", "BF2026-27")
const OUT_ESCUDOS = join(ROOT, "public", "escudos")
const OUT_ESCUDOS_MINI = join(ROOT, "public", "escudos-mini")
const OUT_SELECOES = join(ROOT, "public", "escudos-selecoes")
const OUT_TROFEUS = join(ROOT, "public", "trofeus")
const DATA_DIR = join(ROOT, "data", "seeds")

function ensureDir(p) {
  if (!existsSync(p)) mkdirSync(p, { recursive: true })
}

function copyDir(src, dest, ext = ".png") {
  ensureDir(dest)
  let copied = 0, missing = 0
  const files = readdirSync(src).filter(f => f.endsWith(ext))
  for (const file of files) {
    try {
      copyFileSync(join(src, file), join(dest, file))
      copied++
    } catch { missing++ }
  }
  return { copied, missing }
}

// ─── STEP 1: Copy shields ────────────────────────────────────────────────────
console.log("▶ Copying shields...")
ensureDir(OUT_ESCUDOS)
ensureDir(OUT_ESCUDOS_MINI)
ensureDir(OUT_SELECOES)
ensureDir(OUT_TROFEUS)

const shieldResult = copyDir(join(BF_ROOT, "teams", "escudos"), OUT_ESCUDOS)
const miniResult = copyDir(join(BF_ROOT, "teams", "escudosMini"), OUT_ESCUDOS_MINI)
const selResult = copyDir(join(BF_ROOT, "selecoes", "escudos"), OUT_SELECOES)
const trofResult = copyDir(join(BF_ROOT, "trofeus"), OUT_TROFEUS)
console.log(`  ✓ Shields:      ${shieldResult.copied} copied`)
console.log(`  ✓ Mini shields: ${miniResult.copied} copied`)
console.log(`  ✓ Seleções:     ${selResult.copied} copied`)
console.log(`  ✓ Troféus:      ${trofResult.copied} copied`)

// ─── STEP 2: Parse .ban files ────────────────────────────────────────────────
console.log("▶ Parsing .ban team files...")
const TEAMS_DIR = join(BF_ROOT, "teams")
const banFiles = readdirSync(TEAMS_DIR).filter(f => f.endsWith(".ban"))

const teams = []
const missingShields = []
let parsed = 0, failed = 0

for (const file of banFiles) {
  const result = parseBan(join(TEAMS_DIR, file))
  if (!result) { failed++; continue }

  const shieldPath = join(OUT_ESCUDOS, `${result.fileKey}.png`)
  const hasShield = existsSync(shieldPath)
  if (!hasShield) missingShields.push(result.fileKey)

  teams.push({
    id: `bf_${result.fileKey}`,
    fileKey: result.fileKey,
    nome: result.nome,
    curto: result.fileKey.split("_")[0].substring(0, 5).toUpperCase(),
    cor1: result.cor1,
    cor2: result.cor2,
    pais: result.pais,
    estadio: result.estadio,
    tecnico: result.tecnico,
    liga: result.countryCode.toUpperCase(),
    divisao: result.countryCode.toUpperCase(),
    prestigio: 50,
    saldo: 10_000_000,
    escudo: `/escudos/${result.fileKey}.png`,
    players: result.players,
    hasShield,
    source: "bf2026",
  })
  parsed++
}
console.log(`  ✓ Parsed: ${parsed}  Failed: ${failed}  Missing shields: ${missingShields.length}`)

// ─── STEP 3: Parse league .cfg files ─────────────────────────────────────────
console.log("▶ Parsing .cfg league files...")
const CFG_DIR = join(BF_ROOT, "conf_ligas_nacionais")
const CES_DIR = join(BF_ROOT, "conf_estadual")

const leagues = []
for (const file of readdirSync(CFG_DIR).filter(f => f.endsWith(".cfg"))) {
  const result = parseCfg(join(CFG_DIR, file))
  if (result) leagues.push({ ...result, type: "nacional" })
}
for (const file of readdirSync(CES_DIR).filter(f => f.endsWith(".ces"))) {
  const result = parseCes(join(CES_DIR, file))
  if (result) leagues.push({ ...result, type: "estadual" })
}
console.log(`  ✓ Leagues: ${leagues.length}`)

// ─── STEP 4: Write JSON seeds ────────────────────────────────────────────────
console.log("▶ Writing seed JSON files...")
ensureDir(DATA_DIR)
writeFileSync(join(DATA_DIR, "bf2026-teams.json"), JSON.stringify(teams, null, 2), "utf-8")
writeFileSync(join(DATA_DIR, "bf2026-leagues.json"), JSON.stringify(leagues, null, 2), "utf-8")
console.log(`  ✓ data/seeds/bf2026-teams.json (${teams.length} teams)`)
console.log(`  ✓ data/seeds/bf2026-leagues.json (${leagues.length} competitions)`)

// ─── STEP 5: Generate assets-missing.md ──────────────────────────────────────
const missingLines = missingShields.map(k => `- \`/escudos/${k}.png\` — sem escudo no pack BF2026-27`).join("\n")
const missingReport = `# Assets Faltantes — BF2026-27 Import

Gerado em: ${new Date().toISOString()}

## Escudos sem imagem (${missingShields.length})

${missingLines || "Nenhum escudo faltante!"}

## Resumo

| Tipo | Total |
|------|-------|
| Times parseados | ${parsed} |
| Times falhou parse | ${failed} |
| Shields copiadas | ${shieldResult.copied} |
| Mini shields copiadas | ${miniResult.copied} |
| Shields faltantes | ${missingShields.length} |
| Ligas nacionais | ${leagues.filter(l => l.type === "nacional").length} |
| Competições estaduais | ${leagues.filter(l => l.type === "estadual").length} |
`
writeFileSync(join(ROOT, "assets-missing.md"), missingReport, "utf-8")
console.log("  ✓ assets-missing.md")

// ─── STEP 6: Generate public/data/teams-index.json ───────────────────────────
console.log("▶ Generating teams-index.json...")
await import("./generate-index.mjs")
console.log("\n✅ Import completo!")
