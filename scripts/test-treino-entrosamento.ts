// TREINO REALISTA E ENTROSAMENTO — o modelo, sem React.
//
// O que este teste protege:
//   • entrosamento e MINUTOS JUNTOS, entao trocar o time derruba o numero
//     sozinho (era isso que o contador global nao fazia);
//   • carga alta cansa mais, machuca mais e ensina mais que carga leve — as tres
//     coisas ao mesmo tempo, senao a escolha de intensidade nao e escolha;
//   • semana regenerativa e remedio: repoe energia e queima fadiga cronica.
import {
  aplicarSemanaDeTreino, cargaDoPlano, chaveDoPar, decairEntrosamento, duplasDoGrupo,
  entrosamentoDoGrupo, minutosDeTreinoColetivo, MINUTOS_PAR_MADURO, PISO_ENTROSAMENTO,
  registrarMinutosJuntos, semearParesDeHistorico, type AtletaNaSemana, type PlanoDeTreino,
} from "../lib/treino-e-entrosamento"

let falhas = 0
const check = (ok: boolean, msg: string) => { if (!ok) { falhas++; console.log(`  FALHA: ${msg}`) } }

console.log("== Treino e entrosamento ==")

// ─── ENTROSAMENTO ───────────────────────────────────────────────────────────

const onze = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]

// 1) Elenco novo comeca no piso, nao em zero: sao profissionais.
check(entrosamentoDoGrupo({}, onze) === PISO_ENTROSAMENTO, `elenco novo deveria dar ${PISO_ENTROSAMENTO}`)

// 2) Jogando junto, sobe — e chega a 100 quando todas as duplas amadurecem.
let pares = {}
for (let jogo = 0; jogo < 10; jogo++) pares = registrarMinutosJuntos(pares, onze, 90)
check(entrosamentoDoGrupo(pares, onze) === 100, `10 jogos do mesmo onze deveriam dar 100, deu ${entrosamentoDoGrupo(pares, onze)}`)

// 3) A CONTA E POR DUPLA: trocar um titular derruba o entrosamento do onze, mesmo
//    com os outros dez intactos. Era exatamente isto que o contador global nao
//    conseguia representar — comprar meio elenco nao mexia no numero.
const comReforco = [...onze.slice(0, 10), 99]
const depoisDaTroca = entrosamentoDoGrupo(pares, comReforco)
check(depoisDaTroca < 100, "um reforco sozinho tem de baixar o entrosamento do onze")
check(depoisDaTroca > PISO_ENTROSAMENTO, "mas os dez que ja jogavam juntos continuam valendo")

// 4) Meia-vida: metade dos minutos = entrosamento no meio do caminho.
const meio = registrarMinutosJuntos({}, onze, MINUTOS_PAR_MADURO / 2)
const esperadoMeio = Math.round(PISO_ENTROSAMENTO + (100 - PISO_ENTROSAMENTO) * 0.5)
check(entrosamentoDoGrupo(meio, onze) === esperadoMeio, `meio caminho deveria dar ${esperadoMeio}`)

// 5) Chave do par e simetrica (senao a mesma dupla contaria duas vezes).
check(chaveDoPar(9, 3) === chaveDoPar(3, 9), "a dupla precisa ter a mesma chave nos dois sentidos")

// 6) Esquecimento: quem saiu do clube some da tabela; quem ficou perde devagar.
const aposDecair = decairEntrosamento(pares, onze.slice(0, 10), 0.9)
check(!(chaveDoPar(1, 11) in aposDecair), "dupla com atleta que saiu do clube tem de sumir")
check(aposDecair[chaveDoPar(1, 2)] < pares[chaveDoPar(1, 2) as keyof typeof pares], "a dupla que ficou perde minutos com o tempo")

// 7) Semeadura para saves antigos: quem ja tinha jogos nao perde o entrosamento
//    ao instalar a versao nova.
const semeado = semearParesDeHistorico(onze.map(id => ({ id, jogos: 20 })))
check(entrosamentoDoGrupo(semeado, onze) === 100, "save com 20 jogos deveria abrir entrosado, nao no piso")
check(Object.keys(semearParesDeHistorico([{ id: 1, jogos: 0 }, { id: 2, jogos: 5 }])).length === 0, "quem nunca jogou nao gera dupla")

// 8) A tela precisa das duplas ordenadas (as mais e as menos rodadas).
const duplas = duplasDoGrupo(pares, [{ id: 1, nome: "A" }, { id: 2, nome: "B" }, { id: 99, nome: "Novo" }])
check(duplas[0].pct === 100 && duplas[duplas.length - 1].pct === 0, "duplasDoGrupo deve ordenar do mais rodado ao menos")

// ─── TREINO: carga, fadiga, lesao ───────────────────────────────────────────

