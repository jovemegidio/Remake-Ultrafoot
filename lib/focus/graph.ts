// GRAFO DE FOCO — geometria pura, sem DOM e sem React.
//
// Recebe retangulos, devolve "qual e o vizinho nesta direcao". Fica separado do
// FocusManager de proposito: assim da para testar a navegacao com numeros, sem
// montar uma tela.
//
// ── Por que a versao antiga errava ──────────────────────────────────────────
// O codigo que existia pontuava por `distancia + |desvio| * 2`. Isso quebra em
// dois casos que aparecem o tempo todo neste jogo:
//
// 1. Tabela de elenco. Da linha 3 coluna "Nome", apertar para baixo escolhia a
//    celula da linha 4 mais PROXIMA em linha reta — que muitas vezes e a da
//    coluna vizinha, porque as celulas de nome sao largas e o centro delas fica
//    longe. O foco descia na diagonal e a pessoa perdia a coluna.
//
// 2. Cards do painel. Um card alto ao lado de tres baixos: descendo pelos
//    baixos, o card alto vencia por estar "mais perto do centro", mesmo estando
//    visualmente ao lado.
//
// A regra que conserta os dois e SOBREPOSICAO ANTES DE DISTANCIA: um candidato
// que compartilha faixa horizontal com a origem esta na mesma coluna, e coluna
// vence proximidade. E o mesmo criterio que interface de TV usa.

export interface Retangulo {
  left: number
  top: number
  right: number
  bottom: number
}

export type Direcao = "up" | "down" | "left" | "right"

export interface Candidato<T> {
  item: T
  rect: Retangulo
}

function centro(r: Retangulo) {
  return { x: (r.left + r.right) / 2, y: (r.top + r.bottom) / 2 }
}

/** Quanto dois intervalos se sobrepoem, em pixels. Negativo = nao se tocam. */
function sobreposicao(aInicio: number, aFim: number, bInicio: number, bFim: number): number {
  return Math.min(aFim, bFim) - Math.max(aInicio, bInicio)
}

/**
 * Margem de tolerancia para considerar "adiante".
 *
 * 4 px, nao 0: elementos de uma mesma linha raramente estao alinhados ao pixel
 * (padding, borda, fonte). Com 0, metade da linha era considerada "abaixo" da
 * outra metade e o D-pad para baixo andava DENTRO da mesma linha.
 */
const TOLERANCIA = 4

export function vizinhoNaDirecao<T>(
  origem: Retangulo,
  candidatos: readonly Candidato<T>[],
  direcao: Direcao,
): T | null {
  const o = centro(origem)
  const vertical = direcao === "up" || direcao === "down"

  let melhor: T | null = null
  let melhorNota = Number.POSITIVE_INFINITY

  for (const { item, rect } of candidatos) {
    const c = centro(rect)

    // 1) Esta adiante na direcao pedida? Usamos a BORDA, nao o centro: um card
    //    muito alto tem o centro acima da origem mesmo comecando abaixo dela.
    const adiante =
      direcao === "up" ? rect.bottom <= origem.top + TOLERANCIA
        : direcao === "down" ? rect.top >= origem.bottom - TOLERANCIA
          : direcao === "left" ? rect.right <= origem.left + TOLERANCIA
            : rect.left >= origem.right - TOLERANCIA
    if (!adiante) continue

    // 2) Compartilha faixa com a origem? (a regra que conserta tabela e cards)
    const faixa = vertical
      ? sobreposicao(origem.left, origem.right, rect.left, rect.right)
      : sobreposicao(origem.top, origem.bottom, rect.top, rect.bottom)
    const alinhado = faixa > 0

    // 3) Distancia no eixo principal e desvio no transversal.
    const principal = vertical ? Math.abs(c.y - o.y) : Math.abs(c.x - o.x)
    const desvio = vertical ? Math.abs(c.x - o.x) : Math.abs(c.y - o.y)

    // Alinhado paga desvio barato (so para desempatar entre dois da mesma
    // coluna); desalinhado paga caro, e so ganha quando nao ha alinhado nenhum.
    // O somatorio grande (1e6) garante essa ordem sem precisar de duas passadas.
    const nota = principal + desvio * (alinhado ? 0.15 : 3) + (alinhado ? 0 : 1e6)

    if (nota < melhorNota) {
      melhorNota = nota
      melhor = item
    }
  }

  return melhor
}

/**
 * Ordem de leitura: de cima para baixo, da esquerda para a direita.
 *
 * E o que TAB_NEXT usa e o que decide quem recebe o foco quando uma tela abre
 * sem foco anterior. Baseado em LINHA, nao em `top` cru: dois botoes lado a
 * lado com 1 px de diferenca de altura tem de contar como a mesma linha, senao
 * a ordem serpenteia e parece aleatoria.
 */
export function ordemDeLeitura<T>(candidatos: readonly Candidato<T>[], alturaDaLinha = 24): T[] {
  return [...candidatos]
    .sort((a, b) => {
      const linhaA = Math.round(a.rect.top / alturaDaLinha)
      const linhaB = Math.round(b.rect.top / alturaDaLinha)
      if (linhaA !== linhaB) return linhaA - linhaB
      return a.rect.left - b.rect.left
    })
    .map(c => c.item)
}
