// A forca das selecoes tem que refletir a hierarquia real (imersivo): as
// gigantes no topo, as menores embaixo, e o elenco da base nunca derruba uma
// potencia abaixo do seu patamar.
import { NATIONAL_TEAMS, getNationalStrength, getAllNationalStrengths, NATIONAL_STRENGTH_2026 } from "../lib/national-teams"

let falhas = 0
const check = (ok: boolean, msg: string) => { if (!ok) { falhas++; console.log(`  FALHA: ${msg}`) } }
const s = getAllNationalStrengths()

console.log("== Forca das selecoes ==")

// 1) Argentina no topo; gigantes acima das menores.
check(s.argentina >= 88, `Argentina forte, veio ${s.argentina}`)
check(s.brasil >= 86, `Brasil forte, veio ${s.brasil}`)
check(s.franca >= 86 && s.espanha >= 86, `Franca/Espanha fortes: ${s.franca}/${s.espanha}`)
check(s.argentina > s.chile && s.brasil > s.paraguai, "gigantes > medias da CONMEBOL")
check(s.franca > s.escocia && s.espanha > s.bosnia, "gigantes > medias da UEFA")

// 2) As menores ficam num patamar baixo, mas jogaveis.
check(s.haiti <= 72 && s.curacao <= 72 && s.china <= 72, `menores baixas: ${s.haiti}/${s.curacao}/${s.china}`)
check(s.haiti >= 60, "nao pode zerar (segue jogavel)")

// 3) Nenhuma potencia cai abaixo de uma selecao claramente menor (o bug antigo).
check(s.brasil > s.haiti + 10, "Brasil bem acima do Haiti")
check(s.franca > s.china + 12, "Franca bem acima da China")

// 4) A ancora manda: a forca fica perto do valor curado (dentro de ~5).
for (const nt of NATIONAL_TEAMS) {
  const ancora = NATIONAL_STRENGTH_2026[nt.id]
  if (ancora == null) continue
  const dist = Math.abs(getNationalStrength(nt) - ancora)
  check(dist <= 6, `${nt.id}: forca ${getNationalStrength(nt)} longe da ancora ${ancora} (dist ${dist})`)
}

// 5) Marrocos (semifinalista 2022) forte; acima da Africa do Sul.
check(s.marrocos >= 82 && s.marrocos > s.africa_do_sul, `Marrocos ${s.marrocos} > Africa do Sul ${s.africa_do_sul}`)

const ordenado = Object.entries(s).sort((a, b) => b[1] - a[1])
console.log("  Top 6: " + ordenado.slice(0, 6).map(([k, v]) => `${k} ${v}`).join(", "))
console.log("  Bottom 4: " + ordenado.slice(-4).map(([k, v]) => `${k} ${v}`).join(", "))
console.log(falhas === 0 ? "\nOK — hierarquia de selecoes realista e imersiva" : `\n${falhas} FALHA(S)`)
process.exit(falhas === 0 ? 0 : 1)
