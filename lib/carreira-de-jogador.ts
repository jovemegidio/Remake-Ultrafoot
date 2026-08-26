// CARREIRA DE JOGADOR — um atleta só, da estreia à aposentadoria.
//
// É o "Player Career" do EA FC trazido para a lógica deste jogo. O que aquele
// modo tem e um modo de técnico não tem, item por item (foi o que guiou o que
// está aqui):
//
//   • você não escala ninguém — quem decide se você joga é o TREINADOR, e ele
//     decide pela sua NOTA (a "manager rating" de cinco estrelas). Titular,
//     rodízio, banco e "fora dos planos" são consequência dela;
//   • a partida devolve uma linha individual: minutos, gols, assistências e uma
//     NOTA de 0 a 10 — o time pode vencer com você indo mal, e isso tem custo;
//   • você evolui gastando PONTOS por atributo, não esperando o mundo envelhecer;
//   • a diretoria não fala com você: quem fala é o treinador (metas da
//     temporada), o agente (propostas) e a seleção (convocação);
//   • a carreira TERMINA. Idade cobra, o overall cai e a aposentadoria chega.
//
// ⚠️ O estado é FECHADO e vive dentro do save. Nada aqui lê o motor do técnico:
// as duas carreiras não podem compartilhar elenco, caixa nem calendário — foi
// exatamente o descasamento que quebrou o co-op quando só metade do estado
// viajava (ver `chaveamento-de-tecnico`).

import { generateSeasonFixtures, initStandings, sortStandings, updateStandings } from "@/lib/career-engine"
import type { CupBracket, MatchFixture, StandingEntry } from "@/lib/career-types"
import { simulateFullMatch } from "@/lib/match-engine"
import {
  generateCupBracket, generateLiberBracket, isCupTriggerRound, isLiberTriggerRound,
  simulateCupRound, simulateLiberRound,
} from "@/lib/cup-engine"
import { getContinentalDivisions, getCountryCompetitions } from "@/lib/country-competitions"
import { completarLigaComPool, getTeamByFileKey, type Team } from "@/lib/teams-data"
// O elenco REAL do clube — é dele que sai a fila da posição (ver
// `hierarquiaDaPosicao`). Sem isto a disputa seria contra um número inventado.
import { getPlayersForTeam } from "@/lib/players-data"
import { suspensaoPorCartoes } from "@/lib/player-realism"
import { montarPartidaAoVivo, montarPartidaDoAtleta, partidaTerminou, type PartidaEmCurso } from "@/lib/partida-do-atleta"
import {
  ajusteDaNotaPeloVestiario, amplificacaoDaImprensa, companheirosDoClube, empurraoDaTorcida,
  pesoDaTorcidaNaRenovacao,
  esfriarCompanheiros, esfriarUmaRodada, frequenciaDeLancesPeloCraque,
  ganhoDaNegociacao, lerCompanheiros, lerRelacoes, moverCompanheiro,
  multiplicadorDePropostas, multiplicadorDeTreinoPeloVeterano, pisoDaNotaDoTreinador,
  pressaoDoRival, puxaoDoCapitao, recuperacaoPelaFamilia, relacoesIniciais,
  type Companheiro, type Relacoes,
} from "@/lib/relacoes-do-atleta"
import {
  CAVALOS_DO_ATLETA, CONVITES_DE_EVENTO, MESAS_DE_CASSINO,
  convitesDaSemana, correrNaSemana, jogarNoCassino, relacoesDepoisDoEvento,
  type ConviteDeEvento, type JogoDeCassino,
} from "@/lib/vida-noturna-do-atleta"
import {
  bonusDasConquistas, conquistasAtingidas, pontuacaoDaCarreira, pontuacaoFinal,
  type Conquista, type EntradaDoRanking, type FolhaDaCarreira, type PontuacaoDaCarreira,
} from "@/lib/legado-do-atleta"
import {
  chaveDoDilema, dilemaDaRodada, resolverDilema,
  type ContextoDoDilema, type Dilema, type EfeitoDoDilema,
} from "@/lib/dilemas-do-atleta"
import {
  ENERGIA_POR_APARICAO, assinarProposta, contraproporPatrocinio, cumprirAparicao,
  propostasDaRodada, rodarSemanaDePatrocinio,
  type ContratoDePatrocinio, type PedidoNaNegociacao, type PerfilComercial,
  type PropostaDePatrocinio,
} from "@/lib/patrocinio-pessoal"

// ─── ONDE UMA PROMESSA PODE ESTREAR ─────────────────────────────────────────
//
// Pedido do usuário (1.0.335): "para ficar realista o jogador não pode começar
// por um clube grande, deve começar por clubes mais modestos assim como os
// modos carreira de jogador do EA FC".
//
// ⚠️ A REGRA É RELATIVA À LIGA, NUNCA UM PRESTÍGIO FIXO. Um corte absoluto
// ("prestígio até 62") é o erro que a Divisão de Acesso já cometeu uma vez: as
// escalas de prestígio são MUITO diferentes entre países, e o mesmo número que
// deixa de fora os grandes do Brasil deixaria de fora a liga albanesa INTEIRA —
// a modalidade abriria sem nenhum clube escolhível e pareceria quebrada.
//
// Aqui o corte é por posição dentro da própria liga: a promessa assina com
// qualquer clube que não esteja entre os mais fortes DAQUELA liga. Assim a
// regra vale igual no Brasileirão, na Premier League e na Divisão de Acesso, e
// subir para um grande continua sendo o que a carreira conquista — não o que
// ela recebe pronta na primeira tela.

/** Fatia dos clubes mais fortes de cada liga fechada para a estreia. */
export const FATIA_DE_ELITE_FECHADA = 0.3

/**
 * Os clubes de uma liga em que um atleta em começo de carreira pode assinar.
 *
 * Devolve a lista inteira quando ela é pequena demais para cortar (uma liga de
 * 4 clubes não tem "elite" a separar) — ficar sem opção nenhuma é pior do que
 * abrir uma exceção honesta.
 */
export function clubesDeEstreia(daLiga: readonly Team[]): Team[] {
  if (daLiga.length <= 4) return [...daLiga]
  const porForca = [...daLiga].sort((a, b) => (b.prestigio ?? 0) - (a.prestigio ?? 0))
  const fechados = Math.max(1, Math.round(porForca.length * FATIA_DE_ELITE_FECHADA))
  const permitidos = new Set(porForca.slice(fechados).map(t => t.file_key))
  // A ordem original da liga é preservada: a lista da tela é um carrossel, e
  // reordená-la por força faria o clube sob o dedo mudar ao trocar de modalidade.
  return daLiga.filter(t => permitidos.has(t.file_key))
}

export type PosicaoDoAtleta = "GOL" | "ZAG" | "LD" | "LE" | "VOL" | "MEI" | "ATA"

export const POSICOES_JOGAVEIS: { id: PosicaoDoAtleta; nome: string }[] = [
  { id: "GOL", nome: "Goleiro" },
  { id: "ZAG", nome: "Zagueiro" },
  { id: "LD", nome: "Lateral direito" },
  { id: "LE", nome: "Lateral esquerdo" },
  { id: "VOL", nome: "Volante" },
  { id: "MEI", nome: "Meia" },
  { id: "ATA", nome: "Atacante" },
]

export interface AtributosDoAtleta {
  ritmo: number
  finalizacao: number
  passe: number
  drible: number
  defesa: number
  fisico: number
}

// ─── ARQUÉTIPOS ──────────────────────────────────────────────────────────────
//
// Dois atletas de overall 85 têm de jogar diferente. O arquétipo é a identidade:
// diz quais atributos são os DELE — os que crescem mais rápido, os que a
// evolução orgânica favorece e os que o overall pondera mais.
//
// ⚠️ São nossos, não os treze do EA FC. Copiar a lista de lá amarraria o modo a
// um balanceamento que não é deste jogo (e cujos nomes são marca alheia). O que
// se aproveita da referência é a IDEIA: identidade primeiro, especialização
// depois.

export type ArquetipoId = "maestro" | "explosivo" | "matador" | "muralha" | "general" | "guardiao"

export interface Arquetipo {
  id: ArquetipoId
  nome: string
  descricao: string
  /** Onde este atleta cresce mais rápido. */
  principais: (keyof AtributosDoAtleta)[]
  /** Posições em que ele faz sentido. */
  posicoes: PosicaoDoAtleta[]
  /** Caminhos que se abrem quando o atleta amadurece (ver `especializacaoDisponivel`). */
  especializacoes: { id: string; nome: string; foco: (keyof AtributosDoAtleta)[] }[]
}

export const ARQUETIPOS: Arquetipo[] = [
  {
    id: "maestro", nome: "Maestro",
    descricao: "Manda no jogo com passe, leitura e técnica.",
    principais: ["passe", "drible"], posicoes: ["MEI", "VOL"],
    especializacoes: [
      { id: "armador", nome: "Armador", foco: ["passe", "ritmo"] },
      { id: "camisa10", nome: "Camisa 10", foco: ["drible", "finalizacao"] },
    ],
  },
  {
    id: "explosivo", nome: "Explosivo",
    descricao: "Resolve no espaço: velocidade, drible e repetição.",
    principais: ["ritmo", "drible"], posicoes: ["ATA", "MEI", "LD", "LE"],
    especializacoes: [
      { id: "ponta", nome: "Ponta clássico", foco: ["ritmo", "passe"] },
      { id: "interior", nome: "Atacante interior", foco: ["drible", "finalizacao"] },
    ],
  },
  {
    id: "matador", nome: "Matador",
    descricao: "Existe para finalizar: posicionamento e frieza na área.",
    principais: ["finalizacao", "fisico"], posicoes: ["ATA"],
    especializacoes: [
      { id: "area", nome: "Homem de área", foco: ["finalizacao", "fisico"] },
      { id: "movel", nome: "Atacante móvel", foco: ["ritmo", "drible"] },
    ],
  },
  {
    id: "muralha", nome: "Muralha",
    descricao: "Ganha a bola e o duelo: força, antecipação e posicionamento.",
    principais: ["defesa", "fisico"], posicoes: ["ZAG", "LD", "LE"],
    especializacoes: [
      { id: "lider", nome: "Líder da linha", foco: ["defesa", "passe"] },
      { id: "veloz", nome: "Zagueiro veloz", foco: ["ritmo", "defesa"] },
    ],
  },
  {
    id: "general", nome: "General",
    descricao: "Equilibra o time: desarme, cobertura e saída de bola.",
    principais: ["defesa", "passe"], posicoes: ["VOL", "MEI", "ZAG"],
    especializacoes: [
      { id: "cabeca", nome: "Cabeça de área", foco: ["defesa", "fisico"] },
      { id: "saida", nome: "Primeiro passe", foco: ["passe", "drible"] },
    ],
  },
  {
    id: "guardiao", nome: "Guardião",
    descricao: "Goleiro: reflexo, posicionamento e domínio da área.",
    principais: ["defesa", "fisico"], posicoes: ["GOL"],
    especializacoes: [
      { id: "reflexo", nome: "Reflexo", foco: ["defesa", "ritmo"] },
      { id: "linha", nome: "Goleiro-linha", foco: ["passe", "defesa"] },
    ],
  },
]

export function arquetipo(id: ArquetipoId): Arquetipo {
  return ARQUETIPOS.find(a => a.id === id) ?? ARQUETIPOS[0]
}

/** Os arquétipos que fazem sentido para a posição escolhida. */
export function arquetiposDaPosicao(posicao: PosicaoDoAtleta): Arquetipo[] {
  const doPosto = ARQUETIPOS.filter(a => a.posicoes.includes(posicao))
  return doPosto.length ? doPosto : [arquetipo(posicao === "GOL" ? "guardiao" : "general")]
}

// ─── PERSONALIDADE (escondida) ──────────────────────────────────────────────
//
// Dois atletas de 75 aos 20 anos podem terminar em 86 e em 78. A diferença não
// é o overall — é quem treina, quem aguenta pressão e quem quer mais. Os
// valores vão de 1 a 20, nunca aparecem crus na tela e o jogo só os deixa
// transparecer por FRASES (ver `leituraDaPersonalidade`).

export interface PersonalidadeDoAtleta {
  ambicao: number
  profissionalismo: number
  determinacao: number
  lealdade: number
  temperamento: number
}

export interface AtletaDaCarreira {
  id: string
  nome: string
  /**
   * ⚠️ CAMPO EXIGIDO POR CODIGO JA PUBLICADO (1.0.356). O `fc-hub` do commit
   * `be0ac1b` le `atleta.genero` para sugerir a modalidade da sala online, mas
   * o campo nunca chegou ao repositorio — o ramo remoto nao compilava por isso.
   *
   * Opcional de proposito: save antigo nao tem, e ausencia significa "nao
   * declarado", nunca "masculino". Quem decide a modalidade ja tem o
   * `state.modalidade` como fonte principal.
   */
  genero?: "masculino" | "feminino"
  posicao: PosicaoDoAtleta
  idade: number
  nacionalidade: string
  pePreferido: "direito" | "esquerdo"
  /**
   * QUÃO BOM É O PÉ RUIM — 1 a 5 estrelas (1.0.374).
   *
   * ⚠️ ELE EXISTE PORQUE AGORA É LIDO. Até a 1.0.373 a ficha guardava altura,
   * peso e pé preferido sem que nada os consultasse: dado de enfeite, que é
   * pior que dado nenhum porque o jogador escolhe achando que decide algo.
   * A física (`lib/fisica-do-chute`) lê os três — o pé errado faz a bola sair
   * torta e mole, e 5 estrelas anulam a penalidade.
   *
   * Opcional: save anterior a esta versão não tem, e ausência vale 3 (o meio
   * da escala), nunca 1 — rebaixar atleta já criado seria mudar a carreira do
   * jogador pelas costas dele.
   */
  peFraco?: number
  alturaCm: number
  pesoKg: number
  numero: number
  overall: number
  /**
   * O POTENCIAL REAL — nunca mostrado ao jogador.
   *
   * ⚠️ A tela mostra uma FAIXA (`potencialVisivel`), que começa larga e fecha
   * conforme o atleta joga. Mostrar "potencial 87" transforma a carreira numa
   * barra de progresso: o jogador sabe desde o primeiro dia onde vai terminar e
   * o que resta é apertar continuar. A faixa mantém a pergunta de pé.
   */
  potencial: number
  arquetipo: ArquetipoId
  /** Aberta quando o atleta amadurece; até lá, `null`. */
  especializacao: string | null
  personalidade: PersonalidadeDoAtleta
  atributos: AtributosDoAtleta
}

/**
 * A faixa de potencial que a comissão técnica ARRISCA, dado o que já viu.
 *
 * Quanto mais partidas, mais estreita — é a mesma lógica de olheiro do jogo: a
 * primeira leitura é um chute largo, a centésima é quase certeza. Nunca fecha
 * de todo: o teto real fica escondido até o fim.
 */
export function potencialVisivel(atleta: AtletaDaCarreira, jogosNaCarreira: number): { min: number; max: number } {
  const margem = Math.max(2, Math.round(12 - Math.min(10, jogosNaCarreira / 12)))
  return {
    min: Math.max(atleta.overall, atleta.potencial - margem),
    max: Math.min(99, atleta.potencial + Math.round(margem * 0.6)),
  }
}

/** O que a comissão diz do temperamento do atleta — sem número cru. */
export function leituraDaPersonalidade(p: PersonalidadeDoAtleta): string[] {
  const frases: string[] = []
  if (p.profissionalismo >= 15) frases.push("Trabalha como profissional; é o primeiro a chegar.")
  else if (p.profissionalismo <= 7) frases.push("Falta rotina de treino — desperdiça talento.")
  if (p.ambicao >= 15) frases.push("Quer mais: não se acomoda com o lugar que tem.")
  else if (p.ambicao <= 7) frases.push("Acomoda-se rápido quando está bem.")
  if (p.determinacao >= 15) frases.push("Não abaixa a cabeça depois de uma partida ruim.")
  if (p.temperamento <= 7) frases.push("Explode fácil; o vestiário sente.")
  if (p.lealdade >= 15) frases.push("Cria raiz no clube; sair não é fácil para ele.")
  return frases.length ? frases : ["Perfil equilibrado, sem traço dominante."]
}

/**
 * O QUE O ATLETA FEZ EM CAMPO — a matéria-prima da evolução orgânica.
 *
 * A evolução não vem de gastar pontos num menu: vem daqui. Quem passou a
 * temporada driblando evolui drible; quem correu para o espaço evolui ritmo;
 * quem desarmou evolui defesa. É a diferença entre "escolher" o atleta que se
 * quer ter e DESCOBRIR o atleta que se está formando.
 */
export interface AcoesDaTemporada {
  dribles: number
  passesChave: number
  passesCertos: number
  desarmes: number
  finalizacoes: number
  corridas: number
  duelosGanhos: number
}

const ACOES_ZERADAS: AcoesDaTemporada = {
  dribles: 0, passesChave: 0, passesCertos: 0, desarmes: 0, finalizacoes: 0, corridas: 0, duelosGanhos: 0,
}

export interface PartidaDoAtleta {
  temporada: number
  rodada: number
  competicao: string
  adversario: string
  casa: boolean
  golsPro: number
  golsContra: number
  titular: boolean
  minutos: number
  gols: number
  assistencias: number
  /** Nota 0–10, uma casa decimal. */
  nota: number
  cartao: "amarelo" | "vermelho" | null
}

export type TipoDeMeta = "gols" | "assistencias" | "jogos" | "nota" | "titulo"

export interface MetaDaTemporada {
  id: string
  tipo: TipoDeMeta
  descricao: string
  alvo: number
  progresso: number
  cumprida: boolean
}

export interface PropostaDeClube {
  id: string
  clubeCurto: string
  clubeNome: string
  clubeFileKey: string
  divisao: string
  ligaNome: string
  prestigio: number
  salarioSemanal: number
  temporadas: number
  motivo: string
  /**
   * ⚠️ O CONTRATO É UMA DECISÃO, NÃO UM NÚMERO DECORATIVO (1.0.326).
   *
   * Antes a proposta era só "salário + temporadas", e aceitar era sempre pegar
   * o maior número. Com luvas, bônus e — principalmente — o STATUS PROMETIDO,
   * a escolha passa a ter contrapartida: o clube grande paga mais e oferece
   * rodízio; o clube médio paga menos e promete a vaga.
   */
  luvas: number
  bonusPorGol: number
  bonusPorTitulo: number
  /** O que o clube promete: é isto que vira a confiança inicial lá. */
  statusPrometido: PapelNoElenco
  /** Só existe quando o clube quer o atleta por empréstimo. */
  emprestimo?: boolean
  /**
   * A MESA DE NEGOCIAÇÃO (1.0.358).
   *
   * Só existe em proposta feita a quem está SEM CLUBE. Ali a proposta deixa de
   * ser "aceita ou não" e vira conversa: o agente pede mais, o clube responde,
   * e cada pedido gasta a paciência de quem está do outro lado. Ver
   * `contrapropor`.
   */
  negociacao?: NegociacaoDaProposta
  /** Semana de `semClube` em que ela chegou — é por ela que a proposta vence. */
  semanaDeChegada?: number
  /** Semanas até o clube tirar a proposta da mesa se ninguém fechar. */
  validadeEmSemanas?: number
}

/**
 * O QUE JÁ FOI DITO NESTA MESA.
 *
 * `paciencia` começa cheia e cai a cada pedido: um agente que pede salário,
 * luvas, status e temporadas na mesma conversa termina sem proposta nenhuma —
 * que é exatamente o risco de negociar sem clube.
 */
export interface NegociacaoDaProposta {
  paciencia: number
  rodadas: number
  /** A última resposta do clube, para a tela poder mostrar a conversa. */
  ultimaResposta?: string
  /** O clube saiu da mesa. A proposta fica visível, mas não se aceita mais. */
  retirada?: boolean
}

/** O QUE O PEDIDO DO AGENTE PODE PEDIR. */
export type PedidoDaNegociacao = "salario" | "luvas" | "status" | "temporadas"

/**
 * SEM CLUBE (1.0.358) — o estado que faltava ao modo de atleta.
 *
 * ⚠️ Até aqui "pedir demissão" no modo de atleta era o botão do TÉCNICO: ele
 * limpava `selectedTeamShort` e mandava a pessoa para a Área do Treinador — a
 * tela de quem dirige clube. Um atleta que rescinde não vira treinador
 * desempregado: ele fica sem time, e é o que ele fez em campo no clube anterior
 * que decide quem liga.
 */
export interface SemClube {
  desdeTemporada: number
  desdeRodada: number
  /** Semanas de mercado já vividas. É o relógio deste estado. */
  semanas: number
  motivo: string
  ultimoClubeNome: string
  ultimoClubeCurto: string
  ultimoClubeFileKey: string
  /**
   * O CARTAZ (0–100): o que o desempenho no clube anterior comprou no mercado.
   * É ele que decide se ligam clubes MAIORES ou MENORES — e ele enferruja a
   * cada semana parado, porque quem não joga some do radar.
   */
  cartaz: number
  /** O diário do mercado, para a tela contar o que aconteceu em cada semana. */
  diario: { semana: number; texto: string }[]
}

/**
 * O EMPRESÁRIO — personagem da carreira, não um botão.
 *
 * É ele que traz proposta, negocia salário e abre porta no exterior. Um agente
 * ruim deixa dinheiro na mesa e não alcança clube grande; um bom multiplica as
 * duas coisas — e cobra por isso. Trocar de agente é uma decisão da carreira.
 */
export interface EmpresarioDoAtleta {
  nome: string
  /** 1–20. Quanto ele arranca a mais em salário e luvas. */
  negociacao: number
  /** 1–20. Quantas portas ele abre (quantas propostas chegam). */
  influencia: number
  /** 1–20. Alcance fora do país. */
  redeInternacional: number
  /** Fatia do salário, em %. */
  comissao: number
}

export const EMPRESARIOS: EmpresarioDoAtleta[] = [
  { nome: "Ricardo Martins", negociacao: 17, influencia: 14, redeInternacional: 16, comissao: 8 },
  { nome: "Helena Prado", negociacao: 14, influencia: 17, redeInternacional: 12, comissao: 6 },
  { nome: "Tião Barbosa", negociacao: 9, influencia: 8, redeInternacional: 5, comissao: 3 },
  { nome: "Marco Aurélio Diniz", negociacao: 12, influencia: 11, redeInternacional: 18, comissao: 7 },
]

/**
 * A INTENSIDADE DA SEMANA DE TREINO (1.0.339).
 *
 * Três, e não cinco, porque cada uma precisa significar uma coisa distinta que
 * o jogador consiga prever antes de escolher. Um seletor de cinco graus em que
 * dois se parecem é um seletor de três com ruído.
 */
export type IntensidadeDeTreino = "leve" | "normal" | "puxada"

export interface RelatorioDoTreino {
  intensidade: IntensidadeDeTreino
  /** XP que a semana rendeu, já com dedicação aplicada. */
  xp: number
  /** Efeito na forma: puxar cansa, aliviar recupera. */
  deltaForma: number
  /** O atributo que ganhou um ponto nesta semana, se algum ganhou. */
  ganho: { atributo: keyof AtributosDoAtleta; ganho: number } | null
  /** O que dizer ao jogador — inclusive quando ele não treinou direito. */
  texto: string
}

export type CategoriaDeEquipamento = "chuteira" | "acessorio" | "recuperacao"

export interface EquipamentoDoAtleta {
  id: string
  nome: string
  categoria: CategoriaDeEquipamento
  descricao: string
  preco: number
  bonus: Partial<AtributosDoAtleta>
  bonusEnergia?: number
}

export interface EconomiaDoAtleta {
  dinheiro: number
  energia: number
  energiaMaxima: number
  equipamentosComprados: string[]
  equipamentosEmUso: Partial<Record<CategoriaDeEquipamento, string>>
  totalGastoEmTreino: number
  totalGastoEmEnergia: number
  ultimoTreinoIndividual?: string
}

export interface ApostaDoAtleta {
  id: string
  rodada: number
  palpite: "vitoria" | "empate" | "derrota"
  valor: number
  multiplicador: number
  adversario: string
}

export interface ParceiraDoAtleta {
  nome: string
  afinidade: number
  fase: "conhecendo" | "namoro" | "relacao_seria"
  ultimaInteracaoRodada: number
  momentos: number
}

export interface TreinadorPessoalDoAtleta {
  id: string
  nome: string
  especialidade: keyof AtributosDoAtleta | "equilibrado"
  custoSemanal: number
  bonusTreino: number
  semanasRestantes: number
}

export interface RelacoesDoAtleta {
  elenco: number
  marcas: number
  ultimaInteracaoElenco?: number
  rupturas: string[]
  /**
   * AS QUATRO PESSOAS QUE FALTAVAM (1.0.374).
   *
   * ⚠️ ESTENDEM `elenco`, NÃO O SUBSTITUEM. A 1.0.373 já tratava o grupo e as
   * marcas; o que não existia era relação INDIVIDUAL com quem decide a sua
   * carreira — o técnico que te escala, o empresário que traz proposta, a
   * família que te recupera e a imprensa que te constrói ou te derruba.
   *
   * Todas opcionais: save anterior não as tem, e `lerRelacoes`
   * (`lib/relacoes-do-atleta`) devolve o padrão nesse caso. Cada uma muda um
   * número que o jogo JÁ lia — nenhuma é medidor de enfeite.
   */
  treinador?: number
  empresario?: number
  familia?: number
  imprensa?: number
}

export interface PatrocinioPessoalDoAtleta {
  id: string
  marca: string
  valorSemanal: number
  bonusPorGol: number
  semanasRestantes: number
  metaGols: number
  golsNoContrato: number
}

export interface BemDoAtleta {
  id: string
  nome: string
  categoria: "imovel" | "carro" | "luxo"
  preco: number
  manutencaoSemanal: number
  estilo: number
}

export interface PartidaDaSelecao {
  id: string
  adversario: string
  competicao: string
  jogada: boolean
  golsPro?: number
  golsContra?: number
  nota?: number
}

export const TREINADORES_PESSOAIS: (Omit<TreinadorPessoalDoAtleta, "semanasRestantes"> & { custoContratacao: number })[] = [
  { id: "caio", nome: "Caio Nascimento", especialidade: "fisico", custoContratacao: 18_000, custoSemanal: 2_200, bonusTreino: 0.14 },
  { id: "bia", nome: "Beatriz Leme", especialidade: "equilibrado", custoContratacao: 32_000, custoSemanal: 3_800, bonusTreino: 0.2 },
  { id: "ramon", nome: "Ramon Vieira", especialidade: "finalizacao", custoContratacao: 45_000, custoSemanal: 5_500, bonusTreino: 0.28 },
]

export const PATROCINIOS_PESSOAIS = [
  { id: "vertice", marca: "Vertice Sports", reputacaoMinima: 30, valorSemanal: 3_000, bonusPorGol: 1_200, semanas: 16, metaGols: 5 },
  { id: "pulso", marca: "Pulso Performance", reputacaoMinima: 48, valorSemanal: 7_500, bonusPorGol: 2_800, semanas: 20, metaGols: 9 },
  { id: "aurora", marca: "Aurora Eleven", reputacaoMinima: 68, valorSemanal: 16_000, bonusPorGol: 6_000, semanas: 24, metaGols: 14 },
] as const

export const BENS_DO_ATLETA: BemDoAtleta[] = [
  { id: "apto", nome: "Apartamento compacto", categoria: "imovel", preco: 90_000, manutencaoSemanal: 450, estilo: 8 },
  { id: "casa", nome: "Casa contemporanea", categoria: "imovel", preco: 420_000, manutencaoSemanal: 2_100, estilo: 22 },
  { id: "carro_esportivo", nome: "Coupe esportivo", categoria: "carro", preco: 180_000, manutencaoSemanal: 1_400, estilo: 14 },
  { id: "carro_eletrico", nome: "Sedan eletrico", categoria: "carro", preco: 125_000, manutencaoSemanal: 650, estilo: 10 },
  { id: "relogio", nome: "Relogio de autor", categoria: "luxo", preco: 38_000, manutencaoSemanal: 80, estilo: 5 },
  { id: "iate", nome: "Lancha de lazer", categoria: "luxo", preco: 650_000, manutencaoSemanal: 6_500, estilo: 28 },
]

export const EQUIPAMENTOS_DO_ATLETA: EquipamentoDoAtleta[] = [
  { id: "chuteira_agilidade", nome: "Chuteira Veloz", categoria: "chuteira", descricao: "+3 ritmo e +1 drible", preco: 18_000, bonus: { ritmo: 3, drible: 1 } },
  { id: "chuteira_precisao", nome: "Chuteira Precisao", categoria: "chuteira", descricao: "+3 finalizacao e +1 passe", preco: 24_000, bonus: { finalizacao: 3, passe: 1 } },
  { id: "caneleira_pro", nome: "Caneleira Pro", categoria: "acessorio", descricao: "+3 defesa e +2 fisico", preco: 20_000, bonus: { defesa: 3, fisico: 2 } },
  { id: "munhequeira", nome: "Munhequeira Tecnica", categoria: "acessorio", descricao: "+2 passe e +2 drible", preco: 22_000, bonus: { passe: 2, drible: 2 } },
  { id: "kit_recuperacao", nome: "Kit de Recuperacao", categoria: "recuperacao", descricao: "+15 de energia maxima", preco: 28_000, bonus: {}, bonusEnergia: 15 },
  { id: "academia_pessoal", nome: "Academia Pessoal", categoria: "recuperacao", descricao: "+3 fisico e +10 de energia maxima", preco: 45_000, bonus: { fisico: 3 }, bonusEnergia: 10 },
]

/**
 * O QUE CADA INTENSIDADE CUSTA E RENDE.
 *
 * ⚠️ O custo é em FORMA, e a forma entra na partida logo em seguida — é isso que
 * impede "puxada" de ser a escolha óbvia. Sem custo, um seletor de intensidade
 * é só um botão de "sim, quero evoluir mais rápido".
 */
const TREINO: Record<IntensidadeDeTreino, { xp: number; forma: number; rotulo: string }> = {
  leve:   { xp: 4,  forma: +3, rotulo: "Semana leve" },
  normal: { xp: 9,  forma: 0,  rotulo: "Semana normal" },
  puxada: { xp: 16, forma: -5, rotulo: "Semana puxada" },
}

/** Quanto progresso o foco precisa acumular para virar +1 no atributo. */
const CUSTO_DO_PONTO_DE_FOCO = 130

