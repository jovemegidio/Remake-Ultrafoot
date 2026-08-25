/**
 * A FÍSICA DO CHUTE — o que este teste protege.
 *
 * ⚠️ O MODO DE FALHAR AQUI É SILENCIOSO E JÁ ACONTECEU TRÊS VEZES na
 * construção deste arquivo. Nenhuma delas deu erro; todas deram um jogo errado:
 *
 *   1. o goleiro projetava `x/z` e reconstruía o destino EXATO de qualquer
 *      chute reto — 0% de gol em 60 cenários, e ninguém "quebrou";
 *   2. sem contexto, o craque apontava no canto e fazia 100% — a resposta ótima
 *      virava única e o jogo acabava na segunda partida;
 *   3. o goleiro ficava colado na linha, então chute de PERTO era mais fácil —
 *      o inverso do futebol, e o cara a cara dava 89%.
 *
 * As asserções abaixo são as que teriam pego cada uma delas.
 */
import {
  CHANCE_PADRAO, calcularTrajetoria, defesaDoGoleiro, desvioDoAtleta,
  efeitoReal, potenciaReal, resolverChute,
  type ChuteDoJogador, type ContextoDoChute,
} from "../lib/fisica-do-chute"

let passou = 0
let falhou = 0
function ok(nome: string, cond: boolean, detalhe = "") {
  if (cond) { passou++; console.log(`  ok   ${nome}`) }
  else { falhou++; console.log(`  FALHA ${nome} ${detalhe}`) }
}

const CRAQUE = { finalizacao: 94, fisico: 85, drible: 90 }
const MEDIANO = { finalizacao: 62, fisico: 65, drible: 58 }
const PERNA = { finalizacao: 35, fisico: 45, drible: 30 }
const GK = { qualidade: 68 }

const CANTO: ChuteDoJogador = { alvo: { x: -0.78, y: 0.22 }, forca: 0.78, efeito: 0 }
const MEIO: ChuteDoJogador = { alvo: { x: 0.02, y: 0.45 }, forca: 0.6, efeito: 0 }

function taxa(atributos: typeof CRAQUE, chute: ChuteDoJogador, ctx: ContextoDoChute, n = 400) {
  let gols = 0
  for (let i = 0; i < n; i++) {
    if (resolverChute(chute, atributos, GK, `t:${i}`, ctx).tipo === "gol") gols++
  }
  return (gols / n) * 100
}

// ═══════════════════════════════════════════════════════════════════════════
console.log("\n── 1. NÃO HÁ SORTEIO NO DESFECHO ─────────────────────────────")

{
  // A MESMA jogada dá SEMPRE o mesmo resultado. É isto que permite ao jogador
  // aprender — e é o oposto do modelo probabilístico que este arquivo trocou.
  const a = resolverChute(CANTO, CRAQUE, GK, "igual", CHANCE_PADRAO)
  const b = resolverChute(CANTO, CRAQUE, GK, "igual", CHANCE_PADRAO)
  ok("o mesmo chute dá o mesmo desfecho", a.tipo === b.tipo)
  ok("e a bola termina no mesmo lugar",
    a.onde.x === b.onde.x && a.onde.y === b.onde.y)

  const c = resolverChute(CANTO, CRAQUE, GK, "outra", CHANCE_PADRAO)
  ok("sementes diferentes movem a bola", a.onde.x !== c.onde.x || a.onde.y !== c.onde.y)
}

// ═══════════════════════════════════════════════════════════════════════════
console.log("\n── 2. O GOLEIRO NÃO É CLARIVIDENTE (defeito nº 1) ────────────")

