// PROVA QUE A SEPARAÇÃO ÍNDICE + ELENCOS NÃO PERDEU NADA.
//
// O seed `imported-bf2026.json` (8,91 MB) foi quebrado em índice (0,88 MB,
// estático) + elencos (7,91 MB, sob demanda) para tirar o peso do chunk
// compartilhado de toda rota. O modo de falha desta mudança é SILENCIOSO: um
// clube que perde o elenco não dá erro, ele passa a ser preenchido com atletas
// gerados — e ninguém percebe até abrir a tela do clube.
//
//   npx tsx scripts/test-pool-elencos.ts

import { readFileSync } from "node:fs"
import assert from "node:assert"
import { elencoDoPool, poolElencosProntos, todosOsElencosDoPool } from "../lib/pool-elencos"
import { elencosReaisTM, elencosTMProntos } from "../lib/elencos-reais-tm"
import { getPlayersForTeam } from "../lib/players-data"
import { getTeamByFileKey } from "../lib/teams-data"

const original = JSON.parse(readFileSync("data/seeds/imported-bf2026.json", "utf-8")) as {
  teams: Array<{ id: string; nome: string; jogadores?: Array<{ nome: string; overall: number; posicao: string }> }>
}
const indice = JSON.parse(readFileSync("data/seeds/imported-bf2026-index.json", "utf-8")) as {
  teams: Array<{ id: string; nome: string }>
}

// 1. No Node a leitura é síncrona: os 19 scripts de QA que importam players-data
//    dependem disso e nenhum deles usa await.
assert.ok(poolElencosProntos(), "elencos do pool deveriam estar prontos no Node sem await")
assert.ok(elencosTMProntos(), "elencos do Transfermarkt deveriam estar prontos no Node sem await")

// 1b. O SEGUNDO seed (real-squads-tm) tem de continuar chegando inteiro. Ele é a
//     camada de MAIOR prioridade do elenco: se sumir, os clubes curados perdem
//     nome real, nacionalidade e posição fina de uma vez — sem erro nenhum.
const tmBruto = JSON.parse(readFileSync("data/seeds/real-squads-tm.json", "utf-8")) as Record<string, unknown[]>
const tmCarregado = elencosReaisTM()
assert.equal(Object.keys(tmCarregado).length, Object.keys(tmBruto).length,
  `TM carregado com ${Object.keys(tmCarregado).length} clubes contra ${Object.keys(tmBruto).length} do arquivo`)
const atletasTM = Object.values(tmCarregado).reduce((s, l) => s + l.length, 0)
const atletasArquivo = Object.values(tmBruto).reduce((s, l) => s + l.length, 0)
assert.equal(atletasTM, atletasArquivo, `TM com ${atletasTM} atletas contra ${atletasArquivo}`)
console.log(`ok: real-squads-tm com ${Object.keys(tmCarregado).length} clubes e ${atletasTM} atletas`)

// 2. Índice e origem têm os mesmos clubes.
assert.equal(indice.teams.length, original.teams.length,
  `índice com ${indice.teams.length} clubes contra ${original.teams.length} da origem`)

// 3. Todo clube da origem devolve EXATAMENTE o mesmo elenco pelo id.
let atletasConferidos = 0
let clubesComElenco = 0
for (const time of original.teams) {
  const esperado = time.jogadores ?? []
  const obtido = elencoDoPool(time.id) ?? []
  assert.equal(obtido.length, esperado.length,
    `${time.nome} (${time.id}): ${obtido.length} atletas contra ${esperado.length} da origem`)
  if (!esperado.length) continue
  clubesComElenco++
  for (let i = 0; i < esperado.length; i++) {
    assert.equal(obtido[i].nome, esperado[i].nome, `${time.nome}: atleta ${i} trocado`)
    assert.equal(obtido[i].overall, esperado[i].overall, `${time.nome}: overall de ${esperado[i].nome} mudou`)
    // POSIÇÃO entra na conferência: ela decide se o clube tem volante, goleiro e
    // zagueiro. Uma troca aqui não daria erro — daria elenco montado torto.
    assert.equal(obtido[i].posicao, esperado[i].posicao, `${time.nome}: posição de ${esperado[i].nome} mudou`)
    atletasConferidos++
  }
}

// 4. O total bate com o mapa inteiro (pega elenco ÓRFÃO — id que existe nos
//    elencos e não no índice, que é como um clube some da lista mas não do dado).
const idsDoIndice = new Set(indice.teams.map(t => t.id))
const orfaos = Object.keys(todosOsElencosDoPool()).filter(id => !idsDoIndice.has(id))
assert.equal(orfaos.length, 0, `elencos órfãos (id fora do índice): ${orfaos.slice(0, 5).join(", ")}`)

// 5. Ponta a ponta: clubes conhecidos continuam montando elenco de verdade.
for (const chave of ["flarj", "palmeiras", "santos"]) {
  const time = getTeamByFileKey(chave)
  assert.ok(time, `clube ${chave} sumiu do teams-data`)
  const elenco = getPlayersForTeam(time)
  assert.ok(elenco.length >= 11, `${chave}: elenco com ${elenco.length} atletas`)
  assert.ok(elenco.some(p => p.pos === "GOL"), `${chave}: elenco sem goleiro`)
}

console.log(`ok: ${clubesComElenco} clubes, ${atletasConferidos} atletas conferidos um a um`)
console.log(`ok: índice e elencos casam por id, sem órfãos`)
