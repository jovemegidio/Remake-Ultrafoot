/**
 * O regulamento publicado no painel chega ao calendário?
 *
 * A aba Competições grava turnos, participantes e rebaixamento; até a 1.0.283
 * nada disso era lido — `clubesDaLigaNoServidor` era função órfã e o returno do
 * calendário era somado sempre. Estes testes falham se voltar a ser decorativo.
 */
import assert from "node:assert"
import { buildRoundRobin, generateSeasonFixtures } from "../lib/career-engine"
import type { Team } from "../lib/teams-data"

const time = (curto: string): Team => ({
  nome: curto, curto, cor1: "#000", cor2: "#fff", prestigio: 70, saldo: 0,
  divisao: "serie_a", pais: "Brasil", cidade: "", estado: "", torcida: 1000,
  estadio_cap: 10000, file_key: curto.toLowerCase(),
} as Team)

const times = ["AAA", "BBB", "CCC", "DDD", "EEE", "FFF"].map(time)

// ── Sem canal: o comportamento histórico não pode mudar ─────────────────────
//
// Este é o teste que mais importa. O canal não está carregado no ambiente de
// teste, então tudo abaixo exercita o CAMINHO PADRÃO — e ele tem de continuar
// entregando turno e returno para quem nunca cadastrou competição nenhuma.
const padrao = generateSeasonFixtures(times, "AAA", 2026, "Serie A")
const rodadas = new Set(padrao.map(f => f.round))
assert.equal(rodadas.size, 2 * (times.length - 1),
  `6 clubes em turno e returno são 10 rodadas, veio ${rodadas.size}`)

// Cada dupla se enfrenta DUAS vezes, uma em cada casa.
const confrontos = new Map<string, number>()
for (const f of padrao) {
  const chave = [f.homeCurto, f.awayCurto].sort().join("-")
  confrontos.set(chave, (confrontos.get(chave) ?? 0) + 1)
}
assert.equal(confrontos.size, 15, "6 clubes geram 15 duplas")
for (const [dupla, n] of confrontos) {
  assert.equal(n, 2, `${dupla} deveria jogar 2 vezes, jogou ${n}`)
}

// Ninguém joga duas vezes na mesma rodada.
for (const r of rodadas) {
  const daRodada = padrao.filter(f => f.round === r)
  const envolvidos = daRodada.flatMap(f => [f.homeCurto, f.awayCurto])
  assert.equal(new Set(envolvidos).size, envolvidos.length,
    `rodada ${r} tem clube repetido`)
}

// Número ímpar de clubes: alguém folga por rodada, e ninguém joga contra si.
const impar = ["AAA", "BBB", "CCC", "DDD", "EEE"].map(time)
const comImpar = generateSeasonFixtures(impar, "AAA", 2026, "Serie A")
assert.ok(comImpar.every(f => f.homeCurto !== f.awayCurto),
  "clube não pode jogar contra si mesmo no BYE")
const duplasImpar = new Set(comImpar.map(f => [f.homeCurto, f.awayCurto].sort().join("-")))
assert.equal(duplasImpar.size, 10, "5 clubes geram 10 duplas")

// ── Turnos: o que o painel publica ──────────────────────────────────────────
const seis = ["AAA", "BBB", "CCC", "DDD", "EEE", "FFF"]

const idaEVolta = buildRoundRobin(seis, 2)
assert.equal(idaEVolta.length, 10, "turno e returno com 6 clubes = 10 rodadas")

const turnoUnico = buildRoundRobin(seis, 1)
assert.equal(turnoUnico.length, 5, "turno único com 6 clubes = 5 rodadas")
// Cada dupla UMA vez só.
const umaVez = new Map<string, number>()
for (const rodada of turnoUnico) {
  for (const j of rodada) {
    const k = [j.home, j.away].sort().join("-")
    umaVez.set(k, (umaVez.get(k) ?? 0) + 1)
  }
}
assert.equal(umaVez.size, 15, "turno único ainda cobre as 15 duplas")
assert.ok([...umaVez.values()].every(n => n === 1), "no turno único ninguém se enfrenta duas vezes")

// Omitir o parâmetro tem de manter o comportamento antigo: é o que garante que
// save e liga de quem não usa o canal não mudam de tamanho na atualização.
assert.equal(buildRoundRobin(seis).length, 10, "sem parâmetro, segue turno e returno")
assert.equal(buildRoundRobin(seis, 0).length, 5, "valor inválido cai no turno único, não em zero rodada")

console.log(`OK: calendário do canal (${rodadas.size} rodadas, ${confrontos.size} duplas, ímpar com BYE; `
  + `turno único ${turnoUnico.length} x ida e volta ${idaEVolta.length})`)
