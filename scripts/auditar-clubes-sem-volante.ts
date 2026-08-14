// OS 47 CLUBES SEM VOLANTE SÃO DADO REAL ESTREITO OU ELENCO GERADO?
//
// `test-posicoes-do-elenco` passou de 35 para 47 clubes sem volante. O teto dele
// é guarda de regressão sobre um valor MEDIDO, e o próprio teste diz que forçar
// posição sobre dado real seria "sobrescrever verdade para deixar um número
// bonito". Então antes de mexer em qualquer coisa: de que tipo são esses 47?
//
//   npx tsx scripts/auditar-clubes-sem-volante.ts

import { allTeams } from "../lib/teams-data"
import { getPlayersForTeam } from "../lib/players-data"

let real = 0
let gerado = 0
const exemplosReais: string[] = []
const exemplosGerados: string[] = []

for (const time of allTeams) {
  const elenco = getPlayersForTeam(time, { raw: true })
  if (elenco.some(p => String(p.pos).toUpperCase() === "VOL")) continue

  const provisorios = elenco.filter(p => p.generatedOrigin === "provisional").length
  const deFonte = elenco.length - provisorios
  const contagem: Record<string, number> = {}
  for (const p of elenco) {
    const k = String(p.pos ?? "?").toUpperCase()
    contagem[k] = (contagem[k] ?? 0) + 1
  }
  const resumo = Object.entries(contagem).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}:${v}`).join(" ")

  if (deFonte >= 11) {
    real++
    if (exemplosReais.length < 6) exemplosReais.push(`${time.nome} (${deFonte} de fonte) — ${resumo}`)
  } else {
    gerado++
    if (exemplosGerados.length < 6) exemplosGerados.push(`${time.nome} (${deFonte} de fonte, ${provisorios} gerados) — ${resumo}`)
  }
}

console.log(`clubes sem volante: ${real + gerado}`)
console.log(`  com elenco REAL (11+ de fonte): ${real}  <- forçar posição aqui seria sobrescrever verdade`)
console.log(`  com elenco majoritariamente GERADO: ${gerado}  <- aqui é defeito do gerador`)
console.log("")
console.log("exemplos com dado real:")
for (const e of exemplosReais) console.log(`  ${e}`)
console.log("")
console.log("exemplos com elenco gerado:")
for (const e of exemplosGerados) console.log(`  ${e}`)
