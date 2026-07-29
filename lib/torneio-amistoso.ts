"use client"

// TORNEIO AMISTOSO CRIÁVEL — o jogador monta a própria competição.
//
// Com 2.994 clubes no seed, deixar o jogador escolher os convidados é um
// gerador de diversão desproporcional ao custo: dá para montar um quadrangular
// com quem nunca se enfrentaria, ou refazer um torneio histórico.
//
// Reaproveita o cup-engine para o mata-mata; aqui fica só a formação do torneio
// e a tabela do formato de pontos corridos.

import type { Team } from "@/lib/teams-data"

// "grupos" foi REMOVIDO: `participantesValidos` o aceitava (8, 12, 16 clubes) mas
// não existe gerador de fase de grupos aqui — quem escolhesse esse formato
// passaria a validação e receberia um torneio com ZERO jogos. Melhor não oferecer
// do que oferecer um caminho que não leva a nada.
export type FormatoTorneio = "mata_mata" | "pontos_corridos"

export interface ConfigTorneio {
  nome: string
  formato: FormatoTorneio
  /** Clubes convidados, pelo `curto`. */
  participantes: string[]
  /** Só para pontos corridos: ida e volta? */
  idaEVolta: boolean
}

export interface JogoTorneio {
  rodada: number
  mandanteCurto: string
  visitanteCurto: string
  golsMandante?: number
  golsVisitante?: number
  jogado: boolean
}

/** Quantos participantes cada formato aceita. */
export function participantesValidos(formato: FormatoTorneio): number[] {
  if (formato === "mata_mata") return [2, 4, 8, 16]
  return [3, 4, 5, 6, 7, 8, 10]        // pontos corridos aceita ímpar (folga)
}

export function validarTorneio(cfg: ConfigTorneio): string | null {
  if (!cfg.nome.trim()) return "Dê um nome ao torneio."
  const n = cfg.participantes.length
  if (new Set(cfg.participantes).size !== n) return "Há clubes repetidos."
  if (!participantesValidos(cfg.formato).includes(n)) {
    return `O formato escolhido aceita ${participantesValidos(cfg.formato).join(", ")} clubes — você escolheu ${n}.`
  }
  return null
}

/**
 * Tabela de pontos corridos pelo método do círculo (round-robin).
 *
 * Com número ímpar de clubes entra um "bye": alguém folga a cada rodada, que é
 * como se faz de verdade — em vez de recusar torneios ímpares.
 */
export function gerarPontosCorridos(participantes: string[], idaEVolta: boolean): JogoTorneio[] {
  const times = [...participantes]
  if (times.length % 2 === 1) times.push("__folga__")
  const n = times.length
  const rodadas = n - 1
  const jogos: JogoTorneio[] = []

  const fixo = times[0]
  let giro = times.slice(1)

  for (let r = 0; r < rodadas; r++) {
    const daRodada: [string, string][] = [[fixo, giro[giro.length - 1]]]
    for (let i = 0; i < (n - 2) / 2; i++) {
      daRodada.push([giro[i], giro[giro.length - 2 - i]])
    }
    for (const [a, b] of daRodada) {
      if (a === "__folga__" || b === "__folga__") continue
      // Alterna o mando por rodada para não concentrar jogos em casa.
      const inverte = r % 2 === 1
      jogos.push({
        rodada: r + 1,
        mandanteCurto: inverte ? b : a,
        visitanteCurto: inverte ? a : b,
        jogado: false,
      })
    }
    giro = [giro[giro.length - 1], ...giro.slice(0, -1)]
  }

  if (idaEVolta) {
    const volta = jogos.map(j => ({
      ...j,
      rodada: j.rodada + rodadas,
      mandanteCurto: j.visitanteCurto,
      visitanteCurto: j.mandanteCurto,
    }))
    jogos.push(...volta)
  }
  return jogos
}

/** Chaveamento de mata-mata: 1º x último, 2º x penúltimo, pelo prestígio. */
export function gerarMataMata(participantes: Team[]): JogoTorneio[] {
  const ordenados = [...participantes].sort((a, b) => b.prestigio - a.prestigio)
  const jogos: JogoTorneio[] = []
  for (let i = 0; i < ordenados.length / 2; i++) {
    jogos.push({
      rodada: 1,
      mandanteCurto: ordenados[i].curto,
      visitanteCurto: ordenados[ordenados.length - 1 - i].curto,
      jogado: false,
    })
  }
  return jogos
}

