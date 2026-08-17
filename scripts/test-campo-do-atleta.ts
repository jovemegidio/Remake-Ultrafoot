// O GATE DO CAMPO DA PARTIDA VIVIDA (1.0.338).
//
// ⚠️ POR QUE ELE EXISTE. O campo do modo atleta desenha onze nomes REAIS de cada
// clube, tirados de `getPlayersForTeam`. Um `tsc` verde não diz nada sobre isso:
// se a fonte devolvesse lista vazia para um clube — coisa que já aconteceu neste
// projeto com clube de divisão baixa e com homônimo casado errado — a tela
// compilaria igual e mostraria um campo VAZIO, ou pior, dez bonecos.
//
// E há um segundo jeito de a tela mentir: o atleta do jogador não vem do seed
// (ele foi criado na tela de criação), então é preciso ENFIÁ-LO no XI. Se essa
// troca falhar, o dono da carreira assiste à própria partida sem se ver nela.
//
// Uso: npx tsx scripts/test-campo-do-atleta.ts

import { onzeDoClube, bolaDoMomento } from "../components/match/campo-do-atleta"
import { serieATeams } from "../lib/teams-data"

let falhas = 0
const erro = (m: string) => { console.log("FALHA: " + m); falhas++ }

// ── 1. Onze de verdade, em clubes de verdade ────────────────────────────────
// Uma amostra da Série A basta: se a fonte de elenco funciona para ela e não
// para uma liga menor, o problema é da fonte e aparece nos gates dela.
const amostra = serieATeams.slice(0, 8)
for (const clube of amostra) {
  const xi = onzeDoClube(clube.curto, false)
  if (xi.length !== 11) {
    erro(`${clube.nome} — o campo receberia ${xi.length} jogadores, nao 11`)
    continue
  }
  const semNome = xi.filter(p => !p.name.trim())
  if (semNome.length) erro(`${clube.nome} — ${semNome.length} jogador(es) sem nome`)
  const repetidos = xi.length - new Set(xi.map(p => p.name)).size
  if (repetidos) erro(`${clube.nome} — ${repetidos} nome(s) repetido(s) no mesmo XI`)
  const semOverall = xi.filter(p => !(p.rating > 0))
  if (semOverall.length) erro(`${clube.nome} — ${semOverall.length} jogador(es) com overall zerado`)
  const goleiros = xi.filter(p => p.position === "GOL").length
  if (goleiros !== 1) erro(`${clube.nome} — ${goleiros} goleiro(s) em campo`)
}
console.log(`onze conferido em ${amostra.length} clubes`)

// ── 2. Clube que nao existe nao pode explodir ───────────────────────────────
const inexistente = onzeDoClube("ZZZZ", false)
if (inexistente.length !== 0) erro(`clube inexistente devolveu ${inexistente.length} jogadores`)

// ── 3. A bola acompanha a narracao ──────────────────────────────────────────
// Se o momento diz "bola no seu pe no ultimo terco", ela nao pode ser desenhada
// no campo de defesa: encenacao que contradiz o texto e pior que texto sozinho.
const ataqueEmCasa = bolaDoMomento("ataque", true)
if (ataqueEmCasa.x <= 50) erro(`ataque em casa deveria estar no campo de ataque, veio x=${ataqueEmCasa.x}`)
const ataqueFora = bolaDoMomento("ataque", false)
if (ataqueFora.x >= 50) erro(`ataque fora deveria espelhar o campo, veio x=${ataqueFora.x}`)
const defesaEmCasa = bolaDoMomento("defesa", true)
if (defesaEmCasa.x >= 50) erro(`defesa em casa deveria estar no proprio campo, veio x=${defesaEmCasa.x}`)
if (defesaEmCasa.side !== "away") erro(`na defesa a posse e do adversario, veio side=${defesaEmCasa.side}`)
for (const t of ["ataque", "criacao", "defesa", "bola_parada", "entrada", "fim"] as const) {
  const b = bolaDoMomento(t, true)
  if (b.x < 0 || b.x > 100 || b.y < 0 || b.y > 100) erro(`momento "${t}" pos fora do campo (${b.x},${b.y})`)
}
console.log("bola conferida nos 6 tipos de momento")

console.log(falhas === 0
  ? "\nCAMPO OK — onze nomes reais dos dois lados e bola coerente com o lance."
  : `\n${falhas} problema(s) no campo do atleta.`)
process.exit(falhas === 0 ? 0 : 1)