export function definirIntensidadeDeTreino(
  estado: EstadoCarreiraDeJogador,
  intensidade: IntensidadeDeTreino,
): EstadoCarreiraDeJogador {
  return { ...estado, intensidadeDeTreino: intensidade }
}

/**
 * A SEMANA DE TREINO, aplicada antes da rodada.
 *
 * ⚠️ ELA ALIMENTA A MESMA PROGRESSÃO DE SEMPRE (`aplicarXP` e os atributos do
 * atleta), nunca uma paralela. Um segundo contador de evolução discordaria do
 * primeiro na primeira temporada — é o erro que este projeto já cometeu com
 * outras contabilidades duplicadas.
 *
 * ⚠️ E É AQUI QUE O `profissionalismo` GANHA DENTES. A leitura da personalidade
 * já dizia "falta rotina de treino — desperdiça talento" desde a 1.0.325, mas
 * era só uma frase: o atributo não mexia em nada. Agora ele multiplica o que a
 * semana rende, então um atleta relaxado treina e aproveita pouco — que é
 * exatamente o que a frase promete.
 */
function treinarNaSemana(estado: EstadoCarreiraDeJogador): void {
  const intensidade = estado.intensidadeDeTreino ?? "normal"
  const plano = TREINO[intensidade]
  const p = estado.atleta.personalidade
  const economia = economiaDoAtleta(estado)
  estado.economia = economia
  const custoDeEnergia = intensidade === "leve" ? 4 : intensidade === "normal" ? 8 : 14
  if (economia.energia < custoDeEnergia) {
    estado.treinoDaSemana = {
      intensidade, xp: 0, deltaForma: 0, ganho: null,
      texto: `Treino cancelado: faltam ${custoDeEnergia} de energia.`,
    }
    return
  }
  economia.energia -= custoDeEnergia
  economia.totalGastoEmTreino += custoDeEnergia

  // Dedicação: 0,45 (relaxado) a ~1,55 (profissional obsessivo).
  const dedicacao = 0.45 + (p.profissionalismo + p.determinacao) / 40
  // ⚠️ O VETERANO ENTRA AQUI E EM MAIS LUGAR NENHUM (1.0.374). O laço com ele
  // multiplica o que a semana rende — é o efeito dele, e é o que faz "treinar
  // junto com o cara mais velho" ser uma decisão de carreira em vez de uma
  // frase bonita numa tela de relacionamento.
  const comOVeterano = multiplicadorDeTreinoPeloVeterano(
    lerCompanheiros(estado.companheiros, estado.clubeCurto, String(estado.atleta.posicao)),
  )
  const xp = Math.round(plano.xp * dedicacao * comOVeterano)

  // ⚠️ QUEM SE PUXA SEM BASE SE QUEBRA MENOS QUE QUEM SE PUXA CANSADO. Treinar
  // puxado com a forma no chão cobra o dobro — é o que faz a escolha ter uma
  // resposta errada em vez de uma escolha "de sabor".
  const castigo = intensidade === "puxada" && estado.forma < 40 ? plano.forma * 2 : plano.forma
  estado.forma = Math.max(0, Math.min(100, estado.forma + castigo))

  // ⚠️ PRE-TEMPORADA: e onde o ano se constroi (1.0.347). Sem jogo para
  // recuperar, o trabalho rende mais e a forma sobe — e por isso queimar a
  // pre-temporada com intensidade leve custa o ano inteiro depois.
  const naPreTemporada = (estado.preTemporada?.rodadasRestantes ?? 0) > 0
  if (naPreTemporada) {
    estado.forma = Math.max(0, Math.min(100, estado.forma + 6))
    estado.preTemporada = { rodadasRestantes: (estado.preTemporada?.rodadasRestantes ?? 1) - 1 }
  }

  aplicarXP(estado, naPreTemporada ? Math.round(xp * 1.4) : xp)

  // O foco vira ponto de atributo quando acumula o bastante — e nunca passa do
  // potencial real, que continua escondido do jogador.
  let ganho: RelatorioDoTreino["ganho"] = null
  if (estado.focoDeTreino !== "equilibrado") {
    const atual = estado.progressoDoFoco ?? 0
    const somado = atual + xp * (intensidade === "puxada" ? 1.3 : 1)
    if (somado >= CUSTO_DO_PONTO_DE_FOCO) {
      const atributo = estado.focoDeTreino
      const teto = estado.atleta.potencial
      if (estado.atleta.atributos[atributo] < teto) {
        estado.atleta.atributos[atributo] = Math.min(teto, estado.atleta.atributos[atributo] + 1)
        estado.atleta.overall = overallDoAtleta(estado.atleta.posicao, estado.atleta.atributos)
        ganho = { atributo, ganho: 1 }
      }
      estado.progressoDoFoco = somado - CUSTO_DO_PONTO_DE_FOCO
    } else {
      estado.progressoDoFoco = somado
    }
  }

  const relaxado = p.profissionalismo <= 7
  estado.treinoDaSemana = {
    intensidade,
    xp,
    deltaForma: castigo,
    ganho,
    texto: ganho
      ? `${plano.rotulo}: ${NOME_DO_ATRIBUTO[ganho.atributo]} +1.`
      : relaxado
        ? `${plano.rotulo}: rendeu pouco — ele não leva o treino a sério.`
        : `${plano.rotulo}: ${xp} de experiência.`,
  }
}

export interface TemporadaDoAtleta {
  temporada: number
  clubeNome: string
  competicao: string
  jogos: number
  titularidades: number
  minutos: number
  gols: number
  assistencias: number
  notaMedia: number
  posicaoNaLiga: number
  titulos: string[]
  premios: string[]
  overallFinal: number
}

export interface EstadoCarreiraDeJogador {
  versao: 1 | 2 | 3
  atleta: AtletaDaCarreira
  clubeCurto: string
  clubeNome: string
  clubeFileKey: string
  divisao: string
  ligaNome: string
  pais: string
  temporada: number
  rodada: number
  /** Calendário da liga do clube. As partidas do clube trazem `isUserMatch`. */
  calendario: MatchFixture[]
  tabela: StandingEntry[]
  contrato: {
    salarioSemanal: number
    ateTemporada: number
    valorDePasse: number
    /** Luvas e bônus do contrato vigente (1.0.326). Opcionais em saves antigos. */
    luvas?: number
    bonusPorGol?: number
    bonusPorTitulo?: number
    /** O que o clube prometeu ao assinar — cobrável quando não se cumpre. */
    statusPrometido?: PapelNoElenco
  }
  /** Quem cuida da carreira fora de campo (1.0.326). */
  empresario: EmpresarioDoAtleta
  /** Quanto o atleta já ganhou de bônus nesta temporada. */
  ganhosDaTemporada: number
  /**
   * REPUTAÇÃO (0–100) e relação com a TORCIDA (0–100), da camada narrativa
   * (1.0.328). Opcionais para saves criados antes dela.
   *
   * Reputação é o que faz clube grande olhar para você; torcida é o que decide
   * se a saída é aplaudida ou vaiada. Entrevista mexe nas duas, e nem sempre
   * para o mesmo lado — é isso que torna a escolha uma escolha.
   */
  reputacao?: number
  torcida?: number
  entrevistasRespondidas?: string[]
  /** Conversas já tidas com família, empresário e diretoria (1.0.340). */
  conversasRespondidas?: string[]
  repercussao?: PostDeRepercussao[]
  /** Partida sendo VIVIDA momento a momento (1.0.329). */
  partidaEmCurso?: PartidaEmCurso
  /**
   * LESAO EM CURSO (1.0.347). Opcional: save antigo nunca teve, e ausencia
   * significa "inteiro", nunca "nao sei".
   *
   * ⚠️ A auditoria mediu 5 mencoes a lesao contra 40 a proposta neste modo: o
   * atleta quase nao sentia o corpo, que e metade do drama de uma carreira. Com
   * isto ele PERDE rodadas, perde forma e ve a nota do treinador cair enquanto
   * outro joga na vaga dele.
   */
  lesao?: { semanasRestantes: number; gravidade: "leve" | "media" | "grave"; descricao: string; desdeRodada: number }
  /** Rodadas perdidas por lesao na carreira inteira. Entra no resumo. */
  rodadasPerdidasPorLesao?: number
  /**
   * SUSPENSAO POR CARTAO (1.0.351).
   *
   * ⚠️ ATE AQUI O CARTAO NAO CUSTAVA NADA. `cartoesAmarelos` e
   * `cartoesVermelhos` eram contadores de vitrine: a palavra "suspensao" nao
   * aparecia uma vez neste arquivo, e o atleta expulso entrava normalmente na
   * rodada seguinte. O modo de TECNICO ja resolvia isso desde sempre
   * (`suspensaoPorCartoes` -> `suspendedMatches`, em lib/game-engine); a
   * carreira de atleta so nao tinha herdado a regra.
   *
   * A consequencia e a mesma da lesao: a rodada acontece sem voce, o time joga,
   * a tabela anda e a nota do treinador cede um pouco.
   *
   * Ausente em save antigo — e ausente significa "nao esta suspenso".
   */
  suspensao?: { partidasRestantes: number; motivo: string }
  /** Amarelos rumo a suspensao automatica (a cada 5). Zera na virada da temporada. */
  amarelosAcumulados?: number
  /** Partidas perdidas por suspensao na carreira inteira. Entra no resumo. */
  rodadasPerdidasPorSuspensao?: number
  /**
   * COPA NACIONAL E CONTINENTAL (1.0.351).
   *
   * ⚠️ ATE AQUI A TEMPORADA DO ATLETA ERA SO O CAMPEONATO. `criarCarreiraDeJogador`
   * montava `generateSeasonFixtures` e mais nada: um atleta do Flamengo vivia
   * 2026 inteiro sem Copa do Brasil e sem Libertadores, a unica meta de titulo
   * possivel era a liga, e metade das noites de um ano de futebol nao existia.
   *
   * O mata-mata usa o MESMO chaveamento do modo de tecnico (`lib/cup-engine`),
   * nas mesmas rodadas-gatilho — nada de um segundo calendario paralelo.
   *
   * `continental` so existe quando o clube se classificou (top 4 da liga na
   * temporada anterior; na primeira, top 4 por prestigio). Ausentes em save
   * antigo, e ausente significa "esta carreira nao tem" — a temporada em curso
   * continua exatamente como comecou.
   */
  copa?: CupBracket
  continental?: CupBracket
  /**
   * A BRACADEIRA (1.0.347). Nao existia — e receber a capitania e um dos marcos
   * mais fortes de uma carreira de atleta.
   */
  capitao?: boolean
  temporadaEmQueVirouCapitao?: number
  /**
   * PRE-TEMPORADA (1.0.347). O calendario do atleta nao respirava: uma
   * temporada colava na outra. Aqui existe um periodo curto em que o treino
   * rende mais e a forma se recupera — o momento em que se constroi o ano.
   */
  preTemporada?: { rodadasRestantes: number }
  /**
   * A NOTA DO TREINADOR (0–100) — o número que decide tudo.
   *
   * É a tradução das cinco estrelas do EA FC. Ela sobe com atuação boa e cai com
   * atuação ruim e com jogo assistido do banco; é ela que define se você é
   * titular absoluto ou se some do time. Começa baixa de propósito num clube
   * grande: chegar ao Barcelona aos 17 anos e ser titular na estreia é o tipo de
   * coisa que faz o modo perder a graça na terceira temporada.
   */
  notaDoTreinador: number
  /**
   * OS COMPANHEIROS DE TIME, com nome (1.0.374).
   *
   * O `vestiario` acima é uma MÉDIA e responde "o grupo está com você?". Ele
   * não responde quem é o capitão, quem é o craque que decide se a bola chega
   * em você, nem quem disputa a sua vaga — e sem nome não há história. São
   * quatro papéis, cada um com um efeito que nenhum outro tem.
   */
  companheiros?: Companheiro[]
  /** Forma recente (0–100): média móvel das últimas atuações. */
  forma: number
  moral: number
  temporadaAtual: {
    jogos: number
    titularidades: number
    minutos: number
    gols: number
    assistencias: number
    somaDasNotas: number
    cartoesAmarelos: number
    cartoesVermelhos: number
  }
  ultimasPartidas: PartidaDoAtleta[]
  metas: MetaDaTemporada[]
  /**
   * ⚠️ `pontosDisponiveis` SOBREVIVE por compatibilidade de save, mas a evolução
   * deixou de passar por ele (1.0.325): não se aperta mais "+1 velocidade". O
   * atleta cresce pelo que FAZ em campo, pelo foco de treino e pela
   * personalidade. Ver `evoluirOrganicamente`.
   */
  crescimento: { xp: number; nivel: number; pontosDisponiveis: number }
  /** Onde o atleta se dedica no treino — inclina a evolução sem decidi-la. */
  focoDeTreino: keyof AtributosDoAtleta | "equilibrado"
  /**
   * QUANTO ELE SE PUXA NA SEMANA (1.0.339). Opcional em saves anteriores, onde
   * a ausência significa "normal".
   *
   * ⚠️ Até aqui `focoDeTreino` era um seletor cujo único efeito acontecia UMA
   * VEZ POR ANO, em `evoluirOrganicamente`. Entre uma rodada e outra o atleta
   * não treinava: não havia sessão, nem custo, nem progresso visível — e a
   * comissão ainda cobrava "falta rotina de treino", uma rotina que o jogo não
   * oferecia. A intensidade é o que torna o treino uma DECISÃO: puxado rende
   * mais e chega cansado no jogo; leve preserva a forma e rende pouco.
   */
  intensidadeDeTreino?: IntensidadeDeTreino
  /** O que a última semana de treino rendeu, para a tela poder mostrar. */
  treinoDaSemana?: RelatorioDoTreino
  /** Progresso acumulado rumo ao próximo ponto do atributo focado. */
  progressoDoFoco?: number
  /** O que ele fez em campo nesta temporada. */
  acoes: AcoesDaTemporada
  /** Ganho de atributo da última virada de temporada, para a tela mostrar. */
  ultimaEvolucao: { atributo: keyof AtributosDoAtleta; ganho: number }[]
  selecao: {
    convocada: boolean
    nivel: "sub20" | "principal" | null
    jogos: number
    gols: number
    partidas?: PartidaDaSelecao[]
  }
  historico: TemporadaDoAtleta[]
  propostas: PropostaDeClube[]
  /** Pedido feito ao clube; some quando respondido no fim da temporada. */
  pedido: "nenhum" | "transferencia" | "mais_minutos" | "renovacao"
  titulos: string[]
  premios: string[]
  temporadaEncerrada: boolean
  aposentado: boolean
  /** A pontuação final, congelada no dia da aposentadoria (1.0.374). */
  pontuacaoFinal?: number
  patamarFinal?: string
  /** Mensagens curtas do treinador/agente, a caixa de entrada do atleta. */
  recados: { id: string; de: string; texto: string; temporada: number; rodada: number }[]
  /**
   * SEM CLUBE (1.0.358). Ausente = tem clube, que é o caso de todo save antigo.
   * Ver `rescindirContrato`, `avancarSemanaSemClube` e `contrapropor`.
   */
  semClube?: SemClube
  /** Economia pessoal da carreira NSS. Opcional para saves anteriores. */
  economia?: EconomiaDoAtleta
  apostaAtiva?: ApostaDoAtleta | null
  /**
   * O CAVALO NO HARAS (1.0.374) — id de `CAVALOS_DO_ATLETA`, ou nada.
   *
   * ⚠️ UM SÓ, e não uma lista. Dois cavalos seriam a mesma decisão duas vezes;
   * o que faz a compra ser interessante é ter de escolher QUAL se aguenta
   * manter, e uma lista apagaria a escolha em troca de uma planilha.
   */
  cavalo?: string | null
  /**
   * O QUE O CASSINO JÁ LEVOU (ou deu) NA CARREIRA INTEIRA.
   *
   * Guardado porque a pontuação final o lê: uma carreira financiada no cassino
   * não pode terminar com o mesmo legado de uma construída em campo.
   */
  saldoNoCassino?: number
  /** Quantas noites ele foi. Entra na pontuação final pelo mesmo motivo. */
  noitesNoCassino?: number
  /** Eventos a que já compareceu nesta temporada — evita repetir o mesmo. */
  eventosDaTemporada?: string[]
  /**
   * O MAIOR PRESTÍGIO DE CLUBE EM QUE ELE JÁ JOGOU (1.0.374).
   *
   * ⚠️ GUARDADO, E NÃO RECALCULADO. Um atleta que passou três anos no
   * Barcelona e terminou na Série C tem esse patamar na biografia para sempre;
   * ler só o clube atual apagaria a melhor fase da carreira dele no exato
   * momento em que ela é resumida.
   */
  prestigioMaximo?: number
  /**
   * AS CONQUISTAS QUE JÁ FORAM ANUNCIADAS.
   *
   * Sem isto, cada rodada reanunciaria as mesmas — e o aviso que deveria ser
   * um momento viraria ruído semanal.
   */
  conquistasVistas?: string[]
  parceira?: ParceiraDoAtleta | null
  treinadorPessoal?: TreinadorPessoalDoAtleta | null
  relacoes?: RelacoesDoAtleta
  patrocinioPessoal?: PatrocinioPessoalDoAtleta | null
  patrimonio?: { itens: string[]; estilo: number; totalManutencao: number }
  minijogoDeTreino?: { temporada: number; rodada: number; atributo: keyof AtributosDoAtleta; precisao: number }

  // ─── 1.0.377 ──────────────────────────────────────────────────────────────
  //
  // ⚠️ TUDO OPCIONAL, e não por preguiça de migrar: `migrate` NÃO alcança o
  // interior de `carreiraDeJogador` (é objeto aninhado do save), então um
  // campo obrigatório aqui derruba a tela de QUEM JÁ ESTAVA JOGANDO — o
  // defeito que já apareceu neste projeto com o nome do atleta no meio do erro.
  // Cada leitura abaixo tem `??` do lado de quem lê.

  /** O dilema aberto agora. Um por vez: dois na tela viram formulário. */
  dilemaAberto?: { id: string; rodada: number } | null
  /** `id@temporada` dos dilemas já decididos — impede repetição no mesmo ano. */
  dilemasResolvidos?: string[]
  /** O que aconteceu na última decisão, para a tela contar o desfecho. */
  ultimoDesfechoDeDilema?: { titulo: string; texto: string; deuErrado: boolean; rodada: number } | null

  /**
   * A CARTEIRA DE PATROCÍNIOS (`lib/patrocinio-pessoal`).
   *
   * ⚠️ CONVIVE COM `patrocinioPessoal`, NÃO O SUBSTITUI. O campo antigo é o
   * contrato único da 1.0.373 e continua sendo lido e pago; uma carreira em
   * andamento não pode perder o patrocínio que já tem porque o modelo cresceu.
   * `migrarPatrocinioAntigo` converte o antigo na primeira rodada em que a
   * carteira nova é tocada, e o antigo é então zerado — em nenhum momento os
   * dois pagam ao mesmo tempo.
   */
  patrociniosAtivos?: ContratoDePatrocinio[]
  propostasDePatrocinio?: PropostaDePatrocinio[]
  /** Histórico fechado, para a trajetória mostrar a carreira comercial. */
  patrociniosEncerrados?: { marca: string; temporada: number; cumpriu: boolean; resumo: string }[]
}

// ─── Aleatoriedade semeada ──────────────────────────────────────────────────
//
// Mesma técnica do `youth-career-engine`: hash do FNV sobre uma semente textual.
// Determinismo importa aqui mais do que lá — a mesma rodada precisa dar o mesmo
// resultado se o jogador reabrir o save, senão dá para "rolar de novo" fechando
// e abrindo o jogo até a nota agradar.

function hash(seed: string): number {
  let h = 2166136261
  for (const c of seed) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619) }
  return h >>> 0
}
function roll(seed: string): number { return (hash(seed) % 10000) / 10000 }

// ─── Overall e atributos ────────────────────────────────────────────────────

const PESOS_POR_POSICAO: Record<PosicaoDoAtleta, AtributosDoAtleta> = {
  GOL: { ritmo: 0.05, finalizacao: 0.02, passe: 0.13, drible: 0.05, defesa: 0.55, fisico: 0.20 },
  ZAG: { ritmo: 0.12, finalizacao: 0.03, passe: 0.13, drible: 0.05, defesa: 0.45, fisico: 0.22 },
  LD: { ritmo: 0.24, finalizacao: 0.05, passe: 0.20, drible: 0.14, defesa: 0.25, fisico: 0.12 },
  LE: { ritmo: 0.24, finalizacao: 0.05, passe: 0.20, drible: 0.14, defesa: 0.25, fisico: 0.12 },
  VOL: { ritmo: 0.10, finalizacao: 0.06, passe: 0.26, drible: 0.12, defesa: 0.30, fisico: 0.16 },
  MEI: { ritmo: 0.12, finalizacao: 0.16, passe: 0.30, drible: 0.26, defesa: 0.06, fisico: 0.10 },
  ATA: { ritmo: 0.22, finalizacao: 0.34, passe: 0.10, drible: 0.22, defesa: 0.02, fisico: 0.10 },
}

/** Overall = média PONDERADA pela posição. Um zagueiro não vira 90 driblando. */
export function overallDoAtleta(posicao: PosicaoDoAtleta, atributos: AtributosDoAtleta): number {
  const pesos = PESOS_POR_POSICAO[posicao]
  const soma = (Object.keys(pesos) as (keyof AtributosDoAtleta)[])
    .reduce((total, chave) => total + atributos[chave] * pesos[chave], 0)
  return Math.max(30, Math.min(99, Math.round(soma)))
}

/** Estado economico seguro para saves criados antes da 1.0.370. */
export function economiaDoAtleta(estado: EstadoCarreiraDeJogador): EconomiaDoAtleta {
  return estado.economia ?? {
    dinheiro: Math.max(25_000, estado.ganhosDaTemporada ?? 0),
    energia: 100,
    energiaMaxima: 100,
    equipamentosComprados: [],
    equipamentosEmUso: {},
    totalGastoEmTreino: 0,
    totalGastoEmEnergia: 0,
  }
}

function comEconomia(estado: EstadoCarreiraDeJogador): EstadoCarreiraDeJogador {
  const novo = structuredClone(estado)
  novo.versao = 3
  novo.economia = structuredClone(economiaDoAtleta(novo))
  return novo
}

export function atributosEfetivosDoAtleta(estado: EstadoCarreiraDeJogador): AtributosDoAtleta {
  const atributos = { ...estado.atleta.atributos }
  const economia = economiaDoAtleta(estado)
  for (const id of Object.values(economia.equipamentosEmUso)) {
    const item = EQUIPAMENTOS_DO_ATLETA.find(e => e.id === id)
    if (!item) continue
    for (const [chave, bonus] of Object.entries(item.bonus) as [keyof AtributosDoAtleta, number][]) {
      atributos[chave] = Math.min(99, atributos[chave] + bonus)
    }
  }
  // Energia agora chega ao campo. Abaixo de 55% o atleta perde execucao de
  // forma progressiva; zerado custa ate 13 pontos em cada fundamento. O
  // equipamento continua contando, mas nao transforma exaustao em detalhe.
  const proporcao = economia.energia / Math.max(1, economia.energiaMaxima)
  const penalidade = proporcao < 0.55 ? Math.round((0.55 - proporcao) * 24) : 0
  if (penalidade > 0) {
    for (const chave of Object.keys(atributos) as (keyof AtributosDoAtleta)[]) {
      atributos[chave] = Math.max(20, atributos[chave] - penalidade)
    }
  }
  return atributos
}

export function comprarEnergia(
  estado: EstadoCarreiraDeJogador,
  quantidade: 25 | 60,
): EstadoCarreiraDeJogador {
  const novo = comEconomia(estado)
  const economia = novo.economia!
  const preco = quantidade === 25 ? 4_000 : 8_500
  if (economia.dinheiro < preco || economia.energia >= economia.energiaMaxima) return estado
  economia.dinheiro -= preco
  economia.energia = Math.min(economia.energiaMaxima, economia.energia + quantidade)
  economia.totalGastoEmEnergia += preco
  return novo
}

export function treinarAtributoIndividual(
  estado: EstadoCarreiraDeJogador,
  atributo: keyof AtributosDoAtleta,
): EstadoCarreiraDeJogador {
  const novo = comEconomia(estado)
  const economia = novo.economia!
  const treinador = novo.treinadorPessoal
  const custo = treinador ? 9 : 12
  if (economia.energia < custo || novo.atleta.atributos[atributo] >= novo.atleta.potencial) return estado
  economia.energia -= custo
  economia.totalGastoEmTreino += custo
  economia.ultimoTreinoIndividual = `${novo.temporada}:${novo.rodada}:${atributo}`
  const ganho = treinador && (treinador.especialidade === "equilibrado" || treinador.especialidade === atributo)
    && roll(`${novo.atleta.id}:treinador:${novo.temporada}:${novo.rodada}:${atributo}`) < treinador.bonusTreino
    ? 2 : 1
  novo.atleta.atributos[atributo] = Math.min(novo.atleta.potencial, novo.atleta.atributos[atributo] + ganho)
  novo.atleta.overall = overallDoAtleta(novo.atleta.posicao, novo.atleta.atributos)
  novo.moral = limitar(novo.moral + 1)
  novo.treinoDaSemana = {
    intensidade: novo.intensidadeDeTreino ?? "normal", xp: 0, deltaForma: -1,
    ganho: { atributo, ganho }, texto: `Treino individual: ${NOME_DO_ATRIBUTO[atributo]} +${ganho} por ${custo} de energia.`,
  }
  return novo
}

export function comprarEquipamento(estado: EstadoCarreiraDeJogador, itemId: string): EstadoCarreiraDeJogador {
  const item = EQUIPAMENTOS_DO_ATLETA.find(e => e.id === itemId)
  if (!item) return estado
  const novo = comEconomia(estado)
  const economia = novo.economia!
  if (economia.equipamentosComprados.includes(item.id) || economia.dinheiro < item.preco) return estado
  economia.dinheiro -= item.preco
  economia.equipamentosComprados.push(item.id)
  economia.equipamentosEmUso[item.categoria] = item.id
  if (item.bonusEnergia) {
    economia.energiaMaxima += item.bonusEnergia
    economia.energia = Math.min(economia.energiaMaxima, economia.energia + item.bonusEnergia)
  }
  return novo
}

export function equiparItem(estado: EstadoCarreiraDeJogador, itemId: string): EstadoCarreiraDeJogador {
  const item = EQUIPAMENTOS_DO_ATLETA.find(e => e.id === itemId)
  const atual = economiaDoAtleta(estado)
  if (!item || !atual.equipamentosComprados.includes(item.id)) return estado
  const novo = comEconomia(estado)
  novo.economia!.equipamentosEmUso[item.categoria] = item.id
  return novo
}

export function fazerAposta(
  estado: EstadoCarreiraDeJogador,
  palpite: ApostaDoAtleta["palpite"],
  valor: number,
): EstadoCarreiraDeJogador {
  const proxima = estado.calendario.find(f => !f.played && f.isUserMatch)
  const novo = comEconomia(estado)
  const economia = novo.economia!
  const limite = Math.floor(economia.dinheiro * 0.25)
  const aposta = Math.floor(valor)
  if (!proxima || novo.apostaAtiva || aposta < 100 || aposta > limite) return estado
  economia.dinheiro -= aposta
  novo.apostaAtiva = {
    id: `aposta_${novo.temporada}_${proxima.round}`, rodada: proxima.round, palpite,
    valor: aposta, multiplicador: palpite === "vitoria" ? 1.8 : palpite === "empate" ? 3.1 : 2.5,
    adversario: proxima.homeCurto === novo.clubeCurto ? proxima.awayNome : proxima.homeNome,
  }
  return novo
}

function liquidarAposta(estado: EstadoCarreiraDeJogador, golsPro: number, golsContra: number): void {
  const aposta = estado.apostaAtiva
  if (!aposta) return
  const resultado: ApostaDoAtleta["palpite"] = golsPro > golsContra ? "vitoria" : golsPro === golsContra ? "empate" : "derrota"
  const economia = economiaDoAtleta(estado)
  estado.economia = economia
  if (resultado === aposta.palpite) economia.dinheiro += Math.round(aposta.valor * aposta.multiplicador)
  estado.recados = [{
    id: `aposta_resultado_${estado.temporada}_${estado.rodada}`, de: "Carteira",
    texto: resultado === aposta.palpite
      ? `Aposta certa contra ${aposta.adversario}: retorno de ${Math.round(aposta.valor * aposta.multiplicador).toLocaleString("pt-BR")}.`
      : `Aposta perdida contra ${aposta.adversario}.`,
    temporada: estado.temporada, rodada: estado.rodada,
  }, ...estado.recados].slice(0, 25)
  estado.apostaAtiva = null
}

export function interagirComParceira(
  estado: EstadoCarreiraDeJogador,
  acao: "conhecer" | "encontro" | "presente" | "conversar",
): EstadoCarreiraDeJogador {
  const novo = comEconomia(estado)
  const economia = novo.economia!
  if (!novo.parceira) {
    if (acao !== "conhecer") return estado
    novo.parceira = { nome: "Marina", afinidade: 18, fase: "conhecendo", ultimaInteracaoRodada: novo.rodada, momentos: 1 }
    novo.moral = limitar(novo.moral + 4)
    return novo
  }
  if (novo.parceira.ultimaInteracaoRodada === novo.rodada) return estado
  const custo = acao === "presente" ? 3_500 : acao === "encontro" ? 1_200 : 0
  if (economia.dinheiro < custo) return estado
  economia.dinheiro -= custo
  novo.parceira.afinidade = Math.min(100, novo.parceira.afinidade + (acao === "presente" ? 14 : acao === "encontro" ? 10 : 6))
  novo.parceira.momentos++
  novo.parceira.ultimaInteracaoRodada = novo.rodada
  novo.parceira.fase = novo.parceira.afinidade >= 70 ? "relacao_seria" : novo.parceira.afinidade >= 35 ? "namoro" : "conhecendo"
  novo.moral = limitar(novo.moral + 3)
  return novo
}

