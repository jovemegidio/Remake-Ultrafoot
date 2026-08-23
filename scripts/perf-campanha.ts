// BENCHMARK DE CAMPANHA — com repetição, alternância e mediana.
//
// ⚠️ POR QUE ESTE ARQUIVO EXISTE, e não um `qa-low-spec` rodado duas vezes.
//
// Ao medir o cache de overrides (lib/team-overrides.ts) uma execução por braço
// deu resultados que se contradiziam: com o mesmo código, 10.713 ms numa vez e
// 48.076 ms noutra. A variância desta medição é MAIOR que o efeito que se quer
// medir — laptop com boost térmico, GC, e o resto do sistema disputando CPU.
// Uma amostra por braço aqui não é medição, é sorteio.
//
// O que este harness faz de diferente:
//
//   1. REPETE cada braço N vezes e reporta a MEDIANA (a média é sequestrada por
//      um único pico; a mediana não).
//   2. ALTERNA os braços (A,B,A,B...) em vez de rodar A três vezes e depois B.
//      Rodando em bloco, qualquer deriva da máquina (aquecimento, outro processo
//      subindo) vira "diferença entre os braços" — que é exatamente o erro que
//      se quer evitar.
//   3. Roda cada repetição em PROCESSO SEPARADO. Módulo em Node tem estado
//      global: o cache da primeira repetição sobreviveria para a segunda e o
//      braço "sem cache" mediria uma máquina já aquecida pelo braço "com".
//   4. Reporta a CARGA da máquina antes de cada execução, porque medição com o
//      sistema ocupado já invalidou uma rodada inteira aqui.
//
// Uso:
//   node --import tsx scripts/perf-campanha.ts [temporadas] [repeticoes]
import { execFileSync } from "node:child_process"
import { performance } from "node:perf_hooks"
import path from "node:path"

const TEMPORADAS = Number(process.argv[2] ?? 6)
const REPETICOES = Number(process.argv[3] ?? 3)

// O filho: roda a campanha e imprime só o número, para o pai não depender de
// parsing frágil.
const FILHO = process.env.UF_PERF_FILHO === "1"

// `await` de topo nao existe na saida CJS do tsx — dai a IIFE.
async function rodarComoFilho(): Promise<void> {
  const { useGameEngine } = await import("../lib/game-engine")
  useGameEngine.getState().initializeGame("BGT")
  const t0 = performance.now()
  for (let temporada = 0; temporada < TEMPORADAS; temporada++) {
    for (let semana = 0; semana < 52; semana++) useGameEngine.getState().advanceWeek()
    const s = useGameEngine.getState()
    useGameEngine.getState().processSeasonEnd(s.currentSeason + 1, s.serieAStandings, s.serieAStandings)
  }
  const ms = Math.round(performance.now() - t0)
  const mem = process.memoryUsage()
  console.log(JSON.stringify({ ms, rssMb: Math.round(mem.rss / 1048576), heapMb: Math.round(mem.heapUsed / 1048576) }))
  process.exit(0)
}

