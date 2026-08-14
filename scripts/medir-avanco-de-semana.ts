// O AVANÇO DE SEMANA FICA MAIS LENTO A CADA SEMANA?
//
// Relato de jogador: "ao simular uma certa quantidade de partidas no calendário
// trava na simulação de dias". "Trava" pode ser duas coisas muito diferentes:
// um laço que nunca termina, ou um passo que fica tão lento que parece parado.
// A tela do calendário já tem blindagem contra o primeiro caso (erro numa semana
// interrompe com segurança e o `finally` devolve a tela), então este script
// existe para medir o segundo — objetivamente, fora do React.
//
// Mede o TEMPO de cada avanço e o TAMANHO do estado, para ver se algum deles
// cresce sem limite. Estado que só cresce é o que transforma "simular até
// dezembro" em travamento no meio do caminho.
//
//   npx tsx scripts/medir-avanco-de-semana.ts [quantas-semanas]

export {}

async function main() {
  const quantas = Number(process.argv[2] ?? 80)

  // O motor é do navegador: dá a ele o mínimo antes de importar.
  const g = globalThis as unknown as Record<string, unknown>
  if (!g.window) {
    const armazem = new Map<string, string>()
    g.localStorage = {
      getItem: (k: string) => armazem.get(k) ?? null,
      setItem: (k: string, v: string) => { armazem.set(k, v) },
      removeItem: (k: string) => { armazem.delete(k) },
      clear: () => { armazem.clear() },
      key: (i: number) => [...armazem.keys()][i] ?? null,
      get length() { return armazem.size },
    }
    g.window = { localStorage: g.localStorage, addEventListener: () => {}, removeEventListener: () => {}, dispatchEvent: () => true, location: { search: "", pathname: "/" } }
    g.CustomEvent = class { constructor(public tipo: string, public init?: unknown) {} }
  }

  const { useGameEngine } = await import("../lib/game-engine")
  useGameEngine.getState().initializeGame("BGT")

  const tamanhoDoEstado = () => {
    const st = useGameEngine.getState() as unknown as Record<string, unknown>
    const dados: Record<string, number> = {}
    let total = 0
    for (const [chave, valor] of Object.entries(st)) {
      if (typeof valor === "function") continue
      let bytes = 0
      try { bytes = JSON.stringify(valor)?.length ?? 0 } catch { bytes = 0 }
      dados[chave] = bytes
      total += bytes
    }
    return { total, dados }
  }

  const antes = tamanhoDoEstado()
  console.log(`\nEstado inicial: ${(antes.total / 1024).toFixed(0)} KB\n`)
  console.log("semana    ms   estado(KB)")

  const tempos: number[] = []
  for (let i = 1; i <= quantas; i++) {
    const t0 = Date.now()
    useGameEngine.getState().advanceWeek()
    const ms = Date.now() - t0
    tempos.push(ms)
    if (i % 10 === 0 || i <= 3) {
      console.log(`  ${String(i).padStart(4)}  ${String(ms).padStart(5)}  ${(tamanhoDoEstado().total / 1024).toFixed(0).padStart(9)}`)
    }
  }

  const primeiras = tempos.slice(0, 10).reduce((s, t) => s + t, 0) / 10
  const ultimas = tempos.slice(-10).reduce((s, t) => s + t, 0) / 10
  const pior = Math.max(...tempos)

  console.log(`\n  media das 10 primeiras: ${primeiras.toFixed(1)} ms`)
  console.log(`  media das 10 ultimas:   ${ultimas.toFixed(1)} ms`)
  console.log(`  pior semana:            ${pior} ms`)
  console.log(`  fator de degradacao:    ${(ultimas / Math.max(0.1, primeiras)).toFixed(2)}x`)

  const depois = tamanhoDoEstado()
  console.log(`\n  estado: ${(antes.total / 1024).toFixed(0)} KB -> ${(depois.total / 1024).toFixed(0)} KB`)
  console.log("\n  campos que mais cresceram:")
  const crescimento = Object.entries(depois.dados)
    .map(([k, v]) => ({ campo: k, delta: v - (antes.dados[k] ?? 0), agora: v }))
    .filter(c => c.delta > 1024)
    .sort((a, b) => b.delta - a.delta)
    .slice(0, 10)
  for (const c of crescimento) {
    console.log(`    ${c.campo.padEnd(28)} +${(c.delta / 1024).toFixed(0)} KB  (agora ${(c.agora / 1024).toFixed(0)} KB)`)
  }
}

void main()
