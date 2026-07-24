import { allInternationalTeams } from "../lib/international-teams"
for (const div of ["primera_div_ury","primera_a_col","j_league","chinese_super","liga_argentina"]) {
  const ts = allInternationalTeams.filter(t => String(t.divisao) === div)
  console.log(`\n${div} (${ts.length}):`)
  for (const t of ts) console.log(`  ${t.file_key}  |  ${t.nome}`)
}
