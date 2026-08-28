// PHASE 5 — Base e jovens
// Status: implementado — sub-17, sub-20, peneiras, olheiros, potencial,
// personalidade, empréstimos, promoção, torneios base, joias raras, relatórios.
// ⚠️ ESTE CABEÇALHO SE DECLARAVA INCOMPLETO E MENTIA. O módulo está completo
//    e é lido por 3 arquivos do jogo. Um rótulo desatualizado PARA MENOS
//    custa o mesmo que um para mais: leva quem audita a recriar do zero o
//    que já está pronto.

import type { GameState } from "@/lib/save-system"
import type { SquadPlayer } from "@/lib/save-system"
import { evoluirSemana, type JovemBase } from "@/lib/youth-academy-rules"
import { nomeDeAtleta } from "@/lib/nomes-por-pais"
import { nomeDeAtletaFeminina } from "@/lib/futebol-feminino"

export type YouthCategory = "sub17" | "sub20"

export type Personality =
  | "lider"
  | "ambicioso"
  | "calmo"
  | "polemico"
  | "profissional"
  | "preguicoso"
  | "leal"
  | "mercenario"
  | "estrela"

export interface YouthPlayer extends SquadPlayer {
  category: YouthCategory
  personality: Personality
  potentialMin: number             // potencial faixa min (40-99)
  potentialMax: number             // potencial faixa max
  hiddenAttributes: boolean        // olheiro precisa avaliar
  monthsInAcademy: number
  promoted: boolean                // foi promovido pro elenco principal
  loanedTo?: string                // curto do clube emprestado
}

export interface YouthIntake {
  season: number
  qualityRoll: number              // 1-100, baseado em infra base
  players: YouthPlayer[]
  rareGem?: YouthPlayer            // joia rara aleatória
}

export interface YouthMonthlyReport {
  season: number
  month: number
  totalPlayers: number
  promotions: number
  releases: number
  highlights: { playerId: string; reason: string }[]
}

/** Roda peneira: gera novos jovens conforme infra/categoria. */
/**
 * PENEIRA. Antes ela usava o mesmo gerador do elenco de base e devolvia garotos
 * de overall 55-75 — ou seja, entregava jogador PRONTO por R$ 100 mil. Peneira
 * nao funciona assim: vem molecada crua, quase toda sem futuro, e de vez em
 * quando aparece um com potencial de sobra. O que se compra numa peneira e a
 * chance, nao o atleta.
 *
 * Overall 34-50, potencial concentrado em 58-72, com 12% de chance de um
 * promissor (75-84) e 3% de joia (85-92). Nunca sai estrela feita.
 */
export function runTryout(state: GameState, category: YouthCategory): YouthIntake {
  const prestige = state.selectedTeam?.prestigio ?? 60
  const qualityRoll = Math.max(1, Math.min(100, Math.round(prestige * 0.7 + Math.random() * 30)))
  const count = category === "sub17" ? 5 : 4

  const crus = generateYouthBatch(state.season, count, prestige).map((player) => {
    // Clube grande atrai um pouco melhor, mas nem o maior deles acha pronto.
    const teto = 44 + Math.round((prestige - 50) * 0.12)          // ~44-50
    const overall = Math.max(34, Math.min(teto, 34 + Math.floor(Math.random() * (teto - 33))))
    const sorte = Math.random()
    // A maioria e formacao modesta, mas ha JOIA RARA (3%) e promissores (12%),
    // como o proprio comentario do topo e a UI ("joias >=85 sao raras") prometem.
    // Antes o teto era 73 fixo: a joia nunca aparecia e `rareGem` (>=88) era
    // sempre nulo. A raridade (3%) preserva o anti-abuso de rerolar a peneira.
    // Variedade REAL (pedido): joia rara, alguns promissores, muitos medianos e
    // uma boa parte que simplesmente NÃO vinga. Peneira é loteria — na maioria das
    // vezes vem molecada fraca, e o valor está na chance da exceção.
    const potencial = sorte < 0.03
      ? 82 + Math.floor(Math.random() * 11)                       // 82-92: joia rara (3%)
      : sorte < 0.15
      ? 74 + Math.floor(Math.random() * 10)                       // 74-83: promissor (12%)
      : sorte < 0.55
      ? 56 + Math.floor(Math.random() * 16)                       // 56-71: mediano (40%)
      : 42 + Math.floor(Math.random() * 13)                       // 42-54: fraco, não vinga (45%)
    const escala = overall / Math.max(1, player.overall)
    const cru = (v: number | undefined) => Math.max(25, Math.round((v ?? overall) * escala))
    return {
      ...player,
      overall,
      potential: Math.max(overall + 5, potencial),
      // Valor coerente com valorDeMercadoJovem (habilidade atual + prêmio modesto
      // de promessa). Antes potencial*45k inflava o prospecto cru a milhões.
      value: Math.round((overall * 6_000 + Math.max(0, potencial - overall) * 20_000) / 10_000) * 10_000,
      pace: cru(player.pace), shooting: cru(player.shooting), passing: cru(player.passing),
      dribbling: cru(player.dribbling), defending: cru(player.defending), physical: cru(player.physical),
    }
  })

  const players = crus.map((player, index): YouthPlayer => ({
    ...player,
    id: `youth_${category}_${state.season}_${Date.now()}_${index}`,
    age: category === "sub17" ? 15 + Math.floor(Math.random() * 3) : 17 + Math.floor(Math.random() * 4),
    category,
    personality: PERSONALITIES[Math.floor(Math.random() * PERSONALITIES.length)],
    potentialMin: Math.max(player.overall, player.potential - 8),
    potentialMax: player.potential,
    hiddenAttributes: true,
    monthsInAcademy: 0,
    promoted: false,
  }))
  return {
    season: state.season,
    qualityRoll,
    players,
    rareGem: players.find(player => player.potentialMax >= 88),
  }
}

