// PRELEÇÃO — falar com o elenco antes, no intervalo e no fim.
//
// O QUE FALTAVA. O jogo já tinha o grito de beira de campo
// (`lib/match-decisions.ts`: gritar, acalmar, pressionar…) e o evento semanal de
// vestiário (`lib/dressing-room-engine.ts`). Faltava o ritual do meio: o técnico
// falar com o grupo nos três momentos em que um técnico de verdade fala, e cada
// atleta reagir do jeito DELE. Sem isso, o vestiário só existia entre as
// partidas — dentro do jogo o elenco era um número.
//
// ⚠️ ESTE MÓDULO NÃO INVENTA FORÇA. Ele devolve deltas de MORAL, e a moral já
// tem caminho próprio até o campo:
//
//     app/partida/ao-vivo → userForces → mod = … + (moralMedia - 55) / 13
//
// Criar aqui um bônus de ataque/defesa contaria a mesma grandeza duas vezes — o
// erro que a tática já cometeu uma vez (ver o aviso de `lib/forcas-taticas.ts`
// sobre `mentality` e `offsideTrap`). O único caminho DIRETO é o do intervalo, e
// por um motivo estrutural explicado em `efeitoNoJogo`.
//
// ⚠️ SEM `Math.random`. A reação sai da persona do atleta, que é derivada do id
// (`lib/player-realism.ts`). Mesma preleção, mesmo elenco, mesmo resultado —
// senão recarregar a tela sortearia um vestiário novo, e o jogador aprenderia a
// recarregar em vez de a falar.
//
// Módulo PURO: sem store, sem React.

import { gerarPersona } from "@/lib/player-realism"

export type MomentoDaPrelecao = "pre" | "intervalo" | "fim"

/**
 * Os cinco tons. Deliberadamente NÃO são "bom" e "ruim": cada um acerta num
 * contexto e erra noutro, que é o que faz a escolha valer alguma coisa.
 */
export type TomDaPrelecao = "calma" | "confianca" | "cobranca" | "furia" | "silencio"

export const TONS: { id: TomDaPrelecao; nome: string; descricao: string }[] = [
  { id: "calma", nome: "Calma", descricao: "Baixar a bola, lembrar o plano, tirar o peso." },
  { id: "confianca", nome: "Confiança", descricao: "Dizer que este elenco é capaz — e que o adversário sabe disso." },
  { id: "cobranca", nome: "Cobrança", descricao: "Exigir o que foi combinado. Firme, sem gritar." },
  { id: "furia", nome: "Fúria", descricao: "Levantar a voz. Acende quem tem casca e derruba quem não tem." },
  { id: "silencio", nome: "Silêncio", descricao: "Não falar nada. Nunca estraga; quase nunca resolve." },
]

export interface ContextoDaPrelecao {
  momento: MomentoDaPrelecao
  golsFavor: number
  golsContra: number
  /**
   * Prestígio nosso menos o deles. Positivo = somos favoritos, e o elenco sabe:
   * empatar com um time pequeno pesa diferente de empatar com o líder.
   */
  favoritismo: number
  /** Final, clássico ou decisão: tudo pesa mais. */
  decisivo: boolean
  mandante: boolean
}

export interface AtletaNaPrelecao {
  id: number
  nome: string
  overall: number
  /** Moral contínua 0-100 (`Player.moralePoints`). */
  moralePoints: number
  titular: boolean
}

export interface ReacaoDaPrelecao {
  id: number
  nome: string
  /** Pontos de moral, limitado por `TETO_DA_PRELECAO`. */
  delta: number
  humor: "acende" | "aceita" | "encolhe"
  motivo: string
}

export interface EfeitoNoJogoDaPrelecao {
  attackDelta: number
  defenseDelta: number
  energyDelta: number
  moraleDelta: number
  pressureDelta: number
  durationMinutes: number
}

export interface ResultadoDaPrelecao {
  tom: TomDaPrelecao
  reacoes: ReacaoDaPrelecao[]
  /** O que o vestiário sentiu, na escala do delta individual. */
  saldo: number
  efeitoNoJogo: EfeitoNoJogoDaPrelecao
  /** A frase que o técnico disse, para o registro da partida. */
  frase: string
}

