"use client"

// LEILÃO DE JOGADOR — disputa por um mesmo alvo.
//
// O mercado do jogo é 1-para-1 (lib/transfer-engine): você propõe, o clube
// aceita ou recusa. Falta o caso em que VÁRIOS clubes querem o mesmo atleta,
// que é onde o preço sobe de verdade e onde perder dói.
//
// A regra do leilão aqui é a que o futebol usa de fato: não vence só quem paga
// mais, vence a combinação de dinheiro com o que o atleta quer (projeto, sair
// jogando, tamanho do clube). Um lance altíssimo de um clube pequeno pode perder
// para uma oferta menor de um grande — e é isso que faz o jogador pensar.

export interface LanceLeilao {
  clubeCurto: string
  clubeNome: string
  valor: number
  /** Prestígio do clube que deu o lance (0-100). */
  prestigio: number
  /** true quando é o lance do jogador humano. */
  doUsuario?: boolean
}

export interface LeilaoAberto {
  id: string
  jogadorNome: string
  jogadorOverall: number
  jogadorIdade: number
  clubeVendedorCurto: string
  clubeVendedorNome: string
  /** Piso pedido pelo vendedor. */
  valorMinimo: number
  /** Semana em que encerra. */
  encerraNaSemana: number
  lances: LanceLeilao[]
}

/**
 * Preço de partida de um leilão.
 *
 * Usa a MESMA escala de lib/transfer-engine.calcMarketValue (overall³ × 35). A
 * primeira versão disto tinha fórmula própria e devolvia R$ 0,8 mi para um
 * atleta de overall 82 — cerca de cinquenta vezes abaixo do que o resto do jogo
 * paga pelo mesmo atleta. Duas escalas de valor no mesmo jogo é bug garantido:
 * o leilão viraria a forma mais barata de contratar.
 *
 * O piso fica em 85% do valor de mercado: o vendedor abre abaixo para atrair
 * lances, e é a disputa que leva o preço acima.
 */
export function valorMinimoDe(overall: number, idade: number, potencial?: number): number {
  const fatorIdade = idade <= 23 ? 1.35 : idade >= 32 ? 0.58 : 1
  const qualidade = Math.max(45, overall)
  // O termo de POTENCIAL faz parte de calcMarketValue. Sem ele, um jovem de
  // potencial alto saía do leilão mais barato do que custa na aba Buscar — e o
  // leilão voltaria a ser o jeito barato de contratar, que é o defeito que a
  // escala alinhada existe para evitar.
  const promessa = Math.max(0, (potencial ?? overall) - overall) * 350_000
  const mercado = Math.round(((qualidade ** 3) * 35 + promessa) * fatorIdade / 10000) * 10000
  return Math.round((mercado * 0.85) / 10000) * 10000
}

/** Incremento mínimo para cobrir o lance atual — evita leilão de centavos. */
export function lanceMinimoSeguinte(leilao: LeilaoAberto): number {
  const atual = maiorLance(leilao)?.valor ?? leilao.valorMinimo
  return Math.round(atual * 1.08)
}

export function maiorLance(leilao: LeilaoAberto): LanceLeilao | null {
  if (leilao.lances.length === 0) return null
  return [...leilao.lances].sort((a, b) => b.valor - a.valor)[0]
}

/**
 * Atratividade de um lance aos olhos do ATLETA.
 *
 * Dinheiro pesa mais, mas não sozinho: o prestígio do clube entra comprimido
 * (mesma escolha do motor de partida — diferença grande não pode decidir tudo).
 */
export function atratividade(lance: LanceLeilao, maior: number): number {
  const relativo = maior > 0 ? lance.valor / maior : 1
  const brilho = Math.sign(lance.prestigio - 60) * Math.pow(Math.abs(lance.prestigio - 60), 0.5) * 0.035
  return relativo + brilho
}

/**
 * Fecha o leilão e devolve o vencedor.
 *
 * Devolve `null` quando ninguém cobriu o mínimo — o atleta fica onde está, que é
 * um desfecho legítimo e faz o jogador levar o piso a sério.
 */
