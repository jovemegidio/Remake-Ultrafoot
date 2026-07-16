import { existsSync } from "node:fs"
import path from "node:path"
import { allTeams } from "../lib/teams-data"

const CAMISAS = path.resolve("public/camisas")

let comCamisa = 0
const semCamisa: string[] = []
for (const t of allTeams) {
  if (/ II$/.test(t.nome)) continue
  if (existsSync(path.join(CAMISAS, t.file_key + ".png"))) comCamisa++
  else semCamisa.push(`${t.nome} (${t.file_key})`)
}
console.log(`times: ${allTeams.length} | com camisa home: ${comCamisa} | SEM: ${semCamisa.length}`)
console.log("amostra sem camisa (30):")
console.log("  " + semCamisa.slice(0, 30).join(" | "))
