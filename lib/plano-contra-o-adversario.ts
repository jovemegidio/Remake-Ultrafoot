// PLANO CONTRA O ADVERSÁRIO — a preparação que finalmente LÊ quem está do outro lado.
//
// ⚠️ O QUE ISTO CORRIGE, e por que não é um sistema novo.
//
// `lib/gestao-282.ts` já tinha `PreparacaoAdversario` com `focoTatico` de quatro
// opções, e `app/gestao-avancada` já deixava escolher. Só que:
//
//   1. `bonusPreparacao()` devolvia praticamente o MESMO número para os quatro
//      focos (só "controlar" valia 1 a menos), e
//   2. `bonusPreparacaoAplicavel282()` somava esse número IGUAL em ataque,
//      defesa e meio, e
//   3. nada em lugar nenhum olhava para o adversário de verdade.
//
// Ou seja: preparar-se contra um time que se fecha atrás rendia exatamente o
// mesmo que preparar-se contra um time que pressiona na saída, e o dossiê rico
// de `/adversarios` (formação, ameaças, fraquezas) não entrava na conta. Era o
// terceiro caso do padrão da casa: o controle existia, a tela deixava mexer, e o
// motor não sentia diferença nenhuma.
//
// Este módulo NÃO cria um segundo cofre. Ele recebe a mesma `PreparacaoAdversario`
// e resolve em números ASSIMÉTRICOS — e substitui `bonusPreparacaoAplicavel282`
// no caminho da partida. Somar os dois contaria a preparação duas vezes.
//
// Módulo PURO: sem store, sem React.

/** Os quatro focos que a Central de Gestão já oferece. Não inventar um quinto. */
export type FocoTatico = "pressionar" | "contra_atacar" | "controlar" | "fechar_espacos"

/**
 * Como o adversário joga, lido dos números que o jogo JÁ tem sobre ele
 * (`aiTacticForClub` → pressingLoad/transitionLoad, e a postura da IA).
 */
export type EstiloDoAdversario =
  | "pressiona_alto"
  | "sai_jogando"
  | "contra_ataca"
  | "bloco_baixo"
  | "equilibrado"

export const NOME_DO_ESTILO: Record<EstiloDoAdversario, string> = {
  pressiona_alto: "Pressiona a saída",
  sai_jogando: "Sai jogando de trás",
  contra_ataca: "Espera e contra-ataca",
  bloco_baixo: "Bloco baixo, sem pressa",
  equilibrado: "Equilibrado, sem traço forte",
}

export interface PerfilDoAdversario {
  /** 0-1. `pressingLoad` do perfil da IA. */
  pressao: number
  /** 0-1. `transitionLoad` do perfil da IA. */
  transicao: number
  mentalidade?: "defensivo" | "equilibrado" | "ofensivo"
}

/** Um atleta do adversário que dá para marcar sob pressão. */
export interface AlvoDeMarcacao {
  nome: string
  overall: number
  posicao: string
}

export interface PlanoContraOAdversario {
  attackDelta: number
  defenseDelta: number
  midfieldDelta: number
  /** Nome do marcado -> quanto do peso de lance dele fica de fora (0-1). */
  marcacoes: { nome: string; reducao: number }[]
  leitura: {
    estilo: EstiloDoAdversario
    /** 0-1: quanto do dossiê existe. Abaixo de `CONFIANCA_MINIMA` a leitura pode errar. */
    confianca: number
    frase: string
  }
  /** O que o jogador precisa ler antes de confirmar. Nunca vazio à toa. */
  avisos: string[]
}

/**
 * TETO. Quatro pontos de força por setor — exatamente o que a preparação já
 * valia no máximo (`bonus` 8 na tela, dividido por 2 porque a calibração do
 * motor comprime força em probabilidade), e o antigo `bonusPreparacaoAplicavel282`
 * somava esses 4 em ataque, meio E defesa: 12 no total.
 *
 * ⚠️ ESTA VERSÃO NÃO AUMENTA O TETO. São os mesmos 12 pontos no melhor caso,
 * repartidos de forma ASSIMÉTRICA pelo foco escolhido (ver `REPARTICAO`) — e,
 * diferente do bônus plano, eles ficam NEGATIVOS quando a leitura erra. O que
 * muda não é quanto se ganha preparando certo: é passar a existir preparar
 * errado.
 */
export const TETO_DO_PLANO = 4

/** Abaixo disto o dossiê é palpite, e o palpite pode sair errado. */
export const CONFIANCA_MINIMA = 0.6

