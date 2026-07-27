// ARTILHEIROS/ASSISTENCIAS da COMPETICAO INTEIRA.
//
// O motor simula as partidas da CPU guardando so o PLACAR — nao quem fez o gol.
// Entao a tela de estatisticas so conseguia mostrar o elenco do usuario. Aqui
// atribuimos os gols simulados a jogadores plausiveis de cada time (atacantes/
// meias pontuam mais; zagueiro/goleiro quase nunca), de forma DETERMINISTICA:
// a mesma partida sempre gera os mesmos goleadores, entao o jogador acumula ao
// longo da temporada e o ranking fica estavel entre telas.
//
// O time do USUARIO NAO e gerado: usamos os numeros REAIS (seasonStats), porque
// esses o motor rastreia de verdade. Os outros times sao estimados — e uma
// aproximacao honesta para dar vida ao ranking, nao um dado oficial.

import type { MatchResult, MatchScorer } from "@/lib/game-engine"
import type { Player } from "@/lib/players-data"

export interface CompStatRow {
  key: string
  name: string
  teamShort: string
  teamName: string
  nat?: string
  goals: number
  assists: number
  matches: number
}

// Peso de cada posicao para FAZER o gol e para dar a ASSISTENCIA.
const PESO_GOL: Record<string, number> = { ATA: 5, EXT: 3.2, MEI: 1.5, VOL: 0.6, LAT: 0.5, ZAG: 0.45, GOL: 0.02 }
const PESO_AST: Record<string, number> = { EXT: 4, MEI: 3.6, ATA: 2.2, LAT: 1.7, VOL: 1, ZAG: 0.4, GOL: 0.05 }

