import assert from "node:assert/strict"
import { criarUniversoPersistente286 } from "../lib/universo-286"
import { criarPerfilTreinador26, efeitosIniciaisPerfil26 } from "../lib/manager-profile-26"
import { avaliarPitch26, criarRequirement26, gerarOportunidadesPitch26 } from "../lib/transferroom-26"

const jogadores = (prefixo: string, posicoes: string[]) => posicoes.map((posicao, indice) => ({
  id: `${prefixo}-${indice}`,
  nome: `${prefixo} ${indice}`,
  posicao,
  idade: 19 + indice % 12,
  overall: 60 + indice % 20,
  pace: 62 + indice,
  shooting: posicao === "ATA" ? 80 : 58,
  passing: posicao === "MEI" ? 82 : 62,
  dribbling: 68,
  defending: posicao === "ZAG" ? 82 : 50,
  physical: 72,
}))

const universo = criarUniversoPersistente286({
  temporada: 2026,
  clubeDoUsuario: "USR",
  geradoEm: 1,
  clubes: [
    { curto: "USR", nome: "Usuário", pais: "Brasil", divisao: "serie_a", prestigio: 70, saldo: 80_000_000, jogadores: jogadores("U", ["GOL", "GOL", ...Array(7).fill("ZAG"), ...Array(6).fill("MEI"), ...Array(5).fill("ATA")]) },
    { curto: "CPU1", nome: "Clube Construtor", pais: "Inglaterra", divisao: "premier_league", prestigio: 75, saldo: 120_000_000, jogadores: jogadores("C", ["GOL", "GOL", ...Array(7).fill("ZAG"), ...Array(8).fill("MEI"), "ATA"]) },
    { curto: "CPU2", nome: "Clube Comprador", pais: "Espanha", divisao: "la_liga", prestigio: 68, saldo: 90_000_000, jogadores: jogadores("E", ["GOL", "GOL", ...Array(4).fill("ZAG"), ...Array(9).fill("MEI"), ...Array(4).fill("ATA")]) },
  ],
})

const requirement = criarRequirement26({
  setor: "MEI", papelComBola: "construtor", papelSemBola: "pressao",
  tempoDeJogo: "titular", tipoNegocio: "compra", perfilEtario: "qualquer",
}, 2026, 4, universo, "USR")
assert.ok(requirement.respostas.length > 0, "Requirement deve receber respostas do universo")
assert.ok(requirement.respostas.every(item => item.clubeCurto !== "USR"), "não deve oferecer atleta do próprio clube")
assert.ok(requirement.respostas.every(item => item.pontuacao >= 55), "respostas precisam satisfazer o corte técnico")
assert.deepEqual(
  criarRequirement26({ setor: "MEI", papelComBola: "construtor", papelSemBola: "pressao", tempoDeJogo: "titular", tipoNegocio: "compra", perfilEtario: "qualquer" }, 2026, 4, universo, "USR"),
  requirement,
  "Requirement precisa ser determinístico",
)

const oportunidades = gerarOportunidadesPitch26(universo, "USR", 2026, 4)
assert.ok(oportunidades.length > 0, "clubes com carência devem publicar oportunidades")
const oportunidade = oportunidades[0]
const posicao = oportunidade.setor === "DEF" ? "ZAG" : oportunidade.setor
const pitch = avaliarPitch26(oportunidade, { id: 99, name: "Atleta Oferecido", position: posicao, age: 25, overall: 72, marketValue: Math.min(2_000_000, oportunidade.orcamento) }, "compra", 2026, 4)
assert.ok(["aceito", "rejeitado"].includes(pitch.status))
assert.equal(avaliarPitch26(oportunidade, { id: 100, name: "Emprestado", position: posicao, age: 25, overall: 72, isLoanedIn: true }, "compra", 2026, 4).status, "rejeitado")

const perfil = criarPerfilTreinador26({
  nivelComoJogador: "profissional", areaAnterior: "recrutamento", relevanciaAnterior: "nacional", licenca: "a",
  estilos: ["recrutador", "tatico", "motivador", "analista"], personalidades: ["carismatico", "ambicioso", "calmo"],
})
assert.equal(perfil.estilos.length, 3, "máximo de três estilos")
assert.equal(perfil.personalidades.length, 2, "máximo de duas personalidades")
assert.ok(perfil.atributos.recrutamento > perfil.atributos.preparoFisico, "histórico em recrutamento deve alterar atributos")
const efeitos = efeitosIniciaisPerfil26(perfil)
assert.ok(efeitos.coachXP > 0 && efeitos.teamMorale >= 1 && efeitos.teamMorale <= 100)

console.log("fm26-parity-systems: TransferRoom e perfil do treinador validados")
