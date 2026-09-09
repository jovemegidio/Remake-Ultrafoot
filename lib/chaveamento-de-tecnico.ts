// PASSAR O COMPUTADOR — o que troca quando muda o técnico da vez.
//
// O problema, em uma frase
// ────────────────────────
// O estado do motor (`useGameEngine`) foi escrito para UM clube. Com vários
// técnicos humanos no mesmo save, metade desse estado pertence ao CLUBE de quem
// está jogando (elenco, caixa, táticas, olheiros) e a outra metade pertence ao
// MUNDO (rodada, tabelas, artilharia, resultados) — e o mundo é um só.
//
// Trocar de técnico é: guardar a metade do clube de quem sai, e devolver a
// metade do clube de quem entra. O mundo fica onde está.
//
// ⚠️ O MODO DE FALHA É SILENCIOSO E GRAVE. Se um campo de clube ficar de fora da
// lista, ele NÃO é trocado — e o técnico que entra vê o dado do anterior: o
// elenco do rival, o caixa do rival, a escalação do rival. Nada disso dá erro;
// dá um jogo incoerente que ninguém consegue explicar.
//
// Por isso as duas listas abaixo são FECHADAS e conferidas por teste contra o
// estado real do motor: campo novo que ninguém classificou reprova o
// `scripts/test-chaveamento-de-tecnico.ts`. Esse teste existe justamente porque
// o motor cresce, e uma lista escrita à mão envelhece em silêncio.

/**
 * O que pertence ao CLUBE do técnico. Vai para o bolso dele ao passar a vez.
 *
 * Regra para classificar campo novo: pergunte "dois técnicos no mesmo save
 * teriam valores diferentes disto?". Elenco, sim. Tabela do Brasileirão, não.
 */
export const CAMPOS_DO_CLUBE = [
  "myTeamShort",
  // Elenco e pessoas
  "squadPlayers", "squadMorale", "squadCohesion", "affinityGroups",
  "entrosamentoPares", "entrosamentoSemeado", "fadigaCronica",
  "minutosNaViradaDaSemana", "groupActionCooldowns",
  "playerMeetings", "meetingCooldowns",
  // Tática e escalação
  "teamTactics", "formation", "playerInstructions", "tacticalAssignments",
  "tacticalPlayerPositions", "tacticalPlayerMovements", "setPieceTakers",
  // Treino
  "planoDeTreino", "posturaDaSemana", "ultimoTreino",
  // Plano de treino automatico: e decisao DO TECNICO, entao viaja com ele na
  // carreira de mesa. Sem estas duas, trocar de tecnico no co-op devolveria o
  // elenco as regras padrao sem ninguem ter mexido nelas.
  "regrasDePlanoDeTreino", "planoManualPorAtleta",
  // Dinheiro do clube — o caixa é POR CLUBE, nunca por técnico
  "balance", "weeklyIncome", "weeklyExpenses", "transferBudget", "wageBudget",
  "vendasDeJovensPagas", "marketingContracts", "ticketTier",
  // Cláusulas do negócio (1.0.383). Do CLUBE pela mesma razão do caixa: a
  // parcela que o Palmeiras deve pelo reforço não vira dívida do Santos
  // quando o outro técnico assume a vez, e o direito de recomprar uma cria é
  // de quem a vendeu. A pergunta da regra acima ("dois técnicos no mesmo save
  // teriam valores diferentes disto?") responde sim nos dois casos.
  "parcelasDeTransferencia", "recompras",
  // Mercado do ponto de vista deste clube (o mercado em si é do mundo)
  "transferOffers", "pendingIncomingTransfers", "pendingOutgoingTransfers",
  "marketInterests", "transferListedIds", "loanListedIds",
  // Observação e análise
  "scouts", "discoveredPlayers", "scoutedLeads", "opponentAnalyses",
  "performanceReports", "postMatchAnalyses",
  // Imprensa
  "pressConferences", "nextPressConference", "currentConferenceResponses",
  // Estrutura e comissão
  "staffMembers", "clubInfrastructure", "infraUpgradesInProgress",
  "pendingFundOffers", "pendingEvents",
] as const

/**
 * O TEMPO. É o único estado do motor que é rigorosamente igual para todos.
 *
 * ⚠️ Trocar qualquer um destes quebraria o modo inteiro: cada técnico passaria a
 * viver numa rodada própria, que é exatamente o oposto de um save compartilhado.
 */
