// Fundo da tela de pre-jogo conforme o CLUBE MANDANTE ou a competicao disputada.
//
// A tela usava sempre stadium-night.png. Agora cada competicao tem o seu fundo
// (public/images/pre-jogo/*), com fallback para o estadio generico quando nao houver
// arte — sem inventar.

// Três fundos empacotados para não repetir o mesmo estádio em toda a carreira.
// A seleção é estável por competição/ligas: não há piscada ao voltar para a tela.
const DEFAULT_BACKGROUNDS = [
  "/images/pre-jogo/in-game-1.png",
  "/images/pre-jogo/in-game-4.png",
  "/images/pre-jogo/in-game-5.png",
]

import stadiumManifest from "@/public/stadiums/manifest.json"

const STADIUMS = stadiumManifest as Record<string, string>

/** Mesma normalizacao usada pelo importador de fotos em scripts/import-stadiums.mjs. */
export function stadiumTeamKey(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("en-US")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
}

/** Retorna a foto empacotada pelo nome do estadio e, como fallback, pelo clube. */
export function getTeamStadiumBackground(
  teamName: string | undefined | null,
  stadiumName?: string | undefined | null,
): string | null {
  if (!teamName && !stadiumName) return null
  const keys = [stadiumName, teamName].filter((value): value is string => Boolean(value)).map(stadiumTeamKey)
  // Alguns bancos usam "FC Barcelona" e o acervo usa "Barcelona" (ou vice-versa).
  // Aceita apenas prefixos/sufixos institucionais, sem busca aproximada que poderia
  // associar dois clubes diferentes da mesma cidade.
  const candidates = keys.flatMap(key => [
    key,
    key.replace(/^(fc|ac|afc|sc|ca|cd) /, ""),
    key.replace(/ (fc|afc|sc|cf|ac|fk)$/, ""),
    key.replace(/^arena (do |da |de )?/, ""),
  ])
  for (const candidate of candidates) {
    if (STADIUMS[candidate]) return STADIUMS[candidate]
  }
  return null
}

function defaultBackground(seed: string): string {
  const value = [...seed].reduce((total, char) => total + char.charCodeAt(0), 0)
  return DEFAULT_BACKGROUNDS[value % DEFAULT_BACKGROUNDS.length]
}

// Por nome de competicao (o que matchInfo.competition traz).
const BY_COMPETITION: Record<string, string> = {
  "campeonato paulista": "/images/pre-jogo/paulistao.png",
  "paulistao": "/images/pre-jogo/paulistao.png",
  "paulistão": "/images/pre-jogo/paulistao.png",
  "brasileirao serie a": "/images/pre-jogo/brasileirao.png",
  "brasileirão série a": "/images/pre-jogo/brasileirao.png",
  "copa do brasil": "/images/pre-jogo/copa-do-brasil.png",
  "libertadores": "/images/pre-jogo/libertadores.png",
  "copa libertadores": "/images/pre-jogo/libertadores.png",
  "uefa champions league": "/images/pre-jogo/champions.png",
  "champions league": "/images/pre-jogo/champions.png",
  "uefa europa league": "/images/pre-jogo/europa-league.png",
  "europa league": "/images/pre-jogo/europa-league.png",
  // Estaduais brasileiros (arte nova).
  "campeonato mineiro": "/images/pre-jogo/mineiro.png",
  "mineiro": "/images/pre-jogo/mineiro.png",
  "campeonato baiano": "/images/pre-jogo/baiano.png",
  "baiano": "/images/pre-jogo/baiano.png",
  "campeonato carioca": "/images/pre-jogo/carioca.png",
  "carioca": "/images/pre-jogo/carioca.png",
  // Portugal (Liga Portugal / Liga NOS).
  "liga portugal": "/images/pre-jogo/liga-portugal.png",
  "primeira liga": "/images/pre-jogo/liga-portugal.png",
  "liga nos": "/images/pre-jogo/liga-portugal.png",
}

// Por divisao/liga (o que `league` traz, ex.: "serie_a", "la_liga").
const BY_LEAGUE: Record<string, string> = {
  serie_a: "/images/pre-jogo/brasileirao.png",
  premier_league: "/images/pre-jogo/premier-league.png",
  la_liga: "/images/pre-jogo/la-liga.png",
  bundesliga: "/images/pre-jogo/bundesliga.png",
  serie_a_ita: "/images/pre-jogo/serie-a-ita.png",
  serie_b_ita: "/images/pre-jogo/serie-a-ita.png",
  primeira_liga: "/images/pre-jogo/liga-portugal.png",
}

/**
 * @param competition Nome da competicao da partida (matchInfo.competition).
 * @param league Divisao/liga do time (fallback quando a competicao nao casa).
 */
export function getPreMatchBackground(
  competition: string | undefined | null,
  league: string | undefined | null,
  homeTeamName?: string | undefined | null,
  homeStadiumName?: string | undefined | null,
): string {
  const stadium = getTeamStadiumBackground(homeTeamName, homeStadiumName)
  if (stadium) return stadium
  if (competition) {
    const hit = BY_COMPETITION[competition.trim().toLowerCase()]
    if (hit) return hit
  }
  if (league) {
    const hit = BY_LEAGUE[league]
    if (hit) return hit
  }
  return defaultBackground(`${competition ?? ""}:${league ?? ""}`)
}
