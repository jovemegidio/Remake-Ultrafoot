// PHASE 20 — Entrevistas (coletivas pré e pós-jogo)
// Status: skeleton — impactam moral, imprensa, torcida, diretoria, jogador específico.

export type InterviewMoment = "pre_match" | "post_match" | "transfer_window" | "crisis"

export interface InterviewQuestion {
  id: string
  moment: InterviewMoment
  text: string
  context?: { opponent?: string; resultMargin?: number; playerName?: string }
  options: InterviewAnswer[]
}

export interface InterviewAnswer {
  id: string
  text: string
  tone: "respectful" | "confident" | "aggressive" | "humble" | "evasive" | "honest"
  effects: {
    pressDelta: number             // -10..+10
    fanDelta: number
    boardDelta: number
    targetPlayerMoraleDelta?: { playerId: string; delta: number }
    rivalMoraleDelta?: number
  }
}

/** Gera lista de perguntas pra coletiva. */
export function generateQuestions(moment: InterviewMoment, ctx: Record<string, unknown>): InterviewQuestion[] {
  const opponent = String(ctx.opponent ?? "o adversário")
  const text = moment === "pre_match" ? `O que espera da partida contra ${opponent}?` : moment === "post_match" ? "Como avalia o desempenho da equipe?" : moment === "crisis" ? "Como pretende reagir à pressão?" : "O clube ainda fará contratações?"
  const option = (id:string, text:string, tone:InterviewAnswer["tone"], effects:InterviewAnswer["effects"]):InterviewAnswer => ({id,text,tone,effects})
  return [{ id:`${moment}-main`, moment, text, context:{ opponent }, options:[
    option("balanced","Respeitamos todos, mas estamos preparados.","respectful",{pressDelta:2,fanDelta:1,boardDelta:1}),
    option("bold","Vamos entrar para vencer.","confident",{pressDelta:3,fanDelta:4,boardDelta:0,rivalMoraleDelta:-1}),
    option("honest","Precisamos melhorar e assumir a responsabilidade.","honest",{pressDelta:4,fanDelta:0,boardDelta:3}),
    option("evasive","Prefiro responder dentro de campo.","evasive",{pressDelta:-2,fanDelta:-1,boardDelta:0}),
  ] }]
}

/** Aplica resposta — propaga efeitos. */
export function answerQuestion(
  question: InterviewQuestion,
  answerId: string,
): InterviewAnswer["effects"] {
  const answer = question.options.find(o=>o.id === answerId)
  if (!answer) throw new Error(`Resposta de entrevista inválida: ${answerId}`)
  return structuredClone(answer.effects)
}
