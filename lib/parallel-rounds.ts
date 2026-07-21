// Resultados dos OUTROS campeonatos que correm na mesma semana.
//
// O motor só simula as competições do clube do jogador. Na prática, em janeiro
// e fevereiro os 27 estaduais correm ao mesmo tempo — a tela "Resultados da
// Rodada" mostrava só o Paulista e dava a impressão de que o resto do país
// tinha parado.
//
// POR QUE NÃO PERSISTIR: gravar ~270 partidas por semana (27 estaduais) daria
// mais de 10 mil resultados por temporada dentro do save, que já é grande e vive
// no armazenamento local do app. Estes resultados são de LEITURA: existem para
// serem lidos na tela da rodada, e por isso são recalculados sob demanda.
//
// POR QUE PRECISA SER DETERMINÍSTICO: sem semente, `Math.random()` daria um
// placar diferente a cada render — abrir a mesma rodada duas vezes mostraria
// resultados diferentes, o que é pior do que não mostrar nada.

import { allBrazilianTeams, allPoolTeams, type Team } from "@/lib/teams-data"
import { ESTADO_CAMPEONATO } from "@/lib/use-game-manager"

export interface RoundResult {
  competition: string
  homeTeam: string
  awayTeam: string
  homeScore: number
  awayScore: number
}

/** Gerador com semente (mulberry32): mesma semente, mesma sequência, sempre. */
function rngComSemente(semente: number): () => number {
  let a = semente >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function semear(texto: string): number {
  let h = 2166136261
  for (let i = 0; i < texto.length; i++) {
    h ^= texto.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

/** Clubes de um estado, sem repetidos, do mais forte para o mais fraco. */
function timesDoEstado(estado: string): Team[] {
  const vistos = new Set<string>()
  return [...allBrazilianTeams, ...allPoolTeams]
    .filter(t => t.estado === estado)
    .filter(t => {
      const k = (t.file_key || t.curto || t.nome).toLowerCase()
      if (vistos.has(k)) return false
      vistos.add(k)
      return true
    })
    .sort((a, b) => (b.prestigio ?? 0) - (a.prestigio ?? 0))
    .slice(0, 16)
}

/** Confrontos da rodada por rodízio (mesmo esquema do estadual do jogador). */
function confrontosDaRodada(times: Team[], rodada: number): [Team, Team][] {
  const lista: (Team | null)[] = times.length % 2 === 0 ? [...times] : [...times, null]
  const fixo = lista[0]
  const girando = lista.slice(1)
  for (let i = 1; i < rodada; i++) girando.unshift(girando.pop()!)

  const pares: [Team, Team][] = []
  const meio = lista.length / 2
  const ordem = [fixo, ...girando]
  for (let i = 0; i < meio; i++) {
    const casa = ordem[i]
    const fora = ordem[lista.length - 1 - i]
    if (casa && fora) pares.push(rodada % 2 === 0 ? [fora, casa] : [casa, fora])
  }
  return pares
}

/**
 * Placar por prestígio, com a mesma lógica de vantagem de mando usada no motor.
 * A semente inclui os clubes, então o resultado de um jogo não muda se outro
 * estadual entrar ou sair da lista.
 */
function placar(casa: Team, fora: Team, semente: string): [number, number] {
  const rng = rngComSemente(semear(semente))
  const forcaCasa = (casa.prestigio ?? 50) + 5
  const forcaFora = fora.prestigio ?? 50
  const chanceCasa = forcaCasa / (forcaCasa + forcaFora)
  const golsCasa = Math.floor(rng() * 4 * ((1.3 + chanceCasa * 1.5) / 2))
  const golsFora = Math.floor(rng() * 4 * ((1.1 + (1 - chanceCasa) * 1.5) / 2))
  return [golsCasa, golsFora]
}

/**
 * Resultados dos demais estaduais na semana pedida.
 *
 * `semanasDeEstadual` limita a janela: passado o estadual do jogador, os outros
 * também acabaram e devolvemos vazio em vez de inventar rodadas eternas.
 */
export function outrosEstaduaisDaRodada(input: {
  season: number
  week: number
  estadoDoUsuario: string
  semanasDeEstadual: number
}): RoundResult[] {
  const { season, week, estadoDoUsuario, semanasDeEstadual } = input
  if (week < 1 || week > semanasDeEstadual) return []

  const saida: RoundResult[] = []
  for (const [estado, competicao] of Object.entries(ESTADO_CAMPEONATO)) {
    if (estado === estadoDoUsuario) continue
    const times = timesDoEstado(estado)
    if (times.length < 6) continue // campo pequeno demais para uma rodada crível

    for (const [casa, fora] of confrontosDaRodada(times, week)) {
      const [gc, gf] = placar(casa, fora, `${season}:${week}:${casa.curto}:${fora.curto}`)
      saida.push({
        competition: competicao,
        homeTeam: casa.curto,
        awayTeam: fora.curto,
        homeScore: gc,
        awayScore: gf,
      })
    }
  }
  return saida
}
