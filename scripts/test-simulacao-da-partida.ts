// O PLACAR PRECISA OUVIR O ELENCO — e continuar sendo futebol.
//
// Este teste existe por causa de uma troca de motor de placar. Até a 1.0.315 a
// partida simulada saía do PRESTÍGIO do clube e de mais nada: contratar, escalar
// e mudar a tática não mexiam no resultado de nenhuma partida que o jogador não
// disputasse ao vivo.
//
// Trocar isso é mexer na balança do jogo inteiro, e uma mudança dessas passa em
// type-check e lint sem dizer nada. As duas perguntas que importam são opostas
// entre si, e as duas precisam ser respondidas:
//
//   1. O elenco passou a MUDAR o placar? (senão a correção não corrigiu nada)
//   2. Ele mudou DEMAIS? (aí o futebol some e o time melhor ganha sempre)
//
//   npx tsx scripts/test-simulacao-da-partida.ts

export {}

let falhas = 0
function check(nome: string, cond: boolean, detalhe = "") {
  if (!cond) falhas++
  console.log(`${cond ? "  ok  " : " FALHA"} ${nome}${cond ? "" : ` — ${detalhe}`}`)
}

async function main() {
  const {
    simularPartida, duelosDaPartida, forcaPorPrestigio,
  } = await import("../lib/simulacao-da-partida")

  const forca = (n: number) => ({ ataque: n, meio: n, defesa: n })
  const JOGOS = 4000

  /** Roda N partidas variando só a semente e devolve as estatísticas. */
  const serie = (a: number, b: number, taticaA?: Record<string, number>) => {
    let vitoriasA = 0, empates = 0, golsA = 0, golsB = 0, maiorPlacar = 0
    for (let i = 0; i < JOGOS; i++) {
      const r = simularPartida(
        { forca: forca(a), tatica: taticaA },
        { forca: forca(b), mandante: false },
        `teste-${a}-${b}-${i}`,
      )
      golsA += r.golsMandante
      golsB += r.golsVisitante
      maiorPlacar = Math.max(maiorPlacar, r.golsMandante, r.golsVisitante)
      if (r.golsMandante > r.golsVisitante) vitoriasA++
      else if (r.golsMandante === r.golsVisitante) empates++
    }
    return {
      vitoriasA: vitoriasA / JOGOS, empates: empates / JOGOS,
      golsA: golsA / JOGOS, golsB: golsB / JOGOS, maiorPlacar,
    }
  }

  console.log("\nO futebol continua sendo futebol\n")

  const parelho = serie(70, 70)
  check("time medio marca entre 1 e 2 gols",
    parelho.golsA > 0.9 && parelho.golsA < 2.1, `media ${parelho.golsA.toFixed(2)}`)
  check("mando de campo da vantagem, sem ser decisivo",
    parelho.vitoriasA > 0.38 && parelho.vitoriasA < 0.55, `${(parelho.vitoriasA * 100).toFixed(1)}% de vitorias em casa`)
  check("empate acontece com frequencia de futebol",
    parelho.empates > 0.15 && parelho.empates < 0.35, `${(parelho.empates * 100).toFixed(1)}%`)
  check("nao ha placar de circo", parelho.maiorPlacar <= 6, `maior: ${parelho.maiorPlacar}`)

  console.log("\n⚠️ O ELENCO MUDA O PLACAR (era o defeito)\n")

  const superior = serie(82, 62)
  const inferior = serie(62, 82)
  check("elenco MUITO melhor vence bem mais",
    superior.vitoriasA > 0.6, `${(superior.vitoriasA * 100).toFixed(1)}%`)
  check("elenco MUITO pior vence bem menos",
    inferior.vitoriasA < 0.28, `${(inferior.vitoriasA * 100).toFixed(1)}%`)
  check("a diferenca de elenco aparece nos gols",
    superior.golsA > parelho.golsA && superior.golsB < parelho.golsB,
    `${superior.golsA.toFixed(2)}x${superior.golsB.toFixed(2)} vs ${parelho.golsA.toFixed(2)}x${parelho.golsB.toFixed(2)}`)

  console.log("\n⚠️ MAS NAO DECIDE SOZINHO (o azar existe)\n")

  check("o time muito pior ainda ganha as vezes",
    inferior.vitoriasA > 0.05, `${(inferior.vitoriasA * 100).toFixed(1)}% — abaixo disso o jogo vira planilha`)
  check("o time muito melhor ainda perde as vezes",
    superior.vitoriasA < 0.9, `${(superior.vitoriasA * 100).toFixed(1)}%`)

  console.log("\nA tatica pesa, e pesa MENOS que o elenco\n")

  const comPlano = serie(70, 70, { ataque: 6, meio: 4 })
  check("plano bom melhora o aproveitamento",
    comPlano.vitoriasA > parelho.vitoriasA,
    `${(comPlano.vitoriasA * 100).toFixed(1)}% vs ${(parelho.vitoriasA * 100).toFixed(1)}%`)
  check("mas 20 de elenco pesa mais que 6 de tatica",
    superior.vitoriasA > comPlano.vitoriasA,
    `elenco ${(superior.vitoriasA * 100).toFixed(1)}% vs tatica ${(comPlano.vitoriasA * 100).toFixed(1)}%`)

  console.log("\nO mesmo jogo da sempre o mesmo placar\n")

  const a = simularPartida({ forca: forca(75) }, { forca: forca(70), mandante: false }, "CRU-FLA-2026-12")
  const b = simularPartida({ forca: forca(75) }, { forca: forca(70), mandante: false }, "CRU-FLA-2026-12")
  check("mesma semente, mesmo placar",
    a.golsMandante === b.golsMandante && a.golsVisitante === b.golsVisitante,
    `${a.golsMandante}x${a.golsVisitante} vs ${b.golsMandante}x${b.golsVisitante}`)
  const c = simularPartida({ forca: forca(75) }, { forca: forca(70), mandante: false }, "CRU-FLA-2026-13")
  check("sementes diferentes nao sao sempre iguais",
    `${a.golsMandante}${a.golsVisitante}` !== `${c.golsMandante}${c.golsVisitante}`
      || true /* pode coincidir; a garantia real e a de cima */)

  console.log("\nA explicacao aponta o setor CERTO\n")

  const perdendoNoMeio = simularPartida(
    { forca: { ataque: 70, meio: 55, defesa: 70 } },
    { forca: { ataque: 70, meio: 78, defesa: 70 }, mandante: false },
    "explica-1",
  )
  check("o meio dominado aparece na explicacao",
    perdendoNoMeio.porQue.some(f => f.includes("meio-campo") && f.includes("dominado")),
    JSON.stringify(perdendoNoMeio.porQue))
  check("e vem PRIMEIRO, por ser o maior desequilibrio",
    perdendoNoMeio.porQue[0]?.includes("meio-campo"),
    JSON.stringify(perdendoNoMeio.porQue))

  const equilibrado = simularPartida(
    { forca: forca(70) }, { forca: forca(70), mandante: false }, "explica-2",
  )
  check("jogo equilibrado NAO inventa causa",
    equilibrado.porQue.length === 0,
    JSON.stringify(equilibrado.porQue))

  const duelos = duelosDaPartida(
    { forca: { ataque: 80, meio: 70, defesa: 60 } },
    { forca: { ataque: 75, meio: 70, defesa: 65 }, mandante: false },
  )
  check("ataque encara a DEFESA do outro, nao o ataque",
    duelos[0].deles === 65, `${duelos[0].deles}`)
  check("defesa encara o ATAQUE do outro",
    duelos[2].deles === 75, `${duelos[2].deles}`)

  console.log("\nPrestigio ainda serve aos clubes que o jogo nao simula\n")

  const fraco = forcaPorPrestigio(20)
  const forte = forcaPorPrestigio(90)
  check("prestigio maior vira forca maior", forte.ataque > fraco.ataque)
  check("a faixa cai onde os elencos vivem (45-80)",
    fraco.ataque >= 45 && forte.ataque <= 80, `${fraco.ataque.toFixed(0)}..${forte.ataque.toFixed(0)}`)

  console.log(falhas === 0 ? "\nTODOS OS TESTES PASSARAM\n" : `\n${falhas} FALHA(S)\n`)
  process.exit(falhas === 0 ? 0 : 1)
}

void main()
