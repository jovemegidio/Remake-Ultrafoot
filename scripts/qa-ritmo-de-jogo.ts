// PORTAO DA 1.0.386 — o ritmo de jogo cobra o banco sem virar imposto.
//
//   npx tsx scripts/qa-ritmo-de-jogo.ts
//
// ⚠️ O QUE ESTE PORTAO PROTEGE. `ritmo` entra no `mod` de `forcasDoPlantel`, que
// e somado por igual aos tres setores dos DOIS lados. Um erro de sinal ou de
// escala aqui nao quebra nada, nao aparece em nenhuma tela e nao reprova
// compilacao: ele so desloca em silencio a calibragem de placar que a 1.0.377
// mediu com harness. E o tipo de defeito que so se descobre "sentindo que o jogo
// ficou estranho" dez partidas depois.
//
// ⚠️ E ELE COBRA OS DOIS SENTIDOS — licao do fator de furia da 1.0.383. Neste
// jogo o adversario da CPU e medido pelo PRESTIGIO do clube, nao por atletas:
// qualquer efeito de nivel de atleta so pode atingir o lado humano. Um ritmo que
// apenas penalizasse seria um imposto sobre quem atualizou o jogo.

import {
  efeitoDoRitmo,
  efeitoDoRitmoNoGrupo,
  ritmoDaSemana,
  rotuloDoRitmo,
  RITMO_INICIAL,
  PISO_SEM_EFEITO,
  RITMO_AFIADO,
  PENALIDADE_MAXIMA,
  BONUS_AFIADO,
} from "../lib/ritmo-de-jogo"
import { forcasDoPlantel, type AtletaEmCampo } from "../lib/forca-do-plantel"

let falhas = 0
function checa(condicao: boolean, titulo: string, detalhe = "") {
  if (condicao) console.log(`  ok    ${titulo}`)
  else { falhas++; console.log(`  FALHA ${titulo}${detalhe ? `\n          ${detalhe}` : ""}`) }
}

console.log("\n  RITMO DE JOGO (1.0.386)\n")

const XI: AtletaEmCampo[] = [
  { position: "GOL", overall: 78 },
  { position: "LD", overall: 76 }, { position: "ZAG", overall: 79 },
  { position: "ZAG", overall: 77 }, { position: "LE", overall: 75 },
  { position: "VOL", overall: 78 }, { position: "VOL", overall: 76 },
  { position: "MEI", overall: 80 },
  { position: "PD", overall: 79 }, { position: "ATA", overall: 82 },
  { position: "PE", overall: 77 },
].map(p => ({ ...p, isStarter: true, form: 70, morale: "Normal", moralePoints: 55 }))

// ── 1. SAVE ANTIGO NAO PODE MUDAR DE COMPORTAMENTO ────────────────────────
//
// ⚠️ A REGRA MAIS IMPORTANTE DAQUI. Save anterior a esta versao nao tem o campo
// `ritmo` em atleta nenhum. Se a ausencia valesse zero em vez do neutro, um
// elenco inteiro perderia 6 pontos de forca na primeira partida depois de
// atualizar — punicao por atualizar o jogo, o mesmo erro que o retrato de
// minutos ja documenta em `game-engine`.
{
  checa(efeitoDoRitmo(RITMO_INICIAL) === 0,
    "o valor neutro nao penaliza nem premia",
    `efeito(${RITMO_INICIAL}) = ${efeitoDoRitmo(RITMO_INICIAL)}`)

  const semRitmo = forcasDoPlantel(XI, 60)
  // A conta anterior a esta versao, escrita por extenso: forma e moral, so.
  const modAntigo = (70 - 70) / 9 + (55 - 55) / 13
  checa(Math.abs(semRitmo.mod - modAntigo) < 1e-9,
    "XI sem o campo `ritmo` da exatamente o mod de antes da versao",
    `mod = ${semRitmo.mod}, esperado ${modAntigo}`)

  const comNeutro = forcasDoPlantel(XI.map(p => ({ ...p, ritmo: RITMO_INICIAL })), 60)
  checa(Math.abs(comNeutro.mod - semRitmo.mod) < 1e-9,
    "ritmo neutro explicito e ausencia de ritmo dao o mesmo resultado")
}