/**
 * Próxima fase do mata-mata, a partir dos vencedores da fase corrente.
 *
 * Sem isto `gerarMataMata` só produzia a PRIMEIRA rodada: um torneio de 8 clubes
 * terminava nas quartas e nunca tinha campeão. Devolve `[]` quando a fase atual
 * ainda não acabou ou quando já existe um campeão.
 *
 * Empate no mata-mata é resolvido pelo mandante — o amistoso não tem pênaltis
 * aqui, e "quem jogou em casa passa" é uma regra clara para o jogador.
 */
export function avancarMataMata(jogos: JogoTorneio[]): JogoTorneio[] {
  if (jogos.length === 0) return []
  const ultimaRodada = Math.max(...jogos.map(j => j.rodada))
  const daFase = jogos.filter(j => j.rodada === ultimaRodada)
  if (daFase.some(j => !j.jogado)) return []      // fase em andamento
  if (daFase.length < 2) return []                // a final já foi decidida

  const vencedores = daFase.map(j =>
    (j.golsMandante ?? 0) >= (j.golsVisitante ?? 0) ? j.mandanteCurto : j.visitanteCurto,
  )
  const proximos: JogoTorneio[] = []
  for (let i = 0; i < vencedores.length; i += 2) {
    if (vencedores[i + 1] === undefined) break
    proximos.push({
      rodada: ultimaRodada + 1,
      mandanteCurto: vencedores[i],
      visitanteCurto: vencedores[i + 1],
      jogado: false,
    })
  }
  return proximos
}

/** Campeão do mata-mata, ou null se ainda há jogo por decidir. */
export function campeaoMataMata(jogos: JogoTorneio[]): string | null {
  if (jogos.length === 0) return null
  const ultimaRodada = Math.max(...jogos.map(j => j.rodada))
  const daFase = jogos.filter(j => j.rodada === ultimaRodada)
  if (daFase.length !== 1 || !daFase[0].jogado) return null
  const f = daFase[0]
  return (f.golsMandante ?? 0) >= (f.golsVisitante ?? 0) ? f.mandanteCurto : f.visitanteCurto
}

/** Nome da fase pelo número de jogos que ela tem. */
export function rotuloFase(jogosNaFase: number): string {
  if (jogosNaFase === 1) return "Final"
  if (jogosNaFase === 2) return "Semifinal"
  if (jogosNaFase === 4) return "Quartas de final"
  if (jogosNaFase === 8) return "Oitavas de final"
  return "Fase eliminatória"
}

export interface LinhaTabela {
  curto: string
  pontos: number
  jogos: number
  vitorias: number
  empates: number
  derrotas: number
  golsPro: number
  golsContra: number
  saldo: number
}

export function classificacao(jogos: JogoTorneio[], participantes: string[]): LinhaTabela[] {
  const mapa = new Map<string, LinhaTabela>(
    participantes.map(c => [c, { curto: c, pontos: 0, jogos: 0, vitorias: 0, empates: 0, derrotas: 0, golsPro: 0, golsContra: 0, saldo: 0 }]),
  )
  for (const j of jogos) {
    if (!j.jogado || j.golsMandante === undefined || j.golsVisitante === undefined) continue
    const m = mapa.get(j.mandanteCurto)
    const v = mapa.get(j.visitanteCurto)
    if (!m || !v) continue
    m.jogos++; v.jogos++
    m.golsPro += j.golsMandante; m.golsContra += j.golsVisitante
    v.golsPro += j.golsVisitante; v.golsContra += j.golsMandante
    if (j.golsMandante > j.golsVisitante) { m.pontos += 3; m.vitorias++; v.derrotas++ }
    else if (j.golsMandante < j.golsVisitante) { v.pontos += 3; v.vitorias++; m.derrotas++ }
    else { m.pontos++; v.pontos++; m.empates++; v.empates++ }
  }
  for (const l of mapa.values()) l.saldo = l.golsPro - l.golsContra
  return [...mapa.values()].sort((a, b) =>
    b.pontos - a.pontos || b.saldo - a.saldo || b.golsPro - a.golsPro || a.curto.localeCompare(b.curto))
}
