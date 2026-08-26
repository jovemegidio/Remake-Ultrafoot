/**
 * PATROCÍNIO PESSOAL — de três botões para um mercado (1.0.377).
 *
 * ─── O QUE EXISTIA, E POR QUE NÃO ERA UM SISTEMA ────────────────────────────
 *
 * A 1.0.373 criou `PATROCINIOS_PESSOAIS`: três objetos constantes, filtrados
 * por `reputacaoMinima`, que viravam três botões na tela. Clicar num deles
 * assinava. Não havia proposta chegando, não havia negociação, não havia
 * concorrência entre marcas, não havia conflito de categoria e não havia
 * motivo para escolher a menor — a maior que a sua reputação alcançava era
 * sempre a resposta certa, e a decisão inteira cabia em "espere subir de
 * reputação e clique no de cima".
 *
 * ⚠️ E O `sponsor-engine.ts` NÃO RESOLVIA ISSO. Ele existe, tem negociação com
 * contraproposta e teto — mas é o patrocínio DO CLUBE (master, fornecedor,
 * manga, calção), lido pela economia do clube. São dois assuntos diferentes com
 * o mesmo nome, e confundi-los daria ao atleta receita de camisa de time.
 *
 * ─── O QUE FAZ DISTO UM SISTEMA ─────────────────────────────────────────────
 *
 * 1. AS MARCAS TÊM CATEGORIA E EXCLUSIVIDADE. Duas fabricantes de chuteira não
 *    convivem; um banco e uma casa de apostas, sim. É o que obriga a escolher
 *    em vez de acumular.
 * 2. A PROPOSTA É GERADA PELO QUE VOCÊ FEZ, não pela sua reputação sozinha:
 *    gols, torcida, relação com as marcas (`forcaDaMarcaPessoal`) e — aqui os
 *    itens de status entram — o `estilo` do seu patrimônio.
 * 3. TEM CLÁUSULA, E A CLÁUSULA COBRA. Meta de gols, de jogos e de aparições.
 *    Cumprir paga bônus e abre portas; furar paga multa e fecha.
 * 4. DÁ PARA NEGOCIAR, com teto. Pedir mais é legítimo até o ponto em que a
 *    marca desiste — e ela desiste de verdade.
 *
 * ─── A REGRA QUE IMPEDE ISTO DE VIRAR DINHEIRO DE GRAÇA ─────────────────────
 *
 * ⚠️ TODO CONTRATO COBRA ALGO QUE NÃO É DINHEIRO. Aparições consomem energia na
 * semana; exclusividade fecha categorias inteiras; marca polêmica custa
 * torcida. Um patrocínio que só depositasse seria um multiplicador de saldo com
 * passos extras — e o modo já tem economia demais para tolerar mais uma
 * torneira aberta.
 */

import { forcaDaMarcaPessoal, type Relacoes } from "@/lib/relacoes-do-atleta"

export type CategoriaDeMarca =
  | "material_esportivo" | "bebida" | "banco" | "tecnologia" | "moda" | "apostas" | "automotivo" | "alimentacao"

export type NivelDaMarca = "regional" | "nacional" | "continental" | "global"

export interface Marca {
  id: string
  nome: string
  categoria: CategoriaDeMarca
  nivel: NivelDaMarca
  /** Reputação mínima para a marca sequer olhar para o atleta. */
  reputacaoMinima: number
  /** Quanto ela paga por semana, antes dos multiplicadores do atleta. */
  baseSemanal: number
  /** Aparições exigidas por temporada — cada uma custa energia. */
  aparicoes: number
  /**
   * Marcas que ela NÃO aceita ao lado. Categoria, não id: a chuteira briga com
   * qualquer outra chuteira, e não só com a concorrente que você já conhece.
   */
  exclusividade: CategoriaDeMarca[]
  /** Custo em apoio da torcida por assinar. Só as categorias que dividem têm. */
  custoDeTorcida?: number
  /** O que a marca procura — muda quem recebe proposta dela. */
  procura: "gols" | "regularidade" | "imagem" | "juventude"
}

/**
 * O CATÁLOGO.
 *
 * ⚠️ AS TRÊS MARCAS DA 1.0.373 CONTINUAM AQUI, COM OS MESMOS IDS
 * (`vertice`, `pulso`, `aurora`). Uma carreira em andamento tem o id do
 * patrocínio gravado no save; trocar o catálogo por um novo apagaria o
 * contrato de quem já jogava, e "a marca sumiu" é um bug sem sintoma até o
 * jogador procurar por ela.
 */
