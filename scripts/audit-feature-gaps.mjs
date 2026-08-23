import { readFile, writeFile, readdir } from "node:fs/promises"
import path from "node:path"

// ⚠️ ESTE GATE FICOU MORTO POR MESES. Ele chamava `rg` (ripgrep) via
// `execFileSync`, e em maquina sem ripgrep no PATH o script explodia com
// `spawnSync rg ENOENT` antes da primeira verificacao — o `npm run qa:features`
// "falhava" de um jeito que ninguem lia como reprovacao. Agora a varredura usa
// so a biblioteca padrao do Node: nao depende de binario externo nenhum.
async function listarArquivos(raiz) {
  const achados = []
  async function andar(dir) {
    let entradas
    try { entradas = await readdir(dir, { withFileTypes: true }) } catch { return }
    for (const entrada of entradas) {
      const alvo = path.join(dir, entrada.name)
      if (entrada.isDirectory()) {
        if (entrada.name === "node_modules" || entrada.name.startsWith(".")) continue
        await andar(alvo)
      } else if (/\.(ts|tsx)$/.test(entrada.name)) {
        achados.push(alvo.split(path.sep).join("/"))
      }
    }
  }
  await andar(raiz)
  return achados
}

const files = (await Promise.all(["app", "components", "lib"].map(listarArquivos))).flat()
const patterns = [
  { key: "notImplemented", regex: /not implemented|não implementad|nao implementad/gi },
  { key: "skeleton", regex: /\bskeleton\b|\besqueleto\b/gi },
  { key: "todo", regex: /\bTODO\s*:/g },
  { key: "mock", regex: /\bmock(?:ado|ados|ada|adas)?\b/gi },
]
const findings = []
for (const file of files) {
  const source = await readFile(file, "utf8")
  const lines = source.split(/\r?\n/)
  for (let index = 0; index < lines.length; index++) {
    for (const pattern of patterns) {
      pattern.regex.lastIndex = 0
      if (pattern.regex.test(lines[index])) findings.push({ type: pattern.key, file, line: index + 1, text: lines[index].trim().slice(0, 180) })
    }
  }
}
const activeThrows = findings.filter(item => item.type === "notImplemented" && item.text.includes("throw new Error"))
// A lista de isentos comparava caminho com barra invertida do Windows. A
// varredura agora normaliza tudo em barra normal, entao a comparacao tambem
// normaliza — senao as isencoes parariam de valer sem ninguem perceber.
const ISENTOS = new Set(["lib/phases-registry.ts", "components/ui/skeleton.tsx", "components/ui/sidebar.tsx"])
const isDocumentationOnly = item => {
  const text = item.text.trim()
  return text.startsWith("//") || text.startsWith("/*") || text.startsWith("*") ||
    ISENTOS.has(item.file.split(/[\\/]/).join("/"))
}
const actionable = findings.filter(item => !isDocumentationOnly(item))
const report = {
  generatedAt: new Date().toISOString(),
  scannedFiles: files.length,
  totals: Object.fromEntries(patterns.map(pattern => [pattern.key, findings.filter(item => item.type === pattern.key).length])),
  activeNotImplementedFunctions: activeThrows.length,
  actionableMarkers: actionable.length,
  documentationMarkers: findings.length - actionable.length,
  priorityFiles: [...new Set(activeThrows.map(item => item.file))],
  findings,
}
// ⚠️ Mesmo carimbo que barrava a CI de Linux/macOS nos manifestos de foto:
// reescrever o arquivo só para trocar `generatedAt` deixa a árvore suja
// depois de toda auditoria, e a CI de desktop recusa árvore suja.
const novoTexto = JSON.stringify(report, null, 2)
const anterior = await readFile("feature-audit.json", "utf8").catch(() => null)
const semCarimbo = texto => texto
  .replace(/\r\n/g, "\n")
  .replace(/"generatedAt": "[^"]*",\n/, "")
if (anterior !== null && semCarimbo(anterior) === semCarimbo(novoTexto)) {
  console.log("auditoria inalterada — carimbo preservado")
} else {
  await writeFile("feature-audit.json", novoTexto)
}
console.log(JSON.stringify({ scannedFiles: report.scannedFiles, ...report.totals, activeNotImplementedFunctions: activeThrows.length, actionableMarkers: report.actionableMarkers, documentationMarkers: report.documentationMarkers, priorityFiles: report.priorityFiles.length }))

// GATE DE VERDADE: antes isto so imprimia um resumo e saia 0 sempre — dava para
// ter funcao viva lancando "not implemented" com o gate "passando". Marcador em
// comentario segue sendo so relatorio; funcao que ESTOURA em producao, nao.
if (activeThrows.length > 0) {
  console.error(`\n${activeThrows.length} função(ões) ativa(s) lançando "not implemented":`)
  for (const item of activeThrows) console.error(`  - ${item.file}:${item.line}  ${item.text}`)
  process.exit(1)
}
if (files.length < 100) {
  console.error(`\nVarredura suspeita: só ${files.length} arquivos. O gate estaria passando por não ter olhado nada.`)
  process.exit(1)
}