{
  // ⚠️ ESTA É A ASSERÇÃO QUE TERIA PEGO O `x/z`. Se o goleiro reconstrói o
  // destino, ele defende de tudo e a conversão colapsa para zero.
  const grandeChance: ContextoDoChute = { distancia: 0.12, angulo: 0.1, pressao: 0.2 }
  const t = taxa(CRAQUE, CANTO, grandeChance)
  ok("craque na grande chance converte alguma coisa", t > 10, `(${t.toFixed(0)}%)`)
  ok("e não converte quase tudo", t < 80, `(${t.toFixed(0)}%)`)

  // Ele erra o lado quando a bola tem curva — senão o efeito seria enfeite.
  const comCurva = calcularTrajetoria(
    { alvo: { x: 0, y: 0.4 }, forca: 0.7, efeito: 1 }, CRAQUE, "curva", CHANCE_PADRAO)
  const semCurva = calcularTrajetoria(
    { alvo: { x: 0, y: 0.4 }, forca: 0.7, efeito: 0 }, CRAQUE, "curva", CHANCE_PADRAO)
  const gkComCurva = defesaDoGoleiro(comCurva, GK, CHANCE_PADRAO)
  ok("a bola com curva termina longe de onde saiu",
    Math.abs(comCurva.chegada.x - gkComCurva.ladoEscolhido) > 0.1,
    `(chegada ${comCurva.chegada.x.toFixed(2)}, gk leu ${gkComCurva.ladoEscolhido.toFixed(2)})`)
  ok("a bola reta termina onde saiu", Math.abs(semCurva.chegada.x) < 0.2)
}

// ═══════════════════════════════════════════════════════════════════════════
console.log("\n── 3. O CONTEXTO SEPARA A CHANCE (defeito nº 2) ──────────────")

{
  const perto: ContextoDoChute = { distancia: 0.12, angulo: 0.1, pressao: 0.2 }
  const longe: ContextoDoChute = { distancia: 0.85, angulo: 0.3, pressao: 0.5 }
  // A mira compensa a queda, como um jogador faria.
  const miraLonge: ChuteDoJogador = { ...CANTO, alvo: { x: -0.76, y: 0.22 + 0.85 * 0.42 } }

  const tPerto = taxa(CRAQUE, CANTO, perto)
  const tLonge = taxa(CRAQUE, miraLonge, longe)
  ok("de perto converte mais que de fora", tPerto > tLonge, `(${tPerto.toFixed(0)}% x ${tLonge.toFixed(0)}%)`)

  // ⚠️ A ASSERÇÃO QUE TERIA PEGO O "100%": sem contexto, este número era 100.
  ok("nem o craque de perto converte quase sempre", tPerto < 80, `(${tPerto.toFixed(0)}%)`)

  const semPressao = desvioDoAtleta(94, 0.7, { distancia: 0.1, angulo: 0, pressao: 0 })
  const comPressao = desvioDoAtleta(94, 0.7, { distancia: 0.1, angulo: 0, pressao: 0.9 })
  ok("marcação aumenta o desvio", comPressao > semPressao * 2,
    `(${semPressao.toFixed(3)} -> ${comPressao.toFixed(3)})`)
  ok("mas o craque nunca fica perfeito", semPressao > 0.03, `(${semPressao.toFixed(3)})`)
}

// ═══════════════════════════════════════════════════════════════════════════
console.log("\n── 4. O GOLEIRO SAI DO GOL (defeito nº 3) ────────────────────")

{
  const traj = calcularTrajetoria(CANTO, CRAQUE, "gk", CHANCE_PADRAO)
  const dePerto = defesaDoGoleiro(traj, GK, { distancia: 0.1, angulo: 0, pressao: 0.2 })
  const deLonge = defesaDoGoleiro(traj, GK, { distancia: 0.9, angulo: 0, pressao: 0.2 })
  ok("de perto ele cobre MAIS (avança e fecha o ângulo)",
    dePerto.alcance > deLonge.alcance,
    `(${dePerto.alcance.toFixed(2)} x ${deLonge.alcance.toFixed(2)})`)

  // ⚠️ REGRA, NÃO DIFICULDADE: no pênalti ele não pode sair da linha.
  const penalti = defesaDoGoleiro(traj, GK, { distancia: 0.2, angulo: 0, pressao: 0.3, goleiroNaLinha: true })
  const mesmaDistancia = defesaDoGoleiro(traj, GK, { distancia: 0.2, angulo: 0, pressao: 0.3 })
  ok("preso à linha, ele cobre menos que na mesma distância livre",
    penalti.alcance < mesmaDistancia.alcance,
    `(${penalti.alcance.toFixed(2)} x ${mesmaDistancia.alcance.toFixed(2)})`)

  const bom = { qualidade: 90 }
  const ruim = { qualidade: 40 }
  ok("goleiro melhor cobre mais chão",
    defesaDoGoleiro(traj, bom, CHANCE_PADRAO).alcance > defesaDoGoleiro(traj, ruim, CHANCE_PADRAO).alcance)
}

