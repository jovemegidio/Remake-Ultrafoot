// Rankings da temporada (artilharia, assistências, cartões) a partir dos
// resultados que o motor JÁ grava.
//
// calcTopScorers/calcTopAssisters em table-engine devolviam [] com o comentário
// "requer dados que ainda não são rastreados". Mas cada MatchResult guarda
// `events` com o NOME do artilheiro/assistente/cartão — de todas as partidas
// simuladas, não só as do usuário. Então o dado sempre existiu; faltava agregar.

export interface MatchEventLite {
  type: "goal" | "assist" | "yellow" | "red" | "sub" | "injury"
  playerName: string
  assistPlayerName?: string
}
export interface MatchResultLite {
  season: number
  competition: string
  homeTeam: string
  awayTeam: string
  events?: MatchEventLite[]
}
export interface RankRow {
  nome: string
  time: string
  valor: number
}

// O evento NÃO carrega o time de quem marcou — só nome. Por isso a coluna "time"
// fica vazia na artilharia do campeonato; a contagem por NOME, que é o que
// importa, é exata. A tela de gerenciamento usa isto para o campeonato e, para o
// ELENCO, usa seasonStats (que tem o time do usuário).
function ranquear(
  results: readonly MatchResultLite[],
  season: number,
  nomeDoEvento: (e: MatchEventLite) => string | null,
): RankRow[] {
  const mapa = new Map<string, RankRow>()
  for (const r of results) {
    if (r.season !== season || !r.events) continue
    for (const e of r.events) {
      const nome = nomeDoEvento(e)
      if (!nome) continue
      const chave = nome.toLocaleLowerCase("pt-BR")
      const row = mapa.get(chave)
      if (row) row.valor++
      else mapa.set(chave, { nome, time: "", valor: 1 })
    }
  }
  return [...mapa.values()].sort((a, b) => b.valor - a.valor)
}

export function artilheiros(results: readonly MatchResultLite[], season: number, limite = 20): RankRow[] {
  return ranquear(results, season, e => (e.type === "goal" ? e.playerName : null)).slice(0, limite)
}

export function assistentes(results: readonly MatchResultLite[], season: number, limite = 20): RankRow[] {
  return ranquear(results, season, e =>
    e.type === "assist" ? e.playerName : e.type === "goal" && e.assistPlayerName ? e.assistPlayerName : null,
  ).slice(0, limite)
}

export function cartoes(results: readonly MatchResultLite[], season: number, limite = 20): RankRow[] {
  // Amarelo = 1, vermelho = 3: ordena "quem mais se compromete", não só contagem.
  const mapa = new Map<string, RankRow & { amarelos: number; vermelhos: number }>()
  for (const r of results) {
    if (r.season !== season || !r.events) continue
    for (const e of r.events) {
      if (e.type !== "yellow" && e.type !== "red") continue
      const chave = e.playerName.toLocaleLowerCase("pt-BR")
      const row = mapa.get(chave) ?? { nome: e.playerName, time: "", valor: 0, amarelos: 0, vermelhos: 0 }
      if (e.type === "yellow") row.amarelos++
      else row.vermelhos++
      row.valor = row.amarelos + row.vermelhos * 3
      mapa.set(chave, row)
    }
  }
  return [...mapa.values()].sort((a, b) => b.valor - a.valor).slice(0, limite)
}