export const MARCAS: Marca[] = [
  // ── material esportivo: a categoria mais disputada, e a única realmente exclusiva
  { id: "vertice", nome: "Vertice Sports", categoria: "material_esportivo", nivel: "regional", reputacaoMinima: 30, baseSemanal: 3_000, aparicoes: 2, exclusividade: ["material_esportivo"], procura: "juventude" },
  { id: "pulso", nome: "Pulso Performance", categoria: "material_esportivo", nivel: "nacional", reputacaoMinima: 48, baseSemanal: 7_500, aparicoes: 4, exclusividade: ["material_esportivo"], procura: "regularidade" },
  { id: "aurora", nome: "Aurora Eleven", categoria: "material_esportivo", nivel: "continental", reputacaoMinima: 68, baseSemanal: 16_000, aparicoes: 6, exclusividade: ["material_esportivo"], procura: "gols" },
  { id: "kaiser", nome: "Kaiser Athletic", categoria: "material_esportivo", nivel: "global", reputacaoMinima: 84, baseSemanal: 42_000, aparicoes: 9, exclusividade: ["material_esportivo"], procura: "imagem" },

  // ── as outras categorias: convivem entre si, e é isso que permite montar carteira
  { id: "hidra", nome: "Hidra Isotônico", categoria: "bebida", nivel: "nacional", reputacaoMinima: 40, baseSemanal: 5_200, aparicoes: 3, exclusividade: ["bebida"], procura: "regularidade" },
  { id: "banco_sul", nome: "Banco Sul", categoria: "banco", nivel: "nacional", reputacaoMinima: 52, baseSemanal: 9_000, aparicoes: 4, exclusividade: ["banco"], procura: "imagem" },
  { id: "nova_rede", nome: "NovaRede", categoria: "tecnologia", nivel: "continental", reputacaoMinima: 62, baseSemanal: 13_500, aparicoes: 3, exclusividade: ["tecnologia"], procura: "juventude" },
  { id: "linha_fina", nome: "Linha Fina", categoria: "moda", nivel: "continental", reputacaoMinima: 58, baseSemanal: 11_000, aparicoes: 5, exclusividade: ["moda"], procura: "imagem" },
  { id: "vento_motors", nome: "Vento Motors", categoria: "automotivo", nivel: "global", reputacaoMinima: 74, baseSemanal: 26_000, aparicoes: 4, exclusividade: ["automotivo"], procura: "imagem" },
  { id: "grao", nome: "Grão Alimentos", categoria: "alimentacao", nivel: "regional", reputacaoMinima: 26, baseSemanal: 2_100, aparicoes: 2, exclusividade: ["alimentacao"], procura: "juventude" },
  // ⚠️ A casa de apostas paga acima do nível dela e COBRA EM TORCIDA. É a única
  // marca do catálogo cujo custo principal não é energia nem exclusividade — e
  // existe para que "aceitar o maior valor" não seja sempre a jogada óbvia.
  { id: "sorte_viva", nome: "SorteViva", categoria: "apostas", nivel: "nacional", reputacaoMinima: 46, baseSemanal: 19_000, aparicoes: 2, exclusividade: ["apostas"], custoDeTorcida: 9, procura: "imagem" },
]

export type TipoDeClausula = "gols" | "jogos" | "aparicoes"

export interface ClausulaDoPatrocinio {
  tipo: TipoDeClausula
  alvo: number
  cumprido: number
  /** Bônus pago ao cumprir; multa cobrada ao furar. */
  bonus: number
  multa: number
}

export interface ContratoDePatrocinio {
  id: string
  marcaId: string
  marca: string
  categoria: CategoriaDeMarca
  valorSemanal: number
  bonusPorGol: number
  /** Luvas pagas na assinatura. */
  luvas: number
  semanasTotais: number
  semanasRestantes: number
  clausulas: ClausulaDoPatrocinio[]
  /** Aparições exigidas na temporada e quantas já foram feitas. */
  aparicoesExigidas: number
  aparicoesFeitas: number
  assinadoNaTemporada: number
}

export interface PropostaDePatrocinio {
  id: string
  marcaId: string
  marca: string
  categoria: CategoriaDeMarca
  nivel: NivelDaMarca
  valorSemanal: number
  bonusPorGol: number
  luvas: number
  semanas: number
  clausulas: ClausulaDoPatrocinio[]
  aparicoes: number
  custoDeTorcida: number
  /** Quantas rodadas até a proposta sumir. */
  expiraEmRodadas: number
  /** Quantas vezes o atleta já contrapropôs. Três é o limite. */
  rodadaDeNegociacao: number
  /** Teto que a marca aceita pagar. Nunca é mostrado cru ao jogador. */
  tetoSemanal: number
  estado: "aberta" | "recusada" | "assinada"
  recado?: string
}

