// Copa do Nordeste e Copa Verde.
//
// Testa contra o DADO REAL do jogo (allBrazilianTeams/allPoolTeams), não
// fixtures sintéticos: a elegibilidade e o pool de adversários dependem do
// campo `estado` que os estaduais já usam.
//
// Rodar: npx tsx scripts/test-regional-cups.ts

import { COPA_NORDESTE, COPA_VERDE, regionalCupForState } from "../lib/regional-cups"
import { getUserCupPlan, getOpponentPool, ESTADO_CAMPEONATO } from "../lib/use-game-manager"
import { allBrazilianTeams, allPoolTeams } from "../lib/teams-data"

let f = 0
const ck = (n: string, c: boolean, d = "") => { if (!c) f++; console.log(`${c ? "  ok  " : " FALHA"} ${n}${c ? "" : ` — ${d}`}`) }

console.log("\nElegibilidade por estado\n")

ck("clube da Bahia disputa a Copa do Nordeste", regionalCupForState("BA")?.id === "copa_nordeste")
ck("clube do Ceará disputa a Copa do Nordeste", regionalCupForState("CE")?.id === "copa_nordeste")
ck("clube do Pará disputa a Copa Verde", regionalCupForState("PA")?.id === "copa_verde")
ck("clube do DF disputa a Copa Verde", regionalCupForState("DF")?.id === "copa_verde")
ck("ES entra na Copa Verde (regulamento CBF)", regionalCupForState("ES")?.id === "copa_verde")
ck("clube de SP NÃO disputa regional", regionalCupForState("SP") === null)
ck("clube do RS NÃO disputa regional", regionalCupForState("RS") === null)
ck("estado vazio não quebra", regionalCupForState(undefined) === null)
ck("nenhuma UF está nas DUAS copas",
  COPA_NORDESTE.states.every(uf => !COPA_VERDE.states.includes(uf)))

console.log("\nIntegração com o plano de copas (dado real)\n")

const nordestino = [...allBrazilianTeams, ...allPoolTeams].find(t => t.estado === "BA")
const paulista = [...allBrazilianTeams, ...allPoolTeams].find(t => t.estado === "SP")
if (!nordestino || !paulista) { console.log(" FALHA: dado real sem clube BA/SP"); process.exit(1) }

const planoBA = getUserCupPlan(nordestino)
const regionalBA = planoBA.find(p => p.competition.id === "copa_nordeste")
ck(`${nordestino.nome} (BA) tem a Copa do Nordeste no calendário`, !!regionalBA)
ck("a campanha regional tem 4 partidas", regionalBA?.matchCount === 4, String(regionalBA?.matchCount))
// O predicado anterior usava startsWith("copa_") e casava com a copa_brasil —
// que o Palmeiras DEVE ter. Compara com os ids exatos das regionais.
ck(`${paulista.nome} (SP) NÃO tem copa regional`,
  !getUserCupPlan(paulista).some(p => p.competition.id === "copa_nordeste" || p.competition.id === "copa_verde"))

console.log("\nPool de adversários restrito à região\n")

if (regionalBA) {
  const pool = getOpponentPool(nordestino, regionalBA)
  ck("pool tem adversários suficientes", pool.length >= 8, `${pool.length} clubes`)
  ck("TODOS os adversários são do Nordeste",
    pool.every(t => t.estado && COPA_NORDESTE.states.includes(t.estado)),
    `intrusos: ${pool.filter(t => !t.estado || !COPA_NORDESTE.states.includes(t.estado)).map(t => `${t.nome}(${t.estado})`).slice(0, 3).join(", ")}`)
  ck("o próprio clube não está no pool", !pool.some(t => t.curto === nordestino.curto))
}

console.log("\nEstaduais novos (MS e AC)\n")

ck("MS agora tem estadual mapeado", ESTADO_CAMPEONATO.MS === "Campeonato Sul-Mato-Grossense")
ck("AC agora tem estadual mapeado", ESTADO_CAMPEONATO.AC === "Campeonato Acreano")

console.log(`\n${f === 0 ? "TODOS OS TESTES PASSARAM" : `${f} FALHA(S)`}\n`)
process.exit(f === 0 ? 0 : 1)
