// ELENCOS DO POOL, CARREGADOS SOB DEMANDA.
//
// Por que este módulo existe
// ──────────────────────────
// `data/seeds/imported-bf2026.json` tem 8,91 MB porque cada um dos 2.994 clubes
// carrega o array `jogadores` embutido. Quatro módulos o importavam ESTATICAMENTE
// (`players-data`, `player-photos`, `transfer-engine`, o painel de juniores), e
// como `players-data` é importado por `game-engine` e `use-game-manager` — que
// toda tela usa — o seed inteiro caía no chunk COMPARTILHADO: 13,80 MB medidos
// em `.next/static/chunks` na 1.0.291. Era isso que fazia TODA tela demorar a
// abrir, e não uma tela específica.
//
// A separação em índice (0,88 MB, estático) + elencos (7,91 MB, sob demanda) é o
// que tira o peso do caminho de abertura. Ver [[ultrafoot-telas-lentas-chunk-de-clubes]].
//
// Como usar
// ─────────
// - `elencoDoPool(id)` é SÍNCRONO. Devolve `undefined` enquanto os elencos não
//   chegaram, e dispara o carregamento sozinho (a chamada seguinte já responde).
// - `carregarElencosDoPool()` é o que se espera ANTES de gravar alguma coisa
//   derivada do elenco — criação de carreira, principalmente. Elenco frio ali
//   não dá erro: dá clube inteiro com atleta gerado no lugar do licenciado,
//   gravado no save para sempre.
//
// No Node (scripts de QA, testes, prerender do Next) a leitura é SÍNCRONA e
// imediata: 19 scripts importam `players-data` e esperam dado real sem await.

export interface PoolPlayerRaw {
  id?: string
  nome: string
  posicao: string
  overall: number
  idade: number
  salario?: number
  nac?: string
  ft?: string
}

type MapaDeElencos = Record<string, PoolPlayerRaw[]>

/**
 * O FORMATO COMPACTO QUE O BUNDLE CARREGA (1.0.342).
 *
 * ⚠️ O arquivo verboso saía no export como o MAIOR chunk do jogo: 7,99 MB, mais
 * que o dobro do segundo. O peso não era dos dados e sim dos NOMES DOS CAMPOS,
 * repetidos em 66.820 atletas. `scripts/compactar-elencos-do-pool.mjs` gera a
 * versão de chave curta que o runtime importa; a FONTE verbosa continua no
 * repositório, intocada, porque sete scripts a leem e escrevem.
 *
 * O formato é POSICIONAL (array), não objeto de chave curta: a v1 encurtou os
 * nomes dos campos e caiu para 5,84 MB, mas a medição mostrou que ~2,1 MB ainda
 * eram só as chaves — `"n":` custa 4 bytes, vezes 8 campos, vezes 66.820
 * atletas. Nacionalidade e posição viram índice numa tabela (199 e 12 valores
 * distintos). Medido: 7,93 -> 3,42 MB.
 *
 * As codificações de `id` e `ft` desfazem redundâncias do próprio arquivo, e
 * ambas têm exceção real — por isso são reversíveis, nunca uma regra de "99% é
 * sempre". Ver o cabeçalho do script e o gate `test-elencos-compactos.ts`.
 */
/**
 * ⚠️ A ORDEM ABAIXO É CONTRATO com `scripts/compactar-elencos-do-pool.mjs`, e um
 * contrato que erra em SILÊNCIO: trocar duas posições não quebra a tela, dá
 * atleta com a idade no lugar do overall. O arquivo carrega a própria `ordem`
 * dentro dele e o gate compara campo a campo justamente por isso.
 */
type LinhaDeAtleta = [
  nome: string,
  posicao: number | null,
  overall: number | null,
  idade: number | null,
  id?: string | null,
  salario?: number | null,
  nac?: number | null,
  ft?: string | null,
]

export interface ElencosCompactos {
  v: number
  ordem: string[]
  nac: string[]
  pos: string[]
  clubes: Record<string, LinhaDeAtleta[]>
}

