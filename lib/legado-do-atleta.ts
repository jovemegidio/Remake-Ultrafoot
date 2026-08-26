/**
 * O LEGADO (1.0.374) — a carreira termina com um NÚMERO, e o número tem juiz.
 *
 * ─── O BURACO QUE ISTO FECHA ────────────────────────────────────────────────
 *
 * Até a 1.0.373 a carreira de jogador acabava assim: o atleta chegava aos 38,
 * um recado dizia quantos jogos ele fez, e o save ficava parado para sempre.
 * Não havia pontuação, não havia conquista, não havia com o que comparar. Dez
 * temporadas de decisões terminavam em uma frase.
 *
 * Isso não é um detalhe de apresentação. Um modo de carreira sem placar final
 * não dá ao jogador nenhum motivo para recomeçar melhor — e recomeçar melhor é
 * a única coisa que uma carreira de jogador pede depois de terminada.
 *
 * ─── AS TRÊS PEÇAS ──────────────────────────────────────────────────────────
 *
 *   PONTUAÇÃO   um número só, de tudo o que a carreira foi.
 *   CONQUISTAS  marcos que o jogador desbloqueia DURANTE a carreira, não no
 *               fim — senão ele joga dez temporadas no escuro.
 *   RANKING     onde essa carreira ficou entre as suas outras e entre as
 *               lendas de referência.
 *
 * ─── A REGRA QUE MANTÉM A PONTUAÇÃO HONESTA ─────────────────────────────────
 *
 * ⚠️ ELA NÃO PODE SER MAXIMIZÁVEL POR UMA COISA SÓ. Se gol valesse muito, a
 * resposta ótima seria "seja atacante e nada mais", e um zagueiro genial
 * terminaria atrás de um centroavante medíocre. Por isso a pontuação pesa por
 * EIXOS que competem entre si — longevidade, produção, troféus, prestígio e
 * regularidade — e cada eixo tem TETO próprio. Estourar um não compensa
 * abandonar os outros.
 *
 * ⚠️ E O DINHEIRO NÃO PONTUA. Um atleta que ganhou 200 milhões e não ganhou
 * nada em campo teve uma carreira rica, não uma grande carreira. O cassino
 * entra na conta pelo lado oposto: como DESCONTO, porque uma carreira dissipada
 * fora de campo é parte do que ela foi.
 */

export interface FolhaDaCarreira {
  nome: string
  posicao: string
  temporadas: number
  jogos: number
  gols: number
  assistencias: number
  notaMedia: number
  titulos: number
  premios: number
  overallMaximo: number
  prestigioMaximo: number
  selecaoJogos: number
  selecaoGols: number
  /** Negativo = o cassino levou. Entra como desconto. */
  saldoNoCassino: number
  noitesNoCassino: number
  reputacaoFinal: number
}

export interface EixoDaPontuacao {
  id: string
  nome: string
  pontos: number
  teto: number
  explicacao: string
}

export interface PontuacaoDaCarreira {
  total: number
  eixos: EixoDaPontuacao[]
  /** Desconto já aplicado no total. Sempre ≤ 0. */
  desconto: number
  patamar: string
}

const limitar = (v: number, teto: number) => Math.max(0, Math.min(teto, Math.round(v)))

/**
 * A PONTUAÇÃO FINAL.
 *
 * Os tetos somam 1000. Um número redondo não é enfeite aqui: ele deixa o
 * jogador ler a própria carreira sem tabela ("fiz 640 de 1000, perdi quase
 * tudo em troféus"), e é o que permite comparar dois atletas de posições
 * diferentes sem que a comparação seja injusta por construção.
 */
