export type NivelComoJogador26 = "superastro" | "profissional" | "semiprofissional" | "amador" | "recreativo"
export type AreaAnterior26 = "treinamento" | "recrutamento" | "medica" | "midia" | "arbitragem" | "nenhuma"
export type RelevanciaAnterior26 = "internacional" | "nacional" | "regional" | "anonimo"
export type LicencaTreinador26 = "pro" | "a" | "b" | "c" | "nenhuma"
export type EstiloTreinador26 = "tatico" | "motivador" | "desenvolvedor" | "disciplinador" | "inovador" | "gestor" | "recrutador" | "fisico" | "analista"
export type PersonalidadeTreinador26 = "carismatico" | "exigente" | "calmo" | "ambicioso" | "leal" | "pragmatico"

export interface AtributosTreinador26 {
  reputacao: number
  tatica: number
  motivacao: number
  desenvolvimento: number
  disciplina: number
  negociacao: number
  recrutamento: number
  preparoFisico: number
  analise: number
  comunicacao: number
}

export interface PerfilTreinador26 {
  schema: 1
  nivelComoJogador: NivelComoJogador26
  areaAnterior: AreaAnterior26
  relevanciaAnterior: RelevanciaAnterior26
  licenca: LicencaTreinador26
  estilos: EstiloTreinador26[]
  personalidades: PersonalidadeTreinador26[]
  atributos: AtributosTreinador26
  tendencias: string[]
}

type EscolhasPerfil26 = Omit<PerfilTreinador26, "schema" | "atributos" | "tendencias">

const BASE_JOGADOR: Record<NivelComoJogador26, number> = {
  superastro: 36, profissional: 25, semiprofissional: 15, amador: 8, recreativo: 2,
}
const BASE_RELEVANCIA: Record<RelevanciaAnterior26, number> = {
  internacional: 22, nacional: 14, regional: 7, anonimo: 0,
}
const BASE_LICENCA: Record<LicencaTreinador26, number> = { pro: 18, a: 13, b: 9, c: 5, nenhuma: 0 }

function limitar(valor: number) { return Math.max(1, Math.min(100, Math.round(valor))) }

/**
 * ⚠️ ESTA CONSTANTE PRECISA VIR DEPOIS DAS BASES — não a mova para cima.
 *
 * Ela estava declarada ANTES de `BASE_JOGADOR`, `BASE_RELEVANCIA` e
 * `BASE_LICENCA`, chamando `criarPerfilTreinador26` no escopo do módulo. A
 * função é içada, mas as três constantes são `const`: quando a chamada
 * executava, elas ainda estavam na zona morta temporal, e a build morria com
 *
 *     ReferenceError: Cannot access 'X' before initialization
 *
 * ...no prerender de /novo-jogo, sem apontar o arquivo. Só quebrava na BUILD:
 * a geração estática avalia o módulo no servidor, e o `next dev` podia nunca
 * chegar nessa ordem — por isso passava despercebido em desenvolvimento.
 */
export const PERFIL_TREINADOR_26_PADRAO: PerfilTreinador26 = criarPerfilTreinador26({
  nivelComoJogador: "semiprofissional",
  areaAnterior: "treinamento",
  relevanciaAnterior: "regional",
  licenca: "b",
  estilos: ["tatico", "motivador", "desenvolvedor"],
  personalidades: ["calmo"],
})

export function criarPerfilTreinador26(escolhas: EscolhasPerfil26): PerfilTreinador26 {
  const estilos = Array.from(new Set(escolhas.estilos)).slice(0, 3)
  const personalidades = Array.from(new Set(escolhas.personalidades)).slice(0, 2)
  const base = 35 + BASE_LICENCA[escolhas.licenca]
  const atributos: AtributosTreinador26 = {
    reputacao: limitar(15 + BASE_JOGADOR[escolhas.nivelComoJogador] + BASE_RELEVANCIA[escolhas.relevanciaAnterior]),
    tatica: base,
    motivacao: base,
    desenvolvimento: base,
    disciplina: base,
    negociacao: base,
    recrutamento: base,
    preparoFisico: base,
    analise: base,
    comunicacao: base,
  }

  const somar = (chave: keyof AtributosTreinador26, valor: number) => { atributos[chave] = limitar(atributos[chave] + valor) }
  const bonusArea: Record<AreaAnterior26, [keyof AtributosTreinador26, keyof AtributosTreinador26] | null> = {
    treinamento: ["desenvolvimento", "tatica"], recrutamento: ["recrutamento", "negociacao"],
    medica: ["preparoFisico", "desenvolvimento"], midia: ["comunicacao", "motivacao"],
    arbitragem: ["disciplina", "analise"], nenhuma: null,
  }
  const area = bonusArea[escolhas.areaAnterior]
  if (area) { somar(area[0], 12); somar(area[1], 7) }

  const bonusEstilo: Record<EstiloTreinador26, keyof AtributosTreinador26> = {
    tatico: "tatica", motivador: "motivacao", desenvolvedor: "desenvolvimento", disciplinador: "disciplina",
    inovador: "analise", gestor: "negociacao", recrutador: "recrutamento", fisico: "preparoFisico", analista: "analise",
  }
  for (const estilo of estilos) somar(bonusEstilo[estilo], 9)

  const bonusPersonalidade: Record<PersonalidadeTreinador26, [keyof AtributosTreinador26, number, keyof AtributosTreinador26, number]> = {
    carismatico: ["comunicacao", 12, "disciplina", -3], exigente: ["disciplina", 12, "motivacao", -2],
    calmo: ["motivacao", 8, "comunicacao", 5], ambicioso: ["reputacao", 7, "desenvolvimento", 5],
    leal: ["comunicacao", 8, "negociacao", 4], pragmatico: ["tatica", 8, "analise", 7],
  }
  for (const personalidade of personalidades) {
    const [um, valorUm, dois, valorDois] = bonusPersonalidade[personalidade]
    somar(um, valorUm); somar(dois, valorDois)
  }

  const tendencias = [
    ...estilos.map(estilo => `Prioriza ${estilo}`),
    ...personalidades.map(personalidade => `Liderança ${personalidade}`),
  ]
  return { schema: 1, ...escolhas, estilos, personalidades, atributos, tendencias }
}

export function normalizarPerfilTreinador26(valor?: Partial<PerfilTreinador26> | null): PerfilTreinador26 {
  if (!valor) return PERFIL_TREINADOR_26_PADRAO
  return criarPerfilTreinador26({
    nivelComoJogador: valor.nivelComoJogador ?? "semiprofissional",
    areaAnterior: valor.areaAnterior ?? "treinamento",
    relevanciaAnterior: valor.relevanciaAnterior ?? "regional",
    licenca: valor.licenca ?? "b",
    estilos: valor.estilos ?? ["tatico", "motivador", "desenvolvedor"],
    personalidades: valor.personalidades ?? ["calmo"],
  })
}

export function efeitosIniciaisPerfil26(perfil: PerfilTreinador26) {
  const mediaHumana = (perfil.atributos.motivacao + perfil.atributos.comunicacao + perfil.atributos.disciplina) / 3
  return {
    coachXP: Math.round(perfil.atributos.reputacao * 4),
    boardConfidenceBonus: Math.round((perfil.atributos.reputacao - 50) / 10),
    teamMorale: limitar(55 + (mediaHumana - 50) * 0.18),
  }
}