export function encerrarLeilao(leilao: LeilaoAberto): { vencedor: LanceLeilao; motivo: string } | null {
  const validos = leilao.lances.filter(l => l.valor >= leilao.valorMinimo)
  if (validos.length === 0) return null

  const maior = Math.max(...validos.map(l => l.valor))
  const ordenados = [...validos].sort((a, b) => atratividade(b, maior) - atratividade(a, maior))
  const vencedor = ordenados[0]

  const eraMaiorLance = vencedor.valor >= maior
  const motivo = eraMaiorLance
    ? `${vencedor.clubeNome} venceu com o maior lance.`
    : `${vencedor.clubeNome} levou mesmo sem o maior lance: o atleta preferiu o projeto.`

  return { vencedor, motivo }
}

// ─── VITRINE DETERMINÍSTICA ───────────────────────────────────────────────────
//
// O leilão precisa existir na tela sem virar um simulador paralelo do mundo. A
// saída é deixá-lo DERIVADO: dado (atleta, semana), quem está na disputa e quanto
// já ofereceram é sempre a mesma coisa. Só o lance do usuário precisa ser salvo.
//
// Isso evita o defeito que o leilão já teve uma vez — inventar um sistema
// paralelo ao que o jogo tinha. Aqui não há estado novo do mundo: os lances da
// IA saem de `lanceDaIA`, a mesma função que as regras usam.

function semente(texto: string): number {
  let h = 2166136261
  for (const c of texto) h = Math.imul(h ^ c.charCodeAt(0), 16777619)
  return h >>> 0
}

/** Sorteio 0-1 reproduzível a partir de um texto. */
function sorteioDe(texto: string): number {
  return (semente(texto) % 100000) / 100000
}

/** Identidade estável de um leilão: atleta + clube de origem. */
export function chaveLeilao(jogadorNome: string, clubeNome: string): string {
  return `${clubeNome}::${jogadorNome}`.toLocaleLowerCase("pt-BR")
}

/**
 * Este atleta está em disputa nesta semana?
 *
 * REALISMO: ninguém vai a leilão por sorteio. Um clube abre o atleta à disputa
 * quando tem um MOTIVO — e os motivos reais são poucos e conhecidos:
 *
 *   • o clube não consegue mais segurá-lo (craque em clube pequeno; é o caso
 *     clássico do mercado brasileiro e o que mais aparece na vida real);
 *   • ele está em fim de linha ali (veterano caro que o clube quer tirar da
 *     folha antes de perdê-lo de graça);
 *   • é uma joia jovem e o clube prefere vender no auge da valorização.
 *
 * A chance-base continua baixa (leilão tem de ser evento, não rotina), mas agora
 * é MODULADA por esses motivos em vez de ser uniforme. Um 88 num clube de
 * prestígio 55 aparece com frequência; um 80 num gigante, quase nunca — que é
 * exatamente o que se vê no futebol.
 *
 * `prestigioDoClube` é opcional para não quebrar quem já chama sem ele.
 */
