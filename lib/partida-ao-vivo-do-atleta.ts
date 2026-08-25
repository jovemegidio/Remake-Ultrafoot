// A PARTIDA DO ATLETA COM O RESULTADO EM ABERTO.
//
// ─── O QUE ESTE ARQUIVO CONSERTA ─────────────────────────────────────────────
//
// `lib/partida-do-atleta.ts` monta os momentos DEPOIS que a partida inteira já
// foi simulada, e recebe o placar pronto:
//
//     montarPartidaDoAtleta(estado, { golsPro, golsContra, ... })
//     podeGol = participacoes < partida.golsPro          // ⬅ o problema
//
// Ou seja: os seus gols eram racionados contra um placar já decidido. Se o time
// perdeu de 0×3, você não podia marcar — jogasse como jogasse. A escolha existia
// na tela, mas o desfecho dela já estava escrito. É o oposto do que um modo de
// carreira de jogador promete.
//
// Aqui a partida é simulada MINUTO A MINUTO. Quando o seu atleta se envolve, o
// relógio para de verdade; a sua ação é resolvida pelos atributos dele; e o
// resultado ENTRA no estado da partida. O placar é consequência, não moldura.
//
// ─── POR QUE NÃO MEXI NO MOTOR ───────────────────────────────────────────────
//
// `lib/match-engine.ts` tem 2.465 linhas e carrega a calibração de 20 mil jogos
// do harness de realismo. Não precisei tocar nele: ele JÁ expõe tudo.
//
//     tickMinute(state, config)              simulação incremental
//     startMatch / resumeSecondHalf          controle de fase
//     state.pendingPenalty  →  o motor PARA e espera o usuário
//
// O padrão de "parar e esperar" é do próprio motor — foi criado para o pênalti
// do usuário, com a mesma motivação (`o gol já estava no placar quando a UI ia
// reagir`). Este módulo faz o mesmo com o envolvimento do atleta, por fora.
//
// ⚠️ A PAUSA VIVE AQUI, NÃO NO MOTOR. Um `pendingPlayerMoment` dentro do
// `MatchState` obrigaria TODO consumidor do motor (liga, copa, online, o modo
// treinador) a saber resolvê-lo, e quem esquecesse travaria a simulação num laço
// silencioso. Como só a carreira de atleta precisa parar, quem para é ela.

import {
  createInitialState,
  semearMotorDePartida,
  resolvePendingPenalty,
  resolvePendingVar,
  startMatch,
  tickMinute,
  type MatchConfig,
  type MatchState,
} from "@/lib/match-engine"
import {
  calcularTrajetoria,
  resolverChute,
  type ChuteDoJogador,
  type ContextoDoChute,
  type DesfechoDoChute,
} from "@/lib/fisica-do-chute"

/** O que o atleta pode ser chamado a resolver. */
export type TipoDeLance =
  | "finalizacao"
  | "falta"
  | "penalti"
  | "passe_decisivo"
  | "drible"
  | "cruzamento"
  | "desarme"
  | "cabeceio"
  | "defesa"
  | "saida_do_gol"
  | "penalti_defensivo"
  | "reposicao"

export interface OpcaoDoLance {
  id: string
  texto: string
  /** Atributo que decide. Mantém o vocabulário de `carreira-de-jogador`. */
  atributo: string
  /** 0–1. Quanto mais alto, mais raro o sucesso e maior o prêmio. */
  risco: number
  /** O que o sucesso produz no jogo. */
  efeito: "gol" | "assistencia" | "chance" | "posse" | "desarme" | "defesa"
}

export interface LanceDoAtleta {
  id: string
  minuto: number
  tipo: TipoDeLance
  /** Placar REAL no instante do lance — não um placar futuro. */
  placar: { pro: number; contra: number }
  narracao: string
  opcoes: OpcaoDoLance[]
  /**
   * DE ONDE O CHUTE SAI (1.0.374) — distância, ângulo, marcação, pé e cabeça.
   *
   * ⚠️ NASCE COM O LANCE E VIAJA COM ELE. Sortear isto na hora de resolver
   * deixaria o jogador escolher "chutar ou tocar" sem saber de onde está
   * chutando — que é exatamente a informação que decide. A tela mostra antes
   * de ele mirar.
   */
  contexto?: ContextoDoChute
  /** Qualidade do goleiro adversário, 1 a 99. */
  goleiro?: number
  /** Altura do goleiro adversário, em cm. Decide o alcance no alto. */
  goleiroAltura?: number
}