export const CAMPOS_DO_TEMPO = [
  "currentWeek", "currentSeason", "isPaused",
  "nationalTeamCalls", "fifaDates",
  "contractsAbsoluteMigrated",
] as const

/**
 * O que pertence à LIGA — nem ao técnico, nem ao mundo inteiro.
 *
 * ⚠️ ESTA LISTA É A CORREÇÃO DE UM ERRO DE CLASSIFICAÇÃO. Estes campos estavam
 * em `CAMPOS_DO_MUNDO`, como se a tabela fosse uma só. Ela não é: apesar do
 * nome, `serieAStandings` é a tabela DA LIGA DE QUEM ESTÁ JOGANDO — o
 * `initializeNewGame` a preenche com `getUserLeagueTeams(...)`. Enquanto todo
 * mundo na mesa jogava a mesma liga isso não aparecia. Desde a 1.0.304 cada
 * técnico escolhe o país dele, e um técnico da Premier League passaria a
 * enxergar a tabela do Brasileirão do vizinho — e a gravar os resultados dele
 * lá dentro.
 *
 * A chave é a LIGA, não o técnico, e essa diferença é o ponto: dois técnicos no
 * mesmo campeonato precisam dividir a MESMA tabela (senão cada um teria a sua
 * versão do próprio campeonato), e dois em campeonatos diferentes não podem
 * dividir nada.
 */
export const CAMPOS_DA_LIGA = [
  "serieAStandings", "serieBStandings", "lastSeasonStandings",
  "copaBrasil", "matchResults", "headToHeadRecords", "topScorers",
] as const

/**
 * Tudo que NÃO é do clube. Mantida porque a divisão em duas metades continua
 * sendo a forma certa de conferir a lista do clube — o que mudou foi que a
 * metade de fora tem dois donos diferentes (o tempo e a liga).
 */
export const CAMPOS_DO_MUNDO = [...CAMPOS_DO_TEMPO, ...CAMPOS_DA_LIGA] as const

export type CampoDoClube = (typeof CAMPOS_DO_CLUBE)[number]

/** O bolso de um técnico: só os campos do clube dele. */
export type EstadoDoClube = Record<string, unknown>

/**
 * Guarda a metade-clube do estado atual. Chamado ANTES de trocar de técnico.
 *
 * Copia por referência de propósito: o motor já trata seu estado como imutável
 * (todo `set` devolve objeto novo), então guardar a referência é suficiente e
 * evita clonar um elenco inteiro a cada troca de vez.
 */
export function guardarEstadoDoClube(estado: Record<string, unknown>): EstadoDoClube {
  const bolso: EstadoDoClube = {}
  for (const campo of CAMPOS_DO_CLUBE) {
    if (campo in estado) bolso[campo] = estado[campo]
  }
  return bolso
}

/**
 * Devolve a metade-clube de quem entra.
 *
 * ⚠️ Técnico que ainda não tem bolso (primeira vez que senta) recebe `null`, e
 * quem chama precisa MONTAR o estado do clube dele a partir do mundo — nunca
 * herdar o que estava na tela, que é o do técnico anterior.
 */
export function restaurarEstadoDoClube(
  bolsos: Record<string, EstadoDoClube | undefined> | undefined,
  tecnicoId: string,
): EstadoDoClube | null {
  const bolso = bolsos?.[tecnicoId]
  if (!bolso) return null
  const saida: EstadoDoClube = {}
  for (const campo of CAMPOS_DO_CLUBE) {
    if (campo in bolso) saida[campo] = bolso[campo]
  }
  return saida
}

/**
 * Confere se um bolso está completo antes de aplicá-lo.
 *
 * Devolve os campos que faltam. Aplicar bolso incompleto é o mesmo defeito de
 * não trocar: o campo ausente fica com o valor do técnico anterior.
 */
export function camposFaltandoNoBolso(bolso: EstadoDoClube): string[] {
  return CAMPOS_DO_CLUBE.filter(campo => !(campo in bolso))
}