/**
 * MOVE A REPUTAÇÃO PASSANDO PELA IMPRENSA (1.0.374).
 *
 * ⚠️ TODA VARIAÇÃO DE REPUTAÇÃO PASSA POR AQUI, e é por isso que ela existe.
 * A reputação se move em seis pontos diferentes do arquivo (gol, entrevista,
 * bem de luxo, repercussão, seleção...). Multiplicar em cada um daria seis
 * lugares para esquecer um, e o laço com a imprensa ficaria pela metade sem
 * que nada acusasse.
 *
 * AMPLIFICA A QUEDA TAMBÉM. Imprensa amiga sobe mais rápido e AFUNDA mais
 * rápido — senão "agradar a imprensa" seria escolha sem risco, e escolha sem
 * risco não é escolha.
 */
export function moverReputacao(estado: EstadoCarreiraDeJogador, delta: number): number {
  const fator = amplificacaoDaImprensa(lerRelacoes(relacoesDoAtleta(estado)))
  const base = estado.reputacao ?? 30
  return Math.max(0, Math.min(100, base + delta * fator))
}

/**
 * UMA NOITE NO CASSINO.
 *
 * ⚠️ O DINHEIRO SAI ANTES DE O RESULTADO SER CONHECIDO, e a ordem importa: se
 * a aposta fosse debitada só na derrota, apostar acima do que se tem seria
 * possível e o risco viraria teatro. Aqui quem não tem, não joga.
 */
export function jogarNoCassinoDoAtleta(
  estado: EstadoCarreiraDeJogador,
  mesaId: JogoDeCassino,
  aposta: number,
): EstadoCarreiraDeJogador {
  const mesa = MESAS_DE_CASSINO.find(m => m.id === mesaId)
  if (!mesa) return estado
  const valor = Math.max(mesa.minimo, Math.min(mesa.maximo, Math.round(aposta)))
  const economia = economiaDoAtleta(estado)
  if (economia.dinheiro < valor) return estado

  const novo = comEconomia(estado)
  novo.relacoes = structuredClone(relacoesDoAtleta(novo))
  const r = jogarNoCassino(
    mesa, valor,
    `${novo.atleta.id}:cassino:${novo.temporada}:${novo.rodada}:${novo.noitesNoCassino ?? 0}`,
  )

  novo.economia!.dinheiro += r.saldo
  novo.saldoNoCassino = (novo.saldoNoCassino ?? 0) + r.saldo
  novo.noitesNoCassino = (novo.noitesNoCassino ?? 0) + 1
  novo.forma = limitar(novo.forma + r.forma)
  if (r.reputacao) novo.reputacao = moverReputacao(novo, r.reputacao)
  novo.relacoes.familia = limitar((novo.relacoes.familia ?? 72) + r.familia)
  novo.recados = [{
    id: `cassino_${novo.temporada}_${novo.rodada}_${novo.noitesNoCassino}`,
    de: "Noite", texto: r.texto, temporada: novo.temporada, rodada: novo.rodada,
  }, ...novo.recados].slice(0, 25)
  return novo
}

/** Compra o cavalo. O haras é do atleta; o custo semanal também. */
export function comprarCavalo(estado: EstadoCarreiraDeJogador, cavaloId: string): EstadoCarreiraDeJogador {
  const cavalo = CAVALOS_DO_ATLETA.find(c => c.id === cavaloId)
  if (!cavalo || estado.cavalo) return estado
  const economia = economiaDoAtleta(estado)
  if (economia.dinheiro < cavalo.preco) return estado
  const novo = comEconomia(estado)
  novo.economia!.dinheiro -= cavalo.preco
  novo.cavalo = cavalo.id
  const patrimonio = novo.patrimonio ?? { itens: [], estilo: 0, totalManutencao: 0 }
  novo.patrimonio = { ...patrimonio, estilo: patrimonio.estilo + cavalo.estilo }
  novo.reputacao = moverReputacao(novo, 2)
  return novo
}

/** Vende o cavalo por 70% — cavalo usado não vale o que custou. */
export function venderCavalo(estado: EstadoCarreiraDeJogador): EstadoCarreiraDeJogador {
  const cavalo = CAVALOS_DO_ATLETA.find(c => c.id === estado.cavalo)
  if (!cavalo) return estado
  const novo = comEconomia(estado)
  novo.economia!.dinheiro += Math.round(cavalo.preco * 0.7)
  novo.cavalo = null
  const patrimonio = novo.patrimonio ?? { itens: [], estilo: 0, totalManutencao: 0 }
  novo.patrimonio = { ...patrimonio, estilo: Math.max(0, patrimonio.estilo - cavalo.estilo) }
  return novo
}

/** Os convites que chegaram nesta semana. */
export function eventosDoMomento(estado: EstadoCarreiraDeJogador): ConviteDeEvento[] {
  const jaFoi = estado.eventosDaTemporada ?? []
  return convitesDaSemana(
    estado.reputacao ?? 30,
    `${estado.atleta.id}:evento:${estado.temporada}:${estado.rodada}`,
  ).filter(c => !jaFoi.includes(`${c.id}:${estado.rodada}`))
}

/**
 * COMPARECER A UM EVENTO.
 *
 * ⚠️ A ENERGIA É COBRADA ANTES DE QUALQUER EFEITO BOM. Um evento que só dá
 * reputação seria botão de graça, e o jogador iria a todos toda semana — o que
 * transformaria a agenda social numa segunda fonte de progresso sem custo. O
 * custo é a semana de treino que ele não fez.
 */
export function comparecerAoEvento(
  estado: EstadoCarreiraDeJogador,
  eventoId: string,
): EstadoCarreiraDeJogador {
  const evento = CONVITES_DE_EVENTO.find(e => e.id === eventoId)
  if (!evento) return estado
  const economia = economiaDoAtleta(estado)
  if (economia.energia < evento.energia) return estado
  if (evento.custo > 0 && economia.dinheiro < evento.custo) return estado

  const novo = comEconomia(estado)
  novo.economia!.energia = Math.max(0, novo.economia!.energia - evento.energia)
  novo.economia!.dinheiro -= evento.custo

  const base = { ...relacoesDoAtleta(novo), ...lerRelacoes(relacoesDoAtleta(novo)) }
  novo.relacoes = {
    ...relacoesDepoisDoEvento(lerRelacoes(base), evento),
    marcas: limitar(base.marcas + (evento.efeitos.marcas ?? 0)),
    rupturas: base.rupturas,
    ultimaInteracaoElenco: evento.efeitos.elenco ? novo.rodada : base.ultimaInteracaoElenco,
  }
  if (evento.efeitos.reputacao) novo.reputacao = moverReputacao(novo, evento.efeitos.reputacao)
  if (evento.efeitos.moral) novo.moral = limitar(novo.moral + evento.efeitos.moral)
  if (evento.efeitos.forma) novo.forma = limitar(novo.forma + evento.efeitos.forma)
  novo.eventosDaTemporada = [...(novo.eventosDaTemporada ?? []), `${evento.id}:${novo.rodada}`]
  return novo
}

/**
 * O RESUMO DA CARREIRA — a matéria-prima da pontuação final (1.0.374).
 *
 * ⚠️ ELE LÊ O `historico`, NÃO A TEMPORADA ATUAL. A temporada em curso ainda
 * não fechou; incluí-la faria o número dançar toda rodada e a comparação com
 * carreiras encerradas seria entre coisas diferentes. O que está em curso
 * aparece na tela como "em andamento", nunca somado.
 */
export function folhaDaCarreira(estado: EstadoCarreiraDeJogador): FolhaDaCarreira {
  const h = estado.historico ?? []
  const jogos = h.reduce((n, t) => n + t.jogos, 0)
  const somaNotas = h.reduce((n, t) => n + t.notaMedia * t.jogos, 0)
  return {
    nome: estado.atleta.nome,
    posicao: String(estado.atleta.posicao),
    temporadas: h.length,
    jogos,
    gols: h.reduce((n, t) => n + t.gols, 0),
    assistencias: h.reduce((n, t) => n + t.assistencias, 0),
    // Média PONDERADA por jogos: a média das médias daria a uma temporada de
    // 3 jogos o mesmo peso de uma de 60, e um ano bom e curto valeria mais que
    // uma década regular.
    notaMedia: jogos > 0 ? somaNotas / jogos : 0,
    titulos: estado.titulos?.length ?? 0,
    premios: estado.premios?.length ?? 0,
    overallMaximo: Math.max(estado.atleta.overall, ...h.map(t => t.overallFinal), 0),
    prestigioMaximo: Math.max(estado.prestigioMaximo ?? 0, prestigioDoClubeAtual(estado)),
    selecaoJogos: estado.selecao?.jogos ?? 0,
    selecaoGols: estado.selecao?.gols ?? 0,
    saldoNoCassino: estado.saldoNoCassino ?? 0,
    noitesNoCassino: estado.noitesNoCassino ?? 0,
    reputacaoFinal: estado.reputacao ?? 30,
  }
}

/** O prestígio do clube em que ele está agora — para o eixo "patamar". */
function prestigioDoClubeAtual(estado: EstadoCarreiraDeJogador): number {
  return clubesDaLiga(estado).find(c => c.curto === estado.clubeCurto)?.prestigio ?? 0
}

/** A pontuação em andamento: eixos e desconto, sem o bônus das conquistas. */
export function pontuacaoAtual(estado: EstadoCarreiraDeJogador): PontuacaoDaCarreira {
  return pontuacaoDaCarreira(folhaDaCarreira(estado))
}

/** A pontuação fechada, com conquistas. Só faz sentido na aposentadoria. */
export function pontuacaoDeAposentadoria(estado: EstadoCarreiraDeJogador) {
  return pontuacaoFinal(folhaDaCarreira(estado))
}

export function conquistasDaCarreira(estado: EstadoCarreiraDeJogador): Conquista[] {
  return conquistasAtingidas(folhaDaCarreira(estado))
}

/** A carreira, no formato que o ranking consome. */
export function entradaNoRanking(estado: EstadoCarreiraDeJogador): EntradaDoRanking {
  const r = folhaDaCarreira(estado)
  return {
    nome: r.nome, posicao: r.posicao,
    pontos: pontuacaoFinal(r).total,
    jogos: r.jogos, gols: r.gols, titulos: r.titulos, minha: true,
  }
}

export function relacoesDoAtleta(estado: EstadoCarreiraDeJogador): RelacoesDoAtleta {
  // ⚠️ `relacoesIniciais()` VEM PRIMEIRO e `elenco: 50` depois, de propósito:
  // as duas fontes declaram `elenco`, e a que manda tem de ser a da 1.0.373,
  // que é a que o resto do arquivo já lia.
  return estado.relacoes ?? { ...relacoesIniciais(), elenco: 50, marcas: 35, rupturas: [] }
}

export function contratarTreinadorPessoal(
  estado: EstadoCarreiraDeJogador,
  treinadorId: string,
): EstadoCarreiraDeJogador {
  const plano = TREINADORES_PESSOAIS.find(t => t.id === treinadorId)
  if (!plano) return estado
  const novo = comEconomia(estado)
  if (novo.economia!.dinheiro < plano.custoContratacao) return estado
  novo.economia!.dinheiro -= plano.custoContratacao
  novo.treinadorPessoal = {
    id: plano.id, nome: plano.nome, especialidade: plano.especialidade,
    custoSemanal: plano.custoSemanal, bonusTreino: plano.bonusTreino, semanasRestantes: 12,
  }
  novo.recados = [{
    id: `treinador_pessoal_${novo.temporada}_${novo.rodada}`, de: "Equipe pessoal",
    texto: `${plano.nome} assinou por 12 semanas e vai acompanhar cada sessao individual.`,
    temporada: novo.temporada, rodada: novo.rodada,
  }, ...novo.recados].slice(0, 25)
  return novo
}

export function realizarMinijogoDeTreino(
  estado: EstadoCarreiraDeJogador,
  atributo: keyof AtributosDoAtleta,
  precisao: number,
): EstadoCarreiraDeJogador {
  if (estado.minijogoDeTreino?.temporada === estado.temporada && estado.minijogoDeTreino.rodada === estado.rodada) return estado
  const novo = comEconomia(estado)
  const qualidade = Math.max(0, Math.min(1, precisao))
  const treinador = novo.treinadorPessoal
  const custo = treinador ? 6 : 9
  if (novo.economia!.energia < custo) return estado
  novo.economia!.energia -= custo
  novo.economia!.totalGastoEmTreino += custo
  novo.minijogoDeTreino = { temporada: novo.temporada, rodada: novo.rodada, atributo, precisao: qualidade }

  const bonusEspecialidade = treinador && (treinador.especialidade === "equilibrado" || treinador.especialidade === atributo)
    ? treinador.bonusTreino : 0
  const desempenho = Math.min(1, qualidade + bonusEspecialidade)
  aplicarXP(novo, Math.round(6 + desempenho * 18))
  if (desempenho >= 0.82 && novo.atleta.atributos[atributo] < novo.atleta.potencial) {
    novo.atleta.atributos[atributo]++
    novo.atleta.overall = overallDoAtleta(novo.atleta.posicao, novo.atleta.atributos)
  }
  novo.forma = limitar(novo.forma - (desempenho < 0.45 ? 2 : 1))
  novo.treinoDaSemana = {
    intensidade: novo.intensidadeDeTreino ?? "normal", xp: Math.round(6 + desempenho * 18), deltaForma: -1,
    ganho: desempenho >= 0.82 ? { atributo, ganho: 1 } : null,
    texto: desempenho >= 0.82
      ? `Minijogo perfeito: ${NOME_DO_ATRIBUTO[atributo]} +1.`
      : `Minijogo concluido com ${Math.round(desempenho * 100)}% de precisao.`,
  }
  return novo
}

export function interagirComElenco(
  estado: EstadoCarreiraDeJogador,
  acao: "treinar_junto" | "jantar" | "liderar",
): EstadoCarreiraDeJogador {
  const relacaoAtual = relacoesDoAtleta(estado)
  if (relacaoAtual.ultimaInteracaoElenco === estado.rodada) return estado
  const novo = comEconomia(estado)
  novo.relacoes = structuredClone(relacaoAtual)
  const energia = acao === "treinar_junto" ? 5 : 0
  const dinheiro = acao === "jantar" ? 2_500 : 0
  if (novo.economia!.energia < energia || novo.economia!.dinheiro < dinheiro) return estado
  novo.economia!.energia -= energia
  novo.economia!.dinheiro -= dinheiro
  const ganho = acao === "jantar" ? 10 : acao === "liderar" ? (novo.capitao ? 9 : 5) : 7
  novo.relacoes.elenco = limitar(novo.relacoes.elenco + ganho)
  novo.relacoes.ultimaInteracaoElenco = novo.rodada
  novo.moral = limitar(novo.moral + 2)
  return novo
}

export function assinarPatrocinioPessoal(
  estado: EstadoCarreiraDeJogador,
  patrocinioId: string,
): EstadoCarreiraDeJogador {
  const plano = PATROCINIOS_PESSOAIS.find(p => p.id === patrocinioId)
  if (!plano || estado.patrocinioPessoal || (estado.reputacao ?? 0) < plano.reputacaoMinima) return estado
  const novo = comEconomia(estado)
  novo.relacoes = structuredClone(relacoesDoAtleta(novo))
  novo.patrocinioPessoal = {
    id: plano.id, marca: plano.marca, valorSemanal: plano.valorSemanal,
    bonusPorGol: plano.bonusPorGol, semanasRestantes: plano.semanas,
    metaGols: plano.metaGols, golsNoContrato: 0,
  }
  novo.relacoes.marcas = limitar(novo.relacoes.marcas + 5)
  novo.economia!.dinheiro += plano.valorSemanal
  return novo
}

export function comprarBemDoAtleta(
  estado: EstadoCarreiraDeJogador,
  bemId: string,
): EstadoCarreiraDeJogador {
  const bem = BENS_DO_ATLETA.find(b => b.id === bemId)
  const atual = estado.patrimonio ?? { itens: [], estilo: 0, totalManutencao: 0 }
  if (!bem || atual.itens.includes(bem.id)) return estado
  const novo = comEconomia(estado)
  if (novo.economia!.dinheiro < bem.preco) return estado
  novo.economia!.dinheiro -= bem.preco
  novo.patrimonio = structuredClone(atual)
  novo.patrimonio.itens.push(bem.id)
  novo.patrimonio.estilo += bem.estilo
  novo.reputacao = moverReputacao(novo, Math.min(3, Math.floor(bem.estilo / 8)))
  return novo
}

// ═══════════════════════════════════════════════════════════════════════════
// DILEMAS FORA DE CAMPO (1.0.377) — ver `lib/dilemas-do-atleta`
// ═══════════════════════════════════════════════════════════════════════════

/** O retrato que o catálogo de dilemas lê para decidir o que faz sentido agora. */
function contextoDoDilema(estado: EstadoCarreiraDeJogador): ContextoDoDilema {
  const economia = economiaDoAtleta(estado)
  return {
    rodada: estado.rodada,
    temporada: estado.temporada,
    idade: estado.atleta.idade,
    reputacao: estado.reputacao ?? 30,
    torcida: estado.torcida ?? 50,
    dinheiro: economia.dinheiro,
    moral: estado.moral,
    relacoes: lerRelacoes(relacoesDoAtleta(estado)),
    papel: papelNoElenco(estado.notaDoTreinador ?? 50),
    temPatrocinio: Boolean(estado.patrocinioPessoal) || (estado.patrociniosAtivos?.length ?? 0) > 0,
    temParceira: Boolean(estado.parceira),
    temporadasDeContrato: Math.max(0, estado.contrato.ateTemporada - estado.temporada),
    vermelhos: estado.temporadaAtual.cartoesVermelhos,
    media: mediaDaTemporada(estado),
    jaResolvidos: estado.dilemasResolvidos ?? [],
  }
}

/**
 * O DILEMA QUE ESTÁ NA MESA — e por que ele é RECALCULADO, não guardado inteiro.
 *
 * ⚠️ O SAVE GUARDA SÓ O `id` E A RODADA. Serializar o dilema completo (títulos,
 * textos, efeitos) congelaria no save de cada jogador o texto da versão em que
 * ele apareceu — corrigir uma redação ou um balanceamento não alcançaria mais
 * ninguém, e o save cresceria por causa de texto que o código já tem. É a mesma
 * razão pela qual o universo saiu do save na 1.0.301.
 */
export function dilemaDaVez(estado: EstadoCarreiraDeJogador): Dilema | null {
  const ctx = contextoDoDilema(estado)
  const aberto = estado.dilemaAberto
  if (aberto) {
    // ⚠️ RECONSTRUÍDO PELA RODADA EM QUE NASCEU, não pela rodada de hoje. O
    // jogador que abre a tela três rodadas depois tem de encontrar o MESMO
    // dilema — recalcular com a rodada atual trocaria a pergunta debaixo dele.
    const naquela = dilemaDaRodada({ ...ctx, rodada: aberto.rodada })
    if (naquela && naquela.id === aberto.id) return naquela
    return null
  }
  return dilemaDaRodada(ctx)
}

/** Abre o dilema da rodada, se houver. Chamado pelo avanço de semana. */
function abrirDilemaDaRodada(estado: EstadoCarreiraDeJogador): void {
  if (estado.dilemaAberto) return
  const d = dilemaDaRodada(contextoDoDilema(estado))
  estado.dilemaAberto = d ? { id: d.id, rodada: estado.rodada } : null
}

/**
 * APLICA UM EFEITO DE DILEMA. Um só lugar mexe no estado, e é este.
 *
 * ⚠️ `torcida` VAI PARA `estado.torcida`, NUNCA para `relacoes`. Ver a seção
 * A TORCIDA em `lib/relacoes-do-atleta`: existe um único campo de arquibancada
 * neste jogo e é aquele. Duplicá-lo aqui daria dois números discordando.
 */
function aplicarEfeitoDoDilema(estado: EstadoCarreiraDeJogador, efeito: EfeitoDoDilema): void {
  estado.economia = economiaDoAtleta(estado)
  estado.relacoes = { ...relacoesDoAtleta(estado), ...lerRelacoes(relacoesDoAtleta(estado)) }

  for (const [pessoa, delta] of Object.entries(efeito.relacoes ?? {})) {
    if (!delta) continue
    const chave = pessoa as "treinador" | "elenco" | "empresario" | "familia" | "imprensa" | "marcas"
    estado.relacoes[chave] = limitar((estado.relacoes[chave] ?? 50) + delta)
  }

  if (efeito.dinheiro) estado.economia.dinheiro = Math.max(0, estado.economia.dinheiro + efeito.dinheiro)
  if (efeito.energia) estado.economia.energia = Math.max(0, Math.min(estado.economia.energiaMaxima, estado.economia.energia + efeito.energia))
  if (efeito.reputacao) estado.reputacao = moverReputacao(estado, efeito.reputacao)
  if (efeito.moral) estado.moral = limitar(estado.moral + efeito.moral)
  if (efeito.forma) estado.forma = limitar(estado.forma + efeito.forma)
  if (efeito.torcida) estado.torcida = limitar((estado.torcida ?? 50) + efeito.torcida)
}

/** Decide o dilema aberto. Fora dele nada acontece — a escolha é a única porta. */
export function decidirDilema(
  estado: EstadoCarreiraDeJogador,
  escolhaId: string,
): EstadoCarreiraDeJogador {
  const dilema = dilemaDaVez(estado)
  if (!dilema) return estado

  const novo = comEconomia(estado)
  const desfecho = resolverDilema(dilema, escolhaId, { temporada: novo.temporada, rodada: novo.rodada })
  aplicarEfeitoDoDilema(novo, desfecho.efeito)

  novo.dilemasResolvidos = [...(novo.dilemasResolvidos ?? []), chaveDoDilema(dilema, novo)]
  novo.dilemaAberto = null
  novo.ultimoDesfechoDeDilema = {
    titulo: dilema.titulo,
    texto: desfecho.texto,
    deuErrado: desfecho.deuErrado,
    rodada: novo.rodada,
  }
  return novo
}

// ═══════════════════════════════════════════════════════════════════════════
// PATROCÍNIO PESSOAL (1.0.377) — ver `lib/patrocinio-pessoal`
// ═══════════════════════════════════════════════════════════════════════════

/** O retrato comercial do atleta — o que decide quem faz proposta e de quanto. */
export function perfilComercial(estado: EstadoCarreiraDeJogador): PerfilComercial {
  const ativos = estado.patrociniosAtivos ?? []
  return {
    reputacao: estado.reputacao ?? 30,
    torcida: estado.torcida ?? 50,
    idade: estado.atleta.idade,
    gols: estado.temporadaAtual.gols,
    jogos: estado.temporadaAtual.jogos,
    media: mediaDaTemporada(estado),
    estilo: estado.patrimonio?.estilo ?? 0,
    relacoes: lerRelacoes(relacoesDoAtleta(estado)),
    temporada: estado.temporada,
    rodada: estado.rodada,
    categoriasOcupadas: ativos.map(c => c.categoria),
  }
}

/**
 * MIGRA O CONTRATO ÚNICO DA 1.0.373 PARA A CARTEIRA.
 *
 * ⚠️ ELE NÃO É DESCARTADO NEM DUPLICADO. Quem tinha `patrocinioPessoal` ativo
 * continua com o mesmo valor semanal, o mesmo bônus por gol e as mesmas semanas
 * restantes — só que agora dentro do modelo que negocia e cobra cláusula. A
 * meta de gols vira cláusula com o progresso já feito preservado, e o campo
 * antigo é zerado na mesma passada: em nenhum instante os dois pagam.
 */
function migrarPatrocinioAntigo(estado: EstadoCarreiraDeJogador): void {
  const antigo = estado.patrocinioPessoal
  if (!antigo) return
  const carteira = estado.patrociniosAtivos ?? []
  if (carteira.some(c => c.marcaId === antigo.id)) { estado.patrocinioPessoal = null; return }

  carteira.push({
    id: `${antigo.id}@${estado.temporada}`,
    marcaId: antigo.id,
    marca: antigo.marca,
    categoria: "material_esportivo",
    valorSemanal: antigo.valorSemanal,
    bonusPorGol: antigo.bonusPorGol,
    luvas: 0,
    semanasTotais: Math.max(antigo.semanasRestantes, 1),
    semanasRestantes: antigo.semanasRestantes,
    clausulas: [{
      tipo: "gols",
      alvo: antigo.metaGols,
      cumprido: antigo.golsNoContrato,
      bonus: antigo.bonusPorGol * antigo.metaGols * 0.6,
      multa: antigo.valorSemanal * 5,
    }],
    aparicoesExigidas: 0,
    aparicoesFeitas: 0,
    assinadoNaTemporada: estado.temporada,
  })
  estado.patrociniosAtivos = carteira
  estado.patrocinioPessoal = null
}

/** As propostas na mesa. Recalculadas quando a lista guardada está vazia. */
export function propostasDePatrocinio(estado: EstadoCarreiraDeJogador): PropostaDePatrocinio[] {
  const guardadas = (estado.propostasDePatrocinio ?? []).filter(p => p.estado === "aberta")
  if (guardadas.length > 0) return guardadas
  return propostasDaRodada(perfilComercial(estado))
}

export function negociarPatrocinio(
  estado: EstadoCarreiraDeJogador,
  propostaId: string,
  pedido: PedidoNaNegociacao,
): EstadoCarreiraDeJogador {
  const abertas = propostasDePatrocinio(estado)
  const alvo = abertas.find(p => p.id === propostaId)
  if (!alvo) return estado
  const novo = comEconomia(estado)
  const depois = contraproporPatrocinio(alvo, pedido, perfilComercial(novo))
  novo.propostasDePatrocinio = abertas.map(p => p.id === propostaId ? depois : p)
  return novo
}

export function assinarPatrocinioDaProposta(
  estado: EstadoCarreiraDeJogador,
  propostaId: string,
): EstadoCarreiraDeJogador {
  const abertas = propostasDePatrocinio(estado)
  const alvo = abertas.find(p => p.id === propostaId && p.estado === "aberta")
  if (!alvo) return estado

  const novo = comEconomia(estado)
  migrarPatrocinioAntigo(novo)
  novo.relacoes = { ...relacoesDoAtleta(novo), ...lerRelacoes(relacoesDoAtleta(novo)) }

  const carteira = novo.patrociniosAtivos ?? []
  // A exclusividade é conferida AQUI também, e não só na geração da proposta:
  // uma proposta guardada no save pode ter nascido antes do contrato que hoje
  // ocupa a categoria.
  if (carteira.some(c => c.categoria === alvo.categoria)) return estado

  carteira.push(assinarProposta(alvo, novo.temporada))
  novo.patrociniosAtivos = carteira
  novo.economia!.dinheiro += alvo.luvas
  novo.relacoes.marcas = limitar(novo.relacoes.marcas + 6)
  if (alvo.custoDeTorcida) novo.torcida = limitar((novo.torcida ?? 50) - alvo.custoDeTorcida)
  novo.propostasDePatrocinio = abertas.map(p => p.id === propostaId ? { ...p, estado: "assinada" as const } : p)
  return novo
}

export function recusarPropostaDePatrocinio(
  estado: EstadoCarreiraDeJogador,
  propostaId: string,
): EstadoCarreiraDeJogador {
  const abertas = propostasDePatrocinio(estado)
  if (!abertas.some(p => p.id === propostaId)) return estado
  const novo = comEconomia(estado)
  novo.propostasDePatrocinio = abertas.map(p => p.id === propostaId ? { ...p, estado: "recusada" as const } : p)
  return novo
}

/** Cumpre uma aparição contratual — paga em energia, como o contrato prevê. */
export function fazerAparicaoDeMarca(
  estado: EstadoCarreiraDeJogador,
  contratoId: string,
): EstadoCarreiraDeJogador {
  const novo = comEconomia(estado)
  const carteira = novo.patrociniosAtivos ?? []
  const alvo = carteira.find(c => c.id === contratoId)
  if (!alvo || alvo.aparicoesFeitas >= alvo.aparicoesExigidas) return estado
  if (novo.economia!.energia < ENERGIA_POR_APARICAO) return estado

  novo.economia!.energia -= ENERGIA_POR_APARICAO
  novo.patrociniosAtivos = carteira.map(c => c.id === contratoId ? cumprirAparicao(c) : c)
  novo.relacoes = { ...relacoesDoAtleta(novo), ...lerRelacoes(relacoesDoAtleta(novo)) }
  novo.relacoes.marcas = limitar(novo.relacoes.marcas + 2)
  return novo
}

/**
 * O QUE UMA PARTIDA FAZ NOS CONTRATOS — bônus por gol e progresso de cláusula.
 *
 * ⚠️ SEPARADO DA SEMANA, E ESSA SEPARAÇÃO É O QUE IMPEDE PAGAMENTO DUPLO. A
 * carreira tem DOIS caminhos até um resultado (a partida vivida e a simulada) e
 * UM único avanço de semana. Se o pagamento semanal morasse aqui, quem joga a
 * partida receberia o salário da marca duas vezes; se o bônus por gol morasse
 * na semana, a partida da seleção — que não avança rodada — não pagaria nada.
 * Cada um no seu lugar, chamado de onde o dado existe.
 */
function registrarPartidaNosPatrocinios(estado: EstadoCarreiraDeJogador, gols: number): void {
  migrarPatrocinioAntigo(estado)
  const carteira = estado.patrociniosAtivos ?? []
  if (carteira.length === 0) return

  let bonus = 0
  estado.patrociniosAtivos = carteira.map(c => {
    bonus += gols * c.bonusPorGol
    return {
      ...c,
      clausulas: c.clausulas.map(cl =>
        cl.tipo === "gols" ? { ...cl, cumprido: cl.cumprido + gols }
        : cl.tipo === "jogos" ? { ...cl, cumprido: cl.cumprido + 1 }
        : cl),
    }
  })

  if (bonus > 0) {
    estado.economia = economiaDoAtleta(estado)
    estado.economia.dinheiro += bonus
    estado.ganhosDaTemporada += bonus
    estado.relacoes = { ...relacoesDoAtleta(estado), ...lerRelacoes(relacoesDoAtleta(estado)) }
    estado.relacoes.marcas = limitar(estado.relacoes.marcas + Math.min(3, gols))
  }
}

