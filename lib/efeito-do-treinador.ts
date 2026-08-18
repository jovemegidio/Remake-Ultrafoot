/**
 * EFEITO DO TREINADOR — o que o técnico É passa a mudar o que acontece.
 *
 * ## O que existia (e por que isto precisou existir)
 *
 * `lib/manager-profile-26.ts` monta um perfil completo na criação da carreira:
 * nível como jogador, área anterior, licença, até três estilos, até duas
 * personalidades e **dez atributos** (tática, motivação, desenvolvimento,
 * disciplina, negociação, recrutamento, preparo físico, análise, comunicação e
 * reputação). A tela do Treinador desenha os dez em quadradinhos.
 *
 * Nenhum deles tinha um único consumidor. `efeitosIniciaisPerfil26` — a função
 * que traduzia o perfil em XP, confiança da diretoria e moral inicial — não era
 * chamada em lugar nenhum a não ser num script de teste. Escolher "ex-craque com
 * licença Pro" ou "recreativo sem licença" dava exatamente o mesmo jogo.
 *
 * O mesmo valia para as cinco HABILIDADES do técnico (`COACH_SKILL_CATALOG` em
 * save-system): custavam XP, desbloqueavam, iam para o legado da carreira — e
 * nenhum motor lia uma linha delas.
 *
 * ## As três travas do modelo
 *
 * 1. ⚠️ **50 é o neutro.** Todo efeito é `1 + ((atributo - 50)/50) × amplitude`.
 *    Um atributo 50 devolve exatamente 1 (ou 0, nos que são soma), então um save
 *    sem perfil, um save antigo e um técnico mediano jogam o jogo JÁ CALIBRADO —
 *    ver [[ultrafoot-calibracao-do-motor]]. Nada aqui recalibra nada por acidente.
 * 2. ⚠️ **Amplitudes pequenas.** O maior efeito é ±35% (ritmo de análise, que não
 *    decide partida) e os que tocam no placar ficam em ±20%. O técnico inclina a
 *    balança; quem joga é o elenco.
 * 3. ⚠️ **Um atributo, um ponto de consumo.** Espalhar o mesmo atributo por três
 *    fórmulas o aplicaria em triplo — o defeito que `forcas-taticas` documenta
 *    para `mentality`/`offsideTrap`. Cada campo abaixo diz quem o lê.
 *
 * ## Como o motor alcança um dado que mora no save
 *
 * Pelo mesmo RETRATO PUBLICADO que o Modo Desafios usa: `save-system` chama
 * `sincronizarTreinador()` a cada carga e a cada gravação, e o motor (que é um
 * store separado) lê `efeitosDoTreinador()` sem importar o save. Aqui só entram
 * TIPOS do save-system, e `import type` é apagado na compilação — não há ciclo.
 * Ver [[ultrafoot-desafios]].
 */

import type { PerfilTreinador26 } from "@/lib/manager-profile-26"
import type { CoachSkill, CoachSkillId } from "@/lib/save-system"
import { perfilComProgresso, type ProgressoDoTreinador26 } from "@/lib/evolucao-do-treinador"
import { rendimentoDeTreinoDaModalidade } from "@/lib/tom-da-modalidade"
import { modalidadeDoSave } from "@/lib/modalidade-de-carreira"

export interface EfeitosDoTreinador {
  /** ×, sobre o rendimento do treino individual. LÊ: `aplicarSemanaDeTreino`. */
  rendimentoDeTreino: number
  /** + pontos de energia na recuperação semanal. LÊ: `aplicarSemanaDeTreino`. */
  recuperacaoSemanal: number
  /** ×, sobre o risco de lesão de treino. LÊ: `aplicarSemanaDeTreino`. */
  riscoDeLesao: number
  /** ×, sobre a coerência do plano tático. LÊ: `forcasDaTatica`. */
  coerenciaTatica: number
  /**
   * ×, sobre o bônus da preparação para o adversário da semana.
   * LÊ: `bonusPreparacaoAplicavel282`.
   *
   * A análise em si (`analyzeOpponent`) é instantânea e completa desde sempre —
   * não havia ritmo para acelerar. O que existe para o técnico analista mexer é
   * quanto daquele estudo VIRA VANTAGEM em campo, que é este número.
   */
  preparoDeJogo: number
  /** ×, sobre o salário exigido na renovação. LÊ: `computeRenewalDemands`. */
  custoDeRenovacao: number
  /** + pontos na moral do elenco por semana. LÊ: `updateSquadMorale`. */
  moralSemanal: number
  /** ×, sobre o impacto (bom ou ruim) de uma coletiva. LÊ: `calcularEfeitoColetiva`. */
  impactoDaColetiva: number
  /** ×, sobre o peso do evento NEGATIVO na moral. LÊ: `updateSquadMorale`. */
  impactoDeEventoRuim: number
  /** + pontos na qualidade de avaliação de um jovem (CPE). LÊ: `qualidadeDeAvaliacao`. */
  precisaoDeAvaliacao: number
  /** + pontos de defesa nos últimos 10 minutos. LÊ: `app/partida/ao-vivo`. */
  defesaNoFinal: number
  /** + pontos de reputação do técnico na fila de propostas. LÊ: `coach-market`. */
  atracaoDoTecnico: number
}