export function emLeilaoNaSemana(
  jogadorNome: string,
  clubeNome: string,
  overall: number,
  semana: number,
  contexto?: {
    prestigioDoClube?: number
    idade?: number
    potencial?: number
    /**
     * PISO DE INTERESSE — o menor overall que ESTE comprador acha relevante.
     *
     * ⚠️ O piso era fixo em 78, e isso tornava o leilao uma sala fechada: um
     * clube de Serie C ou D, com elenco na casa dos 50, NUNCA via um atleta em
     * disputa, porque nenhum jogador do porte dele chegava a ser sorteado. So
     * craque de primeira prateleira ia a leilao — que nem eram contrataveis por
     * quem estava embaixo. Era o relato "coloque tambem jogadores de divisoes
     * inferiores, para clube pequeno conseguir contratar".
     *
     * Quem chama passa o nivel do proprio elenco; sem isso, continua em 78 e
     * nada muda para quem ja usava a funcao.
     */
    pisoDeInteresse?: number
  },
): boolean {
  const piso = Math.min(78, Math.max(45, contexto?.pisoDeInteresse ?? 78))
  if (overall < piso) return false
  // A janela dura 3 semanas, então o bloco de semanas é o que define o lote.
  const bloco = Math.floor(semana / 3)
  const sorteio = sorteioDe(`leilao:${chaveLeilao(jogadorNome, clubeNome)}:${bloco}`)

  let chance = 0.0025
  if (contexto) {
    const prestigio = contexto.prestigioDoClube ?? 60
    const idade = contexto.idade ?? 26
    const potencial = contexto.potencial ?? overall

    // O clube não segura o craque. `overall - prestigio` mede o desnível entre o
    // atleta e o porte de quem o tem: 88 num clube de 55 é uma saída anunciada.
    const desnivel = overall - prestigio
    if (desnivel > 20) chance *= 3.2
    else if (desnivel > 10) chance *= 2
    else if (desnivel < -8) chance *= 0.35   // gigante não solta quem é do tamanho dele

    // Veterano caro: o clube prefere vender agora a perder de graça depois.
    if (idade >= 31) chance *= 1.8
    // Joia jovem com potencial bem acima: vender no auge da valorização.
    else if (idade <= 22 && potencial > overall + 6) chance *= 1.6
    // Titular em idade de auge é o que menos circula — mesma regra do empréstimo.
    else if (idade >= 25 && idade <= 30) chance *= 0.6
  }

  return sorteio < Math.min(0.02, chance)
}

/**
 * Semana em que o leilão deste atleta encerra.
 *
 * ⚠️ BUG QUE ISTO CORRIGE (relato: "mesmo tendo o maior lance não consigo
 * contratar ninguém; fala que finaliza em certa semana e depois não aparece
 * mais nada").
 *
 * Antes devolvia `(bloco + 1) * 3` — a PRIMEIRA semana do bloco SEGUINTE. Só que
 * a existência do leilão é derivada do bloco (`emLeilaoNaSemana` usa
 * `Math.floor(semana / 3)` na semente). Ao chegar na semana de encerramento o
 * bloco já era outro, a semente mudava e o leilão simplesmente DEIXAVA DE
 * EXISTIR — no mesmo instante em que deveria ser decidido.
 *
 * Consequência: `encerrado = semana >= encerra` nunca era observável, a tela do
 * vencedor e o botão "Fechar contrato" eram inalcançáveis, e a página de leilões
 * ainda redirecionava para o escritório por achar que não havia disputa nenhuma.
 * Vencer o leilão não entregava jogador nenhum, nunca.
 *
 * Agora encerra na ÚLTIMA semana do PRÓPRIO bloco: o leilão continua listado
 * quando é decidido.
 */
export function semanaDeEncerramento(semana: number): number {
  return Math.floor(semana / 3) * 3 + 2
}

// ─── RESOLUÇÃO DE LANCES PENDENTES ───────────────────────────────────────────
//
// Corrigir a semana de encerramento faz o resultado APARECER — mas só para quem
// abrir a tela exatamente naquela semana. Quem avança a temporada sem passar por
// ela perderia o atleta que ganhou, e o pedido do jogador é justamente que o
// vencedor venha "na hora ou na abertura da janela".
//
// Por isso o desfecho é recalculado a partir do LANCE SALVO, que é a única coisa
// que o save guarda. Como os lances da IA são derivados de (leilão, semana), dá
// para reconstruir a disputa exatamente como ela estava na semana do fecho.

export interface LanceParaResolver {
  chave: string
  valor: number
  encerraNaSemana: number
  season: number
  /** Semana do lance — define a partir de quando os rivais podem reagir a ele. */
  semanaDoLance?: number
}

export interface DesfechoDeLeilao {
  chave: string
  jogadorNome: string
  /** O lance do usuário. */
  meuLance: number
  venceu: boolean
  /** Valor com que o leilão foi arrematado. */
  valorVencedor: number
  motivo: string
}

/**
 * Resolve os lances do usuário cujos leilões já fecharam.
 *
 * `alvoPorChave` devolve o atleta do catálogo (ou undefined se ele saiu do
 * mercado). Sem o atleta não há como reconstruir a disputa: o lance é
 * descartado, e é melhor descartar do que travar a fila para sempre.
 */
