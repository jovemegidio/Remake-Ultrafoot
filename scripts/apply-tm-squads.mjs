// Assa os dados do Transfermarkt (tm-squads.json) dentro do seed principal.
//
// Por que assar no seed em vez de consultar em runtime: o seed já é a fonte de
// verdade de TODA tela (elenco, mercado, partida, olheiros). Corrigindo lá, as
// telas herdam a posição e a nacionalidade certas sem nenhuma delas precisar
// saber que o Transfermarkt existe — e sem carregar um segundo JSON no bundle.
//
//   node scripts/import-tm-squads.mjs   (baixa; ~2h, retomável)
//   node scripts/apply-tm-squads.mjs    (aplica; segundos)
//
// Idempotente: rodar duas vezes dá o mesmo resultado.

import { readFile, writeFile, copyFile } from "node:fs/promises"
import { existsSync } from "node:fs"
import path from "node:path"

const SEED = path.resolve("data/seeds/imported-bf2026.json")
const TM = path.resolve("data/seeds/tm-squads.json")
const BACKUP = path.resolve("data/seeds/imported-bf2026.pre-tm.json")

const nameKey = s => (s || "")
  .normalize("NFD").replace(/[̀-ͯ]/g, "")
  .toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()

/**
 * Só nome IDÊNTICO dentro do mesmo clube. O casamento por sobrenome, que eu
 * tinha antes, rendia +15% de acertos e não vale o risco: se o clube tiver sido
 * casado errado lá no importador, "Silva" bate com "Silva" e a gente escreve a
 * posição de um atleta em cima de outro — que é justamente o defeito que este
 * trabalho existe para corrigir.
 */
function buildIndex(players) {
  const exato = new Map()
  for (const p of players) {
    const k = nameKey(p.nome)
    if (k && !exato.has(k)) exato.set(k, p)
  }
  return exato
}

/**
 * Quanto do elenco do seed aparece no elenco do TM.
 *
 * É a validação mais útil que existe aqui, porque usa dado que já temos: se o
 * importador casou o clube errado, os nomes simplesmente não se encontram.
 * "Barcelona Guayaquil" recebeu o FC Barcelona da Espanha e ficou com 0% de
 * sobreposição; "Fortuna Sittard" recebeu o Fortuna Düsseldorf, idem. Abaixo do
 * piso, ignoramos o clube inteiro em vez de confiar em coincidência de nome.
 */
// 5% e no MÍNIMO 2 atletas casados. Medi 20/10/5/2/0%: descer de 20% para 5%
// recupera 268 clubes e 722 atletas, e abaixo de 5% não há mais ganho nenhum —
// quem limita é a regra dos 2. E é ela a proteção que importa: um clube casado
// errado pode colidir em UM nome por acaso, dificilmente em dois.
//
// O piso alto de 20% estava jogando fora correção boa: Fénix, Orense, Sturm
// Graz e Cercle Brugge foram casados CERTO; a sobreposição é baixa porque o
// elenco no seed é fictício, não porque o clube esteja errado.
const PISO_SOBREPOSICAO = 0.05
const MIN_CASADOS = 2

function sobreposicao(jogadores, idx) {
  if (!jogadores?.length) return { pct: 0, hit: 0 }
  let hit = 0
  for (const j of jogadores) if (idx.has(nameKey(j.nome))) hit++
  return { pct: hit / jogadores.length, hit }
}

async function main() {
  if (!existsSync(TM)) {
    console.error("Falta data/seeds/tm-squads.json — rode antes: node scripts/import-tm-squads.mjs")
    process.exit(1)
  }
  const tm = JSON.parse(await readFile(TM, "utf8"))
  const seed = JSON.parse(await readFile(SEED, "utf8"))

  if (!existsSync(BACKUP)) await copyFile(SEED, BACKUP)

  let clubesComDados = 0, clubesRejeitados = 0, atletas = 0
  let posCorrigida = 0, nacDefinida = 0, semMatch = 0
  const mudancasPos = []
  const rejeitados = []

  for (const team of seed.teams ?? []) {
    const club = tm.clubs?.[`${team.curto}|${nameKey(team.nome)}`]
    if (!club?.players?.length) continue
    const idx = buildIndex(club.players)

    const { pct, hit } = sobreposicao(team.jogadores, idx)
    if (pct < PISO_SOBREPOSICAO || hit < MIN_CASADOS) {
      clubesRejeitados++
      rejeitados.push(`${team.nome} (${(pct * 100).toFixed(0)}%, ${hit} casados) <- ${club.url?.split("/")[3] ?? "?"}`)
      continue
    }
    clubesComDados++

    for (const jog of team.jogadores ?? []) {
      atletas++
      const real = idx.get(nameKey(jog.nome))
      if (!real) { semMatch++; continue }

      if (real.posicao && real.posicao !== jog.posicao) {
        mudancasPos.push(`${team.curto} ${jog.nome}: ${jog.posicao} -> ${real.posicao}`)
        jog.posicao = real.posicao
        posCorrigida++
      }
      if (real.nacionalidade && jog.nac !== real.nacionalidade) {
        jog.nac = real.nacionalidade
        nacDefinida++
      }
    }
  }

  seed.tmAppliedAt = new Date().toISOString()
  await writeFile(SEED, JSON.stringify(seed))

  console.log(`clubes aceitos          : ${clubesComDados}`)
  console.log(`clubes REJEITADOS       : ${clubesRejeitados} (sobreposição < ${PISO_SOBREPOSICAO * 100}%: clube provavelmente casado errado)`)
  console.log(`atletas nos aceitos     : ${atletas}`)
  console.log(`  posição corrigida     : ${posCorrigida}`)
  console.log(`  nacionalidade real    : ${nacDefinida}`)
  console.log(`  sem correspondência   : ${semMatch} (mantêm o que já tinham)`)
  console.log(`\nbackup do original: ${path.basename(BACKUP)}`)
  console.log(`\namostra de clubes rejeitados:`)
  for (const r of rejeitados.slice(0, 12)) console.log("  " + r)
  console.log(`\namostra de correções de posição:`)
  for (const m of mudancasPos.slice(0, 20)) console.log("  " + m)
}

main()
