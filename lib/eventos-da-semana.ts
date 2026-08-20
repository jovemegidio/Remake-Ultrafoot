// EVENTOS DA SEMANA — a regra muda, o jogo continua o mesmo.
//
// O modo é uma sequência de TRÊS partidas com uma restrição por cima: só clubes
// pequenos, teto de força, elenco sub-23, sempre como visitante. A cada semana
// entra outra restrição, e todo mundo joga a mesma — é isso que faz a
// classificação semanal significar alguma coisa.
//
// ⚠️ DE ONDE VEM A SEMANA. Não daqui: quem diz qual é a semana corrente é o
// RELAY (`semanaCorrente()` em rivals.mjs), e a tela recebe essa string junto
// com a classificação. Se cada máquina calculasse a própria semana, dois
// jogadores em fusos diferentes veriam regras diferentes na mesma quinta-feira e
// pontuariam em tabelas que não se encontram. Offline, a tela cai no cálculo
// local — e aí a partida é só treino, porque não há para onde enviar.
//
// ⚠️ E NÃO ENCOSTA NO SAVE. Como o Rush: partida avulsa, resultado morre na
// tela. É o que o gate `test-online-nao-toca-no-save` cobra.
//
// Módulo PURO — sem React, sem store, sem fetch.

import type { Team } from "@/lib/teams-data"

/** Quantas partidas tem uma tentativa. Três é o que cabe numa sentada. */
export const PARTIDAS_DO_EVENTO = 3

export type IdDaRegra = "clubes-pequenos" | "teto-salarial" | "sub23" | "sempre-visitante"

export interface RegraDoEvento {
  id: IdDaRegra
  nome: string
  /** A frase que a tela mostra. Curta: o jogador precisa entender antes de jogar. */
  resumo: string
  /** Quem pode ser escolhido nesta semana. */
  elegivel: (time: Team) => boolean
  /** A força com que o clube entra em campo depois da restrição. */
  forca: (time: Team) => number
  /** O jogador manda no campo? A regra do visitante inverte isso. */
  mandante: boolean
}

/**
 * ⚠️ A ORDEM DESTA LISTA É DADO PERSISTIDO NA PRÁTICA: a regra da semana sai de
 * um índice sobre ela. Acrescentar no FIM é seguro; reordenar troca a regra de
 * semanas que já foram jogadas e classificadas.
 */
export const REGRAS_DO_EVENTO: RegraDoEvento[] = [
  {
    id: "clubes-pequenos",
    nome: "Só clubes pequenos",
    resumo: "Prestígio até 65. Os gigantes ficam de fora — inclusive os adversários.",
    elegivel: t => t.prestigio <= 65,
    forca: t => t.prestigio,
    mandante: true,
  },
  {
    id: "teto-salarial",
    nome: "Teto salarial",
    resumo: "Todo clube entra em campo valendo no máximo 70. Escolher o maior não resolve.",
    elegivel: () => true,
    forca: t => Math.min(70, t.prestigio),
    mandante: true,
  },
  {
    id: "sub23",
    nome: "Só sub-23",
    resumo: "Elenco de garotos: o clube joga com 12 pontos de força a menos.",
    elegivel: () => true,
    // Não é castigo: o adversário sofre o mesmo desconto. O que muda é que o
    // favoritismo encolhe, e o azarão passa a ter chance de verdade.
    forca: t => Math.max(35, t.prestigio - 12),
    mandante: true,
  },
  {
    id: "sempre-visitante",
    nome: "Sempre visitante",
    resumo: "As três partidas fora de casa. Sem torcida, sem campo conhecido.",
    elegivel: () => true,
    forca: t => t.prestigio,
    mandante: false,
  },
]

/** Hash estável — o mesmo de `manager-rush`, e pelo mesmo motivo. */
function hash(texto: string): number {
  let h = 2166136261
  for (let i = 0; i < texto.length; i++) {
    h ^= texto.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return Math.abs(h)
}

/**
 * A REGRA DA SEMANA, derivada da string da semana ("2026-08-17", a segunda-feira).
 *
 * Derivar em vez de guardar é o que dispensa o servidor de ter uma cópia desta
 * lista: ele manda a semana, e as duas pontas chegam à mesma regra. Uma tabela
 * de regras no relay seria uma segunda verdade para manter em dia.
 */
export function regraDaSemana(semana: string): RegraDoEvento {
  return REGRAS_DO_EVENTO[hash(`evento:${semana}`) % REGRAS_DO_EVENTO.length]
}

/** A segunda-feira da semana de uma data ISO — o mesmo recorte do relay. */
export function semanaLocal(dataISO: string): string {
  const d = new Date(`${dataISO}T12:00:00Z`)
  const diaDaSemana = (d.getUTCDay() + 6) % 7   // 0 = segunda
  d.setUTCDate(d.getUTCDate() - diaDaSemana)
  return d.toISOString().slice(0, 10)
}

export function clubesElegiveis(clubes: readonly Team[], regra: RegraDoEvento): Team[] {
  return clubes.filter(regra.elegivel)
}

export interface AdversarioDoEvento {
  time: Team
  /** 1, 2 ou 3 — a ordem importa para o desafio subir. */
  rodada: number
}

/**
 * OS TRÊS ADVERSÁRIOS, sorteados pela semana + pelo clube escolhido.
 *
 * Determinístico de propósito: reabrir a tela não troca a tabela de jogos. Sem
 * isso o jogador reinicia até cair contra três times fracos, e a classificação
 * passa a medir paciência.
 */
export function adversariosDoEvento(
  clubes: readonly Team[],
  regra: RegraDoEvento,
  escolhido: Team,
  semana: string,
): AdversarioDoEvento[] {
  const pool = clubesElegiveis(clubes, regra).filter(t => t.file_key !== escolhido.file_key)
  if (pool.length === 0) return []
  const base = hash(`${semana}:${escolhido.file_key}`)
  const usados = new Set<string>()
  const jogos: AdversarioDoEvento[] = []
  for (let rodada = 1; rodada <= PARTIDAS_DO_EVENTO; rodada++) {
    // Cada rodada anda um passo diferente no pool para não repetir o vizinho.
    let i = (base + rodada * 977) % pool.length
    let voltas = 0
    while (usados.has(pool[i].file_key) && voltas++ < pool.length) i = (i + 1) % pool.length
    usados.add(pool[i].file_key)
    jogos.push({ time: pool[i], rodada })
  }
  return jogos
}

/** Vitória 3, empate 1 — a mesma conta do Champions, para o jogador não ter duas. */
export function pontosDe(golsPro: number, golsContra: number): number {
  return golsPro > golsContra ? 3 : golsPro === golsContra ? 1 : 0
}

export const PONTOS_MAXIMOS = PARTIDAS_DO_EVENTO * 3
