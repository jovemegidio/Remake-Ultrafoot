// O PORTAO DA ANALISE DO CENTRO DE DADOS (1.0.383).
//
//   node node_modules/tsx/dist/cli.mjs scripts/qa-olheiro-analisa.ts
//
// ⚠️ POR QUE ELE EXISTE. Ate a 1.0.382 `generatePerformanceAnalysis` devolvia
// TEXTO CHUMBADO: as mesmas frases ("Monitore a fadiga dos laterais", "Queda de
// intensidade apos os 70 minutos") para qualquer elenco, qualquer adversario e
// qualquer temporada. O nivel do centro de dados so CORTAVA a lista fixa com um
// `slice`, entao pagar por um centro nivel 5 comprava mais frases, nao mais
// informacao. A tela `/olheiros` exibia aquilo como analise.
//
// E o mesmo modulo tinha um defeito pior escondido: quando a missao nao achava
// candidato real no universo, o departamento INVENTAVA um atleta ("Atleta
// 123456") com overall, custo e risco de lesao gerados por hash. O relatorio
// aparecia em "Descobertos" e o atleta nao existia em lugar nenhum — nao dava
// para sondar nem contratar.
//
// Este portao cobra as duas coisas: a analise tem de SAIR DOS DADOS, e o
// departamento nao pode inventar gente.

import assert from "node:assert"
import {
  advanceScoutingWeek, createScoutMission, createScoutingDepartment, generatePerformanceAnalysis,
  hireDepartmentScout, type AtletaParaAnalise, type EntradaDaAnalise, type ScoutCandidate,
} from "../lib/scout-engine"

const atleta = (over: Partial<AtletaParaAnalise> = {}): AtletaParaAnalise => ({
  name: "Atleta", position: "MEI", age: 26, overall: 72,
  energy: 95, form: 70, moralePoints: 60, injuryWeeks: 0, seasonYellows: 0,
  ...over,
})

const elencoSaudavel: AtletaParaAnalise[] = [
  ...Array.from({ length: 3 }, (_, i) => atleta({ name: `GOL ${i}`, position: "GOL" })),
  ...Array.from({ length: 8 }, (_, i) => atleta({ name: `DEF ${i}`, position: "ZAG" })),
  ...Array.from({ length: 7 }, (_, i) => atleta({ name: `MEI ${i}`, position: "MEI" })),
  ...Array.from({ length: 5 }, (_, i) => atleta({ name: `ATA ${i}`, position: "ATA" })),
]

const base = (over: Partial<EntradaDaAnalise> = {}): EntradaDaAnalise => ({
  week: 10, season: 2026, dataLevel: 3, elenco: elencoSaudavel, adversario: null, ...over,
})

// ── 1. A ANALISE MUDA COM O ELENCO ──────────────────────────────────────────
//
// O teste do texto chumbado: dois elencos diferentes nao podem gerar o mesmo
// relatorio. Era exatamente isso que acontecia ate a 1.0.382.
const saudavel = generatePerformanceAnalysis(base())
const cansado = generatePerformanceAnalysis(base({
  elenco: elencoSaudavel.map(a => ({ ...a, energy: 40 })),
}))
assert.notDeepEqual(
  saudavel.squadAlerts, cansado.squadAlerts,
  "elenco descansado e elenco esgotado nao podem gerar o mesmo alerta",
)
assert.ok(
  cansado.squadAlerts.some(a => a.includes("energia")),
  "um elenco inteiro abaixo de 65% de energia tem de virar alerta de energia",
)

// ── 2. AS FRASES CITAM DADOS DE VERDADE ─────────────────────────────────────
//
// Alerta que nao nomeia ninguem nem numero nenhum e frase de efeito.
const comLesao = generatePerformanceAnalysis(base({
  elenco: [...elencoSaudavel, atleta({ name: "Machucado", injuryWeeks: 6 })],
}))
assert.ok(
  comLesao.squadAlerts.some(a => a.includes("6 semanas")),
  "o alerta medico tem de citar o prazo real do afastamento",
)

const pendurado = generatePerformanceAnalysis(base({
  dataLevel: 3,
  elenco: [...elencoSaudavel, atleta({ name: "Pendurado", seasonYellows: 4 })],
}))
assert.ok(
  pendurado.squadAlerts.some(a => a.includes("Pendurado")),
  "o alerta de cartoes tem de dizer QUEM esta pendurado",
)

// ── 3. NIVEL DE DADOS DA PROFUNDIDADE, NAO SO MAIS TEXTO ────────────────────
//
// Antes o nivel so fatiava a lista fixa. Agora ele decide QUAIS leituras o
// departamento e capaz de fazer: cartoes so no 3, contrato so no 4, curva de
// idade so no 5.
const elencoComTudo: AtletaParaAnalise[] = [
  ...elencoSaudavel,
  atleta({ name: "Pendurado", seasonYellows: 4 }),
  atleta({ name: "Vencendo", overall: 85, contractEndSeason: 2027 }),
]
const nivel1 = generatePerformanceAnalysis(base({ dataLevel: 1, elenco: elencoComTudo }))
const nivel5 = generatePerformanceAnalysis(base({ dataLevel: 5, elenco: elencoComTudo }))
assert.ok(
  nivel5.squadAlerts.length > nivel1.squadAlerts.length,
  "centro de dados melhor tem de enxergar mais coisas",
)
assert.ok(
  !nivel1.squadAlerts.some(a => a.includes("Pendurado")),
  "no nivel 1 o departamento ainda nao le cartoes",
)
assert.ok(
  nivel5.squadAlerts.some(a => a.includes("Vencendo")),
  "no nivel 4+ o departamento tem de ver contrato acabando",
)

