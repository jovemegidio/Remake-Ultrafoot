import { allTeams } from "../lib/teams-data"
import rp from "../data/seeds/real-positions.json"

function norm(s: string) { return (s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "") }
function clubKey(s: string) { return norm(s).replace(/^(fc|cf|ac|as|rc|sc|ss|afc|rcd|ud|cd|sv|ogc|losc|stade)/, "").replace(/(fc|cf|cfc|ac|sc|afc|club)$/, "").replace(/^olympiquede/, "olympique") }

const rpAny = rp as Record<string, unknown[]>
const names = ["1. FC Kaiserslautern", "Hertha BSC", "1. FC Magdeburg", "SpVgg Greuther Furth"]
for (const n of names) {
  const t = allTeams.find((x) => x.nome === n)
  const k = t ? clubKey(t.nome) : "(nao no allTeams)"
  console.log(`${n}  -> clubKey=${k} | real-positions[${k}]? ${rpAny[k] ? "SIM " + rpAny[k].length : "NAO"} | file_key=${t?.file_key}`)
}
console.log("chaves real-positions com kaiser/hertha/magde/greuther/furth:")
console.log("  " + Object.keys(rpAny).filter((k) => /kaiser|hertha|magde|greuther|furth/.test(k)).join(", "))
