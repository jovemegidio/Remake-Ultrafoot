// Zonas de classificacao de uma tabela (titulo, continental, rebaixamento, etc.).
// Cada zona cobre um intervalo de posicoes e define cor e rotulo para destacar
// as linhas na tabela de classificacao.

export interface StandingZone {
  id: string
  label: string
  color: string
  /** Primeira posicao (inclusiva) coberta pela zona. */
  from: number
  /** Ultima posicao (inclusiva) coberta pela zona. */
  to: number
}

interface ZoneTemplate {
  id: string
  label: string
  color: string
  from: number
  /** Quantidade de posicoes a partir do topo (positivo) ou da base (negativo). */
  count: number
  /** Se true, conta a partir do final da tabela. */
  fromBottom?: boolean
}

// Cores alinhadas ao tema do app
const C = {
  title: "#ffd700",
  libertadores: "#00ffc8",
  preLib: "#22d3ee",
  sudamericana: "#3b82f6",
  promotion: "#00ffc8",
  playoff: "#f59e0b",
  relegation: "#ef4444",
}

// Templates por divisao. Posicoes calculadas com base no total de times.
const DIVISION_ZONES: Record<string, ZoneTemplate[]> = {
  serie_a: [
    { id: "libertadores", label: "Libertadores", color: C.libertadores, from: 1, count: 6 },
    { id: "pre-lib", label: "Pre-Libertadores", color: C.preLib, from: 7, count: 1 },
    { id: "sudamericana", label: "Sul-Americana", color: C.sudamericana, from: 8, count: 6 },
    { id: "relegation", label: "Rebaixamento", color: C.relegation, from: 0, count: 4, fromBottom: true },
  ],
  serie_b: [
    { id: "promotion", label: "Acesso", color: C.promotion, from: 1, count: 4 },
    { id: "relegation", label: "Rebaixamento", color: C.relegation, from: 0, count: 4, fromBottom: true },
  ],
  serie_c: [
    { id: "promotion", label: "Acesso", color: C.promotion, from: 1, count: 4 },
    { id: "relegation", label: "Rebaixamento", color: C.relegation, from: 0, count: 4, fromBottom: true },
  ],
  serie_d: [
    { id: "promotion", label: "Acesso", color: C.promotion, from: 1, count: 4 },
  ],
  // Primeiras divisoes europeias: 3 rebaixados (piramide viva).
  premier_league: [{ id: "relegation", label: "Rebaixamento", color: C.relegation, from: 0, count: 3, fromBottom: true }],
  la_liga:        [{ id: "relegation", label: "Rebaixamento", color: C.relegation, from: 0, count: 3, fromBottom: true }],
  serie_a_ita:    [{ id: "relegation", label: "Rebaixamento", color: C.relegation, from: 0, count: 3, fromBottom: true }],
  bundesliga:     [{ id: "relegation", label: "Rebaixamento", color: C.relegation, from: 0, count: 3, fromBottom: true }],
  ligue_1:        [{ id: "relegation", label: "Rebaixamento", color: C.relegation, from: 0, count: 3, fromBottom: true }],
  saudi_pro:      [{ id: "relegation", label: "Rebaixamento", color: C.relegation, from: 0, count: 3, fromBottom: true }],
  // Segundas divisoes: 3 sobem para a elite (sem rebaixamento no jogo — sao a base).
  championship:     [{ id: "promotion", label: "Acesso", color: C.promotion, from: 1, count: 3 }],
  la_liga_2:        [{ id: "promotion", label: "Acesso", color: C.promotion, from: 1, count: 3 }],
  serie_b_ita:      [{ id: "promotion", label: "Acesso", color: C.promotion, from: 1, count: 3 }],
  bundesliga_2:     [{ id: "promotion", label: "Acesso", color: C.promotion, from: 1, count: 3 }],
  ligue_2:          [{ id: "promotion", label: "Acesso", color: C.promotion, from: 1, count: 3 }],
  saudi_first_div:  [{ id: "promotion", label: "Acesso", color: C.promotion, from: 1, count: 3 }],
}

// Template generico para ligas internacionais e divisoes nao mapeadas.
const DEFAULT_ZONES: ZoneTemplate[] = [
  { id: "title", label: "Titulo / Champions", color: C.title, from: 1, count: 4 },
  { id: "continental", label: "Competicao Continental", color: C.sudamericana, from: 5, count: 2 },
  { id: "relegation", label: "Rebaixamento", color: C.relegation, from: 0, count: 3, fromBottom: true },
]

/**
 * Retorna as zonas de classificacao concretas para uma divisao,
 * resolvidas com base no numero total de times na tabela.
 */
export function getStandingZones(division: string, totalTeams: number): StandingZone[] {
  const templates = DIVISION_ZONES[division] ?? DEFAULT_ZONES
  const zones: StandingZone[] = []

  for (const tpl of templates) {
    let from: number
    let to: number
    if (tpl.fromBottom) {
      to = totalTeams
      from = Math.max(1, totalTeams - tpl.count + 1)
    } else {
      from = tpl.from
      to = Math.min(totalTeams, tpl.from + tpl.count - 1)
    }
    if (from > totalTeams || to < 1 || from > to) continue
    zones.push({ id: tpl.id, label: tpl.label, color: tpl.color, from, to })
  }

  return zones
}

/**
 * Retorna a zona que cobre uma determinada posicao, ou null se nenhuma.
 */
export function getStandingZone(position: number, zones: StandingZone[]): StandingZone | null {
  return zones.find(z => position >= z.from && position <= z.to) ?? null
}
