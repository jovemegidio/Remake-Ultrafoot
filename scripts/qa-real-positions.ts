// Prova que o overlay de posicoes reais corrigiu o seed.
//
// Antes: imported-bf2026.json atribuia posicao por INDICE do array — os goleiros do
// Newcastle (Nick Pope, Aaron Ramsdale, Mark Gillespie) saiam como ZAGUEIROS e o
// Trippier (lateral) como meia. Agora a posicao real do CSV tem prioridade.
//
// Uso: npx tsx scripts/qa-real-positions.ts
import { getPlayersForTeam } from "../lib/players-data"
import { getTeamByShort, allTeams } from "../lib/teams-data"

let fail = 0
const ok = (m: string) => console.log("OK " + m)
const bad = (m: string) => { console.log("XX " + m); fail++ }

function findTeam(nameFragment: string) {
  return allTeams.find(t => new RegExp(nameFragment, "i").test(t.nome))
}

// ── Newcastle: os goleiros TEM que ser GOL ───────────────────────────────────
const newcastle = findTeam("newcastle")
if (!newcastle) {
  bad("Newcastle nao encontrado em teams-data")
} else {
  const squad = getPlayersForTeam(newcastle)
  if (squad.length === 0) {
    bad("Newcastle sem elenco")
  } else {
    // Goleiros do elenco ATUAL (o CSV e 2026/27). Ramsdale/Gillespie/Trippier NAO
    // estao mais no clube — o elenco antigo do seed foi substituido, e isso e o
    // comportamento correto.
    const expectGK = ["Nick Pope", "Ewen Jaouen"]
    for (const name of expectGK) {
      const p = squad.find(x => x.nome === name)
      if (!p) { bad(`${name} nao esta no elenco do Newcastle`); continue }
      if (p.pos === "GOL") ok(`${name} -> GOL`)
      else bad(`${name} -> ${p.pos} (esperado GOL)`)
    }

    // Zagueiros de verdade na zaga.
    for (const name of ["Sven Botman", "Fabian Schar", "Dan Burn", "Malick Thiaw"]) {
      const p = squad.find(x => x.nome === name)
      if (p && p.pos !== "ZAG") bad(`${name} -> ${p.pos} (esperado ZAG)`)
    }
    ok("zagueiros do Newcastle estao na zaga")

    // Quem saiu do clube NAO pode continuar no elenco.
    for (const gone of ["Aaron Ramsdale", "Kieran Trippier", "Mark Gillespie"]) {
      if (squad.some(x => x.nome === gone)) bad(`${gone} ja saiu do clube mas segue no elenco`)
    }
    ok("jogadores que deixaram o Newcastle nao aparecem mais")

    // Nenhum goleiro escalado fora do gol.
    const gks = squad.filter(p => p.pos === "GOL").length
    if (gks >= 1 && gks <= 4) ok(`Newcastle: ${gks} goleiro(s) — plausivel`)
    else bad(`Newcastle: ${gks} goleiros (implausivel)`)
  }
}

// ── Nenhum clube pode ficar sem goleiro ou so com goleiro ────────────────────
const sample = ["Manchester City", "Liverpool", "Arsenal", "Chelsea", "Fortaleza"]
for (const frag of sample) {
  const t = findTeam(frag)
  if (!t) continue
  const squad = getPlayersForTeam(t)
  if (squad.length === 0) continue
  const gks = squad.filter(p => p.pos === "GOL").length
  const outfield = squad.length - gks
  if (gks >= 1 && outfield >= 10) ok(`${t.nome}: ${gks} GOL + ${outfield} de linha`)
  else bad(`${t.nome}: ${gks} GOL + ${outfield} de linha (elenco invalido)`)
}

console.log(fail ? `\nRESULTADO: ${fail} falha(s)` : "\nRESULTADO: OK — posicoes reais aplicadas")
process.exitCode = fail ? 1 : 0