/** O retrato do atleta que decide quem faz proposta e de quanto. */
export interface PerfilComercial {
  reputacao: number
  torcida: number
  idade: number
  /** Gols na temporada corrente. */
  gols: number
  jogos: number
  media: number
  /** `patrimonio.estilo` — os itens de status entram no cálculo por aqui. */
  estilo: number
  relacoes: Relacoes
  temporada: number
  rodada: number
  /** Categorias já ocupadas por contratos ativos. */
  categoriasOcupadas: CategoriaDeMarca[]
}

const limitar = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v))

/** Mesma semente com avalanche de `dilemas-do-atleta` — e pelo mesmo motivo. */
function semente(texto: string): number {
  let h = 2166136261
  for (let i = 0; i < texto.length; i++) { h ^= texto.charCodeAt(i); h = Math.imul(h, 16777619) }
  h ^= h >>> 16
  h = Math.imul(h, 2246822507)
  h ^= h >>> 13
  h = Math.imul(h, 3266489909)
  h ^= h >>> 16
  return (h >>> 0) / 4294967295
}

/**
 * QUANTO O ATLETA VALE PARA UMA MARCA — o multiplicador que move tudo.
 *
 * ⚠️ O `estilo` ENTRA AQUI, E É ISSO QUE FAZ OS ITENS DE STATUS EXISTIREM. Até
 * a 1.0.376 comprar a lancha, o relógio e a casa somava um número chamado
 * `estilo` que NADA lia — o jogador gastava 1,2 milhão para ver um contador
 * subir. Agora patrimônio é vitrine: quem se veste de estrela recebe proposta
 * de estrela, o que também explica por que os bens têm manutenção semanal.
 * Peso deliberadamente modesto (até +22%): estilo abre porta, não substitui
 * futebol.
 */
export function apeloComercial(p: PerfilComercial): number {
  const marca = forcaDaMarcaPessoal(p.relacoes)
  const fama = 0.55 + (limitar(p.reputacao, 0, 100) / 100) * 0.85
  const arquibancada = 0.9 + (limitar(p.torcida, 0, 100) / 100) * 0.28
  const vitrine = 1 + limitar(p.estilo, 0, 120) / 545
  // ⚠️ A JUVENTUDE VALE, MAS NÃO É TUDO. Um atleta de 33 anos com reputação 90
  // continua acima de um de 21 com reputação 40 — o fator etário mexe ±12%, não
  // decide sozinho. Publicidade compra futuro, mas paga por quem já é conhecido.
  const idade = p.idade <= 23 ? 1.12 : p.idade >= 33 ? 0.88 : 1
  return Math.round(marca * fama * arquibancada * vitrine * idade * 1000) / 1000
}

/** O que cada marca procura, e quanto o atleta entrega disso (0 a 1,4). */
function encaixeComAMarca(m: Marca, p: PerfilComercial): number {
  switch (m.procura) {
    case "gols": return limitar(0.4 + p.gols / 18, 0, 1.4)
    case "regularidade": return limitar(0.4 + p.jogos / 30 + (p.media - 6) / 8, 0, 1.4)
    case "imagem": return limitar(0.35 + p.reputacao / 110 + p.estilo / 180, 0, 1.4)
    case "juventude": return limitar(p.idade <= 21 ? 1.25 : p.idade <= 25 ? 1 : 1.35 - p.idade / 26, 0, 1.4)
  }
}

/**
 * AS PROPOSTAS QUE CHEGAM NESTA RODADA.
 *
 * ⚠️ ELAS NÃO CHEGAM TODA SEMANA, e a lista não é "tudo que a reputação
 * alcança". Uma vitrine com sete marcas abertas o tempo todo é um catálogo, e
 * catálogo não tem urgência: o jogador escolheria a maior e ignoraria o resto
 * para sempre. Aqui chegam no máximo duas por vez, elas EXPIRAM, e a recusada
 * hoje pode não voltar na próxima janela.
 */
