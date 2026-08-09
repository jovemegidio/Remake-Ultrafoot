/**
 * FORCAS TATICAS — o que este teste protege.
 *
 * Doze controles da tela de Taticas nao faziam nada; ao liga-los, aparecem dois
 * riscos, e sao eles que este arquivo trava:
 *
 *   1. EMPILHAR — o jogador liga tudo e monta um time impossivel (o irmao
 *      tatico do glitch de dinheiro infinito da bilheteria).
 *   2. CONTAR DUAS VEZES — `mentality` e `offsideTrap` ja chegam ao motor por
 *      caminho proprio; se aparecerem aqui tambem, valem em dobro.
 */
import { forcasDaTatica, resumoDoPlano, TETO_TATICO } from "../lib/forcas-taticas"
import type { TeamTactics } from "../lib/game-engine"

let passou = 0
let falhou = 0
function ok(nome: string, cond: boolean, detalhe = "") {
  if (cond) { passou++; console.log(`  ok   ${nome}`) }
  else { falhou++; console.log(`  FALHA ${nome} ${detalhe}`) }
}

/** Tatica neutra: todo campo no valor do meio, toda chave desligada. */
const NEUTRA: TeamTactics = {
  mentality: "equilibrado",
  playingStyle: "jogo_posicional",
  passingStyle: "misto",
  tempo: "normal",
  buildUp: "misto",
  chanceCreation: "misto",
  crossingStyle: "misto",
  shootFromDistance: false,
  playThroughBalls: false,
  defensiveLine: "media",
  pressingIntensity: "media",
  markingStyle: "misto",
  offsideTrap: false,
  counterPress: false,
  counterAttack: false,
  holdPosition: false,
  cornersAggressive: false,
  freekickSpecialist: null,
  penaltyTaker: null,
} as TeamTactics

const com = (p: Partial<TeamTactics>): TeamTactics => ({ ...NEUTRA, ...p })
const soma = (t: TeamTactics) => {
  const f = forcasDaTatica(t)
  return f.attack + f.defense + f.midfield
}

console.log("\nFORCAS TATICAS\n")

// 1. A neutra so carrega o estilo de jogo (jogo_posicional: +1 atk, +2 mid).
{
  const f = forcasDaTatica(NEUTRA)
  ok("neutra = so o estilo (1/0/2)", f.attack === 1 && f.defense === 0 && f.midfield === 2,
    `deu ${f.attack}/${f.defense}/${f.midfield}`)
  ok("neutra nao tem conflito", f.conflitos.length === 0)
}

// 2. NAO EMPILHAR: nem o plano mais ganancioso passa do teto.
{
  const gananciosa = com({
    playingStyle: "posse_bola", passingStyle: "direto", tempo: "rapido",
    buildUp: "curto", chanceCreation: "largura", crossingStyle: "alto",
    defensiveLine: "alta", pressingIntensity: "muito_alta", markingStyle: "individual",
    shootFromDistance: true, playThroughBalls: true, counterPress: true,
    counterAttack: true, holdPosition: true,
  })
  const f = forcasDaTatica(gananciosa)
  ok("tudo ligado respeita o teto no ataque", Math.abs(f.attack) <= TETO_TATICO, `${f.attack}`)
  ok("tudo ligado respeita o teto na defesa", Math.abs(f.defense) <= TETO_TATICO, `${f.defense}`)
  ok("tudo ligado respeita o teto no meio", Math.abs(f.midfield) <= TETO_TATICO, `${f.midfield}`)
  ok("tudo ligado NAO e o melhor plano", soma(gananciosa) <= soma(NEUTRA) + 4,
    `ganancioso ${soma(gananciosa)} x neutro ${soma(NEUTRA)}`)
}

// 3. Forca bruta: nenhuma combinacao de chaves vira bonus livre.
{
  const chaves = ["shootFromDistance", "playThroughBalls", "counterPress", "counterAttack", "holdPosition"] as const
  let pior = Infinity
  let melhor = -Infinity
  for (let mask = 0; mask < 32; mask++) {
    const p: Partial<TeamTactics> = {}
    chaves.forEach((c, i) => { (p as Record<string, boolean>)[c] = Boolean(mask & (1 << i)) })
    const s = soma(com(p))
    pior = Math.min(pior, s)
    melhor = Math.max(melhor, s)
  }
  ok("32 combinacoes de chaves: nenhuma supera a neutra", melhor <= soma(NEUTRA),
    `melhor ${melhor} x neutra ${soma(NEUTRA)}`)
  ok("as chaves sao troca, nao bonus (variacao <= 0)", melhor - soma(NEUTRA) <= 0)
}

