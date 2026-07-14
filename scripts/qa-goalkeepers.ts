// Prova que o XI titular tem no maximo 1 goleiro (bug: elenco com 3 GK escalava os 3).
import { capGoalkeepers } from "../lib/formations"

const squad = [
  { nome: "Aranha", pos: "GOL" }, { nome: "Carlos Miguel", pos: "GOL" }, { nome: "Marcelo Lomba", pos: "GOL" },
  { nome: "ZagA", pos: "ZAG" }, { nome: "ZagB", pos: "ZAG" }, { nome: "LatD", pos: "LD" }, { nome: "LatE", pos: "LE" },
  { nome: "Vol", pos: "VOL" }, { nome: "MeiA", pos: "MEI" }, { nome: "MeiB", pos: "MEI" },
  { nome: "Pd", pos: "PD" }, { nome: "Ata", pos: "ATA" }, { nome: "Pe", pos: "PE" },
]
const ordered = capGoalkeepers(squad, p => p.pos)
const xi = ordered.slice(0, 11)
const gkInXI = xi.filter(p => p.pos === "GOL").length
console.log("XI:", xi.map(p => `${p.pos}:${p.nome}`).join(" "))
console.log("goleiros no XI:", gkInXI)
console.log("banco:", ordered.slice(11).map(p => p.nome).join(", "))
if (gkInXI === 1) { console.log("\nOK — 1 goleiro no XI titular"); process.exit(0) }
console.log(`\nXX — ${gkInXI} goleiros no XI`); process.exit(1)
