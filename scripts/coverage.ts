import { allTeams } from "../lib/teams-data"
import rp from "../data/seeds/real-positions.json"

function norm(s: string) { return (s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "") }
function clubKey(s: string) { return norm(s).replace(/^(fc|cf|ac|as|rc|sc|ss|afc|rcd|ud|cd|sv|ogc|losc|stade)/, "").replace(/(fc|cf|cfc|ac|sc|afc|club)$/, "").replace(/^olympiquede/, "olympique") }

const byPais: Record<string, number> = {}
for (const t of allTeams) { const p = (t as unknown as { pais?: string }).pais ?? "?"; byPais[p] = (byPais[p] ?? 0) + 1 }
console.log("paises curados (parcial):")
for (const p of ["Portugal", "Mexico", "México", "Russia", "Rússia", "Chile", "Escocia", "Escócia", "Holanda", "Paises Baixos", "Países Baixos"]) {
  if (byPais[p]) console.log("  " + p + ": " + byPais[p])
}
const gameKeys = new Set(allTeams.filter((t) => !/ II$/.test(t.nome)).map((t) => clubKey(t.nome)))
const rpKeys = Object.keys(rp as Record<string, unknown>)
const matched = rpKeys.filter((k) => gameKeys.has(k))
console.log(`\nchaves real-positions: ${rpKeys.length} | casam curado: ${matched.length} | sem curado: ${rpKeys.length - matched.length}`)
