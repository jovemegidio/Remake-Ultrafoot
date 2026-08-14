// QUEM JOGA COM ATLETA GERADO — a lista que alimenta o importador.
//
// Roda DEPOIS de todas as camadas (real-positions, Transfermarkt, curado,
// importado), que é o que o jogador vê. O `audit-squad-gaps.mjs` mede o seed
// cru e por isso dá um número muito maior: 725 clubes contra os ~105 daqui.
//
//   npx tsx scripts/listar-elencos-faltantes.ts
//   → escreve scripts/elencos-faltantes.json
import { completarLigaComPool, type Team } from "../lib/teams-data"
import { competitionsByLeague } from "../lib/international-competitions"
import { getPlayersForTeam } from "../lib/players-data"
import fs from "node:fs"

const norm = (s: string) => (s || "").normalize("NFD").replace(/[̀-ͯ]/g, "")
  .toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()

const reais = new Set<string>()
const seed = JSON.parse(fs.readFileSync("data/seeds/imported-bf2026.json", "utf8"))
for (const t of seed.teams ?? []) for (const j of t.jogadores ?? []) reais.add(norm(j.nome))
const rs = JSON.parse(fs.readFileSync("data/seeds/real-squads-tm.json", "utf8"))
for (const lista of Object.values(rs) as { n: string }[][]) for (const p of lista) reais.add(norm(p.n))
const rp = JSON.parse(fs.readFileSync("data/seeds/real-positions.json", "utf8"))
for (const lista of Object.values(rp) as { nome?: string; n?: string }[][]) {
  if (Array.isArray(lista)) for (const p of lista) reais.add(norm(p.nome ?? p.n ?? ""))
}
const br = JSON.parse(fs.readFileSync("data/seeds/players_br.json", "utf8"))
for (const p of (Array.isArray(br) ? br : br.players ?? [])) reais.add(norm(p.nome ?? p.name ?? ""))

const faltantes: { nome: string; curto: string; file_key: string; pais: string; divisao: string; gerados: number; total: number; promotionEligible?: boolean }[] = []
let totalAtletas = 0, totalGerados = 0

const jogaveis = new Map<string, Team>()
for (const divisao of Object.keys(competitionsByLeague)) {
  for (const team of completarLigaComPool(divisao)) jogaveis.set(team.file_key, team)
}

for (const t of jogaveis.values()) {
  let elenco
  try { elenco = getPlayersForTeam(t) } catch { continue }
  if (!elenco.length) continue
  const g = elenco.filter(p => p.generatedOrigin === "provisional").length
  totalAtletas += elenco.length
  totalGerados += g
  // 3+ gerados: abaixo disso é ruído de grafia, não elenco faltando.
  if (g >= 3) {
    faltantes.push({
      nome: t.nome, curto: t.curto, file_key: t.file_key,
      pais: String(t.pais ?? t.estado ?? ""),
      divisao: String(t.divisao), gerados: g, total: elenco.length,
      ...(t.promotionEligible === false ? { promotionEligible: false } : {}),
    })
  }
}

faltantes.sort((a, b) => b.gerados - a.gerados)
fs.writeFileSync("scripts/elencos-faltantes.json", JSON.stringify(faltantes, null, 1))

console.log(`ligas jogaveis: ${jogaveis.size} clubes | atletas ${totalAtletas} | gerados ${totalGerados} (${(totalGerados / totalAtletas * 100).toFixed(1)}%)`)
console.log(`clubes com 3+ gerados: ${faltantes.length}`)
const porDiv = new Map<string, number>()
for (const f of faltantes) porDiv.set(f.divisao, (porDiv.get(f.divisao) ?? 0) + 1)
for (const [d, n] of [...porDiv].sort((a, b) => b[1] - a[1]).slice(0, 12)) {
  console.log(`  ${String(n).padStart(3)}  ${d}`)
}
console.log("\nescrito: scripts/elencos-faltantes.json")
