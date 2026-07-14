// Fundo da tela de pre-jogo conforme a COMPETICAO disputada.
//
// A tela usava sempre stadium-night.png. Agora cada competicao tem o seu fundo
// (public/images/pre-jogo/*), com fallback para o estadio generico quando nao houver
// arte — sem inventar.

const DEFAULT_BG = "/images/stadium-night.png"

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
}

// Por divisao/liga (o que `league` traz, ex.: "serie_a", "la_liga").
const BY_LEAGUE: Record<string, string> = {
  serie_a: "/images/pre-jogo/brasileirao.png",
  premier_league: "/images/pre-jogo/premier-league.png",
  la_liga: "/images/pre-jogo/la-liga.png",
  bundesliga: "/images/pre-jogo/bundesliga.png",
  serie_a_ita: "/images/pre-jogo/serie-a-ita.png",
}

/**
 * @param competition Nome da competicao da partida (matchInfo.competition).
 * @param league Divisao/liga do time (fallback quando a competicao nao casa).
 */
export function getPreMatchBackground(
  competition: string | undefined | null,
  league: string | undefined | null,
): string {
  if (competition) {
    const hit = BY_COMPETITION[competition.trim().toLowerCase()]
    if (hit) return hit
  }
  if (league) {
    const hit = BY_LEAGUE[league]
    if (hit) return hit
  }
  return DEFAULT_BG
}