function makeRng(seed: string): () => number {
  let h = 1779033703 ^ seed.length
  for (let i = 0; i < seed.length; i++) { h = Math.imul(h ^ seed.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19) }
  let s = h >>> 0
  return () => { s = Math.imul(s ^ (s >>> 15), s | 1) >>> 0; let t = (s + 0x6d2b79f5) >>> 0; t = Math.imul(t ^ (t >>> 7), t | 61); t ^= t + Math.imul(t ^ (t >>> 14), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296 }
}

// Escolhe um jogador ponderando posicao * overall^2 (craque marca mais).
function escolhe(players: Player[], pesos: Record<string, number>, rand: number, exceto?: string): Player | null {
  const cands = players.filter(p => p.nome !== exceto)
  if (!cands.length) return null
  const w = cands.map(p => (pesos[String(p.pos)] ?? 0.4) * Math.pow(Math.max(40, p.base) / 100, 2))
  const total = w.reduce((a, b) => a + b, 0)
  if (total <= 0) return cands[Math.floor(rand * cands.length)]
  let alvo = rand * total
  for (let i = 0; i < cands.length; i++) { alvo -= w[i]; if (alvo <= 0) return cands[i] }
  return cands[cands.length - 1]
}

/**
 * Goleadores REAIS de UMA partida (um item por gol), com time e assistente. Usa o
 * mesmo criterio da artilharia da competicao (posicao * overall^2, ~62% assist),
 * mas de forma DETERMINISTICA por partida — o motor grava isto em MatchResult.scorers
 * na simulacao, para as estatisticas lerem dado persistido em vez de re-atribuir.
 */
export function gerarScorersDaPartida(params: {
  homeShort: string
  awayShort: string
  homePlayers: Player[]
  awayPlayers: Player[]
  homeScore: number
  awayScore: number
  seedBase: string
}): MatchScorer[] {
  const out: MatchScorer[] = []
  const gerarLado = (short: string, players: Player[], gols: number) => {
    if (gols <= 0 || !players.length) return
    for (let g = 0; g < gols; g++) {
      const rand = makeRng(`${params.seedBase}-${short}-g${g}`)
      const artilheiro = escolhe(players, PESO_GOL, rand())
      if (!artilheiro) continue
      let assist: string | undefined
      if (rand() < 0.62) {
        const assistente = escolhe(players, PESO_AST, rand(), artilheiro.nome)
        if (assistente) assist = assistente.nome
      }
      out.push({ teamShort: short, name: artilheiro.nome, nat: artilheiro.nac, assist })
    }
  }
  gerarLado(params.homeShort, params.homePlayers, params.homeScore)
  gerarLado(params.awayShort, params.awayPlayers, params.awayScore)
  return out
}

/**
 * Gera as linhas de artilharia/assistencia da competicao a partir dos placares
 * simulados. O time do usuario entra com os numeros REAIS (userRows).
 *
 * Quando a partida ja traz `scorers` gravados pelo motor (dado persistido), eles
 * tem prioridade sobre a atribuicao pelo placar — assim o ranking reflete o que
 * de fato foi simulado. Partidas antigas (sem scorers) caem na atribuicao.
 */
export function gerarEstatisticasCompeticao(params: {
  resultados: MatchResult[]
  squadDe: (short: string) => Player[]
  nomeDe: (short: string) => string
  userShort: string
  userRows: CompStatRow[]
}): CompStatRow[] {
  const { resultados, squadDe, nomeDe, userShort, userRows } = params
  const acc = new Map<string, CompStatRow>()
  const jogosDoTime = new Map<string, number>()

  const somar = (row: CompStatRow) => {
    const ex = acc.get(row.key)
    if (ex) { ex.goals += row.goals; ex.assists += row.assists }
    else acc.set(row.key, { ...row })
  }

  for (const m of resultados) {
    jogosDoTime.set(m.homeTeam, (jogosDoTime.get(m.homeTeam) ?? 0) + 1)
    jogosDoTime.set(m.awayTeam, (jogosDoTime.get(m.awayTeam) ?? 0) + 1)

    // Caminho preferencial: a partida ja traz os goleadores REAIS gravados pelo
    // motor. Usa-os direto (pulando o time do usuario, coberto por userRows).
    if (m.scorers && m.scorers.length > 0) {
      for (const s of m.scorers) {
        if (s.teamShort === userShort) continue
        somar({ key: `${s.teamShort}:${s.name}`, name: s.name, teamShort: s.teamShort, teamName: nomeDe(s.teamShort), nat: s.nat, goals: 1, assists: 0, matches: 0 })
        if (s.assist) {
          somar({ key: `${s.teamShort}:${s.assist}`, name: s.assist, teamShort: s.teamShort, teamName: nomeDe(s.teamShort), goals: 0, assists: 1, matches: 0 })
        }
      }
      continue
    }

    for (const lado of [{ short: m.homeTeam, gols: m.homeScore }, { short: m.awayTeam, gols: m.awayScore }]) {
      if (lado.short === userShort) continue // time do usuario usa stats reais
      if (lado.gols <= 0) continue
      const squad = squadDe(lado.short)
      if (!squad.length) continue
      const teamName = nomeDe(lado.short)
      for (let g = 0; g < lado.gols; g++) {
        const rand = makeRng(`${m.homeTeam}-${m.awayTeam}-${m.season}-${m.week}-g${g}`)
        const artilheiro = escolhe(squad, PESO_GOL, rand())
        if (!artilheiro) continue
        somar({ key: `${lado.short}:${artilheiro.nome}`, name: artilheiro.nome, teamShort: lado.short, teamName, nat: artilheiro.nac, goals: 1, assists: 0, matches: 0 })
        // ~62% dos gols tem assistencia, de um companheiro diferente.
        if (rand() < 0.62) {
          const assistente = escolhe(squad, PESO_AST, rand(), artilheiro.nome)
          if (assistente) somar({ key: `${lado.short}:${assistente.nome}`, name: assistente.nome, teamShort: lado.short, teamName, nat: assistente.nac, goals: 0, assists: 1, matches: 0 })
        }
      }
    }
  }

  // Matches ~ jogos do time (os goleadores sao titulares regulares).
  for (const row of acc.values()) row.matches = jogosDoTime.get(row.teamShort) ?? row.matches

  // Junta com os numeros REAIS do time do usuario.
  return [...acc.values(), ...userRows]
}