/** O jogo já calibrado: é isto que vale sem perfil, em save antigo e no teste. */
export const TREINADOR_NEUTRO: EfeitosDoTreinador = {
  rendimentoDeTreino: 1,
  recuperacaoSemanal: 0,
  riscoDeLesao: 1,
  coerenciaTatica: 1,
  preparoDeJogo: 1,
  custoDeRenovacao: 1,
  moralSemanal: 0,
  impactoDaColetiva: 1,
  impactoDeEventoRuim: 1,
  precisaoDeAvaliacao: 0,
  defesaNoFinal: 0,
  atracaoDoTecnico: 0,
}

/** `1 + ((valor - 50)/50) × amplitude`. Atributo 50 devolve 1, sempre. */
function fator(valor: number, amplitude: number): number {
  const normalizado = (Math.max(1, Math.min(100, valor)) - 50) / 50
  return Math.round((1 + normalizado * amplitude) * 1000) / 1000
}

/** Igual ao `fator`, mas para o que fica MELHOR quando o atributo sobe e o número desce. */
function fatorInverso(valor: number, amplitude: number): number {
  const normalizado = (Math.max(1, Math.min(100, valor)) - 50) / 50
  return Math.round((1 - normalizado * amplitude) * 1000) / 1000
}

/** `((valor - 50)/50) × alcance`. Atributo 50 devolve 0, sempre. */
function soma(valor: number, alcance: number): number {
  const normalizado = (Math.max(1, Math.min(100, valor)) - 50) / 50
  return Math.round(normalizado * alcance * 100) / 100
}

/**
 * O QUE CADA HABILIDADE FAZ — a tradução que faltava.
 *
 * Os textos do catálogo (`COACH_SKILL_CATALOG`) foram escritos antes de existir
 * qualquer efeito. Aqui eles viram número, no ponto que já existe no jogo:
 *
 * | habilidade            | onde encosta                                  |
 * |-----------------------|-----------------------------------------------|
 * | fechamento_casinha    | defesa nos últimos 10 min (partida ao vivo)   |
 * | motivacao_vestiario   | moral semanal do elenco                       |
 * | gestao_crise          | peso do evento negativo na moral              |
 * | olho_clinico          | qualidade da avaliação de jovens (CPE)        |
 * | fidelizador           | salário exigido na renovação                  |
 */
function aplicarHabilidades(base: EfeitosDoTreinador, desbloqueadas: Set<string>): EfeitosDoTreinador {
  const e = { ...base }
  if (desbloqueadas.has("fechamento_casinha")) e.defesaNoFinal += 3
  if (desbloqueadas.has("motivacao_vestiario")) e.moralSemanal += 1.5
  if (desbloqueadas.has("gestao_crise")) e.impactoDeEventoRuim *= 0.7
  if (desbloqueadas.has("olho_clinico")) e.precisaoDeAvaliacao += 10
  if (desbloqueadas.has("fidelizador")) e.custoDeRenovacao *= 0.9
  e.impactoDeEventoRuim = Math.round(e.impactoDeEventoRuim * 1000) / 1000
  e.custoDeRenovacao = Math.round(e.custoDeRenovacao * 1000) / 1000
  return e
}

/**
 * Traduz perfil + habilidades nos efeitos que os motores leem.
 *
 * Puro: mesma entrada, mesma saída, sem store e sem `Math.random`. É esta função
 * que o teste cobre — o retrato abaixo é só o encanamento.
 */
