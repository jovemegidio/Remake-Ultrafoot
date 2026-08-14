// MODELO CANÔNICO DO ATLETA (1.0.293).
//
// O que estes testes protegem, em ordem de gravidade se quebrar:
//   1. DETERMINISMO. O perfil é derivado do id para não ocupar save. Se ele
//      variar entre leituras, o mesmo atleta muda de tendência e de propensão a
//      lesão a cada tela aberta — e nada disso apareceria como erro.
//   2. COMPATIBILIDADE com a calibração de 20 mil partidas: familiaridade 20
//      tem de render 1,00 e familiaridade 0 tem de render 0,76, que são
//      exatamente as pontas da `penalidadeImprovisacao` antiga.
//   3. TETO da familiaridade aprendida: ninguém vira zagueiro de verdade.
//
//   npx tsx scripts/test-modelo-de-jogador.ts

import assert from "node:assert"
import {
  aprenderPosicao,
  exercerFuncao,
  familiaridadeComAFuncao,
  familiaridadeEm,
  fatorDeJogoDecisivo,
  forcaDeGoleiro,
  perfilDoAtleta,
  pesoDeLesao,
  rendimentoNaPosicao,
  semanasParaAdaptar,
} from "../lib/modelo-de-jogador"
import { evoluirAtributos, overallFromAttributes, type Attrs } from "../lib/player-attributes"

let falhas = 0
function check(nome: string, cond: boolean, detalhe = "") {
  if (!cond) falhas++
  console.log(`${cond ? "  ok  " : " FALHA"} ${nome}${cond ? "" : ` — ${detalhe}`}`)
}

console.log("\nDeterminismo\n")

const a1 = perfilDoAtleta(4242, "ZAG", 78)
const a2 = perfilDoAtleta(4242, "ZAG", 78)
check("mesmo id devolve o mesmo perfil", JSON.stringify(a1) === JSON.stringify(a2))
check("ids diferentes dao perfis diferentes",
  JSON.stringify(perfilDoAtleta(1, "ZAG", 78)) !== JSON.stringify(perfilDoAtleta(2, "ZAG", 78)))
check("todos os ocultos ficam em 1-20",
  [a1.jogosDecisivos, a1.adaptacao, a1.versatilidade, a1.propensaoALesao].every(v => v >= 1 && v <= 20),
  JSON.stringify([a1.jogosDecisivos, a1.adaptacao, a1.versatilidade, a1.propensaoALesao]))
check("pe fraco fica em 1-5", a1.pesFraco >= 1 && a1.pesFraco <= 5, `${a1.pesFraco}`)
// AS `tendencias` SAIRAM NA 1.0.298. Eram rotulo sem efeito no motor e
// concorriam com as CARACTERISTICAS, que dizem a mesma coisa e agora valem em
// campo. Quem cobre a substituta e `scripts/test-caracteristicas.ts`.
check("o perfil nao carrega mais tendencias",
  !("tendencias" in (a1 as unknown as Record<string, unknown>)))

console.log("\nFamiliaridade\n")

check("posicao natural e 20", a1.familiaridadeBase.ZAG === 20, `${a1.familiaridadeBase.ZAG}`)
check("gol e a posicao mais distante de um zagueiro",
  a1.familiaridadeBase.GOL <= a1.familiaridadeBase.ATA,
  `GOL=${a1.familiaridadeBase.GOL} ATA=${a1.familiaridadeBase.ATA}`)

const lateral = perfilDoAtleta(777, "LD", 72)
check("mesmo setor, outro lado e a troca mais barata",
  lateral.familiaridadeBase.LE >= lateral.familiaridadeBase.ATA,
  `LE=${lateral.familiaridadeBase.LE} ATA=${lateral.familiaridadeBase.ATA}`)

const comSecundaria = perfilDoAtleta(777, "LD", 72, ["ZAG"])
check("secundaria declarada vale mais que a estimativa",
  comSecundaria.familiaridadeBase.ZAG >= 15,
  `${comSecundaria.familiaridadeBase.ZAG}`)

console.log("\nCompatibilidade com a calibracao antiga\n")

