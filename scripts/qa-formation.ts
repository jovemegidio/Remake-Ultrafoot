// Prova o encaixe do elenco na formacao.
//
// BUG: cada tela posicionava os jogadores por INDICE do array:
//   players.map((player, index) => ({ x: formationData.positions[index]?.x }))
// O elenco vem ordenado por posicao (GOL, ZAG, ZAG, LD, LE, VOL, MEI...) e os slots do
// 4-3-3 sao (GOL, LD, ZAG, ZAG, LE, ...). No indice 1 o jogador e ZAGUEIRO e o slot e
// LATERAL-DIREITO. Cada um caia no buraco errado — "zagueiro marcado como goleiro,
// meio-campista como zagueiro". Em 3-5-2/5-3-2 piorava.
//
// Teste unitario (nao precisa do bundle): roda o assignPlayersToFormation contra TODAS as
// formacoes e exige que cada jogador caia num slot compativel com a posicao que ele joga.
//
// Uso: npx tsx scripts/qa-formation.ts

import {
  FORMATIONS,
  COMPATIBLE_POSITIONS,
  assignPlayersToFormation,
  normalizePosition,
} from "../lib/formations"

// Elenco tipico, na ordem em que sortByPosition entrega (GOL, ZAG, LD, LE, VOL, MEI, ...).
const SQUAD = [
  { id: 1, position: "GOL", name: "Goleiro" },
  { id: 2, position: "ZAG", name: "Zagueiro A" },
  { id: 3, position: "ZAG", name: "Zagueiro B" },
  { id: 4, position: "LD", name: "Lateral Dir" },
  { id: 5, position: "LE", name: "Lateral Esq" },
  { id: 6, position: "VOL", name: "Volante" },
  { id: 7, position: "MC", name: "Meia A" },
  { id: 8, position: "MEI", name: "Meia B" },
  { id: 9, position: "PD", name: "Ponta Dir" },
  { id: 10, position: "CA", name: "Centroavante" },
  { id: 11, position: "PE", name: "Ponta Esq" },
]

let failures = 0

for (const key of Object.keys(FORMATIONS)) {
  const assigned = assignPlayersToFormation(SQUAD, key)

  // 1) Ninguem pode ficar de fora, e ninguem entra duas vezes.
  if (assigned.length !== 11) {
    console.log(`XX ${key}: encaixou ${assigned.length} jogadores (esperado 11)`)
    failures++
  }
  const ids = new Set(assigned.map((p) => p.id))
  if (ids.size !== assigned.length) {
    console.log(`XX ${key}: jogador repetido em mais de um slot`)
    failures++
  }

  // 2) O GOL e inegociavel: so goleiro no gol.
  const gk = assigned.find((p) => p.slotPos === "GOL")
  if (gk && normalizePosition(gk.position) !== "GOL") {
    console.log(`XX ${key}: ${gk.name} (${gk.position}) escalado NO GOL`)
    failures++
  }

  // 3) Cada jogador precisa estar num slot igual ou compativel com a posicao dele.
  const wrong = assigned.filter(
    (p) => normalizePosition(p.position) !== p.slotPos && !COMPATIBLE_POSITIONS[p.slotPos]?.includes(normalizePosition(p.position)),
  )
  if (wrong.length) {
    for (const p of wrong) {
      console.log(`XX ${key}: ${p.name} (${p.position}) escalado no slot ${p.slotPos}`)
    }
    failures++
  }

  if (!wrong.length && assigned.length === 11 && gk?.position === "GOL") {
    const resumo = assigned.map((p) => `${p.slotPos}:${p.position}`).join(" ")
    console.log(`OK ${key.padEnd(8)} ${resumo}`)
  }
}

console.log(
  failures
    ? `\nRESULTADO: ${failures} problema(s) de encaixe`
    : "\nRESULTADO: OK — todo jogador num slot compativel, em todas as formacoes",
)
process.exit(failures ? 1 : 0)