const elenco: AtletaNaSemana[] = Array.from({ length: 20 }, (_, i) => ({
  id: i + 1,
  idade: 20 + (i % 14),
  energia: 70,
  fadigaCronica: 20,
  minutosJogados: i < 11 ? 90 : 0,
  resistencia: 70,
  lesionado: false,
  emTreinoIndividual: false,
}))

const leve: PlanoDeTreino = { intensidade: "leve", foco: "entrosamento" }
const alta: PlanoDeTreino = { intensidade: "alta", foco: "fisico" }
const regen: PlanoDeTreino = { intensidade: "leve", foco: "recuperacao" }

const rLeve = aplicarSemanaDeTreino(elenco, leve)
const rAlta = aplicarSemanaDeTreino(elenco, alta)
const rRegen = aplicarSemanaDeTreino(elenco, regen)

// 9) Carga alta cansa mais, acumula mais fadiga e machuca mais.
check(rAlta.carga > rLeve.carga, "carga alta tem de ser maior que a leve")
check(rAlta.energiaMedia < rLeve.energiaMedia, "carga alta tem de gastar mais energia")
check(rAlta.fadigaMedia > rLeve.fadigaMedia, "carga alta tem de acumular mais fadiga")
check(rAlta.riscoMedio > rLeve.riscoMedio, "carga alta tem de machucar mais")

// 10) ...e ensina mais. Sem isto, ninguem escolheria "alta" nunca.
const rendAlta = rAlta.efeitos[0].rendimentoIndividual
const rendLeve = rLeve.efeitos[0].rendimentoIndividual
check(rendAlta > rendLeve, "carga alta tem de render mais no treino individual")

// 11) Semana regenerativa e remedio: devolve energia e queima fadiga.
check(rRegen.energiaMedia > rLeve.energiaMedia, "semana regenerativa tem de repor mais energia")
check(rRegen.fadigaMedia < rLeve.fadigaMedia, "semana regenerativa tem de queimar fadiga")

// 12) Elenco esgotado nao aprende — e corre muito mais risco.
const esgotado = elenco.map(a => ({ ...a, energia: 25, fadigaCronica: 85 }))
const rEsgotado = aplicarSemanaDeTreino(esgotado, alta)
check(rEsgotado.riscoMedio > rAlta.riscoMedio * 1.5, "treinar forte um elenco esgotado tem de disparar o risco")
check(rEsgotado.efeitos[0].rendimentoIndividual < rendAlta, "elenco esgotado tem de aprender menos")

// 13) Lesionado nao treina: recupera e nao corre risco nenhum.
const comLesao = aplicarSemanaDeTreino([{ ...elenco[0], lesionado: true, energia: 40 }], alta)
check(comLesao.efeitos[0].risco === 0, "lesionado nao pode correr risco de lesao de treino")
check(comLesao.efeitos[0].energia > 40, "lesionado tem de recuperar energia")

// 14) O Centro de Treinamento reduz a carga percebida e o risco.
const semEstrutura = aplicarSemanaDeTreino(elenco, alta, { centroDeTreinamento: 1 })
const comEstrutura = aplicarSemanaDeTreino(elenco, alta, { centroDeTreinamento: 5 })
check(comEstrutura.carga < semEstrutura.carga, "CT nivel 5 tem de baixar a carga percebida")
check(comEstrutura.riscoMedio < semEstrutura.riscoMedio, "CT nivel 5 tem de reduzir o risco de lesao")
check(cargaDoPlano(alta, 5) < cargaDoPlano(alta, 1), "cargaDoPlano tem de responder ao nivel do CT")

// 15) Treino individual ALINHADO ao foco coletivo rende mais.
const alinhado = aplicarSemanaDeTreino(
  [{ ...elenco[0], emTreinoIndividual: true, focoIndividual: "physical" }], alta,
)
const desalinhado = aplicarSemanaDeTreino(
  [{ ...elenco[0], emTreinoIndividual: true, focoIndividual: "shooting" }], alta,
)
check(
  alinhado.efeitos[0].rendimentoIndividual > desalinhado.efeitos[0].rendimentoIndividual,
  "treinar o mesmo atributo do foco coletivo tem de render mais",
)

// 16) Treino NAO substitui jogo: o coletivo vale bem menos que uma partida.
check(minutosDeTreinoColetivo({ intensidade: "alta", foco: "entrosamento" }) < 90, "treino coletivo nao pode valer uma partida inteira")
check(
  minutosDeTreinoColetivo({ intensidade: "alta", foco: "entrosamento" })
  > minutosDeTreinoColetivo({ intensidade: "alta", foco: "fisico" }),
  "foco em entrosamento tem de render mais minutos juntos que o foco fisico",
)

console.log(falhas === 0 ? "\nOK — carga x fadiga x lesao respondem, e entrosamento e minuto jogado junto" : `\n${falhas} FALHA(S)`)
process.exit(falhas === 0 ? 0 : 1)
