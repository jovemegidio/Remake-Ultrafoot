import type { Personality } from "@/lib/youth-engine"
// A leitura do adversário mora num lugar só: a preparação, a partida e este
// relatório têm de enxergar o MESMO time.
import { acertoDoFoco, type EstiloDoAdversario, type FocoTatico } from "@/lib/plano-contra-o-adversario"

export type ScoutTier="regional"|"national"|"continental"|"elite_global"
export type ScoutMissionType="young"|"first_team"|"expiring"|"loan"|"undervalued"|"specific_position"
export type ReportStage="initial"|"partial"|"complete"
export interface ScoutAttributes{currentAbility:number;potentialAbility:number;youthDiscovery:number;marketKnowledge:number;negotiation:number}
export interface DepartmentScout{id:string;name:string;tier:ScoutTier;attributes:ScoutAttributes;monthlySalary:number;missionId?:string}
/** Atleta real do universo que pode ser observado. O snapshot fica na missão
 * para o mesmo jogador continuar sendo acompanhado nas semanas seguintes. */
export interface ScoutCandidate{id:string;name:string;clubShort:string|null;clubName:string;country:string;nationality?:string;position:string;age:number;overall:number;potential:number;value:number;weeklySalary:number;contractEndSeason:number;currentSeason:number;morale:number;injuryWeeks:number;attributes:Record<string,number>}
export interface ScoutMission{id:string;scoutId:string;type:ScoutMissionType;region:string;position?:string;ageMin?:number;ageMax?:number;maxSalary?:number;maxValue?:number;startedWeek:number;durationWeeks:number;progressWeeks:number;status:"active"|"complete"|"cancelled";target?:ScoutCandidate
  /**
   * A missão terminou sem encontrar ninguém no perfil pedido.
   *
   * ⚠️ ANTES DA 1.0.383 ISSO NÃO EXISTIA — e o departamento INVENTAVA um atleta.
   * Sem candidato real, `advanceScoutingWeek` caía num gerador que produzia
   * "Atleta 123456" com overall, potencial, custo e risco de lesão fabricados a
   * partir do hash do id da missão. O relatório aparecia em "Descobertos" como
   * qualquer outro e o atleta não existia em lugar nenhum do universo: não dava
   * para sondar, negociar nem contratar. Um olheiro que não acha ninguém tem de
   * DIZER que não achou.
   */
  semAchados?:boolean}
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
      // ⚠️ SÓ HÁ RELATÓRIO SE HÁ ATLETA DE VERDADE. O ramo `else` daqui gerava um
      // atleta fictício quando a busca não encontrava candidato no universo — ver
      // `ScoutMission.semAchados`.
      if(m.target){
        const report=makeCandidateReport(m.target,scout.name,regionOf(m.region),currentWeek,stage,m.progressWeeks,scout.attributes)
        next.reports=next.reports.filter(r=>r.playerId!==report.playerId).concat(report)
      }
    }
    if(stage==="complete"){
      m.status="complete"
      m.semAchados=!m.target
      scout.missionId=undefined
      // Missão que não achou ninguém não constrói reputação: o departamento é
      // avaliado pelo que entrega, não por semanas de viagem.
      if(m.target)next.reputation=Math.min(100,next.reputation+2)
    }
  }
  return next
}
/**
 * O ATLETA COMO O CENTRO DE DADOS O VÊ. Só o que existe no elenco de verdade.
 */
export interface AtletaParaAnalise {
  name: string
  position: string
  age: number
  overall: number
  energy?: number
  form?: number
  moralePoints?: number
  injuryWeeks?: number
  seasonYellows?: number
  /** Temporada em que o contrato acaba, quando conhecida. */
  contractEndSeason?: number
}

export interface EntradaDaAnalise {
  week: number
  season?: number
  /** Nível do centro de dados, 1-5. Quanto mais alto, mais fundo o relatório vai. */
  dataLevel: number
  elenco: readonly AtletaParaAnalise[]
  /**
   * O próximo adversário, já LIDO — o estilo vem de
   * `lib/plano-contra-o-adversario.estiloDoAdversario`, a MESMA leitura que a
   * preparação e a partida usam. Uma segunda leitura aqui seria uma segunda
   * régua para a mesma grandeza, e o relatório mandaria o técnico se preparar
   * contra um time diferente do que entra em campo.
   */
  adversario?: { nome: string; estilo: EstiloDoAdversario; dossie: number } | null
}

