import type { GameState, SquadPlayer, YouthAlumniRecord, YouthCareerState } from "@/lib/save-system"
import type { Team } from "@/lib/teams-data"
import { generateYouthBatch } from "@/lib/youth-engine"

export const YOUTH_COMPETITIONS = [
  "Copa São Paulo de Futebol Júnior",
  "Campeonato Brasileiro Sub-20",
  "Copa do Brasil Sub-20",
] as const

type YouthStage = { name: string; matches: number; kind: "group" | "league" | "knockout"; qualificationPoints?: number }
export type YouthCompetitionFormat = {
  name: typeof YOUTH_COMPETITIONS[number]
  participants: number
  registrationLimit: number
  maximumAge: number
  stages: YouthStage[]
  source: string
}

/** Formatos masculinos vigentes em 2026. O motor simula somente a chave do usuario. */
export const YOUTH_COMPETITION_FORMATS_2026: YouthCompetitionFormat[] = [
  {
    name: YOUTH_COMPETITIONS[0], participants: 128, registrationLimit: 30, maximumAge: 20,
    stages: [
      { name: "Fase de grupos", matches: 3, kind: "group", qualificationPoints: 4 },
      { name: "Segunda fase", matches: 1, kind: "knockout" },
      { name: "Terceira fase", matches: 1, kind: "knockout" },
      { name: "Oitavas de final", matches: 1, kind: "knockout" },
      { name: "Quartas de final", matches: 1, kind: "knockout" },
      { name: "Semifinal", matches: 1, kind: "knockout" },
      { name: "Final", matches: 1, kind: "knockout" },
    ],
    source: "FPF REC Copinha 2026",
  },
  {
    name: YOUTH_COMPETITIONS[1], participants: 20, registrationLimit: 50, maximumAge: 20,
    stages: [
      { name: "Primeira fase", matches: 19, kind: "league", qualificationPoints: 27 },
      { name: "Quartas de final", matches: 2, kind: "knockout" },
      { name: "Semifinal", matches: 2, kind: "knockout" },
      { name: "Final", matches: 2, kind: "knockout" },
    ],
    source: "CBF Brasileiro Sub-20 2026",
  },
  {
    name: YOUTH_COMPETITIONS[2], participants: 64, registrationLimit: 50, maximumAge: 20,
    stages: [
      { name: "Primeira fase", matches: 1, kind: "knockout" },
      { name: "Segunda fase", matches: 2, kind: "knockout" },
      { name: "Oitavas de final", matches: 2, kind: "knockout" },
      { name: "Quartas de final", matches: 2, kind: "knockout" },
      { name: "Semifinal", matches: 2, kind: "knockout" },
      { name: "Final", matches: 2, kind: "knockout" },
    ],
    source: "CBF calendario nacional de base 2026",
  },
]

function hash(seed: string): number { let h=2166136261; for(const c of seed){h^=c.charCodeAt(0);h=Math.imul(h,16777619)} return h>>>0 }
function roll(seed: string): number { return (hash(seed)%10000)/10000 }

function initializeProgress(career: YouthCareerState): void {
  career.competitionIndex ??= Math.max(0, YOUTH_COMPETITIONS.indexOf(career.currentCompetition as typeof YOUTH_COMPETITIONS[number]))
  career.competitionStageIndex ??= 0
  career.competitionMatchInStage ??= 0
  career.competitionPoints ??= 0
  career.competitionAggregateFor ??= 0
  career.competitionAggregateAgainst ??= 0
  career.seasonPlacements ??= {}
  const format = YOUTH_COMPETITION_FORMATS_2026[career.competitionIndex] ?? YOUTH_COMPETITION_FORMATS_2026[0]
  career.currentCompetition = format.name
  career.competitionStage = format.stages[career.competitionStageIndex]?.name ?? "Encerrada"
}

export function createYouthCareer(team: Team, season=2026): { career: YouthCareerState; players: SquadPlayer[] } {
  const players=generateYouthBatch(season,22,team.prestigio).map((p,i)=>({...p,id:`academy_${team.curto}_${season}_${i}`,age:16+i%4,value:Math.max(150000,p.value),fromTeam:`${team.nome} Sub-20`,seasonSigned:season}))
  return { players, career: {
    active:true,category:"sub20",clubCurto:team.curto,clubNome:`${team.nome} Sub-20`,startedSeason:season,currentSeason:season,
    round:0,matches:0,wins:0,draws:0,losses:0,goalsFor:0,goalsAgainst:0,points:0,coachReputation:8,coachXP:0,
    titles:[],promotedPlayerIds:[],alumni:[],professionalOffers:[],seasonFinished:false,formation:"4-3-3",
    startingPlayerIds:players.slice(0,11).map(p=>p.id),currentCompetition:YOUTH_COMPETITIONS[0],
    competitionIndex:0,competitionStageIndex:0,competitionMatchInStage:0,competitionPoints:0,
    competitionAggregateFor:0,competitionAggregateAgainst:0,competitionStage:"Fase de grupos",seasonPlacements:{},
  } }
}