export function calcularEfeitosDoTreinador(
  perfil?: PerfilTreinador26 | null,
  habilidades?: readonly Pick<CoachSkill, "id" | "unlocked">[] | null,
): EfeitosDoTreinador {
  const desbloqueadas = new Set<string>(
    (habilidades ?? []).filter(h => h.unlocked).map(h => String(h.id)),
  )
  if (!perfil) return aplicarHabilidades(TREINADOR_NEUTRO, desbloqueadas)

  const a = perfil.atributos
  const base: EfeitosDoTreinador = {
    // Desenvolvimento: o técnico que forma faz o treino render mais. ±30%.
    rendimentoDeTreino: fator(a.desenvolvimento, 0.3),
    // Preparo físico: ±3 pontos de energia por semana e ±20% de risco de lesão.
    // São dois campos do MESMO atributo, mas do mesmo fenômeno (a carga de
    // trabalho) e no MESMO ponto de consumo — não é aplicá-lo duas vezes.
    recuperacaoSemanal: soma(a.preparoFisico, 3),
    riscoDeLesao: fatorInverso(a.preparoFisico, 0.2),
    // Tática: mexe na COERÊNCIA do plano, não na força bruta. O técnico bom
    // extrai mais do mesmo plano; o ruim confunde o time com as mesmas ordens.
    coerenciaTatica: fator(a.tatica, 0.2),
    // Análise: ±35% sobre o bônus de preparação — que já é no máximo 4 pontos
    // de força, então o teto real do analista é ~1,4 ponto. Ele é o técnico que
    // "leu o jogo antes", não um segundo elenco.
    preparoDeJogo: fator(a.analise, 0.35),
    // Negociação: ±12% no salário pedido na mesa de renovação.
    custoDeRenovacao: fatorInverso(a.negociacao, 0.12),
    // Motivação: ±2 pontos de moral por semana. Parece pouco por semana; são
    // ~80 pontos de pressão numa temporada inteira.
    moralSemanal: soma(a.motivacao, 2),
    // Comunicação: o quanto a fala do técnico pega — para o bem E para o mal.
    impactoDaColetiva: fator(a.comunicacao, 0.25),
    // Disciplina: o técnico firme absorve o baque do evento ruim no vestiário.
    impactoDeEventoRuim: fatorInverso(a.disciplina, 0.25),
    // Recrutamento: ±12 pontos na qualidade da avaliação de um jovem.
    precisaoDeAvaliacao: soma(a.recrutamento, 12),
    // Reputação vira defesa? Não: vira porta. Só a fila de propostas a lê.
    defesaNoFinal: 0,
    atracaoDoTecnico: soma(a.reputacao, 15),
  }
  return aplicarHabilidades(base, desbloqueadas)
}

// ─── Retrato publicado (o encanamento) ───────────────────────────────────────

let _retrato: EfeitosDoTreinador = TREINADOR_NEUTRO

/**
 * Publica os efeitos do técnico da carreira aberta. Chamado pelo `save-system` a
 * cada carga e a cada gravação — nunca por uma tela, para não depender de qual
 * tela está montada.
 */
export function sincronizarTreinador(
  state: {
    managerProfile26?: PerfilTreinador26 | null
    managerGrowth26?: ProgressoDoTreinador26 | null
    coachSkills?: CoachSkill[]
  } | null | undefined,
): void {
  // O perfil que vai ao motor é o EFETIVO: escolhas + o que a carreira somou.
  // Publicar o cru faria o técnico de doze temporadas treinar como no primeiro
  // dia — ver lib/evolucao-do-treinador.ts.
  const perfil = state?.managerProfile26
    ? perfilComProgresso(state.managerProfile26, state.managerGrowth26)
    : null
  const efeitos = calcularEfeitosDoTreinador(perfil, state?.coachSkills)
  // ⚠️ A MODALIDADE ENTRA AQUI, e nao no motor (1.0.347). O motor e um store
  // separado e nao pode importar o save; este retrato ja atravessa essa parede
  // a cada carga e a cada gravacao, entao dobrar o fator da modalidade nele faz
  // o treino do Sub-20 render mais SEM cano novo. Ver lib/tom-da-modalidade.
  const fatorDaModalidade = rendimentoDeTreinoDaModalidade(
    modalidadeDoSave(state as Parameters<typeof modalidadeDoSave>[0]),
  )
  _retrato = fatorDaModalidade === 1
    ? efeitos
    : { ...efeitos, rendimentoDeTreino: efeitos.rendimentoDeTreino * fatorDaModalidade }
}

/** Os efeitos do técnico agora. Neutro quando não há carreira aberta. */
export function efeitosDoTreinador(): EfeitosDoTreinador {
  return _retrato
}

/** Só para teste: devolve o retrato ao neutro. */
export function limparTreinador(): void {
  _retrato = TREINADOR_NEUTRO
}

/** Ids de habilidade que este módulo de fato implementa (o teste trava a lista). */
export const HABILIDADES_COM_EFEITO: CoachSkillId[] = [
  "fechamento_casinha",
  "motivacao_vestiario",
  "gestao_crise",
  "olho_clinico",
  "fidelizador",
]
