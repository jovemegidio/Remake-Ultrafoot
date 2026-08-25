/**
 * RELACIONAMENTOS — as pessoas em volta do atleta viram número que decide coisa.
 *
 * ─── O QUE FALTAVA ──────────────────────────────────────────────────────────
 *
 * O modo já tinha CONVERSAS (`lib/conversas-do-atleta`, 1.0.340) com família,
 * empresário e diretoria. Cada conversa era única: respondida uma vez, entrava
 * em `conversasRespondidas` e nunca mais voltava. Ou seja — havia MOMENTOS de
 * relação e não havia RELAÇÃO: nada acumulava, nada esfriava, e tratar bem ou
 * mal alguém durante cinco temporadas dava no mesmo.
 *
 * Aqui cada pessoa tem um nível de 0 a 100 que sobe, desce e ENVELHECE.
 *
 * ─── A REGRA QUE IMPEDE ISSO DE VIRAR ENFEITE ───────────────────────────────
 *
 * ⚠️ Toda relação tem de mexer em algo que o jogo JÁ lê. Um medidor bonito que
 * não altera escalação, dinheiro nem proposta é a mesma armadilha do "foco de
 * treino que só valia uma vez por ano" — e este modo já caiu nela. Por isso
 * cada laço abaixo declara o seu efeito, e o efeito é aplicado por uma função
 * deste arquivo, não espalhado por quem chama:
 *
 *   TREINADOR   piso na nota do treinador — quem tem o técnico do lado não
 *               despenca para "fora dos planos" por duas partidas ruins.
 *   VESTIARIO   bônus/desconto na nota da partida: jogar com o grupo contra
 *               você custa caro, e é o que dá peso a bater de frente.
 *   EMPRESARIO  quantas propostas chegam e quanto ele arranca a mais.
 *   FAMILIA     recuperação de forma e de fadiga — a base de casa é o que
 *               segura uma temporada de 60 jogos.
 *   IMPRENSA    velocidade com que a reputação sobe (ou afunda).
 *
 * ─── POR QUE ELAS ESFRIAM ───────────────────────────────────────────────────
 *
 * Sem decaimento, a estratégia ótima seria "seja simpático nas cinco primeiras
 * rodadas e esqueça". O decaimento é pequeno (0,6/rodada em direção a 50) —
 * o bastante para exigir manutenção, pouco o bastante para não punir quem
 * simplesmente jogou futebol por um mês.
 */

/**
 * ⚠️ `elenco` E NÃO `vestiario` — E ISSO É O ARQUIVO INTEIRO EM UMA LINHA.
 *
 * A primeira versão deste módulo chamou o laço coletivo de `vestiario` e criou
 * um campo novo para ele. Só que a 1.0.373 JÁ tinha `relacoes.elenco`, com
 * interação semanal, decaimento por rodada e um custo de energia — funcionando.
 * Um segundo medidor do mesmo grupo, com outro nome, teria dado ao jogador dois
 * números que discordam sobre a mesma pergunta, e nenhum aviso de que discordam.
 *
 * Aqui o nome antigo manda. Este módulo ESTENDE as relações que já existiam
 * (`elenco` e `marcas`) com as quatro que faltavam, em vez de competir com elas.
 */
export type Pessoa = "treinador" | "elenco" | "empresario" | "familia" | "imprensa"

export const PESSOAS: Pessoa[] = ["treinador", "elenco", "empresario", "familia", "imprensa"]

export type Relacoes = Record<Pessoa, number>

const ROTULO: Record<Pessoa, string> = {
  treinador: "Treinador",
  elenco: "Vestiário",
  empresario: "Empresário",
  familia: "Família",
  imprensa: "Imprensa",
}

const EFEITO: Record<Pessoa, string> = {
  treinador: "Segura a sua nota quando a fase é ruim",
  elenco: "Muda a sua nota em campo",
  empresario: "Traz mais propostas e melhores",
  familia: "Recupera forma e fadiga mais rápido",
  imprensa: "Acelera (ou afunda) a sua reputação",
}

export function rotuloDaPessoa(p: Pessoa): string { return ROTULO[p] }
export function efeitoDaPessoa(p: Pessoa): string { return EFEITO[p] }

const limitar = (v: number) => Math.max(0, Math.min(100, Math.round(v * 10) / 10))