function advanceCompetition(career: YouthCareerState, placement: string): void {
  initializeProgress(career)
  career.seasonPlacements![career.currentCompetition!] = placement
  career.competitionIndex = (career.competitionIndex ?? 0) + 1
  career.competitionStageIndex = 0
  career.competitionMatchInStage = 0
  career.competitionPoints = 0
  career.competitionAggregateFor = 0
  career.competitionAggregateAgainst = 0
  const next = YOUTH_COMPETITION_FORMATS_2026[career.competitionIndex]
  if (!next) {
    career.seasonFinished = true
    career.currentCompetition = YOUTH_COMPETITIONS[2]
    career.competitionStage = "Temporada encerrada"
    return
  }
  career.currentCompetition = next.name
  career.competitionStage = next.stages[0].name
}

function applyYouthResult(next: GameState, goalsFor: number, goalsAgainst: number): void {
  const c=next.youthCareer
  if(!c?.active||c.seasonFinished)return
  initializeProgress(c)
  const format=YOUTH_COMPETITION_FORMATS_2026[c.competitionIndex ?? 0]
  const stage=format?.stages[c.competitionStageIndex ?? 0]
  if(!format||!stage){advanceCompetition(c,"Encerrada");return}

  const win=goalsFor>goalsAgainst,draw=goalsFor===goalsAgainst
  c.round++;c.matches++;c.goalsFor+=goalsFor;c.goalsAgainst+=goalsAgainst;c.wins+=win?1:0;c.draws+=draw?1:0;c.losses+=!win&&!draw?1:0;c.points+=win?3:draw?1:0
  c.coachXP+=win?15:draw?8:4;c.coachReputation=Math.min(100,c.coachReputation+(win?.8:draw?.25:-.12))
  c.competitionMatchInStage=(c.competitionMatchInStage ?? 0)+1
  c.competitionPoints=(c.competitionPoints ?? 0)+(win?3:draw?1:0)
  c.competitionAggregateFor=(c.competitionAggregateFor ?? 0)+goalsFor
  c.competitionAggregateAgainst=(c.competitionAggregateAgainst ?? 0)+goalsAgainst

  if((c.competitionMatchInStage ?? 0)<stage.matches)return
  let qualified=true
  if(stage.kind==="group"||stage.kind==="league") qualified=(c.competitionPoints ?? 0)>=(stage.qualificationPoints ?? 0)
  else {
    const gf=c.competitionAggregateFor ?? 0,ga=c.competitionAggregateAgainst ?? 0
    qualified=gf>ga||(gf===ga&&roll(`${c.clubCurto}:${c.currentSeason}:${format.name}:${stage.name}:penalties`)>=.5)
  }

  if(!qualified){advanceCompetition(c,`Eliminado - ${stage.name}`);return}
  const lastStage=(c.competitionStageIndex ?? 0)===format.stages.length-1
  if(lastStage){
    const title=`${format.name} ${c.currentSeason}`
    if(!c.titles.includes(title))c.titles.push(title)
    c.coachReputation=Math.min(100,c.coachReputation+12);c.coachXP+=180
    advanceCompetition(c,"Campeao")
    return
  }
  c.competitionStageIndex=(c.competitionStageIndex ?? 0)+1
  c.competitionMatchInStage=0;c.competitionPoints=0;c.competitionAggregateFor=0;c.competitionAggregateAgainst=0
  c.competitionStage=format.stages[c.competitionStageIndex].name
}

function developPlayers(next: GameState, chance: number): void {
  const c=next.youthCareer!
  next.youthPlayers=(next.youthPlayers??[]).map(p=>p.age<=20&&p.overall<p.potential&&roll(`${p.id}:${c.currentSeason}:${c.round}`)<chance?{...p,overall:p.overall+1,trend:"up"}:p)
  next.week++;next.updatedAt=Date.now()
}

export function applyPlayedYouthMatch(state: GameState, goalsFor: number, goalsAgainst: number): GameState {
  if(!state.youthCareer?.active||state.youthCareer.seasonFinished)return state
  const next=structuredClone(state);applyYouthResult(next,goalsFor,goalsAgainst);developPlayers(next,.22);return next
}

export function simulateYouthRound(state: GameState): GameState {
  const career=state.youthCareer;if(!career?.active||career.seasonFinished)return state
  const quality=(state.youthPlayers??[]).slice(0,11).reduce((n,p)=>n+p.overall,0)/Math.max(1,Math.min(11,(state.youthPlayers??[]).length))
  const r=roll(`${career.clubCurto}:${career.currentSeason}:${career.currentCompetition}:${career.round}`)
  const gf=Math.max(0,Math.floor(r*4+(quality-60)/18)),ga=Math.max(0,Math.floor(roll(`opp:${career.currentSeason}:${career.currentCompetition}:${career.round}:${career.clubCurto}`)*4))
  const next=structuredClone(state);applyYouthResult(next,gf,ga);developPlayers(next,.18);return next
}

