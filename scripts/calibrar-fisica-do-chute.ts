/**
 * CALIBRAÇÃO DA FÍSICA DO CHUTE — medir antes de acreditar.
 *
 * ⚠️ POR QUE ISTO VEM ANTES DA TELA. Uma física não calibrada é pior que o
 * sorteio que ela substitui: ou vira 8 gols por partida (arcade, e atropela a
 * calibração de 20 mil jogos do motor) ou vira zero (frustrante, e o jogador
 * conclui que o controle está quebrado). Os dois já aconteceram aqui — a
 * primeira versão do goleiro defendeu 100% de 60 cenários.
 *
 * ⚠️ E A PRIMEIRA VERSÃO DESTE HARNESS MEDIU A COISA ERRADA: só variava a MIRA,
 * com todo chute saindo da mesma situação. Concluiu "canto = 100%" e teria feito
 * eu calibrar o goleiro para tapar um buraco que não era do goleiro — era a
 * falta de CONTEXTO. Cenário é o que separa a grande chance do chute de fora.
 *
 * As faixas-alvo, tiradas do futebol real:
 *
 *   chute de fora da área .......... 3 a 6% viram gol
 *   finalização dentro da área ..... 15 a 25%
 *   grande chance / cara a cara .... 35 a 45%
 *   pênalti ........................ 75 a 80%
 *
 *   node --import tsx scripts/calibrar-fisica-do-chute.ts
 */
import {
  resolverChute, type ChuteDoJogador, type ContextoDoChute,
} from "../lib/fisica-do-chute"

const PERFIS = [
  { nome: "perna-de-pau", finalizacao: 35, fisico: 45, drible: 30 },
  { nome: "mediano", finalizacao: 62, fisico: 65, drible: 58 },
  { nome: "bom", finalizacao: 78, fisico: 75, drible: 72 },
  { nome: "craque", finalizacao: 94, fisico: 85, drible: 90 },
]

const GK = { nome: "medio", qualidade: 68 }

/** Os cenários que um jogo de futebol de fato oferece. */
const CENARIOS: { nome: string; ctx: ContextoDoChute; alvo: number[]; faixa: [number, number] }[] = [
  {
    nome: "penalti",
    // ⚠️ pressao 0,3 num penalti SEM MARCADOR: a pressao aqui e mental, e e
    // ela que explica os 24% que o futebol real erra da marca da cal.
    ctx: { distancia: 0.2, angulo: 0, pressao: 0.3, goleiroNaLinha: true },
    alvo: [75, 80], faixa: [65, 90],
  },
  {
    nome: "cara a cara (grande chance)",
    ctx: { distancia: 0.12, angulo: 0.1, pressao: 0.2 },
    alvo: [35, 45], faixa: [28, 55],
  },
  {
    nome: "finalizacao na area",
    ctx: { distancia: 0.35, angulo: 0.3, pressao: 0.45 },
    alvo: [15, 25], faixa: [10, 32],
  },
  {
    nome: "de fora da area",
    ctx: { distancia: 0.85, angulo: 0.3, pressao: 0.5 },
    alvo: [3, 6], faixa: [1, 11],
  },
  {
    nome: "angulo dificil, marcado",
    ctx: { distancia: 0.4, angulo: 0.85, pressao: 0.7 },
    alvo: [4, 9], faixa: [1, 14],
  },
]

const N = 600

/**
 * A MIRA DE UM JOGADOR COMPETENTE — e ela COMPENSA A QUEDA.
 *
 * ⚠️ A PRIMEIRA VERSÃO USAVA MIRA FIXA e concluiu "chute de fora = 0%, 600 de
 * 600 na linha de fundo". O número era real, mas a conclusão seria errada: um
 * jogador de verdade, vendo a bola morrer no chão, mira MAIS ALTO na próxima.
 * Medir com uma mira que nunca aprende mede um jogador burro, não o sistema.
 *
 * Aqui a mira sobe conforme a distância, como sobe a de qualquer um que já
 * chutou de longe uma vez.
 */
function miraBoa(ctx: ContextoDoChute): ChuteDoJogador {
  return {
    alvo: { x: -0.76, y: 0.22 + ctx.distancia * 0.42 },
    forca: 0.78,
    efeito: -0.2,
  }
}