/**
 * O ponto de partida.
 *
 * ⚠️ 50 EM TUDO, MENOS FAMÍLIA. Um atleta começa neutro com gente que acabou de
 * conhecer — mas a família já estava lá antes do futebol. Começar a família em
 * 50 faria a primeira temporada parecer a de um órfão, e tira o sentido da
 * queda quando o jogador a negligencia depois.
 */
export function relacoesIniciais(): Relacoes {
  return { treinador: 50, elenco: 50, empresario: 55, familia: 72, imprensa: 50 }
}

/** Lê as relações de um estado que pode ser anterior a esta versão. */
export function lerRelacoes(r: Partial<Relacoes> | undefined | null): Relacoes {
  const base = relacoesIniciais()
  if (!r) return base
  for (const p of PESSOAS) if (typeof r[p] === "number") base[p] = limitar(r[p] as number)
  return base
}

export function mover(r: Relacoes, p: Pessoa, delta: number): Relacoes {
  return { ...r, [p]: limitar(r[p] + delta) }
}

/**
 * O ENVELHECIMENTO DE UMA RODADA.
 *
 * Puxa tudo devagar para 50 — o ponto neutro. Quem está em 90 escorrega; quem
 * está em 10 é perdoado aos poucos. Os dois sentidos importam: sem o segundo,
 * uma briga no vestiário seria uma sentença perpétua.
 */
export function esfriarUmaRodada(r: Relacoes): Relacoes {
  const saida = { ...r }
  for (const p of PESSOAS) {
    const d = saida[p] - 50
    saida[p] = limitar(saida[p] - Math.sign(d) * Math.min(Math.abs(d), 0.6))
  }
  return saida
}

// ─── OS EFEITOS ──────────────────────────────────────────────────────────────
//
// Cada um devolve um número que quem chama SOMA ou MULTIPLICA. Nenhum deles
// escreve em estado: assim o mesmo efeito pode ser mostrado na tela ("+3 na
// nota") sem ser aplicado duas vezes — que é como um bônus vira um bug.

/** Piso que o técnico amigo garante na `notaDoTreinador` (0 a 25). */
export function pisoDaNotaDoTreinador(r: Relacoes): number {
  return Math.max(0, (r.treinador - 55) / 45) * 25
}

/** Quanto o vestiário soma (ou tira) da nota da partida: −0,5 a +0,5. */
export function ajusteDaNotaPeloVestiario(r: Relacoes): number {
  return Math.round(((r.elenco - 50) / 50) * 0.5 * 10) / 10
}

/** Multiplicador de propostas que chegam: 0,6 (empresário frio) a 1,5. */
export function multiplicadorDePropostas(r: Relacoes): number {
  return 0.6 + (r.empresario / 100) * 0.9
}

/** Quanto a mais o empresário arranca no salário: 0 a 18%. */
export function ganhoDaNegociacao(r: Relacoes): number {
  return Math.max(0, (r.empresario - 50) / 50) * 0.18
}

/** Multiplicador de recuperação de forma e fadiga: 0,8 a 1,35. */
export function recuperacaoPelaFamilia(r: Relacoes): number {
  return 0.8 + (r.familia / 100) * 0.55
}

/**
 * Quanto a imprensa amplifica a variação de reputação.
 *
 * ⚠️ AMPLIFICA NOS DOIS SENTIDOS, e é isso que torna a escolha uma escolha.
 * Imprensa amiga (100) multiplica por 1,4 — inclusive a queda depois de uma
 * expulsão. Imprensa hostil (0) por 0,6, o que protege o atleta discreto e
 * atrasa a ascensão dele. Nenhuma das duas é "a melhor".
 */
export function amplificacaoDaImprensa(r: Relacoes): number {
  return 0.6 + (r.imprensa / 100) * 0.8
}

/** Como o nível aparece na tela. Número cru não diz nada ao jogador. */
export function rotuloDoNivel(v: number): { texto: string; tom: "bom" | "neutro" | "ruim" } {
  if (v >= 80) return { texto: "Muito próximo", tom: "bom" }
  if (v >= 62) return { texto: "Boa relação", tom: "bom" }
  if (v >= 40) return { texto: "Normal", tom: "neutro" }
  if (v >= 22) return { texto: "Arranhada", tom: "ruim" }
  return { texto: "Rompida", tom: "ruim" }
}

