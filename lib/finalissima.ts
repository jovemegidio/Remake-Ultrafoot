"use client"

// FINALÍSSIMA — campeão da Copa América x campeão da Eurocopa.
//
// Não entrou em lib/national-competitions de propósito: aquele módulo modela
// competições de `group_knockout` ou `league`, e a Finalíssima é JOGO ÚNICO
// entre dois campeões já conhecidos. Forçá-la lá dentro exigiria um terceiro
// formato usado por uma só competição.
//
// Regra real: disputada no ano seguinte às duas competições continentais, em
// campo neutro, com pênaltis em caso de empate no tempo normal.

import { disputarPenaltis } from "@/lib/cup-engine"
import {
  getNationalTeamsByConfederation, NATIONAL_STRENGTH_2026, getNationalTeamById,
} from "@/lib/national-teams"

export interface DisputaFinalissima {
  temporada: number
  campeaoSulamericano: string
  campeaoEuropeu: string
  golsSulamericano?: number
  golsEuropeu?: number
  penaltisSulamericano?: number
  penaltisEuropeu?: number
  campeao?: string
  jogada: boolean
}

/** Sede neutra, alternando entre os continentes como na vida real. */
export function sedeDaFinalissima(temporada: number): string {
  const sedes = ["Wembley (Londres)", "Estádio Monumental (Buenos Aires)", "Lusail (Doha)", "Maracanã (Rio de Janeiro)"]
  return sedes[temporada % sedes.length]
}

/**
 * Só existe Finalíssima quando as DUAS competições já tiveram campeão. Sem isso
 * a partida apareceria no calendário com um lado vazio — que é o tipo de bug
 * silencioso que este projeto já teve com competições sem participantes.
 */
export function podeAcontecer(campeaoSulamericano?: string, campeaoEuropeu?: string): boolean {
  return Boolean(campeaoSulamericano && campeaoEuropeu)
}

export function criarFinalissima(
  temporada: number,
  campeaoSulamericano: string,
  campeaoEuropeu: string,
): DisputaFinalissima {
  return { temporada, campeaoSulamericano, campeaoEuropeu, jogada: false }
}

/**
 * Resolve a partida. `forcaSul`/`forcaEuro` são as forças das seleções (0-100).
 *
 * A diferença de força entra COMPRIMIDA, igual ao resto do motor: é uma final
 * entre dois campeões continentais, e o favoritismo não pode virar certeza.
 */
export function jogarFinalissima(
  jogo: DisputaFinalissima,
  forcaSul: number,
  forcaEuro: number,
  sorteio: () => number = Math.random,
): DisputaFinalissima {
  const vantagem = Math.sign(forcaSul - forcaEuro) * Math.pow(Math.abs(forcaSul - forcaEuro), 0.5) * 0.06
  const lambdaSul = Math.max(0.4, 1.3 + vantagem)
  const lambdaEuro = Math.max(0.4, 1.3 - vantagem)

  const golsPoisson = (lambda: number): number => {
    // Knuth: soma de exponenciais até estourar e^-lambda.
    const limite = Math.exp(-lambda)
    let k = 0
    let p = 1
    do { k++; p *= sorteio() } while (p > limite)
    return k - 1
  }

  const golsSul = golsPoisson(lambdaSul)
  const golsEuro = golsPoisson(lambdaEuro)

  const resultado: DisputaFinalissima = {
    ...jogo,
    golsSulamericano: golsSul,
    golsEuropeu: golsEuro,
    jogada: true,
  }

  if (golsSul === golsEuro) {
    const pen = disputarPenaltis(forcaSul, forcaEuro)
    resultado.penaltisSulamericano = pen.golsA
    resultado.penaltisEuropeu = pen.golsB
    resultado.campeao = pen.golsA > pen.golsB ? jogo.campeaoSulamericano : jogo.campeaoEuropeu
  } else {
    resultado.campeao = golsSul > golsEuro ? jogo.campeaoSulamericano : jogo.campeaoEuropeu
  }
  return resultado
}

// ─── CAMPEÃO DO OUTRO CONTINENTE ──────────────────────────────────────────────
//
// O jogo registra o campeão da competição que o USUÁRIO disputou (career.titles)
// e nada sobre o resto do mundo: se ele ganhou a Copa América, ninguém sabe quem
// levou a Eurocopa. Sem essa informação a Finalíssima não pode existir.
//
// A saída é derivar o campeão do outro continente das seleções reais, com a força
// pesando de verdade — não sorteio uniforme, senão San Marino ganharia a Euro
// tanto quanto a França. É o mesmo tipo de resolução que o jogo já faz para os
// resultados da IA, e é estável dentro da temporada.

export function forcaDaSelecao(id: string): number {
  return NATIONAL_STRENGTH_2026[id] ?? getNationalTeamById(id)?.baselineStrength ?? 72
}

function semente(texto: string): number {
  let h = 2166136261
  for (const c of texto) h = Math.imul(h ^ c.charCodeAt(0), 16777619)
  return h >>> 0
}

/**
 * Campeão continental provável de uma confederação, na temporada dada.
 *
 * Sorteio PONDERADO pela força elevada à quarta potência: as três ou quatro
 * favoritas ficam com a maior parte das chances, mas uma zebra continua possível
 * — como na vida real (Grécia 2004, Dinamarca 1992).
 */
export function campeaoContinental(
  confederacao: "CONMEBOL" | "UEFA",
  temporada: number,
): string | null {
  const selecoes = getNationalTeamsByConfederation(confederacao)
  if (selecoes.length === 0) return null
  const pesos = selecoes.map(s => Math.pow(Math.max(1, forcaDaSelecao(s.id) - 55), 4))
  const total = pesos.reduce((a, b) => a + b, 0)
  if (total <= 0) return selecoes[0].name
  let alvo = ((semente(`${confederacao}:${temporada}`) % 1_000_000) / 1_000_000) * total
  for (let i = 0; i < selecoes.length; i++) {
    alvo -= pesos[i]
    if (alvo <= 0) return selecoes[i].name
  }
  return selecoes[selecoes.length - 1].name
}

/** Linha pronta para o histórico/notícia. */
export function resumoFinalissima(j: DisputaFinalissima): string {
  if (!j.jogada) return `Finalíssima ${j.temporada}: ${j.campeaoSulamericano} x ${j.campeaoEuropeu}`
  const base = `${j.campeaoSulamericano} ${j.golsSulamericano} x ${j.golsEuropeu} ${j.campeaoEuropeu}`
  const pen = j.penaltisSulamericano !== undefined
    ? ` (${j.penaltisSulamericano}-${j.penaltisEuropeu} nos pênaltis)`
    : ""
  return `Finalíssima ${j.temporada}: ${base}${pen} — campeão: ${j.campeao}`
}
