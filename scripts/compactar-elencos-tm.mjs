// COMPACTA OS ELENCOS REAIS DO TRANSFERMARKT PARA O BUNDLE (1.0.342).
//
// ⚠️ O MESMO TRATAMENTO DO `pool-elencos`, pelo mesmo motivo medido:
// `real-squads-tm.json` sai como o SEGUNDO maior chunk do jogo (4,38 MB). Ele já
// usa chave de uma letra (`n`, `p`, `c`, `f`, `i`, `o`) — e é justamente por isso
// que ele prova o ponto: encurtar chave não basta. `"n":` ainda custa 4 bytes por
// campo, e são seis campos em dezenas de milhares de atletas.
//
// Aqui a linha vira ARRAY posicional e os dois vocabulários fechados (posição e
// nacionalidade) viram índice numa tabela no topo.
//
// A FONTE continua intocada: ela é gerada e lida por scripts de importação, e
// mexer no formato em disco espalharia risco por todos eles.
//
// Uso: node scripts/compactar-elencos-tm.mjs

import { readFileSync, writeFileSync, existsSync } from "node:fs"
import path from "node:path"

const RAIZ = process.cwd()
const FONTE = path.join(RAIZ, "data/seeds/real-squads-tm.json")
const DESTINO = path.join(RAIZ, "data/seeds/real-squads-tm-compacto.json")

/** ⚠️ CONTRATO com `lib/elencos-reais-tm.ts`. Erra em silêncio se divergir. */
const ORDEM = ["n", "p", "o", "i", "c", "f"]

if (!existsSync(FONTE)) {
  console.log("elencos TM: fonte ausente, nada a compactar")
  process.exit(0)
}

const original = JSON.parse(readFileSync(FONTE, "utf-8"))

const posicoes = []
const nacionalidades = []
const iPos = new Map()
const iNac = new Map()
const indexar = (valor, tabela, mapa) => {
  if (valor === undefined) return null
  if (!mapa.has(valor)) { mapa.set(valor, tabela.length); tabela.push(valor) }
  return mapa.get(valor)
}

const clubes = {}
let atletas = 0

for (const [clube, elenco] of Object.entries(original)) {
  if (!Array.isArray(elenco)) continue
  clubes[clube] = elenco.map((a) => {
    atletas++
    // `?? null` e nao `|| null`: overall 0 e idade 0 sao valores, nao ausencia.
    const linha = [
      a.n,
      indexar(a.p, posicoes, iPos),
      a.o ?? null,
      a.i ?? null,
      indexar(a.c, nacionalidades, iNac),
      a.f ?? null,
    ]
    while (linha.length && linha[linha.length - 1] === null) linha.pop()
    return linha
  })
}

writeFileSync(
  DESTINO,
  JSON.stringify({ v: 1, ordem: ORDEM, pos: posicoes, nac: nacionalidades, clubes }),
  "utf-8",
)

const antes = readFileSync(FONTE).length / 1048576
const depois = readFileSync(DESTINO).length / 1048576
console.log(
  `elencos TM: ${antes.toFixed(2)} MB -> ${depois.toFixed(2)} MB `
  + `(${Math.round((1 - depois / antes) * 100)}% menor, ${atletas} atletas em ${Object.keys(clubes).length} clubes)`,
)
