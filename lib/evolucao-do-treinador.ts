/**
 * EVOLUÇÃO DO TREINADOR — o técnico deixa de ser o que você escolheu na criação.
 *
 * ## O que existia
 *
 * `PerfilTreinador26` é montado UMA vez, em `/novo-jogo`, e nunca mais muda. Pior
 * do que não mudar: `normalizarPerfilTreinador26` RECALCULA os atributos a partir
 * das escolhas toda vez que o save é lido. Ou seja, gravar um atributo evoluído
 * dentro de `managerProfile26.atributos` seria trabalho perdido — a próxima
 * leitura o apagaria em silêncio, sem erro nenhum na tela.
 *
 * ⚠️ É POR ISSO QUE O PROGRESSO MORA EM CAMPO SEPARADO. `managerProfile26`
 * continua sendo o que você ESCOLHEU; `managerGrowth26` é o que a carreira
 * ACRESCENTOU. O perfil efetivo é a soma dos dois, e só ele vai para o motor.
 *
 * ## As duas coisas que este arquivo guarda
 *
 * 1. **Ganhos por atributo.** O técnico melhora no que pratica (os estilos que
 *    declarou) e no que conquista (título, acesso, campanha forte).
 * 2. **Identidade tática REAL.** Um contador de semanas por estilo de jogo
 *    efetivamente usado. Quem se declarou "técnico de posse" e passou doze
 *    temporadas jogando no contra-ataque tem uma identidade que diz
 *    contra-ataque — porque é o que ele fez, não o que ele disse.
 */

import type { AtributosTreinador26, PerfilTreinador26 } from "@/lib/manager-profile-26"

export type AtributoDoTreinador = keyof AtributosTreinador26

export interface ProgressoDoTreinador26 {
  schema: 1
  /** Pontos GANHOS por atributo ao longo da carreira. Somados ao perfil base. */
  ganhos: Partial<Record<AtributoDoTreinador, number>>
  /** Semanas em que cada estilo de jogo foi de fato usado (`TeamTactics.playingStyle`). */
  estilos: Record<string, number>
  /** Temporadas já contabilizadas — a trava contra creditar duas vezes. */
  temporadasCreditadas: number[]
}

export const PROGRESSO_TREINADOR_VAZIO: ProgressoDoTreinador26 = {
  schema: 1,
  ganhos: {},
  estilos: {},
  temporadasCreditadas: [],
}

export function normalizarProgressoDoTreinador(
  valor?: Partial<ProgressoDoTreinador26> | null,
): ProgressoDoTreinador26 {
  return {
    schema: 1,
    ganhos: { ...(valor?.ganhos ?? {}) },
    estilos: { ...(valor?.estilos ?? {}) },
    temporadasCreditadas: [...(valor?.temporadasCreditadas ?? [])],
  }
}

/** Atributo que cada estilo declarado treina. Mesmo mapa de `manager-profile-26`. */
const ATRIBUTO_DO_ESTILO: Record<string, AtributoDoTreinador> = {
  tatico: "tatica",
  motivador: "motivacao",
  desenvolvedor: "desenvolvimento",
  disciplinador: "disciplina",
  inovador: "analise",
  gestor: "negociacao",
  recrutador: "recrutamento",
  fisico: "preparoFisico",
  analista: "analise",
}

/**
 * O PERFIL EFETIVO: o que foi escolhido mais o que a carreira acrescentou.
 *
 * É este — e não `managerProfile26` cru — que `sincronizarTreinador` publica
 * para os motores. Um técnico de doze temporadas precisa treinar melhor do que
 * ele mesmo no primeiro dia.
 */
export function perfilComProgresso(
  perfil: PerfilTreinador26,
  progresso?: Partial<ProgressoDoTreinador26> | null,
): PerfilTreinador26 {
  const ganhos = progresso?.ganhos
  if (!ganhos || Object.keys(ganhos).length === 0) return perfil
  const atributos = { ...perfil.atributos }
  for (const [chave, ganho] of Object.entries(ganhos)) {
    const nome = chave as AtributoDoTreinador
    if (!(nome in atributos)) continue
    atributos[nome] = Math.max(1, Math.min(100, Math.round(atributos[nome] + (ganho ?? 0))))
  }
  return { ...perfil, atributos }
}

/**
 * Credita uma semana ao estilo que o técnico está de fato usando.
 *
 * Devolve o MESMO objeto quando não há o que mudar — quem chama compara por
 * referência e evita gravar save à toa, como `aprenderPosicao` já faz.
 */
export function registrarSemanaDoTreinador(
  progresso: Partial<ProgressoDoTreinador26> | null | undefined,
  estiloDeJogo: string | null | undefined,
): ProgressoDoTreinador26 | undefined {
  if (!estiloDeJogo) return progresso ? normalizarProgressoDoTreinador(progresso) : undefined
  const atual = normalizarProgressoDoTreinador(progresso)
  return {
    ...atual,
    estilos: { ...atual.estilos, [estiloDeJogo]: (atual.estilos[estiloDeJogo] ?? 0) + 1 },
  }
}

