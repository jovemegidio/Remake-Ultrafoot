// TREINO DIÁRIO E CARGA INDIVIDUAL (1.0.295).
//
// O que estes testes protegem, em ordem de gravidade:
//   1. RETROCOMPATIBILIDADE. Save antigo não tem `semana`, e ali tudo tem de
//      continuar idêntico. Uma mudança silenciosa aqui não dá erro: dá elenco
//      moído ou elenco que nunca evolui, semanas depois.
//   2. A semana diária tem de significar alguma coisa — três descansos precisam
//      pesar menos que cinco sessões físicas, senão o controle é enfeite.
//   3. A carga individual tem os DOIS lados: poupar cansa menos E ensina menos.
//
//   npx tsx scripts/test-treino-diario.ts

import {
  cargaDoPlano,
  diasDeDescanso,
  aplicarSemanaDeTreino,
  PLANO_PADRAO,
  SEMANA_PADRAO,
  type AtletaNaSemana,
  type PlanoDeTreino,
  type SessaoDoDia,
} from "../lib/treino-e-entrosamento"

let falhas = 0
function check(nome: string, cond: boolean, detalhe = "") {
  if (!cond) falhas++
  console.log(`${cond ? "  ok  " : " FALHA"} ${nome}${cond ? "" : ` — ${detalhe}`}`)
}

const atleta = (extra: Partial<AtletaNaSemana> = {}): AtletaNaSemana => ({
  id: 1, idade: 26, energia: 80, fadigaCronica: 20, minutosJogados: 90,
  resistencia: 70, lesionado: false, emTreinoIndividual: false, ...extra,
})

const semana = (dias: SessaoDoDia[]): PlanoDeTreino => ({ ...PLANO_PADRAO, semana: dias })
const seteIguais = (d: SessaoDoDia) => semana(Array(7).fill(d))

console.log("\nRetrocompatibilidade: sem `semana`, nada muda\n")

check("plano agregado medio mantem a carga de antes",
  cargaDoPlano({ intensidade: "media", foco: "entrosamento" }) === 53,
  `${cargaDoPlano({ intensidade: "media", foco: "entrosamento" })}`)
check("plano agregado fisico continua mais pesado",
  cargaDoPlano({ intensidade: "alta", foco: "fisico" }) >
  cargaDoPlano({ intensidade: "alta", foco: "entrosamento" }))
check("plano agregado de recuperacao continua o mais leve",
  cargaDoPlano({ intensidade: "leve", foco: "recuperacao" }) <
  cargaDoPlano({ intensidade: "leve", foco: "entrosamento" }))

console.log("\nA semana diaria significa alguma coisa\n")

check("sete descansos = carga zero", cargaDoPlano(seteIguais("descanso")) === 0,
  `${cargaDoPlano(seteIguais("descanso"))}`)
check("sete sessoes fisicas e a semana mais pesada",
  cargaDoPlano(seteIguais("fisico")) > cargaDoPlano(seteIguais("tatico")),
  `${cargaDoPlano(seteIguais("fisico"))} x ${cargaDoPlano(seteIguais("tatico"))}`)
check("descansar no meio alivia a semana",
  cargaDoPlano(semana(["descanso", "fisico", "descanso", "fisico", "descanso", "fisico", "descanso"])) <
  cargaDoPlano(seteIguais("fisico")))
check("a semana padrao fica numa carga de trabalho, nao de ferias",
  cargaDoPlano(semana(SEMANA_PADRAO)) > 20 && cargaDoPlano(semana(SEMANA_PADRAO)) < 70,
  `${cargaDoPlano(semana(SEMANA_PADRAO))}`)
check("intensidade alta puxa a MESMA semana para cima",
  cargaDoPlano({ ...semana(SEMANA_PADRAO), intensidade: "alta" }) >
  cargaDoPlano({ ...semana(SEMANA_PADRAO), intensidade: "leve" }))
check("conta os dias de descanso", diasDeDescanso(semana(SEMANA_PADRAO)) === 2,
  `${diasDeDescanso(semana(SEMANA_PADRAO))}`)

console.log("\nCarga individual tem os dois lados\n")

const plano = semana(SEMANA_PADRAO)
const time = [
  atleta({ id: 1, cargaIndividual: "poupado" }),
  atleta({ id: 2, cargaIndividual: "normal" }),
  atleta({ id: 3, cargaIndividual: "reforcado" }),
]
const r = aplicarSemanaDeTreino(time, plano, { centroDeTreinamento: 2, centroMedico: 2 })
const porId = new Map(r.efeitos.map(e => [e.id, e]))
const poupado = porId.get(1)!
const normal = porId.get(2)!
const reforcado = porId.get(3)!

check("poupado termina com mais energia que o normal",
  poupado.energia > normal.energia, `${poupado.energia} x ${normal.energia}`)
check("reforcado termina com menos energia que o normal",
  reforcado.energia < normal.energia, `${reforcado.energia} x ${normal.energia}`)
check("poupado APRENDE menos — poupar nao pode ser de graca",
  poupado.rendimentoIndividual < normal.rendimentoIndividual,
  `${poupado.rendimentoIndividual} x ${normal.rendimentoIndividual}`)
check("reforcado aprende mais",
  reforcado.rendimentoIndividual > normal.rendimentoIndividual,
  `${reforcado.rendimentoIndividual} x ${normal.rendimentoIndividual}`)
check("reforcado corre mais risco de lesao",
  reforcado.risco >= normal.risco, `${reforcado.risco} x ${normal.risco}`)

console.log("\nSessoes casam com o treino individual do atleta\n")

const comFisico = aplicarSemanaDeTreino(
  [atleta({ emTreinoIndividual: true, focoIndividual: "physical" })],
  semana(["fisico", "fisico", "fisico", "descanso", "tatico", "tecnico", "descanso"]),
  { centroDeTreinamento: 2, centroMedico: 2 },
)
const semFisico = aplicarSemanaDeTreino(
  [atleta({ emTreinoIndividual: true, focoIndividual: "physical" })],
  semana(["tatico", "tatico", "tatico", "descanso", "tatico", "tecnico", "descanso"]),
  { centroDeTreinamento: 2, centroMedico: 2 },
)
check("quem treina fisico rende mais numa semana com sessoes fisicas",
  comFisico.efeitos[0].rendimentoIndividual > semFisico.efeitos[0].rendimentoIndividual,
  `${comFisico.efeitos[0].rendimentoIndividual} x ${semFisico.efeitos[0].rendimentoIndividual}`)

console.log("\nDescanso repoe de verdade\n")

const descansado = aplicarSemanaDeTreino([atleta({ energia: 50, minutosJogados: 0 })],
  seteIguais("descanso"), { centroDeTreinamento: 2, centroMedico: 2 })
check("semana inteira de folga sem jogo recupera energia",
  descansado.efeitos[0].energia > 50, `${descansado.efeitos[0].energia}`)

const moido = aplicarSemanaDeTreino([atleta({ energia: 50, minutosJogados: 180 })],
  seteIguais("fisico"), { centroDeTreinamento: 2, centroMedico: 2 })
check("semana pesada com dois jogos derruba a energia",
  moido.efeitos[0].energia < 50, `${moido.efeitos[0].energia}`)

console.log(falhas === 0 ? "\nTODOS OS TESTES PASSARAM\n" : `\n${falhas} FALHA(S)\n`)
process.exit(falhas === 0 ? 0 : 1)
