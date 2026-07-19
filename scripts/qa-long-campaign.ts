import { useGameEngine } from "../lib/game-engine"

const checkpoints=new Set([1,3,5,10,20]),passed:number[]=[]
useGameEngine.getState().initializeGame("BGT")
const initial=useGameEngine.getState(),template=initial.squadPlayers[0]
if(!template)throw new Error("Elenco inicial vazio")
initial.buyPlayer({...template,id:991057,name:"QA Persistência 20 temporadas",marketValue:100000},100000)

for(let season=1;season<=20;season++){
  for(let week=0;week<52;week++)useGameEngine.getState().advanceWeek()
  const before=useGameEngine.getState(),nextSeason=before.currentSeason+1
  useGameEngine.getState().processSeasonEnd(nextSeason,before.serieAStandings,before.serieAStandings)
  const state=useGameEngine.getState()
  if(state.currentSeason!==nextSeason||state.currentWeek!==0)throw new Error(`Transição inválida na temporada ${season}`)
  if(season<=5&&!state.squadPlayers.some(p=>p.name==="QA Persistência 20 temporadas"))throw new Error(`Jogador contratado perdido antes do ciclo normal de carreira, temporada ${season}`)
  if(!Number.isFinite(state.balance)||state.squadPlayers.length<11)throw new Error(`Estado inválido na temporada ${season}`)
  if(checkpoints.has(season)){passed.push(season);console.log(`OK campanha ${season} temporada(s): elenco=${state.squadPlayers.length}, saldo=${state.balance}`)}
}
if(passed.join(",")!=="1,3,5,10,20")throw new Error("Checkpoints incompletos")
console.log("OK campanhas longas: 1, 3, 5, 10 e 20 temporadas")
