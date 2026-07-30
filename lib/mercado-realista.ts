// A CABEÇA DO MERCADO — por que um clube quer um atleta, quanto ele paga por
// isso, e por que o atleta aceita (ou não).
//
// O que existia até a 1.0.222 e por que não bastava:
//
//   • O interesse saía de `evaluateBuy` (ai-club-engine): overall, idade,
//     personalidade e cautela orçamentária. Nada sobre o ELENCO do comprador. O
//     Flamengo com quatro zagueiros de 80 sondava o quinto zagueiro de 80 com o
//     mesmo apetite de quem não tinha nenhum.
//   • O valor da proposta era `maxFee × 0.78~0.95`, e `maxFee` vinha do valor de
//     mercado. Daí o relato: proposta de 13 milhões por um reserva, porque o
//     reserva TEM valor de mercado de 13 milhões — só que ninguém no mundo real
//     paga isso por quem vai ficar no banco de um clube grande.
//   • A janela só ligava/desligava a torneira (fator 0.22 fora dela). Não havia
//     urgência: uma proposta em julho valia igual a uma na última semana.
//   • O ATLETA não opinava. Aceitar era decisão do técnico do usuário e ponto.
//
// O modelo aqui tem quatro peças, e todas usam o elenco REAL do clube comprador
// (o mesmo `getPlayersForTeam` que o resto do jogo usa):
//
//   1. NECESSIDADE — o buraco que o clube tem naquela posição.
//   2. PAPEL PREVISTO — titular, rotação ou reserva NAQUELE elenco. É a peça que
//      resolve o "13 milhões por um reserva": ninguém paga preço de titular por
//      quem entra como quarta opção.
//   3. CAIXA E FOLHA — o clube não oferta o que não tem, nem em luvas nem em
//      salário.
//   4. A DECISÃO DO ATLETA — projeto (prestígio do clube), minutos (o papel
//      previsto) e dinheiro, nessa disputa. Craque não vai para clube pequeno
//      por dinheiro; jovem reserva não troca minutos por banco de elite.
//
// Módulo puro: sem React, sem store, sem `Math.random` fora dos pontos marcados.
// Ver scripts/test-mercado-realista.ts.

// ─── Setores e posições ──────────────────────────────────────────────────────

export type Setor = "GOL" | "DEF" | "MEI" | "ATA"

const SETOR_DA_POSICAO: Record<string, Setor> = {
  GOL: "GOL", GK: "GOL",
  ZAG: "DEF", CB: "DEF", LD: "DEF", LE: "DEF", RB: "DEF", LB: "DEF", LAT: "DEF", DEF: "DEF",
  VOL: "MEI", MEI: "MEI", MC: "MEI", MD: "MEI", ME: "MEI", CDM: "MEI", CM: "MEI", CAM: "MEI", MID: "MEI",
  ATA: "ATA", PD: "ATA", PE: "ATA", SA: "ATA", CA: "ATA", ST: "ATA", CF: "ATA", LW: "ATA", RW: "ATA", FWD: "ATA",
}

export function setorDaPosicao(posicao: string): Setor {
  return SETOR_DA_POSICAO[(posicao || "").toUpperCase()] ?? "MEI"
}

/** Quantos titulares uma formação padrão pede em cada setor. */
const VAGAS_POR_SETOR: Record<Setor, number> = { GOL: 1, DEF: 4, MEI: 4, ATA: 2 }

/** Quantos atletas um elenco saudável mantém por setor (titular + reserva). */
const ELENCO_IDEAL_POR_SETOR: Record<Setor, number> = { GOL: 3, DEF: 8, MEI: 8, ATA: 6 }

// ─── Perfil do elenco do comprador ───────────────────────────────────────────

export interface AtletaDoElenco {
  posicao: string
  overall: number
  idade: number
}

