// QUANTO DADO REAL DE NACIONALIDADE EXISTE?
//
// Decide se da para montar o elenco das selecoes a partir dos atletas REAIS do
// jogo. Hoje `getClubsForNationalTeam` filtra CLUBES DO PAIS — entao um frances
// no Real Madrid nunca entra na Franca — e o que falta e completado por
// `fallbackNationalPlayers`, que INVENTA nomes a partir do id da selecao
// ("Aalbania1", "Aalbania2"...).
//
//   npx tsx scripts/auditar-nacionalidades.ts
import { allTeams } from "../lib/teams-data"
import { getPlayersForTeam } from "../lib/players-data"
import { NATIONAL_TEAMS, getNationalPlayerSources } from "../lib/national-teams"

const porNac = new Map<string, number>()
let total = 0
let semNac = 0

for (const t of allTeams) {
  for (const p of getPlayersForTeam(t)) {
    total++
    const n = (p.nac ?? "").trim()
    if (!n) { semNac++; continue }
    porNac.set(n, (porNac.get(n) ?? 0) + 1)
  }
}

console.log(`atletas totais          : ${total}`)
console.log(`sem nacionalidade       : ${semNac} (${(semNac / Math.max(1, total) * 100).toFixed(1)}%)`)
console.log(`nacionalidades distintas: ${porNac.size}`)

console.log("\n── Top 20 nacionalidades ──")
for (const [n, c] of [...porNac].sort((a, b) => b[1] - a[1]).slice(0, 20)) {
  console.log(`  ${String(c).padStart(5)}  ${n}`)
}

// O que importa de verdade: cada SELECAO tem 23 atletas REAIS?
//
// ⚠️ Usa `getNationalPlayerSources`, a funcao DE VERDADE do jogo — e nao uma
// copia da regra aqui. Uma copia testaria a copia; foi exatamente assim que a
// primeira versao deste script mediu "todas zeradas" por comparar sem
// normalizar, enquanto o jogo faz outra coisa.
console.log("\n── Cobertura por selecao (precisa de 23 REAIS) ──")
const semElenco: string[] = []
const parcial: string[] = []
for (const nt of NATIONAL_TEAMS) {
  const fontes = getNationalPlayerSources(nt, { raw: true })
  // Inventado = o que `fallbackNationalPlayers` completou (o "time" e a propria
  // selecao, porque nao ha clube por tras).
  const reais = fontes.filter(f => f.team.nome !== nt.name).length
  const marca = reais >= 23 ? "ok " : reais > 0 ? "PARCIAL" : "ZERO"
  if (reais === 0) semElenco.push(nt.name)
  else if (reais < 23) parcial.push(`${nt.name} (${reais})`)
  console.log(`  ${marca.padEnd(8)} ${nt.name.padEnd(22)} ${String(reais).padStart(5)} reais`)
}

console.log(`\nselecoes SEM nenhum atleta real : ${semElenco.length}`)
if (semElenco.length) console.log("  " + semElenco.join(", "))
console.log(`selecoes com MENOS de 23        : ${parcial.length}`)
if (parcial.length) console.log("  " + parcial.join(", "))