/**
 * Guarda a metade-MUNDO do estado, para devolvê-la depois de operações que a
 * atropelam.
 *
 * ⚠️ EXISTE POR UM MOTIVO CONCRETO. Carregar o clube de um técnico que nunca
 * sentou passa por `initializeGame`, e ele NÃO é só do clube: zera
 * `currentWeek`, `currentSeason`, `matchResults` e a tabela. Chamado no meio de
 * uma carreira compartilhada, mandaria todos os técnicos de volta para a rodada
 * zero — e o save já teria sido gravado assim. A saída é guardar o mundo antes e
 * devolvê-lo por cima, que é o que a lista `CAMPOS_DO_MUNDO` torna possível.
 */
export function guardarEstadoDoMundo(estado: Record<string, unknown>): Record<string, unknown> {
  const mundo: Record<string, unknown> = {}
  for (const campo of CAMPOS_DO_MUNDO) {
    if (campo in estado) mundo[campo] = estado[campo]
  }
  return mundo
}

/** Só o tempo — o que vale para a mesa inteira, independentemente da liga. */
export function guardarEstadoDoTempo(estado: Record<string, unknown>): Record<string, unknown> {
  const tempo: Record<string, unknown> = {}
  for (const campo of CAMPOS_DO_TEMPO) {
    if (campo in estado) tempo[campo] = estado[campo]
  }
  return tempo
}

/** A tabela, a artilharia e a copa da liga que está na tela. */
export function guardarEstadoDaLiga(estado: Record<string, unknown>): Record<string, unknown> {
  const liga: Record<string, unknown> = {}
  for (const campo of CAMPOS_DA_LIGA) {
    if (campo in estado) liga[campo] = estado[campo]
  }
  return liga
}

/**
 * A liga de um técnico, como chave do arquivo por liga.
 *
 * Dois técnicos no MESMO campeonato têm de cair na mesma chave — é o que faz a
 * tabela ser uma só para os dois. `divisao` já é isso: `serie_a`,
 * `premier_league`, `la_liga`. O país entra junto porque nomes de divisão se
 * repetem entre bases (há mais de uma "serie_a" no mundo).
 */
export function chaveDaLiga(pais: string | null | undefined, divisao: string | null | undefined): string {
  return `${(pais ?? "").trim().toLowerCase()}|${(divisao ?? "serie_a").trim().toLowerCase()}`
}

// ─── A SEGUNDA METADE: O SAVE ────────────────────────────────────────────────
//
// ⚠️ TROCAR SÓ O MOTOR NÃO BASTA, e é por isto que o modo não funcionava.
//
// O motor (`useGameEngine`) guarda o elenco, o caixa e a tática. Mas a CARREIRA
// — o calendário, a tabela, a liga, a divisão, as finanças, o histórico — mora
// no SAVE (`GameState`, em `lib/save-system.ts`), e o save não era trocado. O
// resultado prático: o segundo técnico sentava com o elenco dele e o CALENDÁRIO
// do primeiro. Jogava os jogos do rival, contra os adversários do rival, e o
// resultado ia para a tabela do rival.
//
// As duas listas abaixo dividem o save do mesmo jeito que as de cima dividem o
// motor, e pela mesma pergunta: "dois técnicos no mesmo save teriam valores
// diferentes disto?".

/**
 * O que no SAVE pertence à carreira de um técnico. Vai para o bolso dele.
 *
 * É a lista longa de propósito: quase tudo que uma carreira acumula é de quem a
 * viveu. Só o mundo, a mesa e as preferências da máquina ficam de fora.
 */
