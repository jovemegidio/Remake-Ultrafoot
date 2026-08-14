// O PASSADO DO ATLETA PRECISA PESAR NO PRESENTE.
//
// Antes disto, o sorteio semanal de lesão olhava só o profissionalismo: o
// zagueiro que passou a temporada inteiro e o que voltou de três lesões na mesma
// coxa corriam exatamente o mesmo risco. Lesão era sorteio sem memória, e poupar
// um recém-recuperado não tinha efeito nenhum — ou seja, o rodízio era enfeite.
//
// ⚠️ O que este teste protege não é a fórmula (ela pode e deve ser recalibrada).
// É a ORDEM: quem tem passado corre mais risco que quem não tem, quem repete o
// mesmo tipo corre mais que quem variou, e quem acabou de voltar corre mais que
// quem voltou há muito. Se um dia essas ordens se inverterem, o sistema volta a
// ser decorativo sem dar erro nenhum.
//
//   npx tsx scripts/test-historico-de-lesoes.ts

import {
  acabouDeVoltar, registrarLesao, riscoPorHistorico, rotuloDoHistorico,
  SEMANAS_DE_FRAGILIDADE, type LesaoRegistrada,
} from "../lib/historico-de-lesoes"

let falhas = 0
function check(nome: string, cond: boolean, detalhe = "") {
  if (!cond) falhas++
  console.log(`${cond ? "  ok  " : " FALHA"} ${nome}${cond ? "" : ` — ${detalhe}`}`)
}

const lesao = (
  tipo: string, severidade: LesaoRegistrada["severidade"], semana: number, duracao = 3,
): LesaoRegistrada => ({ tipo, severidade, semana, duracao })

console.log("\nQuem nunca se machucou nao muda de risco\n")

check("sem historico o multiplicador e exatamente 1", riscoPorHistorico(undefined, 40) === 1)
check("historico vazio tambem", riscoPorHistorico([], 40) === 1)
check("e nao ha rotulo para mostrar", rotuloDoHistorico([], 40) === null)

console.log("\nPassado pesa — e a gravidade importa\n")

const umaLeve = [lesao("Muscular", "leve", 10)]
const umaGrave = [lesao("Muscular", "grave", 10)]
check("uma lesao leve ja aumenta o risco", riscoPorHistorico(umaLeve, 40) > 1)
check("uma grave pesa mais que uma leve",
  riscoPorHistorico(umaGrave, 40) > riscoPorHistorico(umaLeve, 40),
  `${riscoPorHistorico(umaGrave, 40)} vs ${riscoPorHistorico(umaLeve, 40)}`)

console.log("\n⚠️ RECORRENCIA: repetir o MESMO tipo pesa mais que variar\n")

// Este é o ponto do sistema: três problemas musculares é uma fraqueza; uma
// torção, uma pancada e uma virose é azar.
const mesmoTipo = [lesao("Muscular", "media", 10), lesao("Muscular", "media", 20), lesao("Muscular", "media", 30)]
const tiposVariados = [lesao("Muscular", "media", 10), lesao("Torcao", "media", 20), lesao("Pancada", "media", 30)]
check("tres do mesmo tipo > tres tipos diferentes",
  riscoPorHistorico(mesmoTipo, 60) > riscoPorHistorico(tiposVariados, 60),
  `${riscoPorHistorico(mesmoTipo, 60).toFixed(2)} vs ${riscoPorHistorico(tiposVariados, 60).toFixed(2)}`)
check("e as duas passam de 1", riscoPorHistorico(tiposVariados, 60) > 1)

console.log("\nJanela de fragilidade: acabou de voltar, ainda nao esta inteiro\n")

// Lesao na semana 20, durou 3 -> voltou na 23.
const recente = [lesao("Muscular", "media", 20, 3)]
const naVolta = riscoPorHistorico(recente, 23)
const umaSemanaDepois = riscoPorHistorico(recente, 24)
const passadaAJanela = riscoPorHistorico(recente, 23 + SEMANAS_DE_FRAGILIDADE)
check("no primeiro jogo de volta o risco e o maior", naVolta > umaSemanaDepois,
  `${naVolta.toFixed(2)} vs ${umaSemanaDepois.toFixed(2)}`)
check("e decai ate a janela fechar", umaSemanaDepois > passadaAJanela)
check("acabouDeVoltar concorda com a conta", acabouDeVoltar(recente, 23) && !acabouDeVoltar(recente, 23 + SEMANAS_DE_FRAGILIDADE))
check("o rotulo avisa o tecnico", rotuloDoHistorico(recente, 23) === "Recém-recuperado")

console.log("\nLesao velha nao assombra para sempre\n")

const antiga = [lesao("Muscular", "grave", 5, 8)]
check("fora da janela de 52 semanas o peso some",
  riscoPorHistorico(antiga, 500) === 1,
  `${riscoPorHistorico(antiga, 500)}`)

console.log("\nO risco tem TETO — ninguem vira de vidro\n")

const arrasado = Array.from({ length: 12 }, (_, i) => lesao("Muscular", "grave", i * 2, 4))
check("mesmo com 12 lesoes graves o multiplicador para em 2,6",
  riscoPorHistorico(arrasado, 30) <= 2.6,
  `${riscoPorHistorico(arrasado, 30)}`)

console.log("\nO historico nao cresce sem fim\n")

let h: LesaoRegistrada[] = []
for (let i = 0; i < 30; i++) h = registrarLesao(h, lesao("Muscular", "leve", i))
check("guarda no maximo 12 registros", h.length === 12, `${h.length}`)
check("e mantem os MAIS RECENTES", h.at(-1)?.semana === 29 && h[0].semana === 18,
  `${h[0].semana}..${h.at(-1)?.semana}`)

console.log("\nOrdem final: sadio < ja se machucou < recorrente < recem-voltado grave\n")

const sadio = riscoPorHistorico([], 60)
const jaSeMachucou = riscoPorHistorico([lesao("Torcao", "leve", 20, 2)], 60)
const recorrente = riscoPorHistorico(mesmoTipo, 60)
const recemVoltadoGrave = riscoPorHistorico([lesao("Muscular", "grave", 50, 8)], 58)
check("a escada esta na ordem certa",
  sadio < jaSeMachucou && jaSeMachucou < recorrente && recorrente < recemVoltadoGrave,
  `${sadio.toFixed(2)} < ${jaSeMachucou.toFixed(2)} < ${recorrente.toFixed(2)} < ${recemVoltadoGrave.toFixed(2)}`)

console.log(falhas === 0 ? "\nTODOS OS TESTES PASSARAM\n" : `\n${falhas} FALHA(S)\n`)
process.exit(falhas === 0 ? 0 : 1)
