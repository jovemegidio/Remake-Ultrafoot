// O TROFÉU CERTO PARA CADA TÍTULO — e nunca um troféu quebrado.
//
// O acervo tem 72 peças e 58 nunca chegaram à tela: a cerimônia mostrava um
// ícone de linha, igual para o Paulistão e para a Champions. Este teste trava
// as três coisas que fazem a correção valer:
//
//   1. o arquivo resolvido EXISTE em public/trofeus (caminho quebrado na
//      cerimônia do título é o pior lugar possível para um 404);
//   2. competições de peso caem na arte própria, não no genérico;
//   3. nome desconhecido ainda devolve troféu — a cerimônia não pode quebrar.
//
//   npx tsx scripts/test-trofeus.ts
import assert from "node:assert/strict"
import { existsSync } from "node:fs"
import { trofeuDaCompeticao } from "../lib/trofeus"

let ok = 0
const teste = (nome: string, fn: () => void) => { fn(); console.log(`OK    ${nome}`); ok++ }

const arquivoDe = (url: string) => `public${url}`

teste("todo caminho resolvido existe no disco", () => {
  const nomes = [
    "Campeonato Paulista", "Campeonato Carioca", "Campeonato Mineiro", "Campeonato Gaucho",
    "Campeonato Baiano", "Campeonato Pernambucano", "Campeonato Cearense", "Campeonato Goiano",
    "Brasileirão Série A", "Brasileirão Série B", "Brasileirão Série C", "Brasileirão Série D",
    "Copa do Brasil", "Copa do Nordeste", "Copa Verde", "Supercopa do Brasil",
    "CONMEBOL Libertadores", "CONMEBOL Sul-Americana", "UEFA Champions League", "UEFA Europa League",
    "Copa do Mundo", "Eurocopa", "Copa América", "Copa Ouro",
    "La Liga", "Premier League", "FA Cup", "Copa del Rey",
    "competição que não existe", "", "Torneio Aleatório 2026",
  ]
  for (const n of nomes) {
    const url = trofeuDaCompeticao(n)
    assert.ok(url.startsWith("/trofeus/") && url.endsWith(".webp"), `caminho estranho: ${url}`)
    assert.ok(existsSync(arquivoDe(url)), `arte inexistente para "${n}": ${url}`)
  }
})

teste("estadual cai na arte do próprio estado", () => {
  assert.equal(trofeuDaCompeticao("Campeonato Paulista"), "/trofeus/tr_estadual_SP_d1.webp")
  assert.equal(trofeuDaCompeticao("Campeonato Carioca"), "/trofeus/tr_estadual_RJ.webp")
  assert.equal(trofeuDaCompeticao("Campeonato Gaúcho"), "/trofeus/tr_estadual_RS_D1.webp")
})

teste("cada divisão brasileira tem a sua", () => {
  const a = trofeuDaCompeticao("Brasileirão Série A")
  const b = trofeuDaCompeticao("Brasileirão Série B")
  const c = trofeuDaCompeticao("Brasileirão Série C")
  const d = trofeuDaCompeticao("Brasileirão Série D")
  assert.equal(new Set([a, b, c, d]).size, 4, "duas divisões receberam o mesmo troféu")
  assert.equal(a, "/trofeus/tr_nacional_BRA_d1.webp")
  assert.equal(d, "/trofeus/tr_nacional_BRA_d4.webp")
})

teste("a ordem das regras resolve os nomes que se contêm", () => {
  // "Copa do Nordeste" não pode virar a taça genérica de "copa", e a Supercopa
  // do Brasil não pode virar a Copa do Brasil.
  assert.equal(trofeuDaCompeticao("Copa do Nordeste"), "/trofeus/tr_copanordeste.webp")
  assert.equal(trofeuDaCompeticao("Copa do Brasil"), "/trofeus/tr_copa_BRA.webp")
  assert.equal(trofeuDaCompeticao("Supercopa do Brasil"), "/trofeus/tr_supercopa_BRA.webp")
})

teste("a Taça Guanabara não usa a arte do Carioca", () => {
  // Ela é o título da primeira fase, não o estadual. Mesmo desenho para as duas
  // deixaria o histórico de uma temporada com dois "campeão carioca".
  assert.equal(trofeuDaCompeticao("Taça Guanabara"), "/trofeus/tr_copa.webp")
  assert.notEqual(trofeuDaCompeticao("Taça Guanabara"), trofeuDaCompeticao("Campeonato Carioca"))
})

teste("nome desconhecido devolve genérico coerente com o tipo", () => {
  assert.equal(trofeuDaCompeticao("Torneio Xis", "cup"), "/trofeus/tr_copa.webp")
  assert.equal(trofeuDaCompeticao("Liga Xis", "league"), "/trofeus/tr_nacionalgenerico.webp")
  assert.equal(trofeuDaCompeticao(""), "/trofeus/tr_nacionalgenerico.webp")
})

teste("acento e caixa não mudam o resultado", () => {
  assert.equal(trofeuDaCompeticao("CAMPEONATO PAULISTA"), trofeuDaCompeticao("campeonato paulista"))
  assert.equal(trofeuDaCompeticao("Campeonato Gaúcho"), trofeuDaCompeticao("Campeonato Gaucho"))
})

console.log(`\n${ok} verificações, tudo OK`)
