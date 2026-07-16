// Aplica as POSICOES reais (de data/seeds/real-positions.json, gerado dos CSVs por
// import-real-positions.mjs) nos clubes brasileiros CURADOS de data/seeds/players_br.json.
//
// POR QUE: getPlayersByTeam usa o CURADO (players_br.json) com prioridade e NUNCA consulta
// real-positions para esses clubes. O players_br tinha posicoes por BLOCO (goleiros seguidos,
// laterais, zagueiros, quase nenhum atacante) -> formacao errada. A Serie A ja foi corrigida
// do XLSX; aqui corrigimos Serie B/C/D (que estao nos CSVs -> real-positions).
//
// Preserva base/idade por NOME (nao mexe na forca); estima base p/ quem e novo (mediana).
// Serie A nao entra: real-positions vem so dos CSVs (a Serie A veio de XLSX, chave diferente).
//
// Uso: node scripts/apply-real-positions-to-br.mjs

import { readFile, writeFile } from "node:fs/promises"

const REAL = "data/seeds/real-positions.json"
const SEED = "data/seeds/players_br.json"

function norm(s) {
  return (s ?? "").replace(/^﻿/, "").normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase().replace(/[^a-z0-9]/g, "")
}
function clubKey(s) {
  return norm(s)
    .replace(/^(fc|cf|ac|as|rc|sc|ss|afc|rcd|ud|cd|sv|ogc|losc|stade)/, "")
    .replace(/(fc|cf|cfc|ac|sc|afc|club)$/, "")
    .replace(/^olympiquede/, "olympique")
}

async function main() {
  const real = JSON.parse(await readFile(REAL, "utf8"))
  const seed = JSON.parse(await readFile(SEED, "utf8"))

  // real-positions ja vem keyed por clubKey.
  const realByKey = real
  // Nome no players_br -> clubKey no real-positions, quando o clubKey nao reconcilia sozinho.
  const ALIAS = {
    "América-MG": "americamineiro",
    "Atlético-GO": "atleticogoianiense",
    "Grêmio Novorizontino": "novorizontino",
    "Ypiranga-RS": "ypiranga",
  }

  // Serie A ja foi corrigida do XLSX (fonte melhor, com laterais/pontas). NAO sobrescrever
  // com o real-positions (que tem alguns desses clubes vindo do CSV da Serie B, desatualizado
  // e generico) — foi o que regrediu o Vitoria.
  const SERIE_A_SKIP = new Set([
    "Palmeiras", "Flamengo", "Corinthians", "Cruzeiro", "Botafogo", "Bahia", "Fluminense",
    "Vasco da Gama", "Santos", "Grêmio", "RB Bragantino", "Atlético-MG", "São Paulo",
    "Athletico-PR", "Internacional", "Vitória", "Coritiba", "Mirassol", "Remo", "Chapecoense",
  ].map(norm))

  let updated = 0
  const skipped = []
  const report = []

  for (const clube of Object.keys(seed)) {
    if (SERIE_A_SKIP.has(norm(clube))) { skipped.push(clube + " (Serie A/XLSX)"); continue }
    const rp = realByKey[ALIAS[clube] ?? clubKey(clube)]
    if (!rp || rp.length < 11) { skipped.push(clube); continue }

    const old = seed[clube] || []
    const oldByName = new Map(old.map((p) => [norm(p.nome), p]))
    const matched = rp.map((p) => oldByName.get(norm(p.nome))?.base).filter((b) => typeof b === "number")
    const median = matched.length ? matched.slice().sort((a, b) => a - b)[Math.floor(matched.length / 2)] : 62

    // real-positions ja vem com titulares primeiro.
    const rebuilt = rp.map((p, i) => {
      const o = oldByName.get(norm(p.nome))
      const estBase = Math.max(48, Math.round(median - Math.floor(i / 6)))
      return { nome: p.nome, pos: p.pos, idade: o?.idade ?? 24, base: o?.base ?? estBase }
    })

    seed[clube] = rebuilt
    updated++
    const ata = rebuilt.filter((p) => /ATA|PD|PE|SA|CA/.test(p.pos)).length
    const xiAta = rebuilt.slice(0, 11).filter((p) => /ATA|PD|PE|SA|CA/.test(p.pos)).length
    report.push(`${clube}: ${rebuilt.length} jog, ${ata} ATA (XI: ${xiAta})`)
  }

  await writeFile(SEED, JSON.stringify(seed, null, 2) + "\n", "utf8")

  console.log(`clubes BR atualizados do real-positions: ${updated}`)
  report.forEach((r) => console.log("  " + r))
  console.log(`\nsem match em real-positions (mantidos como estavam): ${skipped.length}`)
  console.log("  " + skipped.join(", "))
}

main().catch((e) => { console.error(e); process.exit(1) })