export interface PerfilDeElenco {
  /** Overall dos titulares presumidos de cada setor, do melhor para o pior. */
  porSetor: Record<Setor, number[]>
  /** Quantidade de atletas por setor. */
  tamanhoPorSetor: Record<Setor, number>
  /** Overall médio dos 11 melhores — o "nível" do clube em campo. */
  nivelDoTime: number
  /** Idade média do elenco. */
  idadeMedia: number
}

export function perfilDeElenco(elenco: readonly AtletaDoElenco[]): PerfilDeElenco {
  const porSetor: Record<Setor, number[]> = { GOL: [], DEF: [], MEI: [], ATA: [] }
  for (const a of elenco) porSetor[setorDaPosicao(a.posicao)].push(a.overall)
  for (const s of Object.keys(porSetor) as Setor[]) porSetor[s].sort((x, y) => y - x)

  const tamanhoPorSetor = {
    GOL: porSetor.GOL.length, DEF: porSetor.DEF.length,
    MEI: porSetor.MEI.length, ATA: porSetor.ATA.length,
  }

  // Nível do time: os titulares presumidos de cada setor, não o elenco inteiro —
  // o terceiro goleiro não pode puxar o Flamengo para baixo.
  const titulares: number[] = []
  for (const s of Object.keys(VAGAS_POR_SETOR) as Setor[]) {
    titulares.push(...porSetor[s].slice(0, VAGAS_POR_SETOR[s]))
  }
  const nivelDoTime = titulares.length
    ? Math.round(titulares.reduce((a, b) => a + b, 0) / titulares.length)
    : 65

  const idadeMedia = elenco.length
    ? Math.round(elenco.reduce((a, b) => a + b.idade, 0) / elenco.length)
    : 26

  return { porSetor, tamanhoPorSetor, nivelDoTime, idadeMedia }
}

export type PapelPrevisto = "estrela" | "titular" | "rotacao" | "reserva"

/**
 * Que papel este atleta teria NESTE elenco.
 *
 * A comparação é com os titulares presumidos do setor — não com a média do
 * elenco. Um zagueiro 80 é titular no Bahia e reserva no Flamengo, e é essa
 * diferença que precisa aparecer no preço e na decisão do atleta.
 */
export function papelPrevisto(perfil: PerfilDeElenco, posicao: string, overall: number): PapelPrevisto {
  const setor = setorDaPosicao(posicao)
  const vagas = VAGAS_POR_SETOR[setor]
  const doSetor = perfil.porSetor[setor]
  const titularesAtuais = doSetor.slice(0, vagas)

  // Setor vazio ou incompleto: entra jogando, seja quem for.
  if (titularesAtuais.length < vagas) return overall >= perfil.nivelDoTime + 4 ? "estrela" : "titular"

  const piorTitular = titularesAtuais[titularesAtuais.length - 1]
  const melhorTitular = titularesAtuais[0]

  if (overall >= melhorTitular + 3) return "estrela"
  if (overall > piorTitular) return "titular"
  if (overall >= piorTitular - 4) return "rotacao"
  return "reserva"
}

/** Overall médio dos titulares presumidos do setor daquela posição. */
export function mediaDoSetor(perfil: PerfilDeElenco, posicao: string): number {
  const setor = setorDaPosicao(posicao)
  const titulares = perfil.porSetor[setor].slice(0, VAGAS_POR_SETOR[setor])
  if (titulares.length === 0) return perfil.nivelDoTime - 12
  return titulares.reduce((a, b) => a + b, 0) / titulares.length
}

/**
 * Necessidade do clube naquela posição, 0-1.
 *
 * Duas fontes: FALTA DE GENTE (setor curto de elenco) e FALTA DE QUALIDADE (os
 * titulares do setor estão abaixo do nível do time). Um clube pode ter oito
 * zagueiros e ainda precisar de zagueiro, se os oito forem ruins.
 */
