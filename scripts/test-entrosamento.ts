// Entrosamento (squadCohesion) e o valor que amistoso e treino na data FIFA
// alimentam. Testa: metodo do engine respeita piso/teto e o bonus em campo bate
// com a conta do ao-vivo.
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

// 2) Amistoso (+4) e treino data FIFA (+5) sobem de verdade.
useGameEngine.setState({ squadCohesion: 60 })
eng.adjustSquadCohesion(4)  // amistoso
check(useGameEngine.getState().squadCohesion === 64, "amistoso deve dar +4")
eng.adjustSquadCohesion(5)  // treino data FIFA
check(useGameEngine.getState().squadCohesion === 69, "treino data FIFA deve dar +5")

// 3) O bonus em campo cresce com o entrosamento (60=+0, 100=+5).
check(bonus(60) === 0, "coesao 60 = +0")
check(bonus(100) === 5, "coesao 100 = +5")
check(bonus(84) === 3, "coesao 84 = +3")

// 4) Meses de janela FIFA sao os 5 reais (Mar/Jun/Set/Out/Nov).
const janelas = [0,1,2,3,4,5,6,7,8,9,10,11].filter(isFifaWindowMonth)
check(JSON.stringify(janelas) === JSON.stringify([2,5,8,9,10]), `janelas FIFA: ${janelas.join(",")}`)

console.log(falhas === 0 ? "\nOK — amistoso e treino na data FIFA alimentam o entrosamento" : `\n${falhas} FALHA(S)`)
process.exit(falhas === 0 ? 0 : 1)
