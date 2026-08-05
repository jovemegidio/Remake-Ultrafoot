// A DIRETORIA AGE QUANDO O TECNICO NAO AGE.
//
// Medido na auditoria da 3.0: um clube cujo tecnico nao renova nada perde 100%
// do elenco em 6 temporadas — o Flamengo saiu de overall medio 74 para 42, com
// os 18 atletas finais sendo emergenciais de valor zero. A causa nao era bug: o
// jogo simplesmente nao tinha ninguem cuidando do clube alem do jogador.
//
// Este modulo e a contraparte: quando um contrato chega ao fim e o atleta ainda
// interessa, a diretoria renova por conta propria e AVISA. Nao e piloto
// automatico — e a diferenca entre um clube e uma planilha que esvazia.
//
// ⚠️ E FALLBACK, NAO GESTAO COMPLETA. So age no ULTIMO momento (o contrato
// venceria nesta virada de semana) e so sobre quem o clube quer manter. Quem o
// tecnico listou para sair, quem esta velho demais ou quem o clube nao pode
// pagar continua saindo — senao o elenco nunca renovaria de verdade e o mercado
// perderia a graca.
//
// O modulo e PURO: recebe o retrato do elenco e devolve decisoes. Quem chama
// aplica (e cobra a folha).

/** Anos de vinculo que a diretoria oferece numa renovacao de emergencia. */
export const ANOS_DA_RENOVACAO = 2
/** Reajuste salarial da renovacao automatica. */
export const REAJUSTE_DA_RENOVACAO = 1.08
/** Acima desta idade a diretoria deixa ir, por melhor que seja. */
export const IDADE_LIMITE = 34
/** Ate esta idade o atleta e promessa e se renova mesmo abaixo da media. */
export const IDADE_DE_PROMESSA = 23

export interface AtletaParaRenovar {
  readonly id: number
  readonly name: string
  readonly overall: number
  readonly age: number
  readonly salarioSemanal: number
  /** Semana absoluta em que o vinculo termina. */
  readonly fimDoContrato: number
  /** O tecnico colocou na lista de dispensa/venda? Entao a diretoria nao interfere. */
  readonly listadoParaSair?: boolean
}

export interface RenovacaoDecidida {
  id: number
  name: string
  /** Novo fim do vinculo, em semana absoluta. */
  novoFim: number
  /** Novo salario semanal (ja reajustado). */
  novoSalario: number
  motivo: "titular" | "promessa"
}

export interface ContextoDaDiretoria {
  /** Semana absoluta de agora. */
  agora: number
  /** Quanto o clube tem em caixa. Diretoria quebrada nao renova ninguem. */
  caixa: number
  /** Teto de folha semanal que a diretoria aceita atingir (0 = sem teto). */
  tetoDeFolha?: number
  /** Folha semanal atual. */
  folhaAtual: number
}

/**
 * Quem a diretoria renova nesta virada de semana.
 *
 * Devolve lista VAZIA no caso normal (ninguem vencendo agora) — a funcao e
 * chamada toda semana e precisa ser barata.
 */
export function decidirRenovacoes(
  elenco: readonly AtletaParaRenovar[],
  ctx: ContextoDaDiretoria,
): RenovacaoDecidida[] {
  // Só entra quem venceria AGORA. `<= agora` é o mesmo critério que o motor usa
  // para expulsar do elenco; renovar antes disso seria a diretoria passando por
  // cima do técnico numa decisão que ainda é dele.
  const vencendo = elenco.filter(a => !a.listadoParaSair && a.fimDoContrato <= ctx.agora && a.age < IDADE_LIMITE)
  if (!vencendo.length) return []
  if (ctx.caixa <= 0) return []

  // A régua é o próprio elenco: renovar quem está na média para cima. Um clube
  // de Série D não deve exigir overall de Série A para manter seus titulares.
  const overalls = [...elenco.map(a => a.overall)].sort((x, y) => x - y)
  const mediana = overalls.length ? overalls[Math.floor(overalls.length / 2)] : 0

  const decisoes: RenovacaoDecidida[] = []
  let folhaProjetada = ctx.folhaAtual

  // Melhor primeiro: se o teto de folha apertar, o clube segura quem importa mais.
  for (const a of [...vencendo].sort((x, y) => y.overall - x.overall)) {
    const ehTitular = a.overall >= mediana
    const ehPromessa = a.age <= IDADE_DE_PROMESSA
    if (!ehTitular && !ehPromessa) continue

    const novoSalario = Math.round(a.salarioSemanal * REAJUSTE_DA_RENOVACAO)
    const acrescimo = novoSalario - a.salarioSemanal
    if (ctx.tetoDeFolha && folhaProjetada + acrescimo > ctx.tetoDeFolha) continue

    folhaProjetada += acrescimo
    decisoes.push({
      id: a.id,
      name: a.name,
      novoFim: ctx.agora + 52 * ANOS_DA_RENOVACAO,
      novoSalario,
      motivo: ehTitular ? "titular" : "promessa",
    })
  }
  return decisoes
}
