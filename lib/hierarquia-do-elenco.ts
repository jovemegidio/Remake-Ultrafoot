/**
 * HIERARQUIA DO ELENCO — quem manda no vestiario, e o que isso custa em campo.
 *
 * ## O que existia antes
 *
 * O capitao JA ERA escolhivel em `app/elenco/gerenciamento/page.tsx` (campo
 * `tacticalAssignments.captain`, guardado pelo NOME) e nao fazia absolutamente
 * nada: zero referencias no `match-engine` e no `use-game-manager`. O tipo
 * `PlayerHierarchy` (role/influence/respect) estava declarado no game-engine
 * com ZERO consumidores — esqueleto, nunca preenchido.
 *
 * ## Por que aqui nao se persiste nada
 *
 * A tentacao era gravar `PlayerHierarchy[]` no save. Foi assim que o esqueleto
 * antigo morreu: estrutura que ninguem alimenta e dado que nasce vazio, e no
 * save de carreira real ele simplesmente NAO EXISTE (foi o que aconteceu com
 * `GameState.squadPlayers`, que o motor de treino orfao tentava usar).
 *
 * Aqui a hierarquia e **derivada** a cada leitura, de dados que todo save ja
 * tem: idade, overall, titularidade e o capitao escolhido. Funciona em save
 * antigo, nao cria segunda fonte de verdade e nao pode dessincronizar.
 *
 * ## Limite conhecido
 *
 * Nao existe "anos de casa" no `Player`. Sem esse dado, `veterano` e `novato`
 * saem de IDADE, nao de tempo de clube — um craque de 33 anos recem-chegado
 * aparece como veterano. Corrigir exige campo novo no atleta e migracao de save.
 */
import type { Player, PlayerHierarchy } from "./game-engine"

/** Reaproveita a uniao que ja estava declarada. Nao inventar outra. */
export type PapelNoElenco = PlayerHierarchy["role"]

export interface PostoNoElenco {
  playerId: number
  nome: string
  papel: PapelNoElenco
  /** 0-100. Quanto a moral deste atleta contamina o grupo. */
  influencia: number
}

export interface ClimaDoVestiario {
  postos: PostoNoElenco[]
  /** Moral do grupo PONDERADA por influencia (0-100). */
  clima: number
  /** Media simples, so para comparacao — e o que o jogo usava antes. */
  climaSimples: number
  /**
   * Delta de forca que a LIDERANCA entrega ao XI.
   *
   * ⚠️ Sai da diferenca entre `clima` e `climaSimples` — NUNCA do clima
   * absoluto. A forca do XI em `app/partida/ao-vivo` ja soma a media de moral
   * do time; usar o valor absoluto aqui contaria moral DUAS VEZES, que e o
   * defeito recorrente deste projeto (leilao, caixa dos clubes, Championship).
   * O que a hierarquia acrescenta e so isto: se quem manda no vestiario esta
   * acima ou abaixo do grupo.
   *
   * Limitado a ±LIMITE_LIDERANCA para nao virar bola de neve (time feliz vence,
   * vence mais feliz, vence mais).
   */
  efeito: number
  /** Frases do que esta pesando, para a tela explicar em vez de so mostrar numero. */
  vozes: string[]
}

export const LIMITE_LIDERANCA = 2

const PONTOS_POR_ROTULO: Record<string, number> = {
  Feliz: 80, Motivado: 68, Normal: 55, Insatisfeito: 35,
  Infeliz: 20, Descontente: 35, Revoltado: 20,
}

/** Moral em numero. O jogo guarda rotulo e, as vezes, `moralePoints`. */
export function moralEmPontos(p: Pick<Player, "morale" | "moralePoints">): number {
  return p.moralePoints ?? PONTOS_POR_ROTULO[p.morale] ?? 55
}

/**
 * Influencia de um atleta. Idade pesa porque vestiario respeita rodagem;
 * overall porque respeita quem joga; titularidade porque quem nao entra em
 * campo fala mais baixo.
 */
function calcularInfluencia(p: Player, ehCapitao: boolean, ehVice: boolean): number {
  const porIdade = Math.min(35, Math.max(0, (p.age - 17) * 2.2))
  const porQualidade = Math.max(0, (p.overall - 55) * 0.9)
  const porTitularidade = p.isStarter ? 12 : 0
  const porFaixa = ehCapitao ? 25 : ehVice ? 12 : 0
  return Math.round(Math.max(0, Math.min(100, porIdade + porQualidade + porTitularidade + porFaixa)))
}

