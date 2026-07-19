import { allPoolTeams, allTeams } from "../lib/teams-data"
import { getPlayersForTeam } from "../lib/players-data"
import { pickStartingXI } from "../lib/formations"

const clubs = [...allTeams, ...allPoolTeams]
const problems: string[] = []
let realNames = 0

for (const club of clubs) {
  const squad = getPlayersForTeam(club)
  const xi = pickStartingXI(squad, p => p.pos, p => p.base).starters
  const gk = xi.filter(p => p.pos === "GOL").length
  const defenders = xi.filter(p => ["ZAG", "LD", "LE"].includes(p.pos)).length
  const midfielders = xi.filter(p => ["VOL", "MC", "MEI", "ME", "MD", "CA"].includes(p.pos)).length
  const attackers = xi.filter(p => ["ATA", "PE", "PD"].includes(p.pos)).length
  const duplicateNames = squad.length - new Set(squad.map(p => p.nome.toLocaleLowerCase())).size
  realNames += squad.filter(p => !/^(Reserva|Goleiro|Zagueiro|Meio-campista|Atacante) /.test(p.nome)).length

  if (squad.length < 18 || xi.length !== 11 || gk !== 1 || defenders < 3 || midfielders < 2 || attackers < 1 || duplicateNames > 0) {
    problems.push(`${club.nome}: elenco=${squad.length} XI=${xi.length} GOL=${gk} DEF=${defenders} MEI=${midfielders} ATA=${attackers} duplicados=${duplicateNames}`)
  }
}

console.log(`clubes auditados=${clubs.length} jogadores licenciados=${realNames} problemas=${problems.length}`)
if (problems.length) {
  console.error(problems.slice(0, 100).join("\n"))
  process.exit(1)
}
