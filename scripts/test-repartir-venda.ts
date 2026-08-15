// A VENDA NÃO PODE PAGAR 100% DO QUE NÃO É SEU.
//
// Até a 1.0.316 `sellPlayer` fazia `balance + recebido` e pronto. Os três campos
// que o contrato já declarava — revenda ao clube anterior, % de direitos do
// clube e % de fundo — não eram lidos por ninguém. Vender um atleta de quem o
// clube possuía 60% pagava 100%.
//
// Além de irreal, era a jogada mais rentável do jogo: comprar direito fatiado
// barato e vender inteiro. Um teste é o que impede a conta de voltar a ser
// "valor cheio no caixa" numa refatoração distraída.
//
//   npx tsx scripts/test-repartir-venda.ts

export {}

let falhas = 0
function check(nome: string, cond: boolean, detalhe = "") {
  if (!cond) falhas++
  console.log(`${cond ? "  ok  " : " FALHA"} ${nome}${cond ? "" : ` — ${detalhe}`}`)
}

async function main() {
  const { repartirVenda, descreverRepasses } = await import("../lib/repartir-venda")

  console.log("\nSem cláusula nenhuma, o clube recebe tudo\n")

  const limpo = repartirVenda(10_000_000)
  check("valor cheio no caixa", limpo.liquido === 10_000_000, `${limpo.liquido}`)
  check("nenhum repasse", limpo.repasses.length === 0)
  check("contrato vazio tambem", repartirVenda(5_000_000, {}).liquido === 5_000_000)

  console.log("\nRevenda ao clube anterior\n")

  const revenda = repartirVenda(10_000_000, { resaleClause: 20, previousClub: "Santos" })
  check("20% saem do caixa", revenda.liquido === 8_000_000, `${revenda.liquido}`)
  check("o repasse aponta o clube", revenda.repasses[0]?.para === "Santos")
  check("revenda SEM clube anterior nao repassa (nao ha a quem pagar)",
    repartirVenda(10_000_000, { resaleClause: 20 }).liquido === 10_000_000)
  check("revenda e limitada a 50%",
    repartirVenda(10_000_000, { resaleClause: 900, previousClub: "X" }).liquido === 5_000_000)

  console.log("\nDireitos fatiados\n")

  const meio = repartirVenda(10_000_000, { ownedPercentage: 60 })
  check("possuindo 60%, recebe 60%", meio.liquido === 6_000_000, `${meio.liquido}`)
  const fundo = repartirVenda(10_000_000, { ownedPercentage: 70, fundPercentage: 30, fundName: "Doyen" })
  check("fundo leva a parte dele", fundo.liquido === 7_000_000, `${fundo.liquido}`)
  check("o fundo aparece pelo nome",
    fundo.repasses.some(r => r.para === "Doyen" && r.motivo === "fundo"))

  // ⚠️ `?? 100` e nao `|| 100`: um 0 explicito e zero mesmo.
  check("possuir 0% e ZERO, nao 'ausente'",
    repartirVenda(10_000_000, { ownedPercentage: 0 }).liquido === 0)
  check("ausencia de ownedPercentage e 100%",
    repartirVenda(10_000_000, { resaleClause: 0 }).liquido === 10_000_000)

  console.log("\nAs duas coisas juntas\n")

  // 60% dos direitos + 20% de revenda sobre o CHEIO = 6.0 - 2.0 = 4.0
  const tudo = repartirVenda(10_000_000, {
    ownedPercentage: 60, resaleClause: 20, previousClub: "Santos",
  })
  check("revenda incide sobre o valor CHEIO, nao sobre a fatia",
    tudo.liquido === 4_000_000, `${tudo.liquido} (esperado 4.000.000)`)
  check("os dois repasses aparecem", tudo.repasses.length === 2, JSON.stringify(tudo.repasses))

  console.log("\nO caixa nunca vira divida\n")

  const impossivel = repartirVenda(10_000_000, {
    ownedPercentage: 10, resaleClause: 50, previousClub: "Santos", fundPercentage: 50,
  })
  check("liquido nunca negativo", impossivel.liquido >= 0, `${impossivel.liquido}`)

  console.log("\nO extrato explica para onde foi\n")

  const texto = descreverRepasses(tudo)
  check("cita a revenda e o clube", texto.some(t => t.includes("revenda") && t.includes("Santos")), JSON.stringify(texto))
  check("cita os direitos", texto.some(t => t.includes("direitos")), JSON.stringify(texto))

  console.log("\nBorda: valores invalidos nao quebram a venda\n")

  check("valor negativo vira zero", repartirVenda(-5).liquido === 0)
  check("percentual NaN e ignorado",
    repartirVenda(1_000_000, { ownedPercentage: Number.NaN }).liquido >= 0)

  console.log(falhas === 0 ? "\nTODOS OS TESTES PASSARAM\n" : `\n${falhas} FALHA(S)\n`)
  process.exit(falhas === 0 ? 0 : 1)
}

void main()