/** Promove jovem ao elenco principal. */
export function promoteYouth(state: GameState, playerId: string): GameState {
  const player = (state.youthPlayers ?? []).find(item => item.id === playerId)
  if (!player) return state
  return {
    ...state,
    updatedAt: Date.now(),
    youthPlayers: (state.youthPlayers ?? []).filter(item => item.id !== playerId),
    squadPlayers: [...(state.squadPlayers ?? []), { ...player, fromTeam: "Categoria de Base", seasonSigned: state.season }],
  }
}

/** Empresta jovem para outro clube (ganho de minutos). */
export function loanYouth(state: GameState, playerId: string, toClub: string): GameState {
  return {
    ...state,
    updatedAt: Date.now(),
    youthPlayers: (state.youthPlayers ?? []).map(player => player.id === playerId
      ? { ...player, fromTeam: `Emprestado ao ${toClub}` }
      : player),
  }
}

/** Quantas semanas de trabalho cabem no botão "Evoluir um mês". */
export const SEMANAS_NO_MES = 4

/**
 * UM MÊS DE BASE = QUATRO SEMANAS DA MESMA REGRA.
 *
 * ⚠️ RELATO DE JOGADOR (13/08/2026): "acompanhar uma semana está funcionando
 * mais que evoluir um mês". Estava certo, e a causa era grave — existiam DUAS
 * fórmulas para a mesma coisa:
 *
 *   - `evoluirSemana` (youth-academy-rules): chance
 *     `min(0,5; 0,10 + margem × 0,012) × fator`, com o fator indo de 0,75 a 1,75
 *     conforme o nível da academia. Ou seja, leva em conta quanto o garoto ainda
 *     tem para crescer E quanto o clube investiu na base.
 *   - o mês, aqui: `Math.random() > 0.35`. Chance fixa, UMA vez no mês inteiro,
 *     cega para a academia e para a margem.
 *
 * Com academia nível 3 e um garoto de margem 20, UMA semana valia 42,5% contra
 * os 35% do mês inteiro; quatro semanas rendiam ~1,7 evoluções contra no máximo
 * uma. Investir na academia não mexia no botão do mês, e quem clicava em
 * "Evoluir um mês" era punido por escolher a opção que parece a maior.
 *
 * O conserto não é calibrar a constante: é **apagar a segunda fórmula**. O mês
 * roda quatro vezes a semana, então "um mês nunca rende menos que uma semana"
 * deixa de ser algo a torcer e passa a ser consequência da estrutura — ver
 * `scripts/test-base-semana-vs-mes.ts`.
 */
export function advanceYouthMonth(
  state: GameState,
  nivelAcademia = 1,
  rng: () => number = Math.random,
): { state: GameState; report: YouthMonthlyReport } {
  const antes = new Map((state.youthPlayers ?? []).map(p => [p.id, p.overall]))

  let jovens = (state.youthPlayers ?? []) as unknown as JovemBase[]
  for (let semana = 0; semana < SEMANAS_NO_MES; semana++) {
    jovens = evoluirSemana(jovens, nivelAcademia, rng).jovens
  }

  const highlights: YouthMonthlyReport["highlights"] = []
  const youthPlayers = (jovens as unknown as SquadPlayer[]).map(player => {
    const ganho = player.overall - (antes.get(player.id) ?? player.overall)
    if (ganho <= 0) return player
    highlights.push({
      playerId: player.id,
      reason: `Evoluiu ${ganho} ponto(s) no mês de trabalho na base.`,
    })
    return { ...player, trend: "up" as const }
  })
  const nextState = { ...state, youthPlayers, updatedAt: Date.now() }
  return {
    state: nextState,
    report: {
      season: state.season,
      month: Math.floor((state.week ?? 0) / 4) + 1,
      totalPlayers: youthPlayers.length,
      promotions: 0,
      releases: 0,
      highlights,
    },
  }
}