export function pontuacaoDaCarreira(r: FolhaDaCarreira): PontuacaoDaCarreira {
  const eixos: EixoDaPontuacao[] = [
    {
      id: "longevidade",
      nome: "Longevidade",
      // ⚠️ JOGOS, NÃO TEMPORADAS. Quem passou cinco anos no banco não teve uma
      // carreira longa — teve um contrato longo, que é outra coisa.
      pontos: limitar(r.jogos * 0.42, 200),
      teto: 200,
      explicacao: `${r.jogos} partidas disputadas`,
    },
    {
      id: "producao",
      nome: "Produção",
      // Assistência vale quase o mesmo que gol de propósito: sem isso, todo
      // meia e todo lateral nasceriam com metade da pontuação disponível.
      pontos: limitar(r.gols * 2.2 + r.assistencias * 1.8, 220),
      teto: 220,
      explicacao: `${r.gols} gols e ${r.assistencias} assistências`,
    },
    {
      id: "titulos",
      nome: "Troféus",
      pontos: limitar(r.titulos * 26 + r.premios * 18, 220),
      teto: 220,
      explicacao: `${r.titulos} títulos e ${r.premios} prêmios individuais`,
    },
    {
      id: "patamar",
      nome: "Patamar",
      // Onde ele chegou: o teto do talento e o tamanho dos clubes que o
      // quiseram. É o eixo que separa o ídolo de província do craque mundial.
      pontos: limitar((r.overallMaximo - 55) * 3.4 + (r.prestigioMaximo - 40) * 1.6, 190),
      teto: 190,
      explicacao: `overall ${r.overallMaximo} no auge, clube de prestígio ${r.prestigioMaximo}`,
    },
    {
      id: "selecao",
      nome: "Seleção",
      pontos: limitar(r.selecaoJogos * 1.6 + r.selecaoGols * 3, 90),
      teto: 90,
      explicacao: `${r.selecaoJogos} jogos e ${r.selecaoGols} gols pela seleção`,
    },
    {
      id: "regularidade",
      nome: "Regularidade",
      // ⚠️ A NOTA MÉDIA É O ÚNICO EIXO QUE NÃO ACUMULA, e é o contrapeso de
      // todos os outros: dá para inflar jogos, gols e títulos jogando muito,
      // mas não dá para inflar média. É ele que impede a carreira longa e
      // medíocre de passar a carreira curta e brilhante.
      pontos: limitar(Math.max(0, r.notaMedia - 5.5) * 52, 80),
      teto: 80,
      explicacao: `média ${r.notaMedia.toFixed(2)} ao longo da carreira`,
    },
  ]

  const bruto = eixos.reduce((s, e) => s + e.pontos, 0)

  // ⚠️ O DESCONTO É PEQUENO DE PROPÓSITO. O cassino tira até 60 pontos — o
  // bastante para custar um patamar, longe do bastante para destruir uma
  // carreira boa. Um sistema que punisse pesado transformaria a mesa numa
  // armadilha a evitar; punindo de leve, ela continua sendo uma escolha.
  const desconto = -Math.min(60, Math.round(
    (r.noitesNoCassino * 1.2) + Math.max(0, -r.saldoNoCassino) / 250_000,
  ))

  const total = Math.max(0, bruto + desconto)

  return { total, eixos, desconto, patamar: patamarDaPontuacao(total) }
}

export function patamarDaPontuacao(total: number): string {
  if (total >= 850) return "Lenda do futebol"
  if (total >= 700) return "Craque de geração"
  if (total >= 540) return "Grande carreira"
  if (total >= 380) return "Carreira sólida"
  if (total >= 220) return "Profissional respeitado"
  return "Passagem discreta"
}

// ═══════════════════════════════════════════════════════════════════════════
// AS CONQUISTAS
// ═══════════════════════════════════════════════════════════════════════════

export interface Conquista {
  id: string
  nome: string
  descricao: string
  /** Pontos que ela soma na pontuação final quando desbloqueada. */
  bonus: number
  atingida: (r: FolhaDaCarreira) => boolean
}

/**
 * OS MARCOS.
 *
 * ⚠️ ELES SÃO VERIFICADOS DURANTE A CARREIRA, não só no fim. Uma conquista que
 * só aparece na tela de aposentadoria não é conquista — é relatório. O jogador
 * precisa ver "faltam 4 gols para os 100" na temporada em que isso ainda pode
 * mudar o que ele decide.
 *
 * Nenhuma delas é atingível por acidente e nenhuma exige uma carreira perfeita:
 * a mais dura (`imortal`) pede 500 jogos e 10 títulos, o que uma carreira longa
 * e vencedora alcança sem precisar de nota 9 todo jogo.
 */
