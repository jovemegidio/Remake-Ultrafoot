import { berthsForSeason, superCupMatchCount } from "../lib/super-cups"
import type { SeasonRecord } from "../lib/career-types"
let f=0
const ck=(n:string,c:boolean,d="")=>{if(!c)f++;console.log(`${c?"  ok  ":" FALHA"} ${n}${c?"":` — ${d}`}`)}
const reg=(o:Partial<SeasonRecord>):SeasonRecord=>({season:2026,competition:"Brasileirão Série A",position:5,points:60,won:17,drawn:9,lost:12,goalsFor:55,goalsAgainst:45,champion:"OUTRO",managerName:"T",promoted:false,relegated:false,teamCurto:"FLA",teamNome:"Flamengo",...o})

console.log("\nVagas nas supercopas\n")
const campBr=[reg({position:1,champion:"FLA"})]
ck("campeão do Brasileirão disputa a Supercopa", berthsForSeason(campBr,"FLA",2027).some(v=>v.id==="supercopa_brasil"))
ck("vaga vale só para a temporada SEGUINTE", berthsForSeason(campBr,"FLA",2028).length===0, "vaga vazou para 2028")
ck("quem não foi campeão não entra", berthsForSeason([reg({position:5})],"FLA",2027).length===0)

const copaBr=[reg({competition:"Copa do Brasil",position:1,champion:"FLA"})]
ck("campeão da Copa do Brasil também disputa", berthsForSeason(copaBr,"FLA",2027).some(v=>v.id==="supercopa_brasil"))

const liberta=[reg({competition:"Copa Libertadores",position:1,champion:"FLA"})]
const vLib=berthsForSeason(liberta,"FLA",2027)
ck("campeão da Libertadores vai à Recopa", vLib.some(v=>v.id==="recopa_sulamericana"))
// O Mundial virou o torneio de 32 clubes, a cada 4 anos (2025, 2029...). O
// campeao continental disputa a INTERCONTINENTAL todo ano; a vaga no Mundial
// vem do ciclo — ver test-mundial-intercontinental.
ck("campeão da Libertadores vai à Intercontinental", vLib.some(v=>v.id==="copa_intercontinental"))
ck("Mundial NÃO acontece em 2027 (fora do ciclo)", !vLib.some(v=>v.id==="mundial_clubes"))

const sula=[reg({competition:"Copa Sul-Americana",position:1,champion:"FLA"})]
const vSul=berthsForSeason(sula,"FLA",2027)
ck("campeão da Sul-Americana vai à Recopa", vSul.some(v=>v.id==="recopa_sulamericana"))
ck("campeão da Sul-Americana NÃO vai à Intercontinental", !vSul.some(v=>v.id==="copa_intercontinental"))

const ucl=[reg({competition:"UEFA Champions League",position:1,champion:"RMA",teamCurto:"RMA"})]
const vUcl=berthsForSeason(ucl,"RMA",2027)
ck("campeão da Champions vai à Supercopa da UEFA", vUcl.some(v=>v.id==="supercopa_uefa"))
ck("campeão da Champions vai à Intercontinental", vUcl.some(v=>v.id==="copa_intercontinental"))

console.log("\nAcúmulo e contagem\n")
const duplo=[reg({position:1,champion:"FLA"}),reg({competition:"Copa Libertadores",position:1,champion:"FLA"})]
const vD=berthsForSeason(duplo,"FLA",2027)
ck("campeão duplo acumula 3 vagas", vD.length===3, `veio ${vD.length}: ${vD.map(v=>v.id).join(",")}`)
ck("não duplica a mesma vaga", new Set(vD.map(v=>v.id)).size===vD.length)
ck("Supercopa=1, Recopa=2, Intercontinental=2 -> 5", superCupMatchCount(vD)===5, String(superCupMatchCount(vD)))

console.log("\nRobustez\n")
ck("histórico vazio não quebra", berthsForSeason([],"FLA",2027).length===0)
ck("histórico indefinido não quebra", berthsForSeason(undefined,"FLA",2027).length===0)
ck("clube vazio não quebra", berthsForSeason(campBr,"",2027).length===0)
ck("título de OUTRO clube não conta", berthsForSeason([reg({position:1,champion:"PAL",teamCurto:"PAL"})],"FLA",2027).length===0)

console.log(`\n${f===0?"TODOS OS TESTES PASSARAM":`${f} FALHA(S)`}\n`)
process.exit(f===0?0:1)
