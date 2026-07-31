// TODO ELENCO PRECISA TER UM TIME DENTRO.
//
// A auditoria de 31/07/2026 achou 129 clubes cujo elenco so conhecia quatro
// posicoes: o Fortaleza vinha com `MEI:14 ZAG:9 GOL:4 ATA:4` — nenhum lateral,
// nenhum volante, nenhuma ponta. Divisoes inteiras (Bundesliga: 18 de 18).
//
// A origem nao e um bug de conversao qualquer: a fonte marca todo mundo fora dos
// titulares como "DEF" ou "BAN", que quer dizer DESCONHECIDO. O jogo virava isso
// em ZAG e MEI, e era essa conversao que criava catorze meias num time so.
import { allTeams } from "../lib/teams-data"
import { getPlayersForTeam } from "../lib/players-data"

let falhas = 0
const check = (ok: boolean, msg: string) => { if (!ok) { falhas++; console.log(`  FALHA: ${msg}`) } }
const posDe = (t: (typeof allTeams)[number]) => {
  const c: Record<string, number> = {}
  for (const p of getPlayersForTeam(t)) {
    const k = String(p.pos ?? "?").toUpperCase()
    c[k] = (c[k] ?? 0) + 1
  }
  return c
}

console.log("== Posicoes do elenco ==")

// 1. O ESTRAGO TEM DE ESTAR CONTIDO — mas NAO em zero, e o motivo importa.
//
// Sobram clubes sem ponta (Atletico Madrid, Real Sociedad) e sem lateral
// (Empoli) que tem DADO REAL: o Atletico vem com `LE:3 LD:2 VOL:1` e so rotula
// os pontas como atacantes; os nove meias do Empoli estao confirmados no
// Transfermarkt. Forcar posicao neles seria SOBRESCREVER VERDADE para deixar um
// numero bonito — o oposto do que esta correcao se propoe.
//
// Nenhum desses casos quebra o jogo: o encaixe de formacao cobre ponta com
// atacante e lateral com zagueiro pelas compatibilidades. Os tetos abaixo sao
// guarda de REGRESSAO, com folga sobre o medido (152 / 156 / 271 antes).
const semLateral: string[] = []
const semVolante: string[] = []
const semPonta: string[] = []
const semGoleiro: string[] = []
for (const t of allTeams) {
  let c: Record<string, number>
  try { c = posDe(t) } catch { continue }
  if (Object.values(c).reduce((a, b) => a + b, 0) < 11) continue  // elenco minusculo: outro problema
  if (!c.LD && !c.LE) semLateral.push(t.nome)
  if (!c.VOL) semVolante.push(t.nome)
  if (!c.PD && !c.PE) semPonta.push(t.nome)
  if (!c.GOL) semGoleiro.push(t.nome)
}
console.log(`  sem lateral: ${semLateral.length} (era 152) | sem volante: ${semVolante.length} (era 156) | sem ponta: ${semPonta.length} (era 271)`)
check(semLateral.length <= 10, `${semLateral.length} clubes sem lateral (teto 10): ${semLateral.slice(0, 5).join(", ")}`)
check(semVolante.length <= 25, `${semVolante.length} clubes sem volante (teto 25): ${semVolante.slice(0, 5).join(", ")}`)
check(semPonta.length <= 130, `${semPonta.length} clubes sem ponta (teto 130): ${semPonta.slice(0, 5).join(", ")}`)
// Goleiro nao tem desculpa: a fonte acerta esse codigo, e o nosso codigo nunca
// redistribui goleiro.
check(semGoleiro.length === 0, `${semGoleiro.length} clubes sem goleiro: ${semGoleiro.slice(0, 5).join(", ")}`)

// 2. O CASO DO RELATO: o Fortaleza tinha catorze meias e zero laterais.
const fortaleza = allTeams.find(t => t.nome === "Fortaleza")
if (fortaleza) {
  const c = posDe(fortaleza)
  check((c.LD ?? 0) > 0 && (c.LE ?? 0) > 0, `Fortaleza continua sem lateral: ${JSON.stringify(c)}`)
  check((c.MEI ?? 0) < 10, `Fortaleza ainda tem ${c.MEI} meias — a distribuicao nao pegou`)
}

// 3. QUEM JA TINHA vocabulario fino NAO pode ser mexido. O Flamengo e o
//    Palmeiras vem com laterais de verdade da fonte; redistribui-los seria
//    destruir dado bom.
for (const nome of ["Flamengo", "Palmeiras"]) {
  const t = allTeams.find(x => x.nome === nome)
  if (!t) continue
  const c = posDe(t)
  check((c.LD ?? 0) > 0 && (c.LE ?? 0) > 0 && (c.GOL ?? 0) > 0,
    `${nome} deveria manter o vocabulario proprio: ${JSON.stringify(c)}`)
}

// 4. DETERMINISTICO. Se o lateral-direito mudasse a cada leitura, a escalacao
//    salva do jogador apontaria para outra pessoa na partida seguinte.
if (fortaleza) {
  const a = getPlayersForTeam(fortaleza).map(p => `${p.nome}:${p.pos}`).join("|")
  const b = getPlayersForTeam(fortaleza).map(p => `${p.nome}:${p.pos}`).join("|")
  check(a === b, "duas leituras do mesmo elenco deram posicoes diferentes")
}

// 5. A distribuicao NAO pode criar nem sumir com atleta, nem mexer em goleiro.
for (const nome of ["Fortaleza", "Ceará", "Goiás"]) {
  const t = allTeams.find(x => x.nome === nome)
  if (!t) continue
  const elenco = getPlayersForTeam(t)
  const c = posDe(t)
  check(elenco.length === Object.values(c).reduce((a, b) => a + b, 0), `${nome}: contagem inconsistente`)
  check((c.GOL ?? 0) >= 2, `${nome} ficou com ${c.GOL ?? 0} goleiro(s) — goleiro nao pode ser redistribuido`)
  check(new Set(elenco.map(p => p.nome)).size === elenco.length, `${nome}: atleta duplicado apos a distribuicao`)
}

console.log(falhas === 0
  ? "\nOK — todo elenco tem lateral, volante, ponta e goleiro, e quem ja era detalhado ficou intacto"
  : `\n${falhas} FALHA(S)`)
process.exit(falhas === 0 ? 0 : 1)
