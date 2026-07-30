// TREINO REALISTA E ENTROSAMENTO — o modelo, sem React e sem store.
//
// Até a 1.0.222 existiam DOIS sistemas que não se falavam:
//
//   • o "entrosamento" do escritório: um número solto (`squadCohesion`) que subia
//     por BOTÃO — jogar um amistoso dava +4, treinar na data FIFA dava +5. Trocar
//     o time inteiro no mercado não mexia nele; manter a mesma base por dois anos
//     também não.
//   • o Centro de Treinamento: escolher um atleta e um atributo, esperar 4
//     semanas, torcer por +1. Sem carga, sem fadiga, sem risco, sem treino
//     coletivo. A energia se recuperava +10 por semana para todo mundo, fosse o
//     garoto de 19 anos que não jogou ou o zagueiro de 34 que fez os 90 minutos.
//
// Aqui os dois viram um só modelo, com três ideias:
//
//   1. CARGA. O plano semanal (intensidade × foco) produz uma carga. Carga alta
//      treina mais e cansa mais — não existe almoço grátis.
//   2. FADIGA. O desgaste da semana (treino + minutos jogados) contra a
//      recuperação (idade, físico, Centro Médico, descanso) move a energia. O que
//      sobra de desgaste vira FADIGA CRÔNICA, que só sai com semanas leves — é
//      ela que explica o atleta que "não cansa no jogo mas quebra em abril".
//   3. LESÃO. O risco sai da carga multiplicada pela fadiga, pela idade e pela
//      energia baixa. Treinar forte um elenco esgotado quebra gente.
//
// E o entrosamento deixa de ser um botão: ele é MINUTOS JOGADOS JUNTOS, par a
// par. Dois atletas que nunca dividiram o gramado não se entendem, por melhores
// que sejam. Partida oficial, amistoso e treino coletivo com foco em
// entrosamento alimentam a MESMA conta — cada um com o seu peso.

// ─── ENTROSAMENTO: minutos juntos, par a par ─────────────────────────────────

/**
 * Minutos que cada DUPLA de atletas passou em campo junta.
 *
 * Chave `"menorId-maiorId"` para o par ser o mesmo nos dois sentidos. Um elenco
 * de 30 atletas tem no máximo 435 duplas, e só as que realmente jogaram juntas
 * ocupam espaço — cabe no save sem drama.
 */
export type ParesDeEntrosamento = Record<string, number>

/** Minutos juntos a partir dos quais uma dupla está totalmente entrosada. */
export const MINUTOS_PAR_MADURO = 900 // dez jogos inteiros lado a lado

/**
 * Entrosamento de um elenco recém-montado. Não é zero: são profissionais, sabem
 * jogar futebol. É a distância entre "sabem jogar" e "se acham de olhos
 * fechados" que os minutos juntos percorrem.
 */
export const PISO_ENTROSAMENTO = 35

export function chaveDoPar(a: number, b: number): string {
  return a < b ? `${a}-${b}` : `${b}-${a}`
}

/** Credita `minutos` a todas as duplas possíveis entre os atletas informados. */
export function registrarMinutosJuntos(
  pares: ParesDeEntrosamento,
  ids: readonly number[],
  minutos: number,
): ParesDeEntrosamento {
  if (minutos <= 0 || ids.length < 2) return pares
  const unicos = [...new Set(ids)]
  const out = { ...pares }
  for (let i = 0; i < unicos.length; i++) {
    for (let j = i + 1; j < unicos.length; j++) {
      const k = chaveDoPar(unicos[i], unicos[j])
      // Guarda no máximo o dobro do maduro: sem teto, uma dupla de dez anos
      // acumularia um número enorme e o decaimento nunca a alcançaria.
      out[k] = Math.min(MINUTOS_PAR_MADURO * 2, (out[k] ?? 0) + minutos)
    }
  }
  return out
}

/**
 * Entrosamento (0-100) do grupo informado — normalmente o XI titular.
 *
 * Média das duplas, e não soma: basta UM recém-chegado para o time inteiro
 * perder afinação, que é exatamente o que acontece na vida real quando se troca
 * meio elenco na janela.
 */