export interface TemporadaDoTreinador {
  season: number
  /** Aproveitamento 0-1 (pontos ganhos / disputados). */
  aproveitamento: number
  campeao: boolean
  promovido: boolean
  rebaixado: boolean
}

/**
 * O QUE UMA TEMPORADA ACRESCENTA AO TÉCNICO.
 *
 * ⚠️ Teto de +6 pontos por temporada, espalhados por atributos DIFERENTES. Sem
 * esse limite, dez temporadas transformariam qualquer técnico num 100 em tudo e
 * o perfil da criação deixaria de significar alguma coisa — que é exatamente o
 * defeito que este arquivo existe para não criar.
 *
 * ⚠️ A trava `temporadasCreditadas` não é zelo: a virada de temporada passa por
 * mais de um caminho no jogo (fim de fixtures e fim de calendário), e sem ela um
 * técnico ganharia o ano duas vezes.
 */
export function evoluirTreinador(
  perfil: PerfilTreinador26,
  progresso: Partial<ProgressoDoTreinador26> | null | undefined,
  temporada: TemporadaDoTreinador,
): ProgressoDoTreinador26 {
  const atual = normalizarProgressoDoTreinador(progresso)
  if (atual.temporadasCreditadas.includes(temporada.season)) return atual

  const ganhos = { ...atual.ganhos }
  const somar = (nome: AtributoDoTreinador, quanto: number) => {
    ganhos[nome] = Math.max(-20, Math.min(50, (ganhos[nome] ?? 0) + quanto))
  }

  // 1. EXPERIÊNCIA: o técnico melhora no que pratica. Um ponto por temporada em
  //    cada estilo declarado (no máximo três), que é o que faz uma carreira
  //    longa render um especialista em vez de um genérico melhor em tudo.
  for (const estilo of perfil.estilos) {
    const alvo = ATRIBUTO_DO_ESTILO[estilo]
    if (alvo) somar(alvo, 1)
  }

  // 2. CAMPANHA: quem faz o time render aprende a fazer o time render.
  if (temporada.aproveitamento >= 0.6) somar("tatica", 1)

  // 3. RECONHECIMENTO: título e acesso constroem reputação; queda cobra.
  //    ⚠️ Este é o único ganho NEGATIVO do modelo. Ele existe porque reputação é
  //    a única coisa aqui que o mundo de fora concede — e o mundo de fora tira.
  if (temporada.campeao) somar("reputacao", 3)
  else if (temporada.promovido) somar("reputacao", 2)
  else if (temporada.rebaixado) somar("reputacao", -2)

  return {
    ...atual,
    ganhos,
    temporadasCreditadas: [...atual.temporadasCreditadas, temporada.season].slice(-60),
  }
}

export interface FatiaDaIdentidade {
  estilo: string
  semanas: number
  /** 0-100 — o quanto daquela carreira foi jogado assim. */
  percentual: number
}

export const ROTULO_DO_ESTILO_DE_JOGO: Record<string, string> = {
  posse_bola: "Posse de bola",
  contra_ataque: "Contra-ataque",
  pressao_alta: "Pressão alta",
  jogo_direto: "Jogo direto",
  jogo_posicional: "Jogo posicional",
}

/**
 * A IDENTIDADE TÁTICA REAL, do mais usado ao menos usado.
 *
 * É o painel que o pedido descrevia ("Posse 82 · Pressão 76 · Contra-ataque 48")
 * e a resposta à pergunta que o jogo não sabia responder: afinal, que técnico
 * você virou?
 */
export function identidadeTatica(
  progresso?: Partial<ProgressoDoTreinador26> | null,
): FatiaDaIdentidade[] {
  const estilos = progresso?.estilos ?? {}
  const total = Object.values(estilos).reduce((soma, n) => soma + n, 0)
  if (total <= 0) return []
  return Object.entries(estilos)
    .map(([estilo, semanas]) => ({
      estilo,
      semanas,
      percentual: Math.round((semanas / total) * 100),
    }))
    .sort((a, b) => b.semanas - a.semanas)
}

/** Uma linha só: "Técnico de contra-ataque" — ou nada, se ainda não deu para saber. */
export function resumoDaIdentidade(fatias: FatiaDaIdentidade[]): string | null {
  const principal = fatias[0]
  // Menos de oito semanas não é identidade, é começo de temporada.
  if (!principal || principal.semanas < 8) return null
  const rotulo = ROTULO_DO_ESTILO_DE_JOGO[principal.estilo] ?? principal.estilo
  if (principal.percentual >= 70) return `Técnico de ${rotulo.toLowerCase()}`
  const segunda = fatias[1]
  if (!segunda) return `Técnico de ${rotulo.toLowerCase()}`
  const outro = ROTULO_DO_ESTILO_DE_JOGO[segunda.estilo] ?? segunda.estilo
  return `Alterna ${rotulo.toLowerCase()} e ${outro.toLowerCase()}`
}
