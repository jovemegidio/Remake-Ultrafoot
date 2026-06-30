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
export function generateQuestions(_moment: InterviewMoment, _ctx: Record<string, unknown>): InterviewQuestion[] {
  throw new Error("interviews-engine.generateQuestions: not implemented")
}

/** Aplica resposta — propaga efeitos. */
export function answerQuestion(
  _question: InterviewQuestion,
  _answerId: string,
): InterviewAnswer["effects"] {
  throw new Error("interviews-engine.answerQuestion: not implemented")
}
