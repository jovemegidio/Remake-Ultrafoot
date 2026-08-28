import { createClubDebt,debtTransferLimit,processDebtMonth,renegotiateDebt } from "../lib/debt-engine"
import { advanceScoutingWeek,createScoutMission,createScoutingDepartment,hireDepartmentScout } from "../lib/scout-engine"
import { readFileSync } from "node:fs"
import assert from "node:assert/strict"
import { configurePitch,pitchInjuryDurationMultiplier,pitchInjuryFrequencyMultiplier,pitchUpgradeCost } from "../lib/infrastructure-engine"
import { counterSponsorOffer,generateOffers } from "../lib/sponsor-engine"

let debt=createClubDebt("realistic",200_000_000);assert(debt.principal>0);const before=debt.principal
const payment=processDebtMonth(debt,50_000_000);debt=payment.debt;assert(payment.paid>0&&debt.principal<before);assert(debtTransferLimit(debt,100_000_000)<100_000_000);assert(renegotiateDebt(debt).monthlyPayment<debt.monthlyPayment)
let scouting=createScoutingDepartment();scouting=hireDepartmentScout(scouting,{id:"s1",name:"Teste",tier:"national",monthlySalary:25_000,attributes:{currentAbility:75,potentialAbility:80,youthDiscovery:84,marketKnowledge:74,negotiation:70}});scouting=createScoutMission(scouting,{id:"m1",scoutId:"s1",type:"young",region:"Brasil",ageMin:15,ageMax:20,startedWeek:1,durationWeeks:3,progressWeeks:0,status:"active"});for(let week=1;week<=3;week++)scouting=advanceScoutingWeek(scouting,week);assert.equal(scouting.missions[0].status,"complete");assert(scouting.reports.some(r=>r.stage==="complete"))
const match=readFileSync("lib/match-engine.ts","utf8");assert(match.includes("isSecondYellow")&&match.includes("EXPULSO"));assert(match.includes("playerYellowCards: {}"))
const modal=readFileSync("components/match/substitution-modal.tsx","utf8");// ⚠️ Afere CAPACIDADE (troca multipla), nao a redacao do botao. A versao antiga
// exigia o texto "ADICIONAR TROCA"; o botao virou "CONFIRMAR {n} TROCAS" e o
// gate ficou vermelho por motivo nenhum — sem quebrar nada no jogo.
assert(modal.includes("SubstitutionChange[]")&&/CONFIRMAR \{pending\.length\}/.test(modal))
const youth=readFileSync("app/base/carreira/page.tsx","utf8"),live=readFileSync("app/partida/ao-vivo/page.tsx","utf8");assert(youth.includes("Jogar partida")&&youth.includes("startingPlayerIds"));assert(live.includes("applyPlayedYouthMatch")&&live.includes("matchCtx.youth"))
const poor=configurePitch("natural","poor",2026),synthetic=configurePitch("synthetic","good",2026);assert(pitchInjuryFrequencyMultiplier(poor)>pitchInjuryFrequencyMultiplier(synthetic));assert(pitchInjuryDurationMultiplier(synthetic)>1);assert(synthetic.monthlyMaintenance<configurePitch("natural","good",2026).monthlyMaintenance);assert(pitchUpgradeCost(poor,"natural","good")>0) // ⚠️ As duas assercoes que existiam aqui chamavam `lib/injury-engine`, modulo
// sem um unico importador no jogo (removido na 1.0.351). As lesoes de verdade
// nascem em lib/game-engine, com PlayerInjury e o departamento medico.
const sponsor=generateOffers(60,2,2026)[0],sponsorCounter=counterSponsorOffer(sponsor,sponsor.sponsor.monthlyValue*1.05,2);assert(sponsorCounter.result==="accepted");const newGame=readFileSync("app/novo-jogo/page.tsx","utf8");assert(!newGame.includes('>Sub-20</button>'))
console.log("QA 1.0.69 OK: mercado, gramado, lesões, patrocínios e Sub-20 oculto")