export interface PartidaAoVivo {
  estado: MatchState
  config: MatchConfig
  /** true = o atleta joga do lado mandante. */
  emCasa: boolean
  /** Minuto em que ele entra. 0 = titular. */
  minutoDeEntrada: number
  /** Minuto em que sai. null = fica até o fim. */
  minutoDeSaida: number | null
  /** O lance esperando decisão. `null` = pode continuar simulando. */
  lancePendente: LanceDoAtleta | null
  /** Estatística do atleta, construída pelo que ELE fez. */
  gols: number
  assistencias: number
  nota: number
  historico: { minuto: number; texto: string; delta: number }[]
  /** Semente, para a partida ser reproduzível (debug, teste, replay). */
  semente: string
  /** Quantos lances já foram oferecidos — evita inundar o jogador. */
  lancesOferecidos: number
  /** Ritmo NSS: alvo de lances curtos para esta participacao. */
  metaDeLances?: number
  /**
   * Atributos do atleta, injetados pela carreira.
   *
   * ⚠️ VIVEM AQUI DENTRO, não num mapa externo. A primeira versão os guardou num
   * `WeakMap` chaveado pelo objeto da partida — e todas as funções deste módulo
   * devolvem um objeto NOVO (spread). A partir da primeira transição a busca
   * falhava em silêncio e todo lance caía no piso de 60, ou seja: o atleta
   * deixava de importar exatamente no sistema que existe para fazê-lo importar.
   */
  atributos: Record<string, number>
  /** Posição do atleta. Vem da carreira, não do elenco do motor. */
  posicao: string
  /**
   * ENERGIA NO INSTANTE DA PARTIDA, 0 a 100 (1.0.374).
   *
   * Entra na física como PRESSÃO: quem está arrastando aos 85 chuta como quem
   * está sendo marcado — sem tempo de armar e sem precisão. Reaproveitar a
   * pressão evita um segundo caminho de "cansaço" que precisaria de calibração
   * própria, e o efeito na tela é o que o jogador já entende.
   *
   * Opcional para não quebrar save com partida pendente gravada antes disto.
   */
  energia?: number
  /**
   * O CORPO DO ATLETA (1.0.374) — altura em cm, pé bom e estrelas do pé ruim.
   *
   * Estavam na ficha desde a 1.0.322 sem entrar em conta nenhuma. Agora a
   * física os lê. Opcional pelo mesmo motivo da energia.
   */
  corpo?: {
    altura?: number
    pePreferido?: "direito" | "esquerdo" | "ambos"
    peFraco?: number
  }
}