export function expandirElencosCompactos(compacto: ElencosCompactos): MapaDeElencos {
  const mapa: MapaDeElencos = {}
  const nacs = compacto.nac ?? []
  const poss = compacto.pos ?? []
  for (const [clube, elenco] of Object.entries(compacto.clubes ?? {})) {
    mapa[clube] = elenco.map((linha) => {
      const [nome, iPos, overall, idade, idCurto, salario, iNac, ft] = linha
      const id = idCurto == null ? undefined : /^\d+$/.test(idCurto) ? `tm_${idCurto}` : idCurto
      const atleta: PoolPlayerRaw = {
        nome,
        posicao: iPos == null ? "" : (poss[iPos] ?? ""),
        overall: overall ?? 0,
        idade: idade ?? 0,
      }
      if (id !== undefined) atleta.id = id
      if (salario != null) atleta.salario = salario
      if (iNac != null) atleta.nac = nacs[iNac]
      if (ft != null) {
        // "!" marca o valor que NÃO seguia o padrão e foi guardado inteiro.
        atleta.ft = ft.startsWith("!") ? ft.slice(1)
          : idCurto && /^\d+$/.test(idCurto) ? `${idCurto}-${ft}` : ft
      }
      return atleta
    })
  }
  return mapa
}

let cache: MapaDeElencos | null = null
let carregando: Promise<MapaDeElencos> | null = null
let falhas = 0
const MAXIMO_DE_TENTATIVAS = 3

/** Node/prerender: lê do disco na hora. O `eval` impede o webpack de embutir o fs no bundle do cliente. */
function lerNoNode(): MapaDeElencos | null {
  if (typeof window !== "undefined") return null
  if (typeof process === "undefined" || !process.versions?.node) return null
  try {
    // eslint-disable-next-line no-eval
    const req = eval("require") as NodeRequire
    const fs = req("node:fs") as typeof import("node:fs")
    const path = req("node:path") as typeof import("node:path")
    // No Node a FONTE verbosa e lida direto: os scripts de QA rodam sem
    // prebuild, e exigir o arquivo compacto faria 19 deles quebrarem em arvore
    // recem-clonada. O compacto existe para o BUNDLE.
    const arquivo = path.join(process.cwd(), "data/seeds/imported-bf2026-elencos.json")
    return JSON.parse(fs.readFileSync(arquivo, "utf-8")) as MapaDeElencos
  } catch {
    return null
  }
}

/**
 * Carrega os elencos do pool uma única vez. Chamadas concorrentes compartilham
 * a mesma promessa — sem isto, três telas montando juntas baixariam 7,91 MB
 * três vezes.
 */
export function carregarElencosDoPool(): Promise<MapaDeElencos> {
  if (cache) return Promise.resolve(cache)
  if (carregando) return carregando
  if (falhas >= MAXIMO_DE_TENTATIVAS) return Promise.resolve({} as MapaDeElencos)
  const doNode = lerNoNode()
  if (doNode) {
    cache = doNode
    return Promise.resolve(cache)
  }
  carregando = import("@/data/seeds/pool-elencos-compacto.json")
    .then((modulo) => {
      const bruto = ((modulo as { default?: unknown }).default ?? modulo) as ElencosCompactos
      cache = expandirElencosCompactos(bruto)
      return cache
    })
    .catch(() => {
      // Falhar aqui é melhor do que travar a tela: o jogo segue com atleta
      // gerado e uma próxima chamada tenta de novo.
      //
      // ⚠️ Com teto de tentativas. `elencoDoPool` é chamado em RENDER por
      // dezenas de telas; sem o teto, um arquivo que não existe faria cada
      // render disparar um download novo — uma tempestade de requisições numa
      // situação que já é de erro.
      falhas++
      carregando = null
      return {} as MapaDeElencos
    })
  return carregando
}

/** Já dá para ler elenco sem esperar? Telas que gravam dado derivado devem checar. */
export function poolElencosProntos(): boolean {
  if (cache) return true
  const doNode = lerNoNode()
  if (doNode) {
    cache = doNode
    return true
  }
  return false
}

/**
 * Elenco de um clube do pool pelo `id` do seed. Síncrono de propósito: as
 * funções que o consomem (`getPlayersForTeam` e afins) são chamadas em render
 * por dezenas de telas e torná-las assíncronas quebraria todas de uma vez.
 */
export function elencoDoPool(id: string | undefined): PoolPlayerRaw[] | undefined {
  if (!id) return undefined
  if (!cache) {
    if (!poolElencosProntos()) {
      void carregarElencosDoPool()
      return undefined
    }
  }
  return cache?.[id]
}

/** Mapa inteiro, para quem precisa varrer todos os clubes (índice global de atletas, fotos). */
export function todosOsElencosDoPool(): MapaDeElencos {
  if (!cache && !poolElencosProntos()) {
    void carregarElencosDoPool()
    return {}
  }
  return cache ?? {}
}