// 4. Cada um dos 12 controles MUDA alguma coisa (senao continua enfeite).
{
  const mexe = (p: Partial<TeamTactics>) => {
    const a = forcasDaTatica(NEUTRA)
    const b = forcasDaTatica(com(p))
    return a.attack !== b.attack || a.defense !== b.defense || a.midfield !== b.midfield
  }
  ok("passingStyle importa", mexe({ passingStyle: "direto" }))
  ok("tempo importa", mexe({ tempo: "rapido" }))
  ok("buildUp importa", mexe({ buildUp: "longo" }))
  ok("chanceCreation importa", mexe({ chanceCreation: "largura" }))
  ok("crossingStyle importa", mexe({ crossingStyle: "alto" }))
  ok("defensiveLine importa", mexe({ defensiveLine: "baixa" }))
  ok("pressingIntensity importa", mexe({ pressingIntensity: "muito_alta" }))
  ok("markingStyle importa", mexe({ markingStyle: "individual" }))
  ok("shootFromDistance importa", mexe({ shootFromDistance: true }))
  ok("playThroughBalls importa", mexe({ playThroughBalls: true }))
  ok("counterPress importa", mexe({ counterPress: true }))
  ok("counterAttack importa", mexe({ counterAttack: true }))
  ok("holdPosition importa", mexe({ holdPosition: true }))
}

// 5. NAO CONTAR DUAS VEZES: mentalidade e impedimento nao entram aqui.
{
  const a = forcasDaTatica(NEUTRA)
  const b = forcasDaTatica(com({ mentality: "muito_ofensivo" }))
  const c = forcasDaTatica(com({ offsideTrap: true }))
  ok("mentality NAO afeta (ja vai ao motor)", a.attack === b.attack && a.defense === b.defense && a.midfield === b.midfield)
  ok("offsideTrap NAO afeta (o motor ja gera impedimento)", a.defense === c.defense && a.attack === c.attack)
}

// 6. Contradicao custa caro e e explicada.
{
  const confusa = com({ pressingIntensity: "muito_alta", defensiveLine: "baixa", buildUp: "longo", passingStyle: "curto" })
  const f = forcasDaTatica(confusa)
  ok("plano contraditorio lista os conflitos", f.conflitos.length >= 2, `${f.conflitos.length}`)
  ok("plano contraditorio tem coerencia negativa", f.coerencia < 0, `${f.coerencia}`)
  ok("resumo avisa da contradicao", resumoDoPlano(f) === "Plano com contradicoes")
}

// 7. Plano redondo rende mais que o mesmo plano quebrado.
{
  const redondo = com({ playingStyle: "contra_ataque", counterAttack: true, tempo: "rapido" })
  const quebrado = com({ playingStyle: "contra_ataque", counterAttack: true, tempo: "lento" })
  ok("sinergia da coerencia positiva", forcasDaTatica(redondo).coerencia > 0)
  ok("versao quebrada rende menos", soma(redondo) > soma(quebrado),
    `redondo ${soma(redondo)} x quebrado ${soma(quebrado)}`)
  ok("versao quebrada explica o porque", forcasDaTatica(quebrado).conflitos.length > 0)
}

// 8. Estilo de jogo herdado bate EXATAMENTE com o calculo antigo da tela ao vivo.
//    Se este teste cair, a calibracao do jogo mudou sem ninguem pedir.
{
  const esperado: Record<string, [number, number, number]> = {
    posse_bola: [1, 0, 5],
    contra_ataque: [4, 3, -2],
    pressao_alta: [3, -1, 3],
    jogo_direto: [2, 0, -1],
    jogo_posicional: [1, 0, 2],
  }
  for (const [estilo, [a, d, m]] of Object.entries(esperado)) {
    const f = forcasDaTatica(com({ playingStyle: estilo as TeamTactics["playingStyle"] }))
    ok(`estilo ${estilo} preserva a calibracao antiga`, f.attack === a && f.defense === d && f.midfield === m,
      `deu ${f.attack}/${f.defense}/${f.midfield}, esperado ${a}/${d}/${m}`)
  }
}

console.log(`\n${passou} ok, ${falhou} falha(s)\n`)
process.exit(falhou === 0 ? 0 : 1)