/** A passagem de uma rodada sobre a carteira — paga o semanal, cobra e encerra. */
function aplicarPatrociniosNaSemana(estado: EstadoCarreiraDeJogador): void {
  migrarPatrocinioAntigo(estado)
  const carteira = estado.patrociniosAtivos ?? []
  if (carteira.length === 0) return

  // gols/jogos já foram contados por `registrarPartidaNosPatrocinios`; aqui a
  // semana só paga, envelhece e fecha. As aparições são lidas do contrato.
  const r = rodarSemanaDePatrocinio(carteira, { golsNaRodada: 0, jogou: false })
  estado.patrociniosAtivos = r.contratos
  estado.economia = economiaDoAtleta(estado)
  estado.economia.dinheiro = Math.max(0, estado.economia.dinheiro + r.dinheiro)

  estado.relacoes = { ...relacoesDoAtleta(estado), ...lerRelacoes(relacoesDoAtleta(estado)) }
  if (r.ajusteDeMarcas !== 0) {
    estado.relacoes.marcas = limitar(estado.relacoes.marcas + r.ajusteDeMarcas)
  }

  for (const e of r.encerrados) {
    estado.patrociniosEncerrados = [
      ...(estado.patrociniosEncerrados ?? []),
      { marca: e.contrato.marca, temporada: estado.temporada, cumpriu: e.cumpriu, resumo: e.resumo },
    ]
    if (!e.cumpriu) estado.relacoes.rupturas.push(`${e.contrato.marca}: contrato encerrado sem cumprir`)
  }
}

function aplicarVidaPessoalNaSemana(estado: EstadoCarreiraDeJogador): void {
  const economia = economiaDoAtleta(estado)
  estado.economia = economia
  estado.relacoes = structuredClone(relacoesDoAtleta(estado))

  // ⚠️ A CARTEIRA DE PATROCÍNIOS PASSA AQUI, no MESMO ponto em que o salário e
  // a manutenção do patrimônio passam — e por isso ela é paga exatamente uma
  // vez por rodada. Chamá-la de dentro da partida pagaria duas vezes a quem
  // vive o jogo e nenhuma a quem simula (1.0.377).
  aplicarPatrociniosNaSemana(estado)

  if (estado.treinadorPessoal) {
    if (economia.dinheiro >= estado.treinadorPessoal.custoSemanal) {
      economia.dinheiro -= estado.treinadorPessoal.custoSemanal
      estado.treinadorPessoal.semanasRestantes--
      if (estado.treinadorPessoal.semanasRestantes <= 0) estado.treinadorPessoal = null
    } else {
      estado.recados = [{
        id: `fim_treinador_${estado.temporada}_${estado.rodada}`, de: "Equipe pessoal",
        texto: "O treinador pessoal encerrou o trabalho por falta de pagamento.",
        temporada: estado.temporada, rodada: estado.rodada,
      }, ...estado.recados].slice(0, 25)
      estado.treinadorPessoal = null
    }
  }

  if (estado.patrocinioPessoal) {
    const contrato = estado.patrocinioPessoal
    economia.dinheiro += contrato.valorSemanal
    contrato.semanasRestantes--
    if (contrato.semanasRestantes <= 0) {
      const cumpriu = contrato.golsNoContrato >= contrato.metaGols
      estado.relacoes.marcas = limitar(estado.relacoes.marcas + (cumpriu ? 12 : -14))
      if (!cumpriu) estado.relacoes.rupturas.push(`${contrato.marca}: meta nao cumprida`)
      estado.patrocinioPessoal = null
    }
  }

  const patrimonio = estado.patrimonio ?? { itens: [], estilo: 0, totalManutencao: 0 }
  estado.patrimonio = patrimonio
  const manutencao = patrimonio.itens.reduce((total, id) => total + (BENS_DO_ATLETA.find(b => b.id === id)?.manutencaoSemanal ?? 0), 0)
  if (manutencao > 0) {
    const pago = Math.min(economia.dinheiro, manutencao)
    economia.dinheiro -= pago
    patrimonio.totalManutencao += pago
    if (pago < manutencao) estado.moral = limitar(estado.moral - 4)
  }

  // ── O HARAS (1.0.374) ────────────────────────────────────────────────────
  // Come toda semana e corre toda semana. O custo sai mesmo quando o prêmio
  // não vem — que é a diferença entre um cavalo e um bônus.
  if (estado.cavalo) {
    const cavalo = CAVALOS_DO_ATLETA.find(c => c.id === estado.cavalo)
    if (cavalo) {
      const pago = Math.min(economia.dinheiro, cavalo.manutencaoSemanal)
      economia.dinheiro -= pago
      // ⚠️ NÃO PAGAR NÃO É DE GRAÇA: o haras entrega o animal de volta. Sem
      // esta saída, um atleta quebrado carregaria uma dívida infinita e o
      // sistema viraria uma armadilha sem porta, que é injusto, não difícil.
      if (pago < cavalo.manutencaoSemanal) {
        estado.cavalo = null
        estado.moral = limitar(estado.moral - 6)
        estado.recados = [{
          id: `haras_${estado.temporada}_${estado.rodada}`, de: "Haras",
          texto: `${cavalo.nome} foi devolvido: a manutenção não foi paga.`,
          temporada: estado.temporada, rodada: estado.rodada,
        }, ...estado.recados].slice(0, 25)
      } else {
        const corrida = correrNaSemana(cavalo.id, `${estado.atleta.id}:${estado.temporada}:${estado.rodada}`)
        if (corrida?.venceu) {
          economia.dinheiro += corrida.premio
          estado.reputacao = Math.min(100, (estado.reputacao ?? 30) + 1)
          estado.recados = [{
            id: `corrida_${estado.temporada}_${estado.rodada}`, de: "Haras",
            texto: `${corrida.nome} venceu: +${corrida.premio.toLocaleString("pt-BR")}.`,
            temporada: estado.temporada, rodada: estado.rodada,
          }, ...estado.recados].slice(0, 25)
        }
      }
    }
  }

  // ⚠️ A INDIFERENÇA TEM FUNDO (1.0.374). A queda de 2 por rodada sem interação
  // vinha da 1.0.373 e não tinha piso: medido em três temporadas de um atleta
  // que só joga futebol e nunca janta com o grupo, `elenco` terminava em 2,4 de
  // 100 — o vestiário inteiro tratando-o como inimigo por ele não ter clicado
  // num botão.
  //
  // Isso ficou visível agora porque a 1.0.374 ligou o `elenco` à NOTA DA
  // PARTIDA: antes ele afundava sem consequência, e um medidor no fundo era só
  // um medidor feio. Ligado, virou uma punição permanente de −0,5 na nota de
  // quem simula a carreira.
  //
  // 30 é o piso porque "o grupo não te conhece" não é "o grupo te odeia".
  // Abaixo disso só se chega FAZENDO alguma coisa — brigar, bater de frente,
  // uma temporada inteira de atuações ruins —, que é quando a queda significa
  // algo. A recuperação continua exigindo interação: o piso não sobe ninguém.
  const PISO_DA_INDIFERENCA = 30
  if ((estado.relacoes.ultimaInteracaoElenco ?? -10) < estado.rodada - 1) {
    estado.relacoes.elenco = limitar(Math.max(
      Math.min(estado.relacoes.elenco, PISO_DA_INDIFERENCA),
      estado.relacoes.elenco - 2,
    ))
  }
  if (estado.parceira && estado.parceira.ultimaInteracaoRodada < estado.rodada - 2) {
    estado.parceira.afinidade = limitar(estado.parceira.afinidade - 5)
    if (estado.parceira.afinidade <= 5) {
      estado.relacoes.rupturas.push(`Fim da relacao com ${estado.parceira.nome}`)
      estado.parceira = null
      estado.moral = limitar(estado.moral - 12)
    }
  }
}

export interface EscolhasDoAtleta {
  nome: string
  posicao: PosicaoDoAtleta
  idade: number
  nacionalidade: string
  pePreferido: "direito" | "esquerdo"
  alturaCm: number
  pesoKg: number
  numero: number
  /** Identidade do atleta. Ausente = o jogo escolhe pela posição. */
  arquetipo?: ArquetipoId
  /** A história de origem, que desloca overall, potencial e reputação. */
  origem?: OrigemDoAtleta
}

/**
 * HISTÓRIAS DE ORIGEM.
 *
 * Duas carreiras com o mesmo atleta têm de começar diferente. A origem não é
 * enfeite: ela mexe no overall inicial, no teto e na personalidade — e é o que
 * cria história sem roteiro escrito.
 */
export type OrigemDoAtleta =
  | "joia"          // joia da base: teto alto, cru
  | "desconhecido"  // ninguém aposta: começa baixo, evolui rápido
  | "filho"         // filho de craque: reputação e pressão
  | "desacreditado" // bom, mas ninguém acredita
  | "lesao"         // volta de lesão: melhor tecnicamente, físico cobrado
  | "padrao"

export const ORIGENS: { id: OrigemDoAtleta; nome: string; efeito: string }[] = [
  { id: "joia", nome: "Joia da base", efeito: "Teto alto, pouca experiência." },
  { id: "desconhecido", nome: "Desconhecido", efeito: "Começa abaixo, evolui mais rápido." },
  { id: "filho", nome: "Filho de craque", efeito: "Já chega com holofote — e com cobrança." },
  { id: "desacreditado", nome: "Promessa desacreditada", efeito: "Bom, mas ninguém aposta em você." },
  { id: "lesao", nome: "Voltando de lesão", efeito: "Técnica de sobra, físico a recuperar." },
  { id: "padrao", nome: "Trajetória comum", efeito: "Sem bônus nem ônus." },
]

/**
 * Cria o atleta.
 *
 * O ponto de partida é DELIBERADAMENTE modesto: overall na faixa 58–66 e
 * potencial alto. Começar com 75 tira do modo a única coisa que ele tem de
 * diferente — a subida.
 */
export function criarAtletaDaCarreira(escolhas: EscolhasDoAtleta, semente = "atleta"): AtletaDaCarreira {
  const r = (n: number) => roll(`${semente}:${escolhas.nome}:${escolhas.posicao}:${n}`)
  const jovem = Math.max(0, 22 - escolhas.idade) // quanto mais novo, mais bruto e mais teto
  const base = 56 + Math.round(r(1) * 8) + Math.round((escolhas.idade - 16) * 0.6)

  const variar = (peso: number, n: number) =>
    Math.max(25, Math.min(88, Math.round(base + peso * 10 + (r(n) - 0.5) * 12)))

  const pesos = PESOS_POR_POSICAO[escolhas.posicao]
  const atributos: AtributosDoAtleta = {
    ritmo: variar(pesos.ritmo, 2),
    finalizacao: variar(pesos.finalizacao, 3),
    passe: variar(pesos.passe, 4),
    drible: variar(pesos.drible, 5),
    defesa: variar(pesos.defesa, 6),
    fisico: variar(pesos.fisico, 7),
  }
  // ── A ORIGEM desloca o ponto de partida e o teto ──
  const origem = escolhas.origem ?? "padrao"
  const ajuste: Record<OrigemDoAtleta, { overall: number; teto: number }> = {
    joia: { overall: -2, teto: +8 },
    desconhecido: { overall: -5, teto: +5 },
    filho: { overall: +2, teto: 0 },
    desacreditado: { overall: -3, teto: +6 },
    lesao: { overall: +3, teto: -4 },
    padrao: { overall: 0, teto: 0 },
  }
  if (origem === "lesao") atributos.fisico = Math.max(25, atributos.fisico - 8)
  if (origem === "joia") atributos.ritmo = Math.min(88, atributos.ritmo + 3)

  const overall = Math.max(35, overallDoAtleta(escolhas.posicao, atributos) + ajuste[origem].overall)

  // ── PERSONALIDADE: sorteada e escondida, com a origem inclinando ──
  const p = (n: number, base: number) => Math.max(1, Math.min(20, Math.round(base + (r(n) - 0.5) * 12)))
  const personalidade: PersonalidadeDoAtleta = {
    ambicao: p(10, origem === "desacreditado" || origem === "desconhecido" ? 15 : 11),
    profissionalismo: p(11, origem === "lesao" ? 14 : 11),
    determinacao: p(12, origem === "desacreditado" ? 15 : 11),
    lealdade: p(13, origem === "joia" ? 14 : 10),
    temperamento: p(14, origem === "filho" ? 8 : 11),
  }

  const escolhido = escolhas.arquetipo ?? arquetiposDaPosicao(escolhas.posicao)[0].id

  return {
    id: `atleta_${hash(`${escolhas.nome}:${escolhas.posicao}:${escolhas.idade}`)}`,
    nome: escolhas.nome.trim() || "Atleta",
    posicao: escolhas.posicao,
    idade: escolhas.idade,
    nacionalidade: escolhas.nacionalidade,
    pePreferido: escolhas.pePreferido,
    // ⚠️ SEMEADO PELO NOME, NÃO SORTEADO NA HORA: recriar o mesmo atleta dá o
    // mesmo pé ruim. A escala pende para baixo (2 e 3 são o comum) porque
    // ambidestro de verdade é raro — se a média fosse 4, o pé fraco não seria
    // uma característica, seria um detalhe.
    peFraco: 1 + Math.floor(r(11) * 4.4),
    alturaCm: escolhas.alturaCm,
    pesoKg: escolhas.pesoKg,
    numero: escolhas.numero,
    overall,
    // Teto: quem começa mais novo pode chegar mais longe. Some a origem e a
    // DETERMINAÇÃO — é ela que separa dois atletas idênticos aos 20 anos.
    potencial: Math.min(97, Math.max(overall + 4,
      overall + 8 + jovem * 2 + Math.round(r(8) * 10) + ajuste[origem].teto
      + Math.round((personalidade.determinacao - 10) * 0.5))),
    arquetipo: escolhido,
    especializacao: null,
    personalidade,
    atributos,
  }
}

// ─── Criação da carreira ────────────────────────────────────────────────────

function metasIniciais(atleta: AtletaDaCarreira, prestigioDoClube: number, jogosDaTemporada: number): MetaDaTemporada[] {
  const ataque = atleta.posicao === "ATA" || atleta.posicao === "MEI"
  const exigencia = prestigioDoClube >= 85 ? 1.25 : prestigioDoClube >= 70 ? 1 : 0.8
  const jogosAlvo = Math.max(8, Math.round(jogosDaTemporada * 0.4))
  const metas: MetaDaTemporada[] = [
    { id: "jogos", tipo: "jogos", descricao: `Disputar ${jogosAlvo} partidas na temporada`, alvo: jogosAlvo, progresso: 0, cumprida: false },
    { id: "nota", tipo: "nota", descricao: "Fechar a temporada com média 6.8", alvo: 6.8, progresso: 0, cumprida: false },
  ]
  if (ataque) {
    const gols = Math.max(3, Math.round(jogosDaTemporada * 0.18 * exigencia))
    metas.push({ id: "gols", tipo: "gols", descricao: `Marcar ${gols} gols`, alvo: gols, progresso: 0, cumprida: false })
    metas.push({ id: "assist", tipo: "assistencias", descricao: "Dar 4 assistências", alvo: 4, progresso: 0, cumprida: false })
  } else if (atleta.posicao === "GOL" || atleta.posicao === "ZAG") {
    metas.push({ id: "nota_def", tipo: "nota", descricao: "Manter média 7.0 na defesa", alvo: 7.0, progresso: 0, cumprida: false })
  } else {
    metas.push({ id: "assist", tipo: "assistencias", descricao: "Dar 6 assistências", alvo: 6, progresso: 0, cumprida: false })
  }
  if (prestigioDoClube >= 80) {
    metas.push({ id: "titulo", tipo: "titulo", descricao: "Ser campeão da liga", alvo: 1, progresso: 0, cumprida: false })
  }
  return metas
}

/** Clubes da liga do clube escolhido — a mesma fonte que a carreira de técnico usa. */
export function ligaDoClube(clube: Team): Team[] {
  const times = completarLigaComPool(String(clube.divisao))
  return times.some(t => t.file_key === clube.file_key) ? times : [clube, ...times.slice(0, Math.max(3, times.length - 1))]
}

export function criarCarreiraDeJogador(
  clube: Team,
  atleta: AtletaDaCarreira,
  ligaNome: string,
  temporada = 2026,
): EstadoCarreiraDeJogador {
  const times = ligaDoClube(clube)
  const calendario = generateSeasonFixtures(times, clube.curto, temporada, ligaNome)
  const jogosDoClube = calendario.filter(f => f.isUserMatch).length
  // Salário por prestígio do clube e overall do atleta. Um garoto de 60 no
  // Barcelona não ganha o mesmo que o camisa 10 — e é o que faz a proposta de
  // um clube menor com salário maior ser uma decisão de verdade.
  const salario = Math.round((clube.prestigio * 220 + Math.max(0, atleta.overall - 55) * 900) * (atleta.idade < 20 ? 0.6 : 1))

  const estado: EstadoCarreiraDeJogador = {
    versao: 1,
    atleta,
    clubeCurto: clube.curto,
    clubeNome: clube.nome,
    clubeFileKey: clube.file_key,
    divisao: String(clube.divisao),
    ligaNome,
    pais: clube.pais ?? "",
    temporada,
    rodada: 0,
    calendario,
    tabela: initStandings(times),
    contrato: {
      salarioSemanal: salario,
      ateTemporada: temporada + 2,
      valorDePasse: Math.max(200_000, atleta.overall ** 3 * 12),
      luvas: 0,
      bonusPorGol: Math.round(salario * 0.12),
      bonusPorTitulo: Math.round(salario * 4),
      statusPrometido: "rodízio",
    },
    // O PRIMEIRO empresário é o que aparece para um garoto sem nome: barato e
    // sem alcance. Trocar por um bom é uma decisão da carreira, com custo.
    empresario: EMPRESARIOS[2],
    ganhosDaTemporada: 0,
    economia: {
      dinheiro: Math.max(25_000, salario * 3), energia: 100, energiaMaxima: 100,
      equipamentosComprados: [], equipamentosEmUso: {}, totalGastoEmTreino: 0, totalGastoEmEnergia: 0,
    },
    apostaAtiva: null,
    parceira: null,
    reputacao: 30,
    torcida: 50,
    entrevistasRespondidas: [],
    repercussao: [],
    // Provisória: logo abaixo é substituída pela confiança MERECIDA, que depende
    // do elenco do clube e por isso precisa do estado já montado.
    notaDoTreinador: 40,
    relacoes: { ...relacoesIniciais(), elenco: 50, marcas: 35, rupturas: [] },
    companheiros: companheirosDoClube(clube.curto, String(atleta.posicao)),
    forma: 50,
    moral: 70,
    temporadaAtual: { jogos: 0, titularidades: 0, minutos: 0, gols: 0, assistencias: 0, somaDasNotas: 0, cartoesAmarelos: 0, cartoesVermelhos: 0 },
    ultimasPartidas: [],
    metas: metasIniciais(atleta, clube.prestigio, jogosDoClube),
    crescimento: { xp: 0, nivel: 1, pontosDisponiveis: 0 },
    focoDeTreino: "equilibrado",
    acoes: { ...ACOES_ZERADAS },
    ultimaEvolucao: [],
    selecao: { convocada: false, nivel: null, jogos: 0, gols: 0 },
    historico: [],
    propostas: [],
    pedido: "nenhum",
    titulos: [],
    premios: [],
    temporadaEncerrada: false,
    aposentado: false,
    recados: [{
      id: `boasvindas_${temporada}`,
      de: "Treinador",
      texto: `Bem-vindo ao ${clube.nome}. Treine bem e o time é seu — aqui quem joga é quem convence.`,
      temporada, rodada: 0,
    }],
  }

  // NINGUÉM CHEGA TITULAR: 80% do que o mérito justifica. O atleta começa um
  // degrau abaixo do lugar dele e sobe jogando — mas o lugar EXISTE desde o
  // primeiro dia, e é o da fila da posição no elenco de verdade.
  estado.notaDoTreinador = limitar(confiancaMerecida(estado) * 0.8)
  // COPA NACIONAL (e a continental, se o clube for de G4). Ver
  // `montarMataMataDaTemporada`: sem isto a temporada do atleta era so a liga.
  montarMataMataDaTemporada(estado, times)
  const h = hierarquiaDaPosicao(estado)
  if (h.posto > 1) {
    estado.recados.unshift({
      id: `hierarquia_${temporada}`,
      de: "Treinador",
      texto: `Na sua posição a fila tem ${h.concorrentes}. Hoje ${h.nomeDoMelhorRival} (${h.melhorRival}) começa na frente — você é o ${h.posto}º. Quem convencer, joga.`,
      temporada, rodada: 0,
    })
  }
  return estado
}

// ─── O papel no elenco ──────────────────────────────────────────────────────

export type PapelNoElenco = "titular absoluto" | "titular" | "rodízio" | "reserva" | "fora dos planos"

export function papelNoElenco(nota: number): PapelNoElenco {
  if (nota >= 78) return "titular absoluto"
  if (nota >= 60) return "titular"
  if (nota >= 42) return "rodízio"
  if (nota >= 24) return "reserva"
  return "fora dos planos"
}

// ─── A DISPUTA PELA POSIÇÃO ─────────────────────────────────────────────────
//
// ⚠️ ISTO NASCEU DE UM DEFEITO RELATADO COM PRINT (1.0.324): um atleta de 18
// anos no River Plate terminou a temporada com **uma** partida, nota 6.20,
// "FORA DOS PLANOS" e a lista de atuações inteira dizendo "não saiu do banco".
//
// A causa não era balanceamento fino — era uma ESPIRAL SEM VOLTA. A confiança
// caía 0,8 por rodada no banco; abaixo de 24 o atleta parava de entrar; sem
// entrar, não havia nada que a fizesse subir. O modo se fechava sozinho e a
// carreira acabava na segunda temporada, sem o jogador ter feito nada de errado.
//
// O conserto não é aumentar o número: é mudar o que ele significa. A confiança
// do treinador passa a PUXAR PARA O MÉRITO — a posição do atleta na hierarquia
// real do elenco naquela posição. Quem é o terceiro melhor ponta do clube tende
// ao banco mesmo jogando bem; quem virou o melhor tende à titularidade mesmo
// vindo de uma partida ruim. É como funciona no vestiário, e tem volta: evoluir
// acima dos concorrentes reabre a porta sozinho.

/** Famílias de posição — o elenco usa códigos mais finos que os do atleta. */
const FAMILIA_DA_POSICAO: Record<PosicaoDoAtleta, string[]> = {
  GOL: ["GOL"],
  ZAG: ["ZAG", "DEF"],
  LD: ["LD", "LAT"],
  LE: ["LE", "LAT"],
  VOL: ["VOL", "MC"],
  MEI: ["MEI", "MC", "ME", "MD", "MEA"],
  ATA: ["ATA", "CA", "PD", "PE", "SA"],
}

export interface HierarquiaDaPosicao {
  /** 1 = melhor da posição no elenco. */
  posto: number
  /** Quantos disputam a mesma vaga (o atleta incluído). */
  concorrentes: number
  /** Overall do melhor rival — o número que o atleta precisa alcançar. */
  melhorRival: number
  nomeDoMelhorRival: string
}

/**
 * Onde o atleta está na fila da própria posição, dentro do elenco REAL do clube.
 *
 * Lê o elenco pelo mesmo caminho do resto do jogo (`getPlayersForTeam`), então
 * a disputa acompanha contratação, venda e envelhecimento do clube sem nenhum
 * espelho de dado para envelhecer.
 */
export function hierarquiaDaPosicao(estado: EstadoCarreiraDeJogador): HierarquiaDaPosicao {
  const clube = getTeamByFileKey(estado.clubeFileKey)
  const familia = FAMILIA_DA_POSICAO[estado.atleta.posicao]
  const rivais = (clube ? getPlayersForTeam(clube) : [])
    .filter(p => familia.includes(String(p.pos)))
    .map(p => ({ nome: p.nome, overall: p.base }))
    .sort((a, b) => b.overall - a.overall)
  const melhor = rivais[0]
  const acima = rivais.filter(r => r.overall > estado.atleta.overall).length
  return {
    posto: acima + 1,
    concorrentes: rivais.length + 1,
    melhorRival: melhor?.overall ?? 0,
    nomeDoMelhorRival: melhor?.nome ?? "—",
  }
}

/**
 * A confiança que o desempenho e a hierarquia JUSTIFICAM (0–100).
 *
 * É o alvo para onde a confiança real caminha a cada rodada. Não é a confiança
 * em si: um atleta que acabou de chegar leva algumas rodadas para chegar nela,
 * e uma sequência ruim afunda abaixo dela — o que é diferente de ficar preso.
 */
export function confiancaMerecida(estado: EstadoCarreiraDeJogador): number {
  const h = hierarquiaDaPosicao(estado)
  // O posto manda: 1º ≈ 82, 2º ≈ 62, 3º ≈ 45, 4º ≈ 32, daí para baixo.
  const porPosto = Math.max(18, 82 - (h.posto - 1) * 18)
  // A forma move ±12 em torno disso.
  const porForma = (estado.forma - 50) * 0.24
  // JOVEM DE CLUBE GRANDE não é ignorado: aos 20 anos ou menos o clube investe
  // minutos em quem tem teto, e é isso que evita o beco do relato.
  const porIdade = estado.atleta.idade <= 20 ? 6 : estado.atleta.idade >= 33 ? -5 : 0
  return Math.max(8, Math.min(96, porPosto + porForma + porIdade))
}

/** Minutos esperados na próxima partida — o que o jogador vê ANTES de jogar. */
export function minutosEsperados(estado: EstadoCarreiraDeJogador): string {
  const papel = papelNoElenco(estado.notaDoTreinador)
  return papel === "titular absoluto" ? "90 minutos"
    : papel === "titular" ? "70–90 minutos"
      : papel === "rodízio" ? "0–70 minutos"
        : papel === "reserva" ? "0–25 minutos"
          : "banco (sem previsão de entrar)"
}

// ─── A rodada ───────────────────────────────────────────────────────────────

function forcaDoTime(t: Team | undefined): number { return t?.prestigio ?? 55 }

/**
 * QUANTO O SEU ATLETA MUDA A FORCA DO CLUBE NA PARTIDA SIMULADA (1.0.375).
 *
 * ⚠️ ATE AQUI ELE NAO MUDAVA NADA. O placar saia de `simulateFullMatch` com
 * prestigio contra prestigio, e `desempenhoDaPartida` so ATRIBUIA ao atleta uma
 * fatia dos gols que o clube ja havia feito. Medido em 10 temporadas: um
 * atacante de 92 fazia 30,3 gols por temporada contra 6,0 de um de 48, e o
 * clube terminava 1,8 ponto na frente — ruido. A carreira inteira nao movia a
 * tabela.
 *
 * E o mesmo defeito que a partida VIVIDA ja corrigiu ("o placar nasce do que
 * voce faz"); aqui ele seguia de pe, no caminho que o jogador mais usa, porque
 * ninguem vive 38 rodadas.
 *
 * A fatia e pequena de proposito: um jogador entre onze. Ela nasce da distancia
 * entre o atleta e o nivel do proprio clube, pesada pelo papel no elenco — quem
 * esta fora dos planos quase nao entra na conta — e limitada a ±5, que e o
 * tamanho de "um craque a mais" e nao o de um time inteiro. Sem o limite, um 99
 * num clube fraco seria campeao sozinho e ACHATARIA a liga, que e o preco
 * conhecido de confundir a escala do elenco com a do prestigio.
 */
function pesoDoAtletaNoTime(estado: EstadoCarreiraDeJogador, forcaBase: number): number {
  // Fora de campo nao se influencia partida. As duas checagens acontecem depois
  // da simulacao, entao aqui a consulta precisa ser propria.
  if ((estado.lesao?.semanasRestantes ?? 0) > 0) return 0
  if ((estado.suspensao?.partidasRestantes ?? 0) > 0) return 0
  const papel = papelNoElenco(estado.notaDoTreinador)
  const participacao = papel === "titular absoluto" ? 1
    : papel === "titular" ? 0.85
      : papel === "rodízio" ? 0.5
        : papel === "reserva" ? 0.2
          : 0.05
  // A FORMA entra porque ela ja decide a atuacao individual: um craque em ma
  // fase que continuasse valendo o maximo para o time contradiria a nota que
  // ele mesmo leva na sumula.
  const forma = 0.75 + (estado.forma ?? 50) / 200
  const bruto = (estado.atleta.overall - forcaBase) * 0.42 * participacao * forma
  return Math.max(-5, Math.min(5, bruto))
}

interface DesempenhoIndividual {
  titular: boolean
  minutos: number
  gols: number
  assistencias: number
  nota: number
  cartao: "amarelo" | "vermelho" | null
  xp: number
}

/**
 * A LINHA INDIVIDUAL da partida.
 *
 * Sai do placar que o motor já produziu — e não de um sorteio paralelo. Se o
 * time fez 3, os gols do atleta saem DESSES três; se o time não fez nenhum, ele
 * não marca. Era o erro óbvio a evitar: um atacante com 2 gols numa derrota
 * por 1 a 0.
 */
