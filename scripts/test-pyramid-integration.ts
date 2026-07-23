// PIRAMIDE VIVA com os DADOS REAIS do jogo: rivais trocam de divisao e os
// tamanhos das ligas se mantem ao longo das temporadas.

import { allTeams, setClubDivisions, getTeamsByDivision, effectiveDivision } from "../lib/teams-data"
import { evolvePyramids, type PyramidClub } from "../lib/league-pyramid"

let falhas = 0
function checar(nome: string, ok: boolean, detalhe = "") {
  console.log(`${ok ? "ok" : "FALHOU"}  ${nome}${detalhe ? ` — ${detalhe}` : ""}`)
  if (!ok) falhas++
}

const staticDiv = new Map(allTeams.map(t => [t.curto, String(t.divisao)]))

function tamanhos(divs: string[]): Record<string, number> {
  const out: Record<string, number> = {}
  for (const d of divs) out[d] = getTeamsByDivision(d).length
  return out
}

// Estado inicial (sem overrides)
setClubDivisions({})
const BR = ["serie_a", "serie_b", "serie_c", "serie_d"]
const antes = tamanhos(BR)
console.log("   tamanhos iniciais BR:", JSON.stringify(antes))
console.log("   tamanhos iniciais EU:", JSON.stringify(tamanhos(["premier_league", "championship"])))

// Simula 6 temporadas evoluindo a piramide (sem usuario — tudo por prestigio+ruido).
let clubDivisions: Record<string, string> = {}
const historicoDivisaoDeUmClube: string[] = []
// Escolhe um clube da Serie C para acompanhar a jornada dele.
const viajante = allTeams.find(t => staticDiv.get(t.curto) === "serie_c")!.curto

for (let s = 0; s < 6; s++) {
  setClubDivisions(clubDivisions)
  const clubs: PyramidClub[] = allTeams.map(t => ({
    curto: t.curto, division: effectiveDivision(t), prestige: t.prestigio ?? 60,
  }))
  const moved = evolvePyramids({ clubs, userDivision: null, userFinalOrder: [], seed: 2026 + s })
  const next = { ...clubDivisions }
  for (const [curto, div] of Object.entries(moved)) {
    if (div === staticDiv.get(curto)) delete next[curto]; else next[curto] = div
  }
  clubDivisions = next
  setClubDivisions(clubDivisions)
  historicoDivisaoDeUmClube.push(getTeamsByDivision("serie_a").some(t => t.curto === viajante) ? "A" :
    getTeamsByDivision("serie_b").some(t => t.curto === viajante) ? "B" :
    getTeamsByDivision("serie_c").some(t => t.curto === viajante) ? "C" :
    getTeamsByDivision("serie_d").some(t => t.curto === viajante) ? "D" : "?")
}

// 1. Tamanhos preservados
const depois = tamanhos(BR)
console.log("   tamanhos apos 6 temporadas BR:", JSON.stringify(depois))
checar("cada divisao BR mantem o tamanho apos 6 temporadas",
  BR.every(d => depois[d] === antes[d]),
  BR.map(d => `${d}:${antes[d]}->${depois[d]}`).join(" "))

// 2. Houve movimento real (a Serie A nao e a mesma de sempre)
setClubDivisions({})
const serieAOriginal = new Set(getTeamsByDivision("serie_a").map(t => t.curto))
setClubDivisions(clubDivisions)
const serieAAgora = new Set(getTeamsByDivision("serie_a").map(t => t.curto))
const trocaram = [...serieAAgora].filter(c => !serieAOriginal.has(c)).length
checar("a Serie A mudou de composicao (rivais subiram/cairam)", trocaram > 0, `${trocaram} clubes novos`)

// 3. Nenhum clube em duas divisoes ao mesmo tempo
const contagem = new Map<string, number>()
for (const d of BR) for (const t of getTeamsByDivision(d)) contagem.set(t.curto, (contagem.get(t.curto) ?? 0) + 1)
const duplicados = [...contagem.values()].filter(n => n > 1).length
checar("nenhum clube em duas divisoes ao mesmo tempo", duplicados === 0, `${duplicados} duplicados`)

// 4. Europa tambem evolui
setClubDivisions(clubDivisions)
const euAntes = tamanhos(["premier_league", "championship"])
checar("Premier e Championship mantem tamanho", euAntes.premier_league === 20 && euAntes.championship === 21,
  JSON.stringify(euAntes))

console.log(`   jornada do clube ${viajante} (Serie C) ao longo de 6 temporadas: ${historicoDivisaoDeUmClube.join(" -> ")}`)

console.log(falhas === 0 ? "\n== TODOS OS TESTES PASSARAM ==" : `\n== ${falhas} FALHA(S) ==`)
process.exit(falhas === 0 ? 0 : 1)
