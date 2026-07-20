// Auditoria: cada estadual mapeado tem clubes SUFICIENTES no dado que o jogo
// realmente usa (allBrazilianTeams + allPoolTeams filtrados por t.estado)?
import { allBrazilianTeams, allPoolTeams } from "../lib/teams-data"
import { ESTADO_CAMPEONATO } from "../lib/use-game-manager"

const porEstado = new Map<string, number>()
const seen = new Set<string>()
for (const t of [...allBrazilianTeams, ...allPoolTeams]) {
  const k = (t.file_key || t.curto || t.nome).toLowerCase()
  if (seen.has(k)) continue
  seen.add(k)
  if (t.estado) porEstado.set(t.estado, (porEstado.get(t.estado) ?? 0) + 1)
}

console.log("\nESTADO  CAMPEONATO                     CLUBES  STATUS")
console.log("-".repeat(60))
let problemas = 0
for (const [uf, nome] of Object.entries(ESTADO_CAMPEONATO)) {
  const n = porEstado.get(uf) ?? 0
  const ok = n >= 4
  if (!ok) problemas++
  console.log(`${uf.padEnd(7)} ${nome.padEnd(30)} ${String(n).padStart(5)}  ${ok ? "ok" : "VAZIO (<4)"}`)
}
console.log("\nEstados COM clubes mas SEM campeonato mapeado:")
for (const [uf, n] of [...porEstado.entries()].sort((a,b)=>b[1]-a[1])) {
  if (!ESTADO_CAMPEONATO[uf]) console.log(`  ${uf}: ${n} clubes`)
}
console.log(problemas === 0 ? "\nTODOS OS 23 ESTADUAIS TEM CLUBES SUFICIENTES" : `\n${problemas} estadual(is) SEM clubes`)