function desempenhoDaPartida(
  estado: EstadoCarreiraDeJogador,
  golsPro: number,
  golsContra: number,
  forcaAdversaria: number,
  semente: string,
): DesempenhoIndividual {
  const { atleta } = estado
  const papel = papelNoElenco(estado.notaDoTreinador)
  const r = (n: number) => roll(`${semente}:${n}`)

  const titular = papel === "titular absoluto" || papel === "titular"
    || (papel === "rodízio" && r(1) < 0.5)
  // ⚠️ "fora dos planos" TAMBÉM entra de vez em quando (12%). Não é generosidade:
  // é o que existe no futebol — lesão do titular, expulsão, jogo decidido,
  // rodada de copa. Sem essa fresta, quem cai ali nunca mais mostra serviço, e
  // era isso que travava a carreira inteira (relato com print, 1.0.324).
  const entrou = titular
    || (papel === "rodízio" && r(2) < 0.75)
    || (papel === "reserva" && r(2) < 0.35)
    || (papel === "fora dos planos" && r(2) < 0.12)
  const minutos = !entrou ? 0
    : titular ? (r(3) < 0.75 ? 90 : 60 + Math.floor(r(4) * 30))
      : 8 + Math.floor(r(5) * 30)

  if (minutos === 0) {
    // Jogo assistido do banco: a forma esfria e a nota do treinador cede um
    // pouco. Ficar parado tem custo, senão o modo premia não jogar.
    return { titular: false, minutos: 0, gols: 0, assistencias: 0, nota: 0, cartao: null, xp: 2 }
  }

  const proporcao = minutos / 90
  const qualidade = (atleta.overall - forcaAdversaria * 0.9) / 100
  const ofensivo = atleta.posicao === "ATA" ? 1 : atleta.posicao === "MEI" ? 0.72 : atleta.posicao === "LD" || atleta.posicao === "LE" ? 0.34 : atleta.posicao === "VOL" ? 0.28 : 0.12

  let gols = 0
  for (let g = 0; g < golsPro; g++) {
    if (r(10 + g) < 0.16 + ofensivo * 0.34 + qualidade * 0.25) { gols++; if (gols >= golsPro) break }
  }
  gols = Math.min(gols, Math.round(golsPro * proporcao + 0.4))

  let assistencias = 0
  const restantes = golsPro - gols
  for (let a = 0; a < restantes; a++) {
    if (r(30 + a) < 0.1 + ofensivo * 0.26 + (atleta.atributos.passe - 60) / 220) assistencias++
  }

  // NOTA: base 6, mais o que ele fez, mais o resultado, mais uma oscilação
  // pequena. A vitória vale pouco sozinha — é a atuação que manda.
  const resultado = golsPro > golsContra ? 0.45 : golsPro === golsContra ? 0.1 : -0.35
  const defensiva = ["GOL", "ZAG", "VOL", "LD", "LE"].includes(atleta.posicao)
    ? (golsContra === 0 ? 0.75 : golsContra >= 3 ? -0.6 : -0.15 * golsContra)
    : 0
  // ⚠️ A FORMA PESAVA /160, ou seja, QUASE NADA: a diferença entre chegar ao
  // jogo inteiro e chegar arrasado valia 0,3 de nota na escala toda. Com o
  // treino por intensidade (1.0.339) isso deixaria a semana puxada sem preço —
  // um seletor cujo custo o jogador não sente é enfeite, e enfeite é o defeito
  // que este modo já teve com o próprio foco de treino. Em /70 a faixa inteira
  // de forma vale ~1,4 de nota: sentida, e ainda menor que o que ele FAZ em
  // campo (gol vale 1,05 sozinho).
  const bruta = 6 + gols * 1.05 + assistencias * 0.65 + resultado + defensiva
    + qualidade * 1.8 + (estado.forma - 50) / 70 + (r(40) - 0.5) * 1.1
  const nota = Math.max(3, Math.min(10, Math.round(bruta * 10) / 10))

  const cartao: DesempenhoIndividual["cartao"] =
    r(50) < 0.055 + (atleta.atributos.defesa > 70 ? 0.02 : 0) ? (r(51) < 0.08 ? "vermelho" : "amarelo") : null

  const xp = Math.round(minutos * 0.55 + gols * 45 + assistencias * 25 + Math.max(0, nota - 6.5) * 30)
  return { titular, minutos, gols, assistencias, nota, cartao, xp }
}

function aplicarXP(estado: EstadoCarreiraDeJogador, xp: number): void {
  estado.crescimento.xp += xp
  // Cada nível custa mais que o anterior: a subida desacelera sozinha, sem
  // precisar de trava artificial.
  while (estado.crescimento.xp >= estado.crescimento.nivel * 320) {
    estado.crescimento.xp -= estado.crescimento.nivel * 320
    estado.crescimento.nivel++
    estado.crescimento.pontosDisponiveis += 2
  }
}

/**
 * Joga a próxima rodada: a partida do clube do atleta e as dos rivais.
 *
 * Devolve um estado NOVO (o save é imutável por fora; ver
 * [[ultrafoot-gravacao-do-save-e-react]]).
 */
/**
 * O CORPO COBRA (1.0.347).
 *
 * ⚠️ A chance e baixa de proposito e sobe com o que a torna real: minutos em
 * campo, fisico baixo e forma no chao. Um modo em que o atleta se machuca toda
 * hora nao e realista, e sim irritante; um em que ele nunca se machuca nao tem
 * carreira nenhuma dentro. Nada aqui e sorteado quando o atleta nao jogou.
 */
function sortearLesao(estado: EstadoCarreiraDeJogador, minutos: number, rodada: number): void {
  if (minutos <= 0 || (estado.lesao?.semanasRestantes ?? 0) > 0) return
  const fisico = estado.atleta.atributos.fisico
  // ⚠️ A BASE E POR 90 MINUTOS, NAO POR PARTIDA — e foi assim que a primeira
  // versao nasceu inofensiva. Com 2,2% "por jogo" e um atleta que entra 20
  // minutos, a exposicao real virava 0,5% e SEIS TEMPORADAS passavam sem uma
  // lesao: o gate pegou isso na primeira execucao.
  //
  // 6% por 90 minutos da cerca de 1,8 lesao por temporada de titular
  // (30 jogos inteiros), que e a ordem de grandeza do futebol de verdade — e
  // quem joga pouco se machuca proporcionalmente menos, como deve ser.
  const risco = 0.06
    * (minutos / 90)
    * (1 + Math.max(0, 70 - fisico) / 70)
    * (estado.forma < 35 ? 1.6 : 1)
  if (roll(`${estado.atleta.id}:lesao:${estado.temporada}:${rodada}`) >= risco) return

  const sorte = roll(`${estado.atleta.id}:gravidade:${estado.temporada}:${rodada}`)
  const gravidade = sorte < 0.62 ? "leve" : sorte < 0.9 ? "media" : "grave"
  const semanas = gravidade === "leve" ? 1 + Math.floor(sorte * 2)
    : gravidade === "media" ? 3 + Math.floor(sorte * 3)
      : 8 + Math.floor(sorte * 8)
  const descricao = gravidade === "leve" ? "estiramento muscular"
    : gravidade === "media" ? "lesao na coxa" : "ruptura de ligamento"

  estado.lesao = { semanasRestantes: semanas, gravidade, descricao, desdeRodada: rodada }
  estado.moral = limitar(estado.moral - (gravidade === "grave" ? 18 : gravidade === "media" ? 9 : 4))
  estado.recados = [{
    id: `lesao_${estado.temporada}_${rodada}`, de: "Departamento medico",
    texto: `${descricao.charAt(0).toUpperCase()}${descricao.slice(1)} confirmada. ${semanas} ${semanas === 1 ? "rodada" : "rodadas"} fora.`,
    temporada: estado.temporada, rodada,
  }, ...estado.recados].slice(0, 25)
}

export function jogarProximaRodada(
  estado: EstadoCarreiraDeJogador,
  opcoes?: { viver?: boolean },
): EstadoCarreiraDeJogador {
  if (estado.aposentado || estado.temporadaEncerrada) return estado
  // ⚠️ SEM CLUBE NÃO SE JOGA RODADA (1.0.358). O calendário do clube antigo
  // continua no estado (é o que a tela de mercado mostra correndo sem ele);
  // avançar por aqui faria o atleta pontuar por um time que já não é o dele.
  // Quem faz o tempo passar nesse estado é `avancarSemanaSemClube`.
  if (estado.semClube) return estado
  const proxima = estado.calendario.find(f => !f.played)
  if (!proxima) {
    // ⚠️ A LIGA PODE ACABAR ANTES DA COPA. As rodadas-gatilho do mata-mata são
    // 6/14/22/30 (copa) e 10/18/26 (continental); numa liga curta — 14 clubes,
    // 26 rodadas — as últimas não chegam a cair. Sem fechar aqui, o título
    // ficaria sem dono e a temporada encerraria com uma final por jogar.
    const fechando: EstadoCarreiraDeJogador = structuredClone(estado)
    const emAberto = () => [fechando.copa, fechando.continental].some(b => b && !b.champion)
    if (emAberto()) {
      const clubesDoFecho = new Map(clubesDaLiga(fechando).map(t => [t.curto, t]))
      for (let volta = 0; volta < 8 && emAberto(); volta++) {
        jogarMataMata(fechando, "copa", fechando.rodada, clubesDoFecho, true)
        jogarMataMata(fechando, "continental", fechando.rodada, clubesDoFecho, true)
      }
    }
    fechando.temporadaEncerrada = true
    return fechando
  }

  const novo: EstadoCarreiraDeJogador = structuredClone(estado)
  novo.versao = 3
  novo.economia = structuredClone(economiaDoAtleta(novo))
  // Salario e recuperacao acontecem uma vez por semana, antes das decisoes.
  const liquido = Math.round(novo.contrato.salarioSemanal * (1 - novo.empresario.comissao / 100))
  novo.economia.dinheiro += liquido
  // ⚠️ A FAMÍLIA ENTRA AQUI, no único lugar em que recuperação acontece
  // (1.0.374). Espalhar o multiplicador por vários pontos faria o mesmo bônus
  // ser aplicado duas vezes — que é como um efeito justo vira um exploit.
  novo.relacoes = { ...relacoesDoAtleta(novo), ...lerRelacoes(relacoesDoAtleta(novo)) }
  novo.companheiros = lerCompanheiros(novo.companheiros, novo.clubeCurto, String(novo.atleta.posicao))
  const recuperacao = Math.round(18 * recuperacaoPelaFamilia(lerRelacoes(novo.relacoes)))
  novo.economia.energia = Math.min(novo.economia.energiaMaxima, novo.economia.energia + recuperacao)
  aplicarVidaPessoalNaSemana(novo)

  // AS RELAÇÕES ENVELHECEM UMA VEZ POR RODADA, aqui e em nenhum outro lugar.
  // O capitão puxa o grupo antes do esfriamento: é ele que dá ao vestiário um
  // movimento próprio, em vez de o coletivo só reagir ao que você faz em campo.
  novo.relacoes = {
    ...novo.relacoes,
    elenco: limitar(novo.relacoes.elenco + puxaoDoCapitao(novo.companheiros) * 0.25),
  }
  novo.relacoes = { ...novo.relacoes, ...esfriarUmaRodada(lerRelacoes(novo.relacoes)) }
  novo.companheiros = esfriarCompanheiros(novo.companheiros)
  // ⚠️ O DILEMA ABRE DEPOIS DO ESFRIAMENTO, e não antes: o catálogo filtra pelo
  // estado das relações, e abri-lo antes ofereceria dilemas calculados sobre
  // números que a própria rodada ainda ia mudar (1.0.377).
  abrirDilemaDaRodada(novo)
  // ⚠️ A SEMANA DE TREINO VEM ANTES DA PARTIDA, e não é detalhe de ordem: é o
  // custo em forma da semana puxada que precisa chegar ao jogo. Treinar depois
  // faria a intensidade não ter preço nenhum no dia em que ela importa.
  treinarNaSemana(novo)
  const rodada = proxima.round
  const daRodada = novo.calendario.filter(f => f.round === rodada && !f.played)
  // Os clubes da liga são resolvidos UMA vez por rodada. Resolver por partida
  // chamava `completarLigaComPool` dezenas de vezes na mesma rodada — é o tipo
  // de O(n²) que travou o apito na 1.0.300.
  const clubes = new Map(clubesDaLiga(novo).map(t => [t.curto, t]))

  for (const fixture of daRodada) {
    const mandante = clubes.get(fixture.homeCurto) ?? clubeDeReserva(novo, fixture.homeCurto)
    const visitante = clubes.get(fixture.awayCurto) ?? clubeDeReserva(novo, fixture.awayCurto)

    // ⚠️ A SUA PARTIDA NÃO É PRÉ-SIMULADA quando você vai vivê-la.
    //
    // Este era o defeito inteiro: `simulateFullMatch` fechava o placar aqui, a
    // tabela era atualizada logo abaixo, e só então os seus momentos eram
    // montados — racionados contra um resultado que já existia. Agora a partida
    // corre em `partida-ao-vivo-do-atleta` e o placar nasce do que você faz.
    // O fixture e a tabela esperam o apito, em `concluirPartidaDoAtleta`.
    if (fixture.isUserMatch && opcoes?.viver && (novo.lesao?.semanasRestantes ?? 0) <= 0) {
      const emCasaAqui = fixture.homeCurto === novo.clubeCurto
      const d0 = desempenhoDaPartida(
        novo, 0, 0, forcaDoTime(emCasaAqui ? visitante : mandante),
        `${novo.atleta.id}:${novo.temporada}:${rodada}`,
      )
      if (d0.minutos > 0) {
        novo.partidaEmCurso = montarPartidaAoVivo({
          fixtureId: fixture.id,
          adversario: emCasaAqui ? fixture.awayNome : fixture.homeNome,
          emCasa: emCasaAqui, competicao: fixture.competition, rodada,
          minutos: d0.minutos, titular: d0.titular,
          config: {
            homeTeam: mandante, awayTeam: visitante,
            homeRating: forcaDoTime(mandante), awayRating: forcaDoTime(visitante),
            durationMinutes: 90,
          },
          semente: `${novo.atleta.id}:${novo.temporada}:${rodada}`,
          posicao: String(novo.atleta.posicao),
          atributos: atributosEfetivosDoAtleta(novo) as unknown as Record<string, number>,
          // O CORPO E O CANSAÇO ENTRAM NA PARTIDA (1.0.374). Sem estas duas
          // linhas a física continuaria rodando com um atleta genérico de
          // 180 cm, destro e inteiro — e altura, pé e energia voltariam a ser
          // números que a ficha mostra e o jogo ignora.
          energia: novo.economia?.energia,
          corpo: {
            altura: novo.atleta.alturaCm,
            pePreferido: novo.atleta.pePreferido,
            peFraco: novo.atleta.peFraco,
          },
          fatorDeLances: frequenciaDeLancesPeloCraque(
            lerCompanheiros(novo.companheiros, novo.clubeCurto, String(novo.atleta.posicao)),
          ),
        })
        continue
      }
    }

    // O SEU ATLETA PESA NO LADO DELE — e so no dele (ver `pesoDoAtletaNoTime`).
    const usuarioEmCasa = fixture.isUserMatch && fixture.homeCurto === novo.clubeCurto
    const usuarioFora = fixture.isUserMatch && fixture.awayCurto === novo.clubeCurto
    const forcaMandante = forcaDoTime(mandante)
    const forcaVisitante = forcaDoTime(visitante)
    const partida = simulateFullMatch({
      homeTeam: mandante,
      awayTeam: visitante,
      homeRating: forcaMandante + (usuarioEmCasa ? pesoDoAtletaNoTime(novo, forcaMandante) : 0),
      awayRating: forcaVisitante + (usuarioFora ? pesoDoAtletaNoTime(novo, forcaVisitante) : 0),
      durationMinutes: 90,
    })
    fixture.played = true
    fixture.homeGoals = partida.home.goals
    fixture.awayGoals = partida.away.goals
    novo.tabela = updateStandings(novo.tabela, fixture.homeCurto, fixture.awayCurto, partida.home.goals, partida.away.goals)

    if (!fixture.isUserMatch) continue

    // ⚠️ LESIONADO NAO ENTRA EM CAMPO (1.0.347). Esta e a consequencia inteira:
    // a rodada acontece sem voce, o time joga, a tabela anda, e a nota do
    // treinador cai devagar porque outro esta fazendo o seu trabalho. Sem isto,
    // "lesao" era so uma palavra na tela de origem do atleta.
    if ((novo.lesao?.semanasRestantes ?? 0) > 0) {
      const lesao = novo.lesao!
      lesao.semanasRestantes--
      novo.rodadasPerdidasPorLesao = (novo.rodadasPerdidasPorLesao ?? 0) + 1
      // Parado, a forma cai; a nota do treinador cede pouco, porque ninguem
      // perde a vaga por se machucar — perde por ficar fora tempo demais.
      novo.forma = limitar(novo.forma - 4)
      novo.notaDoTreinador = limitar(novo.notaDoTreinador - 0.6)
      if (lesao.semanasRestantes <= 0) {
        novo.lesao = undefined
        novo.recados = [{
          id: `alta_${novo.temporada}_${rodada}`, de: "Departamento medico",
          texto: `Alta liberada. ${novo.atleta.nome} volta a ficar a disposicao — a forma vai levar algumas rodadas para voltar.`,
          temporada: novo.temporada, rodada,
        }, ...novo.recados].slice(0, 25)
      }
      continue
    }

    // ⚠️ SUSPENSO NAO ENTRA EM CAMPO (1.0.351). Mesma consequencia da lesao, e
    // pela mesma razao: sem ela o cartao vermelho e um numero na tabela de
    // estatisticas, nao um preco. Aqui a rodada acontece sem voce.
    if ((novo.suspensao?.partidasRestantes ?? 0) > 0) {
      const suspensao = novo.suspensao!
      suspensao.partidasRestantes--
      novo.rodadasPerdidasPorSuspensao = (novo.rodadasPerdidasPorSuspensao ?? 0) + 1
      novo.forma = limitar(novo.forma - 3)
      novo.notaDoTreinador = limitar(novo.notaDoTreinador - 0.8)
      if (suspensao.partidasRestantes <= 0) {
        novo.suspensao = undefined
        novo.recados = [{
          id: `fim_suspensao_${novo.temporada}_${rodada}`, de: "Departamento juridico",
          texto: `Suspensao cumprida. ${novo.atleta.nome} esta liberado para a proxima rodada.`,
          temporada: novo.temporada, rodada,
        }, ...novo.recados].slice(0, 25)
      }
      continue
    }

    // ── A partida do atleta ──
    const emCasa = fixture.homeCurto === novo.clubeCurto
    const golsPro = emCasa ? partida.home.goals : partida.away.goals
    const golsContra = emCasa ? partida.away.goals : partida.home.goals
    const adversario = emCasa ? fixture.awayNome : fixture.homeNome
    const forcaAdversaria = forcaDoTime(emCasa ? visitante : mandante)
    const d = desempenhoDaPartida(novo, golsPro, golsContra, forcaAdversaria, `${novo.atleta.id}:${novo.temporada}:${rodada}`)

    // ── VIVER A PARTIDA (1.0.329) ──
    //
    // Em vez de aplicar a linha individual que o motor calculou, monta os
    // MOMENTOS e devolve a decisão ao jogador. O placar já está fechado (e a
    // tabela, atualizada logo acima): o que muda é QUEM fez o quê dentro dele.
    if (opcoes?.viver && d.minutos > 0) {
      novo.partidaEmCurso = montarPartidaDoAtleta(novo, {
        fixtureId: fixture.id, adversario, emCasa, competicao: fixture.competition, rodada,
        golsPro, golsContra, minutos: d.minutos, titular: d.titular,
      })
      continue
    }

    aplicarPartidaNaCarreira(novo, {
      rodada, competicao: fixture.competition, adversario, emCasa, golsPro, golsContra,
      semente: `${novo.atleta.id}:${novo.temporada}:${rodada}`,
    }, d)
  }

  // ── COPA E CONTINENTAL, nas mesmas rodadas-gatilho do modo de tecnico ──
  jogarMataMata(novo, "copa", rodada, clubes)
  jogarMataMata(novo, "continental", rodada, clubes)

  novo.rodada = rodada
  novo.tabela = sortStandings(novo.tabela)
  // ⚠️ A TEMPORADA SO ACABA QUANDO O MATA-MATA ACABA. Fechar no fim da liga
  // deixaria a final da copa por jogar — e o titulo, sem dono.
  const mataMataEmAberto = [novo.copa, novo.continental].some(b => b && !b.champion && b.userEliminatedAtRound === undefined)
  if (!novo.calendario.some(f => !f.played) && !mataMataEmAberto) novo.temporadaEncerrada = true
  return novo
}


/** O contexto de UMA partida do atleta — liga ou copa, a bolsa é a mesma. */
interface ContextoDaPartidaDoAtleta {
  rodada: number
  competicao: string
  adversario: string
  emCasa: boolean
  golsPro: number
  golsContra: number
  /** Semente determinística desta partida (entra em ações e evolução). */
  semente: string
}

/**
 * APLICA UMA PARTIDA NA CARREIRA: súmula, estatística, cartão, moral, forma,
 * nota do treinador, XP e metas.
 *
 * ⚠️ Extraído de dentro do laço da rodada na 1.0.351, sem mudar uma regra. O
 * motivo: a COPA passou a existir para o atleta, e ela precisa da mesma
 * contabilidade. Duplicar estas noventa linhas era garantir que uma das duas
 * cópias envelhecesse — foi assim que este projeto acabou com duas escalas para
 * a mesma grandeza mais de uma vez.
 */
function aplicarPartidaNaCarreira(
  novo: EstadoCarreiraDeJogador,
  ctx: ContextoDaPartidaDoAtleta,
  desempenho: DesempenhoIndividual,
): void {
  // ⚠️ O VESTIÁRIO MEXE NA NOTA ANTES DE QUALQUER COISA LER A NOTA (1.0.374).
  // Ela alimenta súmula, média da temporada, confiança do treinador, forma e
  // moral — ajustar depois de um desses faria os cinco discordarem entre si
  // sobre quanto o atleta foi bem no mesmo jogo.
  //
  // ±0,5 é de propósito pequeno: o grupo TEMPERA a atuação, não a substitui.
  // Um vestiário rachado não transforma uma atuação 8 em 6, mas decide empates.
  //
  // ⚠️ A ARQUIBANCADA ENTRA JUNTO (1.0.377), e SÓ EM CASA. Até a 1.0.376
  // `estado.torcida` era escrito por entrevista e por atuação e não era lido
  // por ninguém — um medidor puro. Aqui ele finalmente decide alguma coisa, e
  // decide no único lugar onde faz sentido: o jogo com a sua torcida presente.
  const ajusteDoGrupo =
    ajusteDaNotaPeloVestiario(lerRelacoes(relacoesDoAtleta(novo)))
    + empurraoDaTorcida(novo.torcida ?? 50, ctx.emCasa ? "casa" : "fora")

  const d: DesempenhoIndividual = desempenho.minutos > 0
    ? {
      ...desempenho,
      nota: Math.max(3, Math.min(10, Math.round((desempenho.nota + ajusteDoGrupo) * 10) / 10)),
    }
    : desempenho

  const registro: PartidaDoAtleta = {
    temporada: novo.temporada, rodada: ctx.rodada, competicao: ctx.competicao,
    adversario: ctx.adversario, casa: ctx.emCasa, golsPro: ctx.golsPro, golsContra: ctx.golsContra,
    titular: d.titular, minutos: d.minutos, gols: d.gols, assistencias: d.assistencias,
    nota: d.nota, cartao: d.cartao,
  }
  novo.ultimasPartidas = [registro, ...novo.ultimasPartidas].slice(0, 12)

  if (d.minutos > 0) {
    const economia = economiaDoAtleta(novo)
    novo.economia = economia
    economia.energia = Math.max(0, economia.energia - Math.max(2, Math.round((d.minutos / 90) * 12)))
    novo.temporadaAtual.jogos++
    if (d.titular) novo.temporadaAtual.titularidades++
    novo.temporadaAtual.minutos += d.minutos
    novo.temporadaAtual.gols += d.gols
    novo.temporadaAtual.assistencias += d.assistencias
    novo.temporadaAtual.somaDasNotas += d.nota
    if (d.cartao === "amarelo") novo.temporadaAtual.cartoesAmarelos++
    if (d.cartao === "vermelho") novo.temporadaAtual.cartoesVermelhos++
    // CARTAO -> SUSPENSAO, pela MESMA funcao que o modo de tecnico usa
    // (lib/player-realism): cinco amarelos valem um jogo, vermelho vale um
    // jogo direto. Escrever uma segunda regra aqui era como o projeto acabou
    // com duas escalas para a mesma grandeza mais de uma vez.
    if (d.cartao) {
      const punicao = suspensaoPorCartoes(
        novo.amarelosAcumulados ?? 0,
        d.cartao === "amarelo" ? 1 : 0,
        d.cartao === "vermelho",
      )
      novo.amarelosAcumulados = punicao.amarelosRestantes
      if (punicao.suspender > 0) {
        novo.suspensao = {
          partidasRestantes: (novo.suspensao?.partidasRestantes ?? 0) + punicao.suspender,
          motivo: d.cartao === "vermelho" ? "expulsao" : "cartoes acumulados",
        }
        novo.recados = [{
          id: `suspensao_${novo.temporada}_${ctx.rodada}`, de: "Departamento juridico",
          texto: d.cartao === "vermelho"
            ? `Expulso contra o ${ctx.adversario}. ${novo.atleta.nome} cumpre ${punicao.suspender} jogo(s) de suspensao.`
            : `Quinto amarelo contra o ${ctx.adversario}. ${novo.atleta.nome} fica de fora da proxima rodada.`,
          temporada: novo.temporada, rodada: ctx.rodada,
        }, ...novo.recados].slice(0, 25)
      }
    }
    // ⚠️ A MANCHETE SAI DEPOIS DA NOTA JÁ AJUSTADA PELO VESTIÁRIO. A imprensa
    // comenta o que o jogo registrou — se ela lesse a nota crua, o jornal e a
    // súmula dariam números diferentes para a mesma partida.
    novo.repercussao = [
      ...manchetesDaRodada(novo, d, ctx.adversario),
      ...(novo.repercussao ?? []),
    ].slice(0, 20)
    registrarAcoes(novo, d, `${ctx.semente}:acoes`)
    // BÔNUS POR GOL vira dinheiro na hora — é o que faz o contrato ser uma
    // decisão e não um enfeite na tela de proposta.
    if (d.gols > 0) novo.ganhosDaTemporada += d.gols * (novo.contrato.bonusPorGol ?? 0)
    // REPERCUSSÃO automática: o mundo comenta o que aconteceu. Dois gols ou
    // uma nota alta viram post; reputação sobe junto, e é ela que faz clube
    // grande acordar (ver `gerarPropostas`).
    if (d.gols >= 2 || d.nota >= 8.5) {
      novo.reputacao = moverReputacao(novo, d.gols >= 2 ? 3 : 2)
      novo.torcida = Math.min(100, (novo.torcida ?? 50) + 2)
      novo.repercussao = [{
        id: `post_${novo.temporada}_${ctx.rodada}`,
        autor: "@FutNews",
        texto: d.gols >= 2
          ? `${novo.atleta.nome} decide de novo: ${d.gols} gols contra o ${ctx.adversario}.`
          : `Nota ${d.nota.toFixed(1)} para ${novo.atleta.nome} no jogo contra o ${ctx.adversario}.`,
        temporada: novo.temporada,
      }, ...(novo.repercussao ?? [])].slice(0, 20)
    }
    // A nota do treinador se move DEVAGAR: uma partida ruim não tira o
    // titular, e uma boa não faz o reserva virar camisa 10 na semana seguinte.
    novo.notaDoTreinador = limitar(novo.notaDoTreinador + (d.nota - 6.6) * 2.4 + d.gols * 1.5)
    novo.forma = limitar(novo.forma * 0.72 + d.nota * 8.4)
    // ⚠️ O VESTIÁRIO MOVE-SE PELO QUE VOCÊ FAZ, e não só pelo que você diz.
    // Sem esta linha o grupo só responderia a conversas, e jogar bem — que é a
    // maneira mais óbvia de ganhar um vestiário — não valeria nada.
    novo.relacoes = {
      ...relacoesDoAtleta(novo),
      ...lerRelacoes(relacoesDoAtleta(novo)),
      elenco: limitar(relacoesDoAtleta(novo).elenco + (d.nota >= 7.2 ? 1.8 : d.nota >= 6 ? 0.4 : -1.4)),
    }
    // O rival reage ao seu jogo pelo avesso: você indo bem, ele esfria.
    novo.companheiros = moverCompanheiro(
      lerCompanheiros(novo.companheiros, novo.clubeCurto, String(novo.atleta.posicao)),
      "rival", d.nota >= 7.2 ? -1.2 : d.nota < 6 ? 1 : 0,
    )
    sortearLesao(novo, d.minutos, ctx.rodada)
    novo.moral = limitar(novo.moral + (d.nota >= 7 ? 3 : d.nota >= 6 ? 0 : -3) + (ctx.golsPro > ctx.golsContra ? 2 : ctx.golsPro === ctx.golsContra ? 0 : -2))
  } else {
    // ⚠️ FICAR NO BANCO NÃO DERRUBA MAIS A CONFIANÇA (ver a nota da
    // hierarquia). Era esta linha que fechava a carreira: -0,8 por rodada sem
    // NENHUM caminho de volta, porque abaixo de 24 o atleta parava de entrar.
    // A forma esfria — isso é real —, mas quem decide o lugar dele é o mérito.
    novo.forma = limitar(novo.forma - 3)
    novo.moral = limitar(novo.moral - (novo.pedido === "mais_minutos" ? 4 : 2))
    // Treinar sem jogar rende pouco, mas rende: é o que dá ao reserva um
    // caminho para crescer e ULTRAPASSAR o concorrente.
    aplicarXP(novo, 6)
  }

  // ── A CONFIANÇA CAMINHA PARA O MÉRITO, DENTRO DE UMA FAIXA ──
  //
  // Um passo pequeno por rodada (12% da distância): a mudança de status
  // acontece ao longo de semanas, não de uma partida — e, o que importa,
  // acontece nos DOIS sentidos.
  //
  // ⚠️ E A FAIXA DE ±22 NÃO É DETALHE. Sem ela o pêndulo ia para o outro
  // extremo: no teste, um atleta de overall 60 que é o **11º de 11** da
  // posição terminou a temporada com 41 titularidades e média 8,10 — porque
  // cada boa atuação somava sem teto e o mérito não segurava nada. Com a
  // faixa, atuação boa ainda promove (dá para sair de "fora dos planos" a
  // "rodízio" jogando bem), mas ninguém passa por cima da fila inteira sem
  // antes ficar melhor que ela de verdade. Quem muda o teto é a EVOLUÇÃO.
  // ⚠️ O CONCORRENTE DESLOCA O ALVO, NÃO SANGRA A NOTA (corrigido na 1.0.374).
  //
  // A primeira versão fazia `notaDoTreinador + pressaoDoRival(time)` DEPOIS da
  // convergência — ou seja, tirava até 7 pontos A CADA PARTIDA, enquanto o
  // mérito só recupera 12% da distância por rodada. O saldo era negativo toda
  // semana e a nota afundava sozinha: medido, um meia de 24 anos saiu de 22,4
  // no fim da primeira temporada para 5,7 na segunda, jogando 95 minutos no ano
  // inteiro. Nada acusava — nem tipo, nem lint, nem os testes das relações, que
  // conferiam o SINAL do efeito e não o acúmulo dele.
  //
  // Quem pegou foi o gate de lesões (`test-modalidades-ponta-a-ponta`), e por
  // um caminho indireto: um atleta que não entra em campo não se machuca, e
  // "seis temporadas sem uma única lesão" era o sintoma de um problema que não
  // tinha nada a ver com lesão.
  //
  // Aqui a pressão entra no ALVO. A confiança passa a convergir para um patamar
  // um pouco mais baixo — que é o que "ter um concorrente em forma" significa —
  // em vez de cair sem fundo.
  const merecida = confiancaMerecida(novo) + pressaoDoRival(
    lerCompanheiros(novo.companheiros, novo.clubeCurto, String(novo.atleta.posicao)),
  )
  novo.notaDoTreinador = limitar(Math.max(
    merecida - 22,
    Math.min(merecida + 22, novo.notaDoTreinador + (merecida - novo.notaDoTreinador) * 0.12),
  ))

  // ── O PISO DO TREINADOR, DEPOIS DO MÉRITO (1.0.374) ──────────────────────
  //
  // ⚠️ PISO, E SÓ PISO. Ele levanta por baixo do resultado e nunca soma por
  // cima: quem tem o técnico do lado não despenca para "fora dos planos" por
  // duas partidas ruins, mas também não vira titular sem jogar. Aplicar a
  // relação ANTES do mérito faria dela um atalho, e o sistema de confiança que
  // a 1.0.373 calibrou perderia o sentido.
  //
  // O concorrente NÃO entra aqui — ele desloca o alvo lá em cima, junto com o
  // mérito. Ver a nota daquele bloco: aplicá-lo neste ponto foi o defeito que
  // afundou a confiança em duas temporadas.
  {
    const relacoesAgora = lerRelacoes(relacoesDoAtleta(novo))
    novo.relacoes = { ...relacoesDoAtleta(novo), ...relacoesAgora }
    novo.companheiros = lerCompanheiros(novo.companheiros, novo.clubeCurto, String(novo.atleta.posicao))
    novo.notaDoTreinador = limitar(Math.max(
      pisoDaNotaDoTreinador(relacoesAgora),
      novo.notaDoTreinador,
    ))
  }
  aplicarXP(novo, d.xp)
  atualizarMetas(novo)
  liquidarAposta(novo, ctx.golsPro, ctx.golsContra)
}


