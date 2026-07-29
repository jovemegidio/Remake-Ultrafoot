"use client"

// TRIBUNAL DESPORTIVO — a expulsão vai a julgamento.
//
// Até aqui a suspensão era fixa por cartão: expulsou, cumpre um jogo, fim. No
// futebol de verdade o caso é julgado e a pena varia com a natureza da infração
// — e às vezes com a "exagerada na súmula" do árbitro, que é o que faz o técnico
// reclamar do tribunal e não do juiz.
//
// O valor disto não é simulação jurídica: é transformar uma expulsão numa
// notícia da semana, com uma espera e um veredito.

export type InfracaoTribunal =
  | "segundo_amarelo"     // expulsão comum: julgamento sumário
  | "falta_dura"
  | "reclamacao"
  | "agressao"
  | "briga_generalizada"

export interface JulgamentoTribunal {
  infracao: InfracaoTribunal
  /** Jogos de suspensão aplicados no total (inclui o automático). */
  jogos: number
  /** Multa ao clube, em reais. 0 quando não há. */
  multaClube: number
  /** Texto do veredito, para a caixa de mensagens. */
  veredito: string
  /** true quando a pena foi maior que a mínima — é o que gera revolta. */
  agravada: boolean
}

interface Faixa { min: number; max: number; multa: number; nome: string }

const FAIXAS: Record<InfracaoTribunal, Faixa> = {
  segundo_amarelo:    { min: 1, max: 1, multa: 0,      nome: "segundo cartão amarelo" },
  reclamacao:         { min: 1, max: 2, multa: 5_000,  nome: "reclamação com o árbitro" },
  falta_dura:         { min: 1, max: 3, multa: 15_000, nome: "falta dura" },
  agressao:           { min: 4, max: 8, multa: 60_000, nome: "agressão" },
  briga_generalizada: { min: 3, max: 6, multa: 90_000, nome: "briga generalizada" },
}

/**
 * Julga a expulsão.
 *
 * `sorteio` fica como parâmetro para o resultado ser reproduzível em teste — o
 * resto do jogo sorteia direto e não dá para repetir um caso.
 */
export function julgar(infracao: InfracaoTribunal, sorteio: number = Math.random()): JulgamentoTribunal {
  const faixa = FAIXAS[infracao]
  const amplitude = faixa.max - faixa.min
  // Distribuição puxada para a pena MÍNIMA: o tribunal agrava a minoria dos
  // casos. Se agravasse metade, viraria imposto e não notícia.
  const severidade = sorteio ** 2
  const jogos = faixa.min + Math.round(severidade * amplitude)
  const agravada = jogos > faixa.min

  const veredito = agravada
    ? `Julgamento por ${faixa.nome}: o tribunal agravou a pena para ${jogos} ${jogos === 1 ? "jogo" : "jogos"} de suspensão.`
    : `Julgamento por ${faixa.nome}: pena mínima de ${jogos} ${jogos === 1 ? "jogo" : "jogos"}.`

  return {
    infracao,
    jogos,
    multaClube: agravada ? faixa.multa : Math.round(faixa.multa * 0.4),
    veredito,
    agravada,
  }
}

/** Infração provável a partir do que aconteceu em campo. */
export function inferirInfracao(motivo: "segundo_amarelo" | "vermelho_direto", violenta: boolean): InfracaoTribunal {
  if (motivo === "segundo_amarelo") return "segundo_amarelo"
  return violenta ? "agressao" : "falta_dura"
}
