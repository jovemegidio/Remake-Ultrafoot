import { DEFAULT_STATE, type GameState } from "../lib/save-system"
import { allTeams } from "../lib/teams-data"
import { acceptProfessionalOffer, createYouthCareer, finishYouthSeason, simulateYouthRound, YOUTH_COMPETITION_FORMATS_2026 } from "../lib/youth-career-engine"

const team=allTeams.find(t=>t.curto==="COR")??allTeams[0]
if(!team)throw new Error("Base de clubes vazia")
const seeded=createYouthCareer(team,2026)
let state:GameState={...structuredClone(DEFAULT_STATE),selectedTeamShort:team.curto,managerName:"QA Base",season:2026,createdAt:Date.now(),updatedAt:Date.now(),youthCareer:seeded.career,youthPlayers:seeded.players}
if(state.youthPlayers!.length<20||state.youthPlayers!.some(p=>p.age>20))throw new Error("Elenco Sub-20 inválido")

for(let season=0;season<5;season++){
  let guard=0
  while(!state.youthCareer?.seasonFinished&&guard++<60)state=simulateYouthRound(state)
  if(!state.youthCareer?.seasonFinished||state.youthCareer.matches<3||state.youthCareer.matches>45)throw new Error(`Temporada Sub-20 ${season+1} não terminou com calendário válido`)
  state=finishYouthSeason(state)
}
if(!state.youthCareer?.alumni.length)throw new Error("Nenhum atleta formado entrou no legado")
if(!state.youthCareer.professionalOffers.length)throw new Error("Nenhuma proposta profissional após cinco temporadas")
const offer=state.youthCareer.professionalOffers[0]
state=acceptProfessionalOffer(state,offer.id)
if(state.youthCareer?.active||state.selectedTeamShort!==offer.clubCurto)throw new Error("Transição ao profissional falhou")
if(YOUTH_COMPETITION_FORMATS_2026[0].participants!==128||YOUTH_COMPETITION_FORMATS_2026[1].stages[0].matches!==19||YOUTH_COMPETITION_FORMATS_2026[2].participants!==64)throw new Error("Formatos oficiais Sub-20 2026 divergentes")
console.log(`OK carreira Sub-20: 5 temporadas, três calendários independentes, ${state.youthCareer!.alumni.length} atletas no legado, proposta do ${offer.clubNome}`)
