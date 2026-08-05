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

// ─── A DIRETORIA VAI AO MERCADO ──────────────────────────────────────────────
//
// Renovar não bastava. Medido em 10 temporadas passivas: com a renovação
// automática o elenco para de despencar, mas converge para EXATAMENTE 18 — o
// piso — em todos os clubes, porque ninguém repõe quem sai de vez. Um clube de
// verdade não joga a temporada com 18 atletas; ele contrata.
//
// Aqui é a contraparte da renovação: quando o elenco fica abaixo do plantel de
// trabalho, a diretoria busca reforço no setor mais escasso — e PAGA por ele. É
// a mesma decisão nos dois sentidos: o clube gasta o caixa que estava parado.

/** Plantel de trabalho que a diretoria tenta manter. */
export const ALVO_DE_ELENCO = 24
/** Quantos reforços a diretoria fecha por vez. Devagar de propósito: o técnico
 *  continua sendo o protagonista do mercado. */
export const REFORCOS_POR_VEZ = 2
/** Prêmio pago sobre o valor de mercado. Comprar e revender tem de DAR PREJUÍZO,
 *  senão a diretoria vira impressora de dinheiro — a mesma armadilha que fez o
 *  reforço emergencial valer 0. */
export const PREMIO_SOBRE_O_VALOR = 1.15
/** Fração do caixa que a diretoria nunca gasta. */
export const RESERVA_DE_CAIXA = 0.2

export interface AtletaNoElenco {
  readonly overall: number
  readonly age: number
  /** GOL / ZAG / LD / LE / VOL / MEI / ATA / ... */
  readonly position: string
}

export interface ContratacaoDecidida {
  /** Setor que o reforço vem cobrir. */
  setor: "GOL" | "DEF" | "MEI" | "ATA"
  /** Posição concreta sugerida. */
  position: string
  overall: number
  age: number
  salarioSemanal: number
  /** O que sai do caixa agora. */
  custo: number
  /** Valor de mercado do atleta (menor que o custo, ver PREMIO_SOBRE_O_VALOR). */
  marketValue: number
}

export interface ContextoDeContratacao extends ContextoDaDiretoria {
  /** A janela está aberta? Fora dela a diretoria não contrata, como o técnico. */
  janelaAberta: boolean
  /** Salário semanal de um atleta deste overall nesta divisão. */
  salarioDe: (overall: number) => number
  /** Valor de mercado de um atleta deste overall nesta divisão. */
  valorDe: (overall: number) => number
}

const SETORES = {
  GOL: { posicoes: ["GOL"], minimo: 3, principal: "GOL" },
  DEF: { posicoes: ["ZAG", "LD", "LE", "LAT", "DEF"], minimo: 7, principal: "ZAG" },
  MEI: { posicoes: ["VOL", "MC", "MEI", "ME", "MD"], minimo: 7, principal: "MEI" },
  ATA: { posicoes: ["ATA", "CA", "PE", "PD"], minimo: 5, principal: "ATA" },
} as const

type SetorId = keyof typeof SETORES

/**
 * Quem a diretoria contrata agora.
 *
 * Devolve lista vazia no caso normal — elenco cheio, janela fechada ou caixa
 * curto. Como a de renovação, é chamada toda semana e precisa ser barata.
 */
export function decidirContratacoes(
  elenco: readonly AtletaNoElenco[],
  ctx: ContextoDeContratacao,
): ContratacaoDecidida[] {
  if (!ctx.janelaAberta) return []
  if (elenco.length >= ALVO_DE_ELENCO) return []

  const caixaUtil = ctx.caixa * (1 - RESERVA_DE_CAIXA)
  if (caixaUtil <= 0) return []

  // A régua de qualidade é o próprio elenco — a diretoria REPÕE o nível do
  // clube, não faz o técnico campeão por conta própria. Um pouco abaixo da
  // mediana: reforço de elenco, não estrela.
  const overalls = [...elenco.map(a => a.overall)].sort((x, y) => x - y)
  const mediana = overalls.length ? overalls[Math.floor(overalls.length / 2)] : 55
  const overallDoReforco = Math.max(40, Math.round(mediana - 2))

  const contagem = (setor: SetorId) =>
    elenco.filter(a => (SETORES[setor].posicoes as readonly string[]).includes(a.position)).length

  // Setor mais carente primeiro (o que está mais longe do mínimo).
  const carencias = (Object.keys(SETORES) as SetorId[])
    .map(setor => ({ setor, falta: SETORES[setor].minimo - contagem(setor) }))
    .sort((a, b) => b.falta - a.falta)

  const decisoes: ContratacaoDecidida[] = []
  let caixaRestante = caixaUtil
  let folhaProjetada = ctx.folhaAtual
  let tamanho = elenco.length

  for (let i = 0; i < REFORCOS_POR_VEZ && tamanho < ALVO_DE_ELENCO; i++) {
    // Enquanto houver setor abaixo do mínimo, ele manda; depois é só volume.
    const alvo = carencias[i % carencias.length]
    const setor: SetorId = alvo.falta > 0 ? alvo.setor : "MEI"

    const salario = ctx.salarioDe(overallDoReforco)
    if (ctx.tetoDeFolha && folhaProjetada + salario > ctx.tetoDeFolha) break

    const marketValue = ctx.valorDe(overallDoReforco)
    const custo = Math.round(marketValue * PREMIO_SOBRE_O_VALOR)
    if (custo > caixaRestante) break

    caixaRestante -= custo
    folhaProjetada += salario
    tamanho++
    alvo.falta--
    decisoes.push({
      setor,
      position: SETORES[setor].principal,
      overall: overallDoReforco,
      // 23 a 28: idade de quem chega para jogar já, sem ser aposta nem veterano.
      age: 23 + ((tamanho + i) % 6),
      salarioSemanal: salario,
      custo,
      marketValue,
    })
  }
  return decisoes
}
