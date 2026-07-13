// Resolve a logo de uma competicao a partir do nome usado no jogo.
// As artes ficam em public/competicoes/<slug>.png (ver scripts/copy-competition-logos.mjs).
//
// Retorna null quando NAO existe logo para aquela competicao — a UI entao mostra o
// icone generico. Nao inventamos fallback de outra competicao: logo errada e pior
// que logo nenhuma.

const SLUGS: Record<string, string> = {
  // Nacionais
  "brasileirao serie a": "brasileirao-serie-a",
  "brasileirao série a": "brasileirao-serie-a",
  "brasileirão série a": "brasileirao-serie-a",
  "serie a": "brasileirao-serie-a",
  "brasileirao serie b": "brasileirao-serie-b",
  "brasileirão série b": "brasileirao-serie-b",
  "serie b": "brasileirao-serie-b",
  "brasileirao serie c": "brasileirao-serie-c",
  "brasileirão série c": "brasileirao-serie-c",
  "brasileirao serie d": "brasileirao-serie-d",
  "brasileirão série d": "brasileirao-serie-d",
  "copa do brasil": "copa-do-brasil",
  // Continentais / mundiais
  "libertadores": "libertadores",
  "copa libertadores": "libertadores",
  "mundial de clubes": "mundial-de-clubes",
  "super mundial de clubes": "mundial-de-clubes",
  // Estaduais
  "campeonato paulista": "campeonato-paulista",
  "paulistao": "campeonato-paulista",
  "paulistão": "campeonato-paulista",
  "campeonato carioca": "campeonato-carioca",
  "carioca": "campeonato-carioca",
  "campeonato mineiro": "campeonato-mineiro",
  "mineiro": "campeonato-mineiro",
  "campeonato baiano": "campeonato-baiano",
  "campeonato cearense": "campeonato-cearense",
  "campeonato alagoano": "campeonato-alagoano",
  "campeonato catarinense": "campeonato-catarinense",
  "campeonato brasiliense": "campeonato-brasiliense",
  "campeonato capixaba": "campeonato-capixaba",
  "campeonato mato-grossense": "campeonato-mato-grossense",
  "campeonato potiguar": "campeonato-potiguar",
  "campeonato maranhense": "campeonato-maranhense",
  "campeonato amapaense": "campeonato-amapaense",
}

/**
 * @param competition Nome da competicao como o jogo a chama.
 * @returns Caminho da logo, ou null se nao houver arte para ela.
 */
export function getCompetitionLogo(competition: string | undefined | null): string | null {
  if (!competition) return null
  const key = competition.trim().toLowerCase()
  const slug = SLUGS[key]
  return slug ? `/competicoes/${slug}.png` : null
}
