// OS PLANOS DE TREINO E DE DESENVOLVIMENTO MEXEM EM ALGUMA COISA?
//
// ⚠️ POR QUE ESTE PORTAO EXISTE. Este projeto ja catalogou duas vezes o mesmo
// defeito: sistema escrito, tela desenhada, e NADA no motor lendo o resultado
// ("medidores de enfeite dentro do arquivo que os proibe"; "os 10 atributos do
// tecnico eram enfeite"). As duas telas novas da 1.0.395 sao candidatas
// perfeitas a repetir isso — um plano de treino que nao muda treino e uma
// projecao que nao bate com a evolucao real seriam invisiveis num type-check.
//
// Entao o portao nao verifica que as funcoes existem. Ele verifica que elas
// PRODUZEM DIFERENCA no motor.
//
//   npx tsx scripts/qa-planos-do-elenco.ts
import assert from "node:assert/strict"
import {
  planoDoAtleta,
  CARGA_INDIVIDUAL_DO_PLANO,
  REGRAS_PADRAO,
  ENERGIA_DE_RECUPERACAO,
} from "../lib/plano-de-treino-automatico"
import { aplicarSemanaDeTreino, type AtletaNaSemana } from "../lib/treino-e-entrosamento"
import { PLANO_PADRAO } from "../lib/treino-e-entrosamento"
import { ganhoDaTemporada, projetarDesenvolvimento, faseDoAtleta, estrelas } from "../lib/plano-de-desenvolvimento"
import { PISO_SEM_EFEITO, RITMO_INICIAL } from "../lib/ritmo-de-jogo"

// ── 1. AS REGRAS ALCANCAM QUEM DEVEM ────────────────────────────────────────

// Encostado ha meses: precisa de carga para voltar.
assert.equal(
  planoDoAtleta({ id: 1, ritmo: 35, energy: 100 }).plano,
  "intenso",
  "atleta sem ritmo nenhum deveria cair no plano intenso",
)

// Perdendo ritmo, mas nao no chao.
assert.equal(
  planoDoAtleta({ id: 2, ritmo: PISO_SEM_EFEITO - 5, energy: 100 }).plano,
  "pesado",
  "atleta abaixo do piso de ritmo deveria cair no pesado",
)

// Jogando normalmente: manutencao.
assert.equal(
  planoDoAtleta({ id: 3, ritmo: RITMO_INICIAL, energy: 100 }).plano,
  "leve",
  "atleta em ritmo normal deveria cair no leve",
)

// Afiado: nenhuma regra o alcanca.
assert.equal(
  planoDoAtleta({ id: 4, ritmo: 99, energy: 100 }).plano,
  "equilibrado",
  "atleta afiado nao deveria ser alcancado por regra nenhuma",
)

// ⚠️ A ENERGIA VENCE O RITMO. Exausto E sem ritmo satisfaz a regra do intenso;
// mandar quem esta a 30% de energia para o treino mais pesado do jogo e como se
// contunde alguem de proposito.
assert.equal(
  planoDoAtleta({ id: 5, ritmo: 30, energy: ENERGIA_DE_RECUPERACAO - 10 }).plano,
  "recuperacao",
  "energia baixa deveria vencer a regra de ritmo",
)

// Lesionado nunca treina.
assert.equal(
  planoDoAtleta({ id: 6, ritmo: 30, energy: 100, injury: { weeksRemaining: 3 } }).plano,
  "recuperacao",
  "lesionado deveria ir para recuperacao",
)

// Regra desligada nao e avaliada.
const semIntenso = REGRAS_PADRAO.map(r => (r.plano === "intenso" ? { ...r, ativa: false } : r))
assert.notEqual(
  planoDoAtleta({ id: 7, ritmo: 35, energy: 100 }, semIntenso).plano,
  "intenso",
  "regra desligada nao deveria disparar",
)

// ── 2. O PLANO CHEGA AO MOTOR DE TREINO ─────────────────────────────────────
//
// Aqui esta o coracao do portao. `cargaIndividual` existia no motor e NENHUM
// lugar do jogo a definia. Se a ligacao se perder de novo, este bloco reprova.

