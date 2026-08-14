// UM MÊS DE BASE NUNCA PODE RENDER MENOS QUE UMA SEMANA.
//
// Relato de jogador (13/08/2026): "acompanhar uma semana está funcionando mais
// que evoluir um mês". Estava certo. Havia duas fórmulas para a mesma coisa: a
// semana pesava a margem até o potencial e o nível da academia; o mês era um
// `Math.random() > 0.35` fixo, uma vez só, cego para os dois. Com academia boa,
// uma semana valia mais que o mês inteiro — e quem clicava na opção que PARECE
// maior era punido.
//
// Este teste não afere a fórmula (ela pode e deve ser recalibrada). Ele afere a
// RELAÇÃO entre as duas ações, que é o que o jogador percebe e o que estava
// invertido. Enquanto o mês for quatro semanas da mesma regra, ele passa por
// construção; se alguém reintroduzir uma segunda fórmula, ele reprova.
//
//   npx tsx scripts/test-base-semana-vs-mes.ts

export {}

let falhas = 0
function check(nome: string, cond: boolean, detalhe = "") {
  if (!cond) falhas++
  console.log(`${cond ? "  ok  " : " FALHA"} ${nome}${cond ? "" : ` — ${detalhe}`}`)
}

/** Gerador determinístico: sem isto o teste oscila e vira ruído. */
function rngSemeado(semente: number): () => number {
  let s = semente >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 4294967296
  }
}

async function main() {
  const { evoluirSemana } = await import("../lib/youth-academy-rules")
  const { advanceYouthMonth, SEMANAS_NO_MES } = await import("../lib/youth-engine")

  /** Uma base de 30 garotos com margem larga — o caso em que a diferença aparece. */
  const base = () => Array.from({ length: 30 }, (_, i) => ({
    id: `j${i}`,
    name: `Garoto ${i}`,
    position: i % 5 === 0 ? "GOL" : "MEI",
    age: 16 + (i % 4),
    overall: 50 + (i % 10),
    potential: 78 + (i % 8),
  }))

  const somaOverall = (jovens: { overall: number }[]) => jovens.reduce((s, j) => s + j.overall, 0)

  console.log("\nO mes rende ao menos o que a semana rende — em toda academia\n")

  for (const nivel of [1, 2, 3, 4, 5]) {
    // A MESMA semente nos dois lados: a comparação é da REGRA, não da sorte.
    const semana = evoluirSemana(base(), nivel, rngSemeado(7)).jovens
    const mes = advanceYouthMonth(
      { youthPlayers: base(), season: 2026, week: 4 } as never,
      nivel,
      rngSemeado(7),
    ).state.youthPlayers as unknown as { overall: number }[]

    const ganhoSemana = somaOverall(semana) - somaOverall(base())
    const ganhoMes = somaOverall(mes) - somaOverall(base())
    check(
      `academia nivel ${nivel}: mes (${ganhoMes}) >= semana (${ganhoSemana})`,
      ganhoMes >= ganhoSemana,
      "o mes rendeu MENOS que a semana — a inversao relatada voltou",
    )
  }

  console.log("\nO mes e mesmo quatro semanas, nao uma com nome diferente\n")

  // Com muitas amostras a média do mês tem de ficar perto de 4x a da semana.
  let totalSemana = 0, totalMes = 0
  for (let s = 0; s < 40; s++) {
    totalSemana += somaOverall(evoluirSemana(base(), 3, rngSemeado(s)).jovens) - somaOverall(base())
    totalMes += somaOverall(
      advanceYouthMonth({ youthPlayers: base(), season: 2026, week: 4 } as never, 3, rngSemeado(s))
        .state.youthPlayers as unknown as { overall: number }[],
    ) - somaOverall(base())
  }
  const razao = totalMes / Math.max(1, totalSemana)
  check(`a razao mes/semana fica perto de ${SEMANAS_NO_MES} (deu ${razao.toFixed(2)})`,
    razao > 2.5 && razao <= SEMANAS_NO_MES + 0.5,
    "fora da faixa: o mes deixou de ser quatro semanas da mesma regra")

  console.log("\nA academia importa NO MES tambem — era metade do defeito\n")

  const mesFraco = advanceYouthMonth(
    { youthPlayers: base(), season: 2026, week: 4 } as never, 1, rngSemeado(99),
  ).state.youthPlayers as unknown as { overall: number }[]
  const mesForte = advanceYouthMonth(
    { youthPlayers: base(), season: 2026, week: 4 } as never, 5, rngSemeado(99),
  ).state.youthPlayers as unknown as { overall: number }[]
  check("academia 5 rende mais que academia 1 no mes",
    somaOverall(mesForte) > somaOverall(mesFraco),
    `${somaOverall(mesForte)} vs ${somaOverall(mesFraco)} — o mes voltou a ignorar o investimento`)

  console.log("\nNinguem passa do potencial\n")

  const estourou = advanceYouthMonth(
    { youthPlayers: base(), season: 2026, week: 4 } as never, 5, rngSemeado(3),
  ).state.youthPlayers as unknown as { overall: number; potential: number }[]
  check("nenhum garoto ultrapassa o proprio potencial",
    estourou.every(j => j.overall <= j.potential))

  console.log("\nO relatorio do mes conta quem evoluiu\n")

  const comRelatorio = advanceYouthMonth(
    { youthPlayers: base(), season: 2026, week: 4 } as never, 4, rngSemeado(11),
  )
  const evoluidos = (comRelatorio.state.youthPlayers as unknown as { overall: number }[])
    .filter((j, i) => j.overall > base()[i].overall).length
  check(`o relatorio lista os ${evoluidos} que evoluiram`,
    comRelatorio.report.highlights.length === evoluidos,
    `relatorio diz ${comRelatorio.report.highlights.length}`)

  console.log(falhas === 0 ? "\nTODOS OS TESTES PASSARAM\n" : `\n${falhas} FALHA(S)\n`)
  process.exit(falhas === 0 ? 0 : 1)
}

void main()
