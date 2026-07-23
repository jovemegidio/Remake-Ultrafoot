// MERCADO DE TREINADORES — propostas para quem esta SEM CLUBE.
//
// O problema que isto resolve: a tela /sem-clube gerava ofertas por um hash que
// IGNORAVA a carreira do tecnico. Um campeao que pedia demissao recebia as
// mesmas vagas de 2a divisao que um tecnico fracassado. A "otima temporada" nao
// contava nada depois de sair.
//
// Aqui a reputacao define QUE clubes te procuram: quanto melhor a carreira,
// maior o teto de prestigio dos clubes interessados. Funcao pura e deterministica
// (semente = rodada), para a tela poder testar e para "recusar e continuar"
// trazer um novo lote coerente.

import type { Team } from "@/lib/teams-data"

export interface CoachStanding {
  /** Reputacao 0-100 de buildCareerStats (titulos + aproveitamento + acessos). */
  reputation: number
  /** Titulos de carreira (coachTotalTitles + coachLegacy.totalTitles). */
  totalTitles: number
  /** coachLegacy.reputationLevel, 0-5 (sobe ao encerrar ciclo com titulo). */
  reputationLevel: number
}

const SECOND_DIVISIONS = new Set([
  "championship", "la_liga_2", "serie_b_ita", "bundesliga_2", "ligue_2",
  "liga_portugal_2", "eerste_divisie", "challenger_pro", "tff_1_lig", "russian_first",
  "primera_b_arg", "torneo_betplay", "primera_b_chi", "segunda_div_ury",
  "saudi_first_div", "j2_league", "k_league_2", "china_league_one",
])

const BRAZILIAN_TIERS = ["serie_a", "serie_b", "serie_c", "serie_d"]

function hash(value: string): number {
  let h = 2166136261
  for (const c of value) h = Math.imul(h ^ c.charCodeAt(0), 16777619)
  return h >>> 0
}

/**
 * Pontuacao 0-100 que resume o quanto o tecnico "vale" no mercado. A reputacao
 * pesa mais; titulos e nivel de legado empurram para cima um teto que satura em
 * 100 (nao adianta ter 30 titulos para estourar a escala).
 */
export function coachStandingScore(s: CoachStanding): number {
  const bruto =
    s.reputation * 0.6 +
    Math.min(s.totalTitles, 12) * 3 +
    Math.min(s.reputationLevel, 5) * 4
  return Math.max(0, Math.min(100, Math.round(bruto)))
}

/**
 * Teto de prestigio dos clubes que sondam o tecnico. Um iniciante (score 0)
 * chega a ~64 — 2a divisao e Serie A de baixo investimento, como era antes.
 * Um campeao consagrado (score ~100) alcanca ~94, ou seja, os gigantes passam a
 * ligar. A curva e suave para nao pular de "modesto" a "elite" com um titulo so.
 */
export function prestigeCeilingForStanding(score: number): number {
  return Math.round(63 + (score / 100) * 31) // 63..94
}

/**
 * Clubes que abririam o cargo para este tecnico, na semente dada. Retorna ate
 * `quantidade` propostas, das divisoes jogaveis e 2as divisoes do mundo, dentro
 * de uma faixa de prestigio ancorada no teto. Sempre devolve algo: se a faixa
 * de cima nao enche, desce o piso ate completar.
 */
export function ofertasParaDesempregado(
  clubs: readonly Team[],
  standing: CoachStanding,
  seed: number,
  quantidade = 3,
): Team[] {
  const score = coachStandingScore(standing)
  const teto = prestigeCeilingForStanding(score)
  // Faixa de 18 pontos abaixo do teto: um campeao recebe grandes E medios, nunca
  // so o topo absoluto (o mercado real tambem oferece opcoes de "reconstrucao").
  const pisoInicial = teto - 18

  const elegivel = (team: Team, piso: number): boolean => {
    const divisao = String(team.divisao)
    const divisaoOk = BRAZILIAN_TIERS.includes(divisao) || SECOND_DIVISIONS.has(divisao)
    if (!divisaoOk) return false
    return team.prestigio <= teto && team.prestigio >= piso
  }

  // Vai afrouxando o piso ate ter candidatos suficientes (ou o piso zerar).
  let piso = pisoInicial
  let pool: Team[] = []
  while (piso >= 0) {
    pool = clubs.filter(t => elegivel(t, piso))
    if (pool.length >= quantidade) break
    piso -= 6
  }
  if (pool.length === 0) {
    // Nem assim? Pega os de menor prestigio das divisoes permitidas (fallback duro).
    pool = clubs
      .filter(t => BRAZILIAN_TIERS.includes(String(t.divisao)) || SECOND_DIVISIONS.has(String(t.divisao)))
      .sort((a, b) => a.prestigio - b.prestigio)
  }

  // Ordena pela semente (varia a cada rodada), mas com um leve vies para os de
  // maior prestigio dentro da faixa — os melhores clubes disponiveis aparecem
  // primeiro, sem ser sempre os mesmos.
  return [...pool]
    .sort((a, b) => {
      const ra = hash(`${seed}:${a.file_key ?? a.curto}`) + a.prestigio * 900000
      const rb = hash(`${seed}:${b.file_key ?? b.curto}`) + b.prestigio * 900000
      return rb - ra
    })
    .slice(0, quantidade)
}