// ═══════════════════════════════════════════════════════════════════════════
console.log("\n── 5. AS DUAS INVARIANTES DO MODO ────────────────────────────")

{
  const ctx: ContextoDoChute = { distancia: 0.35, angulo: 0.3, pressao: 0.45 }

  // Apontar bem vale mais que ser craque.
  const craqueMal = taxa(CRAQUE, MEIO, ctx)
  const medianoBem = taxa(MEDIANO, CANTO, ctx)
  ok("mediano apontando bem supera craque apontando mal",
    medianoBem > craqueMal, `(${medianoBem.toFixed(0)}% x ${craqueMal.toFixed(0)}%)`)

  // Mas o atleta ainda decide, com a MESMA mira.
  const craqueBem = taxa(CRAQUE, CANTO, ctx)
  const pernaBem = taxa(PERNA, CANTO, ctx)
  ok("com a mesma mira, o craque supera o perna-de-pau",
    craqueBem > pernaBem + 5, `(${craqueBem.toFixed(0)}% x ${pernaBem.toFixed(0)}%)`)
}

// ═══════════════════════════════════════════════════════════════════════════
console.log("\n── 6. Os três lugares onde o atributo vive ───────────────────")

{
  ok("finalização baixa erra mais", desvioDoAtleta(35, 0.7) > desvioDoAtleta(94, 0.7))
  ok("bater com força abre o desvio", desvioDoAtleta(70, 1) > desvioDoAtleta(70, 0.3))
  ok("físico alto bate mais forte", potenciaReal(1, 90) > potenciaReal(1, 40))
  ok("pressão derruba a potência",
    potenciaReal(1, 80, { distancia: 0, angulo: 0, pressao: 0.9 }) < potenciaReal(1, 80))
  ok("drible alto curva mais", Math.abs(efeitoReal(1, 95)) > Math.abs(efeitoReal(1, 30)))
}

// ═══════════════════════════════════════════════════════════════════════════
console.log("\n── 7. A bola pode sair, bater na trave e ser defendida ───────")

{
  const tipos = new Set<string>()
  const ctx: ContextoDoChute = { distancia: 0.5, angulo: 0.4, pressao: 0.5 }
  // ⚠️ A MIRA COMPENSA A QUEDA, e a primeira versão desta asserção não
  // compensava: com o alvo em y=0,22 a 0,5 de distância, a bola morria no chão
  // antes da linha e "trave" nunca aparecia. O teste reprovava a física por
  // causa de uma mira ruim — a mesma armadilha que a calibração já tinha
  // pegado. Um jogador de verdade sobe a mira depois do primeiro chute rasteiro.
  const miraQueCompensa: ChuteDoJogador = { ...CANTO, alvo: { x: -0.78, y: 0.22 + 0.5 * 0.42 } }
  for (let i = 0; i < 500; i++) {
    tipos.add(resolverChute(miraQueCompensa, MEDIANO, GK, `variedade:${i}`, ctx).tipo)
  }
  ok("os quatro desfechos acontecem", tipos.size === 4, `(${[...tipos].join(", ")})`)

  // Mirar muito fora sai — senão a mira não teria consequência.
  const foraDeProposito: ChuteDoJogador = { alvo: { x: 1.6, y: 0.5 }, forca: 0.7, efeito: 0 }
  ok("mirar fora do gol sai", resolverChute(foraDeProposito, CRAQUE, GK, "fora", CHANCE_PADRAO).tipo === "fora")
}

console.log(`\n${falhou === 0 ? "PASSOU" : "FALHOU"} — ${passou} ok, ${falhou} falha(s)\n`)
process.exit(falhou === 0 ? 0 : 1)
