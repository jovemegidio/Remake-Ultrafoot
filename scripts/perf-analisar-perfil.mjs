// LÊ UM .cpuprofile DO V8 E DIZ ONDE O TEMPO FOI.
//
// Uso:
//   node --cpu-prof --cpu-prof-dir=<dir> --import tsx scripts/<harness>.ts
//   node scripts/perf-analisar-perfil.mjs <dir>/<arquivo>.cpuprofile
//
// ── Por que SELF TIME e nao total ───────────────────────────────────────────
// O tempo "total" (inclusive) de uma funcao inclui tudo que ela chamou. Numa
// arvore como a deste jogo, `advanceWeek` apareceria com ~100% e nao diria nada:
// ela orquestra, nao calcula. Self time e o tempo em que a funcao estava NO TOPO
// da pilha — é ele que aponta o codigo que realmente queima CPU.
//
// ⚠️ O profiler do V8 INFLA a memoria do processo (mede-se 344 MB de heap sem
// ele e ~700 MB com ele). Nao use uma execucao perfilada para julgar consumo de
// memoria; para isso, rode o harness sem `--cpu-prof`.
import { readFileSync } from "node:fs"

const arquivo = process.argv[2]
if (!arquivo) {
  console.error("uso: node scripts/perf-analisar-perfil.mjs <arquivo.cpuprofile>")
  process.exit(1)
}

const p = JSON.parse(readFileSync(arquivo, "utf8"))
const porId = new Map(p.nodes.map(n => [n.id, n]))

// Cada amostra aponta um no; o delta e o tempo desde a amostra anterior.
const self = new Map()
for (let i = 0; i < p.samples.length; i++) {
  const id = p.samples[i]
  const dt = p.timeDeltas[i] ?? 0
  self.set(id, (self.get(id) ?? 0) + dt)
}

const porFuncao = new Map()
const porArquivo = new Map()
let total = 0
for (const [id, us] of self) {
  const n = porId.get(id)
  if (!n) continue
  const cf = n.callFrame
  // Anonima sem linha e inutil para agir: `(anonimo) @ players-data` nao diz
  // ONDE. O V8 da a posicao no callFrame; usamos para localizar o trecho.
  const linha = typeof cf.lineNumber === "number" ? ":" + (cf.lineNumber + 1) : ""
  const nome = (cf.functionName || "(anonimo)") + linha
  const url = (cf.url || "").replace(/^file:\/{2,3}/, "").split("\\").join("/")
  const curto = url.split("/").slice(-2).join("/") || "(nativo)"
  const chave = nome + " @ " + curto
  porFuncao.set(chave, (porFuncao.get(chave) ?? 0) + us)
  porArquivo.set(curto, (porArquivo.get(curto) ?? 0) + us)
  total += us
}

const ms = us => Math.round(us / 1000)
const pct = us => ((us / total) * 100).toFixed(1)

console.log("\n===== PERFIL DE CPU — total amostrado: " + ms(total) + " ms =====\n")
console.log("--- SELF TIME por ARQUIVO (top 18) ---")
for (const [k, v] of [...porArquivo].sort((a, b) => b[1] - a[1]).slice(0, 18)) {
  console.log("  " + String(ms(v)).padStart(7) + " ms  " + pct(v).padStart(5) + "%  " + k)
}
console.log("\n--- SELF TIME por FUNCAO (top 25) ---")
for (const [k, v] of [...porFuncao].sort((a, b) => b[1] - a[1]).slice(0, 25)) {
  console.log("  " + String(ms(v)).padStart(7) + " ms  " + pct(v).padStart(5) + "%  " + k.slice(0, 84))
}

// ─── QUEM CHAMA AS MAIS CARAS ────────────────────────────────────────────────
//
// Função anônima chamada ":2" não diz nada: o tsx transpila para CJS e o source
// map não chega ao perfil, então TODA função vira "linha 2". Sem saber QUEM
// chama, "(anonimo) @ game-engine 23%" é um beco sem saída — foi exatamente
// onde a otimização travou até este bloco existir.
//
// O `.cpuprofile` guarda a árvore: cada nó tem `children`. Invertendo essa
// relação dá para subir do nó caro até a raiz e o anônimo ganha endereço
// ("chamado por advanceWeek, chamado por ...").
const paiDe = new Map()
for (const n of p.nodes) for (const filho of n.children ?? []) paiDe.set(filho, n.id)

function cadeiaDeChamada(id) {
  const nomes = []
  let atual = id
  const visitados = new Set()
  while (atual !== undefined && !visitados.has(atual)) {
    visitados.add(atual)
    const n = porId.get(atual)
    if (!n) break
    const cf = n.callFrame
    const arquivo = (cf.url || "").split(/[/\\]/).pop() || ""
    const nome = cf.functionName || "(anonimo)"
    if (nome !== "(root)") nomes.push(nome + (arquivo ? "@" + arquivo : ""))
    atual = paiDe.get(atual)
  }
  return nomes
}

console.log("\n--- CADEIA DE CHAMADA das 6 mais caras ---")
for (const [id, us] of [...self].sort((a, b) => b[1] - a[1]).slice(0, 6)) {
  console.log("\n  " + ms(us) + " ms (" + pct(us) + "%)")
  console.log("    " + cadeiaDeChamada(id).slice(0, 8).join("\n      <- "))
}
