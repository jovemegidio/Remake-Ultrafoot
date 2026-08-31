import { LEAGUE_COMPETITIONS } from "../lib/country-competitions"
import { getConfederation } from "../lib/country-competitions"

const porConf: Record<string, string[]> = {}
for (const [div, c] of Object.entries(LEAGUE_COMPETITIONS)) {
  if (!c.country || c.country === "Internacional") continue
  const conf = String(getConfederation(div))
  ;(porConf[conf] ??= []).push(`${c.country}:${div}`)
}
for (const [conf, lista] of Object.entries(porConf).sort((a,b)=>b[1].length-a[1].length)) {
  console.log(`${conf.padEnd(14)} ${String(lista.length).padStart(3)}`)
  if (conf === "UNAFFILIATED") for (const l of lista) console.log("      ", l)
}
console.log("\nPAISES:", [...new Set(Object.values(LEAGUE_COMPETITIONS).map(c=>c.country))].sort().join(", "))