export const CONQUISTAS: Conquista[] = [
  { id: "estreia", nome: "Primeiro apito", descricao: "Disputar a primeira partida como profissional.", bonus: 0, atingida: r => r.jogos >= 1 },
  { id: "centenario", nome: "Centenário", descricao: "Chegar a 100 partidas na carreira.", bonus: 10, atingida: r => r.jogos >= 100 },
  { id: "quinhentos", nome: "Meio milhar", descricao: "Chegar a 500 partidas na carreira.", bonus: 30, atingida: r => r.jogos >= 500 },
  { id: "cem_gols", nome: "Cem gols", descricao: "Marcar 100 gols na carreira.", bonus: 25, atingida: r => r.gols >= 100 },
  { id: "duzentos_gols", nome: "Artilheiro histórico", descricao: "Marcar 200 gols na carreira.", bonus: 40, atingida: r => r.gols >= 200 },
  { id: "garcom", nome: "Garçom", descricao: "Dar 100 assistências na carreira.", bonus: 25, atingida: r => r.assistencias >= 100 },
  { id: "campeao", nome: "Campeão", descricao: "Conquistar o primeiro título.", bonus: 10, atingida: r => r.titulos >= 1 },
  { id: "colecionador", nome: "Colecionador", descricao: "Conquistar 10 títulos.", bonus: 35, atingida: r => r.titulos >= 10 },
  { id: "selecao", nome: "Convocado", descricao: "Vestir a camisa da seleção.", bonus: 10, atingida: r => r.selecaoJogos >= 1 },
  { id: "camisa_10", nome: "Dono da seleção", descricao: "Fazer 50 jogos pela seleção.", bonus: 30, atingida: r => r.selecaoJogos >= 50 },
  { id: "elite", nome: "Elite", descricao: "Chegar a overall 85.", bonus: 20, atingida: r => r.overallMaximo >= 85 },
  { id: "fenomeno", nome: "Fenômeno", descricao: "Chegar a overall 92.", bonus: 40, atingida: r => r.overallMaximo >= 92 },
  { id: "regular", nome: "Metrônomo", descricao: "Terminar a carreira com média acima de 7,2.", bonus: 30, atingida: r => r.notaMedia >= 7.2 && r.jogos >= 150 },
  { id: "longevo", nome: "Eterno", descricao: "Jogar 15 temporadas.", bonus: 25, atingida: r => r.temporadas >= 15 },
  {
    id: "imortal", nome: "Imortal",
    descricao: "500 partidas, 10 títulos e overall 90 na mesma carreira.",
    bonus: 60,
    atingida: r => r.jogos >= 500 && r.titulos >= 10 && r.overallMaximo >= 90,
  },
  {
    // ⚠️ A ÚNICA CONQUISTA QUE PREMIA NÃO FAZER ALGO. Ela existe para que o
    // cassino tenha os dois lados na tela: quem nunca entrou vê que isso valeu
    // pontos, e quem entrou vê exatamente o que deixou na mesa.
    id: "limpo", nome: "Fora das manchetes",
    descricao: "Encerrar a carreira sem nenhuma noite de cassino.",
    bonus: 20,
    atingida: r => r.noitesNoCassino === 0 && r.jogos >= 100,
  },
]

export function conquistasAtingidas(r: FolhaDaCarreira): Conquista[] {
  return CONQUISTAS.filter(c => c.atingida(r))
}

/** O bônus das conquistas, para somar à pontuação. */
export function bonusDasConquistas(r: FolhaDaCarreira): number {
  return conquistasAtingidas(r).reduce((s, c) => s + c.bonus, 0)
}

/**
 * A PONTUAÇÃO COMPLETA — eixos, desconto e conquistas.
 *
 * Separada de `pontuacaoDaCarreira` porque a tela de progresso mostra os eixos
 * durante a carreira, e somar o bônus lá em cima faria o número saltar sozinho
 * quando uma conquista cai. Aqui o jogador vê as duas parcelas.
 */
