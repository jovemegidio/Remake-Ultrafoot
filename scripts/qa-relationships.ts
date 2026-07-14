// Verifica o motor de relacionamento entre clubes: grupos multi-clube, satelites e
// rivais, e o efeito sobre a negociacao (rival dificulta/encarece; grupo facilita).
//
// Uso: npx tsx scripts/qa-relationships.ts
import { getClubRelationship, getRelationshipEffect } from "../lib/club-relationships"

let fail = 0
const ok = (m: string) => console.log("OK " + m)
const bad = (m: string) => { console.log("XX " + m); fail++ }

function expectKind(a: string, b: string, kind: string) {
  const r = getClubRelationship(a, b)
  if (r.kind === kind) ok(`${a} x ${b} => ${r.kind}${r.detail ? ` (${r.detail})` : ""}`)
  else bad(`${a} x ${b} => ${r.kind}, esperado ${kind}`)
}

// Grupos multi-clube
expectKind("Red Bull Bragantino", "RB Leipzig", "group")
expectKind("Manchester City", "Girona", "group")
expectKind("Botafogo", "Olympique Lyonnais", "group")

// Satelites / relacoes historicas
expectKind("Ajax", "Barcelona", "satellite")
expectKind("São Paulo", "FC Porto", "satellite")
expectKind("Chelsea", "Vitesse", "satellite")
expectKind("Juventus", "Sassuolo", "satellite")

// Rivais
expectKind("Palmeiras", "Corinthians", "rival")
expectKind("Grêmio", "Internacional", "rival")
expectKind("Barcelona", "Real Madrid", "rival")

// Neutro
expectKind("Palmeiras", "Bahia", "neutral")
expectKind("Fortaleza", "Cuiabá", "neutral")

// Mesmo clube => neutro (nunca rival de si mesmo)
expectKind("Flamengo", "Flamengo", "neutral")

// Efeito na negociacao: rival encarece e reduz a chance; grupo facilita e da desconto.
const rival = getRelationshipEffect("Palmeiras", "Corinthians", "buy")
if (rival.chanceMult < 1 && rival.priceMult > 1 && rival.hardBlock) ok("rival: chance<1, preco>1, hardBlock")
else bad(`rival effect inesperado: ${JSON.stringify(rival)}`)

const group = getRelationshipEffect("Red Bull Bragantino", "RB Leipzig", "buy")
if (group.chanceMult > 1 && group.priceMult < 1) ok("grupo: chance>1, preco<1 (desconto)")
else bad(`grupo effect inesperado: ${JSON.stringify(group)}`)

const neutral = getRelationshipEffect("Palmeiras", "Bahia", "buy")
if (neutral.chanceMult === 1 && neutral.priceMult === 1) ok("neutro: sem modificador")
else bad(`neutro effect inesperado: ${JSON.stringify(neutral)}`)

console.log(fail ? `\nRESULTADO: ${fail} falha(s)` : "\nRESULTADO: OK — relacionamento entre clubes funcionando")
process.exitCode = fail ? 1 : 0