// ═══════════════════════════════════════════════════════════════════════════
// OS COMPANHEIROS DE TIME (1.0.374)
// ═══════════════════════════════════════════════════════════════════════════
//
// ⚠️ O "VESTIÁRIO" ACIMA NÃO É UM COMPANHEIRO — É UMA MÉDIA. Ele resolve a
// pergunta "o grupo está com você?" e não resolve nenhuma das perguntas que um
// modo de carreira de jogador precisa responder: quem é o capitão que fala com
// você, quem é o craque que passa (ou não passa) a bola, quem é o cara que
// disputa a sua vaga. Uma relação coletiva não tem NOME, e sem nome não há a
// única coisa que faz relação valer alguma coisa numa carreira: história.
//
// São QUATRO, e não uma lista longa de propósito. Cada um existe porque tem um
// efeito próprio que nenhum outro tem — um quinto companheiro sem efeito seria
// exatamente o enfeite que este arquivo inteiro existe para evitar.
//
//   CAPITAO    fala pelo grupo: puxa o vestiário inteiro junto com ele.
//   CRAQUE     decide se a bola chega em você: mexe na FREQUÊNCIA de lances.
//   VETERANO   ensina: multiplica o que você ganha no treino.
//   RIVAL      disputa a sua posição: mexe na sua nota com o treinador.
//
// ⚠️ O RIVAL É O ÚNICO EM QUE A RELAÇÃO BOA NÃO É A MELHOR. Ficar amigo dele
// ajuda o vestiário e ATRAPALHA a sua vaga — ele joga melhor com o grupo do
// lado. Sem um laço assim, "seja legal com todo mundo" seria a resposta ótima
// e as escolhas parariam de ser escolhas.

export type PapelDoCompanheiro = "capitao" | "craque" | "veterano" | "rival"

export interface Companheiro {
  id: string
  nome: string
  posicao: string
  papel: PapelDoCompanheiro
  /** 0 a 100, mesma escala das outras relações. */
  nivel: number
}

const PAPEL_ROTULO: Record<PapelDoCompanheiro, string> = {
  capitao: "Capitão",
  craque: "Craque do elenco",
  veterano: "Veterano",
  rival: "Concorrente na posição",
}

const PAPEL_EFEITO: Record<PapelDoCompanheiro, string> = {
  capitao: "Puxa o vestiário inteiro junto",
  craque: "Decide se a bola chega em você",
  veterano: "Multiplica o que você ganha no treino",
  rival: "Disputa a sua vaga com o treinador",
}

export function rotuloDoPapel(p: PapelDoCompanheiro): string { return PAPEL_ROTULO[p] }
export function efeitoDoPapel(p: PapelDoCompanheiro): string { return PAPEL_EFEITO[p] }

const PRIMEIROS = [
  "Rafael", "Diego", "Bruno", "Alan", "Vitor", "Caio", "Léo", "Iago",
  "Matheus", "Kauã", "Nicolas", "Thiago", "Wesley", "Everton", "Danilo", "Murilo",
]
const SOBRENOMES = [
  "Andrade", "Barbosa", "Correia", "Duarte", "Estevam", "Fontes", "Guedes", "Horta",
  "Ibarra", "Jardim", "Klein", "Lisboa", "Moraes", "Nogueira", "Otero", "Peixoto",
]