/** A mira de quem não pensou: meio do gol, força média. */
const MIRA_RUIM: ChuteDoJogador = { alvo: { x: 0.05, y: 0.45 }, forca: 0.6, efeito: 0 }

function conversao(perfil: typeof PERFIS[number], ctx: ContextoDoChute, chute: ChuteDoJogador) {
  let gols = 0
  const onde = { gol: 0, defesa: 0, trave: 0, fora: 0 }
  for (let i = 0; i < N; i++) {
    const r = resolverChute(chute, perfil, GK, `cal:${perfil.nome}:${i}`, ctx)
    onde[r.tipo]++
    if (r.tipo === "gol") gols++
  }
  return { pct: (gols / N) * 100, onde }
}

let problemas = 0

console.log(`\n═══ CONVERSÃO POR CENÁRIO (mira boa, goleiro ${GK.qualidade}) ═══\n`)
console.log(`${"cenário".padEnd(28)}${PERFIS.map(p => p.nome.slice(0, 9).padStart(11)).join("")}   alvo`)

for (const c of CENARIOS) {
  const linha = PERFIS.map(p => `${conversao(p, c.ctx, miraBoa(c.ctx)).pct.toFixed(0)}%`.padStart(11)).join("")
  console.log(`${c.nome.padEnd(28)}${linha}   ${c.alvo[0]}-${c.alvo[1]}%`)
}

console.log(`\n═══ O CENÁRIO MÉDIO ESTÁ NA FAIXA? (atleta "bom") ═══\n`)
const bom = PERFIS[2]
for (const c of CENARIOS) {
  const r = conversao(bom, c.ctx, miraBoa(c.ctx))
  const dentro = r.pct >= c.faixa[0] && r.pct <= c.faixa[1]
  if (!dentro) problemas++
  console.log(`  ${dentro ? "ok   " : "FORA "} ${c.nome.padEnd(28)} ${r.pct.toFixed(0)}%  (aceita ${c.faixa[0]}-${c.faixa[1]}%)`)
  console.log(`        gol ${r.onde.gol} | defesa ${r.onde.defesa} | trave ${r.onde.trave} | fora ${r.onde.fora}`)
}

console.log(`\n═══ AS DUAS INVARIANTES QUE DEFINEM O SISTEMA ═══\n`)
const ctxMedio = CENARIOS[2].ctx

const craqueMal = conversao(PERFIS[3], ctxMedio, MIRA_RUIM).pct
const medianoBem = conversao(PERFIS[1], ctxMedio, miraBoa(ctxMedio)).pct
const ok1 = medianoBem > craqueMal
if (!ok1) problemas++
console.log(`  craque apontando MAL ........ ${craqueMal.toFixed(0)}%`)
console.log(`  mediano apontando BEM ....... ${medianoBem.toFixed(0)}%`)
console.log(`  ${ok1 ? "ok" : "PROBLEMA"}: apontar bem tem de valer mais que ser craque`)

const craqueBem = conversao(PERFIS[3], ctxMedio, miraBoa(ctxMedio)).pct
const pernaBem = conversao(PERFIS[0], ctxMedio, miraBoa(ctxMedio)).pct
const ok2 = craqueBem > pernaBem + 5
if (!ok2) problemas++
console.log(`\n  craque apontando bem ........ ${craqueBem.toFixed(0)}%`)
console.log(`  perna-de-pau, mira igual .... ${pernaBem.toFixed(0)}%`)
console.log(`  ${ok2 ? "ok" : "PROBLEMA"}: com a MESMA mira, o atleta ainda decide`)

// ⚠️ A TERCEIRA, que a primeira medição não tinha e que impede o jogo resolvido:
// se o canto bater 90% para o craque, a resposta ótima vira única e o jogo acaba.
const craqueNoCanto = conversao(PERFIS[3], CENARIOS[1].ctx, miraBoa(CENARIOS[1].ctx)).pct
const ok3 = craqueNoCanto < 70
if (!ok3) problemas++
console.log(`\n  craque na grande chance ..... ${craqueNoCanto.toFixed(0)}%`)
console.log(`  ${ok3 ? "ok" : "PROBLEMA"}: nem o craque converte quase sempre — senão o jogo se resolve`)

console.log(`\n${problemas === 0 ? "CALIBRADO" : `${problemas} PONTO(S) FORA`}\n`)
process.exit(problemas === 0 ? 0 : 1)