// ⚠️ Estes dois numeros NAO podem mudar sem refazer a medicao de 20 mil
// partidas: sao as pontas da curva de improvisacao que ja estava calibrada.
check("familiaridade 20 rende 1,000",
  rendimentoNaPosicao({ ...a1, familiaridadeBase: { ...a1.familiaridadeBase, ATA: 20 } }, undefined, "ATA") === 1,
  `${rendimentoNaPosicao({ ...a1, familiaridadeBase: { ...a1.familiaridadeBase, ATA: 20 } }, undefined, "ATA")}`)
check("familiaridade 0 rende 0,760",
  rendimentoNaPosicao({ ...a1, familiaridadeBase: { ...a1.familiaridadeBase, ATA: 0 } }, undefined, "ATA") === 0.76,
  `${rendimentoNaPosicao({ ...a1, familiaridadeBase: { ...a1.familiaridadeBase, ATA: 0 } }, undefined, "ATA")}`)

console.log("\nAprender a posicao jogando\n")

let progresso = aprenderPosicao(lateral, undefined, "ATA", 90)
check("uma partida fora de posicao ja credita alguma coisa",
  (progresso?.familiaridadeGanha?.ATA ?? 0) > 0,
  `${progresso?.familiaridadeGanha?.ATA}`)

const umaPartida = progresso?.familiaridadeGanha?.ATA ?? 0
check("uma partida rende menos de 1 ponto (nao vira zagueiro em 3 jogos)",
  umaPartida < 1, `${umaPartida}`)

for (let i = 0; i < 200; i++) progresso = aprenderPosicao(lateral, progresso, "ATA", 90)
check("o teto e 20 mesmo depois de 200 partidas",
  familiaridadeEm(lateral, progresso, "ATA") <= 20,
  `${familiaridadeEm(lateral, progresso, "ATA")}`)
check("200 partidas fora de posicao levam a familiaridade ao teto",
  familiaridadeEm(lateral, progresso, "ATA") === 20,
  `${familiaridadeEm(lateral, progresso, "ATA")}`)

const naNatural = aprenderPosicao(lateral, undefined, "LD", 90)
check("jogar NA posicao natural nao grava nada no save", naNatural === undefined)

console.log("\nGoleiro\n")

const goleiro = perfilDoAtleta(9001, "GOL", 82)
check("goleiro tem atributos de goleiro", goleiro.goleiro != null)
check("jogador de linha NAO tem", perfilDoAtleta(9002, "ZAG", 82).goleiro == null)
const forca = forcaDeGoleiro(goleiro)
check("forca do goleiro sai na escala de overall",
  forca != null && forca >= 40 && forca <= 100, `${forca}`)
check("goleiro melhor tem forca maior",
  (forcaDeGoleiro(perfilDoAtleta(9001, "GOL", 90)) ?? 0) > (forcaDeGoleiro(perfilDoAtleta(9001, "GOL", 55)) ?? 0),
  `${forcaDeGoleiro(perfilDoAtleta(9001, "GOL", 90))} x ${forcaDeGoleiro(perfilDoAtleta(9001, "GOL", 55))}`)
check("forca de goleiro e null para jogador de linha", forcaDeGoleiro(a1) === null)

console.log("\nConsequencias no motor\n")

check("propensao alta pesa mais no sorteio de lesao",
  pesoDeLesao({ ...a1, propensaoALesao: 20 }) > pesoDeLesao({ ...a1, propensaoALesao: 1 }),
  `${pesoDeLesao({ ...a1, propensaoALesao: 20 })} x ${pesoDeLesao({ ...a1, propensaoALesao: 1 })}`)
check("peso de lesao gira em volta de 1",
  pesoDeLesao({ ...a1, propensaoALesao: 10 }) > 0.9 && pesoDeLesao({ ...a1, propensaoALesao: 10 }) < 1.15,
  `${pesoDeLesao({ ...a1, propensaoALesao: 10 })}`)
check("jogo comum nao aplica fator nenhum", fatorDeJogoDecisivo(a1, false) === 1)
check("decisao mexe pouco (entre 0,96 e 1,04)",
  fatorDeJogoDecisivo({ ...a1, jogosDecisivos: 20 }, true) <= 1.04 &&
  fatorDeJogoDecisivo({ ...a1, jogosDecisivos: 1 }, true) >= 0.96,
  `${fatorDeJogoDecisivo({ ...a1, jogosDecisivos: 1 }, true)}..${fatorDeJogoDecisivo({ ...a1, jogosDecisivos: 20 }, true)}`)