export function resolverLancesPendentes(
  lances: readonly LanceParaResolver[],
  semanaAtual: number,
  seasonAtual: number,
  alvoPorChave: (chave: string) => { name: string; overall: number; age: number; potential?: number; teamCurto: string; teamNome: string } | undefined,
  candidatos: { curto: string; nome: string; prestigio: number; caixa: number; forcaElenco: number }[],
  clubeDoUsuario: { curto: string; nome: string; prestigio: number },
): { desfechos: DesfechoDeLeilao[]; restantes: LanceParaResolver[] } {
  const desfechos: DesfechoDeLeilao[] = []
  const restantes: LanceParaResolver[] = []

  for (const lance of lances) {
    // Lance de temporada passada nunca mais se resolve — some.
    if (lance.season !== seasonAtual) continue
    if (semanaAtual < lance.encerraNaSemana) { restantes.push(lance); continue }

    const alvo = alvoPorChave(lance.chave)
    if (!alvo) continue

    const base: LeilaoAberto = {
      id: lance.chave,
      jogadorNome: alvo.name,
      jogadorOverall: alvo.overall,
      jogadorIdade: alvo.age,
      clubeVendedorCurto: alvo.teamCurto,
      clubeVendedorNome: alvo.teamNome,
      valorMinimo: valorMinimoDe(alvo.overall, alvo.age, alvo.potential),
      encerraNaSemana: lance.encerraNaSemana,
      lances: [],
    }
    // A disputa é reconstruída na SEMANA DO FECHO, não na semana atual: é o
    // estado que valia quando o martelo bateu — e com o SEU lance dentro dela,
    // para os rivais terem tido a chance de cobri-lo.
    const ia = lancesDaIA(base, candidatos, lance.encerraNaSemana, {
      valor: lance.valor,
      semana: lance.semanaDoLance ?? semanaDeAbertura(lance.encerraNaSemana),
    })
    const completo: LeilaoAberto = {
      ...base,
      lances: [...ia, {
        clubeCurto: clubeDoUsuario.curto,
        clubeNome: clubeDoUsuario.nome,
        valor: lance.valor,
        prestigio: clubeDoUsuario.prestigio,
        doUsuario: true,
      }],
    }
    const desfecho = encerrarLeilao(completo)
    if (!desfecho) {
      desfechos.push({
        chave: lance.chave, jogadorNome: alvo.name, meuLance: lance.valor,
        venceu: false, valorVencedor: 0,
        motivo: `Ninguém cobriu o piso por ${alvo.name}. Ele segue no ${alvo.teamNome}.`,
      })
      continue
    }
    desfechos.push({
      chave: lance.chave,
      jogadorNome: alvo.name,
      meuLance: lance.valor,
      venceu: desfecho.vencedor.doUsuario === true,
      valorVencedor: desfecho.vencedor.valor,
      motivo: desfecho.motivo,
    })
  }

  return { desfechos, restantes }
}

/** Primeira semana do bloco de 3 a que a semana pertence. */
export function semanaDeAbertura(semana: number): number {
  return Math.floor(semana / 3) * 3
}

/**
 * Lances da IA neste leilão, reproduzíveis — e agora com DISPUTA DE VERDADE.
 *
 * ⚠️ O QUE ISTO CONSERTA. Antes os lances da IA eram derivados do leilão VAZIO:
 * os rivais nunca enxergavam o lance do usuário e, portanto, **nunca o
 * cobriam**. Bastava dar um lance qualquer acima do maior da IA para ganhar
 * qualquer atleta — nenhum clube respondia, por mais rico que fosse. Não era um
 * leilão, era uma compra pelo piso com etapa extra.
 *
 * Agora a disputa corre SEMANA A SEMANA dentro da janela de três semanas:
 *
 *   • na abertura, alguns clubes entram;
 *   • a cada semana seguinte, quem tem caixa pode COBRIR o maior lance da
 *     mesa — inclusive o seu;
 *   • quem cobre na ÚLTIMA semana não é respondido (não sobra semana), o que
 *     dá valor a segurar o lance — como num leilão real.
 *
 * `usuario` é o lance do técnico e a semana em que ele foi dado: ele só entra na
 * conta a partir dessa semana, senão os rivais estariam reagindo a um lance que
 * ainda não existia.
 */