const base: AtletaNaSemana = {
  id: 1, idade: 24, energia: 80, fadigaCronica: 10, minutosJogados: 90,
  resistencia: 70, lesionado: false, emTreinoIndividual: false,
}

const poupado = aplicarSemanaDeTreino(
  [{ ...base, cargaIndividual: CARGA_INDIVIDUAL_DO_PLANO.recuperacao }],
  PLANO_PADRAO,
)
const reforcado = aplicarSemanaDeTreino(
  [{ ...base, cargaIndividual: CARGA_INDIVIDUAL_DO_PLANO.intenso }],
  PLANO_PADRAO,
)

const eP = poupado.efeitos[0]
const eR = reforcado.efeitos[0]

assert.ok(
  eP.energia > eR.energia,
  `recuperacao deveria terminar a semana com MAIS energia que o intenso (${eP.energia} vs ${eR.energia})`,
)
assert.ok(
  eP.fadigaCronica < eR.fadigaCronica,
  `recuperacao deveria acumular MENOS fadiga que o intenso (${eP.fadigaCronica} vs ${eR.fadigaCronica})`,
)
assert.ok(
  eP.risco < eR.risco,
  `recuperacao deveria ter risco de lesao MENOR que o intenso (${eP.risco} vs ${eR.risco})`,
)

// E os cinco planos precisam mapear para valores que o motor entende.
for (const [plano, carga] of Object.entries(CARGA_INDIVIDUAL_DO_PLANO)) {
  assert.ok(
    ["poupado", "normal", "reforcado"].includes(carga),
    `plano ${plano} mapeia para uma carga que o motor nao conhece: ${carga}`,
  )
}

// ── 3. A PROJECAO E A EVOLUCAO REAL SAO A MESMA CONTA ───────────────────────
//
// A projecao chama `ganhoDaTemporada`, que e a funcao que o game-engine executa
// na virada de ano (foi extraida de la). Este bloco trava esse contrato: se
// alguem reescrever uma das duas, elas divergem e o portao pega.

const promessa = { id: 42, age: 19, overall: 60, potential: 82, seasonStats: { matchesPlayed: 30 } }
const proj = projetarDesenvolvimento(promessa)
assert.equal(
  proj.ganhoNaTemporada,
  ganhoDaTemporada(promessa, 30),
  "a projecao da tela divergiu do ganho que a virada de ano aplica",
)
assert.ok(proj.ganhoNaTemporada > 0, "uma promessa de 19 anos com margem 22 deveria crescer")
assert.equal(proj.fase, "crescimento")
assert.ok(
  proj.temporadasAtePotencial !== null && proj.temporadasAtePotencial > 0,
  "deveria estimar quantas temporadas faltam",
)

// Veterano declina.
const veterano = { id: 43, age: 35, overall: 78, potential: 82, seasonStats: { matchesPlayed: 20 } }
assert.ok(ganhoDaTemporada(veterano, 20) < 0, "veterano de 35 deveria perder pontos na virada")
assert.equal(faseDoAtleta(35, 78, 82), "declinio")

// Quem chegou ao teto nao cresce, e a tela precisa poder dizer isso.
const noTeto = { id: 44, age: 22, overall: 80, potential: 80, seasonStats: { matchesPlayed: 30 } }
assert.equal(projetarDesenvolvimento(noTeto).temporadasAtePotencial, null)
assert.equal(projetarDesenvolvimento(noTeto).margem, 0)

// ⚠️ MAIS MINUTOS TEM DE VALER ALGUMA COISA. Se os jogos nao entrassem na
// conta, "dar minutos ao jovem" seria conselho vazio — e a tela promete isso.
assert.ok(
  ganhoDaTemporada(promessa, 36) >= ganhoDaTemporada(promessa, 0),
  "jogar mais nao pode render menos evolucao",
)

// Estrelas ficam dentro da escala.
for (const v of [40, 55, 70, 85, 95]) {
  const e = estrelas(v)
  assert.ok(e >= 0 && e <= 5, `estrelas fora da escala para overall ${v}: ${e}`)
}

console.log("ok: planos de treino e de desenvolvimento mexem no motor (carga, fadiga, risco e evolucao)")