// ── 2. OS DOIS SENTIDOS SAO ALCANCAVEIS NA FAIXA REAL ─────────────────────
//
// ⚠️ Nao basta a formula ter um ramo negativo: ele precisa ser ALCANCAVEL pelo
// que o gerador de entrada produz. Foi assim que a 1.0.383 descobriu que a furia
// nunca derrubava ninguem — o ramo existia e a faixa real nunca chegava la.
{
  // O titular que joga toda semana, partindo do neutro.
  let titular = RITMO_INICIAL
  for (let semana = 0; semana < 20; semana++) titular = ritmoDaSemana(titular, 90)
  checa(titular >= RITMO_AFIADO,
    `quem joga toda semana fica afiado (${titular})`)
  checa(efeitoDoRitmo(titular) === BONUS_AFIADO,
    "e o bonus e efetivamente pago")

  // O reserva que nao entra.
  let reserva = RITMO_INICIAL
  const trajetoria: number[] = []
  for (let semana = 0; semana < 12; semana++) {
    reserva = ritmoDaSemana(reserva, 0)
    trajetoria.push(reserva)
  }
  checa(efeitoDoRitmo(reserva) <= -5,
    `doze semanas no banco levam a penalidade ao fundo (${efeitoDoRitmo(reserva).toFixed(1)})`,
    `trajetoria: ${trajetoria.join(" ")}`)

  // ⚠️ E A PENALIDADE NAO PODE CHEGAR CEDO DEMAIS: revezar UMA rodada e decisao
  // normal de tecnico e nao pode custar nada.
  const umaSemanaFora = ritmoDaSemana(RITMO_INICIAL, 0)
  const duasSemanasFora = ritmoDaSemana(umaSemanaFora, 0)
  checa(efeitoDoRitmo(umaSemanaFora) === 0,
    `poupar por uma rodada nao custa nada (ritmo ${umaSemanaFora})`)
  checa(efeitoDoRitmo(duasSemanasFora) === 0,
    `poupar por duas rodadas ainda nao custa (ritmo ${duasSemanasFora})`)
  // ⚠️ MAS O CUSTO NAO E ZERO PARA QUEM ESTAVA AFIADO: ele perde o bonus na
  // hora. A decisao de revezar tem preco sem ter punicao — foi assim que este
  // portao reprovou a primeira versao, em que o piso era 80 e uma unica rodada
  // de descanso ja tirava forca do elenco.
  checa(efeitoDoRitmo(ritmoDaSemana(100, 0)) === 0,
    "quem estava afiado perde o bonus ao ser poupado, e nada alem disso",
    `ritmo ${ritmoDaSemana(100, 0)}, efeito ${efeitoDoRitmo(ritmoDaSemana(100, 0))}`)
}

// ── 3. LIMITES ────────────────────────────────────────────────────────────
{
  let piorEfeito = 0
  let melhorEfeito = 0
  for (let r = 0; r <= 100; r++) {
    piorEfeito = Math.min(piorEfeito, efeitoDoRitmo(r))
    melhorEfeito = Math.max(melhorEfeito, efeitoDoRitmo(r))
  }
  checa(piorEfeito >= -PENALIDADE_MAXIMA,
    `a penalidade e limitada a ${PENALIDADE_MAXIMA} pontos (pior: ${piorEfeito.toFixed(1)})`)
  checa(melhorEfeito === BONUS_AFIADO,
    `o bonus e limitado a ${BONUS_AFIADO} ponto (melhor: ${melhorEfeito})`)

  // Monotonia: mais ritmo nunca pode valer menos.
  let monotona = true
  for (let r = 1; r <= 100; r++) if (efeitoDoRitmo(r) < efeitoDoRitmo(r - 1)) monotona = false
  checa(monotona, "mais ritmo nunca vale menos que menos ritmo")

  // O valor fica sempre na faixa 0-100, por mais semanas que passem.
  let extremo = RITMO_INICIAL
  for (let i = 0; i < 60; i++) extremo = ritmoDaSemana(extremo, 0)
  checa(extremo >= 0, `o ritmo nao fica negativo (${extremo})`)
  let cheio = RITMO_INICIAL
  for (let i = 0; i < 60; i++) cheio = ritmoDaSemana(cheio, 90)
  checa(cheio <= 100, `o ritmo nao passa de 100 (${cheio})`)
}

