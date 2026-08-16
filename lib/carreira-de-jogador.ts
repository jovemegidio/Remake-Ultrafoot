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
  contrato: { salarioSemanal: number; ateTemporada: number; valorDePasse: number }
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
    contrato: { salarioSemanal: salario, ateTemporada: temporada + 2, valorDePasse: Math.max(200_000, atleta.overall ** 3 * 12) },
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
export function jogarProximaRodada(estado: EstadoCarreiraDeJogador): EstadoCarreiraDeJogador {
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

function gerarPropostas(estado: EstadoCarreiraDeJogador, media: number): PropostaDeClube[] {
  const { atleta } = estado
  const interesse = atleta.overall + media * 4 + estado.temporadaAtual.gols * 1.2 + (estado.pedido === "transferencia" ? 8 : 0)
  if (interesse < 78) return []

  // Os interessados saem das ligas de MAIOR prestígio do jogo — é para onde um
  // atleta em ascensão vai. Clube do mesmo país aparece primeiro por afinidade.
  const candidatos = completarLigaComPool(estado.divisao)
    .filter(t => t.file_key !== estado.clubeFileKey)
    .concat(ligasVizinhas(estado))
    .filter(t => t.prestigio > 0)
    .sort((a, b) => b.prestigio - a.prestigio)
    .filter(t => t.prestigio <= interesse + 12 && t.prestigio >= interesse - 30)
    .slice(0, 3)

  return candidatos.map((clube, i) => ({
    id: `proposta_${estado.temporada}_${clube.file_key}`,
    clubeCurto: clube.curto,
    clubeNome: clube.nome,
    clubeFileKey: clube.file_key,
    divisao: String(clube.divisao),
    ligaNome: String(clube.divisao),
    prestigio: clube.prestigio,
    salarioSemanal: Math.round(estado.contrato.salarioSemanal * (1.15 + i * 0.22 + clube.prestigio / 400)),
    temporadas: 3 + (i % 2),
    motivo: clube.prestigio > estado.tabela.length ? "Quer você como titular imediato." : "Projeto de crescimento com minutos garantidos.",
  }))
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
  }
  // Clube novo, treinador novo: a confiança recomeça no mérito daquele elenco —
  // é o que dá peso à decisão de subir de degrau cedo demais. Trocar o Santos
  // pelo Barcelona pode significar cair para o 4º da fila, e o modo agora diz
  // isso na cara antes de a temporada começar.
  novo.notaDoTreinador = limitar(confiancaMerecida(novo) * 0.8)
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

/** Média da temporada corrente — a tela mostra em três lugares. */
export function mediaDaTemporada(estado: EstadoCarreiraDeJogador): number {
  const t = estado.temporadaAtual
  return t.jogos > 0 ? Math.round((t.somaDasNotas / t.jogos) * 100) / 100 : 0
}
