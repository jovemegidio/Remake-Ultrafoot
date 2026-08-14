// GERA O ARQUIVO DE ELENCOS DO POOL, o par do índice leve.
//
// `scripts/gerar-indice-do-pool.mjs` tirou o array `jogadores` de cada clube e
// deixou `imported-bf2026-index.json` com 0,88 MB. Só que o elenco não sumiu do
// jogo: `players-data`, `player-photos`, `transfer-engine` e o painel de
// juniores continuavam importando o arquivo COMPLETO de 8,91 MB — e como
// `players-data` é importado por `game-engine` e `use-game-manager`, o seed
// inteiro voltava para o chunk compartilhado de TODA rota (medido: 13,80 MB).
//
// Este script escreve a outra metade: só os elencos, indexados pelo `id` do
// clube. Ele é carregado SOB DEMANDA (`lib/pool-elencos.ts`), não pelo bundle.
//
//   node scripts/gerar-elencos-do-pool.mjs
//
// ⚠️ RODE DE NOVO sempre que `imported-bf2026.json` mudar, junto com o gerador
// do índice. Índice e elencos são derivados do MESMO arquivo e casam pelo `id`:
// gerar um sem o outro faz o clube existir na lista e vir com elenco de outro.

import { readFileSync, writeFileSync } from "node:fs"
import path from "node:path"

const RAIZ = path.resolve(import.meta.dirname, "..")
const ORIGEM = path.join(RAIZ, "data/seeds/imported-bf2026.json")
const DESTINO = path.join(RAIZ, "data/seeds/imported-bf2026-elencos.json")

// Lista FECHADA, como no índice: os campos que os quatro consumidores leem.
// `salario` entra porque o transfer-engine calcula proposta com ele.
const CAMPOS = ["id", "nome", "posicao", "overall", "idade", "salario", "nac", "ft"]

const bruto = JSON.parse(readFileSync(ORIGEM, "utf-8"))
const times = bruto.teams ?? []

/** @type {Record<string, object[]>} */
const elencos = {}
let atletas = 0
for (const time of times) {
  const lista = time.jogadores ?? []
  if (!lista.length) continue
  if (!time.id) throw new Error(`clube sem id no seed: ${time.nome ?? "?"}`)
  elencos[time.id] = lista.map((jogador) => {
    const saida = {}
    for (const campo of CAMPOS) {
      if (jogador[campo] !== undefined) saida[campo] = jogador[campo]
    }
    return saida
  })
  atletas += lista.length
}

const texto = `${JSON.stringify(elencos)}\n`
writeFileSync(DESTINO, texto)

const antes = readFileSync(ORIGEM).length
const depois = Buffer.byteLength(texto)
console.log(`clubes com elenco: ${Object.keys(elencos).length} de ${times.length}`)
console.log(`atletas: ${atletas}`)
console.log(`origem:  ${(antes / 1024 / 1024).toFixed(2)} MB`)
console.log(`elencos: ${(depois / 1024 / 1024).toFixed(2)} MB`)

// Travas de sanidade. Perder elenco aqui não dá erro: dá clube inteiro com
// atleta gerado no lugar do licenciado, e ninguém percebe até alguém abrir a tela.
const comElencoNaOrigem = times.filter((t) => (t.jogadores ?? []).length).length
if (Object.keys(elencos).length !== comElencoNaOrigem) {
  throw new Error(`saída com ${Object.keys(elencos).length} elencos contra ${comElencoNaOrigem} da origem`)
}
const totalOrigem = times.reduce((soma, t) => soma + (t.jogadores ?? []).length, 0)
if (atletas !== totalOrigem) {
  throw new Error(`saída com ${atletas} atletas contra ${totalOrigem} da origem`)
}
const ids = new Set(times.map((t) => t.id))
if (ids.size !== times.length) {
  throw new Error(`ids repetidos no seed: ${times.length - ids.size} colisões — o casamento por id não é confiável`)
}
console.log("ok: elencos e ids conferem com a origem")