/**
 * TETO. Oito pontos de moral valem ~0,6 de força pela conta de `userForces`
 * ((80-55)/13 ≈ 1,9 é a diferença INTEIRA entre um elenco feliz e um neutro). É
 * de propósito: preleção é margem, não bala de prata. Quem quiser ganhar o jogo
 * falando está no jogo errado.
 */
export const TETO_DA_PRELECAO = 8

/** Situação lida do placar, do ponto de vista de quem fala. */
type Situacao = "ganhando_folgado" | "ganhando" | "empatando" | "perdendo" | "perdendo_feio"

function situacaoDe(ctx: ContextoDaPrelecao): Situacao {
  const saldo = ctx.golsFavor - ctx.golsContra
  if (saldo >= 2) return "ganhando_folgado"
  if (saldo === 1) return "ganhando"
  if (saldo === 0) return "empatando"
  if (saldo === -1) return "perdendo"
  return "perdendo_feio"
}

/**
 * Quanto o TOM cai bem na SITUAÇÃO, -1..+1. É a metade coletiva da conta; a
 * outra metade é o temperamento de cada um.
 *
 * A tabela é pedra-papel-tesoura de propósito. Fúria com o time ganhando folgado
 * soa desproporcional; calma perdendo por três soa conformada. Não existe tom
 * que sirva sempre — se existisse, a escolha seria decorativa.
 */