export function entrosamentoDoGrupo(
  pares: ParesDeEntrosamento,
  ids: readonly number[],
): number {
  const unicos = [...new Set(ids)]
  if (unicos.length < 2) return PISO_ENTROSAMENTO
  let soma = 0
  let duplas = 0
  for (let i = 0; i < unicos.length; i++) {
    for (let j = i + 1; j < unicos.length; j++) {
      soma += Math.min(1, (pares[chaveDoPar(unicos[i], unicos[j])] ?? 0) / MINUTOS_PAR_MADURO)
      duplas++
    }
  }
  const media = duplas > 0 ? soma / duplas : 0
  return Math.round(PISO_ENTROSAMENTO + (100 - PISO_ENTROSAMENTO) * media)
}

/**
 * Esquecimento: quem parou de jogar junto vai perdendo a sintonia.
 *
 * Sem isto, um elenco entrosado em 2026 continuaria entrosado em 2030 mesmo com
 * os titulares aposentados — o número viraria enfeite outra vez. `fator` é a
 * fração que sobra por semana (0.995 ≈ metade em ~2,5 anos de inatividade).
 */
export function decairEntrosamento(
  pares: ParesDeEntrosamento,
  idsAtivos: readonly number[],
  fator = 0.985,
): ParesDeEntrosamento {
  const ativos = new Set(idsAtivos)
  const out: ParesDeEntrosamento = {}
  for (const [k, v] of Object.entries(pares)) {
    const [a, b] = k.split("-").map(Number)
    // Dupla em que alguém saiu do clube some: ela não volta a ser útil.
    if (!ativos.has(a) || !ativos.has(b)) continue
    const novo = v * fator
    if (novo >= 1) out[k] = Math.round(novo)
  }
  return out
}

/**
 * Reconstrói uma estimativa de minutos juntos para saves anteriores à 1.0.223,
 * que não tinham a tabela de duplas.
 *
 * Sem isto, quem já estava com o time entrosado veria o número despencar para o
 * piso ao atualizar — uma punição por instalar a versão nova. A conta é
 * conservadora: a dupla jogou junta, no máximo, o mínimo dos jogos dos dois.
 */
export function semearParesDeHistorico(
  jogadores: readonly { id: number; jogos: number }[],
): ParesDeEntrosamento {
  const out: ParesDeEntrosamento = {}
  for (let i = 0; i < jogadores.length; i++) {
    for (let j = i + 1; j < jogadores.length; j++) {
      const juntos = Math.min(jogadores[i].jogos, jogadores[j].jogos)
      if (juntos <= 0) continue
      // 0.75: nem todo jogo dos dois foi o mesmo jogo, e nem sempre os 90 minutos.
      const minutos = Math.round(Math.min(MINUTOS_PAR_MADURO, juntos * 90 * 0.75))
      if (minutos > 0) out[chaveDoPar(jogadores[i].id, jogadores[j].id)] = minutos
    }
  }
  return out
}

/** As duplas mais e menos rodadas do XI — o que a tela mostra ao técnico. */
export function duplasDoGrupo(
  pares: ParesDeEntrosamento,
  jogadores: readonly { id: number; nome: string }[],
): { a: string; b: string; minutos: number; pct: number }[] {
  const out: { a: string; b: string; minutos: number; pct: number }[] = []
  for (let i = 0; i < jogadores.length; i++) {
    for (let j = i + 1; j < jogadores.length; j++) {
      const minutos = pares[chaveDoPar(jogadores[i].id, jogadores[j].id)] ?? 0
      out.push({
        a: jogadores[i].nome, b: jogadores[j].nome, minutos,
        pct: Math.round(Math.min(1, minutos / MINUTOS_PAR_MADURO) * 100),
      })
    }
  }
  return out.sort((x, y) => y.minutos - x.minutos)
}

// ─── TREINO: carga, fadiga e lesão ───────────────────────────────────────────

export type IntensidadeTreino = "leve" | "media" | "alta"

/**
 * Foco do treino COLETIVO da semana. É do time inteiro — diferente do treino
 * individual, que continua sendo um atleta e um atributo no Centro de
 * Treinamento.
 */
export type FocoColetivo =
  | "entrosamento"
  | "fisico"
  | "ofensivo"
  | "defensivo"
  | "bola_parada"
  | "recuperacao"

export interface PlanoDeTreino {
  intensidade: IntensidadeTreino
  foco: FocoColetivo
}

