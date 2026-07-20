// Verifica a regra de recuperação de partidas atrasadas do usuário.
//
// Cenário do relato (1.0.98): o clube do jogador ficou 10-11 rodadas atrás,
// disputou 15 jogos contra 38 dos rivais e foi rebaixado sem ter chance.
//
// Rodar: npx tsx scripts/test-fixture-catchup.ts

import { isOverdueUserFixture, selectOverdueUserFixtures } from "../lib/fixture-catchup"

let failures = 0

function check(name: string, actual: unknown, expected: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected)
  if (!ok) failures++
  console.log(`${ok ? "  ok  " : " FALHA"} ${name}${ok ? "" : `\n         esperado ${JSON.stringify(expected)}, veio ${JSON.stringify(actual)}`}`)
}

console.log("\nRegra de seleção\n")

check("partida do usuário no passado é recuperada",
  isOverdueUserFixture({ week: 5, isUserMatch: true }, 8), true)

check("partida da semana que começa NÃO é tomada do jogador",
  isOverdueUserFixture({ week: 8, isUserMatch: true }, 8), false)

check("partida futura não é tocada",
  isOverdueUserFixture({ week: 12, isUserMatch: true }, 8), false)

check("partida já disputada não é reprocessada",
  isOverdueUserFixture({ week: 5, isUserMatch: true, played: true }, 8), false)

check("partida de adversário não entra aqui",
  isOverdueUserFixture({ week: 5, isUserMatch: false }, 8), false)

check("chave já registrada não é reprocessada",
  isOverdueUserFixture({ week: 5, isUserMatch: true }, 8, ["k1"], "k1"), false)

console.log("\nCenário do relato: 38 rodadas, jogador disputa só as 15 primeiras\n")

interface F { week: number; isUserMatch: boolean; played: boolean }
const calendario: F[] = []
for (let week = 1; week <= 38; week++) {
  calendario.push({ week, isUserMatch: true, played: week <= 15 })
  calendario.push({ week, isUserMatch: false, played: true })
}

// O jogador avança do começo ao fim sem disputar nada além das 15 primeiras.
let semana = 15
let recuperadas = 0
while (semana <= 38) {
  const proxima = semana + 1
  for (const fixture of selectOverdueUserFixtures(calendario, proxima)) {
    fixture.played = true
    recuperadas++
  }
  semana = proxima
}

const jogosUsuario = calendario.filter(f => f.isUserMatch && f.played).length
const jogosRivais = calendario.filter(f => !f.isUserMatch && f.played).length
const pendentes = calendario.filter(f => f.isUserMatch && !f.played).length

check("nenhuma partida do usuário fica pendente", pendentes, 0)
check("usuário termina com 38 jogos, como os rivais", jogosUsuario, jogosRivais)
check("as 23 rodadas perdidas foram recuperadas", recuperadas, 23)

console.log(`\n${failures === 0 ? "TODOS OS TESTES PASSARAM" : `${failures} TESTE(S) FALHARAM`}\n`)
process.exit(failures === 0 ? 0 : 1)
