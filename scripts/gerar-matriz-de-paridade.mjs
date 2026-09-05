// MATRIZ DE PARIDADE — gerada do codigo, nunca escrita a mao.
//
// Por que ela existe: uma reforma visual que atravessa 74 telas precisa de um
// CONTRATO CONTRA PERDA. "Nao perdi nada" e afirmacao; esta tabela e medicao.
// Se uma tela sumir, ou perder botoes, ou deixar de ler o save, a proxima
// geracao mostra o numero caindo — e da para comparar duas versoes com `diff`.
//
// Cada coluna sai de algo verificavel no arquivo da tela:
//   Dados   — os hooks de estado/persistencia que ela importa
//   Acoes   — quantos elementos interativos ela declara
//   Tauri   — se ela fala com o backend (invoke/listen/plugin)
//   Destino — o que a reforma visual aplicou ali
//   Status  — o veredicto do portao `npm run qa:visual` na ultima corrida
//
// ⚠️ A coluna "Acoes" e uma CONTAGEM ESTATICA, e assumida como tal: ela conta
// tags no fonte, nao botoes na tela (um `.map()` de dez jogadores conta como
// um). Isso a torna inutil como numero absoluto e otima como numero
// COMPARAVEL — que e o uso: cair de 14 para 9 entre duas versoes e sinal de
// que alguem apagou algo.
//
// Uso:  node scripts/gerar-matriz-de-paridade.mjs [caminho-do-log-do-qa-visual]

import { readdirSync, readFileSync, statSync, writeFileSync, existsSync } from "node:fs"
import path from "node:path"

const RAIZ = process.cwd()
const LOG_VISUAL = process.argv[2] ?? "C:\\uf-visual-final4.log"
const SAIDA = path.join(RAIZ, "MATRIZ-DE-PARIDADE-VISUAL.md")

const SINAIS_DE_DADO = [
  ["useGameState", "save"],
  ["useGameEngine", "motor"],
  ["useGameManager", "calendario"],
  ["useUserTeam", "clube"],
  ["useNationalTeam", "selecao"],
  ["useTranslation", "i18n"],
  ["persistent-store", "disco"],
  ["save-system", "save"],
]
const TAURI = /@tauri-apps\/|invoke\(|listen\(|isTauri\(/
const INTERATIVO = /<(?:button|a\s|input|select|textarea|Link\b|LinkLeve\b)/gi

function rotas(base = path.join(RAIZ, "app"), prefixo = "") {
  const achadas = []
  for (const entrada of readdirSync(base, { withFileTypes: true })) {
    if (!entrada.isDirectory()) continue
    const dir = path.join(base, entrada.name)
    const rota = `${prefixo}/${entrada.name}`
    if (existsSync(path.join(dir, "page.tsx"))) achadas.push([rota, path.join(dir, "page.tsx")])
    achadas.push(...rotas(dir, rota))
  }
  if (prefixo === "" && existsSync(path.join(base, "page.tsx"))) {
    achadas.unshift(["/", path.join(base, "page.tsx")])
  }
  return achadas
}

function statusDoPortao() {
  const mapa = new Map()
  if (!existsSync(LOG_VISUAL)) return mapa
  const rotulo = { ok: "medida e aprovada", FALHOU: "REPROVADA", "?": "nao medida (redireciona)" }
  for (const linha of readFileSync(LOG_VISUAL, "utf-8").split("\n")) {
    const m = /^(ok|FALHOU|\?)\s+(\S+)\s/.exec(linha)
    if (m) mapa.set(m[2], rotulo[m[1]])
  }
  return mapa
}

const portao = statusDoPortao()
const linhas = []

for (const [rota, caminho] of rotas().sort((a, b) => a[0].localeCompare(b[0]))) {
  const texto = readFileSync(caminho, "utf-8")
  const dados = [...new Set(SINAIS_DE_DADO.filter(([c]) => texto.includes(c)).map(([, r]) => r))].sort()
  const destino = []
  if (texto.includes("uf-heading") || texto.includes("uf-title")) destino.push("titulo condensado")
  if (texto.includes("uf-veu")) destino.push("veu unificado")
  if (texto.includes("var(--uf-bg-")) destino.push("superficie tokenizada")
  if (texto.includes("bg-transparent") && /(?:min-)?h-(?:screen|dvh)/.test(texto)) destino.push("fundo atmosferico")

  linhas.push({
    rota,
    componente: path.relative(RAIZ, caminho).replace(/\\/g, "/"),
    dados: dados.join(", ") || "—",
    acoes: (texto.match(INTERATIVO) ?? []).length,
    tauri: TAURI.test(texto) ? "sim" : "—",
    destino: destino.join(", ") || "sem mudanca visual",
    status: portao.get(rota) ?? "fora do portao",
  })
}

const somaAcoes = linhas.reduce((s, l) => s + l.acoes, 0)
const aprovadas = linhas.filter(l => l.status === "medida e aprovada").length
const reprovadas = linhas.filter(l => l.status === "REPROVADA").length

const doc = [
  "# Matriz de paridade — reforma da camada visual",
  "",
  "Gerada por `node scripts/gerar-matriz-de-paridade.mjs`, a partir do codigo — nao",
  "escrita a mao. E o contrato contra perda de recurso: se uma tela sumir ou perder",
  "acoes, a proxima geracao mostra o numero caindo.",
  "",
  "A coluna **Acoes** conta tags interativas no FONTE, nao botoes na tela (um",
  "`.map()` de dez jogadores conta como um). Serve como numero comparavel entre",
  "versoes, nao como total absoluto.",
  "",
  `- telas: **${linhas.length}**`,
  `- acoes declaradas (soma): **${somaAcoes}**`,
  `- medidas e aprovadas pelo portao visual: **${aprovadas}**`,
  `- reprovadas: **${reprovadas}**`,
  "",
  "| Rota | Componente | Dados | Acoes | Tauri | Destino na nova UI | Status |",
  "| --- | --- | --- | ---: | :---: | --- | --- |",
  ...linhas.map(
    l =>
      `| \`${l.rota}\` | \`${l.componente}\` | ${l.dados} | ${l.acoes} | ${l.tauri} | ${l.destino} | ${l.status} |`,
  ),
  "",
].join("\r\n")

writeFileSync(SAIDA, doc, "utf-8")
console.log(`matriz gravada: ${SAIDA}`)
console.log(`  telas: ${linhas.length} | acoes: ${somaAcoes} | aprovadas: ${aprovadas} | reprovadas: ${reprovadas}`)
