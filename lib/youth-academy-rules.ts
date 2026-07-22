// Regras do módulo de BASE que faltavam: teto de 100 garotos, acompanhamento
// semanal, venda/negociação de jovens e cobrança da diretoria.
//
// Fica separado do youth-engine (peneira/promoção/empréstimo, que já existiam)
// para não misturar o que já estava testado com o que é novo.

export interface JovemBase {
  id: string
  name: string
  position: string
  age: number
  overall: number
  potential: number
  value?: number
}

// ─── Teto do elenco de base ───────────────────────────────────────────────────

/**
 * Quantos garotos a base comporta. Escala com o nível da academia (1-5) até o
 * teto de 100 pedido — uma base nível 1 não sustenta 100 atletas.
 */
export function capacidadeDaBase(nivelAcademia = 1): number {
  const porNivel = [40, 55, 70, 85, 100]
  return porNivel[Math.max(0, Math.min(4, nivelAcademia - 1))]
}

/** Vagas livres agora. */
export function vagasNaBase(quantidadeAtual: number, nivelAcademia = 1): number {
  return Math.max(0, capacidadeDaBase(nivelAcademia) - quantidadeAtual)
}

// ─── Acompanhamento SEMANAL ───────────────────────────────────────────────────

export interface EvolucaoSemanal {
  jovens: JovemBase[]
  destaques: { nome: string; ganho: number }[]
  /** Quem chamou atenção o bastante para o técnico considerar promover. */
  prontosParaSubir: string[]
}

/**
 * Uma semana de trabalho na base.
 *
 * Evolui pouco de propósito: o salto real vem da virada de temporada. Aqui o
 * valor está em ACOMPANHAR — ver quem está crescendo semana a semana, que era
 * exatamente o que o técnico não conseguia fazer.
 */
export function evoluirSemana(
  jovens: JovemBase[],
  nivelAcademia = 1,
  rng: () => number = Math.random,
): EvolucaoSemanal {
  const fator = 0.5 + nivelAcademia * 0.25 // academia boa acelera
  const destaques: { nome: string; ganho: number }[] = []
  const prontosParaSubir: string[] = []

  const atualizados = jovens.map(j => {
    const margem = j.potential - j.overall
    if (margem <= 0) return j
    // Chance de evoluir na semana; jovem com muita margem evolui mais vezes.
    const chance = Math.min(0.5, 0.10 + margem * 0.012) * fator
    if (rng() > chance) return j
    const ganho = 1
    const overall = Math.min(j.potential, j.overall + ganho)
    destaques.push({ nome: j.name, ganho })
    // Pronto para subir: já alcançou nível de profissional e tem idade.
    if (overall >= 68 && j.age >= 17) prontosParaSubir.push(j.name)
    return { ...j, overall }
  })

  return { jovens: atualizados, destaques, prontosParaSubir }
}

// ─── Venda / negociação de jovens ─────────────────────────────────────────────

/**
 * Quanto o mercado paga por um garoto da base.
 *
 * O potencial pesa mais que o overall atual — é promessa que se compra — e a
 * juventude valoriza. Sem isso um moleque de 15 com potencial 88 sairia de graça.
 */
export function valorDeMercadoJovem(j: JovemBase): number {
  const promessa = j.potential * 1.6 + j.overall * 0.9
  const fatorIdade = j.age <= 15 ? 1.5 : j.age <= 16 ? 1.3 : j.age <= 17 ? 1.15 : 1.0
  const bruto = Math.pow(promessa / 40, 3) * 120_000 * fatorIdade
  return Math.max(50_000, Math.round(bruto / 10_000) * 10_000)
}

export interface PropostaPorJovem {
  clube: string
  valor: number
  /** Abaixo do valor justo? O técnico pode recusar. */
  abaixoDoValor: boolean
}

/** Gera uma proposta de compra por um jovem, com margem de negociação. */
export function propostaPorJovem(
  j: JovemBase,
  clube: string,
  rng: () => number = Math.random,
): PropostaPorJovem {
  const justo = valorDeMercadoJovem(j)
  // Clubes abrem entre 65% e 115% do valor justo.
  const multiplicador = 0.65 + rng() * 0.5
  const valor = Math.round((justo * multiplicador) / 10_000) * 10_000
  return { clube, valor, abaixoDoValor: valor < justo * 0.9 }
}

// ─── Cobrança da diretoria ────────────────────────────────────────────────────

export interface CobrancaDaBase {
  /** Quantos atletas da base a diretoria espera ver no profissional. */
  meta: number
  usados: number
  cumprida: boolean
  titulo: string
  mensagem: string
}

/**
 * A diretoria cobra o uso da base em momentos definidos da temporada.
 *
 * Só cobra a partir da semana 12 e depois a cada ~14 semanas: cobrar na estreia
 * seria injusto, e cobrar toda semana viraria ruído.
 */
export function cobrancaDaDiretoria(input: {
  semana: number
  nivelAcademia?: number
  promovidosNaTemporada: number
}): CobrancaDaBase | null {
  const { semana, nivelAcademia = 1, promovidosNaTemporada } = input
  if (semana < 12) return null
  if ((semana - 12) % 14 !== 0) return null

  // Academia melhor => cobrança maior (o clube investiu, quer retorno).
  const meta = Math.max(1, Math.round(nivelAcademia * 0.8))
  const cumprida = promovidosNaTemporada >= meta

  return {
    meta,
    usados: promovidosNaTemporada,
    cumprida,
    titulo: cumprida ? "Diretoria aprovou o uso da base" : "Diretoria cobra o uso da base",
    mensagem: cumprida
      ? `A diretoria reconhece: ${promovidosNaTemporada} atleta(s) da base já subiram ao profissional nesta temporada. Continue apostando na formação.`
      : `O clube investe na formação e espera retorno: a meta é ${meta} atleta(s) da base no profissional nesta temporada, e até agora foram ${promovidosNaTemporada}. Aproveite os garotos.`,
  }
}
