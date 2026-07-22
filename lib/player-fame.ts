// FAMA de um atleta: define quanto dele o clube já sabe sem precisar observar.
//
// Pedido de jogador: "conseguir ver o overall dependendo da fama — um Mbappé ou
// um Yamal, por serem famosos, você já conhece; e também quem vem se destacando
// no clube".
//
// Antes, TODO atleta exigia olheiro para revelar os números, o que é irreal: o
// mundo inteiro sabe o nível de um craque. Aqui a fama decide o que já vem
// aberto, e o olheiro passa a servir para o que realmente é desconhecido.

export type NivelFama = "mundial" | "conhecido" | "regional" | "desconhecido"

export interface FamaInfo {
  nivel: NivelFama
  /** Overall exato visível sem observação. */
  revelaOverall: boolean
  /** Atributos exatos visíveis (só para os muito famosos). */
  revelaAtributos: boolean
  rotulo: string
}

export interface EntradaFama {
  overall: number
  age: number
  /** Reputação editada manualmente (editor), quando houver. */
  reputation?: "normal" | "estrela" | "top_mundial"
  /** Prestígio do clube atual (0-100) — jogar em clube grande dá visibilidade. */
  clubPrestige?: number
  /** Gols na temporada: quem se destaca vira notícia mesmo em clube pequeno. */
  seasonGoals?: number
}

/**
 * Regras, em ordem de força:
 *  1. Reputação definida à mão vence tudo (o editor é a fonte de verdade).
 *  2. Craque é craque: overall alto é conhecido mesmo em clube médio.
 *  3. Clube grande dá vitrine — bom jogador em clube de elite é conhecido.
 *  4. Artilheiro em evidência fura a bolha do clube pequeno.
 */
export function calcularFama(e: EntradaFama): FamaInfo {
  const prest = e.clubPrestige ?? 50
  const gols = e.seasonGoals ?? 0

  if (e.reputation === "top_mundial") {
    return { nivel: "mundial", revelaOverall: true, revelaAtributos: true, rotulo: "Estrela mundial" }
  }
  if (e.reputation === "estrela") {
    return { nivel: "conhecido", revelaOverall: true, revelaAtributos: false, rotulo: "Jogador conhecido" }
  }

  // Craque absoluto: nao ha como o mercado nao saber quem e.
  if (e.overall >= 85) {
    return { nivel: "mundial", revelaOverall: true, revelaAtributos: true, rotulo: "Estrela mundial" }
  }
  // Muito bom, ou bom em clube de elite: nome conhecido.
  if (e.overall >= 78 || (e.overall >= 73 && prest >= 80)) {
    return { nivel: "conhecido", revelaOverall: true, revelaAtributos: false, rotulo: "Jogador conhecido" }
  }
  // Artilheiro em evidencia: o desempenho o tirou do anonimato nesta temporada.
  if (gols >= 8) {
    return { nivel: "conhecido", revelaOverall: true, revelaAtributos: false, rotulo: "Em destaque na temporada" }
  }
  // Conhecido na região: dá para estimar, mas o número exato exige olheiro.
  if (e.overall >= 68 || prest >= 70) {
    return { nivel: "regional", revelaOverall: false, revelaAtributos: false, rotulo: "Conhecido na região" }
  }
  return { nivel: "desconhecido", revelaOverall: false, revelaAtributos: false, rotulo: "Desconhecido" }
}

/**
 * O que mostrar no lugar do overall quando a fama não o revela: uma FAIXA, não
 * um "?" seco — o clube consegue estimar o nível de qualquer profissional, só
 * não com precisão. Quanto menos famoso, mais larga a faixa.
 */
export function faixaDeOverall(overall: number, fama: FamaInfo): string {
  if (fama.revelaOverall) return String(overall)
  const margem = fama.nivel === "regional" ? 3 : 6
  return `${Math.max(40, overall - margem)}-${Math.min(99, overall + margem)}`
}
