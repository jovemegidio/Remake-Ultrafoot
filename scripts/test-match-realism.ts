// REALISMO DO MOTOR DE PARTIDA: placares plausiveis, favoritismo real, zebra
// possivel, goleada rara. Roda muitas simulacoes e mede as distribuicoes.

import { simulateFullMatch, type MatchConfig } from "../lib/match-engine"
import { attributesFromOverall } from "../lib/player-attributes"

let falhas = 0
function checar(nome: string, ok: boolean, detalhe = "") {
  console.log(`${ok ? "ok" : "FALHOU"}  ${nome}${detalhe ? ` — ${detalhe}` : ""}`)
  if (!ok) falhas++
}

const POS = ["GOL", "ZAG", "ZAG", "LD", "LE", "VOL", "MEI", "MEI", "PE", "PD", "ATA"]
function squad(overall: number, tag: string) {
  return POS.map((pos, i) => {
    const a = attributesFromOverall(overall + ((i * 3) % 7) - 3, pos, `${tag}${i}`)
    return { id: i + 1, nome: `${tag}${i}`, pos, base: overall, ...a }
  })
}
function sim(homeOvr: number, awayOvr: number) {
  const config: MatchConfig = {
    homeTeam: { curto: "HOM", nome: "Home" } as never,
    awayTeam: { curto: "AWY", nome: "Away" } as never,
    homeRating: homeOvr, awayRating: awayOvr,
    homeSquad: squad(homeOvr, "H") as never,
    awaySquad: squad(awayOvr, "A") as never,
  }
  const st = simulateFullMatch(config)
  return { h: st.home.goals, a: st.away.goals }
}

// ── 1. Media de gols realista (2.4 - 3.4 por jogo) ──────────────────────────
{
  const N = 800
  let totalGols = 0, goleadas = 0, zeroAzero = 0
  for (let i = 0; i < N; i++) {
    const { h, a } = sim(75, 75)
    totalGols += h + a
    if (Math.abs(h - a) >= 5) goleadas++
    if (h === 0 && a === 0) zeroAzero++
  }
  const media = totalGols / N
  console.log(`   times iguais (75x75): media ${media.toFixed(2)} gols/jogo | goleadas(5+) ${(goleadas/N*100).toFixed(1)}% | 0x0 ${(zeroAzero/N*100).toFixed(1)}%`)
  checar("media de gols realista (2.3-3.5)", media >= 2.3 && media <= 3.5, media.toFixed(2))
  checar("goleadas por 5+ sao raras (<4%)", goleadas / N < 0.04, `${(goleadas/N*100).toFixed(1)}%`)
  checar("0x0 acontece as vezes (>4%)", zeroAzero / N > 0.04, `${(zeroAzero/N*100).toFixed(1)}%`)
}

// ── 2a. Abismo de forca (17 pts): forte domina, zebra rara mas existe ───────
{
  const N = 800
  let vForte = 0, vFraco = 0, empates = 0
  for (let i = 0; i < N; i++) {
    const { h, a } = sim(85, 68)
    if (h > a) vForte++; else if (a > h) vFraco++; else empates++
  }
  console.log(`   forte(85) x fraco(68): forte ${(vForte/N*100).toFixed(0)}% | fraco ${(vFraco/N*100).toFixed(0)}% | empate ${(empates/N*100).toFixed(0)}%`)
  checar("abismo: forte vence a grande maioria (>=60%)", vForte / N >= 0.6, `${(vForte/N*100).toFixed(0)}%`)
  checar("abismo: zebra rara mas existe (>2%)", vFraco / N > 0.02, `${(vFraco/N*100).toFixed(0)}%`)
  checar("abismo: forte nao e imbativel (<92%)", vForte / N < 0.92)
}

// ── 2b. Gap medio (10 pts): favorito leva vantagem clara, upset comum ───────
{
  const N = 800
  let vForte = 0, vFraco = 0
  for (let i = 0; i < N; i++) {
    const { h, a } = sim(80, 70)
    if (h > a) vForte++; else if (a > h) vFraco++
  }
  console.log(`   forte(80) x fraco(70): forte ${(vForte/N*100).toFixed(0)}% | fraco ${(vFraco/N*100).toFixed(0)}%`)
  checar("gap medio: favorito vence mais que o azarao", vForte > vFraco)
  // Elencos de teste sao UNIFORMEMENTE 10 pts superiores (sem variacao interna),
  // o que exagera o gap; ainda assim o azarao vence de vez em quando.
  checar("gap medio: upset acontece (>5%)", vFraco / N > 0.05, `${(vFraco/N*100).toFixed(0)}%`)
}

// ── 3. Mando de campo: mesmo overall, casa leva vantagem ───────────────────
{
  const N = 800
  let casa = 0, fora = 0
  for (let i = 0; i < N; i++) {
    const { h, a } = sim(75, 75)
    if (h > a) casa++; else if (a > h) fora++
  }
  console.log(`   mando (75x75): casa vence ${(casa/N*100).toFixed(0)}% | fora ${(fora/N*100).toFixed(0)}%`)
  checar("mando de campo da vantagem (casa vence mais que fora)", casa > fora)
}

console.log(falhas === 0 ? "\n== TODOS OS TESTES PASSARAM ==" : `\n== ${falhas} FALHA(S) ==`)
process.exit(falhas === 0 ? 0 : 1)
