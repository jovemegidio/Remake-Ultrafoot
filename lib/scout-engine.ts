import type { Personality } from "@/lib/youth-engine"

export type ScoutTier="regional"|"national"|"continental"|"elite_global"
export type ScoutMissionType="young"|"first_team"|"expiring"|"loan"|"undervalued"|"specific_position"
export type ReportStage="initial"|"partial"|"complete"
export interface ScoutAttributes{currentAbility:number;potentialAbility:number;youthDiscovery:number;marketKnowledge:number;negotiation:number}
export interface DepartmentScout{id:string;name:string;tier:ScoutTier;attributes:ScoutAttributes;monthlySalary:number;missionId?:string}
/** Atleta real do universo que pode ser observado. O snapshot fica na missão
 * para o mesmo jogador continuar sendo acompanhado nas semanas seguintes. */
export interface ScoutCandidate{id:string;name:string;clubShort:string|null;clubName:string;country:string;nationality?:string;position:string;age:number;overall:number;potential:number;value:number;weeklySalary:number;contractEndSeason:number;currentSeason:number;morale:number;injuryWeeks:number;attributes:Record<string,number>}
export interface ScoutMission{id:string;scoutId:string;type:ScoutMissionType;region:string;position?:string;ageMin?:number;ageMax?:number;maxSalary?:number;maxValue?:number;startedWeek:number;durationWeeks:number;progressWeeks:number;status:"active"|"complete"|"cancelled";target?:ScoutCandidate}
export interface ScoutAssignment{id:string;scoutName:string;region:ScoutRegion;focus:"young"|"first_team"|"specific_position";positionFocus?:string;startedAt:number;durationWeeks:number;reportsCount:number}
export type ScoutRegion="br_sudeste"|"br_sul"|"br_nordeste"|"br_norte"|"br_centrooeste"|"sa_argentina"|"sa_uruguai"|"sa_outros"|"europa"|"africa"|"asia"
export interface ScoutReport{id:string;playerId:string;playerName:string;clubShort?:string|null;clubName?:string;country?:string;nationality?:string;position?:string;age?:number;scoutName:string;region:ScoutRegion;stage:ReportStage;observationWeeks:number;knownAttributes:Partial<Record<string,number>>;potentialEstimate:{min:number;max:number};tacticalFit?:number;injuryRisk?:"low"|"medium"|"high";expectedSalary?:number;estimatedTransferCost?:number;contractRisk?:"low"|"medium"|"high";personality?:Personality;recommendation:"sign"|"monitor"|"pass";notes:string;generatedAt:number}
export interface PerformanceAnalysis{week:number;squadAlerts:string[];opponentStrengths:string[];opponentWeaknesses:string[];tacticalRecommendations:string[]}
export interface ScoutingDepartmentState{scouts:DepartmentScout[];missions:ScoutMission[];reports:ScoutReport[];observationCentreLevel:1|2|3|4|5;dataCentreLevel:1|2|3|4|5;reputation:number;monthlyCost:number;lastAnalysis?:PerformanceAnalysis}

export function createScoutingDepartment():ScoutingDepartmentState{return{scouts:[],missions:[],reports:[],observationCentreLevel:1,dataCentreLevel:1,reputation:0,monthlyCost:0}}
export function departmentReputationLabel(value:number):string{return value>=90?"Referência Mundial":value>=70?"Referência Continental":value>=45?"Referência Nacional":value>=20?"Estruturado":"Amador"}
export function hireDepartmentScout(state:ScoutingDepartmentState,scout:DepartmentScout):ScoutingDepartmentState{const scouts=[...state.scouts,scout];return{...state,scouts,monthlyCost:scouts.reduce((n,s)=>n+s.monthlySalary,0)}}
/**
 * Demite um scout do departamento estratégico.
 *
 * Existia `hireDepartmentScout` e nada para desfazer: dava para contratar sem
 * limite e o custo mensal só subia — não havia como enxugar o departamento.
 * A missão em andamento é CANCELADA (sem o scout não há quem observe) e os
 * relatórios já entregues permanecem: o que foi observado, foi observado.
 */
