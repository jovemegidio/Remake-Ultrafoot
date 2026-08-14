// QUANTO CUSTA AVANÇAR O UNIVERSO, SEMANA A SEMANA?
//
// Relato: "ao simular uma certa quantidade de partidas no calendário, trava na
// simulação de dias". O `advanceWeek` do gerenciador tem 1.643 linhas e NENHUM
// `await`: é síncrono, então não pode ficar pendurado numa promessa — só pode
// bloquear a thread. Enquanto ele roda, a data não anda e a tela não pinta, que
// é exatamente a aparência de travamento.
//
// Este script mede o suspeito principal: `avancarUniverso286` começa com um
// `structuredClone` do universo inteiro (286 clubes com elencos, contratos e
// finanças) toda semana.
//
//   npx tsx scripts/medir-universo-286.ts [semanas]

export {}

async function main() {
  const semanas = Number(process.argv[2] ?? 40)

  const { criarUniversoPersistente286, avancarUniverso286 } = await import("../lib/universo-286")

  // Universo sintético do MESMO porte do real: 286 clubes, 25 atletas cada.
  const clubes = Array.from({ length: 286 }, (_, c) => ({
    curto: `C${String(c).padStart(3, "0")}`,
    nome: `Clube ${c}`,
    pais: "Brasil",
    divisao: c < 20 ? "serie_a" : "serie_b",
    prestigio: 40 + (c % 55),
    saldo: 10_000_000,
    jogadores: Array.from({ length: 25 }, (_, j) => ({
      nome: `Atleta ${c}-${j}`,
      posicao: ["GOL", "ZAG", "MEI", "ATA"][j % 4],
      idade: 18 + (j % 18),
      overall: 45 + ((c + j) % 45),
    })),
  }))

  console.log("\nSemeando o universo...")
  const t0 = Date.now()
  let universo = criarUniversoPersistente286({ temporada: 2026, clubeDoUsuario: "C000", clubes })
  console.log(`  semeadura: ${Date.now() - t0} ms`)

  const tamanho = (u: unknown) => JSON.stringify(u).length / 1048576
  console.log(`  tamanho do universo: ${tamanho(universo).toFixed(2)} MB`)
  console.log(`  clubes: ${Object.keys((universo as { clubes?: object }).clubes ?? {}).length}`)

  // O clone sozinho, para separar o custo dele do resto da função.
  const tc = Date.now()
  structuredClone(universo)
  console.log(`  structuredClone sozinho: ${Date.now() - tc} ms\n`)

  console.log("semana    ms   acumulado(s)")
  const tempos: number[] = []
  let acumulado = 0
  for (let s = 1; s <= semanas; s++) {
    const t = Date.now()
    const r = avancarUniverso286(universo, {
      temporada: 2026,
      semana: s,
      janelaAberta: s % 10 < 4,
    })
    universo = r.estado
    const ms = Date.now() - t
    tempos.push(ms)
    acumulado += ms
    if (s % 5 === 0 || s <= 2) {
      console.log(`  ${String(s).padStart(4)}  ${String(ms).padStart(5)}  ${(acumulado / 1000).toFixed(1).padStart(11)}`)
    }
  }

  const media = tempos.reduce((a, b) => a + b, 0) / tempos.length
  const pior = Math.max(...tempos)
  console.log(`\n  media por semana: ${media.toFixed(0)} ms`)
  console.log(`  pior semana:      ${pior} ms`)
  console.log(`  total de ${semanas} semanas: ${(acumulado / 1000).toFixed(1)} s`)
  console.log(`  tamanho final:    ${tamanho(universo).toFixed(2)} MB`)
  console.log(`\n  Uma temporada tem ~52 semanas: ${((media * 52) / 1000).toFixed(1)} s SÓ neste passo,`)
  console.log("  com a thread bloqueada — a data do calendario nao anda nesse tempo.")
}

void main()
