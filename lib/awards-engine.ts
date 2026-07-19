// Prêmios individuais de fim de temporada.
//
// Lacuna em relação aos outros managers: o jogo fechava a temporada apenas com
// campeão, acesso e rebaixamento. Não havia Bola de Ouro, artilheiro, luva de
// ouro, revelação nem seleção do campeonato — os feitos individuais do elenco
// simplesmente não eram reconhecidos em lugar nenhum.
//
// Tudo aqui é derivado de dados que a carreira já produz (artilharia, minutos,
// notas, classificação). Nada é sorteado.

import { normalizePosition } from "@/lib/formations"

export type AwardId =
  | "bola_de_ouro"
  | "artilheiro"
  | "luva_de_ouro"
  | "revelacao"
  | "melhor_tecnico"

export interface AwardWinner {
  award: AwardId
  title: string
  playerId?: number
  playerName: string
  teamShort: string
  /** Linha curta que justifica a escolha ("23 gols em 34 jogos"). */
  detail: string
}

export interface SeasonAwards {
  season: number
  competition: string
  winners: AwardWinner[]
  /** Seleção do campeonato: 11 nomes por posição. */
  teamOfTheSeason: { playerId?: number; playerName: string; teamShort: string; position: string; rating: number }[]
}

export interface AwardCandidate {
  playerId: number
  playerName: string
  teamShort: string
  position: string
  age: number
  overall: number
  goals: number
  assists: number
  matches: number
  cleanSheets?: number
  /** Nota média da temporada, quando a carreira registrou. */
  rating?: number
}

/**
 * Pontuação de impacto do atleta na temporada. Gols e assistências pesam mais no
 * ataque; para goleiro e defesa, jogos disputados e clean sheets sustentam a nota.
 */
function impactScore(candidate: AwardCandidate, championShort: string): number {
  const position = normalizePosition(candidate.position)
  const isKeeper = position === "GOL"
  const isDefender = ["ZAG", "LD", "LE"].includes(position)

  const attacking = candidate.goals * 4 + candidate.assists * 2.5
  const availability = Math.min(38, candidate.matches) * 0.8
  const keeping = isKeeper ? (candidate.cleanSheets ?? 0) * 5 : 0
  const defending = isDefender ? (candidate.cleanSheets ?? 0) * 2.5 : 0
  const quality = candidate.overall * 0.5 + (candidate.rating ?? 6.5) * 4
  // Jogar no time campeão pesa, como pesa na vida real, mas não decide sozinho.
  const titleBonus = candidate.teamShort === championShort ? 12 : 0

  return attacking + availability + keeping + defending + quality + titleBonus
}

function best(candidates: AwardCandidate[], score: (c: AwardCandidate) => number): AwardCandidate | null {
  let winner: AwardCandidate | null = null
  let bestScore = -Infinity
  for (const candidate of candidates) {
    const value = score(candidate)
    if (value > bestScore) {
      bestScore = value
      winner = candidate
    }
  }
  return winner
}

const TEAM_OF_SEASON_SLOTS: { position: string; count: number }[] = [
  { position: "GOL", count: 1 },
  { position: "ZAG", count: 2 },
  { position: "LD", count: 1 },
  { position: "LE", count: 1 },
  { position: "VOL", count: 1 },
  { position: "MEI", count: 2 },
  { position: "PD", count: 1 },
  { position: "PE", count: 1 },
  { position: "ATA", count: 1 },
]

/** Monta a seleção do campeonato respeitando os slots da formação-base. */
function buildTeamOfTheSeason(candidates: AwardCandidate[], championShort: string): SeasonAwards["teamOfTheSeason"] {
  const used = new Set<number>()
  const squad: SeasonAwards["teamOfTheSeason"] = []

  for (const slot of TEAM_OF_SEASON_SLOTS) {
    const pool = candidates
      .filter(c => !used.has(c.playerId) && normalizePosition(c.position) === slot.position)
      .sort((a, b) => impactScore(b, championShort) - impactScore(a, championShort))

    for (let index = 0; index < slot.count; index++) {
      const pick = pool[index]
      if (!pick) continue
      used.add(pick.playerId)
      squad.push({
        playerId: pick.playerId,
        playerName: pick.playerName,
        teamShort: pick.teamShort,
        position: slot.position,
        rating: Math.round(impactScore(pick, championShort)),
      })
    }
  }

  return squad
}

/**
 * Apura os prêmios da temporada. `candidates` deve conter todo atleta com pelo
 * menos uma partida; quem não jogou não concorre.
 */
export function calcSeasonAwards(
  season: number,
  competition: string,
  championShort: string,
  championCoach: string,
  candidates: AwardCandidate[],
): SeasonAwards | null {
  const eligible = candidates.filter(c => c.matches > 0)
  if (eligible.length === 0) return null

  const winners: AwardWinner[] = []

  const mvp = best(eligible, c => impactScore(c, championShort))
  if (mvp) {
    winners.push({
      award: "bola_de_ouro",
      title: "Bola de Ouro",
      playerId: mvp.playerId,
      playerName: mvp.playerName,
      teamShort: mvp.teamShort,
      detail: `${mvp.goals} gols e ${mvp.assists} assistências em ${mvp.matches} jogos`,
    })
  }

  const scorer = best(eligible, c => c.goals * 100 + c.assists)
  if (scorer && scorer.goals > 0) {
    winners.push({
      award: "artilheiro",
      title: "Artilheiro",
      playerId: scorer.playerId,
      playerName: scorer.playerName,
      teamShort: scorer.teamShort,
      detail: `${scorer.goals} gols em ${scorer.matches} jogos`,
    })
  }

  const keepers = eligible.filter(c => normalizePosition(c.position) === "GOL")
  const keeper = best(keepers, c => (c.cleanSheets ?? 0) * 100 + c.matches)
  if (keeper) {
    winners.push({
      award: "luva_de_ouro",
      title: "Luva de Ouro",
      playerId: keeper.playerId,
      playerName: keeper.playerName,
      teamShort: keeper.teamShort,
      detail: `${keeper.cleanSheets ?? 0} jogos sem sofrer gol`,
    })
  }

  // Revelação: até 21 anos com participação real (evita premiar quem entrou 2x).
  const youngsters = eligible.filter(c => c.age <= 21 && c.matches >= 8)
  const revelation = best(youngsters, c => impactScore(c, championShort))
  if (revelation) {
    winners.push({
      award: "revelacao",
      title: "Revelação da Temporada",
      playerId: revelation.playerId,
      playerName: revelation.playerName,
      teamShort: revelation.teamShort,
      detail: `${revelation.age} anos · ${revelation.matches} jogos`,
    })
  }

  winners.push({
    award: "melhor_tecnico",
    title: "Melhor Técnico",
    playerName: championCoach,
    teamShort: championShort,
    detail: `Campeão do ${competition}`,
  })

  return {
    season,
    competition,
    winners,
    teamOfTheSeason: buildTeamOfTheSeason(eligible, championShort),
  }
}
