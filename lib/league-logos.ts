// League logos — arquivos locais em /public/ligas/ (PNG com fundo transparente)
// 01=Brasileirao, 02=Copa Brasil, 03=Libertadores, 04=Sudamericana,
// 07=La Liga, 08=Bundesliga, 09=Serie A Italia, 10=Ligue 1
export const leagueLogos: Record<string, string> = {
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

  // South American
  "libertadores":           "/ligas/03.png",
  "conmebol-libertadores":  "/ligas/03.png",
  "sudamericana":           "/ligas/04.png",
  "conmebol-sudamericana":  "/ligas/04.png",

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
  "primeira_liga":   "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/liga-portugal-EgT08h6vf8TqrS3MnxFYzPCDCLu6C2.png",

  // Americas
  "mls":     "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/mls-logo-Rg0vK2F3HqN5T7UxPLmYvJcWdMsBXe.png",
  "liga_mx": "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/liga-mx-8fKjL2mN4vQwX3PzRsTyUbVcDeFgHi.png",

  // Middle East
  "saudi_pro": "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/saudi-pro-league-Jk9LmN2oP3qR4sT5uV6wX7yZ8aB9cD.png",

  // UEFA
  "champions-league":      "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/image-Yq0zlmo1G4rVUkxnlnx65NXttT7ohS.png",
  "uefa-champions-league": "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/image-Yq0zlmo1G4rVUkxnlnx65NXttT7ohS.png",
}

export function getLeagueLogo(leagueName: string): string | null {
  if (leagueLogos[leagueName]) return leagueLogos[leagueName]

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