export const PLANO_PADRAO: PlanoDeTreino = { intensidade: "media", foco: "entrosamento" }

/** Atributo do Centro de Treinamento que cada foco coletivo reforça. */
export const ATRIBUTO_DO_FOCO: Record<FocoColetivo, string | null> = {
  entrosamento: "passing",
  fisico: "physical",
  ofensivo: "shooting",
  defensivo: "defending",
  bola_parada: "shooting",
  recuperacao: null,
}

export const ROTULO_DO_FOCO: Record<FocoColetivo, string> = {
  entrosamento: "Entrosamento",
  fisico: "Físico",
  ofensivo: "Ofensivo",
  defensivo: "Defensivo",
  bola_parada: "Bola parada",
  recuperacao: "Recuperação",
}

const PESO_INTENSIDADE: Record<IntensidadeTreino, number> = { leve: 30, media: 55, alta: 82 }

/**
 * Carga (0-100) da semana.
 *
 * O Centro de Treinamento não deixa o treino mais leve: deixa a MESMA carga
 * render mais e machucar menos (periodização, campo melhor, preparador melhor).
 * Por isso ele entra reduzindo a carga PERCEBIDA, não a real.
 */
export function cargaDoPlano(plano: PlanoDeTreino, nivelCentroDeTreinamento = 2): number {
  const base = PESO_INTENSIDADE[plano.intensidade]
  const ajusteFoco = plano.foco === "fisico" ? 12 : plano.foco === "recuperacao" ? -26 : 0
  const ganhoEstrutura = 1 - Math.max(0, nivelCentroDeTreinamento - 1) * 0.04 // até -16%
  return Math.max(5, Math.min(100, Math.round((base + ajusteFoco) * ganhoEstrutura)))
}

export interface AtletaNaSemana {
  id: number
  idade: number
  /** 0-100. */
  energia: number
  /** 0-100 acumulada de semanas anteriores. */
  fadigaCronica: number
  /** Minutos oficiais disputados na semana que passou. */
  minutosJogados: number
  /** Atributo físico — quem tem fôlego se recupera antes. */
  resistencia: number
  lesionado: boolean
  emTreinoIndividual: boolean
  /** Atributo do treino individual, para casar (ou não) com o foco coletivo. */
  focoIndividual?: string | null
}

export interface EfeitoDaSemana {
  id: number
  energia: number
  fadigaCronica: number
  /** Probabilidade de lesão de treino nesta semana (0-1), já limitada. */
  risco: number
  /**
   * Multiplicador da chance de o treino individual render +1. Carga alta ensina
   * mais; elenco esgotado não aprende nada.
   */
  rendimentoIndividual: number
}

export interface ResumoDaSemana {
  carga: number
  /** Média de energia do elenco depois da semana. */
  energiaMedia: number
  /** Média da fadiga crônica depois da semana. */
  fadigaMedia: number
  /** Risco médio de lesão (0-1) — o que a tela mostra como "risco". */
  riscoMedio: number
  efeitos: EfeitoDaSemana[]
}

/**
 * Aplica uma semana de treino a um elenco.
 *
 * Puro de propósito: recebe o estado dos atletas, devolve os efeitos. Quem
 * grava (e quem sorteia a lesão) é o motor — assim o modelo pode ser testado
 * sem store e sem aleatoriedade. Ver scripts/test-treino-entrosamento.ts.
 */