// ─── Sorteio semeado ─────────────────────────────────────────────────────────
// Mesmo padrão do resto da carreira: nada de `Math.random` solto, para a mesma
// partida dar o mesmo resultado quando for preciso reproduzir um defeito.
function roll(semente: string): number {
  let h = 2166136261
  for (let i = 0; i < semente.length; i++) {
    h ^= semente.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return ((h >>> 0) % 100000) / 100000
}

/**
 * Com que frequência este atleta entra num lance decisivo.
 *
 * Não é um número fixo de lances por jogo. Depende de posição, de estar em campo
 * e de o time estar jogando — um atacante de um time dominado pode terminar a
 * partida com dois toques, e isso é correto: o pedido é explícito em não
 * inventar participação.
 */
// ⚠️ CALIBRADO, não escolhido. A primeira versão usava 0.16/minuto para o
// atacante: ~14 lances decisivos por jogo, e um atleta de 95 terminava com
// QUATRO gols por partida e o time invicto em 60 jogos. Isso é arcade, e pior:
// atropela a calibração de 20 mil jogos do motor, porque o placar passa a ser
// decidido por fora dele.
//
// Nos valores atuais um atacante recebe ~5 lances por jogo, dos quais ~1/3 são
// de finalização — ou seja, cerca de duas situações de gol, que é o que um
// centroavante realmente tem.
const ENVOLVIMENTO_POR_POSICAO: Record<string, number> = {
  ATA: 0.058, MEI: 0.054, VOL: 0.038, LD: 0.034, LE: 0.034, ZAG: 0.030, GOL: 0.022,
}

/**
 * O ritmo continua entre 8 e 16 lances, mas a FUNCAO em campo decide a faixa.
 * Antes todos recebiam o mesmo alvo aleatorio e a correcao de fim de jogo
 * (`faltam / minutosRestantes`) engolia a pequena diferenca de envolvimento:
 * em 40 partidas o teste media ATA 299 x ZAG 299. A posicao agora participa do
 * alvo, nao apenas de uma chance que seria sobrescrita depois.
 */
const RITMO_POR_POSICAO: Record<string, { minimo: number; maximo: number }> = {
  ATA: { minimo: 12, maximo: 16 },
  MEI: { minimo: 11, maximo: 15 },
  VOL: { minimo: 9, maximo: 13 },
  LD: { minimo: 9, maximo: 12 },
  LE: { minimo: 9, maximo: 12 },
  ZAG: { minimo: 8, maximo: 10 },
  GOL: { minimo: 8, maximo: 11 },
}

// ⚠️ VENCER O LANCE NÃO É MARCAR. Um chute bem executado ainda encontra goleiro,
// trave e zagueiro na linha. Sem este fator, "acertei a finalização" virava gol
// em ~87% das vezes para um atleta de 95 — e o artilheiro da liga fazia 150 gols
// na temporada. O passe decisivo converte um pouco mais: quem recebe já está em
// situação melhor do que quem chutou de fora.
const CONVERSAO_POR_EFEITO: Record<string, number> = {
  gol: 0.42, assistencia: 0.5, chance: 1, posse: 1, desarme: 1, defesa: 0.86,
}

/**
 * Semente numérica a partir do texto, para semear o motor.
 *
 * ⚠️ SEM ISTO A PARTIDA NÃO É REPRODUZÍVEL. Meu módulo já era determinístico
 * (escolha do lance, sorteio da execução), mas `tickMinute` cai em `Math.random`
 * enquanto ninguém chamar `semearMotorDePartida` — então a MESMA semente dava
 * placares diferentes, e o teste de determinismo pegou. Reproduzir uma partida é
 * o que torna possível depurar "meu gol não contou" com o relato do jogador.
 */
function sementeNumerica(texto: string): number {
  let h = 2166136261
  for (let i = 0; i < texto.length; i++) {
    h ^= texto.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

export function iniciarPartidaAoVivo(dados: {
  config: MatchConfig
  emCasa: boolean
  minutoDeEntrada: number
  minutoDeSaida: number | null
  semente: string
  atributos: Record<string, number>
  /** Posição do atleta — decide com que frequência ele entra num lance. */
  posicao: string
  /** Energia no apito inicial, 0 a 100. Entra na física como pressão. */
  energia?: number
  /**
   * QUANTO O CRAQUE DO ELENCO OLHA PARA VOCÊ — 0,78 a 1,22 (1.0.374).
   *
   * ⚠️ É O EFEITO MAIS CONCRETO DE TODA A CAMADA DE RELAÇÕES: ele muda quantas
   * vezes por partida o jogador é chamado a decidir. Um camisa 10 que não gosta
   * de você simplesmente não olha para o seu lado, e a sua partida fica mais
   * curta — o que se sente jogando, não num medidor.
   */
  fatorDeLances?: number
  /** Altura, pé bom e estrelas do pé ruim — lidos pela física (1.0.374). */
  corpo?: {
    altura?: number
    pePreferido?: "direito" | "esquerdo" | "ambos"
    peFraco?: number
  }
}): PartidaAoVivo {
  semearMotorDePartida(sementeNumerica(dados.semente))
  const minutosEmCampo = Math.max(1, (dados.minutoDeSaida ?? 90) - dados.minutoDeEntrada)
  const faixa = RITMO_POR_POSICAO[dados.posicao] ?? { minimo: 8, maximo: 14 }
  const alvoCheio = faixa.minimo
    + Math.floor(roll(`${dados.semente}:ritmo-nss:${dados.posicao}`) * (faixa.maximo - faixa.minimo + 1))
  return {
    estado: startMatch(createInitialState()),
    config: dados.config,
    emCasa: dados.emCasa,
    minutoDeEntrada: dados.minutoDeEntrada,
    minutoDeSaida: dados.minutoDeSaida,
    lancePendente: null,
    gols: 0,
    assistencias: 0,
    // 6.0 é a nota de quem jogou sem se destacar nem falhar — a mesma base que
    // o resto do jogo usa.
    nota: 6,
    historico: [],
    semente: dados.semente,
    lancesOferecidos: 0,
    metaDeLances: Math.max(3, Math.round(alvoCheio * minutosEmCampo / 90 * (dados.fatorDeLances ?? 1))),
    atributos: dados.atributos,
    posicao: dados.posicao,
    energia: dados.energia,
    corpo: dados.corpo,
  }
}

/** O atleta está em campo neste minuto? */
function emCampo(p: PartidaAoVivo, minuto: number): boolean {
  if (minuto < p.minutoDeEntrada) return false
  if (p.minutoDeSaida !== null && minuto >= p.minutoDeSaida) return false
  return true
}

export function partidaAcabou(p: PartidaAoVivo): boolean {
  return p.estado.phase === "fulltime"
}

/**
 * Simula até o próximo lance do atleta — ou até o apito final.
 *
 * ⚠️ ESTE LAÇO É O DO PRÓPRIO MOTOR. `simulateFullMatch` faz exatamente isto
 * (resolver VAR, resolver pênalti, `tickMinute`), só que sem parar. Repetir a
 * ordem aqui é deliberado: mudar a ordem faria o relógio girar em falso com um
 * pendente aberto, que é o defeito que o comentário do `tickMinute` descreve.
 */
export function avancarAteOLance(p: PartidaAoVivo): PartidaAoVivo {
  if (p.lancePendente || partidaAcabou(p)) return p

  // ⚠️ RE-SEMEIA A CADA RETOMADA. A semente do motor é GLOBAL: entre um lance e
  // o próximo, a carreira simula as outras partidas da rodada e re-semeia por
  // elas. Sem esta linha, retomar a sua partida continuaria de um gerador que
  // pertence a outro jogo — e a mesma partida deixaria de ser reproduzível no
  // meio dela mesma. O minuto entra na semente para a retomada não repetir os
  // mesmos sorteios do trecho já jogado.
  semearMotorDePartida(sementeNumerica(`${p.semente}:${p.estado.minute}`))

  let estado = p.estado
  let oferecidos = p.lancesOferecidos
  let voltas = 0

  while (estado.phase !== "fulltime" && voltas++ < 600) {
    if (estado.pendingVar) {
      estado = resolvePendingVar(estado)
      continue
    }
    if (estado.pendingPenalty) {
      estado = resolvePendingPenalty(estado, p.config, null).state
      continue
    }

    const antes = estado
    estado = tickMinute(estado, p.config)
    const minuto = estado.minute

    if (!emCampo(p, minuto)) continue
    // Um lance por minuto no máximo, e nunca dois seguidos: sem isto uma fase de
    // pressão viraria uma metralhadora de perguntas e o jogo deixaria de ser
    // partida para virar questionário.
    if (minuto === antes.minute) continue

    const meta = p.metaDeLances ?? 8
    const faltam = Math.max(0, meta - oferecidos)
    if (faltam <= 0) continue
    const minutosRestantes = Math.max(1, (p.minutoDeSaida ?? 90) - minuto)
    // A chance sobe conforme o relogio aperta, para entregar 8–16 lances curtos
    // numa partida inteira sem transformar cada minuto numa pergunta.
    const base = Math.max(ENVOLVIMENTO_POR_POSICAO[p.posicao] ?? 0.08, Math.min(0.72, faltam / minutosRestantes * 1.25))
    const sorteio = roll(`${p.semente}:envolvimento:${minuto}`)
    if (sorteio >= base) continue

    const placarPro = p.emCasa ? estado.home.goals : estado.away.goals
    const placarContra = p.emCasa ? estado.away.goals : estado.home.goals
    oferecidos++
    return {
      ...p,
      estado,
      lancesOferecidos: oferecidos,
      lancePendente: montarLance(p, minuto, placarPro, placarContra),
    }
  }

  return { ...p, estado, lancesOferecidos: oferecidos }
}

/**
 * O lance oferecido depende do CONTEXTO REAL — placar e minuto de agora.
 *
 * Perder por um a dez minutos do fim não é a mesma decisão que segurar uma
 * vitória; oferecer as mesmas opções nos dois casos é o que faz um modo de
 * carreira parecer um formulário.
 */
function montarLance(p: PartidaAoVivo, minuto: number, pro: number, contra: number): LanceDoAtleta {
  const perdendo = pro < contra
  const fimDeJogo = minuto >= 75
  const aperto = perdendo && fimDeJogo

  const sorteio = roll(`${p.semente}:tipo:${minuto}`)
  const indice = p.lancesOferecidos
  const tipoDoGoleiro: TipoDeLance = sorteio < 0.42 ? "defesa"
    : sorteio < 0.64 ? "saida_do_gol"
      : sorteio < 0.77 ? "penalti_defensivo" : "reposicao"
  const tipo: TipoDeLance = p.posicao === "GOL" ? tipoDoGoleiro
    : p.posicao !== "GOL" && indice === 2 ? "falta"
    : p.posicao !== "GOL" && (p.metaDeLances ?? 0) >= 10 && indice === 6 ? "penalti"
      : sorteio < 0.34 ? "finalizacao"
    : sorteio < 0.6 ? "passe_decisivo"
      : sorteio < 0.78 ? "drible"
        : sorteio < 0.9 ? "cruzamento" : "desarme"

  const opcoes: OpcaoDoLance[] = tipo === "defesa"
    ? [
        { id: "mergulhar", texto: "Mergulhar no canto", atributo: "defesa", risco: 0.42, efeito: "defesa" },
        { id: "fechar_angulo", texto: "Fechar o angulo e reagir", atributo: "posicionamento", risco: 0.25, efeito: "defesa" },
      ]
    : tipo === "saida_do_gol"
      ? [
          { id: "abafar", texto: "Sair e abafar", atributo: "fisico", risco: 0.46, efeito: "defesa" },
          { id: "esperar", texto: "Esperar sobre a linha", atributo: "defesa", risco: 0.32, efeito: "defesa" },
        ]
      : tipo === "penalti_defensivo"
        ? [
            { id: "defender_penalti", texto: "Escolher o canto e saltar", atributo: "defesa", risco: 0.52, efeito: "defesa" },
          ]
        : tipo === "reposicao"
          ? [
              { id: "lancar_reposicao", texto: "Lancar o contra-ataque", atributo: "passe", risco: 0.48, efeito: "assistencia" },
              { id: "repor_curto", texto: "Repor curto com seguranca", atributo: "passe", risco: 0.14, efeito: "posse" },
            ]
    : tipo === "falta"
    ? [
        { id: "bater_falta", texto: "Cobrar a falta com mira", atributo: "finalizacao", risco: 0.58, efeito: "gol" },
        { id: "rolar_falta", texto: "Rolar para a jogada ensaiada", atributo: "passe", risco: 0.24, efeito: "assistencia" },
      ]
    : tipo === "penalti"
      ? [
          { id: "bater_penalti", texto: "Cobrar o penalti com mira", atributo: "finalizacao", risco: 0.36, efeito: "gol" },
        ]
      : tipo === "finalizacao"
    ? [
        { id: "chutar", texto: "Chutar de primeira", atributo: "finalizacao", risco: aperto ? 0.5 : 0.55, efeito: "gol" },
        { id: "ajeitar", texto: "Ajeitar e bater colocado", atributo: "finalizacao", risco: 0.42, efeito: "gol" },
        { id: "tocar", texto: "Tocar para quem está melhor", atributo: "passe", risco: 0.22, efeito: "assistencia" },
      ]
    : tipo === "passe_decisivo"
      ? [
          { id: "profundidade", texto: "Lançar em profundidade", atributo: "passe", risco: 0.45, efeito: "assistencia" },
          { id: "curto", texto: "Tabelar curto e manter", atributo: "passe", risco: 0.15, efeito: "posse" },
          { id: "arriscar", texto: "Arriscar o passe entre os zagueiros", atributo: "visao", risco: 0.6, efeito: "assistencia" },
        ]
      : tipo === "drible"
        ? [
            { id: "encarar", texto: "Encarar o marcador", atributo: "drible", risco: 0.5, efeito: "chance" },
            { id: "proteger", texto: "Proteger a bola e esperar apoio", atributo: "fisico", risco: 0.2, efeito: "posse" },
          ]
        : tipo === "cruzamento"
          ? [
              { id: "cruzar", texto: "Cruzar na área", atributo: "passe", risco: 0.45, efeito: "assistencia" },
              { id: "recuar", texto: "Recuar e reorganizar", atributo: "passe", risco: 0.12, efeito: "posse" },
            ]
          : [
              { id: "dividir", texto: "Dividir com firmeza", atributo: "desarme", risco: 0.45, efeito: "desarme" },
              { id: "conter", texto: "Conter sem se expor", atributo: "posicionamento", risco: 0.18, efeito: "posse" },
            ]

  const narracao = tipo === "defesa" ? `${minuto}': finalizacao no canto. O gol depende da sua defesa.`
    : tipo === "saida_do_gol" ? `${minuto}': o atacante invade a area. Saia ou espere.`
      : tipo === "penalti_defensivo" ? `${minuto}': penalti contra. Leia o cobrador e escolha o canto.`
        : tipo === "reposicao" ? `${minuto}': bola dominada. Voce inicia a jogada.`
    : tipo === "falta" ? `${minuto}': falta na entrada da area. A cobranca e sua.`
    : tipo === "penalti" ? `${minuto}': PENALTI. Goleiro e bola — voce decide o canto.`
      : aperto
    ? `${minuto}': ${pro}-${contra} e o tempo correndo. A bola chega em você.`
    : `${minuto}': ${pro}-${contra}. A jogada passa por você.`

  // ⚠️ O CONTEXTO É SORTEADO UMA VEZ, AQUI, e vai junto com o lance (1.0.374).
  // Sortear na hora de resolver deixaria o jogador decidir sem saber de onde
  // está chutando — e é a distância, não a mira, que separa o cara a cara do
  // chute de fora.
  const dist = roll(`${p.semente}:dist:${minuto}`)
  const ladoDaJogada: "direito" | "esquerdo" =
    roll(`${p.semente}:pe:${minuto}`) < 0.5 ? "direito" : "esquerdo"

  // A bola vem alta em cruzamento; na área ela às vezes sobra pelo alto.
  const deCabeca = tipo === "cruzamento"
    || (tipo === "finalizacao" && roll(`${p.semente}:cab:${minuto}`) < 0.22)

  const contexto: ContextoDoChute = {
    // Finalização nasce mais perto; falta e o resto vêm de longe.
    distancia: tipo === "finalizacao" ? dist * 0.55 : tipo === "penalti" ? 0.12 : 0.35 + dist * 0.5,
    angulo: roll(`${p.semente}:ang:${minuto}`) * 0.8,
    // Apertado no fim: quem perde empurra e a marcação sobe.
    pressao: tipo === "penalti" ? 0.1 : 0.2 + roll(`${p.semente}:pre:${minuto}`) * 0.5 + (aperto ? 0.15 : 0),
    // ⚠️ NO PÊNALTI E NA FALTA ELE BATE COM O PÉ BOM, porque a bola está
    // parada e quem escolhe é o cobrador. Deixar o lado sorteado ali puniria
    // o canhoto por sorte, que é a definição de regra injusta.
    pe: tipo === "penalti" || tipo === "falta" ? undefined : ladoDaJogada,
    deCabeca: tipo === "penalti" || tipo === "falta" ? false : deCabeca,
    // Regra, não dificuldade: na cobrança o goleiro não pode adiantar.
    goleiroNaLinha: tipo === "penalti",
  }

  return {
    id: `lance_${minuto}`,
    minuto,
    tipo,
    placar: { pro, contra },
    narracao,
    opcoes,
    contexto,
    goleiro: qualidadeDoGoleiroAdversario(p),
    goleiroAltura: alturaDoGoleiroAdversario(p),
  }
}

/**
 * O GOLEIRO DO OUTRO LADO.
 *
 * ⚠️ SAI DA FORÇA DO ADVERSÁRIO, e não de um número fixo. Um lance contra o
 * lanterna e um contra o líder não podem valer o mesmo — se valessem, o clube
 * em que você joga e o adversário da rodada deixariam de importar, e o modo
 * viraria um simulador de mira sem futebol em volta.
 */
function qualidadeDoGoleiroAdversario(p: PartidaAoVivo): number {
  const forcaDeles = p.emCasa ? p.config.awayRating : p.config.homeRating
  return Math.max(35, Math.min(92, Math.round(forcaDeles)))
}

/**
 * A ALTURA DELE — semeada pelo adversário, estável na partida inteira.
 *
 * ⚠️ NÃO É SORTEADA POR LANCE. Se fosse, o mesmo goleiro encolheria e cresceria
 * entre um chute e outro da mesma partida, e o jogador que percebesse "esse é
 * baixinho, vou por cima" seria desmentido no lance seguinte sem motivo.
 */
function alturaDoGoleiroAdversario(p: PartidaAoVivo): number {
  const time = p.emCasa ? p.config.awayTeam : p.config.homeTeam
  const chave = time?.file_key ?? time?.nome ?? "sem-clube"
  return 178 + Math.round(roll(`${p.semente}:gk-altura:${chave}`) * 20)
}

export interface DesfechoDoLance {
  sucesso: boolean
  narracao: string
  deltaNota: number
  gol: boolean
  assistencia: boolean
  /**
   * A BOLA, quando o lance foi resolvido pela física (1.0.374).
   *
   * Traz a trajetória inteira e onde ela cruzou o plano do gol. É com isto que
   * a tela ANIMA o voo — e ver a bola é a diferença entre entender por que não
   * foi gol e achar que foi azar.
   */
  chute?: DesfechoDoChute
  /** Em lance defensivo: para onde o goleiro-atleta se jogou, −1 a +1. */
  ladoDefendido?: number
}

/**
 * Resolve o lance e DEVOLVE O RESULTADO À PARTIDA.
 *
 * ⚠️ É AQUI QUE O RESULTADO DEIXA DE SER PREDEFINIDO. Ao marcar, o gol entra no
 * `MatchState` — o placar da partida muda porque VOCÊ marcou, e a simulação
 * segue daí. Não há teto de participações contra um placar futuro, porque não
 * existe placar futuro: ele ainda não foi jogado.
 *
 * A execução continua decidida pelos ATRIBUTOS do atleta. Habilidade de leitura
 * do jogador escolhe a opção; o atleta é quem executa.
 */
/**
 * O LANCE RESOLVIDO PELA BOLA, e não por um número (1.0.374).
 *
 * ⚠️ SÓ FINALIZAÇÃO PASSA POR AQUI, de propósito. Passe, drible e desarme não
 * são "bola indo para o gol": não têm trave, não têm goleiro e não têm canto.
 * Forçá-los pela física exigiria inventar uma geometria para cada um — e
 * geometria inventada é pior que a probabilidade honesta que eles já usam.
 */
function resolverPorFisica(
  p: PartidaAoVivo,
  lance: LanceDoAtleta,
  chute: ChuteDoJogador,
): { partida: PartidaAoVivo; desfecho: DesfechoDoLance } {
  const contexto: ContextoDoChute = lance.contexto ?? { distancia: 0.35, angulo: 0.25, pressao: 0.35 }

  // ⚠️ A ENERGIA ENTRA COMO PRESSÃO. Um atleta arrastando aos 85 chuta como
  // quem está sendo marcado: sem tempo de armar e sem precisão. Reaproveitar a
  // pressão evita um segundo eixo de "cansaço" a calibrar do zero, e o efeito
  // na tela é o que o jogador já entende.
  const cansaco = (1 - Math.max(0, Math.min(100, p.energia ?? 100)) / 100) * 0.35
  const contextoReal: ContextoDoChute = {
    ...contexto,
    pressao: Math.min(1, contexto.pressao + cansaco),
  }

  const desfechoDoChute = resolverChute(
    chute,
    {
      finalizacao: atributoDoAtleta(p, "finalizacao"),
      fisico: atributoDoAtleta(p, "fisico"),
      drible: atributoDoAtleta(p, "drible"),
      altura: p.corpo?.altura,
      pePreferido: p.corpo?.pePreferido,
      peFraco: p.corpo?.peFraco,
    },
    { qualidade: lance.goleiro ?? 65, altura: lance.goleiroAltura },
    `${p.semente}:${lance.id}:chute`,
    contextoReal,
  )

  const gol = desfechoDoChute.tipo === "gol"
  // A nota reconhece o que aconteceu, e reconhece a TRAVE: acertar o poste é
  // uma finalização boa que não entrou, e tratá-la como erro seria injusto com
  // quem apontou certo.
  const delta = gol ? 1.2
    : desfechoDoChute.tipo === "trave" ? 0.25
      : desfechoDoChute.tipo === "defesa" ? 0.05
        : -0.35

  const estado = gol
    ? marcarGol(p.estado, p.emCasa, lance.minuto, "Gol do seu atleta")
    : p.estado

  return {
    partida: {
      ...p,
      estado,
      lancePendente: null,
      gols: p.gols + (gol ? 1 : 0),
      nota: Math.max(3, Math.min(10, Math.round((p.nota + delta) * 10) / 10)),
      historico: [...p.historico, { minuto: lance.minuto, texto: desfechoDoChute.texto, delta }],
    },
    desfecho: {
      sucesso: gol,
      narracao: desfechoDoChute.texto,
      deltaNota: delta,
      gol,
      assistencia: false,
      chute: desfechoDoChute,
    },
  }
}

/**
 * A DEFESA — o goleiro finalmente JOGA (1.0.374).
 *
 * ⚠️ ATÉ A 1.0.373 O GOLEIRO NÃO TINHA JOGO PRÓPRIO. Ele recebia as mesmas
 * opções de todo mundo — desarme, drible, finalização — e a defesa era um
 * `roll` como qualquer outra. Um modo que deixa você escolher ser goleiro e
 * depois não o faz defender está prometendo o que não entrega.
 *
 * Aqui a defesa é a MESMA geometria do ataque, lida do outro lado:
 *
 *   1. o adversário chuta — trajetória de verdade, semeada pelo lance;
 *   2. você escolhe PARA ONDE se jogar, antes de saber onde a bola vai;
 *   3. o que decide é a distância entre a sua mão e a bola.
 *
 * O atributo entra no ALCANCE (quanto você cobre) e a altura no alcance
 * VERTICAL — as mesmas duas grandezas que governam o goleiro adversário, e é
 * por isso que os dois lados são justos entre si.
 */
function resolverDefesaPorFisica(
  p: PartidaAoVivo,
  lance: LanceDoAtleta,
  mergulho: { x: number; y: number },
): { partida: PartidaAoVivo; desfecho: DesfechoDoLance } {
  const semente = `${p.semente}:${lance.id}:cobranca`
  const penalti = lance.tipo === "penalti_defensivo"

  // ⚠️ O COBRADOR TEM CORPO TAMBÉM, e sai da força do adversário. Um chute do
  // líder e um do lanterna não podem ser o mesmo problema — se fossem,
  // defender seria um exercício de mira solto do futebol em volta.
  const forcaDeles = p.emCasa ? p.config.awayRating : p.config.homeRating
  const cobrador = {
    finalizacao: Math.max(40, Math.min(95, Math.round(forcaDeles))),
    fisico: Math.max(40, Math.min(95, Math.round(forcaDeles * 0.95))),
    drible: Math.max(40, Math.min(95, Math.round(forcaDeles * 0.9))),
  }

  const chuteDeles: ChuteDoJogador = {
    alvo: {
      x: (roll(`${semente}:x`) * 2 - 1) * 0.82,
      y: 0.12 + roll(`${semente}:y`) * 0.72,
    },
    forca: penalti ? 0.72 + roll(`${semente}:f`) * 0.24 : 0.55 + roll(`${semente}:f`) * 0.4,
    efeito: (roll(`${semente}:e`) * 2 - 1) * 0.6,
  }

  const contexto: ContextoDoChute = {
    distancia: penalti ? 0.12 : (lance.contexto?.distancia ?? 0.3),
    angulo: penalti ? 0 : (lance.contexto?.angulo ?? 0.25),
    pressao: penalti ? 0.1 : 0.25,
    goleiroNaLinha: penalti,
  }

  const trajetoria = calcularTrajetoria(chuteDeles, cobrador, `${semente}:voo`, contexto)
  const { chegada } = trajetoria

  // Bola fora não é defesa nem gol: é bola fora. Tratá-la como defesa daria ao
  // goleiro o crédito de um erro do cobrador.
  const foraDoGol = Math.abs(chegada.x) > 1.05 || chegada.y > 1.05 || chegada.y < 0

  // ── O SEU ALCANCE ────────────────────────────────────────────────────────
  // Mesma mecânica do goleiro adversário: reflexo cobre chão, altura cobre
  // alto. A energia entra porque goleiro cansado no fim do jogo cai mais tarde.
  const reflexo = Math.max(1, Math.min(99, atributoDoAtleta(p, "defesa"))) / 100
  const energia = Math.max(0, Math.min(100, p.energia ?? 100)) / 100
  const altura = Math.max(165, Math.min(205, p.corpo?.altura ?? 186))
  const alcance = 0.92 * (0.45 + reflexo * 0.55) * trajetoria.tempoDeVoo * (0.85 + energia * 0.15)
  const escalaVertical = 0.75 * (1 - (altura - 186) / 100)

  const dx = chegada.x - mergulho.x
  const dy = (chegada.y - mergulho.y) * escalaVertical
  const distancia = Math.sqrt(dx * dx + dy * dy)

  // ⚠️ ERRAR O LADO CUSTA METADE, não custa tudo — quem se joga errado ainda
  // estica a perna. Zerar faria o chute com efeito ser gol garantido, e o
  // jogador perderia sem ter o que fazer diferente.
  const errouOLado = Math.sign(chegada.x) !== 0 && Math.sign(mergulho.x) !== 0
    && Math.sign(chegada.x) !== Math.sign(mergulho.x)
  const alcanceEfetivo = errouOLado ? alcance * 0.5 : alcance

  const defendeu = !foraDoGol && distancia <= alcanceEfetivo
  const gol = !foraDoGol && !defendeu

  const narracao = foraDoGol
    ? "Ele isolou. Nem precisou da sua mão."
    : defendeu
      ? (errouOLado
        ? "Você foi no outro canto e ainda pegou! Que reflexo."
        : penalti ? "DEFENDEU O PÊNALTI!" : "Defesa! A bola fica com você.")
      : (errouOLado ? "Você caiu no canto errado. Gol." : "Ela passa por baixo da sua mão. Gol.")

  const delta = defendeu ? (penalti ? 1.2 : 0.6) : gol ? (penalti ? -0.6 : -0.45) : 0.05

  const estado = gol
    ? marcarGol(p.estado, !p.emCasa, lance.minuto, "Gol sofrido pelo seu goleiro")
    : p.estado

  return {
    partida: {
      ...p,
      estado,
      lancePendente: null,
      nota: Math.max(3, Math.min(10, Math.round((p.nota + delta) * 10) / 10)),
      historico: [...p.historico, { minuto: lance.minuto, texto: narracao, delta }],
    },
    desfecho: {
      sucesso: defendeu,
      narracao,
      deltaNota: delta,
      gol: false,
      assistencia: false,
      chute: defendeu
        ? { tipo: "defesa", onde: chegada, trajetoria, ladoDoGoleiro: mergulho.x, texto: narracao }
        : foraDoGol
          ? { tipo: "fora", onde: chegada, trajetoria, texto: narracao }
          : { tipo: "gol", onde: chegada, trajetoria, texto: narracao },
      ladoDefendido: mergulho.x,
    },
  }
}

/** Lances em que o atleta é quem defende — o goleiro tem jogo próprio. */
const LANCES_DE_GOLEIRO: TipoDeLance[] = ["defesa", "saida_do_gol", "penalti_defensivo"]

export function resolverLance(
  p: PartidaAoVivo,
  opcaoId: string,
  precisaoMira = 1,
  /**
   * O CHUTE APONTADO (1.0.374).
   *
   * ⚠️ QUANDO ELE VEM, NÃO HÁ SORTEIO NENHUM no desfecho: a bola voa e o
   * resultado é geometria (`lib/fisica-do-chute`). Quando não vem — save
   * antigo, tela anterior, teste do módulo isolado — o lance cai no caminho
   * probabilístico de antes. Os dois convivem de propósito: um save com lance
   * pendente gravado antes desta versão não pode travar.
   */
  chute?: ChuteDoJogador,
): { partida: PartidaAoVivo; desfecho: DesfechoDoLance } {
  const lance = p.lancePendente
  const opcao = lance?.opcoes.find(o => o.id === opcaoId)
  if (!lance || !opcao) {
    return { partida: p, desfecho: { sucesso: false, narracao: "", deltaNota: 0, gol: false, assistencia: false } }
  }

  // ── CAMINHO DA FÍSICA ────────────────────────────────────────────────────
  // Defesa primeiro: no lance de goleiro o `chute` que chega é o MERGULHO, não
  // uma finalização, e confundir os dois faria o goleiro chutar para o próprio
  // gol. O tipo do lance é o que separa, não a opção escolhida.
  if (chute && LANCES_DE_GOLEIRO.includes(lance.tipo)) {
    return resolverDefesaPorFisica(p, lance, chute.alvo)
  }
  if (chute && opcao.efeito === "gol") {
    return resolverPorFisica(p, lance, chute)
  }

  // O atributo vem de fora (a carreira o injeta em `config`), com 60 de piso
  // para o módulo continuar utilizável em teste isolado.
  const valor = atributoDoAtleta(p, opcao.atributo)
  const execucao = Math.max(0.08, Math.min(0.94, (valor / 100) * 1.35 - opcao.risco * 0.75))
  const qualidadeDaMira = Math.max(0.2, Math.min(1, precisaoMira))
  const chance = execucao * (CONVERSAO_POR_EFEITO[opcao.efeito] ?? 1) * (0.45 + qualidadeDaMira * 0.55)
  const sucesso = roll(`${p.semente}:${lance.id}:${opcaoId}`) < chance

  let gol = false
  let assistencia = false
  let delta: number
  let narracao: string
  let estado = p.estado

  if (sucesso) {
    if (opcao.efeito === "gol") {
      gol = true
      delta = 1.2
      narracao = "GOL! Você resolve."
      estado = marcarGol(estado, p.emCasa, lance.minuto, "Gol do seu atleta")
    } else if (opcao.efeito === "assistencia") {
      assistencia = true
      delta = 0.8
      narracao = "Assistência! O passe encontrou o gol."
      estado = marcarGol(estado, p.emCasa, lance.minuto, "Gol com assistência sua")
    } else if (opcao.efeito === "chance") {
      delta = 0.45
      narracao = "Jogada vencida — o time chega com perigo."
    } else if (opcao.efeito === "defesa") {
      delta = lance.tipo === "penalti_defensivo" ? 1 : 0.55
      narracao = lance.tipo === "penalti_defensivo" ? "DEFENDEU! Voce vence o cobrador." : "Defesa feita — o gol esta protegido."
    } else if (opcao.efeito === "desarme") {
      delta = 0.4
      narracao = "Bola recuperada."
    } else {
      delta = 0.2
      narracao = "Bem resolvido, sem sustos."
    }
  } else {
    delta = opcao.risco >= 0.5 ? -0.4 : -0.2
    if (["defesa", "saida_do_gol", "penalti_defensivo"].includes(lance.tipo)) {
      delta = lance.tipo === "penalti_defensivo" ? -0.8 : -0.55
      narracao = "Gol adversario. A bola passa pela tentativa de defesa."
      estado = marcarGol(estado, !p.emCasa, lance.minuto, "Gol sofrido pelo seu goleiro")
    } else {
      narracao = opcao.risco >= 0.5
        ? "Não deu. A jogada morre nos pés do adversário."
        : "Escolha segura, mas o lance se perde."
    }
  }

  return {
    partida: {
      ...p,
      estado,
      lancePendente: null,
      gols: p.gols + (gol ? 1 : 0),
      assistencias: p.assistencias + (assistencia ? 1 : 0),
      nota: Math.max(3, Math.min(10, Math.round((p.nota + delta) * 10) / 10)),
      historico: [...p.historico, { minuto: lance.minuto, texto: narracao, delta }],
    },
    desfecho: { sucesso, narracao, deltaNota: delta, gol, assistencia },
  }
}

/**
 * Põe o gol no placar da partida em curso.
 *
 * ⚠️ ESCREVE DIRETO NO `MatchState` de propósito, sem passar pelo motor. O motor
 * marca gols a partir das PROBABILIDADES dele; este gol veio de outra
 * autoridade — a sua execução. Empurrá-lo por dentro do motor exigiria uma via
 * de injeção que hoje não existe e que todo consumidor teria de entender.
 *
 * O evento entra na lista com `important: true` para aparecer na narração como
 * qualquer outro gol.
 */
function marcarGol(estado: MatchState, emCasa: boolean, minuto: number, texto: string): MatchState {
  const lado = emCasa ? "home" : "away"
  const time = estado[lado]
  return {
    ...estado,
    [lado]: { ...time, goals: time.goals + 1, shots: time.shots + 1, shotsOnTarget: time.shotsOnTarget + 1 },
    flash: { side: lado, type: "goal" },
    events: [
      { minute: minuto, type: "goal", side: lado, text: texto, important: true } as MatchState["events"][number],
      ...estado.events,
    ],
  }
}

/** Piso 60 só para o módulo continuar utilizável em teste isolado. */
function atributoDoAtleta(p: PartidaAoVivo, nome: string): number {
  return p.atributos[nome] ?? 60
}