check("quem se adapta mal demora mais para entrosar",
  semanasParaAdaptar({ ...a1, adaptacao: 1 }) > semanasParaAdaptar({ ...a1, adaptacao: 20 }),
  `${semanasParaAdaptar({ ...a1, adaptacao: 1 })} x ${semanasParaAdaptar({ ...a1, adaptacao: 20 })}`)

console.log("\nFamiliaridade com a FUNCAO (diferente da adequacao por atributos)\n")

check("funcao nova CUSTA (comeca abaixo de 1)",
  familiaridadeComAFuncao(undefined, "regista", 10) < 1,
  `${familiaridadeComAFuncao(undefined, "regista", 10)}`)
check("sem funcao definida nao ha desconto nenhum",
  familiaridadeComAFuncao(undefined, undefined, 10) === 1)

let hab: ReturnType<typeof exercerFuncao> = undefined
for (let i = 0; i < 25; i++) hab = exercerFuncao(hab, "regista")
check("exercer a funcao satura o multiplicador em 1,00",
  familiaridadeComAFuncao(hab, "regista", 10) === 1,
  `${familiaridadeComAFuncao(hab, "regista", 10)}`)
check("nunca passa de 1 (habito e custo, nunca bonus)",
  familiaridadeComAFuncao(hab, "regista", 20) <= 1,
  `${familiaridadeComAFuncao(hab, "regista", 20)}`)
check("o versatil assenta na funcao mais rapido",
  familiaridadeComAFuncao(exercerFuncao(undefined, "regista"), "regista", 20) >=
  familiaridadeComAFuncao(exercerFuncao(undefined, "regista"), "regista", 1))
check("outra funcao continua nova para ele",
  familiaridadeComAFuncao(hab, "mezzala", 10) < 1,
  `${familiaridadeComAFuncao(hab, "mezzala", 10)}`)

// Teto de gravacao: sem ele o save cresceria por temporada sem efeito nenhum.
let saturado = hab
for (let i = 0; i < 50; i++) saturado = exercerFuncao(saturado, "regista")
const antesDoTeto = exercerFuncao(saturado, "regista")
check("acima do teto para de gravar (mesmo objeto de volta)", antesDoTeto === saturado)

console.log("\nEvolucao separada por atributo\n")

const base: Attrs = { pace: 70, shooting: 70, passing: 70, dribbling: 70, defending: 70, physical: 70 }

const jovem = evoluirAtributos(base, "MEI", 5, 19)
check("jovem cresce mais em tecnica do que em fisico",
  (jovem.passing - base.passing) > (jovem.physical - base.physical),
  `passe +${jovem.passing - base.passing} x fisico +${jovem.physical - base.physical}`)

const veterano = evoluirAtributos(base, "MEI", -5, 35)
check("veterano perde as pernas antes da cabeca",
  (base.pace - veterano.pace) > (base.passing - veterano.passing),
  `ritmo -${base.pace - veterano.pace} x passe -${base.passing - veterano.passing}`)

// ⚠️ A guarda que impede overall e atributos de divergirem de novo: a média
// PONDERADA do que a evolução distribui tem de continuar sendo o delta.
for (const [idade, delta] of [[19, 5], [27, 3], [35, -5], [36, -3]] as [number, number][]) {
  const antes = overallFromAttributes(base, "MEI")
  const depois = overallFromAttributes(evoluirAtributos(base, "MEI", delta, idade), "MEI")
  check(`aos ${idade} com delta ${delta}, o overall acompanha (${antes} -> ${depois})`,
    Math.abs((depois - antes) - delta) <= 1,
    `esperado ~${delta}, obtido ${depois - antes}`)
}
check("delta zero nao mexe em nada", evoluirAtributos(base, "MEI", 0, 25) === base)
check("zagueiro nao ganha finalizacao",
  evoluirAtributos(base, "ZAG", 5, 20).shooting === base.shooting,
  `${evoluirAtributos(base, "ZAG", 5, 20).shooting}`)

console.log(falhas === 0 ? "\nTODOS OS TESTES PASSARAM\n" : `\n${falhas} FALHA(S)\n`)
process.exit(falhas === 0 ? 0 : 1)
