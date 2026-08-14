/**
 * A Central de Gestão chegou ao campo?
 *
 * Até a 1.0.282 as rotinas de bola parada e a preparação eram gravadas no save e
 * nenhum motor as lia. Estes testes existem para essa regressão não voltar em
 * silêncio: eles falham se o plano parar de alterar a partida.
 */
import assert from "node:assert"
import { simulateFullMatch, type MatchConfig } from "../lib/match-engine"
import {
  atualizarAdesao282, avaliarMetas282, bonusMentoria282, bonusPreparacaoAplicavel282,
  criarEstadoGestao282, planoDeBolaParada282, rendimentoUnidade282,
  type Principio, type RotinaBolaParada,
} from "../lib/gestao-282"

const elenco = Array.from({ length: 11 }, (_, i) => ({
  id: i + 1,
  name: `Atleta ${i + 1}`,
  physical: 80,
  passing: 78,
  overall: 75,
}))

// ── planoDeBolaParada282 ────────────────────────────────────────────────────
const semRotina = planoDeBolaParada282({ rotinasBolaParada: [] }, elenco)
assert.equal(semRotina.attackQuality, 0, "sem rotina o plano tem de ser neutro")
assert.equal(semRotina.defenseQuality, 0, "sem rotina o plano tem de ser neutro")
assert.equal(semRotina.aerialTargetName, undefined)

const rotina = (over: Partial<RotinaBolaParada>): RotinaBolaParada => ({
  id: "r", nome: "Ensaio", tipo: "escanteio_ofensivo", zona: "segunda_trave", ativa: true, ...over,
})

const ofensivo = planoDeBolaParada282({
  rotinasBolaParada: [rotina({ cobradorId: 1, ameacaAereaId: 2, sobraId: 3 })],
}, elenco)
assert.ok(ofensivo.attackQuality > 0, "rotina ofensiva precisa render qualidade de ataque")
assert.equal(ofensivo.defenseQuality, 0, "rotina ofensiva não pode virar defesa")
assert.equal(ofensivo.aerialTargetName, "Atleta 2")
assert.equal(ofensivo.secondBallName, "Atleta 3")

// Rotina inativa não conta.
const inativa = planoDeBolaParada282({
  rotinasBolaParada: [rotina({ cobradorId: 1, ameacaAereaId: 2, ativa: false })],
}, elenco)
assert.equal(inativa.attackQuality, 0, "rotina desativada não pode valer")

// O elenco escalado no papel importa: alvo aéreo fraco rende menos que forte.
const fraco = planoDeBolaParada282(
  { rotinasBolaParada: [rotina({ cobradorId: 1, ameacaAereaId: 2 })] },
  elenco.map(p => (p.id === 2 ? { ...p, physical: 45 } : p)),
)
assert.ok(fraco.attackQuality < ofensivo.attackQuality, "alvo aéreo pior tem de render menos")

// A zona combinada pesa: a cobrança curta rende menos que a segunda trave.
const curta = planoDeBolaParada282(
  { rotinasBolaParada: [rotina({ cobradorId: 1, ameacaAereaId: 2, zona: "curta" })] },
  elenco,
)
assert.ok(curta.attackQuality < ofensivo.attackQuality, "a zona escolhida tem de pesar")

// ── bonusPreparacaoAplicavel282 ─────────────────────────────────────────────
const prep = {
  season: 2026, week: 10, adversario: "Palmeiras",
  focoTatico: "controlar" as const,
  focoBolaParada1: "defender_escanteios" as const,
  focoBolaParada2: "segunda_bola" as const,
  bonus: 8,
}
const ctx = { season: 2026, week: 10, adversario: "Palmeiras" }
assert.equal(bonusPreparacaoAplicavel282(undefined, ctx), 0, "sem preparação, bônus zero")
assert.ok(bonusPreparacaoAplicavel282(prep, ctx) > 0, "preparação válida tem de valer")
assert.equal(bonusPreparacaoAplicavel282(prep, { ...ctx, adversario: "Santos" }), 0,
  "preparar um rival e enfrentar outro NÃO pode dar bônus")
assert.equal(bonusPreparacaoAplicavel282(prep, { ...ctx, week: 11 }), 0,
  "o bônus é da semana preparada, não permanente")
assert.equal(bonusPreparacaoAplicavel282(prep, { ...ctx, season: 2027 }), 0,
  "o bônus não atravessa temporada")