export function acertoDoTom(tom: TomDaPrelecao, ctx: ContextoDaPrelecao): { acerto: number; motivo: string } {
  const sit = situacaoDe(ctx)
  const favorito = ctx.favoritismo >= 8
  const zebra = ctx.favoritismo <= -8

  if (ctx.momento === "pre") {
    if (tom === "confianca") return zebra
      ? { acerto: 0.9, motivo: "O grupo precisava ouvir que dá para ganhar deste." }
      : favorito
        ? { acerto: 0.1, motivo: "Confiança sobrando num jogo que já era favas contadas." }
        : { acerto: 0.5, motivo: "Elenco entrou acreditando." }
    if (tom === "cobranca") return favorito
      ? { acerto: 0.7, motivo: "Favorito ouviu que favoritismo não ganha jogo." }
      : { acerto: -0.2, motivo: "Cobrança antes da bola rolar contra um adversário maior pesou." }
    if (tom === "calma") return ctx.decisivo
      ? { acerto: 0.8, motivo: "Decisão exige cabeça fria, e foi o que ouviram." }
      : favorito
        ? { acerto: -0.3, motivo: "Serenidade contra um adversário que era para atropelar soou como véspera de passeio." }
        : { acerto: 0.3, motivo: "Preleção sóbria, sem sobressaltos." }
    if (tom === "furia") return { acerto: -0.5, motivo: "Ninguém entende gritaria antes de a bola rolar." }
    return { acerto: 0, motivo: "Vestiário em silêncio." }
  }

  if (ctx.momento === "fim") {
    // No fim não há mais jogo para mudar: o que se decide aqui é a semana.
    if (sit === "ganhando" || sit === "ganhando_folgado") {
      if (tom === "confianca") return { acerto: 0.8, motivo: "Elogio depois da vitória cai bem." }
      if (tom === "calma") return { acerto: 0.5, motivo: "Pés no chão, sem estragar a festa." }
      if (tom === "cobranca") return { acerto: -0.3, motivo: "Cobrar depois de vencer soou ingrato." }
      if (tom === "furia") return { acerto: -0.8, motivo: "Gritar com quem acabou de vencer não passa." }
      return { acerto: 0.1, motivo: "Vitória comemorada em silêncio." }
    }
    if (tom === "furia") return sit === "perdendo_feio"
      ? { acerto: 0.2, motivo: "A derrota pedia alguém batendo na mesa." }
      : { acerto: -0.4, motivo: "Explosão desproporcional ao resultado." }
    if (tom === "cobranca") return { acerto: 0.6, motivo: "Cobrança direta, sem humilhar ninguém." }
    if (tom === "calma") return { acerto: 0.4, motivo: "Derrota tratada como o que é: uma partida." }
    if (tom === "confianca") return { acerto: 0.2, motivo: "Voto de confiança depois do tropeço." }
    return { acerto: -0.1, motivo: "Ninguém falou nada, e isso também diz algo." }
  }

  // INTERVALO — onde o tom mais rende, porque ainda há 45 minutos.
  switch (sit) {
    case "ganhando_folgado":
      if (tom === "calma") return { acerto: 0.9, motivo: "Segurar o jogo sem afrouxar." }
      if (tom === "cobranca") return { acerto: 0.4, motivo: "Aviso contra a relaxada do segundo tempo." }
      if (tom === "furia") return { acerto: -0.7, motivo: "Fúria com o time ganhando de goleada não faz sentido." }
      if (tom === "confianca") return { acerto: 0.2, motivo: "Elogio no intervalo, com o jogo ainda por fechar." }
      return { acerto: 0.2, motivo: "Nada dito; o time entendeu que estava certo." }
    case "ganhando":
      if (tom === "cobranca") return { acerto: 0.8, motivo: "Um gol não decide nada, e eles ouviram isso." }
      if (tom === "calma") return { acerto: 0.5, motivo: "Manter o plano que está funcionando." }
      if (tom === "confianca") return { acerto: 0.4, motivo: "Time saiu para o segundo tempo acreditando." }
      if (tom === "furia") return { acerto: -0.4, motivo: "Gritaria com o time à frente do placar." }
      return { acerto: 0, motivo: "Intervalo silencioso." }
    case "empatando":
      if (tom === "cobranca") return favorito
        ? { acerto: 0.9, motivo: "Empatar com este adversário não estava no combinado." }
        : { acerto: 0.4, motivo: "Cobrança justa no meio do jogo." }
      if (tom === "confianca") return zebra
        ? { acerto: 0.8, motivo: "Segurar o empate contra um time maior virou combustível." }
        : { acerto: 0.3, motivo: "Time saiu confiante para o segundo tempo." }
      if (tom === "furia") return { acerto: -0.2, motivo: "Explosão num jogo ainda aberto." }
      if (tom === "calma") return favorito
        ? { acerto: -0.3, motivo: "Empatando com um time menor, pedir calma soou como aceitar o empate." }
        : { acerto: 0.3, motivo: "Sangue frio no intervalo." }
      return { acerto: -0.1, motivo: "Silêncio num jogo que pedia palavra." }
    case "perdendo":
      if (tom === "furia") return { acerto: 0.5, motivo: "A cara do técnico no intervalo mexeu com o grupo." }
      if (tom === "cobranca") return { acerto: 0.7, motivo: "Cobrança firme com o jogo ainda ao alcance." }
      if (tom === "calma") return { acerto: 0.4, motivo: "Nada de pânico: o jogo tem 45 minutos." }
      if (tom === "confianca") return { acerto: 0.3, motivo: "Voto de confiança para a virada." }
      return { acerto: -0.3, motivo: "Perdendo e o técnico não disse nada." }
    default:
      if (tom === "furia") return { acerto: 0.3, motivo: "A goleada pedia alguém levantando a voz." }
      if (tom === "calma") return { acerto: 0.6, motivo: "Estancar o sangramento antes de pensar em virar." }
      if (tom === "cobranca") return { acerto: 0.4, motivo: "Cobrança dura com o placar já feio." }
      if (tom === "confianca") return { acerto: -0.4, motivo: "Falar em virada perdendo por três soou vazio." }
      return { acerto: -0.4, motivo: "Silêncio depois de levar três." }
  }
}

/**
 * A METADE INDIVIDUAL. O mesmo discurso não cai igual em dois atletas.
 *
 * `temperamentoNum` é 1-20 (baixo = cabeça fraca) e `determinacao`/
 * `profissionalismo` vêm da mesma persona. Nada disto é gravado: a persona é
 * derivada do id, como já era (ver `lib/player-realism.ts`).
 */