export function propostasDaRodada(p: PerfilComercial): PropostaDePatrocinio[] {
  const janela = semente(`patro:${p.temporada}:${p.rodada}`)
  if (janela > 0.34) return []

  const apelo = apeloComercial(p)

  const elegiveis = MARCAS.filter(m => {
    if (p.reputacao < m.reputacaoMinima) return false
    // exclusividade: a categoria ocupada não manda proposta nova
    if (m.exclusividade.some(c => p.categoriasOcupadas.includes(c))) return false
    if (p.categoriasOcupadas.includes(m.categoria)) return false
    return encaixeComAMarca(m, p) >= 0.55
  })
  if (elegiveis.length === 0) return []

  const quantas = apelo >= 1.25 ? 2 : 1
  const escolhidas: Marca[] = []
  for (let i = 0; i < quantas && i < elegiveis.length; i++) {
    const idx = Math.floor(semente(`qual:${p.temporada}:${p.rodada}:${i}`) * elegiveis.length)
    const m = elegiveis[Math.min(idx, elegiveis.length - 1)]
    if (!escolhidas.some(e => e.id === m.id)) escolhidas.push(m)
  }

  return escolhidas.map(m => montarProposta(m, p, apelo))
}

function montarProposta(m: Marca, p: PerfilComercial, apelo: number): PropostaDePatrocinio {
  const encaixe = encaixeComAMarca(m, p)
  const valorSemanal = Math.round((m.baseSemanal * apelo * encaixe) / 100) * 100
  const semanas = m.nivel === "regional" ? 16 : m.nivel === "nacional" ? 24 : m.nivel === "continental" ? 34 : 46
  const bonusPorGol = Math.round((valorSemanal * 0.38) / 100) * 100

  /**
   * ⚠️ A META SAI DO QUE O ATLETA JÁ FAZ, NÃO DE UMA TABELA FIXA. Uma meta de
   * 14 gols para um zagueiro é um contrato desenhado para ser furado, e furar
   * cobra multa — o sistema estaria punindo o jogador por aceitar uma proposta
   * que ele nunca teve como cumprir. Aqui ela pede ~30% acima do ritmo atual.
   */
  const ritmoDeGols = p.jogos > 0 ? (p.gols / p.jogos) : 0.1
  const clausulas: ClausulaDoPatrocinio[] = []

  if (m.procura === "gols" || ritmoDeGols >= 0.25) {
    const alvo = Math.max(2, Math.round(ritmoDeGols * (semanas * 0.8) * 1.3))
    clausulas.push({ tipo: "gols", alvo, cumprido: 0, bonus: bonusPorGol * alvo * 0.6, multa: valorSemanal * 5 })
  }
  clausulas.push({
    tipo: "jogos",
    alvo: Math.max(6, Math.round(semanas * 0.55)),
    cumprido: 0,
    bonus: valorSemanal * 3,
    multa: valorSemanal * 4,
  })
  if (m.aparicoes > 0) {
    clausulas.push({ tipo: "aparicoes", alvo: m.aparicoes, cumprido: 0, bonus: valorSemanal * 2, multa: valorSemanal * 6 })
  }

  return {
    id: `patro_${m.id}_${p.temporada}_${p.rodada}`,
    marcaId: m.id,
    marca: m.nome,
    categoria: m.categoria,
    nivel: m.nivel,
    valorSemanal,
    bonusPorGol,
    luvas: Math.round((valorSemanal * semanas * 0.18) / 1000) * 1000,
    semanas,
    clausulas,
    aparicoes: m.aparicoes,
    custoDeTorcida: m.custoDeTorcida ?? 0,
    expiraEmRodadas: 3,
    rodadaDeNegociacao: 0,
    // O teto é 1,32x o valor da mesa e sobe pouco a cada rodada de conversa —
    // insistir vale a pena até o terceiro pedido, e a partir dali custa a mesa.
    tetoSemanal: Math.round(valorSemanal * 1.32),
    estado: "aberta",
  }
}

export type PedidoNaNegociacao = "valor" | "prazo" | "tirar_clausula" | "luvas"

/**
 * A CONTRAPROPOSTA — e o único jeito de a marca dizer não.
 *
 * ⚠️ ELA RECUSA DE VERDADE, e a proposta morre. Uma negociação em que a pior
 * hipótese é "a marca repete a oferta anterior" não é negociação: o jogador
 * pediria o máximo em toda proposta, sempre, sem risco nenhum. O quarto pedido
 * encerra a conversa, e o contrato que estava na mesa vai embora com ela.
 */
