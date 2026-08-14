// BUSCA GLOBAL — o que estes testes protegem.
//
// Busca é um daqueles recursos em que "funciona" e "serve" são coisas
// diferentes: ela sempre devolve ALGUMA coisa, então o defeito não aparece como
// erro, aparece como o resultado certo em quarto lugar. Por isso o que se testa
// aqui é ORDEM, não presença.
//
//   npx tsx scripts/test-busca-global.ts

import { agrupar, buscar, normalizar, type ItemBuscavel } from "../lib/busca-global"

let falhas = 0
function check(nome: string, cond: boolean, detalhe = "") {
  if (!cond) falhas++
  console.log(`${cond ? "  ok  " : " FALHA"} ${nome}${cond ? "" : ` — ${detalhe}`}`)
}

const catalogo: ItemBuscavel[] = [
  { tipo: "tela", titulo: "Elenco", href: "/elenco", detalhe: "Elenco" },
  { tipo: "tela", titulo: "Mercado", href: "/mercado", detalhe: "Elenco" },
  { tipo: "tela", titulo: "Treinamento", href: "/treinamento", detalhe: "Elenco" },
  { tipo: "clube", titulo: "Santos", href: "/adversarios?clube=santos", detalhe: "Brasil", sinonimos: ["SAN"] },
  { tipo: "clube", titulo: "Santos Laguna", href: "/adversarios?clube=santoslaguna", detalhe: "Mexico" },
  { tipo: "clube", titulo: "Flamengo", href: "/adversarios?clube=flarj", detalhe: "Brasil", sinonimos: ["FLA"] },
  { tipo: "clube", titulo: "Ferroviária Flamengo", href: "/adversarios?clube=ferrofla", detalhe: "Brasil" },
  { tipo: "clube", titulo: "Real Madrid", href: "/adversarios?clube=realmadrid", detalhe: "Espanha", sinonimos: ["RMA"] },
  { tipo: "clube", titulo: "Paris Saint-Germain", href: "/adversarios?clube=psg_fra", detalhe: "Franca" },
  { tipo: "clube", titulo: "Grêmio", href: "/adversarios?clube=gremio", detalhe: "Brasil" },
  { tipo: "atleta", titulo: "Neymar", href: "/elenco?atleta=neymar", detalhe: "Santos" },
  { tipo: "competicao", titulo: "Copa Libertadores", href: "/competicoes?c=libertadores", detalhe: "Continental" },
]

console.log("\nOrdem: o resultado certo vem PRIMEIRO\n")

const santos = buscar(catalogo, "santos")
check("nome exato vence o nome que so contem",
  santos[0]?.titulo === "Santos", `veio "${santos[0]?.titulo}"`)

const fla = buscar(catalogo, "fla")
check("comeca-com vence contem",
  fla[0]?.titulo === "Flamengo", `veio "${fla[0]?.titulo}"`)

const madrid = buscar(catalogo, "madrid")
check("casa palavra do meio do nome",
  madrid.some(r => r.titulo === "Real Madrid"), JSON.stringify(madrid.map(r => r.titulo)))

check("iniciais acham o clube (psg)",
  buscar(catalogo, "psg")[0]?.titulo === "Paris Saint-Germain",
  `${buscar(catalogo, "psg")[0]?.titulo}`)

check("sigla cadastrada tambem acha",
  buscar(catalogo, "rma")[0]?.titulo === "Real Madrid",
  `${buscar(catalogo, "rma")[0]?.titulo}`)

console.log("\nAcento: quem busca rapido nao digita acento\n")

check("gremio acha Grêmio", buscar(catalogo, "gremio")[0]?.titulo === "Grêmio")
check("Grêmio acha Grêmio", buscar(catalogo, "Grêmio")[0]?.titulo === "Grêmio")
check("normalizar tira acento e caixa", normalizar("Atlético-MG") === "atletico mg",
  normalizar("Atlético-MG"))

console.log("\nTelas continuam alcancaveis pelo mesmo campo\n")

check("busca por tela devolve a tela", buscar(catalogo, "merc")[0]?.tipo === "tela")
check("empate de peso poe TELA na frente do resto",
  buscar(catalogo, "treinamento")[0]?.tipo === "tela")

console.log("\nTravas\n")

check("termo de 1 letra nao devolve nada (senao desenha o pool inteiro)",
  buscar(catalogo, "a").length === 0)
check("termo vazio nao devolve nada", buscar(catalogo, "").length === 0)
check("respeita o limite", buscar(catalogo, "a".repeat(0) || "s", 2).length <= 2)
check("termo sem casamento devolve vazio", buscar(catalogo, "zzzzzz").length === 0)

// ⚠️ O limite e a diferenca entre uma busca e uma tela travada: o catalogo real
// tem dezenas de milhares de atletas.
const enorme: ItemBuscavel[] = Array.from({ length: 40000 }, (_, i) => ({
  tipo: "atleta" as const, titulo: `Atleta Silva ${i}`, href: `/elenco?atleta=${i}`,
}))
const t0 = Date.now()
const muitos = buscar(enorme, "silva", 24)
const ms = Date.now() - t0
check("40 mil itens devolvem no maximo 24", muitos.length === 24, `${muitos.length}`)
// ⚠️ TETO FOLGADO DE PROPÓSITO. Este teste ja falhou rodando EM LOTE com as
// outras suites e passou sozinho, no mesmo codigo: 250 ms e um orcamento de
// interface, nao um limite de maquina ocupada. O que se quer provar aqui e que a
// busca nao faz nada patologico com 40 mil itens — varrer duas vezes, montar
// regex por item, ordenar o catalogo inteiro. Um teste que depende de a CPU
// estar livre e pior do que teste nenhum: ensina a reexecutar ate dar verde.
check("40 mil itens nao viram varredura patologica (<2s)", ms < 2000, `${ms}ms`)

console.log("\nAgrupamento\n")

const grupos = agrupar(buscar(catalogo, "s"))
check("agrupa sem perder resultado",
  grupos.reduce((s, g) => s + g.itens.length, 0) === buscar(catalogo, "s").length)
check("cada tipo aparece uma vez so",
  new Set(grupos.map(g => g.tipo)).size === grupos.length)

console.log(falhas === 0 ? "\nTODOS OS TESTES PASSARAM\n" : `\n${falhas} FALHA(S)\n`)
process.exit(falhas === 0 ? 0 : 1)
