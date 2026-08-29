// O PORTAO CONTRA ROTA CASCA E DADO FALSO (1.0.380).
//
//   node scripts/qa-sem-casca.mjs
//   node scripts/qa-sem-casca.mjs --detalhe
//
// ⚠️ ELE NAO AUDITA POR COMENTARIO, E ESSA E A DIFERENCA. O `audit-feature-gaps`
// procura as palavras "skeleton"/"mock" no texto — e nesta sessao provou-se que
// o rotulo mente nos DOIS sentidos: seis modulos completos se declaravam
// esqueleto, e nenhum dos que se declaravam prontos era conferido. Aqui a
// pergunta e outra: a rota LE dado do jogo, ou desenha casca?
//
// ⚠️ AS QUATRO ISENCOES SAO PADRAO LEGITIMO DESTE PROJETO, e sem elas a
// auditoria acusa 25 rotas sem que UMA seja casca (medido em 29/08/2026):
//
//   1. REEXPORTACAO de compatibilidade — `export { default } from "@/app/..."`.
//      `/clube` e `/editor` existem so para nao quebrar atalho antigo.
//   2. REDIRECIONAMENTO — `redirect()` ou `hardNavigate()`. `/sem-clube` leva a
//      Area do Treinador; `/multiplayer-local` leva ao FC Hub, com a explicacao
//      de por que os modos locais sairam.
//   3. DELEGACAO a componente — a pagina e fina de proposito e o estado mora em
//      `components/`. `/rankings` e assim, e nao e menos completa por isso.
//   4. `placeholder=` e `placeholder:` — atributo de `<input>` e classe CSS, nao
//      texto de espera.
//
// O que ele REPROVA: rota que nao le estado nem delega, nao redireciona, nao
// reexporta, e ainda assim se propoe a ser uma tela do jogo. Ou seja: casca
// nova, do tipo que entra no menu e frustra quem clica.

import { readFileSync, readdirSync, statSync } from "node:fs"
import path from "node:path"

const detalhe = process.argv.includes("--detalhe")

function paginas(dir, achadas = []) {
  for (const e of readdirSync(dir)) {
    const p = path.join(dir, e)
    if (statSync(p).isDirectory()) paginas(p, achadas)
    else if (e === "page.tsx") achadas.push(p)
  }
  return achadas
}

const FONTES_DE_ESTADO = /@\/lib\/(save-system|game-engine|use-game-manager|persistent-store|game-state|teams-data|players-data|career-|carreira-|modalidade-)/
// Texto de espera de verdade. `placeholder` fica FORA: no HTML ele e atributo.
// ⚠️ "em construcao" NAO entra aqui: em jogo de futebol e o contador de OBRAS
// do estadio (`/infraestrutura`, "Em Construcao: 3"). So conta quando
// qualifica a TELA — "tela em construcao", "pagina em construcao".
const ESPERA = /((tela|p[aá]gina|se[cç][aã]o) em constru[cç]|dispon[ií]vel em breve|ainda n[aã]o est[aá] dispon|ser[aá] implementad|coming soon|n[aã]o implementad[oa])/i
const MARCA_FALSA = /\b(MOCK_|FAKE_|DUMMY_|dadosDeExemplo|dadosFicticios|mockData|fakeData)\b/
const NOMES_INVENTADOS = /"(João Silva|Jose Silva|Fulano|Ciclano|Beltrano|Player \d|Jogador \d|Time [ABC]|Team [ABC])"/

const todas = paginas("app")
const problemas = []
const isentas = []

for (const p of todas) {
  const src = readFileSync(p, "utf8")
  const n = src.split(/\r?\n/).length
  const rota = "/" + path.relative("app", path.dirname(p)).split(path.sep).join("/")

  // ── As quatro isencoes ──────────────────────────────────────────────────
  if (/export\s*\{\s*default\s*\}\s*from/.test(src)) { isentas.push([rota, "reexportacao"]); continue }
  // ⚠️ SO E REDIRECIONAMENTO SE FOR ISSO QUE A ROTA FAZ. A primeira versao
  // isentava qualquer arquivo que citasse `hardNavigate` — e ele aparece em
  // quase toda tela como navegacao normal, entao ate a `/` ficava isenta.
  // Uma casca com um botao de navegar passaria batida. Rota-ponte e curta e
  // nao tem mais nada dentro.
  const soRedireciona = n < 60 && /redirect\(|hardNavigate\(/.test(src)
  if (soRedireciona) { isentas.push([rota, "redirecionamento"]); continue }

  const delega = /from\s+"@\/components\//.test(src)
  const leEstado = FONTES_DE_ESTADO.test(src)
  const temMapa = /\.map\(/.test(src)

  const sinais = []
  if (!leEstado && !delega) sinais.push("nao le estado do jogo nem delega a componente")
  if (!temMapa && !delega && n < 120) sinais.push("so texto fixo, sem componente")

  const espera = (src.match(ESPERA) ?? [])[0]
  if (espera) sinais.push(`promete o que nao entrega: "${espera}"`)
  const falsa = (src.match(MARCA_FALSA) ?? [])[0]
  if (falsa) sinais.push(`dado falso: ${falsa}`)
  const inventado = (src.match(NOMES_INVENTADOS) ?? [])[0]
  if (inventado) sinais.push(`nome inventado: ${inventado}`)

  if (sinais.length) problemas.push({ rota, arquivo: p, n, sinais })
}

console.log(`\n  rotas auditadas ....... ${todas.length}`)
console.log(`  isentas ............... ${isentas.length}  (reexportacao ou redirecionamento)`)
console.log(`  com sinal de casca .... ${problemas.length}`)

if (detalhe && isentas.length) {
  console.log("\n  isentas:")
  for (const [r, motivo] of isentas) console.log(`    ${r.padEnd(28)} ${motivo}`)
}

for (const p of problemas) {
  console.log(`\n  ${p.rota}  (${p.arquivo}, ${p.n} linhas)`)
  for (const s of p.sinais) console.log(`    · ${s}`)
}

console.log(problemas.length === 0
  ? "\nSEM CASCA — toda rota le dado do jogo, delega a componente ou redireciona.\n"
  : `\n${problemas.length} rota(s) casca: entram no menu e frustram quem clica.\n`)
process.exit(problemas.length === 0 ? 0 : 1)
