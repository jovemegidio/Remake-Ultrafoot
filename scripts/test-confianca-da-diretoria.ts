// A CONFIANÇA PRECISA DIZER COM O QUÊ.
//
// Antes, dois técnicos muito diferentes tinham a MESMA leitura: o que ganha
// tudo e quebra o clube, e o que equilibra as contas e não vence, ambos "72". O
// número media satisfação e não explicava nada — e por isso não orientava
// decisão nenhuma.
//
// ⚠️ O que este teste protege é a SEPARAÇÃO. Se um dia uma área passar a
// contaminar a outra (uma derrota derrubando "Finanças", um caixa negativo
// derrubando "Resultados"), o diagnóstico volta a ser um termômetro com nome
// diferente — sem dar erro nenhum.
//
//   npx tsx scripts/test-confianca-da-diretoria.ts

import {
  areaMaisFragil, confiancaPorArea, NOME_DA_AREA,
  type ContextoDaConfianca,
} from "../lib/confianca-da-diretoria"

let falhas = 0
function check(nome: string, cond: boolean, detalhe = "") {
  if (!cond) falhas++
  console.log(`${cond ? "  ok  " : " FALHA"} ${nome}${cond ? "" : ` — ${detalhe}`}`)
}

const base = (over: Partial<ContextoDaConfianca> = {}): ContextoDaConfianca => ({
  confiancaEsportiva: 70,
  bonusDeGovernanca: 0,
  saldo: 20_000_000,
  dividaTotal: 0,
  gastoDoOrcamento: 0.5,
  promovidosDaBase: 2,
  moralDoElenco: 70,
  ...over,
})

const nota = (ctx: ContextoDaConfianca, area: string) =>
  confiancaPorArea(ctx).find(a => a.area === area)!.nota

console.log("\nAs cinco areas existem e tem nome para a tela\n")

const areas = confiancaPorArea(base())
check("cinco areas", areas.length === 5, `${areas.length}`)
check("toda area tem nome legivel", areas.every(a => Boolean(NOME_DA_AREA[a.area])))
check("toda area tem leitura em uma linha", areas.every(a => a.leitura.length > 10))
check("toda nota fica entre 0 e 100", areas.every(a => a.nota >= 0 && a.nota <= 100))

console.log("\n⚠️ AS AREAS NAO SE CONTAMINAM\n")

// O caso que motivou o módulo: campeão que quebrou o clube.
const campeaoQuebrado = base({ confiancaEsportiva: 92, saldo: -5_000_000, bonusDeGovernanca: -20 })
check("ganhar em campo NAO conserta as financas",
  nota(campeaoQuebrado, "financas") < 40, `${nota(campeaoQuebrado, "financas")}`)
check("e a crise financeira NAO derruba os resultados",
  nota(campeaoQuebrado, "resultados") === 92, `${nota(campeaoQuebrado, "resultados")}`)

// O oposto: contas em dia, time perdendo.
const arrumadoPerdendo = base({ confiancaEsportiva: 25, saldo: 80_000_000, dividaTotal: 0 })
check("caixa cheio NAO salva os resultados", nota(arrumadoPerdendo, "resultados") === 25)
check("e perder NAO derruba as financas", nota(arrumadoPerdendo, "financas") >= 70)

console.log("\nOs dois casos que pareciam iguais agora se distinguem\n")

const a1 = confiancaPorArea(campeaoQuebrado)
const a2 = confiancaPorArea(arrumadoPerdendo)
check("as leituras de resultados diferem", a1[0].leitura !== a2[0].leitura)
check("as leituras de financas diferem", a1[1].leitura !== a2[1].leitura)

console.log("\nMercado: gastar nao e pecado, estourar e\n")

check("dentro do orcamento e bem visto", nota(base({ gastoDoOrcamento: 0.8 }), "mercado") >= 70)
check("no limite ainda passa", nota(base({ gastoDoOrcamento: 1.0 }), "mercado") >= 55)
check("estourar derruba", nota(base({ gastoDoOrcamento: 1.4 }), "mercado") < 40)
check("e quanto mais estoura, pior",
  nota(base({ gastoDoOrcamento: 1.4 }), "mercado") < nota(base({ gastoDoOrcamento: 1.1 }), "mercado"))

console.log("\nBase: a diretoria cobra que se forme\n")

check("nenhum promovido e o pior caso", nota(base({ promovidosDaBase: 0 }), "base") < 55)
check("tres promovidos e o melhor", nota(base({ promovidosDaBase: 3 }), "base") >= 85)
check("a escada e monotona",
  nota(base({ promovidosDaBase: 0 }), "base") < nota(base({ promovidosDaBase: 1 }), "base")
  && nota(base({ promovidosDaBase: 1 }), "base") < nota(base({ promovidosDaBase: 2 }), "base"))

console.log("\nA area mais fragil e ACIONAVEL — e nao inventa alarme\n")

check("com tudo bem, nenhuma area e apontada", areaMaisFragil(confiancaPorArea(base())) === null)
check("com o clube quebrado, aponta financas",
  areaMaisFragil(confiancaPorArea(campeaoQuebrado))?.area === "financas")
check("com o time perdendo, aponta resultados",
  areaMaisFragil(confiancaPorArea(arrumadoPerdendo))?.area === "resultados")
const vestiarioRuim = base({ moralDoElenco: 25 })
check("com o grupo contra, aponta vestiario",
  areaMaisFragil(confiancaPorArea(vestiarioRuim))?.area === "vestiario")

console.log("\nA governanca entra em FINANCAS, que e de onde ela nasce\n")

// O bônus de governança vem de atraso de pagamento — nunca de derrota.
const semPenalidade = nota(base(), "financas")
const comPenalidade = nota(base({ bonusDeGovernanca: -30 }), "financas")
check("a penalidade derruba financas", comPenalidade < semPenalidade,
  `${comPenalidade} vs ${semPenalidade}`)
check("e nao encosta em resultados",
  nota(base({ bonusDeGovernanca: -30 }), "resultados") === nota(base(), "resultados"))

console.log(falhas === 0 ? "\nTODOS OS TESTES PASSARAM\n" : `\n${falhas} FALHA(S)\n`)
process.exit(falhas === 0 ? 0 : 1)
