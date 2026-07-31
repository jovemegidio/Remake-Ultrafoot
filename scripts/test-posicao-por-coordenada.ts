// ONDE O ATLETA ESTA JOGANDO, pelas coordenadas da prancheta.
//
// Este teste existe por causa de um defeito que passou batido: a penalidade de
// improvisacao estava ligada ao `slotPos` de `assignPlayersToFormation`, e o
// encaixe da a cada atleta o slot da PROPRIA posicao dele. Origem e destino eram
// sempre iguais, o fator dava 1 e arrastar o goleiro para a zaga nao mudava NADA
// — nem na tela nem no motor. Quem manda e a coordenada.
//
// Convencao da prancheta: x 0-100 da esquerda para a direita; y 0-100 com 0 no
// gol ADVERSARIO e ~92 no proprio gol.
import { penalidadeImprovisacao, posicaoPelaCoordenada } from "../lib/formations"

let falhas = 0
const check = (ok: boolean, msg: string) => { if (!ok) { falhas++; console.log(`  FALHA: ${msg}`) } }

console.log("== Posicao pela coordenada ==")

// 1) O proprio gol e do goleiro — e so no miolo.
check(posicaoPelaCoordenada(50, 92) === "GOL", `meta central deveria ser GOL, veio ${posicaoPelaCoordenada(50, 92)}`)
check(posicaoPelaCoordenada(8, 92) !== "GOL", "lateral colado na linha de fundo NAO e goleiro")

// 2) As faixas do campo, da defesa ao ataque.
check(posicaoPelaCoordenada(50, 75) === "ZAG", `zaga central, veio ${posicaoPelaCoordenada(50, 75)}`)
check(posicaoPelaCoordenada(10, 75) === "LE", `lateral esquerdo, veio ${posicaoPelaCoordenada(10, 75)}`)
check(posicaoPelaCoordenada(90, 75) === "LD", `lateral direito, veio ${posicaoPelaCoordenada(90, 75)}`)
check(posicaoPelaCoordenada(50, 58) === "VOL", `volante, veio ${posicaoPelaCoordenada(50, 58)}`)
check(posicaoPelaCoordenada(50, 42) === "MEI", `meia, veio ${posicaoPelaCoordenada(50, 42)}`)
check(posicaoPelaCoordenada(50, 12) === "ATA", `centroavante, veio ${posicaoPelaCoordenada(50, 12)}`)
check(posicaoPelaCoordenada(10, 12) === "PE", `ponta esquerda, veio ${posicaoPelaCoordenada(10, 12)}`)
check(posicaoPelaCoordenada(90, 12) === "PD", `ponta direita, veio ${posicaoPelaCoordenada(90, 12)}`)

// 3) O CASO DO RELATO: goleiro arrastado para a zaga tem de DESABAR.
const goleiroNaZaga = penalidadeImprovisacao("GOL", posicaoPelaCoordenada(50, 75))
check(goleiroNaZaga < 0.6, `goleiro na zaga deveria cair muito, fator veio ${goleiroNaZaga}`)
check(Math.round(78 * goleiroNaZaga) < 50, `um goleiro 78 na zaga tem de virar menos de 50, virou ${Math.round(78 * goleiroNaZaga)}`)

// 4) Atacante virando meia perde, mas bem menos que o goleiro na zaga.
const atacanteNoMeio = penalidadeImprovisacao("ATA", posicaoPelaCoordenada(50, 42))
check(atacanteNoMeio < 1, "atacante no meio tem de perder alguma coisa")
check(atacanteNoMeio > goleiroNaZaga, "e tem de perder MENOS que o goleiro na zaga")

// 5) Quem esta na propria posicao nao perde nada — a penalidade nao pode cobrar
//    de uma escalacao correta.
check(penalidadeImprovisacao("ZAG", posicaoPelaCoordenada(50, 75)) === 1, "zagueiro na zaga nao perde nada")
check(penalidadeImprovisacao("ATA", posicaoPelaCoordenada(50, 12)) === 1, "centroavante no ataque nao perde nada")
check(penalidadeImprovisacao("GOL", posicaoPelaCoordenada(50, 92)) === 1, "goleiro no gol nao perde nada")

// 6) Trocar de LADO custa pouco; trocar de FUNCAO custa caro. E a distincao que
//    o futebol faz, e ela precisa sobreviver.
const ladoTrocado = penalidadeImprovisacao("LD", posicaoPelaCoordenada(10, 75))  // LD jogando de LE
const funcaoTrocada = penalidadeImprovisacao("ATA", posicaoPelaCoordenada(50, 75)) // ATA na zaga
check(ladoTrocado > 0.9, `so trocar de lado deveria custar pouco, veio ${ladoTrocado}`)
check(funcaoTrocada < ladoTrocado, "atacante na zaga tem de custar mais que trocar de lado")

// 7) Coordenada fora da faixa nao pode quebrar nem inventar posicao.
for (const [x, y] of [[-20, 200], [999, -50], [0, 0], [100, 100]]) {
  const p = posicaoPelaCoordenada(x, y)
  check(typeof p === "string" && p.length > 0, `coordenada (${x},${y}) devolveu "${p}"`)
}

console.log(falhas === 0 ? "\nOK — a posicao sai de onde o atleta ESTA, e improvisar custa" : `\n${falhas} FALHA(S)`)
process.exit(falhas === 0 ? 0 : 1)
