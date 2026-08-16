// AUDITA cor1/cor2 e `curto` de todos os clubes — pool e catalogo curado.
//
//   node scripts/auditar-cores-e-siglas.mjs [--json saida.json]
//
// O que e DEFEITO OBJETIVO (nao depende de saber a cor real do clube):
//
//  1. hex invalido / ausente — a UI recebe `undefined` e pinta o fallback;
//  2. cor1 == cor2 — a camisa desenhada fica de uma cor so e o texto some;
//  3. contraste baixo entre as duas — mesmo sintoma, so que gradual. Uso a
//     luminancia relativa da WCAG, que e a mesma conta que decide se um texto
//     e legivel sobre um fundo;
//  4. cor unica no clube inteiro (cor1 == cor2 == preto/branco puro), que e a
//     marca do dado de preenchimento;
//  5. `curto` que na verdade e o fileKey cortado (>=8 caracteres) ou que se
//     repete entre clubes diferentes.
//
// ⚠️ NAO julgo "a cor esta errada para este clube" sem fonte. Cor de clube nao
// se deduz do nome, e trocar por chute e pior do que deixar como esta.

import { readFileSync, writeFileSync } from "node:fs"
import path from "node:path"

const RAIZ = path.resolve(import.meta.dirname, "..")
const saida = process.argv.includes("--json") ? process.argv[process.argv.indexOf("--json") + 1] : ""

const POOL = JSON.parse(readFileSync(path.join(RAIZ, "data/seeds/imported-bf2026.json"), "utf-8")).teams ?? []
const fonteCurada = readFileSync(path.join(RAIZ, "lib/teams-data.ts"), "utf-8")
  + "\n" + readFileSync(path.join(RAIZ, "lib/international-teams.ts"), "utf-8")
const curados = []
for (const m of fonteCurada.matchAll(/\{[^{}]*\}/g)) {
  const fk = m[0].match(/file_key:\s*"([^"]+)"/)
  const nm = m[0].match(/(?:^|[\s,{])nome:\s*"([^"]+)"/)
  const c1 = m[0].match(/cor1:\s*"([^"]+)"/)
  const c2 = m[0].match(/cor2:\s*"([^"]+)"/)
  const ct = m[0].match(/curto:\s*"([^"]+)"/)
  if (fk && nm) curados.push({ fileKey: fk[1], nome: nm[1], cor1: c1?.[1], cor2: c2?.[1], curto: ct?.[1], curado: true })
}

const HEX = /^#[0-9a-fA-F]{6}$/
const canal = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4 }
const lum = hex => {
  const n = parseInt(hex.slice(1), 16)
  return 0.2126 * canal((n >> 16) & 255) + 0.7152 * canal((n >> 8) & 255) + 0.0722 * canal(n & 255)
}
/** Contraste WCAG: 1 = identico, 21 = preto sobre branco. */
const contraste = (a, b) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p)
  return (x + 0.05) / (y + 0.05)
}

/** Matiz (0..360) do hex — e ela que diz se sao DUAS cores ou dois tons de uma. */
const matiz = (hex) => {
  const n = parseInt(hex.slice(1), 16)
  const r = ((n >> 16) & 255) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min
  if (d === 0) return -1 // cinza: nao tem matiz
  const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4
  return ((h * 60) + 360) % 360
}
const deltaMatiz = (a, b) => {
  const [x, y] = [matiz(a), matiz(b)]
  if (x < 0 || y < 0) return 180 // preto/branco/cinza contra cor e contraste legitimo
  const d = Math.abs(x - y)
  return Math.min(d, 360 - d)
}

const universo = [...POOL, ...curados]
const achados = { hexInvalido: [], iguais: [], corDerivada: [], contrasteBaixo: [], siglaSlug: [], siglaRepetida: [] }

const porSigla = new Map()
for (const t of universo) {
  const onde = t.curado ? "curado" : "pool"
  const c1 = (t.cor1 ?? "").trim(), c2 = (t.cor2 ?? "").trim()

  if (!HEX.test(c1) || !HEX.test(c2)) {
    achados.hexInvalido.push(`${t.fileKey} [${onde}] "${t.nome}": cor1=${c1 || "(vazio)"} cor2=${c2 || "(vazio)"}`)
  } else if (c1.toLowerCase() === c2.toLowerCase()) {
    achados.iguais.push(`${t.fileKey} [${onde}] "${t.nome}": ${c1}`)
  } else {
    const r = contraste(c1, c2)
    // ⚠️ CONTRASTE BAIXO NAO E, SOZINHO, DEFEITO. O Ternana e verde e vermelho
    // e o Örgryte e azul e vermelho: duas cores CERTAS que por acaso tem
    // luminancia parecida. Trocar isso seria estragar dado bom.
    //
    // O defeito de verdade e a cor2 ser um TOM da cor1 (mesma matiz), que e a
    // assinatura de cor gerada em vez de coletada — "#d2131c x #ea4b52" e o
    // mesmo vermelho duas vezes. Por isso separo pela MATIZ.
    if (r < 1.5) {
      const linha = `${t.fileKey} [${onde}] "${t.nome}": ${c1} x ${c2} (contraste ${r.toFixed(2)}, ${Math.round(deltaMatiz(c1, c2))}° de matiz)`
      if (deltaMatiz(c1, c2) < 30) achados.corDerivada.push(linha)
      else achados.contrasteBaixo.push(linha)
    }
  }

  const curto = (t.curto ?? "").trim()
  if (!curto || curto.length >= 8) {
    achados.siglaSlug.push(`${t.fileKey} [${onde}] "${t.nome}": "${curto}"`)
  }
  if (curto) {
    if (!porSigla.has(curto)) porSigla.set(curto, [])
    porSigla.get(curto).push(`${t.fileKey} "${t.nome}"`)
  }
}
for (const [sigla, lista] of porSigla) {
  if (lista.length > 1) achados.siglaRepetida.push(`${sigla}: ${lista.join(" | ")}`)
}

console.log(`${universo.length} clubes auditados (${POOL.length} pool + ${curados.length} curados)\n`)
for (const [chave, lista] of Object.entries(achados)) {
  console.log(`${chave}: ${lista.length}`)
  for (const l of lista.slice(0, 12)) console.log(`   ${l}`)
  if (lista.length > 12) console.log(`   ... e mais ${lista.length - 12}`)
  console.log()
}

if (saida) {
  writeFileSync(saida, JSON.stringify(achados, null, 1), "utf-8")
  console.log(`Gravado em ${saida}`)
}