// ── 4. SEM PROBLEMA, SEM ALARME FALSO ───────────────────────────────────────
assert.ok(
  saudavel.squadAlerts.length === 1 && saudavel.squadAlerts[0].includes("Nenhum alerta"),
  "elenco inteiro e descansado nao pode gerar alerta inventado",
)

// ── 5. O ADVERSARIO MUDA O RELATORIO ────────────────────────────────────────
const contraPressao = generatePerformanceAnalysis(base({
  adversario: { nome: "Rival A", estilo: "pressiona_alto", dossie: 100 },
}))
const contraBloco = generatePerformanceAnalysis(base({
  adversario: { nome: "Rival B", estilo: "bloco_baixo", dossie: 100 },
}))
assert.notDeepEqual(
  contraPressao.opponentWeaknesses, contraBloco.opponentWeaknesses,
  "adversarios de estilos opostos nao podem ter a mesma fraqueza",
)
assert.notDeepEqual(
  contraPressao.tacticalRecommendations, contraBloco.tacticalRecommendations,
  "a recomendacao tem de mudar com o adversario",
)

// ⚠️ E A RECOMENDACAO TEM DE SER A QUE A PREPARACAO PREMIA. Se o relatorio
// mandasse preparar um foco que `planoContraOAdversario` pune, o departamento
// estaria trabalhando contra o proprio tecnico.
assert.ok(
  contraPressao.tacticalRecommendations[0].includes("Contra-atacar"),
  "contra quem pressiona alto, a recomendacao tem de ser contra-atacar",
)
assert.ok(
  contraBloco.tacticalRecommendations[0].includes("Controlar posse"),
  "contra um bloco baixo, a recomendacao tem de ser controlar a posse",
)

// ── 6. SEM DOSSIE, O RELATORIO ADMITE QUE NAO SABE ──────────────────────────
const semObservar = generatePerformanceAnalysis(base({
  adversario: { nome: "Rival C", estilo: "contra_ataca", dossie: 5 },
}))
assert.ok(
  semObservar.opponentStrengths.some(f => f.includes("Dossiê")),
  "sem observacao o relatorio tem de dizer que esta incompleto, nao encher de frase",
)
assert.ok(
  semObservar.opponentStrengths.length < contraPressao.opponentStrengths.length + 1
  || semObservar.opponentStrengths.filter(f => !f.includes("Dossiê")).length < contraPressao.opponentStrengths.length,
  "dossie fraco tem de revelar menos do adversario do que dossie cheio",
)

// ── 7. SEM PROXIMO JOGO, NAO INVENTA ADVERSARIO ─────────────────────────────
assert.ok(
  saudavel.opponentStrengths.every(f => f.includes("Sem próximo adversário")),
  "sem jogo mapeado o relatorio tem de dizer isso, nao produzir analise generica",
)

// ── 8. O DEPARTAMENTO NAO INVENTA ATLETA ────────────────────────────────────
//
// A regressao mais cara deste modulo. Missao sem candidato real tem de terminar
// VAZIA e marcada, nunca com um atleta gerado por hash.
let dept = createScoutingDepartment()
dept = hireDepartmentScout(dept, {
  id: "s1", name: "Olheiro", tier: "regional", monthlySalary: 1000,
  attributes: { currentAbility: 60, potentialAbility: 65, youthDiscovery: 60, marketKnowledge: 60, negotiation: 55 },
})
dept = createScoutMission(dept, {
  id: "m1", scoutId: "s1", type: "young", region: "Brasil",
  startedWeek: 1, durationWeeks: 3, progressWeeks: 0, status: "active",
})
// Sem candidatos: e o cenario que produzia o atleta fantasma.
for (let semana = 2; semana <= 6; semana++) dept = advanceScoutingWeek(dept, semana, [])
assert.equal(dept.reports.length, 0, "missao sem candidato real NAO pode gerar relatorio")
assert.ok(dept.missions[0].semAchados, "a missao vazia tem de ficar marcada, para a tela poder dizer")
assert.equal(dept.reputation, 0, "missao que nao achou ninguem nao constroi reputacao")

// Com candidato real, o relatorio sai normalmente.
const candidato: ScoutCandidate = {
  id: "c1", name: "Joia Real", clubShort: "XPT", clubName: "Clube XPT", country: "Brasil",
  position: "ATA", age: 18, overall: 68, potential: 85, value: 3_000_000, weeklySalary: 12_000,
  contractEndSeason: 2029, currentSeason: 2026, morale: 70, injuryWeeks: 0,
  attributes: { pace: 80, shooting: 70, passing: 62, dribbling: 78, defending: 30, physical: 65 },
}
let dept2 = createScoutingDepartment()
dept2 = hireDepartmentScout(dept2, {
  id: "s2", name: "Olheiro 2", tier: "national", monthlySalary: 2000,
  attributes: { currentAbility: 75, potentialAbility: 78, youthDiscovery: 80, marketKnowledge: 70, negotiation: 60 },
})
dept2 = createScoutMission(dept2, {
  id: "m2", scoutId: "s2", type: "young", region: "Brasil",
  startedWeek: 1, durationWeeks: 3, progressWeeks: 0, status: "active",
})
for (let semana = 2; semana <= 6; semana++) dept2 = advanceScoutingWeek(dept2, semana, [candidato])
assert.ok(dept2.reports.length > 0, "com candidato real tem de sair relatorio")
assert.equal(dept2.reports[0].playerName, "Joia Real", "o relatorio tem de ser sobre um atleta que EXISTE")
assert.ok(!dept2.missions[0].semAchados, "missao bem-sucedida nao pode ser marcada como vazia")
assert.ok(dept2.reputation > 0, "missao entregue constroi reputacao")

console.log("qa:olheiro-analisa OK — 8 verificacoes")
