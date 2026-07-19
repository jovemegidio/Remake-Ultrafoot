// PHASE 3 — Modo Desafios
// Status: skeleton — define a API. Cenários: salvar do rebaixamento, subir divisão,
// estadual pequeno, sub-23, copa sem contratar, classificar continental,
// reconstruir gigante, reduzir folha salarial.

import type { GameState } from "@/lib/save-system"

export type ChallengeId =
  | "save_relegation"
  | "promote_division"
  | "small_state"
  | "u23_only"
  | "cup_no_signings"
  | "qualify_continental"
  | "rebuild_giant"
  | "cut_payroll"

export type ChallengeDifficulty = "facil" | "medio" | "dificil" | "lendario"

export interface ChallengeGoal {
  id: string
  description: string
  metric: "league_position" | "title" | "promotion" | "stay_above" | "qualify_continental" | "max_payroll" | "no_signings" | "u23_starts"
  target: number | string
  currentValue?: number | string
  completed: boolean
}

export interface ChallengeConfig {
  id: ChallengeId
  nome: string
  descricao: string
  difficulty: ChallengeDifficulty
  startTeamCurto?: string         // sugestão de time
  durationSeasons: number         // 1, 3, 5
  goals: ChallengeGoal[]
  reward: { prestigio: number; saldo: number; achievementId?: string }
}

export interface ChallengeProgress {
  challengeId: ChallengeId
  startedAt: number
  startSeason: number
  currentSeason: number
  goals: ChallengeGoal[]
  failed: boolean
  completed: boolean
}

export const CHALLENGES: ChallengeConfig[] = [
  ["save_relegation","Operação permanência","Evite o rebaixamento.","dificil","stay_above",16], ["promote_division","Rumo à elite","Conquiste o acesso.","medio","promotion",1], ["small_state","Zebra estadual","Conquiste o estadual com um pequeno.","lendario","title","estadual"], ["u23_only","Geração futura","Use uma equipe sub-23.","dificil","u23_starts",8], ["cup_no_signings","Copa sem reforços","Vença uma copa sem contratar.","lendario","no_signings",1], ["qualify_continental","Passaporte continental","Classifique para competição continental.","medio","qualify_continental",1], ["rebuild_giant","Gigante de volta","Reconstrua um gigante em crise.","dificil","league_position",4], ["cut_payroll","Contas em dia","Reduza a folha e termine no azul.","medio","max_payroll",0],
].map(([id,nome,descricao,difficulty,metric,target])=>({id:id as ChallengeId,nome:String(nome),descricao:String(descricao),difficulty:difficulty as ChallengeDifficulty,durationSeasons:metric==="league_position"?3:1,goals:[{id:`${id}-goal`,description:String(descricao),metric:metric as ChallengeGoal["metric"],target:target as number|string,completed:false}],reward:{prestigio:3,saldo:2_000_000,achievementId:"challenge_complete"}}))

/** Inicia desafio: aplica setup específico no GameState (orçamento, elenco, etc). */
export function startChallenge(id: ChallengeId, state: GameState): GameState {
  if(!CHALLENGES.some(c=>c.id===id))throw new Error(`Desafio inválido: ${id}`);const next=structuredClone(state);if(id==="cut_payroll")next.balance=Math.min(next.balance??0,5_000_000);if(id==="save_relegation")next.teamMorale=45;next.updatedAt=Date.now();return next
}

/** Avalia progresso do desafio após cada rodada/temporada. */
export function evaluateChallenge(progress: ChallengeProgress, state: GameState): ChallengeProgress {
  const next=structuredClone(progress),last=state.seasonHistory?.at(-1);next.currentSeason=state.season;next.goals=next.goals.map(g=>{let completed=g.completed;if(g.metric==="promotion")completed=!!last?.promoted;else if(g.metric==="league_position")completed=!!last&&last.position<=Number(g.target);else if(g.metric==="stay_above")completed=!!last&&!last.relegated&&last.position<=Number(g.target);else if(g.metric==="qualify_continental")completed=!!last&&last.position<=6;else if(g.metric==="title")completed=!!last&&last.position===1;else if(g.metric==="no_signings")completed=(state.transfers??[]).filter(t=>t.season===state.season&&t.type==="buy").length===0;else if(g.metric==="u23_starts")completed=(state.squadPlayers??[]).filter(p=>p.age<=23).length>=Number(g.target);else if(g.metric==="max_payroll")completed=(state.balance??-1)>=Number(g.target);return{...g,completed}});next.completed=next.goals.every(g=>g.completed);const cfg=CHALLENGES.find(c=>c.id===next.challengeId);next.failed=!next.completed&&state.season>=next.startSeason+(cfg?.durationSeasons??1);return next
}

/** Aplica recompensa quando completado. */
export function claimReward(progress: ChallengeProgress, state: GameState): GameState {
  if(!progress.completed||progress.failed)throw new Error("O desafio ainda não foi concluído.");const reward=CHALLENGES.find(c=>c.id===progress.challengeId)?.reward;if(!reward)return structuredClone(state);const next=structuredClone(state);next.balance=(next.balance??0)+reward.saldo;if(next.selectedTeam)next.selectedTeam.prestigio=Math.min(100,next.selectedTeam.prestigio+reward.prestigio);next.coachXP+=reward.prestigio*10;return next
}