export function necessidadeNaPosicao(perfil: PerfilDeElenco, posicao: string): number {
  const setor = setorDaPosicao(posicao)
  const ideal = ELENCO_IDEAL_POR_SETOR[setor]
  const tem = perfil.tamanhoPorSetor[setor]

  const faltaDeGente = Math.max(0, Math.min(1, (ideal - tem) / Math.max(1, ideal * 0.5)))

  // 6 pontos abaixo do nível do time já é um setor que pede reforço.
  const faltaDeQualidade = Math.max(0, Math.min(1, (perfil.nivelDoTime - mediaDoSetor(perfil, posicao)) / 6))

  return Math.max(0, Math.min(1, faltaDeGente * 0.6 + faltaDeQualidade * 0.7))
}

// ─── Janela: quanto o relógio aperta ─────────────────────────────────────────

export interface ContextoDaJanela {
  aberta: boolean
  /** Semanas até a janela fechar. Só faz sentido com `aberta`. */
  semanasParaFechar: number
}

/**
 * Multiplicador de urgência da janela.
 *
 * Fora da janela existe SONDAGEM, não proposta séria. Dentro dela, a última
 * quinzena é o deadline day: quem não resolveu paga mais caro, e é aí que
 * aparecem as propostas que ninguém esperava.
 */
export function urgenciaDaJanela(janela: ContextoDaJanela): number {
  if (!janela.aberta) return 0.18
  if (janela.semanasParaFechar <= 1) return 1.55
  if (janela.semanasParaFechar <= 3) return 1.25
  return 1
}

// ─── A proposta ──────────────────────────────────────────────────────────────

export interface ClubeComprador {
  curto: string
  nome: string
  prestigio: number
  /** Caixa disponível para contratações nesta janela. */
  caixa: number
  /** Folha semanal já comprometida. */
  folhaSemanal?: number
  /** Teto de folha semanal. Sem ele, deriva do caixa. */
  tetoFolhaSemanal?: number
  perfil: PerfilDeElenco
}

export interface AtletaAlvo {
  id: number
  nome: string
  posicao: string
  overall: number
  potencial: number
  idade: number
  valorDeMercado: number
  salarioSemanal: number
  /** Semanas de contrato restantes. Contrato curto derruba o preço. */
  semanasDeContrato: number
  /** 0-100. Atleta infeliz vaza para o mercado e aceita mais fácil. */
  moral: number
  /** O técnico colocou na lista de transferíveis? */
  listado: boolean
  /** Minutos que vem jogando no clube atual — a base de comparação do atleta. */
  papelAtual: PapelPrevisto
}

export interface AvaliacaoDeCompra {
  quer: boolean
  motivo: string
  necessidade: number
  papel: PapelPrevisto
  /** Máximo que este clube pagaria por ESTE atleta, no papel previsto. */
  teto: number
  /** Valor da proposta de abertura. */
  proposta: number
  salarioOferecido: number
}

/**
 * DESCONTO POR PAPEL — a peça que faltava.
 *
 * O valor de mercado é o preço de um titular. Quem entra como rotação ou
 * reserva vale uma fração disso PARA AQUELE CLUBE: ninguém no futebol real
 * desembolsa preço cheio por quem não vai jogar. É isso que impede o "clube
 * grande manda 13 milhões por um reserva".
 */
const FATOR_DO_PAPEL: Record<PapelPrevisto, number> = {
  estrela: 1.35,
  titular: 1.0,
  rotacao: 0.55,
  reserva: 0.28,
}

/** Interesse mínimo para o clube sequer abrir conversa. */
const LIMIAR_DE_INTERESSE = 0.34

