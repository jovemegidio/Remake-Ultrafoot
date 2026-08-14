import assert from "node:assert/strict"
import { CONFIGURACOES_INICIAIS_283, competicaoHabilitada283, normalizarConfiguracoes283, salarioPorPeriodo283 } from "../lib/configuracoes-iniciais-283"

const semCopas = normalizarConfiguracoes283({ jogarEstaduais: false, jogarRegionais: false, jogarInternacionaisClubes: false, jogarInternacionaisSelecoes: false })
assert.equal(competicaoHabilitada283({ competition: "Paulistão", competitionType: "state" }, semCopas), false)
assert.equal(competicaoHabilitada283({ competition: "Copa do Nordeste", competitionType: "cup" }, semCopas), false)
assert.equal(competicaoHabilitada283({ competition: "Libertadores", competitionType: "continental" }, semCopas), false)
assert.equal(competicaoHabilitada283({ competition: "Data FIFA", competitionType: "fifa_break" }, semCopas), false)
assert.equal(competicaoHabilitada283({ competition: "Brasileirão", competitionType: "league" }, semCopas), true)
// O fator mensal é 4, e NÃO 52/12 (que daria 5.200).
//
// O teto salarial da diretoria (`excedeTetoSalarial`, no game-engine) compara
// folha semanal × 4 com o `wageBudget`. Com 52/12 o jogador via na tela um
// salário mensal que não fechava com a conta usada para aprovar a contratação:
// a proposta era recusada por estourar um teto que, pela tela, ainda tinha
// folga. Se algum dia o motor passar a usar 52/12, os dois mudam juntos.
assert.equal(salarioPorPeriodo283(1_200, "mensal"), 4_800)
assert.equal(salarioPorPeriodo283(1_200, "semanal"), 1_200)
assert.equal(normalizarConfiguracoes283(null).sistemaForca, CONFIGURACOES_INICIAIS_283.sistemaForca)
console.log("OK: configurações iniciais 1.0.283")
