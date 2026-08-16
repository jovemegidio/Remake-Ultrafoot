// ELENCOS REAIS DO FUTEBOL FEMININO, CARREGADOS SOB DEMANDA.
//
// A 1.0.322 nasceu com 21 ligas femininas e ZERO atleta real — tudo gerado, e a
// tela de criação dizia isso em vez de prometer. Este módulo é o outro lado:
// serve os elencos importados por `scripts/import-elencos-femininos.mjs`.
//
// Mesma estratégia de `pool-elencos` e `elencos-reais-tm`, e pelas mesmas três
// razões: (1) seed não pode viajar no chunk compartilhado de toda tela; (2) o
// acessor é SÍNCRONO porque `getPlayersForTeam` é chamado em render por dezenas
// de telas; (3) no Node (QA, prerender) a leitura é síncrona e imediata.
//
// ⚠️ O QUE É REAL E O QUE NÃO É — importa não mentir sobre isso:
//   • REAIS: nome, posição e nacionalidade, vindos da página do clube feminino
//     na Wikipedia (o Transfermarkt não indexa clube feminino na busca pt-BR —
//     medido em 15/08/2026).
//   • DERIVADOS: idade e overall. Não existem na fonte; são calculados a partir
//     do prestígio do clube e da ordem no elenco, de forma determinística. É a
//     mesma regra que o jogo já aplica a clube masculino sem dado de força.

export interface AtletaFeminina {
  /** Nome. */
  n: string
  /** Posição no código do jogo (GOL/ZAG/LD/LE/VOL/MEI/PD/PE/ATA). */
  p: string
  /** Nacionalidade em três letras, quando a fonte trouxer. */
  c?: string
  /** Número da camisa. */
  no?: number
}

interface ElencoImportado {
  v: number
  fonte: string
  atletas: AtletaFeminina[]
}

/** Chave `<divisao>|<nome do clube sem " Feminino">`. */
type Acervo = Record<string, ElencoImportado>

let cache: Acervo | null = null
let carregando: Promise<Acervo> | null = null
let falhas = 0
const MAXIMO_DE_TENTATIVAS = 3

function lerNoNode(): Acervo | null {
  if (typeof window !== "undefined") return null
  if (typeof process === "undefined" || !process.versions?.node) return null
  try {
    // eslint-disable-next-line no-eval
    const req = eval("require") as NodeRequire
    const fs = req("node:fs") as typeof import("node:fs")
    const path = req("node:path") as typeof import("node:path")
    return JSON.parse(fs.readFileSync(path.join(process.cwd(), "data/seeds/elencos-femininos.json"), "utf-8")) as Acervo
  } catch {
    return null
  }
}

export function carregarElencosFemininos(): Promise<Acervo> {
  if (cache) return Promise.resolve(cache)
  if (carregando) return carregando
  if (falhas >= MAXIMO_DE_TENTATIVAS) return Promise.resolve({} as Acervo)
  const doNode = lerNoNode()
  if (doNode) {
    cache = doNode
    return Promise.resolve(cache)
  }
  carregando = import("@/data/seeds/elencos-femininos.json")
    .then(modulo => {
      cache = ((modulo as { default?: Acervo }).default ?? modulo) as Acervo
      return cache
    })
    .catch(() => {
      // Teto de tentativas pelo mesmo motivo do pool: o acessor roda em render.
      falhas++
      carregando = null
      return {} as Acervo
    })
  return carregando
}

export function elencosFemininosProntos(): boolean {
  if (cache) return true
  const doNode = lerNoNode()
  if (doNode) { cache = doNode; return true }
  return false
}

/** Nome do clube como o cadastro o escreve (sem o sufixo que o jogo acrescenta). */
export function chaveDoElencoFeminino(divisao: string, nome: string): string {
  return `${divisao}|${nome.replace(/ Feminino$/, "")}`
}

/**
 * Elenco real do clube feminino, ou `undefined` (aí o jogo gera, como antes).
 * Síncrono: dispara o carregamento e a chamada seguinte já responde.
 */
export function elencoFemininoDoClube(divisao: string | undefined, nome: string | undefined): AtletaFeminina[] | undefined {
  if (!divisao || !nome) return undefined
  if (!cache && !elencosFemininosProntos()) {
    void carregarElencosFemininos()
    return undefined
  }
  return cache?.[chaveDoElencoFeminino(divisao, nome)]?.atletas
}

/** Quantos clubes femininos têm elenco real — a tela de criação mostra isso. */
export function clubesComElencoFeminino(): number {
  if (!cache && !elencosFemininosProntos()) {
    void carregarElencosFemininos()
    return 0
  }
  return Object.keys(cache ?? {}).length
}