export function avaliarCompra(
  clube: ClubeComprador,
  atleta: AtletaAlvo,
  janela: ContextoDaJanela,
): AvaliacaoDeCompra {
  const papel = papelPrevisto(clube.perfil, atleta.posicao, atleta.overall)
  const necessidade = necessidadeNaPosicao(clube.perfil, atleta.posicao)
  const urgencia = urgenciaDaJanela(janela)

  const vazio: Omit<AvaliacaoDeCompra, "quer" | "motivo"> = {
    necessidade, papel, teto: 0, proposta: 0, salarioOferecido: 0,
  }

  // 1. RESERVA NÃO SE CONTRATA. Um clube não gasta uma vaga de elenco e uma
  //    folha inteira em quem seria a quarta opção — a não ser que o setor esteja
  //    literalmente vazio, e aí `papelPrevisto` já teria dito "titular".
  if (papel === "reserva") {
    return { ...vazio, quer: false, motivo: "Seria reserva neste elenco — o clube não gasta vaga com isso." }
  }

  // 2. O clube precisa CABER no atleta e o atleta no clube. Um clube de
  //    prestígio 60 não contrata um 88; um clube de 90 não perde tempo com um 70.
  const alcance = clube.prestigio + 8
  if (atleta.overall > alcance) {
    return { ...vazio, quer: false, motivo: `${clube.nome} não alcança um atleta deste nível.` }
  }
  if (papel === "rotacao" && atleta.overall < clube.perfil.nivelDoTime - 8) {
    return { ...vazio, quer: false, motivo: "Abaixo do nível do elenco." }
  }

  // 3. INTERESSE. Necessidade manda; qualidade e projeção (jovem com potencial)
  //    completam. Fora da janela, quase tudo vira só sondagem.
  //
  //    A comparação de qualidade é com o SETOR, não com o nível geral do time.
  //    Comparar com o time inteiro dizia que um zagueiro 76 não serve a um clube
  //    de nível 81 — mesmo quando a zaga desse clube é um buraco de 68. O que o
  //    diretor pergunta é "ele é melhor do que o que eu tenho AÍ?".
  const ganhoDeQualidade = (atleta.overall - mediaDoSetor(clube.perfil, atleta.posicao)) / 12
  const projecao = atleta.idade <= 23 ? (atleta.potencial - atleta.overall) / 25 : 0
  const veterano = atleta.idade >= 32 ? -0.25 : atleta.idade >= 30 ? -0.10 : 0
  const oportunidade =
    (atleta.listado ? 0.22 : 0)
    + (atleta.semanasDeContrato <= 26 ? 0.20 : atleta.semanasDeContrato <= 52 ? 0.09 : 0)
    + (atleta.moral <= 25 ? 0.18 : atleta.moral <= 40 ? 0.08 : 0)

  const interesse = (
    necessidade * 0.55
    + Math.max(-0.3, Math.min(0.45, ganhoDeQualidade))
    + projecao
    + veterano
    + oportunidade
  ) * Math.min(1.25, urgencia)

  if (interesse < LIMIAR_DE_INTERESSE) {
    return {
      ...vazio, quer: false,
      motivo: necessidade < 0.2
        ? `${clube.nome} está servido nesta posição.`
        : "O interesse não chegou a virar proposta.",
    }
  }

  // 4. TETO. Valor de mercado ajustado pelo PAPEL, pela necessidade, pela
  //    urgência da janela e pelo contrato que está acabando.
  const descontoContrato = atleta.semanasDeContrato <= 26 ? 0.55
    : atleta.semanasDeContrato <= 52 ? 0.78 : 1
  const agioNecessidade = 1 + necessidade * 0.35
  const agioJanela = 1 + Math.max(0, urgencia - 1) * 0.5
  let teto = atleta.valorDeMercado
    * FATOR_DO_PAPEL[papel]
    * descontoContrato
    * agioNecessidade
    * agioJanela

  // 5. CAIXA. O clube não oferta o que não tem. Uma janela inteira não é gasta
  //    num nome só: o teto de um negócio é uma fração do caixa.
  const tetoDeCaixa = clube.caixa * (papel === "estrela" ? 0.7 : 0.45)
  if (tetoDeCaixa < teto * 0.35) {
    return { ...vazio, quer: false, motivo: `${clube.nome} não tem caixa para esta negociação.` }
  }
  teto = Math.min(teto, tetoDeCaixa)

  // 6. FOLHA. Salário oferecido cresce com o papel; se estourar o teto de folha,
  //    o negócio morre — é assim que clube pequeno não sequestra estrela.
  const salarioOferecido = Math.round(
    atleta.salarioSemanal * (papel === "estrela" ? 1.45 : papel === "titular" ? 1.20 : 1.02),
  )
  const tetoFolha = clube.tetoFolhaSemanal ?? Math.max(1, clube.caixa * 0.0012)
  const folhaAtual = clube.folhaSemanal ?? 0
  // O teto é teto. A única folga é para uma ESTRELA — clube estica a folha por
  // quem muda o time, não por reforço de rotação.
  const folgaDaFolha = papel === "estrela" ? 1.10 : 1
  if (folhaAtual + salarioOferecido > tetoFolha * folgaDaFolha) {
    return { ...vazio, quer: false, motivo: `A folha do ${clube.nome} não comporta este salário.` }
  }

  // 7. ABERTURA. Deixa espaço para contraproposta — mas quem está com pressa
  //    (necessidade alta, janela fechando) abre mais perto do teto.
  const margem = 0.72 + Math.min(0.23, necessidade * 0.18 + Math.max(0, urgencia - 1) * 0.2)
  const proposta = Math.max(100_000, Math.round((teto * margem) / 100_000) * 100_000)

  return {
    quer: true,
    motivo: motivoDaProposta(papel, necessidade, janela),
    necessidade,
    papel,
    teto: Math.round(teto),
    proposta,
    salarioOferecido,
  }
}