/** No máximo dois marcados: a partir do terceiro o time vira uma escolta. */
export const MAX_MARCACOES = 2

/**
 * Lê o estilo a partir dos dois números que o perfil da IA já produz.
 *
 * ⚠️ Nada aqui é sorteado. O mesmo adversário lido duas vezes dá o mesmo estilo,
 * senão reabrir a tela mudaria o plano.
 */
export function estiloDoAdversario(perfil: PerfilDoAdversario): EstiloDoAdversario {
  const pressao = clamp01(perfil.pressao)
  const transicao = clamp01(perfil.transicao)
  if (pressao >= 0.62) return "pressiona_alto"
  if (pressao <= 0.34 && transicao >= 0.55) return "contra_ataca"
  if (pressao <= 0.34 && perfil.mentalidade === "defensivo") return "bloco_baixo"
  if (transicao <= 0.4 && perfil.mentalidade !== "defensivo") return "sai_jogando"
  return "equilibrado"
}

/**
 * O QUE VENCE O QUÊ. Pedra-papel-tesoura, sem foco universalmente bom.
 *
 * O valor é -1..+1 e multiplica o teto. Escolher errado CUSTA: um time que
 * pressiona a saída de quem já espera atrás gasta fôlego contra ninguém.
 */
export function acertoDoFoco(foco: FocoTatico, estilo: EstiloDoAdversario): { acerto: number; motivo: string } {
  const tabela: Record<FocoTatico, Partial<Record<EstiloDoAdversario, { acerto: number; motivo: string }>>> = {
    pressionar: {
      sai_jogando: { acerto: 1, motivo: "Eles insistem em sair jogando: sufocar a saída é o caminho." },
      pressiona_alto: { acerto: 0.2, motivo: "Dois times pressionando: jogo partido, vantagem pequena." },
      contra_ataca: { acerto: -0.7, motivo: "Subir a linha contra quem só espera é entregar as costas." },
      bloco_baixo: { acerto: -0.5, motivo: "Não há saída para pressionar: eles não querem a bola." },
      equilibrado: { acerto: 0.2, motivo: "Pressão rende alguma coisa contra qualquer um." },
    },
    contra_atacar: {
      pressiona_alto: { acerto: 1, motivo: "Eles sobem a linha inteira: o espaço nas costas é nosso." },
      sai_jogando: { acerto: 0.4, motivo: "Roubar alto e sair rápido pega eles mal postados." },
      bloco_baixo: { acerto: -0.8, motivo: "Contra-atacar quem já está atrás é contra-atacar o vazio." },
      contra_ataca: { acerto: -0.3, motivo: "Dois times esperando: ninguém propõe, jogo travado." },
      equilibrado: { acerto: 0.2, motivo: "Transição rápida sempre tem alguma serventia." },
    },
    controlar: {
      pressiona_alto: { acerto: -0.4, motivo: "Querer a bola contra quem pressiona é pedir para perdê-la no lugar errado." },
      bloco_baixo: { acerto: 0.7, motivo: "Eles entregam a bola: usar isso com paciência é o plano certo." },
      contra_ataca: { acerto: 0.5, motivo: "Ter a bola tira deles a transição que é a arma da casa." },
      sai_jogando: { acerto: 0.3, motivo: "Disputa de posse equilibrada, sem vantagem clara." },
      equilibrado: { acerto: 0.3, motivo: "Controlar o jogo rende contra um adversário sem traço forte." },
    },
    fechar_espacos: {
      contra_ataca: { acerto: 1, motivo: "A arma deles é o espaço, e o espaço acabou." },
      sai_jogando: { acerto: 0.4, motivo: "Bloco compacto obriga eles a jogar por fora." },
      pressiona_alto: { acerto: 0.2, motivo: "Fechar contra quem pressiona segura, mas não resolve." },
      bloco_baixo: { acerto: -0.6, motivo: "Dois blocos baixos: 0 a 0 e nenhuma vantagem." },
      equilibrado: { acerto: 0.3, motivo: "Compactar é a escolha segura." },
    },
  }
  return tabela[foco][estilo] ?? { acerto: 0, motivo: "Leitura sem conclusão." }
}

/** Para onde cada foco empurra a força. A soma dos três é sempre 1. */
const REPARTICAO: Record<FocoTatico, { attack: number; defense: number; midfield: number }> = {
  pressionar: { attack: 0.3, defense: 0.15, midfield: 0.55 },
  contra_atacar: { attack: 0.6, defense: 0.15, midfield: 0.25 },
  controlar: { attack: 0.25, defense: 0.2, midfield: 0.55 },
  fechar_espacos: { attack: 0.1, defense: 0.65, midfield: 0.25 },
}