function respostaPessoal(
  tom: TomDaPrelecao,
  persona: { temperamentoNum: number; determinacao: number; profissionalismo: number },
): { fator: number; nota: string } {
  const casca = (persona.temperamentoNum - 10) / 10        // -0,9 .. +1,0
  const garra = (persona.determinacao - 10) / 10
  const cabeca = (persona.profissionalismo - 10) / 10

  switch (tom) {
    case "furia":
      // ⚠️ O ÚNICO FATOR QUE NÃO PARTE DE 1, e é de propósito.
      //
      // Partindo de 1 (como os outros quatro), a fúria bem colocada rendia
      // menos para o atleta de cabeça fraca, mas ainda rendia — o pior caso
      // possível de `temperamentoNum` (6, o mínimo que `gerarPersona` produz)
      // dava fator 0,44, positivo. Ou seja: a promessa do tom ("derruba quem
      // não tem casca") era texto, e a fúria era só uma cobrança mais barulhenta.
      // O portão `qa:prelecao` reprovava exatamente isso.
      //
      // Sem o 1, o eixo é o temperamento MÉDIO: gritar não faz nada com quem
      // está no meio da escala, acende quem tem casca e DERRUBA quem não tem,
      // mesmo quando o momento pedia o grito. Um elenco de explosivos é um
      // elenco em que levantar a voz sai caro — que é o ponto.
      return { fator: casca * 2.4, nota: casca >= 0.2 ? "peitou a bronca" : "encolheu com a bronca" }
    case "cobranca":
      return { fator: 1 + garra * 0.8 + casca * 0.2, nota: garra >= 0.2 ? "comprou a cobrança" : "recebeu a cobrança calado" }
    case "confianca":
      return { fator: 1 + garra * 0.4 - casca * 0.2, nota: "ouviu o elogio" }
    case "calma":
      return { fator: 1 + cabeca * 0.6, nota: cabeca >= 0.2 ? "entendeu o ajuste" : "queria mais energia" }
    default:
      // Silêncio: o profissional preenche sozinho, o de cabeça fraca fica no ar.
      return { fator: 1 + cabeca * 0.5, nota: cabeca >= 0.2 ? "se organizou sozinho" : "ficou sem referência" }
  }
}

const FRASES: Record<TomDaPrelecao, string> = {
  calma: "Baixem a bola. O plano está de pé — joguem o que a gente treinou.",
  confianca: "Olhem para o lado. Este elenco ganha deste adversário.",
  cobranca: "Não é isso que a gente combinou. Quero o combinado dentro de campo.",
  furia: "Isso aqui não é aceitável. Nenhum de vocês sai daqui jogando assim.",
  silencio: "O técnico atravessou o vestiário sem dizer uma palavra.",
}

export const EFEITO_ZERO: EfeitoNoJogoDaPrelecao = {
  attackDelta: 0, defenseDelta: 0, energyDelta: 0, moraleDelta: 0, pressureDelta: 0, durationMinutes: 0,
}

/**
 * A preleção inteira: quem reagiu como, quanto o grupo sentiu, e o que isso vale
 * dentro da partida.
 */