function motivoDaProposta(papel: PapelPrevisto, necessidade: number, janela: ContextoDaJanela): string {
  if (janela.aberta && janela.semanasParaFechar <= 1) return "Última chance antes de a janela fechar."
  if (papel === "estrela") return "Chegaria para ser o principal nome do setor."
  if (necessidade >= 0.6) return "O setor é o buraco declarado do elenco."
  if (papel === "titular") return "Entraria direto no time titular."
  return "Reforçaria a rotação do elenco."
}

// ─── A decisão do atleta ─────────────────────────────────────────────────────

export interface DecisaoDoAtleta {
  aceita: boolean
  /** 0-100 — quanto o atleta gostou da proposta. Serve para a tela graduar o texto. */
  entusiasmo: number
  motivo: string
}

/**
 * O atleta aceita ir?
 *
 * Três pesos, e o dinheiro NÃO é o maior deles:
 *
 *   PROJETO — o clube é maior do que o atual? Ninguém desce de degrau de graça.
 *   MINUTOS — sair de titular para ser rotação é o veto mais comum do futebol
 *             real, e era o que faltava por completo no jogo.
 *   DINHEIRO — pesa, e pesa mais para quem já está no fim da carreira, mas não
 *             compra um jovem que quer jogar.
 */
export function decisaoDoAtleta(input: {
  atleta: AtletaAlvo
  prestigioClubeAtual: number
  prestigioClubeNovo: number
  papelNoClubeNovo: PapelPrevisto
  salarioOferecido: number
}): DecisaoDoAtleta {
  const { atleta, prestigioClubeAtual, prestigioClubeNovo, papelNoClubeNovo, salarioOferecido } = input

  // PROJETO: cada ponto de prestígio a mais vale, mas com retorno decrescente.
  const saltoDeProjeto = (prestigioClubeNovo - prestigioClubeAtual) / 12 // ~±2 típico
  const projeto = Math.max(-3, Math.min(3, saltoDeProjeto))

  // MINUTOS: a comparação é entre o papel de hoje e o de amanhã.
  const escala: Record<PapelPrevisto, number> = { estrela: 3, titular: 2, rotacao: 1, reserva: 0 }
  const deltaMinutos = escala[papelNoClubeNovo] - escala[atleta.papelAtual]
  // Jovem troca minutos por vitrine com mais facilidade que um atleta de 29 no
  // auge — para este, perder a titularidade é perder a carreira.
  const pesoMinutos = atleta.idade <= 22 ? 1.1 : atleta.idade <= 28 ? 1.9 : 1.4
  const minutos = deltaMinutos * pesoMinutos

  // DINHEIRO: aumento percentual, com teto. Pesa mais no fim da carreira.
  const aumento = atleta.salarioSemanal > 0
    ? (salarioOferecido - atleta.salarioSemanal) / atleta.salarioSemanal
    : 0.3
  const pesoDinheiro = atleta.idade >= 31 ? 3.2 : atleta.idade >= 27 ? 2.2 : 1.6
  const dinheiro = Math.max(-2.5, Math.min(2.5, aumento * 3)) * (pesoDinheiro / 2.2)

  // INSATISFAÇÃO empurra para fora, contrato acabando também.
  const empurrao =
    (atleta.moral <= 25 ? 1.6 : atleta.moral <= 40 ? 0.7 : 0)
    + (atleta.semanasDeContrato <= 26 ? 0.8 : 0)
    + (atleta.listado ? 0.9 : 0)

  const nota = projeto + minutos + dinheiro + empurrao
  const entusiasmo = Math.max(0, Math.min(100, Math.round(50 + nota * 9)))

  if (nota >= 0.8) {
    return { aceita: true, entusiasmo, motivo: motivoDoSim(projeto, minutos, dinheiro) }
  }
  return { aceita: false, entusiasmo, motivo: motivoDoNao(projeto, minutos, dinheiro, deltaMinutos) }
}