/**
 * O RELATÓRIO DO CENTRO DE DADOS.
 *
 * ⚠️ O QUE ISTO CORRIGE. Até a 1.0.382 esta função devolvia TEXTO CHUMBADO —
 * "Monitore a fadiga dos laterais", "Queda de intensidade após os 70 minutos" —
 * sempre as mesmas frases, independentemente do elenco, do adversário e da
 * temporada. A tela `/olheiros` exibia isso como se fosse análise, e o único
 * efeito do nível do centro de dados era CORTAR a lista fixa com um `slice`.
 * Pagar por um centro de dados nível 5 comprava mais frases, não mais
 * informação.
 *
 * Agora cada linha sai de um número do save. Nível de dados alto não acrescenta
 * frase: acrescenta PROFUNDIDADE — os alertas mais sutis (contrato a vencer,
 * curva de idade, cartões) só aparecem a partir do nível que os enxerga.
 */
export function generatePerformanceAnalysis(entrada:EntradaDaAnalise):PerformanceAnalysis{
  const nivel=Math.max(1,Math.min(5,Math.round(entrada.dataLevel)))
  const elenco=entrada.elenco
  const squadAlerts:string[]=[]

  if(elenco.length){
    const media=(f:(a:AtletaParaAnalise)=>number)=>elenco.reduce((s,a)=>s+f(a),0)/elenco.length
    const cansados=elenco.filter(a=>(a.energy??100)<65)
    if(cansados.length>=3)squadAlerts.push(`${cansados.length} atletas abaixo de 65% de energia — o mais desgastado é ${[...cansados].sort((a,b)=>(a.energy??100)-(b.energy??100))[0].name}.`)
    const lesionados=elenco.filter(a=>(a.injuryWeeks??0)>0)
    if(lesionados.length)squadAlerts.push(`Departamento médico com ${lesionados.length} ${lesionados.length===1?"atleta":"atletas"}; retorno mais distante em ${Math.max(...lesionados.map(a=>a.injuryWeeks??0))} semanas.`)
    const moralMedia=media(a=>a.moralePoints??55)
    if(moralMedia<45)squadAlerts.push(`Moral média do elenco em ${Math.round(moralMedia)}/100: o vestiário está pesado.`)
    // O setor mais fino do elenco: menos de 2 opções é uma lesão de distância
    // de um problema. Vale do nível 2 para cima.
    if(nivel>=2){
      const porSetor=new Map<string,number>()
      for(const a of elenco)porSetor.set(positionSector(a.position),(porSetor.get(positionSector(a.position))??0)+1)
      const minimo={GOL:2,DEF:6,MEI:5,ATA:3} as Record<string,number>
      for(const [setor,quantos] of porSetor){
        if(quantos<(minimo[setor]??3))squadAlerts.push(`Setor ${setor} com apenas ${quantos} ${quantos===1?"atleta":"atletas"}: uma lesão deixa o time descoberto.`)
      }
    }
    if(nivel>=3){
      const penduradas=elenco.filter(a=>(a.seasonYellows??0)>=4)
      if(penduradas.length)squadAlerts.push(`${penduradas.map(a=>a.name).join(", ")} ${penduradas.length===1?"está pendurado":"estão pendurados"} — o próximo amarelo tira do jogo seguinte.`)
    }
    if(nivel>=4&&entrada.season!=null){
      const vencendo=elenco.filter(a=>a.contractEndSeason!=null&&a.contractEndSeason<=entrada.season!+1&&a.overall>=media(x=>x.overall))
      if(vencendo.length)squadAlerts.push(`${vencendo.length} ${vencendo.length===1?"titular":"titulares"} com contrato acabando: ${vencendo.slice(0,3).map(a=>a.name).join(", ")}.`)
    }
    if(nivel>=5){
      const idadeMedia=media(a=>a.age)
      if(idadeMedia>=29)squadAlerts.push(`Idade média em ${idadeMedia.toFixed(1)} anos: a janela deste grupo está fechando.`)
      else if(idadeMedia<=23)squadAlerts.push(`Idade média em ${idadeMedia.toFixed(1)} anos: elenco verde, oscilação esperada fora de casa.`)
    }
  }
  if(!squadAlerts.length)squadAlerts.push("Nenhum alerta relevante: elenco inteiro, descansado e com a cabeça no lugar.")

  // ── O ADVERSÁRIO ──────────────────────────────────────────────────────────
  //
  // Sem próximo jogo mapeado o relatório DIZ que não sabe, em vez de inventar
  // duas frases genéricas como fazia antes.
  if(!entrada.adversario){
    return{week:entrada.week,squadAlerts,
      opponentStrengths:["Sem próximo adversário definido no calendário."],
      opponentWeaknesses:["Sem próximo adversário definido no calendário."],
      tacticalRecommendations:["Envie olheiros ao próximo rival para que a comissão possa montar um plano."]}
  }

  const {nome,estilo,dossie}=entrada.adversario
  const confianca=Math.max(0,Math.min(1,dossie/100))
  const leitura=LEITURA_DO_ESTILO[estilo]
  // Quanto o dossiê revela: sem observação o relatório mostra só o traço mais
  // grosso, e DIZ que está incompleto.
  const quantos=confianca>=0.8?leitura.forcas.length:confianca>=0.4?2:1
  const opponentStrengths=leitura.forcas.slice(0,quantos)
  const opponentWeaknesses=leitura.fraquezas.slice(0,quantos)
  if(confianca<0.4){
    opponentStrengths.push(`Dossiê sobre o ${nome} em ${Math.round(confianca*100)}%: mande olheiros antes de fechar um plano.`)
  }

  // ⚠️ A RECOMENDAÇÃO É O FOCO QUE `planoContraOAdversario` PREMIA. É o elo que
  // faltava entre o departamento de olheiros e a Central de Gestão: o relatório
  // aponta a sessão de preparação que vai render, e o técnico decide se segue.
  // Sem isto, a análise seria conselho solto — o defeito antigo com outra
  // roupa.
  const focos:FocoTatico[]=["pressionar","contra_atacar","controlar","fechar_espacos"]
  const melhor=[...focos].sort((a,b)=>acertoDoFoco(b,estilo).acerto-acertoDoFoco(a,estilo).acerto)[0]
  const pior=[...focos].sort((a,b)=>acertoDoFoco(a,estilo).acerto-acertoDoFoco(b,estilo).acerto)[0]
  const tacticalRecommendations=[
    `Preparar a semana com foco "${ROTULO_DO_FOCO[melhor]}": ${acertoDoFoco(melhor,estilo).motivo}`,
  ]
  if(nivel>=3)tacticalRecommendations.push(`Evitar "${ROTULO_DO_FOCO[pior]}": ${acertoDoFoco(pior,estilo).motivo}`)
  if(nivel>=4)tacticalRecommendations.push(`Marcar sob pressão o principal criador do ${nome} custa espaço atrás — vale quando ele é o único que constrói.`)

  return{week:entrada.week,squadAlerts,opponentStrengths,opponentWeaknesses,tacticalRecommendations}
}

