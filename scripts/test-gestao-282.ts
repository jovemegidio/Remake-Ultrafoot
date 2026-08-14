import assert from "node:assert/strict"
import { bonusPreparacao, consultarIntermediario, criarEstadoGestao282, normalizarGestao282, pontuacaoTecnico, pontuacaoTime } from "../lib/gestao-282"

const estado = criarEstadoGestao282("mundo_real")
assert.equal(estado.modoDeMundo, "mundo_real")
assert.equal(estado.principios.length, 3)
assert.equal(normalizarGestao282({ modoDeMundo: "seu_mundo" }).pautaComissao.medico, "reuniao")
assert.equal(bonusPreparacao("pressionar", 9), 8)

const atleta = { id: 10, name: "Atleta", marketValue: 10_000_000, overall: 80 }
assert.deepEqual(consultarIntermediario(atleta, 4), consultarIntermediario(atleta, 4))
assert.ok(consultarIntermediario(atleta, 4).valorSugerido > 0)
assert.ok(pontuacaoTecnico({ titulos: 2, reputacao: 3, vitorias: 30, temporadas: 4 }) > 300)
assert.ok(pontuacaoTime({ prestigio: 90, pontos: 70, saldo: 25 }) > pontuacaoTime({ prestigio: 70 }))

console.log("OK: sistemas de gestão 1.0.282")
