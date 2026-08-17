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
import type { MatchFixture, StandingEntry } from "@/lib/career-types"
import { simulateFullMatch } from "@/lib/match-engine"
import { completarLigaComPool, getTeamByFileKey, type Team } from "@/lib/teams-data"
// O elenco REAL do clube — é dele que sai a fila da posição (ver
// `hierarquiaDaPosicao`). Sem isto a disputa seria contra um número inventado.
import { getPlayersForTeam } from "@/lib/players-data"
import { montarPartidaDoAtleta, partidaTerminou, type PartidaEmCurso } from "@/lib/partida-do-atleta"

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
  posicao: PosicaoDoAtleta
  idade: number
  nacionalidade: string
  pePreferido: "direito" | "esquerdo"
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
  versao: 1
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
  repercussao?: PostDeRepercussao[]
  /** Partida sendo VIVIDA momento a momento (1.0.329). */
  partidaEmCurso?: PartidaEmCurso
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
  /** O que ele fez em campo nesta temporada. */
  acoes: AcoesDaTemporada
  /** Ganho de atributo da última virada de temporada, para a tela mostrar. */
  ultimaEvolucao: { atributo: keyof AtributosDoAtleta; ganho: number }[]
  selecao: { convocada: boolean; nivel: "sub20" | "principal" | null; jogos: number; gols: number }
  historico: TemporadaDoAtleta[]
  propostas: PropostaDeClube[]
  /** Pedido feito ao clube; some quando respondido no fim da temporada. */
  pedido: "nenhum" | "transferencia" | "mais_minutos" | "renovacao"
  titulos: string[]
  premios: string[]
  temporadaEncerrada: boolean
  aposentado: boolean
  /** Mensagens curtas do treinador/agente, a caixa de entrada do atleta. */
  recados: { id: string; de: string; texto: string; temporada: number; rodada: number }[]
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
    reputacao: 30,
    torcida: 50,
    entrevistasRespondidas: [],
    repercussao: [],
    // Provisória: logo abaixo é substituída pela confiança MERECIDA, que depende
    // do elenco do clube e por isso precisa do estado já montado.
    notaDoTreinador: 40,
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
  const bruta = 6 + gols * 1.05 + assistencias * 0.65 + resultado + defensiva
    + qualidade * 1.8 + (estado.forma - 50) / 160 + (r(40) - 0.5) * 1.1
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
export function jogarProximaRodada(
  estado: EstadoCarreiraDeJogador,
  opcoes?: { viver?: boolean },
): EstadoCarreiraDeJogador {
  if (estado.aposentado || estado.temporadaEncerrada) return estado
  const proxima = estado.calendario.find(f => !f.played)
  if (!proxima) return { ...estado, temporadaEncerrada: true }

  const novo: EstadoCarreiraDeJogador = structuredClone(estado)
  const rodada = proxima.round
  const daRodada = novo.calendario.filter(f => f.round === rodada && !f.played)
  // Os clubes da liga são resolvidos UMA vez por rodada. Resolver por partida
  // chamava `completarLigaComPool` dezenas de vezes na mesma rodada — é o tipo
  // de O(n²) que travou o apito na 1.0.300.
  const clubes = new Map(clubesDaLiga(novo).map(t => [t.curto, t]))

  for (const fixture of daRodada) {
    const mandante = clubes.get(fixture.homeCurto) ?? clubeDeReserva(novo, fixture.homeCurto)
    const visitante = clubes.get(fixture.awayCurto) ?? clubeDeReserva(novo, fixture.awayCurto)
    const partida = simulateFullMatch({
      homeTeam: mandante,
      awayTeam: visitante,
      homeRating: forcaDoTime(mandante),
      awayRating: forcaDoTime(visitante),
      durationMinutes: 90,
    })
    fixture.played = true
    fixture.homeGoals = partida.home.goals
    fixture.awayGoals = partida.away.goals
    novo.tabela = updateStandings(novo.tabela, fixture.homeCurto, fixture.awayCurto, partida.home.goals, partida.away.goals)

    if (!fixture.isUserMatch) continue

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

    const registro: PartidaDoAtleta = {
      temporada: novo.temporada, rodada, competicao: fixture.competition,
      adversario, casa: emCasa, golsPro, golsContra,
      titular: d.titular, minutos: d.minutos, gols: d.gols, assistencias: d.assistencias,
      nota: d.nota, cartao: d.cartao,
    }
    novo.ultimasPartidas = [registro, ...novo.ultimasPartidas].slice(0, 12)

    if (d.minutos > 0) {
      novo.temporadaAtual.jogos++
      if (d.titular) novo.temporadaAtual.titularidades++
      novo.temporadaAtual.minutos += d.minutos
      novo.temporadaAtual.gols += d.gols
      novo.temporadaAtual.assistencias += d.assistencias
      novo.temporadaAtual.somaDasNotas += d.nota
      if (d.cartao === "amarelo") novo.temporadaAtual.cartoesAmarelos++
      if (d.cartao === "vermelho") novo.temporadaAtual.cartoesVermelhos++
      registrarAcoes(novo, d, `${novo.atleta.id}:${novo.temporada}:${rodada}:acoes`)
      // BÔNUS POR GOL vira dinheiro na hora — é o que faz o contrato ser uma
      // decisão e não um enfeite na tela de proposta.
      if (d.gols > 0) novo.ganhosDaTemporada += d.gols * (novo.contrato.bonusPorGol ?? 0)
      // REPERCUSSÃO automática: o mundo comenta o que aconteceu. Dois gols ou
      // uma nota alta viram post; reputação sobe junto, e é ela que faz clube
      // grande acordar (ver `gerarPropostas`).
      if (d.gols >= 2 || d.nota >= 8.5) {
        novo.reputacao = Math.min(100, (novo.reputacao ?? 30) + (d.gols >= 2 ? 3 : 2))
        novo.torcida = Math.min(100, (novo.torcida ?? 50) + 2)
        novo.repercussao = [{
          id: `post_${novo.temporada}_${rodada}`,
          autor: "@FutNews",
          texto: d.gols >= 2
            ? `${novo.atleta.nome} decide de novo: ${d.gols} gols contra o ${adversario}.`
            : `Nota ${d.nota.toFixed(1)} para ${novo.atleta.nome} no jogo contra o ${adversario}.`,
          temporada: novo.temporada,
        }, ...(novo.repercussao ?? [])].slice(0, 20)
      }
      // A nota do treinador se move DEVAGAR: uma partida ruim não tira o
      // titular, e uma boa não faz o reserva virar camisa 10 na semana seguinte.
      novo.notaDoTreinador = limitar(novo.notaDoTreinador + (d.nota - 6.6) * 2.4 + d.gols * 1.5)
      novo.forma = limitar(novo.forma * 0.72 + d.nota * 8.4)
      novo.moral = limitar(novo.moral + (d.nota >= 7 ? 3 : d.nota >= 6 ? 0 : -3) + (golsPro > golsContra ? 2 : golsPro === golsContra ? 0 : -2))
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
    const merecida = confiancaMerecida(novo)
    novo.notaDoTreinador = limitar(Math.max(
      merecida - 22,
      Math.min(merecida + 22, novo.notaDoTreinador + (merecida - novo.notaDoTreinador) * 0.12),
    ))
    aplicarXP(novo, d.xp)
    atualizarMetas(novo)
  }

  novo.rodada = rodada
  novo.tabela = sortStandings(novo.tabela)
  if (!novo.calendario.some(f => !f.played)) novo.temporadaEncerrada = true
  return novo
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

  const quantas = Math.max(1, Math.min(4, Math.round(1 + (agente.influencia - 8) / 4)))
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
    novo.selecao.jogos += 4 + Math.floor(roll(`${novo.atleta.id}:selecao:${novo.temporada}`) * 6)
    novo.selecao.gols += novo.atleta.posicao === "ATA" || novo.atleta.posicao === "MEI"
      ? Math.floor(roll(`${novo.atleta.id}:selgols:${novo.temporada}`) * 4) : 0
    novo.recados = [{
      id: `selecao_${novo.temporada}`, de: "Seleção",
      texto: `Você foi convocado para a seleção ${novo.selecao.nivel === "sub20" ? "Sub-20" : "principal"} de ${novo.atleta.nacionalidade}.`,
      temporada: novo.temporada, rodada: novo.rodada,
    }, ...novo.recados].slice(0, 25)
  }

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
    novo.recados = [{
      id: `aposentadoria_${novo.temporada}`, de: "Agente",
      texto: `Fim de linha: ${novo.historico.reduce((n, h) => n + h.jogos, 0)} jogos, ${novo.historico.reduce((n, h) => n + h.gols, 0)} gols e ${novo.titulos.length} títulos. Obrigado por tudo.`,
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
  novo.metas = metasIniciais(novo.atleta, clube?.prestigio ?? 60, novo.calendario.filter(f => f.isUserMatch).length)
  novo.temporadaEncerrada = false
  novo.contrato.ateTemporada = Math.max(novo.contrato.ateTemporada, novo.temporada)
  return novo
}

/** Aceita uma proposta: troca de clube, calendário novo e nota do treinador zerada. */
export function aceitarProposta(estado: EstadoCarreiraDeJogador, propostaId: string): EstadoCarreiraDeJogador {
  const proposta = estado.propostas.find(p => p.id === propostaId)
  if (!proposta) return estado
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
  novo.reputacao = Math.max(0, Math.min(100, (novo.reputacao ?? 30) + e.reputacao))
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
  const p = estado.partidaEmCurso
  if (!p || !partidaTerminou(p)) return estado
  const novo = structuredClone(estado)
  delete novo.partidaEmCurso

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
  registrarAcoes(novo, {
    titular: p.titular, minutos: p.minutos, gols: p.gols,
    assistencias: p.assistencias, nota: p.nota, cartao: null, xp: 0,
  }, `${novo.atleta.id}:${novo.temporada}:${p.rodada}:acoes`)

  novo.notaDoTreinador = limitar(novo.notaDoTreinador + (p.nota - 6.6) * 2.4 + p.gols * 1.5)
  novo.forma = limitar(novo.forma * 0.72 + p.nota * 8.4)
  novo.moral = limitar(novo.moral + (p.nota >= 7 ? 3 : p.nota >= 6 ? 0 : -3)
    + (p.golsPro > p.golsContra ? 2 : p.golsPro === p.golsContra ? 0 : -2))
  aplicarXP(novo, Math.round(p.minutos * 0.55 + p.gols * 45 + p.assistencias * 25 + Math.max(0, p.nota - 6.5) * 30))

  const merecida = confiancaMerecida(novo)
  novo.notaDoTreinador = limitar(Math.max(
    merecida - 22,
    Math.min(merecida + 22, novo.notaDoTreinador + (merecida - novo.notaDoTreinador) * 0.12),
  ))
  atualizarMetas(novo)

  if (p.gols >= 2 || p.nota >= 8.5) {
    novo.reputacao = Math.min(100, (novo.reputacao ?? 30) + (p.gols >= 2 ? 3 : 2))
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