export function prelecao(
  tom: TomDaPrelecao,
  ctx: ContextoDaPrelecao,
  elenco: readonly AtletaNaPrelecao[],
): ResultadoDaPrelecao {
  const { acerto, motivo } = acertoDoTom(tom, ctx)
  const pesoDoMomento = ctx.momento === "intervalo" ? 1 : ctx.momento === "fim" ? 0.8 : 0.7
  const pesoDaDecisao = ctx.decisivo ? 1.2 : 1

  const reacoes: ReacaoDaPrelecao[] = elenco.map(atleta => {
    const persona = gerarPersona(atleta.id, atleta.overall)
    const pessoal = respostaPessoal(tom, persona)
    const bruto = acerto * TETO_DA_PRELECAO * pessoal.fator * pesoDoMomento * pesoDaDecisao
    // O reserva ouve a mesma preleção, mas ela é sobre um jogo que ele não está
    // jogando: metade do efeito. Sem isto, mexer no banco valeria tanto quanto
    // mexer em quem está em campo.
    const comBanco = atleta.titular ? bruto : bruto * 0.5
    // Moral já no teto tem menos a ganhar, e no chão tem menos a perder: sem
    // esta trava, repetir o tom certo empilharia moral até o topo da escala —
    // o irmão vestiário do glitch da bilheteria.
    const margem = comBanco >= 0
      ? Math.max(0, 100 - atleta.moralePoints) / 45
      : Math.max(0, atleta.moralePoints) / 45
    const delta = Math.round(
      Math.max(-TETO_DA_PRELECAO, Math.min(TETO_DA_PRELECAO, comBanco * Math.min(1, margem))),
    )
    return {
      id: atleta.id,
      nome: atleta.nome,
      delta,
      humor: delta >= 2 ? "acende" : delta <= -2 ? "encolhe" : "aceita",
      motivo: `${persona.rotulo}: ${pessoal.nota}`,
    }
  })

  const titulares = reacoes.filter((_, i) => elenco[i]?.titular)
  const base = titulares.length ? titulares : reacoes
  const saldo = base.length ? base.reduce((s, r) => s + r.delta, 0) / base.length : 0

  return {
    tom,
    reacoes,
    saldo: Math.round(saldo * 10) / 10,
    efeitoNoJogo: efeitoNoJogo(saldo, ctx),
    frase: `${FRASES[tom]} (${motivo})`,
  }
}

/**
 * O ÚNICO caminho direto até o motor, e só no intervalo.
 *
 * ⚠️ POR QUE O INTERVALO É EXCEÇÃO. A força do time em campo foi calculada no
 * apito inicial, a partir da moral de então. Gravar moral nova no meio da
 * partida faria `userForces` recalcular E este efeito somar: a mesma preleção
 * contada duas vezes. Por isso a regra da ligação é:
 *
 *   - "pre" e "fim": grava moral no save, efeito no jogo ZERO.
 *   - "intervalo": efeito no jogo pelo canal `CoachDecisionEffect` (o mesmo dos
 *     gritos de beira), e a moral só é gravada no apito final.
 *
 * Os números seguem a escala de `lib/match-decisions.ts`, que o motor já
 * comprime em `applyCoachEffect`.
 */
function efeitoNoJogo(saldo: number, ctx: ContextoDaPrelecao): EfeitoNoJogoDaPrelecao {
  if (ctx.momento !== "intervalo") return { ...EFEITO_ZERO }
  const m = Math.max(-TETO_DA_PRELECAO, Math.min(TETO_DA_PRELECAO, saldo))
  return {
    attackDelta: Math.round(m * 0.25 * 10) / 10,
    defenseDelta: Math.round(m * 0.2 * 10) / 10,
    // Vestiário aceso corre mais; vestiário derrubado não perde fôlego, perde
    // vontade — daí o piso em zero na perna negativa.
    energyDelta: Math.round(Math.max(0, m) * 0.2 * 10) / 10,
    moraleDelta: Math.round(m * 10) / 10,
    pressureDelta: Math.round(Math.max(0, m) * 0.5 * 10) / 10,
    // Vale o segundo tempo inteiro: é o que uma conversa de intervalo é.
    durationMinutes: 45,
  }
}

/** Resumo de uma linha para o painel e para o registro da partida. */
export function resumoDaPrelecao(r: ResultadoDaPrelecao): string {
  const acesos = r.reacoes.filter(x => x.humor === "acende").length
  const encolhidos = r.reacoes.filter(x => x.humor === "encolhe").length
  if (acesos === 0 && encolhidos === 0) return "O grupo ouviu sem se abalar."
  if (encolhidos === 0) return `${acesos} atleta${acesos === 1 ? "" : "s"} saiu aceso do vestiário.`
  if (acesos === 0) return `${encolhidos} atleta${encolhidos === 1 ? "" : "s"} encolheu com a conversa.`
  return `${acesos} acenderam, ${encolhidos} encolheram.`
}