export const CAMPOS_DE_SAVE_DO_TECNICO = [
  // Identidade de quem joga e do clube dele
  "selectedTeamShort", "selectedTeam", "managerName", "managerAvatar",
  "managerProfile26", "bookmarks26", "selectedUniform", "saveName",
  // Elenco e base
  "squadPlayers", "youthPlayers", "youthMarketPurchasedIds", "youthDeparted",
  "youthSeededSeason", "youthTryoutStamp", "youthCareerStartSeason",
  "youthAutoPromotedSeason", "youthAgedSeason", "youthBoardCheckWeek", "youthCareer",
  // O técnico como personagem
  "coachSkills", "coachXP", "coachCrisisCount", "coachWinStreak", "coachTotalTitles",
  "coachLegacy", "preOfficeVisitado", "contratadoEm", "passagens",
  // Evolução do treinador (1.0.305). É de QUEM joga, não do mundo: numa mesa,
  // o que o Gustavo aprendeu não pertence ao João. Classificado aqui porque a
  // guarda do teste pegou o campo novo sem dono — que é exatamente para o que
  // ela existe.
  "managerGrowth26",
  // Conduta do treinador (1.0.377). Pela MESMA razão do `managerGrowth26`: numa
  // mesa de co-op, a expulsão do banco e a coletiva agressiva sao de quem
  // falou. Se fossem do mundo, o tecnico seguinte a sentar herdaria a ficha
  // suja do anterior e seria demitido pelo que o colega fez.
  "incidentesDoTreinador",
  // Diretoria e vestiário
  "pedidosADiretoria", "boardConfidence", "boardConfidenceBonus", "metaDaDiretoria",
  "promessasAoAtleta", "promessasQuebradas", "resolvedDressingRoomEvents", "teamMorale",
  // Seleção — é um cargo do técnico, não do mundo
  "nationalCareer", "pendingNationalOffers", "declinedNationalTeamIds",
  "lastNationalOfferSeason", "managingNationalTeamId", "nationalCalls",
  "nationalCuts", "nationalFriendlies", "finalissima",
  // Dinheiro e estrutura do clube
  "balance", "debt", "debtByClub", "finances", "scoutingDepartment", "stadiumPitch",
  "estadioSetores", "fanBase", "torcidaOrganizadas", "planoDeSocio",
  "sponsorOffers", "activeSponsors", "gestao282",
  // Mercado do ponto de vista deste clube
  "transfers", "propostasEnviadas", "lancesEmLeilao", "leilaoVencido", "leiloesDeVenda",
  "relacoesComAgentes", "pedidoDeAgente", "preContratos", "renewalStatus",
  // ⚠️ O CALENDÁRIO. É a parte que faltava: cada técnico disputa a liga DELE, e
  // desde a 1.0.304 pode ser a de outro país.
  //
  // O calendário fica AQUI, e não na liga, porque ele não é só a liga: leva o
  // estadual, as copas e os amistosos, que são do clube. Dois técnicos no mesmo
  // campeonato recebem calendários de liga IDÊNTICOS mesmo assim —
  // `generateSeasonFixtures` é determinístico sobre a lista de clubes, e o
  // `userTeamCurto` só decide qual jogo ganha a marca `isUserMatch`.
  "divisionOverride", "leagueTeams", "divisionMovement", "currentRound",
  "fixtures", "completedFixtureKeys", "results", "seasonHistory",
  "amistososAgendados", "dataFifaTreinada", "torneioAmistoso",
  // Consequências da temporada
  "injuries", "playerFatigue", "seasonAwards", "prestigioDosAtletas",
  "activeChallenge", "desafiosConcluidos",
] as const

/**
 * O que no SAVE é da MESA ou do MUNDO. NÃO é trocado.
 *
 * Três coisas diferentes convivem aqui, e todas se comportam igual (uma só cópia
 * para todos): o mundo simulado (`universo286`, a pirâmide, a IA), o registro da
 * mesa (a lista de técnicos e a rodada compartilhada) e as preferências da
 * MÁQUINA — volume, idioma, controle —, que são de quem está no sofá e não
 * fariam sentido trocar a cada vez.
 */
