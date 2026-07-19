import { readdir, access, readFile, stat } from "node:fs/promises"
import path from "node:path"

async function countFiles(directory) {
  let total = 0
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const target = path.join(directory, entry.name)
    total += entry.isDirectory() ? await countFiles(target) : 1
  }
  return total
}

const requirements = [
  ["public/kits-imported", 3000, "uniformes"],
  ["public/jogadores", 100, "fotos de jogadores"],
  ["public/escudos", 100, "escudos"],
  ["public/audio/commentary", 1, "narração"],
]

let failed = false
for (const [directory, minimum, label] of requirements) {
  try {
    await access(directory)
    const count = await countFiles(directory)
    console.log(`${label}: ${count}`)
    if (count < minimum) {
      console.error(`ERRO: ${label} incompletos; mínimo esperado ${minimum}`)
      failed = true
    }
  } catch {
    console.error(`ERRO: diretório obrigatório ausente: ${directory}`)
    failed = true
  }
}

try {
  const config = JSON.parse(await readFile("src-tauri/tauri.conf.json", "utf8"))
  const runtime = "src-tauri/resources/prerequisites/vc_redist.x64.exe"
  const runtimeSize = (await stat(runtime)).size
  const hook = config?.bundle?.windows?.nsis?.installerHooks
  const resourceConfigured = Object.keys(config?.bundle?.resources ?? {}).some(key => key.endsWith("vc_redist.x64.exe"))
  if (runtimeSize < 10_000_000 || !hook || !resourceConfigured) throw new Error("runtime ou hook ausente")
  await access(path.resolve("src-tauri", hook.replace(/^\.\//, "")))
  console.log(`Visual C++ Runtime: ${(runtimeSize / 1024 / 1024).toFixed(1)} MB, hook NSIS configurado`)
} catch (error) {
  console.error(`ERRO: pré-requisito Visual C++ inválido: ${error instanceof Error ? error.message : error}`)
  failed = true
}

if (failed) process.exit(1)
console.log("OK: recursos mínimos presentes para empacotamento")
