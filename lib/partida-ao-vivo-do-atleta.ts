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
    metaDeLances: Math.max(3, Math.round(alvoCheio * minutosEmCampo / 90)),
    atributos: dados.atributos,
    posicao: dados.posicao,
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

  return { id: `lance_${minuto}`, minuto, tipo, placar: { pro, contra }, narracao, opcoes }
}

export interface DesfechoDoLance {
  sucesso: boolean
  narracao: string
  deltaNota: number
  gol: boolean
  assistencia: boolean
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
export function resolverLance(p: PartidaAoVivo, opcaoId: string, precisaoMira = 1): { partida: PartidaAoVivo; desfecho: DesfechoDoLance } {
  const lance = p.lancePendente
  const opcao = lance?.opcoes.find(o => o.id === opcaoId)
  if (!lance || !opcao) {
    return { partida: p, desfecho: { sucesso: false, narracao: "", deltaNota: 0, gol: false, assistencia: false } }
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