export function finishYouthSeason(state: GameState): GameState {
  if(!state.youthCareer?.seasonFinished)return state
  const next=structuredClone(state),c=next.youthCareer!,champion=Object.values(c.seasonPlacements??{}).includes("Campeao")
  const graduates=(next.youthPlayers??[]).filter(p=>p.age>=19).slice(0,Math.max(2,champion?5:3)),elite=["Liverpool","FC Barcelona","Real Madrid","Bayern de Munique","Manchester City"]
  for(const p of graduates){const level=p.potential>=86?"elite":"professional",record:YouthAlumniRecord={playerId:p.id,playerName:p.name,position:p.position,potential:p.potential,trainedFromSeason:p.seasonSigned??c.currentSeason,trainedToSeason:c.currentSeason,currentClub:level==="elite"?elite[hash(p.id)%elite.length]:c.clubNome.replace(" Sub-20",""),currentLevel:level,careerTitles:[],nationalTeamCaps:0,worldCupTitles:0,relationship:85};c.alumni.push(record);c.promotedPlayerIds.push(p.id)}
  next.youthPlayers=(next.youthPlayers??[]).filter(p=>!graduates.some(g=>g.id===p.id)).map(p=>({...p,age:p.age+1}));next.youthPlayers.push(...generateYouthBatch(c.currentSeason+1,graduates.length,c.coachReputation+55).map((p,i)=>({...p,id:`academy_${c.clubCurto}_${c.currentSeason+1}_${i}`,age:16+i%3,fromTeam:c.clubNome})))
  c.alumni=advanceAlumni(c.alumni,c.currentSeason);c.currentSeason++;c.round=0;c.matches=0;c.wins=0;c.draws=0;c.losses=0;c.goalsFor=0;c.goalsAgainst=0;c.points=0;c.seasonFinished=false;c.professionalOffers=generateProfessionalOffers(c)
  c.competitionIndex=0;c.competitionStageIndex=0;c.competitionMatchInStage=0;c.competitionPoints=0;c.competitionAggregateFor=0;c.competitionAggregateAgainst=0;c.currentCompetition=YOUTH_COMPETITIONS[0];c.competitionStage="Fase de grupos";c.seasonPlacements={}
  next.season=c.currentSeason;next.week=0;next.updatedAt=Date.now();return next
}

export function generateProfessionalOffers(career: YouthCareerState): YouthCareerState["professionalOffers"] {
  if(career.coachReputation<22)return[]
  const clubs=[{clubCurto:"PON",clubNome:"Ponte Preta"},{clubCurto:"CRB",clubNome:"CRB"},{clubCurto:"CEA",clubNome:"Ceara"},{clubCurto:career.clubCurto,clubNome:career.clubNome.replace(" Sub-20","")}]
  return clubs.filter((_,i)=>career.coachReputation>=22+i*12).map((x,i)=>({id:`offer-${career.currentSeason}-${x.clubCurto}`,...x,role:i===clubs.length-1?"head_coach":"assistant",reputationRequired:22+i*12,monthlySalary:18000+i*14000,contractMonths:24,objectives:i<2?["Evitar rebaixamento","Promover 2 atletas da base"]:["Classificar para competicao continental","Valorizar jovens do elenco"]}))
}

export function acceptProfessionalOffer(state: GameState, offerId: string): GameState {
  const next=structuredClone(state),offer=next.youthCareer?.professionalOffers.find(o=>o.id===offerId);if(!offer)return state;next.selectedTeamShort=offer.clubCurto;if(next.youthCareer)next.youthCareer.active=false;next.coachLegacy.careerRecords.push({teamShort:offer.clubCurto,teamName:offer.clubNome,seasons:0,titles:[],bestPosition:0,youthAcademyLevelLeft:1,startedSeason:next.season,endedSeason:next.season,endReason:"novo_desafio"});next.updatedAt=Date.now();return next
}

export function advanceAlumni(alumni: YouthAlumniRecord[], season: number): YouthAlumniRecord[] {return alumni.map(a=>{const next={...a,careerTitles:[...a.careerTitles]};if(roll(`${a.playerId}:title:${season}`)<(a.currentLevel==="elite"?.42:.12))next.careerTitles.push(a.currentLevel==="elite"?"Liga dos Campeoes":"Campeonato nacional");if(a.potential>=82&&roll(`${a.playerId}:caps:${season}`)<.65)next.nationalTeamCaps+=2+hash(`${season}:${a.playerId}`)%9;if(next.nationalTeamCaps>20&&season%4===2&&roll(`${a.playerId}:wc:${season}`)<.08)next.worldCupTitles++;return next})}