// ─── MATA-MATA DA TEMPORADA DO ATLETA ────────────────────────────────────────
//
// A liga dá o calendário; a copa e a continental dão as noites. Tudo aqui usa o
// `lib/cup-engine` que o modo de técnico já usa — mesmo chaveamento, mesmas
// rodadas-gatilho, mesmo desempate por pênaltis. O que este arquivo acrescenta é
// só a LINHA INDIVIDUAL do atleta dentro daqueles jogos.

/** Clubes do continente, para o chaveamento continental. */
function clubesDoContinente(divisao: string, doUsuario: Team | undefined): Team[] {
  const divisoes = getContinentalDivisions(divisao)
  const pool = divisoes.flatMap(div => completarLigaComPool(div).slice(0, 6))
  if (doUsuario && !pool.some(t => t.curto === doUsuario.curto)) return [doUsuario, ...pool]
  return pool
}

/**
 * O clube do atleta disputa a continental nesta temporada?
 *
 * Primeira temporada: top 4 por PRESTÍGIO da liga (é o dado que existe antes de
 * qualquer campanha). Depois: onde ele terminou o ano anterior — que é a regra
 * de verdade e a que faz o G4 significar alguma coisa para quem joga.
 */
function classificadoAContinental(
  times: Team[],
  clubeCurto: string,
  posicaoAnterior?: number,
): boolean {
  if (posicaoAnterior !== undefined) return posicaoAnterior <= 4
  const ordenados = [...times].sort((a, b) => (b.prestigio ?? 0) - (a.prestigio ?? 0))
  return ordenados.slice(0, 4).some(t => t.curto === clubeCurto)
}

/** Monta copa nacional e continental da temporada. Muta o estado. */
function montarMataMataDaTemporada(
  estado: EstadoCarreiraDeJogador,
  times: Team[],
  posicaoAnterior?: number,
): void {
  const competicoes = getCountryCompetitions(estado.divisao)
  estado.copa = generateCupBracket(times, estado.clubeCurto, estado.temporada, competicoes.domesticCup)
  const clube = getTeamByFileKey(estado.clubeFileKey)
  if (classificadoAContinental(times, estado.clubeCurto, posicaoAnterior)) {
    const pool = clubesDoContinente(estado.divisao, clube)
    // `generateLiberBracket` nomeia tudo de "Libertadores"; o nome certo vem da
    // confederação do clube — um atleta do Ajax não joga a Libertadores.
    const bracket = generateLiberBracket(pool.length >= 8 ? pool : times, estado.clubeCurto, estado.temporada)
    estado.continental = { ...bracket, competition: competicoes.continental }
  } else {
    estado.continental = undefined
  }
}

/**
 * Joga a fase de mata-mata que cai nesta rodada e registra as partidas do
 * atleta — uma por jogo (ida e volta são DOIS jogos, a final é um só).
 */
function jogarMataMata(
  novo: EstadoCarreiraDeJogador,
  chave: "copa" | "continental",
  rodada: number,
  clubes: Map<string, Team>,
  /** Ignora a rodada-gatilho — usado para fechar o mata-mata quando a liga acaba antes. */
  forcar = false,
): void {
  const bracket = novo[chave]
  if (!bracket || bracket.champion) return
  const gatilho = chave === "copa" ? isCupTriggerRound(rodada) : isLiberTriggerRound(rodada)
  if (!gatilho && !forcar) return

  // ⚠️ OS CLUBES DO TORNEIO NÃO SÃO OS DA LIGA. `simulateCupRound` resolve cada
  // confronto por `teamMap.get(curto)` e PULA em silêncio o que não achar — com
  // a lista da liga brasileira, todo confronto continental era ignorado, o
  // chaveamento avançava de fase sem jogo nenhum e a Libertadores terminava sem
  // campeão e sem uma partida do atleta. Custo: o pool continental é montado só
  // nas três rodadas-gatilho do ano.
  const participantes = chave === "copa"
    ? [...clubes.values()]
    : clubesDoContinente(novo.divisao, getTeamByFileKey(novo.clubeFileKey))
  const mapaDoTorneio = new Map(participantes.map(t => [t.curto, t]))

  if (bracket.userEliminatedAtRound !== undefined) {
    // Eliminado: o chaveamento continua andando (para haver campeão), mas sem
    // partida do atleta.
    novo[chave] = chave === "copa"
      ? simulateCupRound(bracket, novo.clubeCurto, participantes)
      : simulateLiberRound(bracket, novo.clubeCurto, participantes)
    return
  }

  const fase = bracket.currentCupRound
  const depois = chave === "copa"
    ? simulateCupRound(bracket, novo.clubeCurto, participantes)
    : simulateLiberRound(bracket, novo.clubeCurto, participantes)
  novo[chave] = depois

  const confronto = depois.matches.find(m => m.cupRound === fase && m.isUserMatch && m.played)
  if (!confronto) return

  const mandanteNaIda = confronto.homeCurto === novo.clubeCurto
  const jogos: { emCasa: boolean; pro: number; contra: number }[] = [{
    emCasa: mandanteNaIda,
    pro: mandanteNaIda ? (confronto.homeGoals ?? 0) : (confronto.awayGoals ?? 0),
    contra: mandanteNaIda ? (confronto.awayGoals ?? 0) : (confronto.homeGoals ?? 0),
  }]
  if (confronto.twoLegged) {
    // Na VOLTA o mandante é o `awayCurto` — `leg2HomeGoals` são os gols dele.
    const mandanteNaVolta = confronto.awayCurto === novo.clubeCurto
    const golsDoMandante = confronto.leg2HomeGoals ?? 0
    const golsDoVisitante = confronto.leg2AwayGoals ?? 0
    jogos.push({
      emCasa: mandanteNaVolta,
      pro: mandanteNaVolta ? golsDoMandante : golsDoVisitante,
      contra: mandanteNaVolta ? golsDoVisitante : golsDoMandante,
    })
  }

  const adversarioCurto = mandanteNaIda ? confronto.awayCurto : confronto.homeCurto
  const adversario = mandanteNaIda ? confronto.awayNome : confronto.homeNome
  const forcaAdversaria = forcaDoTime(mapaDoTorneio.get(adversarioCurto))

  jogos.forEach((jogo, indice) => {
    // Lesão e suspensão valem para a copa exatamente como valem para a liga —
    // inclusive o jogo de suspensão CUMPRIDO aqui.
    if ((novo.lesao?.semanasRestantes ?? 0) > 0) return
    const suspensao = novo.suspensao
    if ((suspensao?.partidasRestantes ?? 0) > 0 && suspensao) {
      suspensao.partidasRestantes--
      novo.rodadasPerdidasPorSuspensao = (novo.rodadasPerdidasPorSuspensao ?? 0) + 1
      if (suspensao.partidasRestantes <= 0) novo.suspensao = undefined
      return
    }
    const semente = `${novo.atleta.id}:${novo.temporada}:${bracket.competition}:${fase}:${indice}`
    const d = desempenhoDaPartida(novo, jogo.pro, jogo.contra, forcaAdversaria, semente)
    aplicarPartidaNaCarreira(novo, {
      rodada, competicao: bracket.competition, adversario,
      emCasa: jogo.emCasa, golsPro: jogo.pro, golsContra: jogo.contra, semente,
    }, d)
  })
}


function limitar(v: number): number { return Math.max(0, Math.min(100, Math.round(v * 10) / 10)) }

/**
 * O QUE ELE FEZ NA PARTIDA, derivado do que já aconteceu.
 *
 * ⚠️ Sai dos MINUTOS, da POSIÇÃO e da NOTA — não de um sorteio paralelo, pela
 * mesma razão que os gols saem do placar: número que não conversa com o resto
 * vira estatística de mentira. Um lateral que jogou 90 e foi bem acumula
 * corrida e desarme; um meia acumula passe-chave.
 */
function registrarAcoes(estado: EstadoCarreiraDeJogador, d: DesempenhoIndividual, semente: string): void {
  const r = (n: number) => roll(`${semente}:${n}`)
  const proporcao = d.minutos / 90
  const bem = Math.max(0.5, d.nota / 7)
  const pos = estado.atleta.posicao
  const ofensivo = pos === "ATA" || pos === "MEI"
  const defensivo = pos === "ZAG" || pos === "VOL" || pos === "GOL"
  const lateral = pos === "LD" || pos === "LE"

  const acoes = estado.acoes
  const conta = (base: number, n: number) => Math.round(base * proporcao * bem * (0.6 + r(n) * 0.8))

  acoes.dribles += conta(ofensivo ? 4 : lateral ? 2.5 : 0.8, 1)
  acoes.passesChave += conta(pos === "MEI" ? 2.5 : ofensivo ? 1.5 : lateral ? 1 : 0.4, 2)
  acoes.passesCertos += conta(defensivo ? 45 : 32, 3)
  acoes.desarmes += conta(defensivo ? 5 : lateral ? 3.5 : 1, 4)
  acoes.finalizacoes += conta(pos === "ATA" ? 3.5 : ofensivo ? 2 : 0.5, 5) + d.gols
  acoes.corridas += conta(lateral || ofensivo ? 6 : 2.5, 6)
  acoes.duelosGanhos += conta(defensivo ? 6 : 3.5, 7)
}

// ─── EVOLUÇÃO ORGÂNICA ──────────────────────────────────────────────────────
//
// O atleta cresce pelo que FEZ, não por pontos gastos num menu. Quem passou a
// temporada driblando evolui drible; quem correu para o espaço evolui ritmo;
// quem desarmou evolui defesa. Três coisas modulam o tamanho do ganho:
//
//   · IDADE — antes dos 24 se aprende rápido; depois dos 30 o corpo cobra;
//   · PERSONALIDADE — profissionalismo e determinação são o multiplicador que
//     separa dois atletas idênticos aos 20 anos (é o exemplo do pedido);
//   · MINUTOS — quem não joga quase não evolui, e é isso que dá peso à decisão
//     de sair para jogar em vez de ficar no banco de um clube grande.
//
// O TETO continua sendo o potencial REAL, que o jogador nunca vê.

/** Quanto cada ação em campo empurra cada atributo. */
const EMPURRAO: Record<keyof AcoesDaTemporada, [keyof AtributosDoAtleta, number][]> = {
  dribles: [["drible", 1], ["ritmo", 0.35]],
  passesChave: [["passe", 1], ["drible", 0.25]],
  passesCertos: [["passe", 0.35]],
  desarmes: [["defesa", 1], ["fisico", 0.4]],
  finalizacoes: [["finalizacao", 1], ["fisico", 0.2]],
  corridas: [["ritmo", 1], ["fisico", 0.5]],
  duelosGanhos: [["fisico", 1], ["defesa", 0.4]],
}

/** Curva de idade: o quanto ainda se aprende. */
function fatorDaIdade(idade: number): number {
  if (idade <= 19) return 1.5
  if (idade <= 23) return 1.2
  if (idade <= 27) return 0.8
  if (idade <= 30) return 0.45
  return 0.15
}

export interface GanhoDeAtributo { atributo: keyof AtributosDoAtleta; ganho: number }

export const NOME_DO_ATRIBUTO: Record<keyof AtributosDoAtleta, string> = {
  ritmo: "Ritmo", finalizacao: "Finalização", passe: "Passe",
  drible: "Drible", defesa: "Defesa", fisico: "Físico",
}

/**
 * Aplica a evolução da temporada. Devolve os ganhos para a tela mostrar
 * — o jogador precisa VER por que evoluiu, senão o sistema vira ruído.
 */
export function evoluirOrganicamente(estado: EstadoCarreiraDeJogador): GanhoDeAtributo[] {
  const { atleta, acoes } = estado
  const minutos = estado.temporadaAtual.minutos
  if (minutos < 90) return []   // menos de uma partida inteira no ano: nada muda

  // 1. Peso bruto de cada atributo, a partir do que ele fez.
  const peso: Record<keyof AtributosDoAtleta, number> = { ritmo: 0, finalizacao: 0, passe: 0, drible: 0, defesa: 0, fisico: 0 }
  for (const [acao, efeitos] of Object.entries(EMPURRAO) as [keyof AcoesDaTemporada, [keyof AtributosDoAtleta, number][]][]) {
    for (const [atributo, forca] of efeitos) peso[atributo] += acoes[acao] * forca
  }
  // 2. O ARQUÉTIPO puxa o que é dele; o foco de treino inclina um pouco mais.
  const arq = arquetipo(atleta.arquetipo)
  for (const a of arq.principais) peso[a] *= 1.45
  if (estado.focoDeTreino !== "equilibrado") peso[estado.focoDeTreino] *= 1.35
  // Treino também empurra o foco mesmo sem ação em campo — senão um zagueiro
  // nunca melhoraria o passe.
  if (estado.focoDeTreino !== "equilibrado") peso[estado.focoDeTreino] += minutos / 90

  const somaDosPesos = Object.values(peso).reduce((t, v) => t + v, 0)
  if (somaDosPesos <= 0) return []

  // 3. Quanto de overall a temporada rende, no total.
  const p = atleta.personalidade
  const dedicacao = 0.6 + (p.profissionalismo + p.determinacao) / 40   // 0,65 a 1,6
  const porMinutos = Math.min(1.4, minutos / 1800)                     // ~20 jogos completos satura
  const espaco = Math.max(0, atleta.potencial - atleta.overall)
  const bruto = fatorDaIdade(atleta.idade) * dedicacao * porMinutos * 6
  // Perto do teto, cada ponto custa mais — a subida desacelera sozinha.
  const total = Math.max(0, Math.min(bruto, espaco * 0.55 + (atleta.idade <= 21 ? 1 : 0)))
  if (total < 0.5) return []

  // 4. Distribui entre os atributos, na proporção do que ele fez.
  const ganhos: GanhoDeAtributo[] = []
  for (const chave of Object.keys(peso) as (keyof AtributosDoAtleta)[]) {
    const fatia = (peso[chave] / somaDosPesos) * total * 3
    const ganho = Math.round(fatia)
    if (ganho <= 0) continue
    const antes = atleta.atributos[chave]
    atleta.atributos[chave] = Math.min(99, antes + ganho)
    if (atleta.atributos[chave] !== antes) ganhos.push({ atributo: chave, ganho: atleta.atributos[chave] - antes })
  }

  atleta.overall = Math.min(atleta.potencial, overallDoAtleta(atleta.posicao, atleta.atributos))

  // 5. ESPECIALIZAÇÃO: abre quando o atleta amadurece, pelo caminho que ele
  //    mesmo trilhou — não por escolha num menu no primeiro dia.
  if (!atleta.especializacao && atleta.overall >= 72 && estado.historico.length >= 2) {
    const maior = arq.especializacoes
      .map(e => ({ e, forca: e.foco.reduce((t, f) => t + atleta.atributos[f], 0) }))
      .sort((a, b) => b.forca - a.forca)[0]
    if (maior) atleta.especializacao = maior.e.id
  }
  return ganhos
}

/** Clubes da liga desta carreira, com o clube do atleta garantido na lista. */
function clubesDaLiga(estado: EstadoCarreiraDeJogador): Team[] {
  const clube = getTeamByFileKey(estado.clubeFileKey)
  return clube ? ligaDoClube(clube) : completarLigaComPool(estado.divisao)
}

/**
 * Clube que está na TABELA mas não na lista atual de clubes da divisão.
 *
 * Acontece quando o jogo é atualizado no meio da carreira e a composição da
 * divisão muda — o calendário já gravado continua citando o clube antigo. Sem
 * esta reserva a rodada simplesmente não simularia aquela partida e a temporada
 * nunca fecharia (o mesmo mecanismo que travava a virada de temporada).
 */
function clubeDeReserva(estado: EstadoCarreiraDeJogador, curto: string): Team {
  const linha = estado.tabela.find(t => t.curto === curto)
  return {
    nome: linha?.nome ?? curto, curto, cidade: "", estado: "",
    cor1: linha?.cor1 ?? "#334155", cor2: "#ffffff",
    prestigio: 60, torcida: 10_000, estadio_cap: 20_000, saldo: 0,
    file_key: curto.toLowerCase(), estadio_nome: "", patrocinador: "", escudo_url: "",
    divisao: estado.divisao,
  } as Team
}

const ADVERSARIOS_DA_SELECAO = ["Argentina", "Franca", "Espanha", "Alemanha", "Uruguai", "Italia", "Inglaterra", "Japao"]

function calendarioDaSelecao(estado: EstadoCarreiraDeJogador): PartidaDaSelecao[] {
  if (estado.selecao.partidas) return estado.selecao.partidas
  const inicio = hash(`${estado.atleta.id}:calendario-selecao:${estado.temporada}`) % ADVERSARIOS_DA_SELECAO.length
  return [0, 1, 2].map(i => ({
    id: `selecao_${estado.temporada}_${i + 1}`,
    adversario: ADVERSARIOS_DA_SELECAO[(inicio + i * 3) % ADVERSARIOS_DA_SELECAO.length],
    competicao: estado.selecao.nivel === "sub20" ? "Janela internacional Sub-20" : "Janela internacional",
    jogada: false,
  }))
}

export function proximaPartidaDaSelecao(estado: EstadoCarreiraDeJogador): PartidaDaSelecao | null {
  if (!estado.selecao.convocada) return null
  return calendarioDaSelecao(estado).find(p => !p.jogada) ?? null
}

export function jogarPartidaDaSelecao(
  estado: EstadoCarreiraDeJogador,
  opcoes?: { viver?: boolean },
): EstadoCarreiraDeJogador {
  if (!estado.selecao.convocada || estado.partidaEmCurso || estado.aposentado) return estado
  const novo = comEconomia(estado)
  novo.selecao.partidas = structuredClone(calendarioDaSelecao(novo))
  const compromisso = novo.selecao.partidas.find(p => !p.jogada)
  if (!compromisso) return estado

  const minhaSelecao = clubeDeReserva(novo, "SEL")
  minhaSelecao.nome = `Selecao de ${novo.atleta.nacionalidade}`
  minhaSelecao.prestigio = Math.max(62, Math.min(92, novo.atleta.overall + 8))
  const adversaria = clubeDeReserva(novo, `INT${hash(compromisso.adversario) % 999}`)
  adversaria.nome = compromisso.adversario
  adversaria.prestigio = 70 + (hash(compromisso.adversario) % 20)
  const config = {
    homeTeam: minhaSelecao, awayTeam: adversaria,
    homeRating: forcaDoTime(minhaSelecao), awayRating: forcaDoTime(adversaria), durationMinutes: 90,
  }
  const semente = `${novo.atleta.id}:selecao:${novo.temporada}:${compromisso.id}`

  if (opcoes?.viver) {
    novo.partidaEmCurso = montarPartidaAoVivo({
      fixtureId: compromisso.id, origem: "selecao", adversario: compromisso.adversario,
      emCasa: true, competicao: compromisso.competicao, rodada: novo.rodada,
      minutos: 90, titular: true, config, semente,
      posicao: String(novo.atleta.posicao),
      atributos: atributosEfetivosDoAtleta(novo) as unknown as Record<string, number>,
      energia: novo.economia?.energia,
      corpo: {
        altura: novo.atleta.alturaCm,
        pePreferido: novo.atleta.pePreferido,
        peFraco: novo.atleta.peFraco,
      },
      fatorDeLances: frequenciaDeLancesPeloCraque(
        lerCompanheiros(novo.companheiros, novo.clubeCurto, String(novo.atleta.posicao)),
      ),
    })
    return novo
  }

  const partida = simulateFullMatch(config)
  compromisso.jogada = true
  compromisso.golsPro = partida.home.goals
  compromisso.golsContra = partida.away.goals
  compromisso.nota = Math.round((6 + (partida.home.goals - partida.away.goals) * 0.25) * 10) / 10
  novo.selecao.jogos++
  if (["ATA", "MEI"].includes(novo.atleta.posicao) && roll(`${semente}:gol`) < 0.28) novo.selecao.gols++
  novo.economia!.energia = Math.max(0, novo.economia!.energia - 14)
  return novo
}

function atualizarMetas(estado: EstadoCarreiraDeJogador): void {
  const media = estado.temporadaAtual.jogos > 0 ? estado.temporadaAtual.somaDasNotas / estado.temporadaAtual.jogos : 0
  for (const meta of estado.metas) {
    meta.progresso =
      meta.tipo === "gols" ? estado.temporadaAtual.gols
        : meta.tipo === "assistencias" ? estado.temporadaAtual.assistencias
          : meta.tipo === "jogos" ? estado.temporadaAtual.jogos
            : meta.tipo === "nota" ? Math.round(media * 100) / 100
              : estado.tabela[0]?.curto === estado.clubeCurto ? 1 : 0
    meta.cumprida = meta.progresso >= meta.alvo
  }
}

// ─── Evolução por pontos ────────────────────────────────────────────────────

/**
 * Gasta um ponto num atributo.
 *
 * Custo cresce com o valor do atributo e o TETO é o potencial: um atleta com
 * potencial 80 não vira 95 por acúmulo de partidas. É o que impede a carreira
 * longa de virar um passeio depois da quarta temporada.
 */
export function gastarPonto(estado: EstadoCarreiraDeJogador, atributo: keyof AtributosDoAtleta): EstadoCarreiraDeJogador {
  if (estado.crescimento.pontosDisponiveis <= 0) return estado
  const atual = estado.atleta.atributos[atributo]
  if (atual >= 99) return estado
  const novo = structuredClone(estado)
  const custo = atual >= 85 ? 3 : atual >= 75 ? 2 : 1
  if (novo.crescimento.pontosDisponiveis < custo) return estado
  novo.crescimento.pontosDisponiveis -= custo
  novo.atleta.atributos[atributo] = atual + 1
  const overall = overallDoAtleta(novo.atleta.posicao, novo.atleta.atributos)
  novo.atleta.overall = Math.min(novo.atleta.potencial, overall)
  novo.contrato.valorDePasse = Math.max(200_000, novo.atleta.overall ** 3 * 12)
  return novo
}

// ─── Pedidos ao clube ───────────────────────────────────────────────────────

export function fazerPedido(estado: EstadoCarreiraDeJogador, pedido: EstadoCarreiraDeJogador["pedido"]): EstadoCarreiraDeJogador {
  const novo = structuredClone(estado)
  novo.pedido = pedido
  const texto = pedido === "transferencia"
    ? "Pedido de transferência registrado. O clube ouve propostas no fim da temporada."
    : pedido === "mais_minutos"
      ? "Você pediu mais minutos. O treinador respondeu que espaço se ganha treinando."
      : pedido === "renovacao"
        ? "Pedido de renovação enviado à diretoria."
        : "Pedido retirado."
  novo.recados = [{ id: `pedido_${pedido}_${estado.temporada}_${estado.rodada}`, de: "Agente", texto, temporada: estado.temporada, rodada: estado.rodada }, ...novo.recados].slice(0, 25)
  // Pedir transferência custa moral no vestiário — como custa na vida real.
  if (pedido === "transferencia") novo.moral = limitar(novo.moral - 8)
  return novo
}

// ─── Fim de temporada ───────────────────────────────────────────────────────

/**
 * O MUNDO PROCURA VOCÊ — e não o contrário (1.0.326).
 *
 * A regra do pedido: em vez de escolher "Real Madrid" num menu e cumprir metas,
 * os clubes acompanham quem está jogando. O interesse sai do que aconteceu —
 * overall, média, gols, minutos e o degrau do clube atual —, e o EMPRESÁRIO
 * decide quantas portas abrem e o quanto se arranca em cada uma.
 *
 * Quem está fora dos planos também recebe: aí a proposta vem por EMPRÉSTIMO,
 * que é o caminho real de quem precisa jogar. Sem isso, ficar sem espaço num
 * clube grande era um beco — o mesmo defeito que a 1.0.324 corrigiu do outro
 * lado.
 */
function gerarPropostas(estado: EstadoCarreiraDeJogador, media: number): PropostaDeClube[] {
  const { atleta } = estado
  const agente = estado.empresario
  const t = estado.temporadaAtual
  const jogou = t.jogos >= 6
  const interesse = atleta.overall
    + media * 4
    + t.gols * 1.2
    + (estado.pedido === "transferencia" ? 8 : 0)
    + (agente.influencia - 10) * 0.8
    // A REPUTAÇÃO fecha o ciclo da camada narrativa: entrevista ambiciosa que
    // repercute faz clube olhar. Sem isto, responder à imprensa seria enfeite.
    + ((estado.reputacao ?? 30) - 30) * 0.25
  const semEspaco = papelNoElenco(estado.notaDoTreinador) === "fora dos planos" || (!jogou && atleta.idade <= 23)

  if (interesse < 74 && !semEspaco) return []

  // ⚠️ A RELAÇÃO COM O EMPRESÁRIO MULTIPLICA, A INFLUÊNCIA DELE SOMA (1.0.374).
  // São coisas diferentes de propósito: `influencia` é o quanto ele PODE fazer,
  // e a relação é o quanto ele QUER fazer por você. Um agente poderoso que você
  // ignora há três temporadas trabalha menos — e é isso que dá consequência a
  // tratá-lo mal na mesa de negociação.
  const comOAgente = multiplicadorDePropostas(lerRelacoes(relacoesDoAtleta(estado)))
  const quantas = Math.max(1, Math.min(4, Math.round((1 + (agente.influencia - 8) / 4) * comOAgente)))
  const doExterior = agente.redeInternacional >= 12

  const candidatos = completarLigaComPool(estado.divisao)
    .filter(c => c.file_key !== estado.clubeFileKey)
    .concat(doExterior ? ligasVizinhas(estado) : [])
    .filter(c => c.prestigio > 0)
    .sort((a, b) => b.prestigio - a.prestigio)
    .filter(c => c.prestigio <= interesse + 12 && c.prestigio >= interesse - 30)
    .slice(0, quantas)

  return candidatos.map((clube, i) => {
    // O AGENTE arranca mais: negociação alta vira salário e luvas maiores.
    const talento = 1 + (agente.negociacao - 10) * 0.035
    const salario = Math.round(estado.contrato.salarioSemanal * (1.15 + i * 0.22 + clube.prestigio / 400) * talento)
    // O clube menor compra a vaga com STATUS; o maior, com dinheiro.
    const status: PapelNoElenco = clube.prestigio >= atleta.overall + 8 ? "rodízio"
      : clube.prestigio >= atleta.overall - 4 ? "titular"
        : "titular absoluto"
    return {
      id: `proposta_${estado.temporada}_${clube.file_key}`,
      clubeCurto: clube.curto,
      clubeNome: clube.nome,
      clubeFileKey: clube.file_key,
      divisao: String(clube.divisao),
      ligaNome: String(clube.divisao),
      prestigio: clube.prestigio,
      salarioSemanal: salario,
      temporadas: semEspaco ? 1 : 3 + (i % 2),
      luvas: semEspaco ? 0 : Math.round(salario * 12 * talento),
      bonusPorGol: Math.round(salario * 0.16),
      bonusPorTitulo: Math.round(salario * 6),
      statusPrometido: semEspaco ? "titular" : status,
      emprestimo: semEspaco,
      motivo: semEspaco
        ? "Quer você por empréstimo, para jogar todo fim de semana."
        : status === "rodízio"
          ? "Clube grande: você entra na disputa, sem vaga garantida."
          : "Quer você como peça central do projeto.",
    }
  })
}

/** Clubes de fora da liga atual que podem se interessar (as ligas mais fortes). */
function ligasVizinhas(estado: EstadoCarreiraDeJogador): Team[] {
  const grandes = ["premier_league", "la_liga", "serie_a_ita", "bundesliga", "ligue_1", "serie_a", "liga_f_esp", "wsl_ing", "nwsl_usa", "brasileirao_fem_a1"]
  return grandes
    .filter(div => div !== estado.divisao)
    .flatMap(div => completarLigaComPool(div).slice(0, 4))
}

