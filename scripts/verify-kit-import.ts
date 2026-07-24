// Confirma que times casados resolvem para o kit importado (sts_*), nao pro
// fallback generico. Amostra por liga.
import { getCamisaUrl } from "../lib/teams-data"

const amostra = [
  ["barcelona_sc", "Barcelona SC", "Barcelona SC"],       // Equador (liga nova)
  ["ldu_quito", "LDU Quito", "LDU Quito"],
  ["racing_ury", "Racing Club Uruguai", "Racing Club Uruguai"],
  ["fc_tokyo", "FC Tokyo", "FC Tokyo"],
  ["millonarios", "Millonarios", "Millonarios"],
  ["flamengo", "Flamengo", "Flamengo"],
]
let ok = 0
for (const [fk, nome] of amostra) {
  const home = getCamisaUrl(fk, "home", nome)
  const usaImportado = /kits-imported\/sts_/.test(home) || /kits-imported\//.test(home)
  console.log(`${usaImportado ? "OK " : "-- "} ${fk.padEnd(20)} ${home}`)
  if (usaImportado) ok++
}
console.log(`\n${ok}/${amostra.length} usando kit importado`)