export const CAMPOS_DE_SAVE_DO_MUNDO = [
  // O save em si
  // ⚠️ `diaDaRodada` fica AQUI, colado em `week`, e nao na lista do tecnico — e
  // o portao me obrigou a decidir isso, com razao. O cursor diz que dia e
  // dentro do intervalo entre duas rodadas (1.0.397); numa carreira de mesa os
  // tecnicos compartilham UM calendario, e um cursor por tecnico faria a data
  // do cabecalho mudar a cada troca de vez — dois tecnicos na mesma mesa em
  // dias diferentes da mesma semana. Na pratica ele nem se move em co-op (o
  // avanco dia a dia so vale para mesa de um tecnico so, ver game-header), mas
  // classifica-lo certo importa para quando alguem ligar as duas coisas.
  "version", "careerId", "createdAt", "updatedAt", "season", "week", "diaDaRodada",
  // A mesa
  "tecnicos", "tecnicoAtivoId", "rodadaCompartilhada", "estadoPorTecnico",
  "saveDoTecnico", "estadoPorLiga", "managers", "activeManagerId", "multiplayerEnabled",
  // O mundo simulado — um só, e é o ponto do modo
  "universo286", "clubDivisions", "demissoesMundo", "posturasDaIA", "socialDaIA",
  "transferRoom26", "dificuldade", "configuracoesIniciais283",
  // Preferências da máquina
  "language", "campoHorizontal", "controllerType", "controllerBindings",
  "commentaryEnabled", "commentaryVoice", "commentaryVolume", "sfxVolume",
  "matchSpeed", "notificationsEnabled", "autoSaveInterval", "lastAutoSaveMatchCount",
  // ⚠️ ACRESCENTADOS DEPOIS, E O GATE COBROU (1.0.356). Campo novo no save que
  // ninguém classifica não fica "neutro": no co-op ele viaja no bolso de um
  // técnico ou some na troca, e o defeito aparece semanas depois como
  // "minha configuração mudou sozinha".
  //
  //  · `multiplayerDefinidoPeloJogador` — a decisão sobre o online é da MÁQUINA,
  //    como o volume: quem desligou no sofá desligou para os dois.
  //  · `painelDoAtletaRecolhido` — preferência de tela, mesma família.
  //  · `modalidade` — o que ESTE save é (profissional, feminino, sub-20, atleta).
  //    Não muda por técnico; se mudasse, um co-op viraria dois jogos diferentes.
  //  · `carreiraDeJogador` — a carreira de atleta inteira. Ela nem convive com
  //    co-op de técnicos, e por isso não pode ser tratada como metade de ninguém.
  "multiplayerDefinidoPeloJogador", "painelDoAtletaRecolhido",
  "modalidade", "carreiraDeJogador",
] as const

/**
 * O que no SAVE é da LIGA. Arquivado pela liga, não pelo técnico.
 *
 * `standings` é a tabela que a tela de classificação mostra. Dois técnicos no
 * mesmo campeonato têm de ver a MESMA — e é justamente por isso que ela não pode
 * viajar no bolso de nenhum dos dois.
 */
export const CAMPOS_DE_SAVE_DA_LIGA = ["standings"] as const

export type EstadoDeSaveDoTecnico = Record<string, unknown>

/**
 * Guarda a metade-carreira do save de quem está saindo.
 *
 * Só grava campo PRESENTE: o save tem dezenas de campos opcionais, e escrever
 * `undefined` para os ausentes faria o bolso "apagar" na restauração aquilo que
 * o técnico nunca teve — que é o mesmo defeito, ao contrário.
 */
export function guardarSaveDoTecnico(save: Record<string, unknown>): EstadoDeSaveDoTecnico {
  const bolso: EstadoDeSaveDoTecnico = {}
  for (const campo of CAMPOS_DE_SAVE_DO_TECNICO) {
    if (campo in save && save[campo] !== undefined) bolso[campo] = save[campo]
  }
  return bolso
}

/**
 * Devolve a metade-carreira de quem entra.
 *
 * `null` = ele nunca sentou, e quem chama precisa CRIAR a carreira dele do zero
 * pelo mesmo caminho que uma carreira solo — nunca herdar o que está na tela.
 */
export function restaurarSaveDoTecnico(
  bolsos: Record<string, EstadoDeSaveDoTecnico | undefined> | undefined,
  tecnicoId: string,
): EstadoDeSaveDoTecnico | null {
  const bolso = bolsos?.[tecnicoId]
  if (!bolso) return null
  const saida: EstadoDeSaveDoTecnico = {}
  for (const campo of CAMPOS_DE_SAVE_DO_TECNICO) {
    if (campo in bolso) saida[campo] = bolso[campo]
  }
  return saida
}

/** A parte do save que fica arquivada pela liga (hoje, a tabela). */
export function guardarSaveDaLiga(save: Record<string, unknown>): Record<string, unknown> {
  const bolso: Record<string, unknown> = {}
  for (const campo of CAMPOS_DE_SAVE_DA_LIGA) {
    if (campo in save && save[campo] !== undefined) bolso[campo] = save[campo]
  }
  return bolso
}

/**
 * TUDO QUE PERTENCE A UMA LIGA — o do motor e o do save, num pacote só.
 *
 * É o que é guardado e devolvido ao passar a vez entre técnicos de campeonatos
 * diferentes.
 */
export interface ArquivoDaLiga {
  motor: Record<string, unknown>
  save: Record<string, unknown>
}
