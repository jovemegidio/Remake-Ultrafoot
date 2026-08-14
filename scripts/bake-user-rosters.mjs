// ASSA NO BUILD OS ELENCOS EDITADOS (atletas criados, removidos e transferidos).
//
// Irmao de bake-user-logos / bake-user-kits, e existe pelo MESMO motivo que
// aqueles: o editor grava no save local (`ultrafoot-clubs.json`), e o que fica
// so ali nunca chega a quem instala o jogo. Sem esta etapa, criar um atleta no
// editor funcionaria para quem editou e sumiria na atualizacao seguinte —
// exatamente o defeito dos uniformes que nao persistiam (07/08/2026).
//
// Fonte: as chaves `ultrafoot:roster-override:*` do save vivo.
// Destino: data/seeds/roster-overrides.json, que viaja no instalador.
//
// ⚠️ NO SAVE O VALOR E UMA STRING JSON, nao um objeto — `storeSet` grava
// `JSON.stringify(patch)`. Sem o parse, o laco pula tudo em silencio.
//
// Uso: node scripts/bake-user-rosters.mjs   (roda sozinho no prebuild)

import { readFile, writeFile } from "node:fs/promises"
import path from "node:path"
import os from "node:os"

const SAVE = path.join(
  process.env.APPDATA || path.join(os.homedir(), "AppData/Roaming"),
  "com.ultrafoot.remake",
  "ultrafoot-clubs.json",
)
const SEED = path.resolve("data/seeds/roster-overrides.json")
const PREFIXO = "ultrafoot:roster-override:"

const norm = (nome) =>
  (nome ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "")

const lerJson = async (p) => {
  try { return JSON.parse(await readFile(p, "utf8")) } catch { return null }
}

async function main() {
  const save = (await lerJson(SAVE)) ?? {}
  const seed = (await lerJson(SEED)) ?? {}

  const vivo = {}
  for (const [chave, valor] of Object.entries(save)) {
    if (!chave.startsWith(PREFIXO)) continue
    let patch = valor
    if (typeof patch === "string") {
      try { patch = JSON.parse(patch) } catch { continue }
    }
    if (patch && typeof patch === "object") vivo[chave.slice(PREFIXO.length)] = patch
  }

  if (Object.keys(vivo).length === 0) {
    console.log("elencos editados: nenhum no save local (ok).")
    return
  }

  let clubes = 0
  for (const [fileKey, patch] of Object.entries(vivo)) {
    // Mesma regra do runtime (lib/roster-overrides.juntar): a remocao vence a
    // criacao do mesmo nome. Sem isso o "removido" voltaria a cada build.
    const removidos = [...new Set([...(seed[fileKey]?.removidos ?? []), ...(patch.removidos ?? [])])]
    const fora = new Set(removidos)
    const porNome = new Map()
    for (const a of [...(seed[fileKey]?.criados ?? []), ...(patch.criados ?? [])]) {
      if (!a?.nome || fora.has(norm(a.nome))) continue
      porNome.set(norm(a.nome), a)
    }
    const criados = [...porNome.values()]
    if (criados.length === 0 && removidos.length === 0) {
      delete seed[fileKey]
      continue
    }
    seed[fileKey] = { criados, removidos }
    clubes++
  }

  await writeFile(SEED, JSON.stringify(seed, null, 2), "utf8")
  const totalCriados = Object.values(seed).reduce((n, p) => n + (p.criados?.length ?? 0), 0)
  const totalRemovidos = Object.values(seed).reduce((n, p) => n + (p.removidos?.length ?? 0), 0)
  console.log(
    `elencos editados embutidos: ${clubes} clube(s) — ${totalCriados} atleta(s) criado(s), ${totalRemovidos} removido(s)`,
  )
}

main()