/** Sorteio semeado — o mesmo clube dá o mesmo elenco em volta. */
function hash(texto: string): number {
  let h = 2166136261
  for (let i = 0; i < texto.length; i++) {
    h ^= texto.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

/**
 * QUEM ESTÁ NO VESTIÁRIO QUANDO VOCÊ CHEGA.
 *
 * ⚠️ SEMEADO PELO CLUBE, NÃO PELA DATA. Voltar ao mesmo clube cinco temporadas
 * depois tem de reencontrar as mesmas pessoas — se os nomes mudassem a cada
 * geração, a carreira não teria memória e o sistema viraria um gerador de
 * medidores.
 *
 * O RIVAL nasce na SUA posição, os outros três não. É o que faz a disputa ser
 * concreta em vez de temática.
 */
export function companheirosDoClube(clube: string, posicaoDoAtleta: string): Companheiro[] {
  const papeis: PapelDoCompanheiro[] = ["capitao", "craque", "veterano", "rival"]
  const posicoes = ["ZAG", "VOL", "MEI", "ATA", "LD", "LE", "GOL"]

  return papeis.map((papel, i) => {
    const semente = hash(`${clube}:${papel}:${i}`)
    const nome = `${PRIMEIROS[semente % PRIMEIROS.length]} ${SOBRENOMES[(semente >> 8) % SOBRENOMES.length]}`
    return {
      id: `companheiro_${papel}_${hash(clube) % 100000}`,
      nome,
      posicao: papel === "rival" ? posicaoDoAtleta : posicoes[(semente >> 16) % posicoes.length],
      papel,
      // ⚠️ O RIVAL COMEÇA MAIS FRIO (42) e o veterano mais quente (58). Ninguém
      // chega num elenco com todo mundo igual: o cara que perde a vaga para
      // você já chega torto, e o veterano é justamente quem acolhe. Começar
      // todos em 50 apagaria a única caracterização que o sistema tem de graça.
      nivel: papel === "rival" ? 42 : papel === "veterano" ? 58 : 50,
    }
  })
}

/** Lê os companheiros de um save que pode não os ter. */
export function lerCompanheiros(
  guardados: Companheiro[] | undefined,
  clube: string,
  posicaoDoAtleta: string,
): Companheiro[] {
  if (guardados && guardados.length > 0) return guardados
  return companheirosDoClube(clube, posicaoDoAtleta)
}

export function moverCompanheiro(lista: Companheiro[], papel: PapelDoCompanheiro, delta: number): Companheiro[] {
  return lista.map(c => c.papel === papel ? { ...c, nivel: limitar(c.nivel + delta) } : c)
}

/** Esfria como as demais relações, e pelo mesmo motivo. */
export function esfriarCompanheiros(lista: Companheiro[]): Companheiro[] {
  return lista.map(c => {
    const d = c.nivel - 50
    return { ...c, nivel: limitar(c.nivel - Math.sign(d) * Math.min(Math.abs(d), 0.6)) }
  })
}

const nivelDe = (lista: Companheiro[], papel: PapelDoCompanheiro): number =>
  lista.find(c => c.papel === papel)?.nivel ?? 50

// ─── OS EFEITOS DOS COMPANHEIROS ────────────────────────────────────────────

/**
 * O CAPITÃO PUXA O GRUPO: −6 a +6 no vestiário, por rodada.
 *
 * ⚠️ ELE ALIMENTA O VESTIÁRIO, NÃO SUBSTITUI. Se o capitão fosse o vestiário,
 * bastaria agradar uma pessoa e o grupo inteiro viria junto — e o coletivo
 * deixaria de existir. Aqui ele empurra devagar, e o resto do elenco continua
 * respondendo ao que você faz em campo.
 */
export function puxaoDoCapitao(lista: Companheiro[]): number {
  return ((nivelDe(lista, "capitao") - 50) / 50) * 6
}

/**
 * O CRAQUE DECIDE SE A BOLA CHEGA: multiplicador de 0,78 a 1,22 nos lances.
 *
 * É o efeito mais concreto do arquivo inteiro — ele muda quantas vezes por
 * partida o jogador é chamado a decidir. Um camisa 10 que não gosta de você
 * simplesmente não olha para o seu lado, e a partida fica mais curta.
 */
export function frequenciaDeLancesPeloCraque(lista: Companheiro[]): number {
  return 0.78 + (nivelDe(lista, "craque") / 100) * 0.44
}

/** O veterano ensina: 0,85 a 1,3 no que o treino rende. */
export function multiplicadorDeTreinoPeloVeterano(lista: Companheiro[]): number {
  return 0.85 + (nivelDe(lista, "veterano") / 100) * 0.45
}

/**
 * O RIVAL — e a única relação em que ser amigo custa.
 *
 * Devolve o que ele TIRA da sua nota com o treinador: 0 (ele está mal com o
 * grupo e joga pior) a −7 (ele está ótimo, e o técnico vê). O jogador que
 * quiser a vaga tem de escolher entre o vestiário e a titularidade — que é o
 * tipo de decisão que o modo existe para oferecer.
 */
export function pressaoDoRival(lista: Companheiro[]): number {
  return -Math.max(0, (nivelDe(lista, "rival") - 35) / 65) * 7
}

/**
 * A MÉDIA DOS COMPANHEIROS, para a tela mostrar o clima do grupo.
 *
 * ⚠️ NÃO É USADA COMO EFEITO. Ela existe só para a leitura humana; usar a
 * média como bônus duplicaria o que cada companheiro já faz sozinho, que é
 * como um sistema justo vira um sistema inflacionado.
 */
export function climaDoVestiario(lista: Companheiro[]): number {
  if (lista.length === 0) return 50
  return Math.round(lista.reduce((s, c) => s + c.nivel, 0) / lista.length)
}
