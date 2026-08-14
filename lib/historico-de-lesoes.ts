// HISTÓRICO DE LESÕES E RECORRÊNCIA.
//
// O que faltava
// ─────────────
// O jogo sorteia quem se machuca pesando o PROFISSIONALISMO do atleta e nada
// mais. Isso produz lesões, mas não produz **histórias**: o zagueiro que passou
// a temporada inteira inteiro e o que voltou de três lesões seguidas na coxa
// entram na próxima partida com exatamente o mesmo risco, e a lesão vira sorteio
// sem memória. No FM, um atleta com passado de lesão é outro ativo — vale menos,
// exige rodízio, e voltar cedo demais custa caro.
//
// ⚠️ E o `propensaoALesao` JÁ EXISTIA e não era usado aqui. Ele nasce em
// `lib/modelo-de-jogador.ts` (atributo oculto, derivado do id) e alimenta o
// motor de partida por `pesoDeLesao` — mas o sorteio semanal de lesão o
// ignorava. Metade deste módulo é só ligar o que já estava pronto: ver
// [[ultrafoot-sistemas-implementados-porem-desligados]].
//
// As duas regras, e por que são estas
// ───────────────────────────────────
//  1. JANELA DE FRAGILIDADE. Quem acabou de voltar é mais frágil por algumas
//     semanas. É o que dá sentido a poupar o atleta recém-recuperado — sem isso,
//     escalá-lo na volta não tem custo nenhum e o rodízio vira enfeite.
//  2. RECORRÊNCIA POR TIPO. Lesão repetida NO MESMO tipo pesa mais que duas
//     lesões diferentes. Um atleta com três problemas musculares tem um problema
//     muscular; um com uma torção, uma pancada e uma virose teve azar.
//
// Este arquivo é PURO: sem React, sem store, sem save.

/** Uma lesão que já aconteceu. Fica no próprio atleta, não numa lista à parte. */
export interface LesaoRegistrada {
  tipo: string
  severidade: "leve" | "media" | "grave"
  /** Semana absoluta em que começou. */
  semana: number
  /** Quantas semanas durou. */
  duracao: number
}

/** Quantas semanas após a volta o atleta segue mais frágil. */
export const SEMANAS_DE_FRAGILIDADE = 4

/** Teto do multiplicador: nem o mais quebrado vira um vidro. */
const TETO = 2.6

/**
 * Peso da severidade na memória do corpo. Uma lesão grave marca mais e por mais
 * tempo do que três leves — por isso não é contagem simples.
 */
const PESO_DA_SEVERIDADE: Record<LesaoRegistrada["severidade"], number> = {
  leve: 0.06,
  media: 0.14,
  grave: 0.30,
}

/**
 * Acrescenta uma lesão ao histórico do atleta, mantendo-o curto.
 *
 * ⚠️ O corte em 12 não é economia de memória: é a regra. Lesão de cinco
 * temporadas atrás não deve pesar no risco de hoje, e sem corte o multiplicador
 * só cresceria ao longo de uma carreira longa — todo veterano acabaria de vidro.
 */
export function registrarLesao(
  historico: LesaoRegistrada[] | undefined,
  lesao: LesaoRegistrada,
): LesaoRegistrada[] {
  return [...(historico ?? []), lesao].slice(-12)
}

/**
 * O multiplicador de risco deste atleta, dado o passado dele.
 *
 * Devolve 1 para quem nunca se machucou — ou seja, o comportamento antigo
 * continua valendo para quem não tem histórico, e o sistema não muda o
 * equilíbrio de um save recém-começado.
 *
 * `janelaRecente` existe para o chamador poder medir "os últimos N semanas" sem
 * este módulo precisar saber o que é uma temporada.
 */
export function riscoPorHistorico(
  historico: LesaoRegistrada[] | undefined,
  semanaAtual: number,
  janelaRecente = 52,
): number {
  if (!historico?.length) return 1

  let risco = 1

  // Lesões dentro da janela pesam; as antigas ficam para trás.
  const recentes = historico.filter(l => semanaAtual - l.semana <= janelaRecente)
  for (const l of recentes) risco += PESO_DA_SEVERIDADE[l.severidade]

  // RECORRÊNCIA POR TIPO: o segundo problema do mesmo tipo pesa o dobro do
  // primeiro; o terceiro, o triplo. É o que separa "azar" de "fraqueza".
  const porTipo = new Map<string, number>()
  for (const l of recentes) porTipo.set(l.tipo, (porTipo.get(l.tipo) ?? 0) + 1)
  for (const [, vezes] of porTipo) {
    if (vezes > 1) risco += (vezes - 1) * 0.18
  }

  // JANELA DE FRAGILIDADE: acabou de voltar, ainda não está inteiro.
  const ultima = recentes.at(-1)
  if (ultima) {
    const semanasDesdeAVolta = semanaAtual - (ultima.semana + ultima.duracao)
    if (semanasDesdeAVolta >= 0 && semanasDesdeAVolta < SEMANAS_DE_FRAGILIDADE) {
      // Decai com o tempo: no primeiro jogo de volta pesa muito mais do que na
      // quarta semana.
      const quanto = 1 - semanasDesdeAVolta / SEMANAS_DE_FRAGILIDADE
      risco += 0.55 * quanto
    }
  }

  return Math.min(TETO, risco)
}

/** Está dentro da janela de fragilidade agora? Serve para avisar na tela. */
export function acabouDeVoltar(
  historico: LesaoRegistrada[] | undefined,
  semanaAtual: number,
): boolean {
  const ultima = historico?.at(-1)
  if (!ultima) return false
  const desde = semanaAtual - (ultima.semana + ultima.duracao)
  return desde >= 0 && desde < SEMANAS_DE_FRAGILIDADE
}

/**
 * Rótulo curto do passado do atleta, para a tela.
 *
 * Diz o que o técnico precisa decidir com — não o número cru, que não significa
 * nada para quem joga.
 */
export function rotuloDoHistorico(
  historico: LesaoRegistrada[] | undefined,
  semanaAtual: number,
): string | null {
  if (!historico?.length) return null
  if (acabouDeVoltar(historico, semanaAtual)) return "Recém-recuperado"
  const risco = riscoPorHistorico(historico, semanaAtual)
  if (risco >= 1.8) return "Histórico de lesões"
  if (risco >= 1.3) return "Já se machucou"
  return null
}
