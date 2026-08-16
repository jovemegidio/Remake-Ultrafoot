// Acrescenta ao POOL (data/seeds/imported-bf2026.json) os clubes levantados a
// mao em clubes-novos.json.
//
//   node scripts/criar-clubes-no-seed.mjs --lista clubes-novos.json [--gravar]
//
// Sem `--gravar` e ensaio: mostra o que entraria e nao toca em arquivo nenhum.
//
// ⚠️ DUPLICATA E O RISCO PRINCIPAL, e ele nao da erro. O `fileKey` e a chave de
// tudo (escudo, uniforme, foto, save); dois clubes com nomes parecidos e chaves
// diferentes viram dois clubes na tabela. Por isso aqui a checagem e dupla:
// chave ja existente ABORTA, e nome normalizado ja existente tambem — este
// ultimo com `--forcar-nome` para o caso legitimo (ha "Nacional" em cinco UFs).
//
// ⚠️ NAO INVENTO ELENCO. O clube entra com `jogadores: []`, e quem completa e o
// `ensurePlayableSquad` de lib/players-data.ts — o mesmo caminho que ja atende
// os 87 clubes do pool que chegaram sem atleta e os 567 preenchimentos das
// ligas de coleta curta. Nome de jogador inventado aqui seria dado novo, e dado
// inventado ja custou caro neste projeto (altura/peso/pe).
//
// ⚠️ O ESTADUAL NAO PRECISA DE ARQUIVO NENHUM. `montarEstadual` (use-game-manager)
// pega os clubes da UF, ORDENA POR PRESTIGIO e corta no `participants` do
// regulamento. Ou seja: quem organiza o clube no estadual e o par (pais=UF,
// prestigio) — e por isso o prestigio sai da divisao REAL do clube, e nao de um
// numero redondo. Clube de 4a divisao estadual com prestigio alto tomaria a
// vaga de um clube da elite, calado.

import { readFileSync, writeFileSync, copyFileSync, existsSync } from "node:fs"
import path from "node:path"

const arg = (n) => { const i = process.argv.indexOf(n); return i >= 0 ? process.argv[i + 1] : "" }
const RAIZ = path.resolve(import.meta.dirname, "..")
const lista = arg("--lista")
const gravar = process.argv.includes("--gravar")
const forcarNome = process.argv.includes("--forcar-nome")
if (!lista) { console.error("uso: --lista clubes-novos.json [--gravar]"); process.exit(1) }

const norm = s => (s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "")

// ─── Prestigio pela DIVISAO REAL ────────────────────────────────────────────
//
// A faixa dos clubes que ja tem UF no pool vai de 50 a 94, mediana 66. Um clube
// de 3a ou 4a divisao estadual precisa ficar ABAIXO dessa faixa, senao ele
// entra no estadual principal na frente de quem disputa a elite.
// ⚠️ NAO PARSEIE A STRING DA DIVISAO. "Catarinense A" e a ELITE de SC e nao
// casa com nenhum padrao obvio; "Paulista 2a Divisao" parece 2o degrau e e o
// QUINTO. Os dois saiam com prestigio de meio de tabela e entrariam no estadual
// principal na frente de quem disputa a elite. O `nivel` (1..5) vem conferido
// da pagina de cada clube, e e ele que manda.
const POR_NIVEL = { 1: 60, 2: 54, 3: 49, 4: 45, 5: 42 }

function prestigioDe(c) {
  const v = POR_NIVEL[c.nivel]
  if (!v) throw new Error(`${c.fileKey}: sem "nivel" (1..5) — sem ele o prestigio seria chute`)
  return v
}

const pacote = JSON.parse(readFileSync(path.resolve(lista), "utf-8"))
const novos = pacote.novos ?? []

const arquivoSeed = path.join(RAIZ, "data/seeds/imported-bf2026.json")
const seed = JSON.parse(readFileSync(arquivoSeed, "utf-8"))
const porChave = new Set(seed.teams.map(t => t.fileKey).filter(Boolean))
const porNome = new Map()
for (const t of seed.teams) {
  const k = norm(t.nome)
  if (!porNome.has(k)) porNome.set(k, t.fileKey)
}
const porCurto = new Set(seed.teams.map(t => (t.curto ?? "").toUpperCase()).filter(Boolean))

const entram = [], recusados = []
for (const c of novos) {
  if (porChave.has(c.fileKey)) { recusados.push(`${c.fileKey}: chave JA EXISTE no pool`); continue }
  const chocaNome = porNome.get(norm(c.nome))
  if (chocaNome && !forcarNome) { recusados.push(`${c.fileKey}: nome "${c.nome}" ja e de ${chocaNome} (use --forcar-nome se forem clubes diferentes)`); continue }

  // ⚠️ `curto` E USADO COMO IDENTIDADE em vario lugar (montarEstadual descarta
  // por codigo repetido). Colidir esconderia o clube do estadual sem erro.
  let curto = (c.curto ?? norm(c.nome).toUpperCase()).slice(0, 12).toUpperCase()
  if (porCurto.has(curto)) {
    let i = 2
    while (porCurto.has(`${curto}${i}`)) i++
    curto = `${curto}${i}`
  }
  porCurto.add(curto)

  const prestigio = prestigioDe(c)
  entram.push({
    id: `bf_${c.fileKey}`,
    nome: c.nome,
    curto,
    cor1: c.cor1,
    cor2: c.cor2,
    estadio: c.estadio || "",
    // Nao sei quem treina esses clubes, e 60 clubes do pool ja estao assim.
    // Inventar um nome seria dado novo saindo do nada.
    tecnico: "",
    pais: c.uf,
    liga: "Liga Nacional",
    // ⚠️ Campo MORTO: os 2.994 clubes do pool dizem "Série A" aqui. Quem sabe a
    // divisao e o division_overrides_2026 (por NOME) e o estadual, pelo par
    // UF+prestigio. Mantido igual ao resto para nao criar um valor novo que
    // nenhum leitor conhece.
    divisao: "Série A",
    prestigio,
    saldo: prestigio * 55000,
    escudo: `/escudos/${c.fileKey}.png`,
    escudoDisponivel: false,
    jogadores: [],
    source: "wikipedia-2026-08-15",
    fileKey: c.fileKey,
    cidade: c.cidade,
  })
  porChave.add(c.fileKey)
  porNome.set(norm(c.nome), c.fileKey)
}

console.log(`${entram.length} clubes entram | ${recusados.length} recusados`)
for (const r of recusados) console.log(`   ! ${r}`)
console.log("\nPor UF e prestigio (e o que decide a vaga no estadual):")
const porUf = new Map()
for (const t of entram) {
  if (!porUf.has(t.pais)) porUf.set(t.pais, [])
  porUf.get(t.pais).push(`${t.nome} (${t.prestigio})`)
}
for (const [uf, l] of [...porUf].sort()) console.log(`   ${uf}: ${l.join(", ")}`)

if (!gravar) { console.log("\nEnsaio. Use --gravar para escrever no seed."); process.exit(0) }

const backup = `${arquivoSeed}.antes-clubes-novos`
if (!existsSync(backup)) copyFileSync(arquivoSeed, backup)
seed.teams.push(...entram)
seed.count = seed.teams.length
seed.clubesCriadosEm = "2026-08-15"
writeFileSync(arquivoSeed, JSON.stringify(seed), "utf-8")
console.log(`\nSeed gravado: ${seed.count} clubes (backup em ${path.basename(backup)})`)