export function aplicarSemanaDeTreino(
  atletas: readonly AtletaNaSemana[],
  plano: PlanoDeTreino,
  infra: { centroDeTreinamento?: number; centroMedico?: number } = {},
): ResumoDaSemana {
  const carga = cargaDoPlano(plano, infra.centroDeTreinamento ?? 2)
  const medico = infra.centroMedico ?? 2
  const efeitos: EfeitoDaSemana[] = []

  for (const a of atletas) {
    // Lesionado não treina: ele se recupera. O Centro Médico manda aqui.
    if (a.lesionado) {
      efeitos.push({
        id: a.id,
        energia: Math.min(100, a.energia + 6 + medico),
        fadigaCronica: Math.max(0, a.fadigaCronica - 6),
        risco: 0,
        rendimentoIndividual: 0,
      })
      continue
    }

    // DESGASTE: o que o treino cobra + o que o jogo cobrou.
    const desgaste = carga * 0.16 + a.minutosJogados * 0.075

    // RECUPERAÇÃO: idade, fôlego, estrutura médica e o foco da semana.
    const fatorIdade = a.idade <= 21 ? 3 : a.idade <= 27 ? 1 : a.idade <= 31 ? -1 : -4
    const recuperacao =
      13
      + medico * 1.6
      + fatorIdade
      + (a.resistencia - 70) * 0.06
      + (plano.foco === "recuperacao" ? 9 : 0)
      + (a.emTreinoIndividual ? -3 : 0) // treino extra também cobra

    const energia = Math.max(0, Math.min(100, a.energia - desgaste + recuperacao))

    // FADIGA CRÔNICA: o excedente que a semana não conseguiu repor. Quem sobra
    // energia paga a dívida devagar — por isso semana leve é remédio, não luxo.
    const sobra = desgaste - recuperacao
    const fadigaCronica = Math.max(0, Math.min(100,
      a.fadigaCronica + (sobra > 0 ? sobra * 0.45 : sobra * 0.30),
    ))

    // RISCO DE LESÃO: carga × fadiga × idade × energia baixa.
    const fadigaMult = 1 + fadigaCronica / 45
    const energiaMult = energia < 35 ? 2.0 : energia < 55 ? 1.35 : energia < 75 ? 1.05 : 1
    const idadeMult = a.idade >= 33 ? 1.45 : a.idade >= 30 ? 1.2 : a.idade <= 19 ? 1.15 : 1
    // O Centro de Treinamento reduz o risco de verdade (o de verdade é o que
    // um clube compra quando reforma o CT).
    const estruturaMult = 1 - Math.max(0, (infra.centroDeTreinamento ?? 2) - 1) * 0.06
    const risco = Math.min(0.14,
      (carga / 100) * 0.030 * fadigaMult * energiaMult * idadeMult * estruturaMult,
    )

    // RENDIMENTO do treino individual: carga alta ensina mais, mas só a quem
    // tem gás para absorver.
    let rendimento = plano.intensidade === "alta" ? 1.25 : plano.intensidade === "media" ? 1 : 0.75
    if (plano.foco === "recuperacao") rendimento *= 0.6
    if (energia < 40) rendimento *= 0.5
    else if (energia < 60) rendimento *= 0.8
    if (fadigaCronica > 70) rendimento *= 0.6
    // Treino individual ALINHADO ao foco coletivo rende mais: o time inteiro
    // está fazendo o mesmo trabalho.
    if (a.focoIndividual && a.focoIndividual === ATRIBUTO_DO_FOCO[plano.foco]) rendimento *= 1.3

    efeitos.push({ id: a.id, energia, fadigaCronica, risco, rendimentoIndividual: rendimento })
  }

  const n = Math.max(1, efeitos.length)
  return {
    carga,
    energiaMedia: Math.round(efeitos.reduce((s, e) => s + e.energia, 0) / n),
    fadigaMedia: Math.round(efeitos.reduce((s, e) => s + e.fadigaCronica, 0) / n),
    riscoMedio: efeitos.reduce((s, e) => s + e.risco, 0) / n,
    efeitos,
  }
}

/**
 * Quantos "minutos juntos" o treino coletivo da semana vale.
 *
 * Treino não é jogo: o teto é bem abaixo de uma partida (90 min). Com foco em
 * entrosamento e intensidade alta chega a 40 — pouco mais de meio jogo. É assim
 * que o treino ajuda sem substituir o gramado, e é o que faz a pré-temporada
 * valer alguma coisa sem virar atalho.
 */
export function minutosDeTreinoColetivo(plano: PlanoDeTreino): number {
  if (plano.foco === "recuperacao") return 6
  const base = plano.foco === "entrosamento" ? 30 : 12
  const mult = plano.intensidade === "alta" ? 1.35 : plano.intensidade === "media" ? 1 : 0.6
  return Math.round(base * mult)
}

/** Rótulo curto da carga, para a tela não mostrar só um número cru. */
export function rotuloDaCarga(carga: number): string {
  if (carga >= 78) return "Muito alta"
  if (carga >= 60) return "Alta"
  if (carga >= 42) return "Equilibrada"
  if (carga >= 26) return "Leve"
  return "Regenerativa"
}