export function fireDepartmentScout(state:ScoutingDepartmentState,scoutId:string):ScoutingDepartmentState{
  const alvo=state.scouts.find(s=>s.id===scoutId)
  if(!alvo)return state
  const scouts=state.scouts.filter(s=>s.id!==scoutId)
  const missions=state.missions.map(m=>m.scoutId===scoutId&&m.status==="active"?{...m,status:"cancelled" as const}:m)
  return{...state,scouts,missions,monthlyCost:scouts.reduce((n,s)=>n+s.monthlySalary,0)}
}
/** Custo da rescisão de um scout do departamento: um mês de salário. */
export function departmentScoutSeverance(scout:DepartmentScout):number{return Math.round(scout.monthlySalary)}
export function createScoutMission(state:ScoutingDepartmentState,mission:ScoutMission):ScoutingDepartmentState{return{...state,missions:[...state.missions,mission],scouts:state.scouts.map(s=>s.id===mission.scoutId?{...s,missionId:mission.id}:s)}}
export function advanceScoutingWeek(state:ScoutingDepartmentState,currentWeek:number,candidates:ScoutCandidate[]=[]):ScoutingDepartmentState{
  const next=structuredClone(state)
  for(const m of next.missions.filter(x=>x.status==="active")){
    m.progressWeeks++
    const scout=next.scouts.find(s=>s.id===m.scoutId)
    if(!scout)continue
    if(!m.target&&candidates.length)m.target=selectCandidateForMission(m,candidates,next.reports,currentWeek)
    const speed=next.observationCentreLevel>=4?2:1
    const stage:ReportStage=m.progressWeeks*speed>=m.durationWeeks?"complete":m.progressWeeks*speed>=Math.ceil(m.durationWeeks/2)?"partial":"initial"
    if(m.progressWeeks===1||stage!=="initial"||m.progressWeeks>=m.durationWeeks){
      const report=m.target
        ?makeCandidateReport(m.target,scout.name,regionOf(m.region),currentWeek,stage,m.progressWeeks,scout.attributes)
        :makeReport(`${m.id}:${m.progressWeeks}`,scout.name,regionOf(m.region),currentWeek,m.id,stage,m.progressWeeks,scout.attributes)
      next.reports=next.reports.filter(r=>r.playerId!==report.playerId).concat(report)
    }
    if(stage==="complete"){
      m.status="complete"
      scout.missionId=undefined
      next.reputation=Math.min(100,next.reputation+2)
    }
  }
  return next
}
export function generatePerformanceAnalysis(week:number,dataLevel:number):PerformanceAnalysis{return{week,squadAlerts:["Monitore a fadiga dos laterais","Queda de intensidade após os 70 minutos"].slice(0,Math.max(1,dataLevel-1)),opponentStrengths:["Transição rápida pelos lados","Bolas paradas ofensivas"].slice(0,Math.ceil(dataLevel/2)),opponentWeaknesses:["Espaço entre zaga e volantes","Dificuldade sob pressão alta"].slice(0,Math.ceil(dataLevel/2)),tacticalRecommendations:["Pressionar a saída nos primeiros 20 minutos",dataLevel>=3?"Atacar o corredor entre lateral e zagueiro":"Manter bloco compacto" ]}}

const assignments:ScoutAssignment[]=[]
export function assignScout(a:ScoutAssignment):void{const i=assignments.findIndex(x=>x.id===a.id);if(i>=0)assignments[i]=structuredClone(a);else assignments.push(structuredClone(a))}
export function tickScouting(week:number):ScoutReport[]{return assignments.filter(a=>week>=a.startedAt&&week<=a.startedAt+a.durationWeeks&&(week-a.startedAt)%2===0).map(a=>makeReport(`${a.id}-${week}`,a.scoutName,a.region,week))}
export function deepScout(playerId:string,scoutName:string):ScoutReport{return makeReport(playerId,scoutName,"br_sudeste",0,playerId,"complete",6)}
function regionOf(region:string):ScoutRegion{return (["europa","africa","asia"].includes(region)?region:"br_sudeste") as ScoutRegion}
function makeReport(seed:string,scoutName:string,region:ScoutRegion,week:number,playerId=seed,stage:ReportStage="partial",observationWeeks=2,skill?:ScoutAttributes):ScoutReport{const n=[...seed].reduce((a,c)=>a+c.charCodeAt(0),0),overall=55+n%30,potential=Math.min(95,overall+5+n%12),precision=stage==="complete"?2:stage==="partial"?5:9,fit=45+n%51,cost=Math.round((overall**3)*35),known:Partial<Record<string,number>>={};if(stage!=="initial")known.pace=50+n%40;if(stage==="complete")known.overall=overall;return{id:`report-${seed}-${week}`,playerId,playerName:`Atleta ${playerId.slice(-6)}`,scoutName,region,stage,observationWeeks,knownAttributes:known,potentialEstimate:{min:Math.max(1,potential-precision),max:Math.min(99,potential+precision)},tacticalFit:stage==="initial"?undefined:fit,injuryRisk:stage==="complete"?(n%10<2?"high":n%10<5?"medium":"low"):undefined,expectedSalary:stage==="complete"?Math.round(cost/120):undefined,estimatedTransferCost:stage==="complete"?cost:undefined,contractRisk:stage==="complete"?(n%3===0?"medium":"low"):undefined,recommendation:overall>=72&&fit>=65?"sign":overall>=62?"monitor":"pass",notes:stage==="complete"?"Relatório completo: técnica, finanças, personalidade e lesões validadas.":"Observação em andamento; valores exibidos são estimativas.",generatedAt:week}}