const ROTULO_DO_FOCO:Record<FocoTatico,string>={
  pressionar:"Pressionar saída",contra_atacar:"Contra-atacar",controlar:"Controlar posse",fechar_espacos:"Fechar espaços",
}

/** O que cada estilo de jogo entrega e o que ele expõe. */
const LEITURA_DO_ESTILO:Record<EstiloDoAdversario,{forcas:string[];fraquezas:string[]}>={
  pressiona_alto:{
    forcas:["Sufoca a saída de bola e recupera no campo de ataque.","Segunda bola quase sempre é deles.","Transição imediata após o roubo."],
    fraquezas:["Linha altíssima: o espaço nas costas dos zagueiros está aberto.","Cai de ritmo depois dos 65 minutos.","Vulnerável à bola longa por cima da primeira pressão."],
  },
  sai_jogando:{
    forcas:["Constrói de trás com paciência e atrai a marcação.","Zagueiros confortáveis com a bola no pé.","Domina o meio quando tem tempo."],
    fraquezas:["Erra no campo de defesa sob pressão coordenada.","Goleiro participa da saída: encurralá-lo rende posse alta.","Demora a chegar quando obrigada a jogar direto."],
  },
  contra_ataca:{
    forcas:["Letal no espaço: bloco médio e saída em três passes.","Aproveita bem cada bola recuperada.","Não se expõe: joga o jogo que quer."],
    fraquezas:["Sem espaço para correr, não cria nada.","Sofre quando obrigada a ter a bola.","Bola parada defensiva é o ponto frágil."],
  },
  bloco_baixo:{
    forcas:["Compacta e difícil de furar pelo meio.","Não concede profundidade.","Aguenta pressão longa sem se desorganizar."],
    fraquezas:["Entrega a bola e a iniciativa.","Sofre com cruzamento e bola parada ofensiva.","Se sair atrás no placar, tem de mudar tudo."],
  },
  equilibrado:{
    forcas:["Sem traço marcante: se adapta ao jogo do adversário.","Não comete erros grosseiros de estrutura.","Competitiva em qualquer cenário."],
    fraquezas:["Sem arma clara: raramente impõe o próprio jogo.","Cede a iniciativa a quem tem plano.","Depende de individualidade para decidir."],
  },
}

/** Regiao normalizada do relatorio. Continentes fora da lista caem no Brasil. */
function regionOf(region:string):ScoutRegion{return (["europa","africa","asia"].includes(region)?region:"br_sudeste") as ScoutRegion}
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
