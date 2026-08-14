/**
 * FORCAS TATICAS — traduz as escolhas da tela de Taticas em forca de ataque,
 * meio e defesa.
 *
 * ## Por que este arquivo existe
 *
 * A tela `app/taticas/page.tsx` oferece 15 controles. Ate aqui, TRES tinham
 * efeito na partida:
 *
 *   - `playingStyle`  — virava forca (calculo solto dentro da tela ao vivo)
 *   - `mentality`     — vai ao motor como `homeMentality`/`awayMentality`
 *   - `offsideTrap`   — o motor GERA impedimentos a partir dele
 *
 * Os outros doze eram enfeite: o jogador escolhia e nada mudava no placar.
 *
 * ## As duas travas deste modulo
 *
 * 1. ⚠️ **NAO mexer em `mentality` nem em `offsideTrap`.** Os dois ja tem
 *    caminho proprio ate o motor. Traduzi-los aqui tambem seria aplica-los
 *    DUAS vezes — o erro classico de "duas escalas para a mesma grandeza", que
 *    neste projeto ja custou o leilao, o caixa dos clubes e o Championship.
 *
 * 2. ⚠️ **Toda escolha e TROCA, nunca bonus.** Se cada botao somasse, o jogador
 *    ligaria os doze e viraria um time impossivel — o irmao tatico do glitch de
 *    dinheiro infinito. Por isso a soma dos deltas de cada campo fica em zero
 *    (ou negativa nos extremos) e existe um teto duro no fim.
 *
 * ## O que este modulo NAO resolve
 *
 * O mapeamento e GROSSO: cabe tudo em tres numeros porque e isso que o motor
 * aceita hoje. "Cruzamento alto" e "bola nas costas da zaga" viram a mesma
 * moeda, quando deveriam mudar o TIPO de chance gerada. A versao fina exige
 * evento novo no `match-engine`, e nao esta feita.
 */
import type {
  BuildUpStyle, ChanceCreation, CrossingStyle, DefensiveLine, MarkingStyle,
  PassingStyle, PlayingStyle, PressingIntensity, TeamTactics, TempoStyle,
} from "./game-engine"

export interface ForcasTaticas {
  attack: number
  defense: number
  midfield: number
  /**
   * Coerencia do plano, de -1 (contradicao) a +1 (plano redondo). Existe para a
   * tela poder explicar ao jogador POR QUE o time nao rende, em vez de deixar o
   * numero cair sem motivo visivel.
   */
  coerencia: number
  /** Frases prontas do que esta brigando entre si. Vazio = plano coerente. */
  conflitos: string[]
  /** Custo de reorganizar as duas estruturas; chega ao motor como desgaste. */
  transitionLoad: number
  /** Intensidade real do plano, usada pelo desgaste e pela pressão. */
  pressingLoad: number
}

type Delta = { attack?: number; defense?: number; midfield?: number }

/**
 * Teto duro do efeito somado. A calibracao do motor comprime forca em
 * probabilidade (ver a memoria do harness de 20 mil jogos): passar disto
 * distorce o placar mais do que qualquer escolha de elenco, e tatica nao pode
 * pesar mais que jogador.
 */
export const TETO_TATICO = 8

// ─── playingStyle ────────────────────────────────────────────────────────────
// Numeros HERDADOS do calculo que vivia solto em app/partida/ao-vivo/page.tsx.
// Ficam identicos de proposito: mudar aqui e recalibrar o jogo inteiro, e isso
// e outra tarefa. Este modulo so muda de LUGAR o que ja existia.
const DE_ESTILO: Record<PlayingStyle, Delta> = {
  posse_bola: { midfield: 5, attack: 1 },
  contra_ataque: { attack: 4, defense: 3, midfield: -2 },
  pressao_alta: { attack: 3, midfield: 3, defense: -1 },
  jogo_direto: { attack: 2, midfield: -1 },
  jogo_posicional: { attack: 1, midfield: 2 },
}

// ─── Com a bola ──────────────────────────────────────────────────────────────
const DE_PASSE: Record<PassingStyle, Delta> = {
  curto: { midfield: 2, attack: -1 },   // segura a bola, demora a chegar
  misto: {},
  direto: { attack: 2, midfield: -2 },  // chega rapido, entrega o meio
}

const DE_TEMPO: Record<TempoStyle, Delta> = {
  lento: { midfield: 2, attack: -1 },
  normal: {},
  rapido: { attack: 2, defense: -1 },   // acelera e se expoe
}

const DE_SAIDA: Record<BuildUpStyle, Delta> = {
  curto: { midfield: 2, defense: -1 },  // sair jogando perto da propria area custa caro
  misto: {},
  longo: { attack: 1, midfield: -2 },   // pula o meio-campo
}

const DE_CRIACAO: Record<ChanceCreation, Delta> = {
  largura: { attack: 2, midfield: -1 }, // estica o time
  centro: { midfield: 2, attack: -1 },  // aperta o miolo
  misto: {},
}

