// Fundo da tela de pre-jogo conforme o CLUBE MANDANTE ou a competicao disputada.
//
// A tela usava sempre stadium-night.png. Agora cada competicao tem o seu fundo
// (public/images/pre-jogo/*), com fallback para o estadio generico quando nao houver
// arte — sem inventar.

// Três fundos empacotados para não repetir o mesmo estádio em toda a carreira.
// A seleção é estável por competição/ligas: não há piscada ao voltar para a tela.
const DEFAULT_BACKGROUNDS = [
  // Arte nova enviada pelo usuário (1.0.350), convertida de PNG para WebP:
  // 1,39 MB -> 65 KB, sem perda visível. Entra primeiro porque é a melhor do
  // conjunto; as três antigas continuam para não repetir o mesmo estádio em
  // toda a carreira.
  "/images/pre-jogo/in-game-02.webp",
  "/images/pre-jogo/in-game-1.webp",
  "/images/pre-jogo/in-game-4.webp",
  "/images/pre-jogo/in-game-5.webp",
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
  "campeonato paulista": "/images/pre-jogo/paulistao.webp",
  "paulistao": "/images/pre-jogo/paulistao.webp",
  "paulistão": "/images/pre-jogo/paulistao.webp",
  "brasileirao serie a": "/images/pre-jogo/brasileirao.webp",
  "brasileirão série a": "/images/pre-jogo/brasileirao.webp",
  "copa do brasil": "/images/pre-jogo/copa-do-brasil.webp",
  "libertadores": "/images/pre-jogo/libertadores.webp",
  "copa libertadores": "/images/pre-jogo/libertadores.webp",
  "uefa champions league": "/images/pre-jogo/champions.webp",
  "champions league": "/images/pre-jogo/champions.webp",
  "uefa europa league": "/images/pre-jogo/europa-league.webp",
  "europa league": "/images/pre-jogo/europa-league.webp",
  // Estaduais brasileiros (arte nova).
  "campeonato mineiro": "/images/pre-jogo/mineiro.webp",
  "mineiro": "/images/pre-jogo/mineiro.webp",
  "campeonato baiano": "/images/pre-jogo/baiano.webp",
  "baiano": "/images/pre-jogo/baiano.webp",
  "campeonato carioca": "/images/pre-jogo/carioca.webp",
  "carioca": "/images/pre-jogo/carioca.webp",
  // Portugal (Liga Portugal / Liga NOS).
  "liga portugal": "/images/pre-jogo/liga-portugal.webp",
  "primeira liga": "/images/pre-jogo/liga-portugal.webp",
  "liga nos": "/images/pre-jogo/liga-portugal.webp",
}

// Por divisao/liga (o que `league` traz, ex.: "serie_a", "la_liga").
const BY_LEAGUE: Record<string, string> = {
  serie_a: "/images/pre-jogo/brasileirao.webp",
  premier_league: "/images/pre-jogo/premier-league.webp",
  la_liga: "/images/pre-jogo/la-liga.webp",
  bundesliga: "/images/pre-jogo/bundesliga.webp",
  serie_a_ita: "/images/pre-jogo/serie-a-ita.webp",
  serie_b_ita: "/images/pre-jogo/serie-a-ita.webp",
  primeira_liga: "/images/pre-jogo/liga-portugal.webp",
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