export function contraproporPatrocinio(
  proposta: PropostaDePatrocinio,
  pedido: PedidoNaNegociacao,
  perfil: PerfilComercial,
): PropostaDePatrocinio {
  if (proposta.estado !== "aberta") return proposta
  const rodada = proposta.rodadaDeNegociacao + 1

  if (rodada > 3) {
    return { ...proposta, rodadaDeNegociacao: rodada, estado: "recusada", recado: "A marca encerrou as conversas." }
  }

  // A paciência da marca é a relação com as marcas: quem tem histórico ganha
  // mais margem, e é o segundo efeito real de `relacoes.marcas`.
  const paciencia = forcaDaMarcaPessoal(perfil.relacoes)
  const chanceDeAceitar = limitar(0.72 * paciencia - rodada * 0.16, 0.05, 0.9)
  const sorteio = semente(`nego:${proposta.id}:${pedido}:${rodada}`)

  if (sorteio > chanceDeAceitar) {
    const desistiu = rodada >= 3 && sorteio > chanceDeAceitar + 0.35
    return desistiu
      ? { ...proposta, rodadaDeNegociacao: rodada, estado: "recusada", recado: "A marca preferiu procurar outro nome." }
      : { ...proposta, rodadaDeNegociacao: rodada, recado: "A marca ouviu e manteve a oferta." }
  }

  switch (pedido) {
    case "valor": {
      const novo = Math.min(proposta.tetoSemanal, Math.round(proposta.valorSemanal * 1.14))
      return { ...proposta, valorSemanal: novo, rodadaDeNegociacao: rodada, recado: "A marca subiu o valor semanal." }
    }
    case "luvas":
      return { ...proposta, luvas: Math.round(proposta.luvas * 1.5), rodadaDeNegociacao: rodada, recado: "A marca aumentou as luvas de assinatura." }
    case "prazo": {
      // Contrato mais curto vale menos por semana: a marca compra previsibilidade.
      const semanas = Math.max(8, Math.round(proposta.semanas * 0.7))
      return {
        ...proposta,
        semanas,
        valorSemanal: Math.round(proposta.valorSemanal * 0.93),
        clausulas: proposta.clausulas.map(c => ({ ...c, alvo: Math.max(1, Math.round(c.alvo * 0.7)) })),
        rodadaDeNegociacao: rodada,
        recado: "Contrato mais curto, valor semanal um pouco menor.",
      }
    }
    case "tirar_clausula": {
      // ⚠️ TIRAR A CLÁUSULA CUSTA O BÔNUS DELA E MAIS UM PEDAÇO DO SEMANAL. Sem
      // isso, "tirar todas as cláusulas" seria a primeira coisa a fazer em toda
      // proposta e o contrato viraria renda passiva.
      const mantidas = proposta.clausulas.filter(c => c.tipo !== "aparicoes")
      const alvo = mantidas.length === proposta.clausulas.length ? proposta.clausulas.slice(0, -1) : mantidas
      return {
        ...proposta,
        clausulas: alvo,
        aparicoes: mantidas.length === proposta.clausulas.length ? proposta.aparicoes : 0,
        valorSemanal: Math.round(proposta.valorSemanal * 0.88),
        rodadaDeNegociacao: rodada,
        recado: "A marca abriu mão de uma exigência — e do valor que ela pagava.",
      }
    }
  }
}

/** Vira contrato. O `id` carrega a temporada para o histórico não colidir. */
export function assinarProposta(p: PropostaDePatrocinio, temporada: number): ContratoDePatrocinio {
  return {
    id: `${p.marcaId}@${temporada}`,
    marcaId: p.marcaId,
    marca: p.marca,
    categoria: p.categoria,
    valorSemanal: p.valorSemanal,
    bonusPorGol: p.bonusPorGol,
    luvas: p.luvas,
    semanasTotais: p.semanas,
    semanasRestantes: p.semanas,
    clausulas: p.clausulas.map(c => ({ ...c })),
    aparicoesExigidas: p.aparicoes,
    aparicoesFeitas: 0,
    assinadoNaTemporada: temporada,
  }
}

export interface RendimentoDaSemana {
  contratos: ContratoDePatrocinio[]
  /** Quanto entrou nesta rodada, somando semanal e bônus por gol. */
  dinheiro: number
  /** Contratos que venceram nesta rodada, já avaliados. */
  encerrados: { contrato: ContratoDePatrocinio; saldo: number; cumpriu: boolean; resumo: string }[]
  /** Delta a aplicar em `relacoes.marcas`. */
  ajusteDeMarcas: number
}