function definirPapel(p: Player, ehCapitao: boolean, ehVice: boolean, influencia: number): PapelNoElenco {
  if (ehCapitao) return "capitao"
  if (ehVice) return "vice_capitao"
  if (p.age >= 30) return "veterano"
  if (influencia >= 45) return "referencia"
  if (p.age <= 21) return "jovem"
  return "novato"
}

/**
 * Monta a hierarquia e o clima.
 *
 * @param nomeDoCapitao vem de `tacticalAssignments.captain`, que guarda o NOME.
 *   Vazio ou desconhecido: o de maior influencia natural assume a braçadeira,
 *   que e o que acontece num elenco de verdade.
 */
export function climaDoVestiario(elenco: Player[], nomeDoCapitao?: string): ClimaDoVestiario {
  const vivos = elenco.filter(p => !p.injury)
  const base = vivos.length > 0 ? vivos : elenco
  if (base.length === 0) {
    return { postos: [], clima: 55, climaSimples: 55, efeito: 0, vozes: [] }
  }

  // Sem capitao definido, a bracadeira vai para o de maior influencia natural.
  const semFaixa = (p: Player) => calcularInfluencia(p, false, false)
  const ordenados = [...base].sort((a, b) => semFaixa(b) - semFaixa(a))
  const capitao = base.find(p => p.name === nomeDoCapitao) ?? ordenados[0]
  const vice = ordenados.find(p => p.id !== capitao.id)

  const postos: PostoNoElenco[] = base.map(p => {
    const ehCapitao = p.id === capitao.id
    const ehVice = !ehCapitao && p.id === vice?.id
    const influencia = calcularInfluencia(p, ehCapitao, ehVice)
    return { playerId: p.id, nome: p.name, papel: definirPapel(p, ehCapitao, ehVice, influencia), influencia }
  })

  const porId = new Map(base.map(p => [p.id, p]))
  let somaPeso = 0
  let somaPonderada = 0
  let somaSimples = 0
  for (const posto of postos) {
    const atleta = porId.get(posto.playerId)
    if (!atleta) continue
    const moral = moralEmPontos(atleta)
    // +1 para que um elenco inteiro de influencia zero ainda tenha media.
    const peso = posto.influencia + 1
    somaPeso += peso
    somaPonderada += moral * peso
    somaSimples += moral
  }

  const clima = Math.round(somaPonderada / somaPeso)
  const climaSimples = Math.round(somaSimples / postos.length)

  // So a PARCELA da lideranca (ver o comentario de `efeito` na interface).
  const bruto = (clima - climaSimples) / 5
  const efeito = Math.max(-LIMITE_LIDERANCA, Math.min(LIMITE_LIDERANCA, Math.round(bruto * 10) / 10))

  return { postos, clima, climaSimples, efeito, vozes: montarVozes(postos, porId, clima, climaSimples) }
}

function montarVozes(
  postos: PostoNoElenco[],
  porId: Map<number, Player>,
  clima: number,
  climaSimples: number,
): string[] {
  const vozes: string[] = []
  const capitao = postos.find(p => p.papel === "capitao")
  const atletaCapitao = capitao ? porId.get(capitao.playerId) : undefined

  if (atletaCapitao) {
    const moral = moralEmPontos(atletaCapitao)
    if (moral <= 35) vozes.push(`${atletaCapitao.name} usa a bracadeira e esta insatisfeito. O grupo inteiro sente.`)
    else if (moral >= 75) vozes.push(`${atletaCapitao.name} puxa o grupo e o vestiario responde.`)
  }

  // Descontentes de peso, fora o capitao (ja citado acima).
  const pesados = postos
    .filter(p => p.papel !== "capitao" && p.influencia >= 45)
    .map(p => ({ posto: p, atleta: porId.get(p.playerId) }))
    .filter(x => x.atleta && moralEmPontos(x.atleta) <= 35)
    .sort((a, b) => b.posto.influencia - a.posto.influencia)
    .slice(0, 2)
  for (const { atleta } of pesados) {
    if (atleta) vozes.push(`${atleta.name} tem peso no vestiario e esta descontente.`)
  }

  // O sinal mais util: a diferenca entre o grupo e QUEM MANDA no grupo.
  if (clima <= climaSimples - 4) {
    vozes.push("O elenco esta melhor do que as lideranças: quem manda no vestiario esta puxando o clima para baixo.")
  } else if (clima >= climaSimples + 4) {
    vozes.push("As lideranças seguram o grupo mesmo com parte do elenco insatisfeita.")
  }

  return vozes
}

export const ROTULO_DO_PAPEL: Record<PapelNoElenco, string> = {
  capitao: "Capitao",
  vice_capitao: "Vice-capitao",
  veterano: "Veterano",
  referencia: "Referencia",
  jovem: "Jovem",
  novato: "Novato",
}
