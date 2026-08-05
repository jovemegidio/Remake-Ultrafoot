import { useGameEngine, absoluteWeek } from "../lib/game-engine"
import { ELENCO_MINIMO } from "../lib/reposicao-emergencial"

const checkpoints=new Set([1,3,5,10,20]),passed:number[]=[]
useGameEngine.getState().initializeGame("BGT")
const initial=useGameEngine.getState(),template=initial.squadPlayers[0]
if(!template)throw new Error("Elenco inicial vazio")
const REFORCO="QA Persistência 20 temporadas"
initial.buyPlayer({...template,id:991057,name:REFORCO,marketValue:100000},100000)

// ⚠️ A asserção anterior era "o reforço tem de continuar no elenco até a 5ª
// temporada". Isso NUNCA foi verdade por regra: contrato de reforço dura 2 ou 3
// anos, então perdê-lo na 3ª é o ciclo normal — e o teste passava só porque, com
// o bug da base de tempo, ninguém conferia o contrato de verdade.
//
// A invariante correta é mais forte e é exatamente a que o bug violava: enquanto
// ESTIVER SOB CONTRATO, o atleta não pode sumir. Guardamos o fim do vínculo para
// distinguir "saiu porque venceu" de "sumiu sozinho".
const contratoDoReforco=useGameEngine.getState().squadPlayers.find(p=>p.name===REFORCO)?.contract
if(!contratoDoReforco)throw new Error("O reforço de teste não entrou no elenco")
const fimDoContrato=contratoDoReforco.endDate
let reforcoJaSaiu=false

for(let season=1;season<=20;season++){
  for(let week=0;week<52;week++){
    useGameEngine.getState().advanceWeek()
    const agora=useGameEngine.getState()
    const presente=agora.squadPlayers.some(p=>p.name===REFORCO)
    if(!presente&&!reforcoJaSaiu){
      reforcoJaSaiu=true
      const semanaAbsoluta=absoluteWeek(agora.currentSeason,agora.currentWeek)
      if(semanaAbsoluta<fimDoContrato)throw new Error(`Reforço sumiu SOB CONTRATO na semana ${semanaAbsoluta} (o vínculo ia até ${fimDoContrato})`)
    }
    if(agora.squadPlayers.length<ELENCO_MINIMO)throw new Error(`Elenco furou o piso no meio da temporada ${season}: ${agora.squadPlayers.length} atletas`)
  }
  const before=useGameEngine.getState(),nextSeason=before.currentSeason+1
  useGameEngine.getState().processSeasonEnd(nextSeason,before.serieAStandings,before.serieAStandings)
  const state=useGameEngine.getState()
  if(state.currentSeason!==nextSeason||state.currentWeek!==0)throw new Error(`Transição inválida na temporada ${season}`)
  if(!Number.isFinite(state.balance)||state.squadPlayers.length<ELENCO_MINIMO)throw new Error(`Estado inválido na temporada ${season}: ${state.squadPlayers.length} atletas`)
  if(!state.squadPlayers.some(p=>p.position==="GOL"))throw new Error(`Elenco sem goleiro na temporada ${season}`)
  if(checkpoints.has(season)){passed.push(season);console.log(`OK campanha ${season} temporada(s): elenco=${state.squadPlayers.length}, saldo=${state.balance}`)}
}
if(passed.join(",")!=="1,3,5,10,20")throw new Error("Checkpoints incompletos")
console.log("OK campanhas longas: 1, 3, 5, 10 e 20 temporadas")
