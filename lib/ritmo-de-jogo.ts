// RITMO DE JOGO — o reserva encostado deixa de entrar a 100%.
//
// O buraco, medido na 1.0.386: **nada no jogo cobrava a falta de minutos.** A
// `form` só se move dentro de `processarDesempenhoPartida`, que roda por atleta
// que PARTICIPOU; quem ficou no banco mantém a forma congelada no valor em que
// estava. Um centroavante três meses sem jogar entrava na quarta-feira com a
// mesma força de quem jogou as doze partidas anteriores — e a `energia` até o
// premiava, porque descansar recupera energia.
//
// ⚠️ E O JOGO JÁ PROMETIA O CONCEITO EM VOZ ALTA. Em `lib/conversa-atleta.ts` o
// atleta diz, com todas as letras: *"O que eu preciso é de ritmo de jogo, e isso
// o senhor é quem me dá."* A fala existia, a queixa existia, a decisão de
// escalação existia — só não havia mecânica atrás. É o padrão de
// [[ultrafoot-sistemas-implementados-porem-desligados]] pelo avesso: em vez de
// motor sem tela, uma promessa de tela sem motor.
//
// ⚠️ NÃO CONFUNDIR COM ENERGIA NEM COM FORMA — as três medem coisas diferentes,
// e é por isso que somar esta não conta nada duas vezes:
//
//   • `energia` / `fadigaCronica` (treino-e-entrosamento): quanto ele AGUENTA.
//     Sobe descansando.
//   • `form`: como ele VEM JOGANDO. Só se move para quem jogou.
//   • `ritmo` (aqui): há quanto tempo ele NÃO joga. Só cai para quem não jogou.
//
// O reserva tem energia cheia, forma congelada e ritmo no chão — que é
// exatamente o estado real de quem passou dois meses no banco.

/**
 * O valor neutro: nem penaliza nem premia.
 *
 * ⚠️ É O QUE SAVE ANTIGO E REFORÇO RECÉM-CHEGADO RECEBEM, e a escolha é
 * deliberada. Save anterior a esta versão não tem o campo; tratá-lo como 0 daria
 * −6 de força a um elenco inteiro na primeira partida depois de atualizar o
 * jogo — punição por atualizar, o mesmo erro que o retrato de minutos já
 * documenta em `game-engine`. Neutro significa "o jogo se comporta como antes
 * até a primeira virada de semana medir de verdade".
 */
export const RITMO_INICIAL = 85

/**
 * Acima disto não há penalidade nenhuma.
 *
 * ⚠️ ERA 80 E O PORTÃO REPROVOU NA PRIMEIRA EXECUÇÃO: partindo do neutro (85),
 * UMA semana sem jogar já derrubava para 78 e cobrava. Poupar um titular por uma
 * rodada é gestão normal — cobrar por isso transformaria a mecânica num imposto
 * sobre revezar, que é o oposto do que ela existe para modelar.
 *
 * Em 70 a conta fica com a forma certa: **uma ou duas rodadas de descanso saem
 * de graça** (85 → 78 → 71), a penalidade começa por volta da terceira semana e
 * só fica pesada perto dos dois meses.
 *
 * E o custo de poupar não é zero: quem estava afiado perde o `+1` na hora. A
 * decisão tem preço sem ter punição.
 */
export const PISO_SEM_EFEITO = 70

/** A partir daqui o atleta está afiado e ganha o bônus. */
export const RITMO_AFIADO = 95

/** Teto da penalidade, em pontos de força. */
export const PENALIDADE_MAXIMA = 6

/** Bônus de quem está em sequência de jogos. */
export const BONUS_AFIADO = 1

/**
 * O efeito na força, em pontos.
 *
 * ⚠️ O MECANISMO TEM DE TER OS DOIS SENTIDOS, e aqui a razão é mais forte que a
 * lição de simetria da 1.0.383. Neste jogo o adversário da CPU é medido pelo
 * PRESTÍGIO do clube, não por atletas (ver `lib/forca-do-plantel.ts`): qualquer
 * efeito de nível de atleta só pode atingir o lado humano. Um ritmo que apenas
 * penalizasse seria um imposto silencioso sobre quem atualizou o jogo, e
 * deslocaria a calibragem medida da 1.0.377 para baixo em toda partida.
 *
 * Com o bônus, o elenco que joga sua base regularmente fica em `+1` e o que
 * revezou demais paga — o custo é de uma DECISÃO do técnico, não da versão.
 */
export function efeitoDoRitmo(ritmo: number): number {
  if (ritmo >= RITMO_AFIADO) return BONUS_AFIADO
  if (ritmo >= PISO_SEM_EFEITO) return 0
  return -Math.min(PENALIDADE_MAXIMA, (PISO_SEM_EFEITO - ritmo) * 0.1)
}

/** Ganho de ritmo conforme os minutos oficiais da semana. */
function ganhoPorMinutos(minutos: number): number {
  if (minutos >= 60) return 12
  if (minutos >= 20) return 6
  if (minutos > 0) return 2
  return 0
}

/**
 * Quanto o ritmo cai numa semana sem jogar.
 *
 * ⚠️ NÃO DEPENDE DE ESTAR LESIONADO, e isso é de propósito. O atleta que volta
 * de dois meses de departamento médico chega sem ritmo pelo caminho natural —
 * ele não jogou —, sem precisar de uma regra própria para lesão. É o mesmo
 * motivo por que `historico-de-lesoes.acabouDeVoltar` fala em janela de
 * fragilidade e não em penalidade de força: cada módulo cobra uma coisa só.
 */
const QUEDA_SEM_JOGAR = 7

/**
 * O ritmo depois de uma semana.
 *
 * `atual` ausente = `RITMO_INICIAL`, pelo mesmo motivo documentado lá em cima.
 */
export function ritmoDaSemana(atual: number | undefined, minutosJogados: number): number {
  const base = atual ?? RITMO_INICIAL
  const delta = minutosJogados > 0 ? ganhoPorMinutos(minutosJogados) : -QUEDA_SEM_JOGAR
  return Math.max(0, Math.min(100, Math.round(base + delta)))
}

/** Rótulo curto para a tela — o técnico decide com isto, não com o número cru. */
export function rotuloDoRitmo(ritmo: number | undefined): string {
  const r = ritmo ?? RITMO_INICIAL
  if (r >= RITMO_AFIADO) return "Afiado"
  if (r >= PISO_SEM_EFEITO) return "Em ritmo"
  if (r >= 50) return "Perdendo ritmo"
  if (r >= 25) return "Sem ritmo"
  return "Parado há meses"
}

/**
 * O efeito médio de um grupo — é assim que ele chega ao campo.
 *
 * Média e não soma: onze atletas afiados valem `+1`, não `+11`. O número entra
 * no `mod` de `forcasDoPlantel`, que é o canal já existente para "condição do
 * elenco" e é somado por igual aos três setores.
 */
export function efeitoDoRitmoNoGrupo(ritmos: readonly (number | undefined)[]): number {
  if (ritmos.length === 0) return 0
  const soma = ritmos.reduce<number>((total, r) => total + efeitoDoRitmo(r ?? RITMO_INICIAL), 0)
  return soma / ritmos.length
}
