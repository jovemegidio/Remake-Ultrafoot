import { LEAGUE_COMPETITIONS } from "../lib/country-competitions"
import { ehDivisaoFeminina } from "../lib/futebol-feminino"
const masc = new Set<string>(), fem = new Set<string>()
for (const [d,c] of Object.entries(LEAGUE_COMPETITIONS)) {
  if (!c.country || c.country === "Internacional") continue
  ;(ehDivisaoFeminina(d) ? fem : masc).add(c.country)
}
console.log("FEM:", [...fem].sort().join(" | "))
console.log()
console.log("FEM sem correspondente masculino:", [...fem].filter(p=>!masc.has(p)).join(" | "))
console.log("total masc:", masc.size, "fem:", fem.size)