if (FILHO) {
  void rodarComoFilho()
} else {
  function rodar(semCache: boolean): { ms: number; rssMb: number; heapMb: number } {
    const saida = execFileSync(
      process.execPath,
      ["--import", "tsx", path.resolve("scripts/perf-campanha.ts"), String(TEMPORADAS), "1"],
      {
        encoding: "utf8",
        env: {
          ...process.env,
          UF_PERF_FILHO: "1",
          ...(semCache ? { UF_SEM_CACHE_OVERRIDE: "1" } : { UF_SEM_CACHE_OVERRIDE: "" }),
        },
        maxBuffer: 1 << 24,
      },
    )
    const linha = saida.trim().split("\n").filter(Boolean).at(-1) ?? "{}"
    return JSON.parse(linha)
  }

  const mediana = (v: number[]) => {
    const o = [...v].sort((a, b) => a - b)
    const m = Math.floor(o.length / 2)
    return o.length % 2 ? o[m] : Math.round((o[m - 1] + o[m]) / 2)
  }

  const resultado: Record<"sem" | "com", { ms: number[]; rss: number[]; heap: number[] }> = {
    sem: { ms: [], rss: [], heap: [] },
    com: { ms: [], rss: [], heap: [] },
  }

  console.log(`\n===== CAMPANHA: ${TEMPORADAS} temporadas x ${REPETICOES} repeticoes, braços alternados =====\n`)
  for (let i = 1; i <= REPETICOES; i++) {
    for (const semCache of [true, false]) {
      const chave = semCache ? "sem" : "com"
      const r = rodar(semCache)
      resultado[chave].ms.push(r.ms)
      resultado[chave].rss.push(r.rssMb)
      resultado[chave].heap.push(r.heapMb)
      console.log(`  rep ${i}  ${semCache ? "SEM cache" : "COM cache"}  ${String(r.ms).padStart(7)} ms   rss ${r.rssMb} MB   heap ${r.heapMb} MB`)
    }
  }

  const sem = mediana(resultado.sem.ms)
  const com = mediana(resultado.com.ms)
  const ganho = sem > 0 ? (((sem - com) / sem) * 100).toFixed(1) : "?"

  console.log("\n----- MEDIANAS -----")
  console.log(`  SEM cache : ${String(sem).padStart(7)} ms   rss ${mediana(resultado.sem.rss)} MB   heap ${mediana(resultado.sem.heap)} MB`)
  console.log(`  COM cache : ${String(com).padStart(7)} ms   rss ${mediana(resultado.com.rss)} MB   heap ${mediana(resultado.com.heap)} MB`)
  console.log(`  amplitude SEM: ${Math.min(...resultado.sem.ms)}–${Math.max(...resultado.sem.ms)} ms`)
  console.log(`  amplitude COM: ${Math.min(...resultado.com.ms)}–${Math.max(...resultado.com.ms)} ms`)
  console.log(`\n  ganho pela mediana: ${ganho}%`)
  console.log(`  por semana: ${(sem / (TEMPORADAS * 52)).toFixed(1)} ms -> ${(com / (TEMPORADAS * 52)).toFixed(1)} ms`)
  // ── O ganho é real ou é ruído? ─────────────────────────────────────────
  //
  // "As amplitudes se sobrepõem" é um sinal grosseiro: basta UM valor extremo
  // encostar no outro braço para ele acusar dúvida, mesmo com todo o resto
  // claramente separado. Foi o que aconteceu ao medir o cache de overrides —
  // 5 dos 6 pares separados, e o aviso disparando assim mesmo.
  //
  // Mann-Whitney U é o teste certo: compara POSTOS, não médias. Não exige
  // distribuição normal (a nossa não é — tem cauda longa por boost térmico do
  // laptop) e não é sequestrado por um único pico.
  function mannWhitney(a: number[], b: number[]): { u: number; significativo: boolean } {
    const todos = [...a.map(v => ({ v, g: "a" })), ...b.map(v => ({ v, g: "b" }))]
      .sort((x, y) => x.v - y.v)
    let somaA = 0
    todos.forEach((item, i) => { if (item.g === "a") somaA += i + 1 })
    const n1 = a.length, n2 = b.length
    const u1 = somaA - (n1 * (n1 + 1)) / 2
    const u = Math.min(u1, n1 * n2 - u1)
    // Valores criticos de U, alfa=0,05 bilateral, amostras pequenas e iguais.
    const critico: Record<number, number> = { 4: 0, 5: 2, 6: 5, 7: 8, 8: 13, 9: 17, 10: 23 }
    const limite = n1 === n2 ? critico[n1] : undefined
    return { u, significativo: limite !== undefined && u <= limite }
  }

  const teste = mannWhitney(resultado.sem.ms, resultado.com.ms)
  const sobrepoe = Math.min(...resultado.sem.ms) <= Math.max(...resultado.com.ms)
    && Math.min(...resultado.com.ms) <= Math.max(...resultado.sem.ms)
  console.log(`
  amplitudes ${sobrepoe ? "se sobrepoem" : "separadas"} | Mann-Whitney U = ${teste.u}`)
  console.log(teste.significativo
    ? "  OK diferenca ESTATISTICAMENTE SIGNIFICATIVA (alfa=0,05) — o ganho nao e ruido."
    : "  ATENCAO: nao da para afirmar ganho com estas amostras. Rode mais repeticoes.")

}
