// PLANO DE DESENVOLVIMENTO — em que cada atleta está evoluindo, e quanto ainda cresce.
//
// Pedido do PDF Ultra26 (p.15/16): "em elenco implemente Plano de
// desenvolvimento / plano de treino e escalações (...) e ajuste para funcionar
// corretamente com dados reais e corretamente".
//
// ⚠️ ESTE MÓDULO NÃO INVENTA UMA SEGUNDA CURVA DE EVOLUÇÃO.
//
// A tentação óbvia era escrever uma projeção "parecida" com a do motor para
// desenhar a barra. Seria a terceira vez que este projeto cria duas escalas
// para a mesma grandeza (ver [[ultrafoot-duas-escalas-prestigio-elenco]]), e o
// sintoma é sempre o mesmo: a tela promete +4 na temporada, a virada de ano
// entrega +2, e o jogador conclui — com razão — que o número é enfeite.
//
// Então a conta mora AQUI e o `game-engine` a IMPORTA. A projeção da tela e o
// ganho que a virada de temporada aplica são, literalmente, a mesma função.

import { gerarPersona, type PlayerPersona } from "@/lib/player-realism"

/** Em que ponto da carreira o atleta está — o rótulo da referência. */
export type FaseDeDesenvolvimento = "crescimento" | "regular" | "pico" | "declinio"

export const ROTULO_DA_FASE: Record<FaseDeDesenvolvimento, string> = {
  crescimento: "Crescimento",
  regular: "Regular",
  pico: "Pico",
  declinio: "Declínio",
}

export const DESCRICAO_DA_FASE: Record<FaseDeDesenvolvimento, string> = {
  crescimento: "Ainda ganha pontos por temporada. Minutos em campo aceleram.",
  regular: "Evolui devagar, sobretudo por treino individual.",
  pico: "No melhor momento. Mantém o nível enquanto jogar.",
  declinio: "Perde pontos a cada virada de ano. O profissionalismo segura a queda.",
}

/**
 * A fase sai da IDADE e da margem para o potencial, os dois números que o motor
 * de fato usa na virada de ano (`age <= 23 && margem > 0` cresce; `age >= 32`
 * declina). Nenhum limiar novo foi inventado aqui.
 */
export function faseDoAtleta(age: number, overall: number, potential: number): FaseDeDesenvolvimento {
  if (age >= 32) return "declinio"
  if (age <= 23 && potential - overall > 0) return "crescimento"
  if (age <= 29) return "regular"
  return "pico"
}

/**
 * O GANHO DE UMA VIRADA DE TEMPORADA.
 *
 * ⚠️ Esta função É o cálculo que `game-engine` executa ao virar o ano — ela foi
 * extraída de lá, não escrita ao lado. Qualquer ajuste de balanceamento feito
 * aqui muda o jogo e a projeção juntos, que é a única forma de os dois nunca
 * divergirem.
 *
 * @param jogos partidas disputadas na temporada; mais jogos, mais evolução.
 * @returns delta de overall (positivo no jovem, negativo no veterano, 0 no resto)
 */
export function ganhoDaTemporada(
  atleta: {
    id: number
    age: number
    overall: number
    potential: number
    persona?: PlayerPersona
  },
  jogos: number,
): number {
  const age = atleta.age + 1
  const margem = atleta.potential - atleta.overall
  const persona = atleta.persona ?? gerarPersona(atleta.id, atleta.overall)
  // PERSONA molda o desenvolvimento (realismo FM): determinação e
  // profissionalismo altos aceleram o jovem rumo ao potencial; baixos fazem o
  // talento "se perder". É por isso que dois jovens de mesmo potencial evoluem
  // diferente.
  const fatorPersona = 0.7 + ((persona.determinacao + persona.profissionalismo) / 40) * 0.9 // ~0.7-1.6

  if (age <= 23 && margem > 0) {
    const ritmo = age <= 19 ? 4 : age <= 21 ? 3 : 2
    const ganhoBase = ritmo + Math.floor(jogos / 12)
    // A ESCALA RESISTE NO TOPO (1.0.298). Subir de 50 para 60 é uma temporada
    // boa; de 90 para 95, uma carreira inteira.
    const resistencia = atleta.overall >= 88 ? 0.25
      : atleta.overall >= 82 ? 0.45
        : atleta.overall >= 75 ? 0.7
          : atleta.overall >= 65 ? 0.9 : 1
    // O piso de 1 ponto cai a partir de 82: acima disso a temporada pode não
    // render NADA, que é o que faz "estagnou" ser um destino possível.
    const piso = atleta.overall >= 82 ? 0 : 1
    return Math.min(margem, Math.max(piso, Math.round(ganhoBase * fatorPersona * resistencia)))
  }

  if (age >= 32) {
    const cai = (age >= 36 ? 3 : age >= 34 ? 2 : 1) - (persona.profissionalismo >= 15 ? 1 : 0)
    return -Math.max(0, cai)
  }

  return 0
}

export interface ProjecaoDeDesenvolvimento {
  fase: FaseDeDesenvolvimento
  /** Quanto ele deve ganhar (ou perder) na próxima virada de ano. */
  ganhoNaTemporada: number
  /** Overall previsto depois dela. */
  overallProjetado: number
  /** Quanto ainda falta para o potencial. 0 quando já chegou. */
  margem: number
  /**
   * Em quantas TEMPORADAS ele chega ao potencial, mantendo o ritmo atual.
   * `null` quando não cresce mais — e aí a tela precisa dizer isso com todas as
   * letras, em vez de desenhar uma barra parada e deixar o jogador esperando.
   */
  temporadasAtePotencial: number | null
}

export function projetarDesenvolvimento(
  atleta: {
    id: number
    age: number
    overall: number
    potential: number
    persona?: PlayerPersona
    seasonStats?: { matchesPlayed?: number }
  },
): ProjecaoDeDesenvolvimento {
  const jogos = atleta.seasonStats?.matchesPlayed ?? 0
  const ganho = ganhoDaTemporada(atleta, jogos)
  const margem = Math.max(0, atleta.potential - atleta.overall)

  // ⚠️ A conta de temporadas usa o ganho DESTE ano repetido, e não uma
  // integração da curva inteira: o ritmo cai com a idade e com a resistência do
  // topo, então o número real tende a ser MAIOR. É por isso que a tela o
  // apresenta como "mantendo este ritmo", e não como promessa.
  const temporadas = ganho > 0 && margem > 0 ? Math.ceil(margem / ganho) : null

  return {
    fase: faseDoAtleta(atleta.age, atleta.overall, atleta.potential),
    ganhoNaTemporada: ganho,
    overallProjetado: Math.max(42, Math.min(atleta.potential, atleta.overall + ganho)),
    margem,
    temporadasAtePotencial: temporadas,
  }
}

/**
 * Estrelas de 1 a 5 para a nota e para o potencial — o "FN / PR" da referência.
 *
 * Meia estrela existe de propósito: sem ela, a faixa de 60 a 79 inteira vira
 * "três estrelas" e o elenco todo parece igual.
 */
export function estrelas(valor: number): number {
  // 40 é o piso prático de overall no jogo (ver o clamp da virada de ano).
  const normalizado = Math.max(0, Math.min(1, (valor - 40) / 55))
  return Math.round(normalizado * 10) / 2
}