// ── 4. MEDIA, NAO SOMA ────────────────────────────────────────────────────
//
// Onze atletas afiados valem +1 de forca, nao +11. Trocar media por soma seria o
// erro de escala que nenhuma tela denunciaria.
{
  const todosAfiados = forcasDoPlantel(XI.map(p => ({ ...p, ritmo: 100 })), 60)
  checa(Math.abs(todosAfiados.mod - BONUS_AFIADO) < 1e-9,
    `XI inteiro afiado vale +${BONUS_AFIADO}, nao +11 (mod = ${todosAfiados.mod})`)

  const todosParados = forcasDoPlantel(XI.map(p => ({ ...p, ritmo: 0 })), 60)
  checa(Math.abs(todosParados.mod + PENALIDADE_MAXIMA) < 1e-9,
    `XI inteiro parado vale -${PENALIDADE_MAXIMA} (mod = ${todosParados.mod})`)

  // Grupo misto: seis afiados e cinco parados ficam entre os dois extremos.
  const misto = XI.map((p, i) => ({ ...p, ritmo: i < 6 ? 100 : 0 }))
  const efeitoMisto = forcasDoPlantel(misto, 60).mod
  checa(efeitoMisto < BONUS_AFIADO && efeitoMisto > -PENALIDADE_MAXIMA,
    `elenco misto fica entre os extremos (${efeitoMisto.toFixed(2)})`)
}

// ── 5. NAO CONTA DUAS VEZES COM FORMA E MORAL ─────────────────────────────
//
// ⚠️ As tres medidas existem porque medem coisas diferentes: energia = quanto
// aguenta, forma = como vem jogando, ritmo = ha quanto tempo nao joga. Se o
// ritmo mexesse na forma (ou vice-versa), o mesmo fato entraria duas vezes.
{
  const soRitmo = forcasDoPlantel(XI.map(p => ({ ...p, ritmo: 0 })), 60).mod
  const soForma = forcasDoPlantel(XI.map(p => ({ ...p, form: 40 })), 60).mod
  const ambos = forcasDoPlantel(XI.map(p => ({ ...p, ritmo: 0, form: 40 })), 60).mod
  checa(Math.abs(ambos - (soRitmo + soForma)) < 1e-9,
    "ritmo e forma somam como parcelas independentes",
    `ritmo ${soRitmo.toFixed(2)} + forma ${soForma.toFixed(2)} != ${ambos.toFixed(2)}`)

  // E a semana NAO mexe na forma: quem nao jogou perde ritmo e so.
  checa(ritmoDaSemana(50, 0) === 43 && ritmoDaSemana(50, 90) === 62,
    "a semana move o ritmo nos dois sentidos e nada mais",
    `${ritmoDaSemana(50, 0)} / ${ritmoDaSemana(50, 90)}`)
}

// ── 6. VOLTA DE LESAO CAI PELO CAMINHO NATURAL ────────────────────────────
//
// ⚠️ SEM REGRA PROPRIA PARA LESAO, de proposito. Quem esteve dois meses no
// departamento medico nao jogou — a queda ja e a mesma de quem ficou no banco.
// Uma segunda regra somaria a mesma ausencia duas vezes.
{
  let voltando = RITMO_INICIAL
  for (let semana = 0; semana < 8; semana++) voltando = ritmoDaSemana(voltando, 0)
  checa(efeitoDoRitmo(voltando) < -2,
    `quem volta de oito semanas parado entra sem ritmo (${voltando}, ${efeitoDoRitmo(voltando).toFixed(1)})`)
  checa(rotuloDoRitmo(voltando) !== rotuloDoRitmo(100),
    "e a tela diz isso com outro rotulo",
    `${rotuloDoRitmo(voltando)} vs ${rotuloDoRitmo(100)}`)
}

