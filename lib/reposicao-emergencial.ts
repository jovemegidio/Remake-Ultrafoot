// REDE DE SEGURANCA DO ELENCO — o clube nunca pode ficar sem time para escalar.
//
// A rede ja existia no `processSeasonEnd` (constante MINIMO_PARA_JOGAR), mas com
// dois furos:
//
//   1. So rodava na VIRADA DA TEMPORADA. Contratos vencem semana a semana, entao
//      entre uma virada e outra o elenco despencava sem nenhum piso — medido:
//      39 -> 15 atletas em uma temporada.
//   2. O piso era 11: exatamente o minimo para escalar, sem banco, sem cobertura
//      para lesao ou suspensao. Um lesionado ja deixava o time impossivel de
//      escalar.
//
// Este modulo e PURO (nao toca no estado do Zustand nem no relogio) para poder
// ser testado sozinho. Quem chama decide QUANDO repor; aqui so se decide QUEM.
//
// ⚠️ O ATLETA EMERGENCIAL VALE ZERO NO MERCADO — e proposital, nao esquecimento.
// Quando a reposicao valia dinheiro, o ciclo "vender o elenco inteiro -> receber
// elenco novo de graca -> vender de novo" era uma impressora. Ele existe so para
// o clube conseguir entrar em campo.

import { playerSalaryWeekly } from "@/lib/club-economy"

/** Minimo para o clube conseguir escalar COM banco e cobertura de lesao. */
export const ELENCO_MINIMO = 18
/** Abaixo disto o time nao entra em campo de jeito nenhum. */
export const MINIMO_PARA_JOGAR = 11

const NOMES = ["Alan","Bruno","Caio","Danilo","Edson","Fabio","Gustavo","Heitor","Igor","Juliano","Kaique","Lucas","Murilo","Nelson","Otavio","Paulo","Renan","Sergio","Tiago","Vinicius"]
const SOBRENOMES = ["Almeida","Barbosa","Cardoso","Duarte","Esteves","Fonseca","Guedes","Henrique","Iglesias","Jardim","Klein","Lacerda","Moraes","Novaes","Padilha","Queiroz","Ramos","Salgado","Tavares","Vieira"]

/** Ordem de preenchimento quando o elenco esta desfalcado em todo lugar. */
const ORDEM_DE_CARENCIA = ["GOL","ZAG","ZAG","LD","LE","VOL","VOL","MEI","MEI","ATA","PD","PE","ZAG","MEI","ATA","GOL","VOL","LD"]

const SETOR: Record<string, "GOL" | "DEF" | "MEI" | "ATA"> = {
  GOL: "GOL",
  ZAG: "DEF", LD: "DEF", LE: "DEF", LAT: "DEF", DEF: "DEF",
  VOL: "MEI", MEI: "MEI",
  ATA: "ATA", PE: "ATA", PD: "ATA", BAN: "MEI",
}

/** Minimo por setor — sem isto a rede podia entregar 18 meias e nenhum goleiro. */
const MINIMO_POR_SETOR: Record<"GOL" | "DEF" | "MEI" | "ATA", number> = { GOL: 2, DEF: 5, MEI: 5, ATA: 3 }

export interface AtletaExistente {
  readonly position: string
  readonly overall: number
  /** Usado so para nao gerar homonimo dentro do mesmo elenco. */
  readonly name?: string
}

export interface ReforcoEmergencial {
  name: string
  position: string
  age: number
  overall: number
  potential: number
  nationality: string
  salarioSemanal: number
  /** Sempre 0 — ver o aviso do topo do arquivo. */
  marketValue: 0
}

/** PRNG deterministico: o mesmo elenco na mesma semana gera a mesma reposicao. */
function semente(texto: string): () => number {
  let h = 2166136261
  for (const c of texto) h = Math.imul(h ^ c.charCodeAt(0), 16777619)
  return () => {
    h = Math.imul(h ^ (h >>> 15), h | 1)
    h ^= h + Math.imul(h ^ (h >>> 7), h | 61)
    return ((h ^ (h >>> 14)) >>> 0) / 4294967296
  }
}

/** Quantas vagas faltam por setor para o elenco ser escalavel. */
export function carenciasDoElenco(elenco: readonly AtletaExistente[]): Record<string, number> {
  const porSetor: Record<string, number> = { GOL: 0, DEF: 0, MEI: 0, ATA: 0 }
  for (const a of elenco) porSetor[SETOR[a.position?.toUpperCase()] ?? "MEI"]++
  const falta: Record<string, number> = {}
  for (const [setor, minimo] of Object.entries(MINIMO_POR_SETOR)) {
    const diferenca = minimo - (porSetor[setor] ?? 0)
    if (diferenca > 0) falta[setor] = diferenca
  }
  return falta
}