// ── Unidades de treino ──────────────────────────────────────────────────────
assert.equal(rendimentoUnidade282(undefined, "shooting"), 1, "sem unidade, treino igual ao de antes")
assert.equal(rendimentoUnidade282("ataque", null), 1, "sem foco de treino não há o que acelerar")
assert.ok(rendimentoUnidade282("ataque", "shooting") > 1, "unidade coerente tem de render mais")
assert.ok(rendimentoUnidade282("defesa", "shooting") < 1, "unidade incoerente tem de render menos")
assert.ok(rendimentoUnidade282("defesa", "defending") > 1)
assert.ok(rendimentoUnidade282("goleiros", "defending") > 1, "goleiro na unidade de goleiros é coerente")
assert.equal(rendimentoUnidade282("ataque", "passing"), 1, "passe não é domínio de nenhuma unidade")

// ── Mentoria ────────────────────────────────────────────────────────────────
const comMentoria = {
  mentorias: [{ id: "m", mentorId: 9, mentor: "Veterano", jovensIds: [4], jovens: ["Jovem"], foco: "profissionalismo" as const }],
}
const elencoTodo = new Set([4, 9])
assert.ok(bonusMentoria282(comMentoria, 4, elencoTodo) > 1, "o jovem orientado tem de evoluir mais")
assert.equal(bonusMentoria282(comMentoria, 9, elencoTodo), 1, "o mentor não ganha o bônus do orientado")
assert.equal(bonusMentoria282(comMentoria, 7, elencoTodo), 1, "quem está fora do grupo não ganha nada")
assert.equal(bonusMentoria282(comMentoria, 4, new Set([4])), 1,
  "vender o mentor tem de desfazer o efeito")
assert.equal(bonusMentoria282({ mentorias: [] }, 4, elencoTodo), 1)

// ── Metas individuais ───────────────────────────────────────────────────────
const atleta = (id: number, goals: number) => ({
  id, seasonStats: { goals, assists: 0, matchesPlayed: 0 }, training: { weeksTrained: 0 },
})
const metaGols = {
  id: "meta1", playerId: 1, jogador: "Atleta 1", tipo: "gols" as const,
  alvo: 5, inicial: 2, prazoSemana: 20, concluida: false, falhou: false,
}

// Progresso conta a partir do INICIAL: 4 gols com inicial 2 são 2 de progresso.
const emAndamento = avaliarMetas282({ metasIndividuais: [metaGols] }, [atleta(1, 4)], 10)
assert.equal(emAndamento.mudou, false, "meta em andamento não fecha")
assert.equal(emAndamento.metas[0].concluida, false)

const batida = avaliarMetas282({ metasIndividuais: [metaGols] }, [atleta(1, 7)], 10)
assert.equal(batida.concluidas.length, 1, "5 gols acima do inicial fecham a meta")
assert.equal(batida.metas[0].concluida, true)

// Estatística anterior à meta não conta retroativamente.
const semRetroativo = avaliarMetas282({ metasIndividuais: [metaGols] }, [atleta(1, 6)], 10)
assert.equal(semRetroativo.concluidas.length, 0, "4 de progresso não bate alvo 5")

// Na semana do prazo ainda dá para bater; depois dela, vence.
const noPrazo = avaliarMetas282({ metasIndividuais: [metaGols] }, [atleta(1, 3)], 20)
assert.equal(noPrazo.falhadas.length, 0, "a semana do prazo ainda vale")
const vencida = avaliarMetas282({ metasIndividuais: [metaGols] }, [atleta(1, 3)], 21)
assert.equal(vencida.falhadas.length, 1, "passou do prazo tem de falhar")
assert.equal(vencida.metas[0].falhou, true)

// Meta já fechada não é reprocessada (senão premiaria toda semana).
const jaFechada = avaliarMetas282(
  { metasIndividuais: [{ ...metaGols, concluida: true }] }, [atleta(1, 99)], 30,
)
assert.equal(jaFechada.concluidas.length, 0, "meta fechada não pode premiar de novo")
assert.equal(jaFechada.mudou, false)

// Atleta vendido: a meta vence no prazo em vez de ficar aberta para sempre.
const semAtleta = avaliarMetas282({ metasIndividuais: [metaGols] }, [], 21)
assert.equal(semAtleta.falhadas.length, 1)

// ── Princípios e adesão ─────────────────────────────────────────────────────
const jovemQueJogou = { id: 1, age: 19, form: 70, energy: 90, jogouNaSemana: true }
const jovemNoBanco = { id: 2, age: 19, form: 70, energy: 90, jogouNaSemana: false }

const comBase = atualizarAdesao282({ principios: ["base"], adesao: {} }, [jovemQueJogou, jovemNoBanco])
assert.ok(comBase.adesao[1] > comBase.adesao[2],
  "com o princípio da base, o jovem que joga adere mais que o esquecido no banco")