const DE_CRUZAMENTO: Record<CrossingStyle, Delta> = {
  baixo: { attack: 1, midfield: -1 },
  misto: {},
  alto: { attack: 1, midfield: -1 },
}

// ─── Sem a bola ──────────────────────────────────────────────────────────────
const DE_LINHA: Record<DefensiveLine, Delta> = {
  baixa: { defense: 2, attack: -1 },      // fecha atras, longe do gol adversario
  media: {},
  alta: { midfield: 2, defense: -2 },     // ganha campo, deixa as costas
}

const DE_PRESSAO: Record<PressingIntensity, Delta> = {
  baixa: { defense: 1, midfield: -1 },
  media: {},
  alta: { midfield: 2, defense: -1 },
  muito_alta: { midfield: 3, defense: -3 }, // cansa e abre buraco
}

const DE_MARCACAO: Record<MarkingStyle, Delta> = {
  zonal: { defense: 1, midfield: -1 },
  individual: { defense: 2, midfield: -2 }, // segue o homem e perde a forma
  misto: {},
}

/** Botoes de liga/desliga. Todos com contrapartida. */
const DE_CHAVES: Record<string, Delta> = {
  shootFromDistance: { attack: 1, midfield: -1 },
  playThroughBalls: { attack: 2, midfield: -2 },
  counterPress: { midfield: 2, defense: -2 },
  counterAttack: { attack: 2, midfield: -2 },
  holdPosition: { defense: 2, attack: -2 },
}

const DE_FORMA_COM_BOLA: Record<string, Delta> = {
  "2-3-5": { attack: 4, midfield: 1, defense: -4 },
  "3-2-5": { attack: 3, midfield: 1, defense: -2 },
  "3-4-3": { attack: 2, midfield: 1, defense: -1 },
  "4-2-3-1": { attack: 1, midfield: 1 },
  "4-3-3": { attack: 1, midfield: 2, defense: -1 },
  "4-4-2": { attack: 1, defense: 1, midfield: -1 },
}

const DE_FORMA_SEM_BOLA: Record<string, Delta> = {
  "4-4-2": { defense: 2, midfield: 1, attack: -1 },
  "4-1-4-1": { defense: 2, midfield: 2, attack: -2 },
  "4-2-3-1": { defense: 1, midfield: 1 },
  "5-3-2": { defense: 3, attack: -2 },
  "5-4-1": { defense: 4, midfield: 1, attack: -4 },
  "3-4-3": { midfield: 1, defense: -1 },
}

function linhas(formation?: string): number[] {
  return String(formation ?? "").split("-").map(Number).filter(Number.isFinite)
}

function cargaDeTransicao(comBola?: string, semBola?: string): number {
  const a = linhas(comBola), b = linhas(semBola)
  const tamanho = Math.max(a.length, b.length)
  let movement = 0
  for (let i = 0; i < tamanho; i++) movement += Math.abs((a[i] ?? 0) - (b[i] ?? 0))
  return Math.min(1, movement / 10)
}

function somar(alvo: ForcasTaticas, d: Delta): void {
  alvo.attack += d.attack ?? 0
  alvo.defense += d.defense ?? 0
  alvo.midfield += d.midfield ?? 0
}

/**
 * Contradicoes que um treinador de verdade nao comete. Sao o que transforma a
 * tela de "escolher os melhores botoes" em "montar um plano que se sustenta":
 * sem isto, a escolha otima seria sempre a mesma lista, e nao haveria decisao.
 */
function acharConflitos(t: TeamTactics): string[] {
  const c: string[] = []
  if (t.pressingIntensity === "muito_alta" && t.defensiveLine === "baixa")
    c.push("Pressao muito alta com linha baixa: o time pressiona longe da propria defesa e abre o meio.")
  if (t.pressingIntensity === "baixa" && t.counterPress)
    c.push("Pressao apos perda com marcacao fraca: ninguem chega para fazer a pressao acontecer.")
  if (t.buildUp === "longo" && t.passingStyle === "curto")
    c.push("Saida longa com passe curto: a bola sai da defesa sem ninguem para receber perto.")
  if (t.tempo === "lento" && t.counterAttack)
    c.push("Contra-ataque com tempo lento: o time ganha a bola e demora a sair.")
  if (t.chanceCreation === "centro" && t.crossingStyle === "alto")
    c.push("Criacao pelo centro com cruzamento alto: a bola vai para onde o time nao esta.")
  if (t.defensiveLine === "alta" && t.holdPosition)
    c.push("Linha alta com time recuado: as duas ordens se anulam.")
  return c
}

/** Combinacoes que se reforcam. Poucas, e de propósito: premio raro vale mais. */
function acharSinergias(t: TeamTactics): number {
  let n = 0
  if (t.playingStyle === "contra_ataque" && t.counterAttack && t.tempo === "rapido") n++
  if (t.playingStyle === "posse_bola" && t.passingStyle === "curto" && t.buildUp === "curto") n++
  if (t.playingStyle === "pressao_alta" && t.counterPress && t.pressingIntensity !== "baixa") n++
  if (t.chanceCreation === "largura" && t.crossingStyle === "alto") n++
  return n
}