/**
 * O QUE OS PATROCÍNIOS FAZEM NUMA RODADA.
 *
 * ⚠️ FUNÇÃO PURA, DE PROPÓSITO. Ela não escreve no estado da carreira: devolve
 * o que aconteceu e quem chamou aplica. É a mesma disciplina de
 * `relacoes-do-atleta` e existe pelo mesmo motivo — um efeito que se aplica
 * sozinho é um efeito que se aplica duas vezes no dia em que alguém chamar a
 * função para MOSTRAR o valor na tela.
 */
export function rodarSemanaDePatrocinio(
  contratos: ContratoDePatrocinio[],
  eventos: { golsNaRodada: number; jogou: boolean },
): RendimentoDaSemana {
  let dinheiro = 0
  let ajusteDeMarcas = 0
  const encerrados: RendimentoDaSemana["encerrados"] = []
  const seguem: ContratoDePatrocinio[] = []

  for (const c0 of contratos) {
    const c = { ...c0, clausulas: c0.clausulas.map(x => ({ ...x })) }
    dinheiro += c.valorSemanal + eventos.golsNaRodada * c.bonusPorGol

    for (const cl of c.clausulas) {
      if (cl.tipo === "gols") cl.cumprido += eventos.golsNaRodada
      if (cl.tipo === "jogos" && eventos.jogou) cl.cumprido += 1
      if (cl.tipo === "aparicoes") cl.cumprido = c.aparicoesFeitas
    }

    c.semanasRestantes -= 1
    if (c.semanasRestantes > 0) { seguem.push(c); continue }

    const avaliacao = avaliarContrato(c)
    dinheiro += avaliacao.saldo
    ajusteDeMarcas += avaliacao.cumpriu ? 12 : -14
    encerrados.push({ contrato: c, ...avaliacao })
  }

  return { contratos: seguem, dinheiro, encerrados, ajusteDeMarcas }
}

/** Fecha as contas de um contrato: bônus das cláusulas cumpridas, multa das furadas. */
export function avaliarContrato(c: ContratoDePatrocinio): { saldo: number; cumpriu: boolean; resumo: string } {
  let saldo = 0
  const partes: string[] = []
  let todas = true

  for (const cl of c.clausulas) {
    const ok = cl.cumprido >= cl.alvo
    if (ok) { saldo += cl.bonus; partes.push(`${rotuloDaClausula(cl.tipo)} ${cl.cumprido}/${cl.alvo} cumprida`) }
    else { saldo -= cl.multa; todas = false; partes.push(`${rotuloDaClausula(cl.tipo)} ${cl.cumprido}/${cl.alvo} não cumprida`) }
  }

  return { saldo: Math.round(saldo), cumpriu: todas, resumo: partes.join(" · ") }
}

export function rotuloDaClausula(t: TipoDeClausula): string {
  return t === "gols" ? "Gols" : t === "jogos" ? "Jogos" : "Aparições"
}

export function rotuloDaCategoriaDeMarca(c: CategoriaDeMarca): string {
  const mapa: Record<CategoriaDeMarca, string> = {
    material_esportivo: "Material esportivo",
    bebida: "Bebidas",
    banco: "Banco",
    tecnologia: "Tecnologia",
    moda: "Moda",
    apostas: "Apostas",
    automotivo: "Automotivo",
    alimentacao: "Alimentação",
  }
  return mapa[c]
}

export function rotuloDoNivelDaMarca(n: NivelDaMarca): string {
  return n === "regional" ? "Regional" : n === "nacional" ? "Nacional" : n === "continental" ? "Continental" : "Global"
}

/**
 * UMA APARIÇÃO CUMPRIDA — o custo em energia que impede a carteira infinita.
 *
 * ⚠️ 12 DE ENERGIA POR APARIÇÃO, E É ISSO QUE FECHA O SISTEMA. Sem custo em
 * energia, o ótimo seria assinar com todas as categorias livres e nunca mais
 * pensar; com custo, cada marca a mais é uma semana de treino a menos. É o
 * mesmo desenho de `definirIntensidadeDeTreino`: a escolha existe porque o
 * caminho mais rentável cobra em outro lugar.
 */
export const ENERGIA_POR_APARICAO = 12

export function cumprirAparicao(c: ContratoDePatrocinio): ContratoDePatrocinio {
  return { ...c, aparicoesFeitas: Math.min(c.aparicoesExigidas, c.aparicoesFeitas + 1) }
}

/** Quantas marcas o catálogo oferece — o gate usa isto para pegar regressão. */
export const TOTAL_DE_MARCAS = MARCAS.length
