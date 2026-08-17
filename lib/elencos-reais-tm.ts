// ELENCOS REAIS DO TRANSFERMARKT, CARREGADOS SOB DEMANDA.
//
// O segundo — e último grande — seed que viajava no JavaScript de toda tela.
//
// Medido em 12/08/2026, na 1.0.295, depois de a 1.0.292 já ter tirado o
// `imported-bf2026`: cada tela ainda baixava de 7,7 a 11,3 MB de JS, e **4,82 MB
// disso era um arquivo só**, com 42.353 nomes de atletas dentro. Era este:
// `real-squads-tm.json`, 4,31 MB, importado estaticamente por `players-data`,
// `player-photos` e `transfer-engine` — e `players-data` é importado por
// `game-engine` e `use-game-manager`, ou seja, por absolutamente toda tela.
//
// A 292 tirou o peso maior e deixou o segundo. Este módulo aplica exatamente o
// mesmo tratamento, e pelo mesmo motivo: o dado só faz falta quando alguém pede
// um elenco, não quando a tela monta.
//
// ⚠️ As três armadilhas são as MESMAS de `lib/pool-elencos.ts`, e estão lá
// documentadas: memoização que congela o vazio, gravação de dado derivado com o
// cache frio, e o Node que precisa de leitura síncrona para os scripts de QA.

/** n=nome p=posicao c=nacionalidade f=foto i=idade o=overall */
export interface AtletaRealTM {
  n: string
  p: string
  c?: string
  f?: string
  i: number
  o: number
}

/** Chave `<CURTO>|<nome normalizado>` -> elenco. */
type MapaDeElencosTM = Record<string, AtletaRealTM[]>

/**
 * O FORMATO COMPACTO QUE O BUNDLE CARREGA (1.0.342).
 *
 * ⚠️ Este arquivo já usava chave de uma letra e ainda assim era o SEGUNDO maior
 * chunk do jogo (4,38 MB) — a prova de que encurtar chave não basta: `"n":`
 * custa 4 bytes por campo, em seis campos e 60.488 atletas. A linha vira array
 * posicional e os dois vocabulários fechados viram índice. Medido: 4,31 -> 2,27 MB.
 *
 * ⚠️ A ORDEM É CONTRATO com `scripts/compactar-elencos-tm.mjs`, e erra em
 * SILÊNCIO — trocar duas posições dá atleta com idade no lugar do overall. O
 * gate `test-elencos-compactos.ts` compara campo a campo por isso.
 */
type LinhaTM = [
  n: string, p: number | null, o: number | null, i: number | null,
  c?: number | null, f?: string | null,
]

export interface ElencosTMCompactos {
  v: number
  ordem: string[]
  pos: string[]
  nac: string[]
  clubes: Record<string, LinhaTM[]>
}

export function expandirElencosTM(compacto: ElencosTMCompactos): MapaDeElencosTM {
  const mapa: MapaDeElencosTM = {}
  const poss = compacto.pos ?? []
  const nacs = compacto.nac ?? []
  for (const [clube, elenco] of Object.entries(compacto.clubes ?? {})) {
    mapa[clube] = elenco.map(([n, p, o, i, c, f]) => {
      const atleta: AtletaRealTM = {
        n,
        p: p == null ? "" : (poss[p] ?? ""),
        o: o ?? 0,
        i: i ?? 0,
      }
      if (c != null) atleta.c = nacs[c]
      if (f != null) atleta.f = f
      return atleta
    })
  }
  return mapa
}

let cache: MapaDeElencosTM | null = null
let carregando: Promise<MapaDeElencosTM> | null = null
let falhas = 0
const MAXIMO_DE_TENTATIVAS = 3

/** Node/prerender: lê do disco na hora. O `eval` impede o webpack de embutir o fs no cliente. */
function lerNoNode(): MapaDeElencosTM | null {
  if (typeof window !== "undefined") return null
  if (typeof process === "undefined" || !process.versions?.node) return null
  try {
    // eslint-disable-next-line no-eval
    const req = eval("require") as NodeRequire
    const fs = req("node:fs") as typeof import("node:fs")
    const path = req("node:path") as typeof import("node:path")
    const arquivo = path.join(process.cwd(), "data/seeds/real-squads-tm.json")
    return JSON.parse(fs.readFileSync(arquivo, "utf-8")) as MapaDeElencosTM
  } catch {
    return null
  }
}

/** Carrega uma vez. Chamadas concorrentes compartilham a mesma promessa. */
export function carregarElencosReaisTM(): Promise<MapaDeElencosTM> {
  if (cache) return Promise.resolve(cache)
  if (carregando) return carregando
  if (falhas >= MAXIMO_DE_TENTATIVAS) return Promise.resolve({} as MapaDeElencosTM)
  const doNode = lerNoNode()
  if (doNode) {
    cache = doNode
    return Promise.resolve(cache)
  }
  carregando = import("@/data/seeds/real-squads-tm-compacto.json")
    .then((modulo) => {
      const bruto = ((modulo as { default?: unknown }).default ?? modulo) as ElencosTMCompactos
      cache = expandirElencosTM(bruto)
      return cache
    })
    .catch(() => {
      falhas++
      carregando = null
      return {} as MapaDeElencosTM
    })
  return carregando
}

/** Já dá para ler sem esperar? Quem grava dado derivado disto tem de checar. */
export function elencosTMProntos(): boolean {
  if (cache) return true
  const doNode = lerNoNode()
  if (doNode) {
    cache = doNode
    return true
  }
  return false
}

/**
 * O mapa inteiro, síncrono. Vazio enquanto não chegou — e dispara o
 * carregamento, então a chamada seguinte já responde.
 */
export function elencosReaisTM(): MapaDeElencosTM {
  if (!cache && !elencosTMProntos()) {
    void carregarElencosReaisTM()
    return {}
  }
  return cache ?? {}
}
