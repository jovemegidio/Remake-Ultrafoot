// GERA O ÍNDICE LEVE DO POOL DE CLUBES.
//
// `data/seeds/imported-bf2026.json` tem 8,91 MB porque cada um dos 2.994 clubes
// carrega o array `jogadores` embutido. Só que `lib/teams-data.ts` — importado
// por 77 arquivos, ou seja, por praticamente toda tela — **não lê `jogadores`**
// (ver `PoolTeamRaw`). O jogo fazia parse de 8,9 MB para descartar os elencos, e
// isso viajava no chunk compartilhado de TODA rota.
//
// Este script escreve o índice sem os elencos: 8,91 MB -> 1,01 MB (-88,6%).
//
// Quem PRECISA de elenco (`lib/players-data.ts`, `lib/player-photos.ts`) segue
// lendo o arquivo completo — são 16 importadores, não 77.
//
//   node scripts/gerar-indice-do-pool.mjs
//
// ⚠️ RODE DE NOVO sempre que `imported-bf2026.json` mudar. O índice é derivado;
// editar o índice à mão faz o clube existir na lista e sumir do elenco.

import { readFileSync, writeFileSync } from "node:fs"
import path from "node:path"

const RAIZ = path.resolve(import.meta.dirname, "..")
const ORIGEM = path.join(RAIZ, "data/seeds/imported-bf2026.json")
const DESTINO = path.join(RAIZ, "data/seeds/imported-bf2026-index.json")

// Exatamente os campos que `PoolTeamRaw` declara, mais `divisao`/`liga`/`id`,
// usados noutros pontos do teams-data. Lista FECHADA de propósito: acrescentar
// campo aqui é o que faz o índice voltar a engordar sem ninguém perceber.
const CAMPOS = [
  "id", "nome", "curto", "cor1", "cor2", "prestigio", "saldo",
  "fileKey", "estadio", "escudo", "escudoDisponivel", "pais", "estado",
  "divisao", "liga",
]

const bruto = JSON.parse(readFileSync(ORIGEM, "utf-8"))
const times = bruto.teams ?? []

const enxutos = times.map((t) => {
  const saida = {}
  for (const campo of CAMPOS) {
    if (t[campo] !== undefined) saida[campo] = t[campo]
  }
  return saida
})

const texto = `${JSON.stringify({ teams: enxutos })}\n`
writeFileSync(DESTINO, texto)

const antes = readFileSync(ORIGEM).length
const depois = Buffer.byteLength(texto)
console.log(`clubes: ${times.length}`)
console.log(`antes:  ${(antes / 1024 / 1024).toFixed(2)} MB`)
console.log(`depois: ${(depois / 1024 / 1024).toFixed(2)} MB`)
console.log(`reducao: ${(100 - (depois / antes) * 100).toFixed(1)}%`)

// Trava de sanidade: se o índice perder clube, o jogo perde clube.
if (enxutos.length !== times.length) {
  throw new Error(`indice com ${enxutos.length} clubes contra ${times.length} da origem`)
}
const semChave = enxutos.filter((t) => !t.fileKey).length
if (semChave > 0) console.warn(`⚠️ ${semChave} clubes sem fileKey (iguais à origem, mas confira)`)