// Sem o princípio, jogar ou não jogar não muda a adesão.
const semBase = atualizarAdesao282({ principios: [], adesao: {} }, [jovemQueJogou, jovemNoBanco])
assert.equal(semBase.adesao[1], semBase.adesao[2],
  "sem princípio declarado o tratamento é igual")

// A adesão anda devagar: no máximo 6 pontos por semana.
const partindoDeCem = atualizarAdesao282({ principios: ["base"], adesao: { 2: 100 } }, [jovemNoBanco])
assert.ok(partindoDeCem.adesao[2] >= 94, `a adesão não pode desabar numa semana (${partindoDeCem.adesao[2]})`)

// Quebrar UM princípio incomoda mas não vira motim: o piso fica acima da faixa
// de descontentamento, mesmo depois de muitas semanas.
let umPrincipio = { principios: ["base"] as Principio[], adesao: {} as Record<number, number> }
for (let i = 0; i < 15; i++) {
  umPrincipio = { principios: umPrincipio.principios, adesao: atualizarAdesao282(umPrincipio, [jovemNoBanco]).adesao }
}
const apenasUm = atualizarAdesao282(umPrincipio, [jovemNoBanco])
assert.equal(apenasUm.descontentes.length, 0,
  `uma promessa quebrada não pode virar motim (adesão ${apenasUm.adesao[2]})`)
assert.ok(apenasUm.adesao[2] < 45, "mas tem de incomodar de verdade")

// Quebrar DOIS princípios ao mesmo tempo, semana após semana, esvazia o discurso:
// o jovem em forma que nunca joga sob "base" + "meritocracia".
const jovemEmFormaNoBanco = { id: 3, age: 19, form: 82, energy: 90, jogouNaSemana: false }
let dois = { principios: ["base", "meritocracia"] as Principio[], adesao: {} as Record<number, number> }
for (let i = 0; i < 15; i++) {
  dois = { principios: dois.principios, adesao: atualizarAdesao282(dois, [jovemEmFormaNoBanco]).adesao }
}
const final = atualizarAdesao282(dois, [jovemEmFormaNoBanco])
assert.ok(final.descontentes.includes(3),
  `incoerência sustentada em dois princípios tem de gerar descontentamento (adesão ${final.adesao[3]})`)

// ── O plano muda a partida? ─────────────────────────────────────────────────
// Amostra grande porque bola parada é efeito de margem: num jogo isolado ele
// some no ruído, e é assim que tem de ser.
const squad = elenco.map(p => ({ nome: p.name, pos: "ATA", shooting: 75, passing: 78, physical: 80, defending: 70 }))
const base: MatchConfig = {
  homeTeam: { curto: "AAA", nome: "Time A", prestigio: 75 } as MatchConfig["homeTeam"],
  awayTeam: { curto: "BBB", nome: "Time B", prestigio: 75 } as MatchConfig["awayTeam"],
  homeRating: 75, awayRating: 75, homeSquad: squad, awaySquad: squad, userSide: "home",
}
const golsEm = (config: MatchConfig) => {
  let total = 0
  for (let i = 0; i < 400; i++) total += simulateFullMatch(config).home.goals
  return total
}
const semPlano = golsEm(base)
const comPlano = golsEm({
  ...base,
  homeSetPiecePlan: { attackQuality: 1, defenseQuality: 0, aerialTargetName: "Atleta 2", secondBallName: "Atleta 3" },
})
assert.ok(comPlano > semPlano,
  `o plano ensaiado tem de render mais gols (sem: ${semPlano}, com: ${comPlano})`)

// Plano defensivo do adversário anula parte do ofensivo.
const contraPlano = golsEm({
  ...base,
  homeSetPiecePlan: { attackQuality: 1, defenseQuality: 0, aerialTargetName: "Atleta 2" },
  awaySetPiecePlan: { attackQuality: 0, defenseQuality: 1 },
})
assert.ok(contraPlano < comPlano,
  `o ensaio defensivo do rival tem de descontar (com: ${comPlano}, contra: ${contraPlano})`)

// O estado inicial da carreira continua neutro: quem nunca abriu a Central de
// Gestão joga exatamente o jogo de antes.
const novo = criarEstadoGestao282()
const planoNovo = planoDeBolaParada282(novo, elenco)
assert.equal(planoNovo.attackQuality, 0)
assert.equal(planoNovo.defenseQuality, 0)

console.log(`OK: gestão 1.0.282 em campo (sem plano ${semPlano} gols, com plano ${comPlano}, contra plano ${contraPlano})`)