// ── 7. MINUTOS PARCIAIS CONTAM MENOS QUE UM JOGO INTEIRO ──────────────────
{
  const inteiro = ritmoDaSemana(50, 90)
  const meio = ritmoDaSemana(50, 30)
  const pontinha = ritmoDaSemana(50, 5)
  const nada = ritmoDaSemana(50, 0)
  checa(inteiro > meio && meio > pontinha && pontinha > nada,
    `mais minutos rendem mais ritmo (${inteiro} > ${meio} > ${pontinha} > ${nada})`)
  checa(pontinha > 50,
    "entrar nos ultimos minutos ainda soma alguma coisa")
}

// ── 8. A REGUA E A MESMA PARA OS DOIS LADOS ───────────────────────────────
//
// `forcasDoPlantel` e a unica conta de forca do jogo (ver o cabecalho do
// arquivo). O tecnico adversario do co-op paga o mesmo preco por revezar demais.
{
  const grupo = XI.map((p, i) => ({ ...p, ritmo: i < 5 ? 100 : 30 }))
  const ladoA = forcasDoPlantel(grupo, 60)
  const ladoB = forcasDoPlantel([...grupo].reverse(), 60)
  checa(Math.abs(ladoA.mod - ladoB.mod) < 1e-9,
    "o mesmo elenco vale o mesmo, venha de que lado vier")
  checa(Math.abs(efeitoDoRitmoNoGrupo(grupo.map(p => p.ritmo)) - ladoA.mod) < 1e-9,
    "o mod do XI neutro em forma/moral e exatamente o efeito do ritmo")
}

// ── 9. GRUPO VAZIO NAO EXPLODE ────────────────────────────────────────────
{
  checa(efeitoDoRitmoNoGrupo([]) === 0, "grupo vazio nao produz efeito")
  checa(efeitoDoRitmoNoGrupo([undefined, undefined]) === 0,
    "grupo sem ritmo medido nao produz efeito")
  checa(rotuloDoRitmo(undefined) === rotuloDoRitmo(RITMO_INICIAL),
    "atleta sem ritmo medido mostra o rotulo do neutro")
}

// ── 10. PISOS E ROTULOS CASAM ─────────────────────────────────────────────
{
  checa(efeitoDoRitmo(PISO_SEM_EFEITO) === 0 && efeitoDoRitmo(PISO_SEM_EFEITO - 1) < 0,
    `o piso sem efeito e exatamente ${PISO_SEM_EFEITO}`)
  checa(efeitoDoRitmo(RITMO_AFIADO) === BONUS_AFIADO && efeitoDoRitmo(RITMO_AFIADO - 1) === 0,
    `o bonus comeca exatamente em ${RITMO_AFIADO}`)
  // ⚠️ UMA AMOSTRA POR FAIXA, e as faixas mudaram quando o piso desceu de 80
  // para 70. A versao anterior deste teste amostrava 70 e 85, que passaram a
  // cair as duas em "Em ritmo" — o portao acusou, e o defeito era do TESTE, nao
  // do codigo. Retunar limites obriga a revisitar quem os amostra.
  const amostras = [10, 35, 60, 85, 100]
  const rotulos = new Set(amostras.map(rotuloDoRitmo))
  checa(rotulos.size === amostras.length, "cada faixa tem um rotulo proprio",
    amostras.map(r => `${r}=${rotuloDoRitmo(r)}`).join(" | "))
}

console.log(falhas === 0
  ? "\nRITMO DE JOGO OK — o banco cobra, o titular ganha, e save antigo nao muda.\n"
  : `\n${falhas} verificacao(oes) falharam.\n`)
process.exit(falhas === 0 ? 0 : 1)
