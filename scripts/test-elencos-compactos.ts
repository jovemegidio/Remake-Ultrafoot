// O GATE DO ELENCO COMPACTO (1.0.342).
//
// ⚠️ POR QUE ELE EXISTE. O bundle passou a carregar `pool-elencos-compacto.json`
// em vez do arquivo verboso, com chave de uma letra e DUAS codificações que
// desfazem redundâncias: o `tm_` do id e o número do id repetido dentro do `ft`.
//
// As duas são de 99%, não de 100% — 222 dos 26.605 `ft` NÃO seguem o padrão, e
// 18.691 ids não são `tm_`. Uma compactação otimista trocaria a foto de milhares
// de atletas em silêncio, que é precisamente o tipo de falha que este projeto já
// teve com rosto colado no jogador errado.
//
// Por isso este gate não confere amostra: ele reconstrói o arquivo INTEIRO a
// partir do compacto e exige igualdade com o original, atleta por atleta, campo
// por campo. Se qualquer suposição do script estiver errada, ele reprova.
//
// Uso: npx tsx scripts/test-elencos-compactos.ts

import { readFileSync, existsSync, statSync } from "node:fs"
import path from "node:path"

import { expandirElencosCompactos, type PoolPlayerRaw } from "@/lib/pool-elencos"
import { expandirElencosTM, type AtletaRealTM } from "@/lib/elencos-reais-tm"

const RAIZ = process.cwd()
const FONTE = path.join(RAIZ, "data/seeds/imported-bf2026-elencos.json")
const COMPACTO = path.join(RAIZ, "data/seeds/pool-elencos-compacto.json")

let falhas = 0
const erro = (m: string) => { console.log("FALHA: " + m); falhas++ }

if (!existsSync(COMPACTO)) {
  console.log("FALHA: pool-elencos-compacto.json nao existe — rode o prebuild "
    + "(node scripts/compactar-elencos-do-pool.mjs). O bundle importa ESTE arquivo.")
  process.exit(1)
}

const original = JSON.parse(readFileSync(FONTE, "utf-8")) as Record<string, PoolPlayerRaw[]>
const compactoBruto = JSON.parse(readFileSync(COMPACTO, "utf-8"))
const reconstruido = expandirElencosCompactos(compactoBruto)

// ── 1. Os mesmos clubes ─────────────────────────────────────────────────────
const clubesOriginais = Object.keys(original).filter(c => Array.isArray(original[c]))
const clubesVoltados = Object.keys(reconstruido)
if (clubesOriginais.length !== clubesVoltados.length) {
  erro(`clubes: ${clubesOriginais.length} no original x ${clubesVoltados.length} no reconstruido`)
}

// ── 2. Atleta por atleta, campo por campo ───────────────────────────────────
const CAMPOS: (keyof PoolPlayerRaw)[] = ["id", "nome", "posicao", "overall", "idade", "salario", "nac", "ft"]
let atletas = 0
let divergencias = 0
for (const clube of clubesOriginais) {
  const antes = original[clube]
  const depois = reconstruido[clube]
  if (!depois) { erro(`clube ${clube} sumiu do compacto`); continue }
  if (antes.length !== depois.length) {
    erro(`${clube}: ${antes.length} atletas no original x ${depois.length} no reconstruido`)
    continue
  }
  for (let i = 0; i < antes.length; i++) {
    atletas++
    for (const campo of CAMPOS) {
      if (antes[i][campo] !== depois[i][campo]) {
        divergencias++
        if (divergencias <= 5) {
          erro(`${clube}[${i}] "${antes[i].nome}" campo ${campo}: `
            + `${JSON.stringify(antes[i][campo])} -> ${JSON.stringify(depois[i][campo])}`)
        }
      }
    }
  }
}
if (divergencias > 5) erro(`... e mais ${divergencias - 5} divergencia(s) de campo`)
console.log(`${atletas} atletas conferidos campo a campo em ${clubesOriginais.length} clubes`)

// ── 3. E precisa REALMENTE ser menor ────────────────────────────────────────
// Sem isto o gate passaria com uma "compactacao" que nao compacta nada.
const antesMB = statSync(FONTE).size / 1048576
const depoisMB = statSync(COMPACTO).size / 1048576
const ganho = Math.round((1 - depoisMB / antesMB) * 100)
if (ganho < 15) erro(`o compacto so ficou ${ganho}% menor (${antesMB.toFixed(2)} -> ${depoisMB.toFixed(2)} MB)`)
console.log(`tamanho: ${antesMB.toFixed(2)} MB -> ${depoisMB.toFixed(2)} MB (${ganho}% menor)`)

// ── 4. O SEGUNDO seed: elencos reais do Transfermarkt ───────────────────────
// Mesmo tratamento, mesma exigencia. Ele merece o mesmo rigor porque e a fonte
// da NACIONALIDADE e da FOTO dos atletas reais: um campo trocado aqui poe
// bandeira e rosto errados em dezenas de milhares de jogadores.
{
  const FONTE_TM = path.join(RAIZ, "data/seeds/real-squads-tm.json")
  const COMPACTO_TM = path.join(RAIZ, "data/seeds/real-squads-tm-compacto.json")
  if (!existsSync(COMPACTO_TM)) {
    erro("real-squads-tm-compacto.json nao existe — rode node scripts/compactar-elencos-tm.mjs")
  } else {
    const orig = JSON.parse(readFileSync(FONTE_TM, "utf-8")) as Record<string, AtletaRealTM[]>
    const volta = expandirElencosTM(JSON.parse(readFileSync(COMPACTO_TM, "utf-8")))
    const campos: (keyof AtletaRealTM)[] = ["n", "p", "c", "f", "i", "o"]
    let conferidos = 0
    let diverg = 0
    for (const clube of Object.keys(orig)) {
      const a = orig[clube]
      const b = volta[clube]
      if (!Array.isArray(a)) continue
      if (!b || a.length !== b.length) { erro(`TM ${clube}: elenco divergente`); continue }
      for (let i = 0; i < a.length; i++) {
        conferidos++
        for (const campo of campos) {
          if (a[i][campo] !== b[i][campo]) {
            diverg++
            if (diverg <= 3) {
              erro(`TM ${clube}[${i}] "${a[i].n}" campo ${campo}: `
                + `${JSON.stringify(a[i][campo])} -> ${JSON.stringify(b[i][campo])}`)
            }
          }
        }
      }
    }
    if (diverg > 3) erro(`TM: ... e mais ${diverg - 3} divergencia(s)`)
    const aMB = statSync(FONTE_TM).size / 1048576
    const dMB = statSync(COMPACTO_TM).size / 1048576
    const g = Math.round((1 - dMB / aMB) * 100)
    if (g < 15) erro(`TM: o compacto so ficou ${g}% menor`)
    console.log(`TM: ${conferidos} atletas conferidos | ${aMB.toFixed(2)} MB -> ${dMB.toFixed(2)} MB (${g}% menor)`)
  }
}

console.log(falhas === 0
  ? "\nCOMPACTO OK — reconstroi os dois arquivos inteiros sem perder um campo."
  : `\n${falhas} problema(s): o elenco compacto NAO reproduz o original.`)
process.exit(falhas === 0 ? 0 : 1)