export function encerrarTemporada(estado: EstadoCarreiraDeJogador): EstadoCarreiraDeJogador {
  if (!estado.temporadaEncerrada || estado.aposentado) return estado
  const novo = structuredClone(estado)
  const t = novo.temporadaAtual
  const media = t.jogos > 0 ? Math.round((t.somaDasNotas / t.jogos) * 100) / 100 : 0
  const tabela = sortStandings(novo.tabela)
  const posicao = Math.max(1, tabela.findIndex(l => l.curto === novo.clubeCurto) + 1)

  const titulos: string[] = []
  if (posicao === 1) titulos.push(`${novo.ligaNome} ${novo.temporada}`)
  // TÍTULOS DE MATA-MATA (1.0.351). `champion` guarda o NOME do clube, não o
  // `curto` — comparar com `clubeCurto` daria campeão nenhum para sempre.
  for (const bracket of [novo.copa, novo.continental]) {
    if (bracket?.champion && bracket.champion === novo.clubeNome) {
      titulos.push(`${bracket.competition} ${novo.temporada}`)
    }
  }

  // PRÊMIOS. Sem inventar concorrência: o critério é o desempenho absoluto do
  // atleta na competição, que é o dado que existe de verdade neste modo.
  const premios: string[] = []
  if (t.gols >= Math.max(12, t.jogos * 0.55)) premios.push(`Artilheiro da ${novo.ligaNome}`)
  if (media >= 7.6 && t.jogos >= 10) premios.push(`Seleção da ${novo.ligaNome}`)
  if (media >= 8 && t.jogos >= 15) premios.push("Melhor jogador da temporada")
  // ── PRÊMIOS QUE OLHAM A CARREIRA, NÃO SÓ A TEMPORADA (1.0.328) ──
  //
  // O critério continua sendo o desempenho ABSOLUTO do atleta — este modo não
  // simula a temporada individual dos outros 40 mil jogadores do mundo, e
  // inventar uma disputa que não existe seria pior do que não premiar.
  // O que muda é a régua: Bola de Ouro pede temporada excepcional COM título e
  // seleção; melhor jovem pede idade.
  if (novo.atleta.idade <= 21 && media >= 7.4 && t.jogos >= 12) {
    premios.push(`Melhor jovem da ${novo.ligaNome}`)
  }
  if (media >= 8.2 && t.jogos >= 20 && titulos.length > 0 && novo.selecao.jogos >= 8) {
    premios.push(`Bola de Ouro ${novo.temporada}`)
  }
  if (t.gols >= 25 && t.jogos >= 20) premios.push(`Chuteira de Ouro ${novo.temporada}`)

  novo.historico.push({
    temporada: novo.temporada, clubeNome: novo.clubeNome, competicao: novo.ligaNome,
    jogos: t.jogos, titularidades: t.titularidades, minutos: t.minutos,
    gols: t.gols, assistencias: t.assistencias, notaMedia: media,
    posicaoNaLiga: posicao, titulos, premios, overallFinal: novo.atleta.overall,
  })
  novo.titulos.push(...titulos)
  novo.premios.push(...premios)

  // ── Metas cobradas pelo treinador ──
  const cumpridas = novo.metas.filter(m => m.cumprida).length
  const proporcao = novo.metas.length ? cumpridas / novo.metas.length : 1
  novo.notaDoTreinador = limitar(novo.notaDoTreinador + (proporcao - 0.5) * 18)
  novo.recados = [{
    id: `metas_${novo.temporada}`, de: "Treinador",
    texto: proporcao >= 0.75
      ? `Temporada cumprida: ${cumpridas} de ${novo.metas.length} metas. O time conta com você.`
      : proporcao >= 0.4
        ? `${cumpridas} de ${novo.metas.length} metas. Dá para mais.`
        : `Só ${cumpridas} de ${novo.metas.length} metas. Vamos precisar de outra temporada bem diferente.`,
    temporada: novo.temporada, rodada: novo.rodada,
  }, ...novo.recados].slice(0, 25)

  // ── SELEÇÃO. Convocação por overall + atuação, e o nível pela idade. ──
  const chamado = novo.atleta.overall >= 74 && media >= 6.9 && t.jogos >= 8
  novo.selecao.convocada = chamado
  novo.selecao.nivel = chamado ? (novo.atleta.idade <= 20 ? "sub20" : "principal") : null
  if (chamado) {
    // A selecao nao injeta mais 4–9 jogos simulados no historico. A convocacao
    // abre tres compromissos reais, que podem ser vividos com o mesmo motor da
    // carreira ou simulados individualmente pelo jogador.
    novo.selecao.partidas = undefined
    novo.recados = [{
      id: `selecao_${novo.temporada}`, de: "Seleção",
      texto: `Você foi convocado para a seleção ${novo.selecao.nivel === "sub20" ? "Sub-20" : "principal"} de ${novo.atleta.nacionalidade}. Tres partidas foram adicionadas a janela internacional.`,
      temporada: novo.temporada, rodada: novo.rodada,
    }, ...novo.recados].slice(0, 25)
  }

  // ── A BRACADEIRA (1.0.347) ──
  //
  // ⚠️ Nao se vira capitao por ser o melhor: vira por ser referencia. Por isso o
  // criterio junta o que o TREINADOR ve (nota), o que o VESTIARIO sente
  // (lideranca e profissionalismo) e TEMPO de casa — chegar e receber a
  // bracadeira no primeiro ano seria o tipo de coisa que faz o marco nao valer
  // nada. Uma vez capitao, so se perde a bracadeira mudando de clube.
  if (!novo.capitao && !novo.aposentado) {
    const p = novo.atleta.personalidade
    // Nao existe atributo "lideranca" neste modo: quem faz referencia dentro do
    // grupo e a soma de profissionalismo com determinacao, que sao os dois que
    // o vestiario enxerga todo dia.
    const referencia = p.profissionalismo + p.determinacao
    // Tempo de casa sai do HISTORICO, que ja registra o clube de cada temporada
    // — inclusive a que acabou de ser fechada logo acima.
    const temporadasNoClube = novo.historico.filter(h => h.clubeNome === novo.clubeNome).length
    // ⚠️ O LIMIAR DE PERSONALIDADE ERA ALTO DEMAIS e a bracadeira nunca saia: um
    // atleta que chegou a nota 100 em seis temporadas no mesmo clube seguia sem
    // capitania, porque a soma exigida (26 de 40) so cabia no terco superior. O
    // gate pegou. Capitao e REFERENCIA do grupo — o peso esta no que o treinador
    // ve e no tempo de casa; a personalidade so barra quem nao serve de exemplo.
    if (novo.notaDoTreinador >= 76 && referencia >= 20 && temporadasNoClube >= 2 && t.jogos >= 12) {
      novo.capitao = true
      novo.temporadaEmQueVirouCapitao = novo.temporada
      novo.moral = limitar(novo.moral + 10)
      novo.reputacao = moverReputacao(novo, 5)
      titulos.push(`Capitao do ${novo.clubeNome}`)
      novo.recados = [{
        id: `capitao_${novo.temporada}`, de: "Treinador",
        texto: `A bracadeira e sua. O grupo te escolheu como referencia do ${novo.clubeNome}.`,
        temporada: novo.temporada, rodada: novo.rodada,
      }, ...novo.recados].slice(0, 25)
    }
  }

  // ── PRE-TEMPORADA (1.0.347) ──
  //
  // O ano nao comeca no primeiro jogo. Estas rodadas sem partida rendem mais em
  // treino e recuperam forma — e sao onde a intensidade escolhida decide o ano.
  novo.preTemporada = { rodadasRestantes: 3 }

  // ── EVOLUÇÃO ORGÂNICA (1.0.325) ──
  //
  // Acontece ANTES do envelhecimento, na temporada que o atleta acabou de
  // jogar: o que ele fez em campo neste ano é o que o forma. Depois disso a
  // idade cobra o que tiver de cobrar.
  novo.ultimaEvolucao = evoluirOrganicamente(novo)
  if (novo.ultimaEvolucao.length) {
    const resumo = novo.ultimaEvolucao.map(g => `${NOME_DO_ATRIBUTO[g.atributo]} +${g.ganho}`).join(", ")
    novo.recados = [{
      id: `evolucao_${novo.temporada}`, de: "Preparador",
      texto: `O ano rendeu: ${resumo}. Foi o que você fez em campo que puxou isso.`,
      temporada: novo.temporada, rodada: novo.rodada,
    }, ...novo.recados].slice(0, 25)
  }
  novo.acoes = { ...ACOES_ZERADAS }

  // ── IDADE E DECLÍNIO ──
  novo.atleta.idade++
  const idade = novo.atleta.idade
  if (idade >= 31) {
    // Cai primeiro o que a idade cobra primeiro: ritmo e físico. O
    // PROFISSIONALISMO segura a queda — é o que faz um atleta chegar aos 36
    // jogando e outro sumir aos 32.
    const cuidado = novo.atleta.personalidade.profissionalismo >= 15 ? 0.6 : novo.atleta.personalidade.profissionalismo <= 7 ? 1.35 : 1
    const perda = Math.round((idade >= 35 ? 4 : idade >= 33 ? 3 : 2) * cuidado)
    novo.atleta.atributos.ritmo = Math.max(20, novo.atleta.atributos.ritmo - perda)
    novo.atleta.atributos.fisico = Math.max(20, novo.atleta.atributos.fisico - Math.round(perda * 0.7))
    novo.atleta.overall = overallDoAtleta(novo.atleta.posicao, novo.atleta.atributos)
  }

  novo.propostas = gerarPropostas(novo, media)

  // Aposentadoria: idade + queda de rendimento + ninguém mais chamando.
  if (idade >= 38 || (idade >= 34 && novo.notaDoTreinador < 20 && novo.propostas.length === 0)) {
    novo.aposentado = true
    // ⚠️ A PONTUAÇÃO É CALCULADA AQUI E GRAVADA, não recalculada pela tela.
    // Depois da aposentadoria o estado não muda mais, mas as REGRAS podem
    // mudar numa versão futura — e uma carreira encerrada não pode receber uma
    // nota diferente da que o jogador viu no dia em que a encerrou.
    const fecho = pontuacaoFinal(folhaDaCarreira(novo))
    novo.pontuacaoFinal = fecho.total
    novo.patamarFinal = fecho.patamar
    novo.recados = [{
      id: `aposentadoria_${novo.temporada}`, de: "Agente",
      texto: `Fim de linha: ${novo.historico.reduce((n, h) => n + h.jogos, 0)} jogos, ${novo.historico.reduce((n, h) => n + h.gols, 0)} gols e ${novo.titulos.length} títulos. Obrigado por tudo.`,
      temporada: novo.temporada, rodada: novo.rodada,
    }, ...novo.recados].slice(0, 25)
    novo.recados = [{
      id: `legado_${novo.temporada}`, de: "Legado",
      texto: `${fecho.total} pontos: ${fecho.patamar}. ${conquistasAtingidas(folhaDaCarreira(novo)).length} conquistas desbloqueadas.`,
      temporada: novo.temporada, rodada: novo.rodada,
    }, ...novo.recados].slice(0, 25)
    novo.recados = [{
      id: `pos_carreira_${novo.temporada}`, de: "Diretoria",
      texto: `Sua carreira acabou dentro de campo — não neste clube. Quer continuar aqui como treinador? O mundo segue de onde você parou.`,
      temporada: novo.temporada, rodada: novo.rodada,
    }, ...novo.recados].slice(0, 25)
    return novo
  }

  // ── TEMPORADA NOVA ──
  novo.temporada++
  const clube = getTeamByFileKey(novo.clubeFileKey)
  const times = clube ? ligaDoClube(clube) : completarLigaComPool(novo.divisao)
  novo.calendario = generateSeasonFixtures(times, novo.clubeCurto, novo.temporada, novo.ligaNome)
  novo.tabela = initStandings(times)
  novo.rodada = 0
  novo.temporadaAtual = { jogos: 0, titularidades: 0, minutos: 0, gols: 0, assistencias: 0, somaDasNotas: 0, cartoesAmarelos: 0, cartoesVermelhos: 0 }
  // O ACUMULO DE AMARELOS ZERA NA VIRADA — a suspensao pendente NAO. E o que
  // acontece de verdade: quem termina o ano expulso comeca o seguinte cumprindo.
  novo.amarelosAcumulados = 0
  novo.metas = metasIniciais(novo.atleta, clube?.prestigio ?? 60, novo.calendario.filter(f => f.isUserMatch).length)
  // MATA-MATA DO ANO NOVO. A vaga na continental sai de ONDE O CLUBE TERMINOU —
  // é o que faz o G4 valer alguma coisa para quem só joga.
  montarMataMataDaTemporada(novo, times, posicao)
  novo.temporadaEncerrada = false
  novo.contrato.ateTemporada = Math.max(novo.contrato.ateTemporada, novo.temporada)
  return novo
}

/** Aceita uma proposta: troca de clube, calendário novo e nota do treinador zerada. */
export function aceitarProposta(estado: EstadoCarreiraDeJogador, propostaId: string): EstadoCarreiraDeJogador {
  const proposta = estado.propostas.find(p => p.id === propostaId)
  if (!proposta) return estado
  // Proposta retirada na mesa não se assina depois (1.0.358). Sem esta linha o
  // clube "encerrava a conversa" e o botão continuava fechando contrato.
  if (proposta.negociacao?.retirada) return estado
  const clube = getTeamByFileKey(proposta.clubeFileKey)
  if (!clube) return estado

  const novo = structuredClone(estado)
  const times = ligaDoClube(clube)
  novo.clubeCurto = clube.curto
  novo.clubeNome = clube.nome
  novo.clubeFileKey = clube.file_key
  novo.divisao = String(clube.divisao)
  novo.pais = clube.pais ?? novo.pais
  novo.ligaNome = proposta.ligaNome
  novo.calendario = generateSeasonFixtures(times, clube.curto, novo.temporada, novo.ligaNome)
  novo.tabela = initStandings(times)
  // Clube novo, copa nova: o chaveamento do clube antigo não o acompanha.
  montarMataMataDaTemporada(novo, times)
  novo.contrato = {
    salarioSemanal: proposta.salarioSemanal,
    ateTemporada: novo.temporada + proposta.temporadas,
    valorDePasse: Math.max(200_000, novo.atleta.overall ** 3 * 12),
    luvas: proposta.luvas,
    bonusPorGol: proposta.bonusPorGol,
    bonusPorTitulo: proposta.bonusPorTitulo,
    statusPrometido: proposta.statusPrometido,
  }
  // LUVAS entram como ganho no ato da assinatura, descontada a comissão do
  // empresário — que é o preço de ter alguém bom cuidando disso.
  novo.ganhosDaTemporada += Math.round((proposta.luvas ?? 0) * (1 - novo.empresario.comissao / 100))
  // Clube novo, treinador novo: a confiança recomeça no mérito daquele elenco —
  // é o que dá peso à decisão de subir de degrau cedo demais. Trocar o Santos
  // pelo Barcelona pode significar cair para o 4º da fila, e o modo agora diz
  // isso na cara antes de a temporada começar.
  //
  // ⚠️ O STATUS PROMETIDO vale como piso na chegada: quem foi contratado para
  // ser titular não senta no banco no primeiro dia. Ele não vira garantia
  // eterna — a fila da posição volta a mandar assim que a bola rola.
  const pisoPrometido: Record<PapelNoElenco, number> = {
    "titular absoluto": 80, titular: 62, "rodízio": 45, reserva: 28, "fora dos planos": 12,
  }
  novo.notaDoTreinador = limitar(Math.max(
    confiancaMerecida(novo) * 0.8,
    pisoPrometido[proposta.statusPrometido ?? "rodízio"] * 0.9,
  ))
  novo.metas = metasIniciais(novo.atleta, clube.prestigio, novo.calendario.filter(f => f.isUserMatch).length)
  novo.propostas = []
  novo.pedido = "nenhum"
  novo.recados = [{
    id: `transferencia_${novo.temporada}_${clube.file_key}`, de: "Agente",
    texto: `Acertado com o ${clube.nome}. Contrato até ${novo.contrato.ateTemporada}.`,
    temporada: novo.temporada, rodada: 0,
  }, ...novo.recados].slice(0, 25)

  // ── FIM DO MERCADO (1.0.358) ────────────────────────────────────────────
  //
  // Quem assinou estando SEM CLUBE volta a ter temporada: a rodada recomeça no
  // zero (o calendário acima é novo) e a contagem da temporada também, porque
  // os jogos que o antigo clube fez sem ele não são dele. As semanas paradas
  // ficam no recado — foram parte da carreira.
  if (novo.semClube) {
    const semanas = novo.semClube.semanas
    novo.rodada = 0
    novo.temporadaAtual = { jogos: 0, titularidades: 0, minutos: 0, gols: 0, assistencias: 0, somaDasNotas: 0, cartoesAmarelos: 0, cartoesVermelhos: 0 }
    novo.ultimasPartidas = []
    novo.temporadaEncerrada = false
    // Fora de ritmo: quem passou semanas sem treinar com grupo não estreia
    // inteiro. A forma volta com as semanas de treino, como qualquer lesão.
    novo.forma = Math.max(40, Math.min(novo.forma, 78 - semanas))
    novo.recados = [{
      id: `fim_do_mercado_${novo.temporada}_${clube.file_key}`, de: "Agente",
      texto: semanas <= 1
        ? `Mercado curto: você ficou livre e já assinou com o ${clube.nome}.`
        : `Depois de ${semanas} semanas sem clube, está assinado com o ${clube.nome}. Agora é recuperar o ritmo.`,
      temporada: novo.temporada, rodada: 0,
    }, ...novo.recados].slice(0, 25)
    novo.semClube = undefined
  }
  return novo
}

export function recusarPropostas(estado: EstadoCarreiraDeJogador): EstadoCarreiraDeJogador {
  return { ...estado, propostas: [], pedido: "nenhum" }
}

/**
 * TROCAR DE EMPRESÁRIO.
 *
 * Um agente melhor traz mais propostas, arranca mais salário e alcança o
 * exterior — e come uma fatia maior. A troca só faz sentido quando o atleta já
 * vale alguma coisa, e é essa a decisão: pagar mais para chegar mais longe.
 */
export function trocarEmpresario(estado: EstadoCarreiraDeJogador, nome: string): EstadoCarreiraDeJogador {
  const novo = EMPRESARIOS.find(e => e.nome === nome)
  if (!novo || novo.nome === estado.empresario.nome) return estado
  // Agente grande não pega qualquer um: é preciso ter o que negociar.
  const exigencia = 55 + novo.influencia * 1.6
  if (estado.atleta.overall < exigencia) {
    return {
      ...estado,
      recados: [{
        id: `agente_recusa_${novo.nome}_${estado.temporada}`,
        de: novo.nome,
        texto: `Obrigado pelo contato, mas hoje não consigo fazer um bom trabalho por você. Procure quando estiver jogando mais.`,
        temporada: estado.temporada, rodada: estado.rodada,
      }, ...estado.recados].slice(0, 25),
    }
  }
  return {
    ...estado,
    empresario: novo,
    recados: [{
      id: `agente_${novo.nome}_${estado.temporada}`,
      de: novo.nome,
      texto: `Assumi a sua carreira. Comissão de ${novo.comissao}% — e eu trabalho por ela.`,
      temporada: estado.temporada, rodada: estado.rodada,
    }, ...estado.recados].slice(0, 25),
  }
}

/**
 * O QUE A CARREIRA FOI, em números — para a despedida e para a transição.
 *
 * ⚠️ Existe por causa da mecânica que o usuário pediu e que é a mais forte do
 * modo: aposentar aos 36 e CONTINUAR O MESMO SAVE como treinador, 15–20
 * temporadas depois do começo. Para isso a carreira de atleta precisa deixar um
 * legado legível — senão o técnico novo nasce sem passado, e a graça era
 * justamente ser o mesmo universo.
 */
export interface ResumoDaCarreira {
  jogos: number
  gols: number
  assistencias: number
  temporadas: number
  titulos: string[]
  premios: string[]
  selecao: { jogos: number; gols: number }
  ultimoClube: string
  ultimoClubeFileKey: string
  overallMaximo: number
}

export function resumoDaCarreira(estado: EstadoCarreiraDeJogador): ResumoDaCarreira {
  const h = estado.historico
  return {
    jogos: h.reduce((n, x) => n + x.jogos, 0),
    gols: h.reduce((n, x) => n + x.gols, 0),
    assistencias: h.reduce((n, x) => n + x.assistencias, 0),
    temporadas: h.length,
    titulos: estado.titulos,
    premios: estado.premios,
    selecao: { jogos: estado.selecao.jogos, gols: estado.selecao.gols },
    ultimoClube: estado.clubeNome,
    ultimoClubeFileKey: estado.clubeFileKey,
    overallMaximo: Math.max(estado.atleta.overall, ...h.map(x => x.overallFinal)),
  }
}

/**
 * A REPUTAÇÃO com que o ex-atleta começa a carreira de técnico.
 *
 * Quem ganhou Bola de Ouro não começa dirigindo o mesmo clube que um reserva
 * aposentado — é o que faz valer a pena ter jogado bem antes.
 */
export function reputacaoDeTreinador(resumo: ResumoDaCarreira): number {
  return Math.round(Math.min(100,
    20
    + resumo.overallMaximo * 0.4
    + resumo.titulos.length * 3
    + resumo.premios.length * 4
    + Math.min(15, resumo.selecao.jogos * 0.2),
  ))
}

// ─── ENTREVISTAS E REPERCUSSÃO (1.0.328) ────────────────────────────────────
//
// ⚠️ NÃO É ENFEITE, E É POR ISSO QUE EXISTE. Uma entrevista que não muda nada é
// só texto no meio do caminho — o jogador aprende em duas rodadas que pode
// clicar em qualquer resposta. Aqui cada tom mexe em coisas diferentes e
// OPOSTAS: a resposta que agrada o treinador não é a que constrói reputação, e
// a polêmica compra a torcida ao preço do banco.

export type TomDaResposta = "respeitosa" | "ambiciosa" | "polemica"

export interface Entrevista {
  id: string
  pergunta: string
  /** O que motivou a pergunta — a imprensa só pergunta o que aconteceu. */
  contexto: string
  respostas: {
    tom: TomDaResposta
    texto: string
    /** O que muda, em linguagem de gente, para a tela mostrar ANTES do clique. */
    efeito: string
  }[]
}

/**
 * A pergunta da vez, ou `null` quando não há assunto.
 *
 * A imprensa só pergunta o que o save produziu: sequência no banco, sequência
 * de gols, proposta na mesa. Sem assunto, não há entrevista — inventar pauta
 * seria o mesmo que inventar concorrência para os prêmios.
 */
export function entrevistaDaVez(estado: EstadoCarreiraDeJogador): Entrevista | null {
  const papel = papelNoElenco(estado.notaDoTreinador)
  const t = estado.temporadaAtual
  const semJogar = estado.ultimasPartidas.slice(0, 4)
  const encostado = semJogar.length >= 4 && semJogar.every(p => p.minutos === 0)

  if (encostado) {
    return {
      id: `entrevista_banco_${estado.temporada}_${estado.rodada}`,
      pergunta: "Você está satisfeito com os poucos minutos?",
      contexto: `Quatro partidas seguidas sem sair do banco. Hoje você é ${papel} no elenco.`,
      respostas: [
        { tom: "respeitosa", texto: "Vou continuar trabalhando e esperando minha vez.", efeito: "Treinador gosta · moral cede um pouco" },
        { tom: "ambiciosa", texto: "Acredito que mereço mais oportunidades.", efeito: "Reputação sobe · treinador esfria" },
        { tom: "polemica", texto: "Não entendo a decisão. Ninguém entende.", efeito: "Torcida e mídia falam de você · treinador afunda" },
      ],
    }
  }

  if (t.gols >= 5 && t.jogos >= 6) {
    return {
      id: `entrevista_fase_${estado.temporada}_${t.gols}`,
      pergunta: "A fase é a melhor da sua carreira. O que mudou?",
      contexto: `${t.gols} gols em ${t.jogos} partidas nesta temporada.`,
      respostas: [
        { tom: "respeitosa", texto: "É o trabalho do grupo. Eu só finalizo.", efeito: "Vestiário aprova · treinador confia mais" },
        { tom: "ambiciosa", texto: "Estou pronto para um passo maior.", efeito: "Reputação sobe · clubes acordam · treinador desconfia" },
        { tom: "polemica", texto: "Faltou quem acreditasse antes.", efeito: "Mídia repercute · vestiário racha" },
      ],
    }
  }

  if (estado.propostas.length > 0) {
    return {
      id: `entrevista_proposta_${estado.temporada}`,
      pergunta: "Existe proposta na mesa. Você fica?",
      contexto: `${estado.propostas.length} clube(s) sondando você nesta janela.`,
      respostas: [
        { tom: "respeitosa", texto: "Tenho contrato e respeito o clube.", efeito: "Torcida e treinador aprovam" },
        { tom: "ambiciosa", texto: "Vou avaliar o que for melhor para minha carreira.", efeito: "Reputação sobe · torcida esfria" },
        { tom: "polemica", texto: "Já dei o que tinha de dar aqui.", efeito: "Rompe com a torcida · acelera a saída" },
      ],
    }
  }
  return null
}

/** Responde. Cada tom mexe em coisas diferentes — e algumas em direções opostas. */
export function responderEntrevista(
  estado: EstadoCarreiraDeJogador,
  entrevistaId: string,
  tom: TomDaResposta,
): EstadoCarreiraDeJogador {
  const novo = structuredClone(estado)
  const efeitos: Record<TomDaResposta, { treinador: number; moral: number; reputacao: number; torcida: number }> = {
    respeitosa: { treinador: +4, moral: -2, reputacao: 0, torcida: +2 },
    ambiciosa: { treinador: -3, moral: +3, reputacao: +6, torcida: -1 },
    polemica: { treinador: -9, moral: +1, reputacao: +9, torcida: -6 },
  }
  const e = efeitos[tom]
  novo.notaDoTreinador = limitar(novo.notaDoTreinador + e.treinador)
  novo.moral = limitar(novo.moral + e.moral)
  novo.reputacao = moverReputacao(novo, e.reputacao)
  novo.torcida = Math.max(0, Math.min(100, (novo.torcida ?? 50) + e.torcida))
  novo.entrevistasRespondidas = [...(novo.entrevistasRespondidas ?? []), entrevistaId]

  const texto = tom === "respeitosa" ? "Resposta comedida. O treinador registrou."
    : tom === "ambiciosa" ? "Você se colocou. A imprensa gostou; o treinador, nem tanto."
      : "Declaração forte. Vai repercutir — e o treinador viu."
  novo.recados = [{
    id: `entrevista_resp_${entrevistaId}`, de: "Imprensa", texto,
    temporada: novo.temporada, rodada: novo.rodada,
  }, ...novo.recados].slice(0, 25)
  novo.repercussao = [gerarRepercussao(novo, tom), ...(novo.repercussao ?? [])].slice(0, 20)
  return novo
}

/**
 * A REPERCUSSÃO — as "redes sociais" do save.
 *
 * Gerada a partir do que aconteceu, nunca de texto aleatório: gol, convocação,
 * transferência, sequência no banco e declaração. É o que faz a carreira ter
 * eco fora do placar.
 */
export interface PostDeRepercussao {
  id: string
  autor: string
  texto: string
  temporada: number
}

/**
 * A IMPRENSA ESCREVE SOBRE VOCÊ (1.0.374) — e o que ela escreve depende de
 * como você a tratou.
 *
 * ─── POR QUE A IMPRENSA ERA RASA ────────────────────────────────────────────
 *
 * Até a 1.0.373 "imprensa" no modo de jogador era uma coisa só: um post gerado
 * quando você respondia a uma entrevista. Não havia jornal, não havia manchete
 * na semana em que nada foi perguntado, e — o que importa — o TOM nunca mudava.
 * O mesmo jogo com o mesmo placar rendia a mesma frase para quem cultivou a
 * imprensa por dez temporadas e para quem a hostilizou desde a estreia.
 *
 * ⚠️ E ISSO ESVAZIAVA A PRÓPRIA RELAÇÃO. `amplificacaoDaImprensa` já muda a
 * velocidade da reputação, mas isso é um número invisível: o jogador nunca via
 * a imprensa do lado dele nem contra ele. Um laço que só age num multiplicador
 * escondido é indistinguível de laço nenhum.
 *
 * Agora a MESMA atuação vira três manchetes diferentes conforme o nível:
 *
 *     imprensa ≥ 65   generosa — a boa é exaltada, a ruim é perdoada
 *     imprensa 35–64   neutra  — o placar, sem adjetivo
 *     imprensa < 35    hostil  — a boa é minimizada, a ruim é execução
 *
 * É a mesma regra dos outros laços: o efeito tem de aparecer onde o jogador
 * olha, senão é enfeite.
 */
export function manchetesDaRodada(
  estado: EstadoCarreiraDeJogador,
  d: { nota: number; gols: number; assistencias: number },
  adversario: string,
): PostDeRepercussao[] {
  const nivel = lerRelacoes(relacoesDoAtleta(estado)).imprensa
  const nome = estado.atleta.nome
  const bem = d.nota >= 7.2 || d.gols > 0
  const mal = d.nota < 5.8

  // Nada de manchete para uma atuação morna: jornal que noticia tudo não
  // noticia nada, e o feed viraria ruído semanal em vez de acontecimento.
  if (!bem && !mal) return []

  const generosa = nivel >= 65
  const hostil = nivel < 35

  const autor = generosa ? "Jornal do Esporte" : hostil ? "Tribuna Crítica" : "Boletim FC"

  const texto = bem
    ? generosa
      ? `${nome} decide de novo: nota ${d.nota.toFixed(1)} contra o ${adversario}. O nome do momento.`
      : hostil
        ? `${nome} vai bem contra o ${adversario}, mas o adversário facilitou. Falta provar em jogo grande.`
        : `${nome} fecha em ${d.nota.toFixed(1)} diante do ${adversario}.`
    : generosa
      ? `Dia difícil para ${nome} contra o ${adversario}. Acontece com quem sempre joga.`
      : hostil
        ? `${nome} some em campo contra o ${adversario}. Até quando a torcida vai pagar por isso?`
        : `${nome} não repete o rendimento contra o ${adversario}: nota ${d.nota.toFixed(1)}.`

  return [{
    id: `manchete_${estado.temporada}_${estado.rodada}`,
    autor,
    texto,
    temporada: estado.temporada,
  }]
}

function gerarRepercussao(estado: EstadoCarreiraDeJogador, tom: TomDaResposta): PostDeRepercussao {
  const nome = estado.atleta.nome
  const autor = tom === "polemica" ? "@torcedor_raiz" : tom === "ambiciosa" ? "@mercadoFC" : "@FutNews"
  const texto = tom === "polemica"
    ? `${nome} detonou a comissão técnica. Vestiário fervendo no ${estado.clubeNome}.`
    : tom === "ambiciosa"
      ? `${nome} admite que avalia propostas. Empresário já circula na Europa.`
      : `${nome} evita polêmica e diz que respeita a decisão do treinador.`
  return { id: `post_${estado.temporada}_${estado.rodada}_${tom}`, autor, texto, temporada: estado.temporada }
}