function motivoDoSim(projeto: number, minutos: number, dinheiro: number): string {
  const maior = Math.max(projeto, minutos, dinheiro)
  if (maior === minutos && minutos > 0) return "Vai jogar mais do que joga hoje."
  if (maior === projeto && projeto > 0) return "É um passo à frente na carreira."
  return "Os termos convenceram o atleta."
}

function motivoDoNao(projeto: number, minutos: number, dinheiro: number, deltaMinutos: number): string {
  if (deltaMinutos < 0) return "Não troca a titularidade por um banco melhor."
  if (projeto < -0.5) return "Não vê o clube como um passo à frente."
  if (dinheiro < 0) return "O salário oferecido é menor do que o atual."
  if (minutos === 0 && projeto <= 0) return "Não vê motivo para mudar de clube agora."
  return "A proposta não empolgou o atleta."
}

// ─── Sondagem ────────────────────────────────────────────────────────────────

export interface Sondagem {
  clube: string
  posicao: string
  papel: PapelPrevisto
  necessidade: number
  motivo: string
  /** O clube tem caixa para virar proposta de verdade? */
  temCaixa: boolean
}

/**
 * A sondagem que ANTECEDE a proposta.
 *
 * Antes ela era um sorteio: `Math.random() > 0.12` e um clube aleatório. Agora
 * ela é a mesma avaliação da compra, só que abaixo do limiar de proposta ou
 * fora da janela — ou seja, um clube que de fato olhou o elenco dele, olhou o
 * seu atleta e concluiu que faria sentido. Por isso a sondagem consegue DIZER
 * por que está olhando, e por isso ela costuma virar proposta na janela
 * seguinte.
 */
export function sondagemDe(
  clube: ClubeComprador,
  atleta: AtletaAlvo,
  avaliacao: AvaliacaoDeCompra,
): Sondagem | null {
  if (avaliacao.papel === "reserva") return null
  if (avaliacao.necessidade < 0.25 && avaliacao.papel !== "estrela") return null
  return {
    clube: clube.nome,
    posicao: atleta.posicao,
    papel: avaliacao.papel,
    necessidade: avaliacao.necessidade,
    motivo: avaliacao.quer
      ? "Prepara proposta formal."
      : avaliacao.motivo,
    temCaixa: clube.caixa >= atleta.valorDeMercado * FATOR_DO_PAPEL[avaliacao.papel] * 0.4,
  }
}

export const ROTULO_DO_PAPEL: Record<PapelPrevisto, string> = {
  estrela: "estrela do elenco",
  titular: "titular",
  rotacao: "rotação",
  reserva: "reserva",
}
