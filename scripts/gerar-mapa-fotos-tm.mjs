// Mapa GLOBAL de fotos do Transfermarkt: nome do atleta -> id da foto.
//
// O problema: o mapa de fotos do jogo (lib/player-photos) so olhava o overlay
// de elencos reais e o seed. Clubes CURADOS (Liverpool, Bayern...) sao servidos
// pelo overlay, que quase nao tem foto — o Liverpool aparecia com 1 foto em 22
// atletas, enquanto o cache do TM tem o elenco inteiro com retrato.
//
// Aqui achatamos o cache do TM (2.071 clubes, ~46 mil atletas) num unico mapa,
// que entra como mais uma fonte. Guardamos so o miolo do id ("371247-1780359299"),
// nao a URL — a URL e remontada em lib/player-photos.
//
//   node scripts/gerar-mapa-fotos-tm.mjs

import { readFile, writeFile } from "node:fs/promises"
import path from "node:path"

const TM = path.resolve("data/seeds/tm-squads.json")
const OUT = path.resolve("data/seeds/tm-photos.json")

// MESMA normalizacao de lib/player-photos (com hifen). Eu tinha removido os
// separadores e as chaves nao casavam com as do jogo — o mapa inteiro seria inutil.
const normalizePlayerKey = s => (s || "")
  .normalize("NFD").replace(/[̀-ͯ]/g, "")
  .toLowerCase().trim().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "")

async function main() {
  const tm = JSON.parse(await readFile(TM, "utf8"))
  const clubs = tm.clubs ?? tm
  // Homonimos: fica o de MAIOR valor de mercado (o mais provavel de ser o
  // atleta que o jogador esta vendo).
  const melhor = new Map()
  let total = 0
  for (const club of Object.values(clubs)) {
    for (const p of club?.players ?? []) {
      if (!p?.foto || !p?.nome) continue
      const m = /portrait\/\w+\/([\d-]+)\.jpg/.exec(p.foto)
      if (!m) continue
      const k = normalizePlayerKey(p.nome)
      if (!k) continue
      total++
      const atual = melhor.get(k)
      const valor = p.valor ?? 0
      if (!atual || valor > atual.valor) melhor.set(k, { ft: m[1], valor })
    }
  }
  const saida = {}
  for (const [k, v] of melhor) saida[k] = v.ft
  await writeFile(OUT, JSON.stringify(saida))
  console.log(`retratos no cache do TM : ${total}`)
  console.log(`nomes distintos no mapa : ${Object.keys(saida).length}`)
  console.log(`arquivo                 : ${OUT}`)
}

main().catch(e => { console.error(e); process.exit(1) })