/**
 * FECHA A PARTIDA VIVIDA e devolve os números ao motor de carreira.
 *
 * ⚠️ Passa pelo MESMO caminho da partida simulada — estatística da temporada,
 * ações para a evolução orgânica, bônus por gol, forma, moral e a confiança
 * caminhando para o mérito. Se este fechamento tivesse contabilidade própria, a
 * carreira teria duas verdades: uma para quem joga os momentos e outra para
 * quem simula. É o mesmo princípio do co-op, onde metade do estado viajando foi
 * o que quebrou o modo.
 */
export function concluirPartidaDoAtleta(estado: EstadoCarreiraDeJogador): EstadoCarreiraDeJogador {
  let p = estado.partidaEmCurso
  if (!p || !partidaTerminou(p)) return estado
  const novo = structuredClone(estado)
  delete novo.partidaEmCurso
  novo.versao = 3
  novo.economia = structuredClone(economiaDoAtleta(novo))
  const lances = p.aoVivo?.lancesOferecidos ?? p.historico.length
  novo.economia.energia = Math.max(0, novo.economia.energia - Math.max(2, lances * 2))

  // O VESTIÁRIO TEMPERA A NOTA — o mesmo ajuste, no mesmo lugar lógico que o
  // caminho da partida simulada faz. Ver `aplicarPartidaNaCarreira`.
  //
  // ⚠️ A TORCIDA SÓ VALE PARA O CLUBE. Na partida de seleção o mando é do país
  // e a arquibancada é outra — somar aqui o apoio conquistado no clube daria
  // ao atleta uma torcida que não está no estádio (1.0.377).
  p = {
    ...p,
    nota: Math.max(3, Math.min(10, Math.round(
      (p.nota
        + ajusteDaNotaPeloVestiario(lerRelacoes(relacoesDoAtleta(novo)))
        + (p.origem === "selecao" ? 0 : empurraoDaTorcida(novo.torcida ?? 50, p.emCasa ? "casa" : "fora"))
      ) * 10,
    ) / 10)),
  }

  if (p.origem === "selecao") {
    novo.selecao.partidas = structuredClone(calendarioDaSelecao(novo))
    const compromisso = novo.selecao.partidas.find(j => j.id === p.fixtureId)
    if (compromisso) {
      compromisso.jogada = true
      compromisso.golsPro = p.golsPro
      compromisso.golsContra = p.golsContra
      compromisso.nota = p.nota
    }
    novo.selecao.jogos++
    novo.selecao.gols += p.gols
    novo.moral = limitar(novo.moral + (p.nota >= 7 ? 4 : p.nota < 6 ? -3 : 1))
    novo.reputacao = moverReputacao(novo, p.gols > 0 || p.nota >= 8 ? 2 : 0)
    if (p.gols > 0 && novo.patrocinioPessoal) {
      const bonus = p.gols * novo.patrocinioPessoal.bonusPorGol
      novo.economia.dinheiro += bonus
      novo.patrocinioPessoal.golsNoContrato += p.gols
    }
    // A carteira nova (1.0.377). O contrato antigo acima é migrado na primeira
    // chamada desta função, então os dois nunca pagam pelo mesmo gol.
    registrarPartidaNosPatrocinios(novo, p.gols)
    novo.recados = [{
      id: `resultado_selecao_${novo.temporada}_${p.fixtureId}`, de: "Selecao",
      texto: `${novo.atleta.nacionalidade} ${p.golsPro} x ${p.golsContra} ${p.adversario}. Sua nota: ${p.nota.toFixed(1)}.`,
      temporada: novo.temporada, rodada: novo.rodada,
    }, ...novo.recados].slice(0, 25)
    return novo
  }

  // ⚠️ NO MODO AO VIVO, o apito fecha o fixture e a tabela — não o início da
  // rodada. A partida não foi pré-simulada justamente para o placar poder nascer
  // do que o atleta fez; se a tabela não fosse atualizada aqui, o jogo dele
  // sumiria da classificação e a temporada nunca fecharia (`temporadaEncerrada`
  // olha para `!played`).
  if (p.aoVivo) {
    const fixture = novo.calendario.find(f => f.id === p.fixtureId)
    if (fixture && !fixture.played) {
      const casa = p.emCasa ? p.golsPro : p.golsContra
      const fora = p.emCasa ? p.golsContra : p.golsPro
      fixture.played = true
      fixture.homeGoals = casa
      fixture.awayGoals = fora
      novo.tabela = updateStandings(novo.tabela, fixture.homeCurto, fixture.awayCurto, casa, fora)
    }
  }

  const registro: PartidaDoAtleta = {
    temporada: novo.temporada, rodada: p.rodada, competicao: p.competicao,
    adversario: p.adversario, casa: p.emCasa, golsPro: p.golsPro, golsContra: p.golsContra,
    titular: p.titular, minutos: p.minutos, gols: p.gols, assistencias: p.assistencias,
    nota: p.nota, cartao: null,
  }
  novo.ultimasPartidas = [registro, ...novo.ultimasPartidas].slice(0, 12)

  const t = novo.temporadaAtual
  t.jogos++
  if (p.titular) t.titularidades++
  t.minutos += p.minutos
  t.gols += p.gols
  t.assistencias += p.assistencias
  t.somaDasNotas += p.nota

  if (p.gols > 0) novo.ganhosDaTemporada += p.gols * (novo.contrato.bonusPorGol ?? 0)
  if (p.gols > 0 && novo.patrocinioPessoal) {
    const bonusDaMarca = p.gols * novo.patrocinioPessoal.bonusPorGol
    novo.economia.dinheiro += bonusDaMarca
    novo.patrocinioPessoal.golsNoContrato += p.gols
    novo.ganhosDaTemporada += bonusDaMarca
    novo.relacoes = structuredClone(relacoesDoAtleta(novo))
    novo.relacoes.marcas = limitar(novo.relacoes.marcas + Math.min(3, p.gols))
  }
  registrarPartidaNosPatrocinios(novo, p.gols)
  registrarAcoes(novo, {
    titular: p.titular, minutos: p.minutos, gols: p.gols,
    assistencias: p.assistencias, nota: p.nota, cartao: null, xp: 0,
  }, `${novo.atleta.id}:${novo.temporada}:${p.rodada}:acoes`)

  novo.notaDoTreinador = limitar(novo.notaDoTreinador + (p.nota - 6.6) * 2.4 + p.gols * 1.5)
  novo.forma = limitar(novo.forma * 0.72 + p.nota * 8.4)
  novo.moral = limitar(novo.moral + (p.nota >= 7 ? 3 : p.nota >= 6 ? 0 : -3)
    + (p.golsPro > p.golsContra ? 2 : p.golsPro === p.golsContra ? 0 : -2))
  // O VESTIÁRIO E O RIVAL RESPONDEM À ATUAÇÃO — o mesmo que o caminho da
  // partida simulada faz. Deixar de fora daqui criaria uma carreira em que
  // jogar ao vivo move o grupo e jogar simulado não, sem que nada explique
  // a diferença ao jogador.
  novo.relacoes = {
    ...relacoesDoAtleta(novo),
    ...lerRelacoes(relacoesDoAtleta(novo)),
    elenco: limitar(relacoesDoAtleta(novo).elenco + (p.nota >= 7.2 ? 1.8 : p.nota >= 6 ? 0.4 : -1.4)),
  }
  novo.companheiros = moverCompanheiro(
    lerCompanheiros(novo.companheiros, novo.clubeCurto, String(novo.atleta.posicao)),
    "rival", p.nota >= 7.2 ? -1.2 : p.nota < 6 ? 1 : 0,
  )
  aplicarXP(novo, Math.round(p.minutos * 0.55 + p.gols * 45 + p.assistencias * 25 + Math.max(0, p.nota - 6.5) * 30))

  // ⚠️ O CONCORRENTE DESLOCA O ALVO, NÃO SANGRA A NOTA (corrigido na 1.0.374).
  //
  // A primeira versão fazia `notaDoTreinador + pressaoDoRival(time)` DEPOIS da
  // convergência — ou seja, tirava até 7 pontos A CADA PARTIDA, enquanto o
  // mérito só recupera 12% da distância por rodada. O saldo era negativo toda
  // semana e a nota afundava sozinha: medido, um meia de 24 anos saiu de 22,4
  // no fim da primeira temporada para 5,7 na segunda, jogando 95 minutos no ano
  // inteiro. Nada acusava — nem tipo, nem lint, nem os testes das relações, que
  // conferiam o SINAL do efeito e não o acúmulo dele.
  //
  // Quem pegou foi o gate de lesões (`test-modalidades-ponta-a-ponta`), e por
  // um caminho indireto: um atleta que não entra em campo não se machuca, e
  // "seis temporadas sem uma única lesão" era o sintoma de um problema que não
  // tinha nada a ver com lesão.
  //
  // Aqui a pressão entra no ALVO. A confiança passa a convergir para um patamar
  // um pouco mais baixo — que é o que "ter um concorrente em forma" significa —
  // em vez de cair sem fundo.
  const merecida = confiancaMerecida(novo) + pressaoDoRival(
    lerCompanheiros(novo.companheiros, novo.clubeCurto, String(novo.atleta.posicao)),
  )
  novo.notaDoTreinador = limitar(Math.max(
    merecida - 22,
    Math.min(merecida + 22, novo.notaDoTreinador + (merecida - novo.notaDoTreinador) * 0.12),
  ))

  // ── O PISO DO TREINADOR, DEPOIS DO MÉRITO (1.0.374) ──────────────────────
  //
  // ⚠️ PISO, E SÓ PISO. Ele levanta por baixo do resultado e nunca soma por
  // cima: quem tem o técnico do lado não despenca para "fora dos planos" por
  // duas partidas ruins, mas também não vira titular sem jogar. Aplicar a
  // relação ANTES do mérito faria dela um atalho, e o sistema de confiança que
  // a 1.0.373 calibrou perderia o sentido.
  //
  // O concorrente NÃO entra aqui — ele desloca o alvo lá em cima, junto com o
  // mérito. Ver a nota daquele bloco: aplicá-lo neste ponto foi o defeito que
  // afundou a confiança em duas temporadas.
  {
    const relacoesAgora = lerRelacoes(relacoesDoAtleta(novo))
    novo.relacoes = { ...relacoesDoAtleta(novo), ...relacoesAgora }
    novo.companheiros = lerCompanheiros(novo.companheiros, novo.clubeCurto, String(novo.atleta.posicao))
    novo.notaDoTreinador = limitar(Math.max(
      pisoDaNotaDoTreinador(relacoesAgora),
      novo.notaDoTreinador,
    ))
  }
  atualizarMetas(novo)
  liquidarAposta(novo, p.golsPro, p.golsContra)

  if (p.gols >= 2 || p.nota >= 8.5) {
    novo.reputacao = moverReputacao(novo, p.gols >= 2 ? 3 : 2)
    novo.repercussao = [{
      id: `post_${novo.temporada}_${p.rodada}`,
      autor: "@FutNews",
      texto: p.gols >= 2
        ? `${novo.atleta.nome} decide de novo: ${p.gols} gols contra o ${p.adversario}.`
        : `Nota ${p.nota.toFixed(1)} para ${novo.atleta.nome} no jogo contra o ${p.adversario}.`,
      temporada: novo.temporada,
    }, ...(novo.repercussao ?? [])].slice(0, 20)
  }

  if (!novo.calendario.some(f => !f.played)) novo.temporadaEncerrada = true
  return novo
}

/** Média da temporada corrente — a tela mostra em três lugares. */
export function mediaDaTemporada(estado: EstadoCarreiraDeJogador): number {
  const t = estado.temporadaAtual
  return t.jogos > 0 ? Math.round((t.somaDasNotas / t.jogos) * 100) / 100 : 0
}

// ─── SEM CLUBE: RESCISÃO, MERCADO E CONTRAPROPOSTA (1.0.358) ────────────────
//
// ⚠️ O PEDIDO, NA LETRA: "a funcionalidade de pedir demissão no modo carreira
// de jogador deve ser como na vida real: o jogador fica sem time até receber
// propostas de times superiores ou inferiores — vai depender do desempenho dele
// no clube anterior —, onde o jogador/agente farão contraproposta até fechar o
// contrato ou não."
//
// São quatro coisas, e nenhuma existia:
//   1. FICAR SEM TIME é um estado do save, não uma tela de saída. Antes o botão
//      do cabeçalho limpava `selectedTeamShort` e mandava o atleta para a Área
//      do Treinador — a tela de quem DIRIGE clube. Ver `rescindirContrato`.
//   2. O TEMPO PASSA sem partida: semana a semana, e é o relógio que traz (e
//      leva) proposta. Ver `avancarSemanaSemClube`.
//   3. O NÍVEL DE QUEM LIGA sai do desempenho no clube anterior — o CARTAZ. Sem
//      isso "superiores ou inferiores" seria sorteio. Ver `cartazDeMercado`.
//   4. NEGOCIAR É CONVERSA, não um botão de aceitar: o agente pede mais e o
//      clube responde, com paciência finita. Ver `contrapropor`.
//
// Nada aqui inventa um segundo mercado: as propostas são as mesmas
// `PropostaDeClube` que o fim de temporada já produz, e quem assina passa pelo
// MESMO `aceitarProposta`. Dois caminhos para assinar contrato discordariam na
// primeira mudança de regra.

/** Faixa de prestígio que o cartaz alcança. É o "superiores ou inferiores". */
function alvoDePrestigio(cartaz: number): { min: number; max: number } {
  const centro = 34 + cartaz * 0.58
  return { min: Math.max(0, centro - 20), max: centro + 9 }
}

/**
 * O CARTAZ (0–100): o que o desempenho no clube anterior comprou no mercado.
 *
 * Lê a temporada em curso quando ela teve jogos e cai no último ano fechado
 * quando não teve — quem rescinde na pré-temporada é julgado pelo ano passado,
 * que é o que um diretor faria.
 */
export function cartazDeMercado(estado: EstadoCarreiraDeJogador): number {
  const t = estado.temporadaAtual
  const ultima = estado.historico[estado.historico.length - 1]
  const usaAtual = t.jogos >= 4 || !ultima
  const jogos = usaAtual ? t.jogos : ultima.jogos
  const nota = usaAtual ? mediaDaTemporada(estado) : ultima.notaMedia
  const gols = usaAtual ? t.gols : ultima.gols
  const assistencias = usaAtual ? t.assistencias : ultima.assistencias
  const participacoes = gols + assistencias * 0.6

  const bruto =
    (estado.atleta.overall - 54) * 1.55
    + (nota > 0 ? (nota - 6.2) * 9 : -6)
    + Math.min(20, participacoes * 1.1)
    + Math.min(8, jogos * 0.28)
    + ((estado.reputacao ?? 30) - 30) * 0.35
    + (estado.empresario.influencia - 10) * 1.1
    + estado.titulos.length * 1.5
    + (estado.capitao ? 3 : 0)
    // Quem estava fora dos planos chega ao mercado com menos cartaz — é a
    // mesma leitura que o resto do modo faz da nota do treinador.
    + (papelNoElenco(estado.notaDoTreinador) === "fora dos planos" ? -8 : 0)
    // A FERRUGEM: cada semana parado é uma semana fora do radar.
    - Math.max(0, (estado.semClube?.semanas ?? 0) - 1) * 1.8

  return Math.max(0, Math.min(100, Math.round(bruto)))
}

/**
 * RESCINDIR. O atleta deixa o clube e vira agente livre.
 *
 * O calendário e a tabela do clube antigo FICAM no estado de propósito: são a
 * temporada que o mundo continua jogando sem ele, e é o que a tela de mercado
 * mostra enquanto ele espera. Quem assinar em outro lugar recebe calendário
 * novo em `aceitarProposta`, como qualquer transferência.
 */
export function rescindirContrato(
  estado: EstadoCarreiraDeJogador,
  motivo = "Rescisão pedida pelo atleta",
): EstadoCarreiraDeJogador {
  if (estado.aposentado || estado.semClube) return estado
  const novo = structuredClone(estado)

  novo.semClube = {
    desdeTemporada: novo.temporada,
    desdeRodada: novo.rodada,
    semanas: 0,
    motivo,
    ultimoClubeNome: novo.clubeNome,
    ultimoClubeCurto: novo.clubeCurto,
    ultimoClubeFileKey: novo.clubeFileKey,
    cartaz: 0,
    diario: [],
  }
  novo.semClube.cartaz = cartazDeMercado(novo)
  novo.semClube.diario = [{
    semana: 0,
    texto: novo.semClube.cartaz >= 62
      ? `Você rescindiu com o ${novo.clubeNome}. Seu agente diz que o telefone não vai demorar.`
      : novo.semClube.cartaz >= 38
        ? `Você rescindiu com o ${novo.clubeNome}. O mercado sabe quem você é, mas ninguém corre.`
        : `Você rescindiu com o ${novo.clubeNome}. O agente foi honesto: vai ser um mercado difícil.`,
  }]

  // Sem clube não há salário, não há confiança de treinador e não há pedido em
  // aberto. Propostas do fim de temporada morrem junto: aquelas eram para quem
  // tinha contrato, e o mercado agora é outro.
  novo.contrato = { ...novo.contrato, salarioSemanal: 0, ateTemporada: novo.temporada }
  novo.notaDoTreinador = 0
  novo.pedido = "nenhum"
  novo.propostas = []
  novo.partidaEmCurso = undefined
  novo.capitao = false
  novo.moral = limitar(novo.moral - 8)
  novo.recados = [{
    id: `rescisao_${novo.temporada}_${novo.rodada}`,
    de: "Agente",
    texto: `Rescisão assinada com o ${novo.clubeNome}. A partir de agora você está livre no mercado — e quem liga depende do que você fez lá dentro.`,
    temporada: novo.temporada,
    rodada: novo.rodada,
  }, ...novo.recados].slice(0, 25)
  return novo
}

/** Quantos clubes ligam nesta semana, dado o cartaz e o alcance do agente. */
function quantasLigamNaSemana(cartaz: number, estado: EstadoCarreiraDeJogador, semana: number): number {
  const base = cartaz >= 70 ? 2 : cartaz >= 45 ? 1 : 0
  const sorte = roll(`${estado.atleta.id}:mercado:${semana}`)
  const extra = sorte < (0.12 + (estado.empresario.influencia - 10) * 0.02 + cartaz / 500) ? 1 : 0
  return Math.min(3, base + extra)
}

const ESCADA_DE_STATUS: PapelNoElenco[] = ["fora dos planos", "reserva", "rodízio", "titular", "titular absoluto"]

/** Sobe um degrau na promessa do clube; no topo, devolve o topo. */
function statusAcima(status: PapelNoElenco): PapelNoElenco {
  const i = ESCADA_DE_STATUS.indexOf(status)
  return ESCADA_DE_STATUS[Math.min(ESCADA_DE_STATUS.length - 1, i + 1)]
}

/** As propostas que chegam numa semana de mercado. */
function propostasDaSemana(estado: EstadoCarreiraDeJogador, semana: number): PropostaDeClube[] {
  const semClube = estado.semClube
  if (!semClube) return []
  // ⚠️ O PISO DO MERCADO. Sem ele, cartaz baixo dava ZERO proposta para sempre e
  // a carreira virava beco sem saída — o mesmo defeito que o "fora dos planos"
  // já teve neste modo. Na vida real sempre aparece um clube MENOR: depois de
  // três semanas em silêncio e com a mesa vazia, um liga. É a metade
  // "inferiores" do pedido do usuário.
  const piso = semana >= 3 && estado.propostas.length === 0
  const quantas = Math.max(quantasLigamNaSemana(semClube.cartaz, estado, semana), piso ? 1 : 0)
  if (quantas === 0) return []

  // Quem chega pelo piso não escolhe: a faixa desce ao chão do mercado.
  const faixa = piso && semClube.cartaz < 30
    ? { min: 0, max: Math.max(45, alvoDePrestigio(semClube.cartaz).max) }
    : alvoDePrestigio(semClube.cartaz)
  const doExterior = estado.empresario.redeInternacional >= 12
  const jaNaMesa = new Set(estado.propostas.map(p => p.clubeFileKey))

  const candidatos = completarLigaComPool(estado.divisao)
    .concat(doExterior ? ligasVizinhas(estado) : [])
    // O clube que ele acabou de deixar não liga na semana seguinte.
    .filter(c => c.file_key !== semClube.ultimoClubeFileKey && !jaNaMesa.has(c.file_key))
    .filter(c => c.prestigio >= faixa.min && c.prestigio <= faixa.max)
    // Ordem estável e semeada: o mesmo save oferece os mesmos clubes.
    .sort((a, b) => roll(`${estado.atleta.id}:${semana}:${a.file_key}`) - roll(`${estado.atleta.id}:${semana}:${b.file_key}`))
    .slice(0, quantas)

  const agente = estado.empresario
  const talento = 1 + (agente.negociacao - 10) * 0.035
  // A base salarial é o que o atleta VALE, não o que ele ganhava: quem
  // rescindiu está com salário zero e não pode partir de zero.
  const referencia = Math.max(2_000, Math.round(estado.atleta.overall ** 2 * 1.6))

  return candidatos.map((clube, i) => {
    const acima = clube.prestigio > estado.atleta.overall
    const salario = Math.round(referencia * (0.75 + clube.prestigio / 130 + i * 0.06) * talento)
    const status: PapelNoElenco = acima ? "rodízio"
      : clube.prestigio >= estado.atleta.overall - 6 ? "titular"
        : "titular absoluto"
    return {
      id: `livre_${estado.temporada}_${semana}_${clube.file_key}`,
      clubeCurto: clube.curto,
      clubeNome: clube.nome,
      clubeFileKey: clube.file_key,
      divisao: String(clube.divisao),
      ligaNome: String(clube.divisao),
      prestigio: clube.prestigio,
      salarioSemanal: salario,
      temporadas: acima ? 3 : 2,
      luvas: Math.round(salario * (acima ? 6 : 10) * talento),
      bonusPorGol: Math.round(salario * 0.16),
      bonusPorTitulo: Math.round(salario * 6),
      statusPrometido: status,
      motivo: acima
        ? `Degrau acima: o ${clube.nome} te quer na disputa, sem vaga garantida.`
        : status === "titular"
          ? `O ${clube.nome} te vê no time titular desde a estreia.`
          : `Projeto em volta de você: o ${clube.nome} promete a camisa.`,
      negociacao: {
        // Agente bom aguenta mais conversa antes de o clube cansar.
        paciencia: 2 + Math.round(Math.max(0, agente.negociacao - 8) / 5),
        rodadas: 0,
      },
      semanaDeChegada: semana,
      validadeEmSemanas: acima ? 3 : 4,
    }
  })
}

/**
 * UMA SEMANA DE MERCADO.
 *
 * O relógio deste estado. Traz proposta nova, vence a que ficou parada demais e
 * desgasta o cartaz de quem não joga. Sem clube não há rodada: é este avanço
 * que faz o tempo passar.
 */
export function avancarSemanaSemClube(estado: EstadoCarreiraDeJogador): EstadoCarreiraDeJogador {
  if (!estado.semClube || estado.aposentado) return estado
  const novo = structuredClone(estado)
  const semClube = novo.semClube!
  semClube.semanas += 1
  const semana = semClube.semanas

  // O cartaz é recalculado a cada semana porque a ferrugem entra nele.
  semClube.cartaz = cartazDeMercado(novo)

  // Fora de ritmo: quem não treina com grupo perde forma. Piso em 45 — ele
  // continua se cuidando por conta, e um atleta sem clube não vira sedentário.
  novo.forma = Math.max(45, novo.forma - 2.5)

  // VENCIMENTO. Proposta parada sai da mesa — inclusive a que o agente estava
  // esticando: é o preço de negociar demais.
  const vencidas = novo.propostas.filter(p =>
    semana - (p.semanaDeChegada ?? 0) >= (p.validadeEmSemanas ?? 4) || p.negociacao?.retirada,
  )
  novo.propostas = novo.propostas.filter(p => !vencidas.includes(p))

  const novas = propostasDaSemana(novo, semana)
  novo.propostas = [...novo.propostas, ...novas]

  const linhas: string[] = []
  for (const p of vencidas) {
    linhas.push(p.negociacao?.retirada
      ? `O ${p.clubeNome} saiu da mesa.`
      : `O ${p.clubeNome} cansou de esperar e tirou a proposta.`)
  }
  for (const p of novas) {
    linhas.push(`${p.clubeNome} (prestígio ${p.prestigio}) fez proposta: ${Math.round(p.salarioSemanal).toLocaleString("pt-BR")}/semana, ${p.temporadas} temporadas, promessa de ${p.statusPrometido}.`)
  }
  if (linhas.length === 0) {
    linhas.push(semClube.cartaz >= 55
      ? "Semana sem novidade. O agente diz que tem conversa em andamento."
      : semana >= 8
        ? "Mais uma semana em silêncio. Quanto mais tempo parado, menor o cartaz."
        : "Nenhum clube ligou nesta semana.")
  }
  semClube.diario = [{ semana, texto: linhas.join(" ") }, ...semClube.diario].slice(0, 30)

  if (novas.length > 0) {
    novo.recados = [{
      id: `mercado_${novo.temporada}_${semana}`,
      de: "Agente",
      texto: novas.length === 1
        ? `Chegou proposta do ${novas[0].clubeNome}.`
        : `Chegaram ${novas.length} propostas. Vamos escolher com calma.`,
      temporada: novo.temporada,
      rodada: novo.rodada,
    }, ...novo.recados].slice(0, 25)
  }
  return novo
}

/** O que o agente diz na mesa, por tipo de pedido. */
const FALA_DO_PEDIDO: Record<PedidoDaNegociacao, string> = {
  salario: "Meu jogador vale mais por semana do que isso.",
  luvas: "As luvas precisam melhorar para ele assinar hoje.",
  status: "Ele não sai do clube dele para brigar por vaga. Queremos a camisa.",
  temporadas: "Queremos contrato mais longo — ele quer construir algo aí.",
}

/**
 * CONTRAPROPOR. O agente pede mais; o clube responde.
 *
 * ⚠️ A CONVERSA TEM PREÇO. Cada pedido gasta uma paciência que começa pequena
 * (e cresce com a habilidade de negociação do agente). Pedir salário, luvas,
 * status e temporadas na mesma mesa é o caminho mais curto para ficar sem
 * proposta nenhuma — que é o "ou não" do pedido do usuário.
 *
 * O resultado é semeado por (atleta, proposta, rodada da conversa): reabrir o
 * save não muda a resposta do clube.
 */
export function contrapropor(
  estado: EstadoCarreiraDeJogador,
  propostaId: string,
  pedido: PedidoDaNegociacao,
): EstadoCarreiraDeJogador {
  const alvo = estado.propostas.find(p => p.id === propostaId)
  if (!alvo || alvo.negociacao?.retirada) return estado

  const novo = structuredClone(estado)
  const proposta = novo.propostas.find(p => p.id === propostaId)!
  const mesa: NegociacaoDaProposta = proposta.negociacao ?? { paciencia: 2, rodadas: 0 }
  mesa.rodadas += 1
  mesa.paciencia -= 1

  const cartaz = novo.semClube?.cartaz ?? cartazDeMercado(novo)
  const chance =
    0.30
    + (novo.empresario.negociacao - 10) * 0.030
    + (cartaz - 50) * 0.004
    - (mesa.rodadas - 1) * 0.14
    // Pedir a camisa a um clube grande é mais difícil que pedir dinheiro.
    - (pedido === "status" && proposta.prestigio > novo.atleta.overall ? 0.12 : 0)
  const sorte = roll(`${novo.atleta.id}:mesa:${propostaId}:${mesa.rodadas}:${pedido}`)

  if (sorte < Math.max(0.05, chance)) {
    if (pedido === "salario") {
      // ⚠️ A TORCIDA ENTRA AQUI (1.0.377): 0,85 a 1,20 sobre o aumento. Um ídolo
      // de arquibancada arranca mais na mesa porque o clube que o compra compra
      // também a bilheteria dele — e o vaiado arranca menos pelo motivo oposto.
      // É o segundo (e último) lugar do jogo que lê `estado.torcida`; ver a
      // seção A TORCIDA em `lib/relacoes-do-atleta`.
      const comAArquibancada = 1 + 0.14 * pesoDaTorcidaNaRenovacao(novo.torcida ?? 50)
      proposta.salarioSemanal = Math.round(proposta.salarioSemanal * comAArquibancada)
      mesa.ultimaResposta = `O ${proposta.clubeNome} aceitou: salário para ${Math.round(proposta.salarioSemanal).toLocaleString("pt-BR")}/semana.`
    } else if (pedido === "luvas") {
      proposta.luvas = Math.round((proposta.luvas || proposta.salarioSemanal * 4) * 1.3)
      mesa.ultimaResposta = `O ${proposta.clubeNome} melhorou as luvas para ${Math.round(proposta.luvas).toLocaleString("pt-BR")}.`
    } else if (pedido === "temporadas") {
      proposta.temporadas += 1
      mesa.ultimaResposta = `O ${proposta.clubeNome} estendeu para ${proposta.temporadas} temporadas.`
    } else {
      proposta.statusPrometido = statusAcima(proposta.statusPrometido)
      mesa.ultimaResposta = `O ${proposta.clubeNome} prometeu: ${proposta.statusPrometido}.`
    }
  } else if (mesa.paciencia > 0) {
    mesa.ultimaResposta = `O ${proposta.clubeNome} ouviu e manteve a proposta como está.`
  } else {
    mesa.retirada = true
    mesa.ultimaResposta = `O ${proposta.clubeNome} encerrou a conversa e retirou a proposta.`
  }

  proposta.negociacao = mesa
  if (novo.semClube) {
    novo.semClube.diario = [{
      semana: novo.semClube.semanas,
      texto: `Agente ao ${proposta.clubeNome}: “${FALA_DO_PEDIDO[pedido]}” — ${mesa.ultimaResposta}`,
    }, ...novo.semClube.diario].slice(0, 30)
  }
  return novo
}

/** Recusa UMA proposta. As outras seguem na mesa — e o relógio, correndo. */
export function descartarProposta(estado: EstadoCarreiraDeJogador, propostaId: string): EstadoCarreiraDeJogador {
  const alvo = estado.propostas.find(p => p.id === propostaId)
  if (!alvo) return estado
  const novo = structuredClone(estado)
  novo.propostas = novo.propostas.filter(p => p.id !== propostaId)
  if (novo.semClube) {
    novo.semClube.diario = [{
      semana: novo.semClube.semanas,
      texto: `Você recusou o ${alvo.clubeNome}.`,
    }, ...novo.semClube.diario].slice(0, 30)
  }
  return novo
}