// ─── MVP funcional: prospectos da base ─────────────────────────────────────────
// 4 jovens gerados por temporada, idade 16-19, base 55-72 com potencial alto.
// Usuario pode promover ao elenco profissional pagando taxa de R$200k.

const YOUTH_FIRST_NAMES = [
  "Lucas","João","Pedro","Gabriel","Rafael","Diego","Mateus","Thiago","Felipe","Vinicius",
  "André","Bruno","Carlos","Daniel","Eduardo","Fábio","Gustavo","Henrique","Ítalo","Júlio",
  "Kauã","Léo","Marcos","Nathan","Otávio","Paulo","Rodrigo","Samuel","Tiago","Vitor",
]
const YOUTH_LAST_NAMES = [
  "Silva","Santos","Oliveira","Souza","Lima","Pereira","Costa","Almeida","Nascimento","Rodrigues",
  "Ribeiro","Carvalho","Gomes","Martins","Araujo","Barbosa","Cardoso","Rocha","Dias","Mendes",
]
const YOUTH_POSITIONS: Array<"GOL" | "ZAG" | "VOL" | "MEI" | "ATA"> = ["GOL","ZAG","ZAG","VOL","MEI","MEI","ATA","ATA"]
const PERSONALITIES: Personality[] = ["lider", "ambicioso", "calmo", "profissional", "leal", "estrela", "polemico", "preguicoso", "mercenario"]

/**
 * Nome do prospecto.
 *
 * ⚠️ As duas listas acima são BRASILEIRAS e MASCULINAS — é exatamente o defeito
 * que `lib/nomes-por-pais` foi escrito para corrigir ("a base do Ajax revelava
 * Matheus Nascimento"). Elas ficam como fallback dos chamadores que não
 * informam país; quem informa recebe nome do país certo, e a carreira feminina
 * recebe nome feminino.
 */
function randomYouthName(pais?: string, feminino?: boolean): string {
  if (pais) {
    return feminino
      ? nomeDeAtletaFeminina(pais, Math.random)
      : nomeDeAtleta(pais, Math.random)
  }
  const f = YOUTH_FIRST_NAMES[Math.floor(Math.random() * YOUTH_FIRST_NAMES.length)]
  const l = YOUTH_LAST_NAMES[Math.floor(Math.random() * YOUTH_LAST_NAMES.length)]
  return `${f} ${l}`
}

/** Gera 4 jovens prospectos da base para a temporada. */
export function generateYouthBatch(
  season: number,
  count = 4,
  prestige = 70,
  origem?: { pais?: string; feminino?: boolean },
): SquadPlayer[] {
  const result: SquadPlayer[] = []
  for (let i = 0; i < count; i++) {
    const age = 16 + Math.floor(Math.random() * 4) // 16-19
    const baseOverall = 50 + Math.floor(Math.random() * 23) + Math.floor(prestige * 0.05) // 55-72 ajustado por prestigio
    const overall = Math.min(75, baseOverall)
    const potentialBonus = 6 + Math.floor(Math.random() * 14) // +6..+19
    // Teto 73: a base inteira e limitada (pedido). Nenhum garoto da base nasce
    // com potencial de estrela.
    const potential = Math.min(73, overall + potentialBonus)
    const pos = YOUTH_POSITIONS[Math.floor(Math.random() * YOUTH_POSITIONS.length)]
    result.push({
      id: `youth_${season}_${i}_${Math.random().toString(36).slice(2, 6)}`,
      name: randomYouthName(origem?.pais, origem?.feminino),
      position: pos,
      age,
      overall,
      potential,
      value: 200000,  // taxa de promoção fixa
      pace: Math.max(40, Math.min(99, overall + Math.floor(Math.random() * 8) - 4)),
      shooting: Math.max(40, Math.min(99, overall + Math.floor(Math.random() * 8) - 4)),
      passing: Math.max(40, Math.min(99, overall + Math.floor(Math.random() * 8) - 4)),
      dribbling: Math.max(40, Math.min(99, overall + Math.floor(Math.random() * 8) - 4)),
      defending: Math.max(40, Math.min(99, overall + Math.floor(Math.random() * 8) - 4)),
      physical: Math.max(40, Math.min(99, overall + Math.floor(Math.random() * 8) - 4)),
      fromTeam: "Categoria de Base",
      trend: 'up',
      seasonSigned: season,
    })
  }
  return result
}

/** Identifica joias (potencial >=85) entre os prospectos. */
export function findYouthGems(youth: SquadPlayer[]): SquadPlayer[] {
  return youth.filter(p => p.potential >= 85)
}
