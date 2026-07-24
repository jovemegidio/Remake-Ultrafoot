// Quais ligas tem menos clubes que o regulamento manda, e quais estao sem
// licenca (nome/escudo real). Roda antes e depois de mexer na base.
import { COMPETITION_REGULATIONS_2026 } from "../lib/competition-regulations-2026"
import { competitionsByLeague } from "../lib/international-competitions"
import { allPoolTeams } from "../lib/teams-data"
import { allInternationalTeams } from "../lib/international-teams"
import { getLocalEscudoPath } from "../lib/escudos-map"
import { existsSync } from "node:fs"
import { join } from "node:path"

const LIGAS = [
  "premier_league", "championship", "la_liga", "la_liga_2", "serie_a_ita", "serie_b_ita",
  "bundesliga", "bundesliga_2", "ligue_1", "ligue_2", "primeira_liga", "eredivisie",
  "liga_argentina", "primera_a_col", "mls", "liga_mx", "saudi_pro", "j_league",
  "super_lig", "russian_prem",
]

const todos = [...allInternationalTeams, ...allPoolTeams]

// "Licenciado" = o escudo existe MESMO em public/. Confiar no campo do JSON
// dava 0/N em tudo (os clubes internacionais nao preenchem escudoDisponivel);
// o que vale e o arquivo estar empacotado, que e o que o jogador ve.
const licenciado = (t: { file_key?: string; curto?: string }) => {
  const chave = String(t.file_key ?? t.curto ?? "")
  if (!chave) return false
  const rel = getLocalEscudoPath(chave).replace(/^\//, "")
  return existsSync(join(process.cwd(), "public", rel))
}

let curtas = 0
let semRegulamento = 0
console.log("liga".padEnd(18) + "reg".padEnd(5) + "prev".padEnd(6) + "tem".padEnd(6) + "licenc.".padEnd(10) + "status")
console.log("-".repeat(70))

for (const id of LIGAS) {
  // O regulamento da liga pode estar sob o id da divisao OU sob o id da
  // competicao (ex.: saudi_pro -> saudi_pro_league). Procura nos dois.
  const daLiga = competitionsByLeague[id as keyof typeof competitionsByLeague] ?? []
  const compLiga = daLiga.find(c => c.type === "league")
  const reg = COMPETITION_REGULATIONS_2026[id] ?? (compLiga ? COMPETITION_REGULATIONS_2026[compLiga.id] : undefined)

  const clubes = todos.filter(t => String(t.divisao) === id)
  const comEscudo = clubes.filter(licenciado).length
  const previsto = reg?.participants ?? 0

  if (!reg) semRegulamento++
  const curto = previsto > 0 && clubes.length < previsto
  if (curto) curtas++

  const status = !reg ? "SEM REGULAMENTO"
    : curto ? `FALTAM ${previsto - clubes.length}`
      : "ok"
  console.log(
    id.padEnd(18)
    + (reg ? "sim" : "NAO").padEnd(5)
    + String(previsto).padEnd(6)
    + String(clubes.length).padEnd(6)
    + `${comEscudo}/${clubes.length}`.padEnd(10)
    + status,
  )
}

console.log("-".repeat(70))
console.log(`ligas curtas: ${curtas} | sem regulamento: ${semRegulamento}`)