function simpleHash(value:string):number{let h=2166136261;for(const c of value)h=Math.imul(h^c.charCodeAt(0),16777619);return h>>>0}
function normalized(value:string):string{return(value||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase()}
function positionSector(value:string):string{const p=value.toUpperCase();if(["GOL","GK"].includes(p))return"GOL";if(["ZAG","DEF","LD","LE","DC","DL","DR"].includes(p))return"DEF";if(["ATA","CA","PE","PD","ST","CF","LW","RW"].includes(p))return"ATA";return"MEI"}
function selectCandidateForMission(mission:ScoutMission,candidates:ScoutCandidate[],reports:ScoutReport[],week:number):ScoutCandidate|undefined{
  const vistos=new Set(reports.map(r=>r.playerId))
  const regiao=normalized(mission.region)
  const filtrados=candidates.filter(c=>{
    if(vistos.has(c.id))return false
    const origem=normalized(`${c.country} ${c.nationality??""}`)
    if(regiao.includes("brasil")&&!origem.includes("brasil")&&!origem.includes("brazil"))return false
    if(regiao.includes("europa")&&!/(ingl|espan|ital|aleman|fran|portug|holan|belg|turq|russ|grec|europ)/.test(origem))return false
    if(mission.position&&positionSector(c.position)!==positionSector(mission.position))return false
    if(mission.ageMin!=null&&c.age<mission.ageMin)return false
    if(mission.ageMax!=null&&c.age>mission.ageMax)return false
    if(mission.maxSalary!=null&&c.weeklySalary>mission.maxSalary)return false
    if(mission.maxValue!=null&&c.value>mission.maxValue)return false
    if(mission.type==="young"&&c.age>21)return false
    if(mission.type==="expiring"&&c.contractEndSeason>c.currentSeason+1)return false
    if(mission.type==="loan"&&(c.age>24||c.overall<55))return false
    if(mission.type==="undervalued"&&c.value>Math.max(2_000_000,c.overall**3*45))return false
    return true
  })
  if(!filtrados.length)return undefined
  const ordenados=[...filtrados].sort((a,b)=>{
    const score=(c:ScoutCandidate)=>c.overall+(c.potential-c.overall)*(mission.type==="young"?1.4:.55)+(c.contractEndSeason<=c.currentSeason+1?5:0)-c.injuryWeeks*2
    return score(b)-score(a)||a.id.localeCompare(b.id)
  }).slice(0,Math.min(18,filtrados.length))
  return structuredClone(ordenados[simpleHash(`${mission.id}:${week}`)%ordenados.length])
}
function makeCandidateReport(candidate:ScoutCandidate,scoutName:string,region:ScoutRegion,week:number,stage:ReportStage,observationWeeks:number,skill:ScoutAttributes):ScoutReport{
  const stagePrecision=stage==="complete"?2:stage==="partial"?6:11
  const abilityPrecision=Math.round((99-skill.currentAbility)/24)
  const precision=Math.max(1,stagePrecision+abilityPrecision)
  const noise=(key:string)=>simpleHash(`${candidate.id}:${key}:${stage}`)%(precision*2+1)-precision
  const known:Partial<Record<string,number>>={}
  const keys=Object.keys(candidate.attributes)
  const revealCount=stage==="complete"?keys.length:stage==="partial"?Math.max(2,Math.ceil(keys.length/2)):1
  for(const key of keys.slice(0,revealCount))known[key]=Math.max(1,Math.min(99,(candidate.attributes[key]??candidate.overall)+noise(key)))
  if(stage==="complete")known.overall=candidate.overall
  const fit=Math.max(1,Math.min(99,Math.round((candidate.attributes.passing??candidate.overall)*.3+(candidate.attributes.physical??candidate.overall)*.25+(candidate.attributes.pace??candidate.overall)*.2+candidate.overall*.25)))
  const expiraLogo=candidate.contractEndSeason<=candidate.currentSeason+1
  const recommendation:ScoutReport["recommendation"]=candidate.overall>=72&&fit>=65?"sign":candidate.potential>=72||candidate.overall>=62?"monitor":"pass"
  return{
    id:`report-${candidate.id}-${week}`,playerId:candidate.id,playerName:candidate.name,
    clubShort:candidate.clubShort,clubName:candidate.clubName,country:candidate.country,nationality:candidate.nationality,
    position:candidate.position,age:candidate.age,scoutName,region,stage,observationWeeks,knownAttributes:known,
    potentialEstimate:{min:Math.max(candidate.overall,candidate.potential-precision),max:Math.min(99,candidate.potential+precision)},
    tacticalFit:stage==="initial"?undefined:fit,
    injuryRisk:stage==="complete"?(candidate.injuryWeeks>=4?"high":candidate.injuryWeeks>0?"medium":"low"):undefined,
    expectedSalary:stage==="complete"?candidate.weeklySalary:undefined,
    estimatedTransferCost:stage==="complete"?candidate.value:undefined,
    contractRisk:stage==="complete"?(expiraLogo?"high":candidate.contractEndSeason===candidate.currentSeason+2?"medium":"low"):undefined,
    recommendation,
    notes:stage==="complete"
      ?`Relatório completo de atleta do ${candidate.clubName}: contrato, custo, encaixe e risco verificados no universo da carreira.`
      :`Observação real em andamento no ${candidate.clubName}; a margem diminui a cada semana.`,generatedAt:week,
  }
}