/**
 * O calculo completo. Recebe a tatica salva e devolve o que somar as forcas do
 * XI titular.
 */
export function forcasDaTatica(
  t: TeamTactics,
  /**
   * `coerenciaTatica` de `lib/efeito-do-treinador.ts` — o atributo TÁTICA do
   * técnico. Neutro em 1, que reproduz o comportamento anterior exatamente.
   *
   * ⚠️ NÃO some o técnico às forças brutas. Ele mexe só na COERÊNCIA, e por um
   * motivo de modelo: somar daria ao técnico um bônus de placar independente do
   * plano — o mesmo defeito de contar a qualidade duas vezes que
   * `forcas-individuais` documenta. Mexendo na coerência, o técnico bom extrai
   * mais DO PLANO QUE VOCÊ MONTOU, e com plano neutro não extrai nada.
   */
  coerenciaDoTecnico = 1,
): ForcasTaticas {
  const f: ForcasTaticas = { attack: 0, defense: 0, midfield: 0, coerencia: 0, conflitos: [], transitionLoad: 0, pressingLoad: 0 }

  somar(f, DE_ESTILO[t.playingStyle] ?? {})
  somar(f, DE_PASSE[t.passingStyle] ?? {})
  somar(f, DE_TEMPO[t.tempo] ?? {})
  somar(f, DE_SAIDA[t.buildUp] ?? {})
  somar(f, DE_CRIACAO[t.chanceCreation] ?? {})
  somar(f, DE_CRUZAMENTO[t.crossingStyle] ?? {})
  somar(f, DE_LINHA[t.defensiveLine] ?? {})
  somar(f, DE_PRESSAO[t.pressingIntensity] ?? {})
  somar(f, DE_MARCACAO[t.markingStyle] ?? {})
  somar(f, DE_FORMA_COM_BOLA[t.inPossessionFormation ?? ""] ?? {})
  somar(f, DE_FORMA_SEM_BOLA[t.outOfPossessionFormation ?? ""] ?? {})

  if (t.shootFromDistance) somar(f, DE_CHAVES.shootFromDistance)
  if (t.playThroughBalls) somar(f, DE_CHAVES.playThroughBalls)
  if (t.counterPress) somar(f, DE_CHAVES.counterPress)
  if (t.counterAttack) somar(f, DE_CHAVES.counterAttack)
  if (t.holdPosition) somar(f, DE_CHAVES.holdPosition)

  const conflitos = acharConflitos(t)
  const sinergias = acharSinergias(t)
  // Conflito pesa mais que sinergia: e mais facil estragar um plano do que
  // acerta-lo, e assim o jogador sente a incoerencia antes do premio.
  const bruto = sinergias * 0.34 - conflitos.length * 0.5
  // ⚠️ O TÉCNICO MULTIPLICA O POSITIVO E DIVIDE O NEGATIVO — não multiplica os
  // dois. Multiplicar direto faria o técnico bom deixar o plano contraditório
  // AINDA PIOR, que é o oposto do que ele existe para fazer: quem entende de
  // tática segura um plano confuso melhor do que quem não entende.
  const comTecnico = bruto >= 0
    ? bruto * coerenciaDoTecnico
    : bruto / Math.max(0.5, coerenciaDoTecnico)
  f.coerencia = Math.max(-1, Math.min(1, comTecnico))
  f.conflitos = conflitos
  f.transitionLoad = cargaDeTransicao(t.inPossessionFormation, t.outOfPossessionFormation)
  f.pressingLoad = t.pressingIntensity === "muito_alta" ? 1
    : t.pressingIntensity === "alta" ? 0.72
      : t.pressingIntensity === "media" ? 0.42 : 0.18

  // A coerencia multiplica o que o plano ja rende: plano confuso entrega menos
  // do que a soma das partes, plano redondo entrega um pouco mais.
  const escala = 1 + f.coerencia * 0.25
  f.attack = Math.round(f.attack * escala)
  f.defense = Math.round(f.defense * escala)
  f.midfield = Math.round(f.midfield * escala)

  // Teto duro, aplicado por setor E no total.
  const limitar = (v: number) => Math.max(-TETO_TATICO, Math.min(TETO_TATICO, v))
  f.attack = limitar(f.attack)
  f.defense = limitar(f.defense)
  f.midfield = limitar(f.midfield)

  return f
}

/** Rotulo curto do plano, para a tela dizer em uma linha o que foi montado. */
export function resumoDoPlano(f: ForcasTaticas): string {
  if (f.conflitos.length > 0) return "Plano com contradicoes"
  if (f.coerencia >= 0.6) return "Plano muito coerente"
  if (f.coerencia > 0) return "Plano coerente"
  return "Plano neutro"
}