export function pontuacaoFinal(r: FolhaDaCarreira): PontuacaoDaCarreira & { bonus: number } {
  const base = pontuacaoDaCarreira(r)
  const bonus = bonusDasConquistas(r)
  // ⚠️ O TETO E 1000 E ELE PRECISA ESTAR AQUI (1.0.375). Os seis eixos somam
  // exatamente 1000 (200+220+220+190+90+80) — a escala anunciada ao jogador —,
  // mas o bonus das conquistas era somado POR FORA, sem limite: 16 conquistas
  // valem +410, e uma carreira longa fechava em 1128 numa regua de 0 a 1000.
  // O bonus continua valendo para todo mundo que ainda nao chegou ao teto, que
  // e a carreira inteira menos o caso perfeito.
  const total = Math.min(1000, Math.max(0, base.total + bonus))
  return { ...base, bonus, total, patamar: patamarDaPontuacao(total) }
}

// ═══════════════════════════════════════════════════════════════════════════
// O RANKING
// ═══════════════════════════════════════════════════════════════════════════

export interface EntradaDoRanking {
  nome: string
  posicao: string
  pontos: number
  jogos: number
  gols: number
  titulos: number
  /** true = uma carreira jogada por você; false = referência do jogo. */
  minha: boolean
}

/**
 * AS LENDAS DE REFERÊNCIA.
 *
 * ⚠️ SÃO FICTÍCIAS, E ISSO NÃO É TIMIDEZ — É A REGRA DA CASA. O projeto inteiro
 * evita afirmar números de carreira de pessoas reais, e uma tabela de recordes
 * é justamente onde um número errado sobre gente real vira problema de verdade.
 *
 * Elas existem porque um ranking com uma entrada só não é ranking. Sem régua, a
 * primeira carreira do jogador seria simultaneamente a melhor e a pior de todos
 * os tempos, e o número final não diria nada.
 *
 * Os patamares foram escolhidos para que uma carreira MUITO boa (≈820) fique
 * logo abaixo do topo: chegar ao primeiro lugar tem de ser possível e raro.
 */
export const LENDAS_DE_REFERENCIA: EntradaDoRanking[] = [
  { nome: "Amadeu Fontana", posicao: "ATA", pontos: 934, jogos: 712, gols: 486, titulos: 24, minha: false },
  { nome: "Rui Balbino", posicao: "MEI", pontos: 871, jogos: 688, gols: 214, titulos: 21, minha: false },
  { nome: "Otávio Serrano", posicao: "ZAG", pontos: 802, jogos: 745, gols: 62, titulos: 19, minha: false },
  { nome: "Nélson Aguiar", posicao: "ATA", pontos: 764, jogos: 540, gols: 352, titulos: 12, minha: false },
  { nome: "Ivo Marchetti", posicao: "GOL", pontos: 703, jogos: 690, gols: 2, titulos: 15, minha: false },
  { nome: "Bento Salgueiro", posicao: "LE", pontos: 615, jogos: 522, gols: 48, titulos: 9, minha: false },
  { nome: "Célio Andrada", posicao: "VOL", pontos: 548, jogos: 470, gols: 33, titulos: 7, minha: false },
  { nome: "Rodrigo Vilas", posicao: "MEI", pontos: 471, jogos: 388, gols: 79, titulos: 4, minha: false },
  { nome: "Tomás Beltrão", posicao: "ATA", pontos: 396, jogos: 301, gols: 96, titulos: 2, minha: false },
  { nome: "Elias Ferrão", posicao: "ZAG", pontos: 318, jogos: 284, gols: 11, titulos: 1, minha: false },
]

/**
 * MONTA O RANKING com as suas carreiras encerradas no meio das lendas.
 *
 * As suas entram marcadas (`minha`), para a tela poder destacá-las. Ordenar
 * tudo junto é o ponto: ver a própria carreira em nono lugar entre dez diz
 * mais do que qualquer texto de encerramento.
 */
export function montarRanking(minhas: EntradaDoRanking[]): EntradaDoRanking[] {
  return [...LENDAS_DE_REFERENCIA, ...minhas].sort((a, b) => b.pontos - a.pontos)
}

/** Em que posição a carreira ficaria, de 1 em diante. */
export function posicaoNoRanking(pontos: number, minhas: EntradaDoRanking[]): number {
  return montarRanking(minhas).filter(e => e.pontos > pontos).length + 1
}