/**
 * A LEITURA PODE ESTAR ERRADA. Com o dossiê incompleto, o plano é feito contra
 * um adversário imaginário — e o técnico não fica sabendo até a bola rolar.
 *
 * ⚠️ Determinístico pelo nome do clube, não sorteado: o mesmo dossiê pela metade
 * produz sempre a mesma leitura torta. Sortear faria o jogador recarregar a tela
 * até a leitura sair boa, que é o oposto do que scoutear deve valer.
 */
function leituraPercebida(real: EstiloDoAdversario, confianca: number, chaveDoClube: string): EstiloDoAdversario {
  if (confianca >= CONFIANCA_MINIMA) return real
  const ordem: EstiloDoAdversario[] = ["pressiona_alto", "sai_jogando", "contra_ataca", "bloco_baixo", "equilibrado"]
  let h = 0
  for (let i = 0; i < chaveDoClube.length; i++) h = (h * 31 + chaveDoClube.charCodeAt(i)) >>> 0
  // Quanto menos dossiê, mais longe da verdade o palpite pode cair.
  const desvio = 1 + Math.floor((1 - confianca / CONFIANCA_MINIMA) * 2)
  return ordem[(ordem.indexOf(real) + (h % desvio) + 1) % ordem.length]
}

export interface EntradaDoPlano {
  foco: FocoTatico
  /** Quantas rotinas de bola parada estão ensaiadas — o que `bonusPreparacao` já usava. */
  rotinasEnsaiadas: number
  /** Nomes escolhidos para marcação individual (no máximo `MAX_MARCACOES`). */
  marcacaoIndividual?: readonly string[]
  /** Elenco do adversário, para validar os marcados e medir o que a marcação vale. */
  alvos?: readonly AlvoDeMarcacao[]
  perfil: PerfilDoAdversario
  /** `analysisProgress` de `OpponentAnalysis`, 0-100. Sem dossiê nenhum = 0. */
  dossie: number
  /** Chave estável do adversário (curto ou file_key), para a leitura torta. */
  chaveDoClube: string
  /**
   * `preparoDeJogo` de `lib/efeito-do-treinador.ts` — o atributo ANÁLISE do
   * técnico, neutro em 1. Multiplica o que a semana rendeu, como já fazia.
   */
  preparoDoTecnico?: number
}

/**
 * Resolve o plano em números para o `MatchConfig`.
 *
 * ⚠️ Quem chama deve usar ISTO **no lugar** de `bonusPreparacaoAplicavel282`, e
 * não além dele. Ver o cabeçalho.
 */
