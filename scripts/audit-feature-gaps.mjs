import { readFile, writeFile } from "node:fs/promises"
import { execFileSync } from "node:child_process"

const files = execFileSync("rg", ["--files", "app", "components", "lib"], { encoding: "utf8" })
  .trim().split(/\r?\n/).filter(file => /\.(ts|tsx)$/.test(file))
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
const isDocumentationOnly = item => {
  const text = item.text.trim()
  return text.startsWith("//") || text.startsWith("/*") || text.startsWith("*") ||
    item.file === "lib\\phases-registry.ts" || item.file === "components\\ui\\skeleton.tsx" ||
    item.file === "components\\ui\\sidebar.tsx"
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
await writeFile("feature-audit.json", JSON.stringify(report, null, 2))
console.log(JSON.stringify({ scannedFiles: report.scannedFiles, ...report.totals, activeNotImplementedFunctions: activeThrows.length, actionableMarkers: report.actionableMarkers, documentationMarkers: report.documentationMarkers, priorityFiles: report.priorityFiles.length }))
