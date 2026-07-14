// Prova a regra de acesso/rebaixamento (logica pura).
import { resolveDivisionChange } from "../lib/promotion-relegation"

let fail = 0
const ok = (m: string) => console.log("OK " + m)
const bad = (m: string) => { console.log("XX " + m); fail++ }

function expect(division: string, pos: number, expDiv: string, expMov: string) {
  const r = resolveDivisionChange(division, pos, "Time")
  if (r.nextDivision === expDiv && r.movement === expMov) {
    ok(`${division} ${pos}º -> ${r.nextDivision} (${r.movement})`)
  } else {
    bad(`${division} ${pos}º -> ${r.nextDivision}/${r.movement}, esperado ${expDiv}/${expMov}`)
  }
}

// Serie A: rebaixa os 4 ultimos (17o-20o); 16o fica.
expect("serie_a", 1, "serie_a", "stay")
expect("serie_a", 16, "serie_a", "stay")
expect("serie_a", 17, "serie_b", "relegated")
expect("serie_a", 20, "serie_b", "relegated")

// Serie B: 1o-4o sobem, 5o fica, 17o+ caem.
expect("serie_b", 1, "serie_a", "promoted")
expect("serie_b", 4, "serie_a", "promoted")
expect("serie_b", 5, "serie_b", "stay")
expect("serie_b", 18, "serie_c", "relegated")

// Serie C sobe p/ B e cai p/ D.
expect("serie_c", 2, "serie_b", "promoted")
expect("serie_c", 19, "serie_d", "relegated")

// Serie D: base, ninguem cai; 1o-4o sobem.
expect("serie_d", 3, "serie_c", "promoted")
expect("serie_d", 20, "serie_d", "stay")

// Liga estrangeira fora da escada BR: nao mexe.
expect("premier_league", 20, "premier_league", "stay")

console.log(fail ? `\nRESULTADO: ${fail} falha(s)` : "\nRESULTADO: OK — acesso/rebaixamento correto")
process.exitCode = fail ? 1 : 0