/**
 * Quem o clube precisa contratar as pressas para voltar a ter time.
 *
 * Devolve lista VAZIA quando o elenco ja atende ao piso — o caminho normal.
 * O `overall` sai um degrau abaixo da media do elenco: e um remendo de ultima
 * hora, nao um reforco.
 */
export function reforcosEmergenciais(
  elenco: readonly AtletaExistente[],
  opts: { divisao: string; temporada: number; semana: number; minimo?: number },
): ReforcoEmergencial[] {
  const minimo = opts.minimo ?? ELENCO_MINIMO
  const carencias = carenciasDoElenco(elenco)
  const faltaPorSetor = Object.values(carencias).reduce((t, n) => t + n, 0)
  const faltaNoTotal = Math.max(0, minimo - elenco.length)
  const quantidade = Math.max(faltaNoTotal, faltaPorSetor)
  if (quantidade <= 0) return []

  const media = elenco.length
    ? Math.round(elenco.reduce((t, a) => t + a.overall, 0) / elenco.length)
    : 58
  const rnd = semente(`${opts.divisao}:${opts.temporada}:${opts.semana}:${elenco.length}`)

  // Primeiro as posicoes em falta de verdade; depois a ordem generica, PULANDO
  // setor que ja encheu. Sem esse teto o elenco terminava com 5 goleiros: a
  // ordem generica comeca por GOL e reabre a vaga toda vez que e reciclada.
  const TETO_POR_SETOR: Record<string, number> = { GOL: 3, DEF: 8, MEI: 8, ATA: 6 }
  const previsto: Record<string, number> = { GOL: 0, DEF: 0, MEI: 0, ATA: 0 }
  for (const a of elenco) previsto[SETOR[a.position?.toUpperCase()] ?? "MEI"]++

  const posicoes: string[] = []
  const admitir = (p: string) => {
    const setor = SETOR[p] ?? "MEI"
    if (previsto[setor] >= TETO_POR_SETOR[setor]) return false
    previsto[setor]++
    posicoes.push(p)
    return true
  }
  for (const [setor, quantos] of Object.entries(carencias)) {
    const daquele = ORDEM_DE_CARENCIA.filter(p => (SETOR[p] ?? "MEI") === setor)
    for (let i = 0; i < quantos && posicoes.length < quantidade; i++) admitir(daquele[i % daquele.length] ?? "MEI")
  }
  for (let volta = 0; posicoes.length < quantidade && volta < 6; volta++) {
    for (const p of ORDEM_DE_CARENCIA) {
      if (posicoes.length >= quantidade) break
      admitir(p)
    }
  }
  // Ultimo recurso: se todo setor bateu no teto, completa no meio-campo.
  while (posicoes.length < quantidade) posicoes.push("MEI")

  // Homonimo dentro do mesmo elenco ja custou caro neste projeto (escalacao
  // salva por nome gravava o xara). Aqui a unicidade e garantida na origem.
  const usados = new Set(elenco.map(a => (a.name ?? "").trim().toLocaleLowerCase("pt-BR")).filter(Boolean))

  return posicoes.map((position) => {
    const overall = Math.max(42, Math.min(70, media - 6 - Math.floor(rnd() * 5)))
    let name = ""
    for (let tentativa = 0; tentativa < 40; tentativa++) {
      const candidato = `${NOMES[Math.floor(rnd() * NOMES.length)]} ${SOBRENOMES[Math.floor(rnd() * SOBRENOMES.length)]}`
      if (!usados.has(candidato.toLocaleLowerCase("pt-BR"))) { name = candidato; break }
    }
    if (!name) name = `${NOMES[Math.floor(rnd() * NOMES.length)]} ${SOBRENOMES[Math.floor(rnd() * SOBRENOMES.length)]} ${usados.size}`
    usados.add(name.toLocaleLowerCase("pt-BR"))
    return {
      name,
      position,
      age: 24 + Math.floor(rnd() * 10),
      overall,
      potential: overall + Math.floor(rnd() * 4),
      nationality: "Brasil",
      salarioSemanal: playerSalaryWeekly(overall, opts.divisao),
      marketValue: 0 as const,
    }
  })
}
