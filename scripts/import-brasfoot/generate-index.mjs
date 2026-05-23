/**
 * Generates public/data/teams-index.json from data/seeds/bf2026-teams.json.
 * Enriches teams with:
 *  - proper liga names (from bf2026-leagues.json)
 *  - better prestige estimates (player count + team rank within country)
 *  - escudoDisponivel flag
 *  - nJogadores count
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs"
import { join, dirname } from "path"
import { fileURLToPath } from "url"

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, "..", "..")
const DATA_OUT = join(ROOT, "public", "data")

const rawTeams = JSON.parse(readFileSync(join(ROOT, "data", "seeds", "bf2026-teams.json"), "utf-8"))
const rawLeagues = JSON.parse(readFileSync(join(ROOT, "data", "seeds", "bf2026-leagues.json"), "utf-8"))

// Build league name map: countryCode → [{nome, divisao}]
const leagueMap = new Map()
for (const lg of rawLeagues) {
  if (lg.type === "nacional" && lg.divisions?.length) {
    leagueMap.set(lg.countryCode.toUpperCase(), lg.divisions)
  }
}

// Country code → Portuguese country name (same as parse-ban.mjs)
const COUNTRY_NAMES = {
  BRA: "Brasil",     ARG: "Argentina",  BOL: "Bolívia",   CHI: "Chile",
  COL: "Colômbia",   EQU: "Equador",    PAR: "Paraguai",  PER: "Peru",
  URU: "Uruguai",    VEN: "Venezuela",
  ING: "Inglaterra", ESP: "Espanha",    ALE: "Alemanha",  ITA: "Itália",
  FRA: "França",     POR: "Portugal",   HOL: "Holanda",   BEL: "Bélgica",
  TUR: "Turquia",    RUS: "Rússia",     UCR: "Ucrânia",   CRO: "Croácia",
  SER: "Sérvia",     GRE: "Grécia",     SUE: "Suécia",    NOR: "Noruega",
  SUI: "Suíça",      AUT: "Áustria",    DIN: "Dinamarca", ESC: "Escócia",
  EUA: "EUA",        MEX: "México",     JAP: "Japão",     CHN: "China",
  AUS: "Austrália",  MAR: "Marrocos",   EGI: "Egito",     AFS: "África do Sul",
  AFG: "Afeganistão",EMI: "Emirados",   CAT: "Catar",     ARS: "Arábia Saudita",
}

// Group teams by countryCode to assign prestige by rank
const byCountry = new Map()
for (const t of rawTeams) {
  const cc = (t.countryCode ?? t.liga ?? "").toUpperCase()
  if (!byCountry.has(cc)) byCountry.set(cc, [])
  byCountry.get(cc).push(t)
}

// Assign prestige: rank within country (more players = higher rank as proxy)
for (const [cc, list] of byCountry) {
  list.sort((a, b) => (b.players?.length ?? 0) - (a.players?.length ?? 0))
  const n = list.length
  list.forEach((t, i) => {
    const rank = i / Math.max(n - 1, 1)         // 0 = best, 1 = worst
    t._prestige = Math.round(85 - rank * 45)     // 85 (best) → 40 (worst)
  })
}

// Get best division name for a country
function getLeagueName(cc) {
  const divs = leagueMap.get(cc.toUpperCase())
  return divs?.[0]?.nome ?? cc
}

function getDivisaoName(cc, rank, total) {
  const divs = leagueMap.get(cc.toUpperCase())
  if (!divs?.length) return cc
  const divIdx = Math.min(Math.floor((rank / total) * divs.length), divs.length - 1)
  return divs[divIdx]?.divisao ?? divs[0].nome
}

// Build final teams list
const teams = rawTeams.map(t => {
  const cc = (t.countryCode ?? t.liga ?? "").toUpperCase()
  const pais = COUNTRY_NAMES[cc] ?? t.pais ?? cc
  const countryList = byCountry.get(cc) ?? []
  const rank = countryList.indexOf(t)
  const liga = getLeagueName(cc)
  const divisao = getDivisaoName(cc, rank, countryList.length)
  const nJogadores = t.players?.length ?? 0
  const prestige = t._prestige ?? 50

  return {
    id: t.id,
    nome: t.nome,
    curto: t.curto,
    cor1: t.cor1,
    cor2: t.cor2,
    estadio: t.estadio,
    tecnico: t.tecnico,
    pais,
    liga,
    divisao,
    prestigio: prestige,
    saldo: Math.round(prestige * 200_000 + 5_000_000),
    escudo: `/escudos/${t.fileKey}.png`,
    escudoDisponivel: t.hasShield ?? false,
    fileKey: t.fileKey,
    nJogadores,
  }
})

if (!existsSync(DATA_OUT)) mkdirSync(DATA_OUT, { recursive: true })

const index = { version: "bf2026-27", count: teams.length, teams }
writeFileSync(join(DATA_OUT, "teams-index.json"), JSON.stringify(index), "utf-8")

console.log(`✅ public/data/teams-index.json — ${teams.length} teams`)

// Quick stats
const withShields = teams.filter(t => t.escudoDisponivel).length
const byCountryCount = [...byCountry.entries()]
  .sort((a, b) => b[1].length - a[1].length)
  .slice(0, 10)
  .map(([cc, arr]) => `  ${cc}: ${arr.length}`)
  .join("\n")

console.log(`  With shields: ${withShields}/${teams.length}`)
console.log(`  Top countries:\n${byCountryCount}`)
