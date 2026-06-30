// League logos — arquivos locais em /public/ligas/ (PNG com fundo transparente)
// 01=Brasileirao, 02=Copa Brasil, 03=Libertadores, 04=Sudamericana,
// 07=La Liga, 08=Bundesliga, 09=Serie A Italia, 10=Ligue 1
export const leagueLogos: Record<string, string | null> = {
  // Brazilian
  "brasileirao":        "/ligas/01.png",
  "brasileirao-serie-a":"/ligas/01.png",
  "serie-a-brasil":     "/ligas/01.png",
  "serie_a":            "/ligas/01.png",
  "serie_b":            "/ligas/01.png",
  "serie_c":            "/ligas/01.png",
  "serie_d":            "/ligas/01.png",
  "copa-do-brasil":     "/ligas/02.png",
  "copa_brasil":        "/ligas/02.png",

  // Estaduais
  "campeonato-carioca": "/ligas/14.png",
  "carioca":            "/ligas/14.png",

  // South American
  "libertadores":           "/ligas/03.png",
  "conmebol-libertadores":  "/ligas/03.png",
  "sudamericana":           "/ligas/04.png",
  "sul-americana":          "/ligas/04.png",
  "conmebol-sudamericana":  "/ligas/04.png",
  "conmebol-sul-americana": "/ligas/04.png",

  // European
  "premier-league":  "/ligas/11.png",
  "premier_league":  "/ligas/11.png",
  "bundesliga":      "/ligas/12.png",
  "la-liga":         "/ligas/07.png",
  "la_liga":         "/ligas/07.png",
  "laliga":          "/ligas/07.png",
  "ligue-1":         "/ligas/10.png",
  "ligue_1":         "/ligas/10.png",
  "serie-a":         "/ligas/09.png",
  "serie-a-italia":  "/ligas/09.png",
  "serie_a_ita":     "/ligas/09.png",
  "primeira_liga":   null,

  // Americas
  "mls":     null,
  "liga_mx": null,

  // Middle East
  "saudi_pro": null,

  // UEFA
  "champions-league":      null,
  "uefa-champions-league": null,
}

export function getLeagueLogo(leagueName: string): string | null {
  const direct = leagueLogos[leagueName]
  if (direct) return direct

  const normalized = leagueName
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, "-")

  return leagueLogos[normalized] || null
}

export const leagueNames: Record<string, string> = {
  "brasileirao":        "Brasileirao Serie A",
  "brasileirao-serie-a":"Brasileirao Serie A",
  "copa-do-brasil":     "Copa do Brasil",
  "libertadores":       "CONMEBOL Libertadores",
  "sudamericana":       "CONMEBOL Sudamericana",
  "premier-league":     "Premier League",
  "bundesliga":         "Bundesliga",
  "la-liga":            "LaLiga",
  "ligue-1":            "Ligue 1",
  "serie-a":            "Serie A",
  "champions-league":   "UEFA Champions League",
}