export function lancesDaIA(
  leilao: LeilaoAberto,
  candidatos: { curto: string; nome: string; prestigio: number; caixa: number; forcaElenco: number }[],
  semana: number,
  usuario?: { valor: number; semana: number },
): LanceLeilao[] {
  const acumulado: LanceLeilao[] = []
  // Ordem de entrada também é derivada, para o mais rico não ser sempre o último.
  const ordenados = [...candidatos].sort(
    (a, b) => sorteioDe(`ordem:${leilao.id}:${a.curto}`) - sorteioDe(`ordem:${leilao.id}:${b.curto}`),
  )
  // Teto de concorrentes varia de 1 a 4 POR LEILÃO. Com teto fixo em 4 e o
  // interesse alto, toda disputa vinha com exatamente 4 clubes e ficava
  // monótona; variando, aparece o duelo direto e aparece o leilão cheio.
  const teto = 1 + Math.floor(sorteioDe(`teto:${leilao.id}`) * 4)
  const abertura = semanaDeAbertura(leilao.encerraNaSemana)

  for (let w = abertura; w <= semana; w++) {
    // O lance do usuário só é RESPONDIDO a partir da semana seguinte à que foi
    // dado (`<`, não `<=`). É o que dá sentido a segurar o lance: cobrir na
    // última semana não deixa tempo para ninguém reagir — como num leilão real,
    // onde quem arremata no fim leva. Em compensação, quem cobre cedo vai ser
    // coberto de volta.
    const doUsuario = usuario && usuario.semana < w
      ? [{ clubeCurto: "__user__", clubeNome: "", valor: usuario.valor, prestigio: 0, doUsuario: true }]
      : []

    for (const clube of ordenados) {
      const jaEsta = acumulado.find(l => l.clubeCurto === clube.curto)
      // Clube novo só entra até o teto; quem já está na mesa pode cobrir sempre.
      if (!jaEsta && acumulado.length >= teto) continue

      const parcial: LeilaoAberto = { ...leilao, lances: [...acumulado, ...doUsuario] }
      const lance = lanceDaIA(parcial, clube, sorteioDe(`lance:${leilao.id}:${clube.curto}:${w}`))
      if (!lance) continue

      if (jaEsta) {
        // Cobrir só faz sentido se for para PASSAR o que já está na mesa.
        if (lance.valor > jaEsta.valor) jaEsta.valor = lance.valor
      } else {
        acumulado.push(lance)
      }
    }
  }
  return acumulado
}

/**
 * Lance da IA. Clube só entra se o atleta melhora o elenco dele e se cabe no
 * caixa — senão o leilão vira inflação sem sentido.
 */
export function lanceDaIA(
  leilao: LeilaoAberto,
  clube: { curto: string; nome: string; prestigio: number; caixa: number; forcaElenco: number },
  sorteio: number = Math.random(),
): LanceLeilao | null {
  const melhora = leilao.jogadorOverall - clube.forcaElenco
  // -5 e não -2: clube compra também para dar profundidade ao elenco e para
  // revender. Com o corte em -2, quase nenhum atleta agradava a alguém que
  // também tivesse caixa para pagá-lo, e o leilão abria vazio.
  if (melhora < -5) return null                       // não agrega
  const minimo = lanceMinimoSeguinte(leilao)
  if (minimo > clube.caixa * 0.6) return null         // não cabe no caixa

  // Interesse cresce com a melhora e com o prestígio (clube grande arrisca mais).
  // Jovem entra na conta: um atleta de 21 anos interessa mesmo sem melhorar o XI.
  const juventude = leilao.jogadorIdade <= 23 ? 0.18 : leilao.jogadorIdade >= 31 ? -0.10 : 0
  const interesse = 0.25 + melhora * 0.06 + (clube.prestigio - 60) * 0.004 + juventude
  if (sorteio >= Math.min(0.85, interesse)) return null

  const agressividade = 1 + sorteio * 0.12
  return {
    clubeCurto: clube.curto,
    clubeNome: clube.nome,
    valor: Math.round(minimo * agressividade),
    prestigio: clube.prestigio,
  }
}
