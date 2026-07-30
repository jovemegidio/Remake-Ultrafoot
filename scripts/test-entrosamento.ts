// Entrosamento no MOTOR: piso/teto do ajuste direto e o bonus em campo.
//
// ATENCAO ao escopo: desde a 1.0.223 o entrosamento NAO sobe mais por botao. Ele
// e derivado de MINUTOS JOGADOS JUNTOS, dupla a dupla — partida, amistoso e
// treino coletivo passam por `registrarMinutosJuntos`. O modelo em si e testado
// em scripts/test-treino-entrosamento.ts, que e o teste que vale.
//
// O que sobra aqui: `adjustSquadCohesion` continua existindo para eventos
// avulsos e saves antigos, e precisa respeitar piso e teto — alem da conta do
// bonus em campo, que o ao-vivo repete.
import { useGameEngine } from "../lib/game-engine"
import { isFifaWindowMonth } from "../lib/national-windows"

let falhas = 0
const check = (ok: boolean, msg: string) => { if (!ok) { falhas++; console.log(`  FALHA: ${msg}`) } }

const eng = useGameEngine.getState()

// Conta do bonus em campo (mesma do ao-vivo): (coesao-60)/8, piso 0.
const bonus = (c: number) => Math.round(Math.max(0, c - 60) / 8)

console.log("== Entrosamento ==")

// 1) adjustSquadCohesion respeita teto 100 e piso 0.
useGameEngine.setState({ squadCohesion: 98 })
eng.adjustSquadCohesion(10)
check(useGameEngine.getState().squadCohesion === 100, `teto 100, veio ${useGameEngine.getState().squadCohesion}`)
useGameEngine.setState({ squadCohesion: 3 })
eng.adjustSquadCohesion(-10)
check(useGameEngine.getState().squadCohesion === 0, `piso 0, veio ${useGameEngine.getState().squadCohesion}`)

// 2) O ajuste direto soma o que foi pedido, sem surpresa.
useGameEngine.setState({ squadCohesion: 60 })
eng.adjustSquadCohesion(4)
check(useGameEngine.getState().squadCohesion === 64, "ajuste direto deve somar +4")

// 3) O CAMINHO DE VERDADE: minutos juntos. Um onze que nunca jogou junto sobe ao
//    acumular partidas — e o numero sai da tabela de duplas, nao de um contador.
useGameEngine.setState({ entrosamentoPares: {}, squadCohesion: 60 })
const onzeDeTeste = Array.from({ length: 11 }, (_, i) => i + 1)
useGameEngine.getState().registrarMinutosJuntos(90, onzeDeTeste)
const apos1Jogo = useGameEngine.getState().squadCohesion
for (let i = 0; i < 9; i++) useGameEngine.getState().registrarMinutosJuntos(90, onzeDeTeste)
const apos10Jogos = useGameEngine.getState().squadCohesion
check(apos10Jogos > apos1Jogo, `jogar junto tem de subir o entrosamento (${apos1Jogo} -> ${apos10Jogos})`)
check(apos10Jogos === 100, `dez jogos do mesmo onze deveriam chegar a 100, chegaram a ${apos10Jogos}`)

// 4) O bonus em campo cresce com o entrosamento (60=+0, 100=+5).
check(bonus(60) === 0, "coesao 60 = +0")
check(bonus(100) === 5, "coesao 100 = +5")
check(bonus(84) === 3, "coesao 84 = +3")

// 5) Meses de janela FIFA sao os 5 reais (Mar/Jun/Set/Out/Nov).
const janelas = [0,1,2,3,4,5,6,7,8,9,10,11].filter(isFifaWindowMonth)
check(JSON.stringify(janelas) === JSON.stringify([2,5,8,9,10]), `janelas FIFA: ${janelas.join(",")}`)

console.log(falhas === 0 ? "\nOK — piso/teto, minutos juntos e o bonus em campo" : `\n${falhas} FALHA(S)`)
process.exit(falhas === 0 ? 0 : 1)
