// League logos mapping - all with transparent backgrounds
export const leagueLogos: Record<string, string> = {
  // Brazilian
  "brasileirao": "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/01-Vu94oSr6C2UzurfDfOiSN3cra5uZz0.png",
  "brasileirao-serie-a": "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/01-Vu94oSr6C2UzurfDfOiSN3cra5uZz0.png",
  "serie-a-brasil": "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/01-Vu94oSr6C2UzurfDfOiSN3cra5uZz0.png",
  "serie_a": "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/01-Vu94oSr6C2UzurfDfOiSN3cra5uZz0.png",
  "serie_b": "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/01-Vu94oSr6C2UzurfDfOiSN3cra5uZz0.png",
  "serie_c": "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/01-Vu94oSr6C2UzurfDfOiSN3cra5uZz0.png",
  "serie_d": "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/01-Vu94oSr6C2UzurfDfOiSN3cra5uZz0.png",
  "copa-do-brasil": "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/02-9EIJFi4rHs3c1iO7w5e6hmMkcdDFb1.png",
  
  // South American
  "libertadores": "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/03-rhwEcASPR7G8HSmPVmD7hxp2mJUl3I.png",
  "conmebol-libertadores": "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/03-rhwEcASPR7G8HSmPVmD7hxp2mJUl3I.png",
  "sudamericana": "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/04-dykHmCdzdLPc8fiPQbRGvhey5tCPsF.png",
  "conmebol-sudamericana": "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/04-dykHmCdzdLPc8fiPQbRGvhey5tCPsF.png",
  
  // European
  "premier-league": "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/image-Fzxp3udEZnT3wDxSYsM5MYbJKFILs6.png",
  "premier_league": "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/image-Fzxp3udEZnT3wDxSYsM5MYbJKFILs6.png",
  "bundesliga": "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/image-Y0jlWSOAmCfiCnjK7tMzWiAIRyxyFx.png",
  "la-liga": "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/07-w22h7vvpjDELY2EvcTiGnt4Fsj1hvN.png",
  "la_liga": "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/07-w22h7vvpjDELY2EvcTiGnt4Fsj1hvN.png",
  "laliga": "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/07-w22h7vvpjDELY2EvcTiGnt4Fsj1hvN.png",
  "ligue-1": "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/10-SjMe7k4UXhdG6wVTEN1gpM6jinQoEE.png",
  "ligue_1": "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/10-SjMe7k4UXhdG6wVTEN1gpM6jinQoEE.png",
  "serie-a": "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/09-5oGN6iMb1TGGHqN50nOKl9Jagshm6A.png",
  "serie-a-italia": "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/09-5oGN6iMb1TGGHqN50nOKl9Jagshm6A.png",
  "serie_a_ita": "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/09-5oGN6iMb1TGGHqN50nOKl9Jagshm6A.png",
  "primeira_liga": "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/liga-portugal-EgT08h6vf8TqrS3MnxFYzPCDCLu6C2.png",
  
  // Americas
  "mls": "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/mls-logo-Rg0vK2F3HqN5T7UxPLmYvJcWdMsBXe.png",
  "liga_mx": "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/liga-mx-8fKjL2mN4vQwX3PzRsTyUbVcDeFgHi.png",
  
  // Middle East
  "saudi_pro": "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/saudi-pro-league-Jk9LmN2oP3qR4sT5uV6wX7yZ8aB9cD.png",
  
  // UEFA
  "champions-league": "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/image-Yq0zlmo1G4rVUkxnlnx65NXttT7ohS.png",
  "uefa-champions-league": "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/image-Yq0zlmo1G4rVUkxnlnx65NXttT7ohS.png",
}

export function getLeagueLogo(leagueName: string): string | null {
  // Primeiro tenta com a chave direta (para keys como serie_a, premier_league)
  if (leagueLogos[leagueName]) {
    return leagueLogos[leagueName]
  }
  
  // Depois tenta normalizado
  const normalized = leagueName
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "-")
  
  return leagueLogos[normalized] || null
}

export const leagueNames: Record<string, string> = {
  "brasileirao": "Brasileirao Serie A",
  "brasileirao-serie-a": "Brasileirao Serie A",
  "copa-do-brasil": "Copa do Brasil",
  "libertadores": "CONMEBOL Libertadores",
  "sudamericana": "CONMEBOL Sudamericana",
  "premier-league": "Premier League",
  "bundesliga": "Bundesliga",
  "la-liga": "LaLiga",
  "ligue-1": "Ligue 1",
  "serie-a": "Serie A",
  "champions-league": "UEFA Champions League",
}
