import assert from "node:assert/strict"
import { avaliarConduta291, codigoCondutaPadrao291, registrarTemporadaAcademia291 } from "../lib/gestao-282"

const codigo = codigoCondutaPadrao291()
const atleta = {
  id: 7,
  name: "Atleta Teste",
  salary: 100_000,
  morale: "Feliz",
  energy: 80,
  seasonStats: { yellowCards: 3, redCards: 1 },
}
const disciplina = avaliarConduta291(codigo, [atleta], 2026, 4)
assert.deepEqual(disciplina.novos.map(item => item.tipo), ["tres_amarelos", "vermelho"])
assert.equal(disciplina.totalMultas, 60_000)
assert.equal(avaliarConduta291(disciplina.codigo, [atleta], 2026, 5).novos.length, 0)

const academia = registrarTemporadaAcademia291({
  season: 2026,
  clube: "Clube Teste",
  nivel: 4,
  graduados: 3,
  minutosDeJovens: 1_800,
  mediaPotencial: 78,
})
assert.ok(academia.pontuacao > 1_300)

console.log("OK — disciplina e academia 291 validadas")