export function planoContraOAdversario(entrada: EntradaDoPlano): PlanoContraOAdversario {
  const confianca = clamp01(entrada.dossie / 100)
  const real = estiloDoAdversario(entrada.perfil)
  const percebido = leituraPercebida(real, confianca, entrada.chaveDoClube)
  const avisos: string[] = []

  // O acerto é medido contra o adversário REAL: o plano foi feito contra o
  // percebido, mas quem entra em campo é o outro. É exatamente aqui que
  // scoutear pouco cobra o preço.
  const { acerto, motivo } = acertoDoFoco(entrada.foco, real)
  const { motivo: motivoPercebido } = acertoDoFoco(entrada.foco, percebido)

  if (confianca < CONFIANCA_MINIMA) {
    avisos.push(
      `Dossiê em ${Math.round(confianca * 100)}%: a comissão está lendo o adversário por cima e pode errar o plano.`,
    )
  }

  // Ensaio: metade do valor vem de ter TREINADO, metade de ter acertado a
  // leitura. Um plano certo sem treino nenhum rende pouco, e um plano errado
  // treinado a semana inteira rende negativo — treinar o plano errado é pior
  // do que não treinar.
  const ensaio = Math.min(1, 0.3 + Math.min(4, Math.max(0, entrada.rotinasEnsaiadas)) * 0.175)
  const preparo = entrada.preparoDoTecnico ?? 1
  const total = acerto * TETO_DO_PLANO * ensaio * preparo

  const repart = REPARTICAO[entrada.foco]
  const attackDelta = total * repart.attack * 3
  let defenseDelta = total * repart.defense * 3
  let midfieldDelta = total * repart.midfield * 3

  // MARCAÇÃO INDIVIDUAL. Tira peso de lance do marcado e custa espaço atrás: o
  // zagueiro que sai colado num atacante deixa a linha desfalcada. Sem este
  // custo, marcar os dois melhores seria escolha óbvia e portanto nenhuma
  // escolha.
  const pedidosBrutos = entrada.marcacaoIndividual ?? []
  const pedidos = pedidosBrutos.slice(0, MAX_MARCACOES)
  const alvos = entrada.alvos ?? []
  const marcacoes: { nome: string; reducao: number }[] = []
  for (const nome of pedidos) {
    const alvo = alvos.find(a => a.nome === nome)
    if (!alvo) {
      avisos.push(`"${nome}" não está no elenco relacionado do adversário: a marcação não vale nada nesta partida.`)
      continue
    }
    // Craque grande é mais difícil de anular do que jogador comum, e o dossiê
    // manda: marcar sob pressão quem você mal observou quase não funciona.
    const dificuldade = Math.max(0, Math.min(1, (alvo.overall - 60) / 40))
    const reducao = Math.max(0.08, Math.min(0.45, (0.42 - dificuldade * 0.2) * (0.4 + confianca * 0.6)))
    marcacoes.push({ nome: alvo.nome, reducao: Math.round(reducao * 100) / 100 })
    defenseDelta -= 0.9
    midfieldDelta -= 0.35
  }
  // ⚠️ A conta é sobre o pedido BRUTO. Comparar `pedidos.length` (já cortado)
  // com o próprio teto é sempre falso — o aviso nunca sairia, e o excedente
  // desapareceria em silêncio. O portão pegou exatamente isso.
  if (pedidosBrutos.length > MAX_MARCACOES) {
    avisos.push(`Só dá para marcar ${MAX_MARCACOES} sob pressão; o resto do pedido foi ignorado.`)
  }

  const frase = confianca >= CONFIANCA_MINIMA
    ? `${NOME_DO_ESTILO[real]}. ${motivo}`
    : `A comissão apostou em "${NOME_DO_ESTILO[percebido]}" — ${motivoPercebido}`

  return {
    attackDelta: arredondar(attackDelta),
    defenseDelta: arredondar(defenseDelta),
    midfieldDelta: arredondar(midfieldDelta),
    marcacoes,
    leitura: { estilo: percebido, confianca, frase },
    avisos,
  }
}

/**
 * Aplica a marcação aos PESOS DE LANCE do adversário.
 *
 * ⚠️ Feito aqui, na camada que monta o elenco para o motor, e não dentro do
 * `match-engine`: os pesos já chegam ao motor resolvidos (ver o comentário das
 * características em `lib/match-engine.ts`), então marcar alguém é reduzir o
 * peso dele antes de entregar, sem uma linha nova no motor.
 */
export function aplicarMarcacao<T extends {
  nome: string
  pesoFinalizar?: number
  pesoCriar?: number
  pesoVelocidade?: number
  multChute?: number
}>(atleta: T, marcacoes: readonly { nome: string; reducao: number }[]): T {
  const m = marcacoes.find(x => x.nome === atleta.nome)
  if (!m) return atleta
  const fator = 1 - m.reducao
  return {
    ...atleta,
    // `undefined` continua `undefined`: elenco sem perfil canônico volta ao
    // sorteio uniforme do motor, exatamente como antes.
    pesoFinalizar: atleta.pesoFinalizar != null ? atleta.pesoFinalizar * fator : undefined,
    pesoCriar: atleta.pesoCriar != null ? atleta.pesoCriar * fator : undefined,
    pesoVelocidade: atleta.pesoVelocidade != null ? atleta.pesoVelocidade * fator : undefined,
    multChute: atleta.multChute != null ? 1 + (atleta.multChute - 1) * fator : undefined,
  }
}

/** Uma linha por efeito, para a prévia honesta na tela. */
export function descreverPlano(p: PlanoContraOAdversario): string[] {
  const linhas: string[] = [p.leitura.frase]
  const setor = (nome: string, v: number) => `${nome} ${v >= 0 ? "+" : ""}${v.toFixed(1)}`
  linhas.push([setor("Ataque", p.attackDelta), setor("Meio", p.midfieldDelta), setor("Defesa", p.defenseDelta)].join(" · "))
  for (const m of p.marcacoes) {
    linhas.push(`${m.nome} marcado sob pressão: ${Math.round(m.reducao * 100)}% menos presente nos lances.`)
  }
  return linhas
}

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0
  return Math.min(1, Math.max(0, n))
}

function arredondar(n: number): number {
  return Math.round(n * 10) / 10
}
