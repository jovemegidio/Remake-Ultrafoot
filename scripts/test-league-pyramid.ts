// PIRAMIDE VIVA: acesso/rebaixamento no mundo todo, rivais trocando de divisao.

import {
  resolveDivisionChange, evolvePyramids, relegationCount, promotionCount,
  divisionAbove, divisionBelow, type PyramidClub,
} from "../lib/league-pyramid"

let falhas = 0
function checar(nome: string, ok: boolean, detalhe = "") {
  console.log(`${ok ? "ok" : "FALHOU"}  ${nome}${detalhe ? ` — ${detalhe}` : ""}`)
  if (!ok) falhas++
}

// ── 1. Cadeia brasileira D -> C -> B -> A ──────────────────────────────────
{
  checar("Serie A rebaixa 4, promove 0", relegationCount("serie_a") === 4 && promotionCount("serie_a") === 0)
  checar("Serie C rebaixa 4 (vida real, nao 2)", relegationCount("serie_c") === 4, `${relegationCount("serie_c")}`)
  checar("Serie D promove 4 (vida real, nao 6)", promotionCount("serie_d") === 4, `${promotionCount("serie_d")}`)
  checar("Serie D nao rebaixa (base)", relegationCount("serie_d") === 0)
  checar("acima da Serie B e a A", divisionAbove("serie_b") === "serie_a")
  checar("abaixo da Serie C e a D", divisionBelow("serie_c") === "serie_d")

  // Ultimo da Serie D -> ninguem, campeao da D -> Serie C
  checar("campeao da Serie D sobe para C", resolveDivisionChange("serie_d", 1, 20).nextDivision === "serie_c")
  checar("ultimo da Serie A cai para B", resolveDivisionChange("serie_a", 20, 20).movement === "relegated")
  checar("meio de tabela fica", resolveDivisionChange("serie_a", 10, 20).movement === "stay")
}

// ── 2. Ligas estrangeiras ──────────────────────────────────────────────────
{
  checar("Premier rebaixa 3", relegationCount("premier_league") === 3)
  checar("Championship sobe 3", promotionCount("championship") === 3)
  checar("ultimo da Premier cai para Championship", resolveDivisionChange("premier_league", 20, 20).nextDivision === "championship")
  checar("2o da Championship sobe para a Premier", resolveDivisionChange("championship", 2, 21).nextDivision === "premier_league")
  checar("La Liga rebaixa para La Liga 2", resolveDivisionChange("la_liga", 19, 20).nextDivision === "la_liga_2")
  checar("liga sem piramide (MLS) nao move", resolveDivisionChange("mls", 18, 18).movement === "stay")
}

// ── 3. Piramide viva: rivais trocam de divisao ─────────────────────────────
{
  // Monta uma Serie A e uma Serie B ficticias, com prestigios distintos.
  const clubs: PyramidClub[] = []
  for (let i = 0; i < 20; i++) clubs.push({ curto: `A${i}`, division: "serie_a", prestige: 90 - i })
  for (let i = 0; i < 20; i++) clubs.push({ curto: `B${i}`, division: "serie_b", prestige: 70 - i })

  // Usuario na Serie A: termina em ULTIMO (curto A0, que era o mais forte) para
  // provar que a classificacao REAL manda, nao o prestigio.
  const userFinalOrder = [
    ...clubs.filter(c => c.division === "serie_a" && c.curto !== "A0").map(c => c.curto),
    "A0", // forcado a ultimo
  ]
  const overrides = evolvePyramids({ clubs, userDivision: "serie_a", userFinalOrder, seed: 1 })

  checar("o usuario (ultimo da Serie A) foi rebaixado", overrides["A0"] === "serie_b", JSON.stringify(overrides["A0"]))
  const desceram = Object.entries(overrides).filter(([, d]) => d === "serie_b" && overrides).length
  const rebaixadosA = Object.entries(overrides).filter(([k, d]) => k.startsWith("A") && d === "serie_b").length
  const promovidosB = Object.entries(overrides).filter(([k, d]) => k.startsWith("B") && d === "serie_a").length
  checar("exatamente 4 clubes da Serie A foram rebaixados", rebaixadosA === 4, `${rebaixadosA}`)
  checar("exatamente 4 clubes da Serie B foram promovidos", promovidosB === 4, `${promovidosB}`)
  // A divisao nao simulada tem RUIDO (nao e sempre o mesmo campeao), entao nao
  // exigimos B0..B3 exatos — mas os promovidos devem ser, EM MEDIA, os mais
  // fortes: prestigio medio dos que sobem > dos que ficam.
  const bPrest = (curto: string) => 70 - Number(curto.slice(1))
  const subiram = Object.keys(overrides).filter(k => k.startsWith("B") && overrides[k] === "serie_a")
  const ficaram = clubs.filter(c => c.division === "serie_b" && overrides[c.curto] !== "serie_a").map(c => c.curto)
  const media = (arr: string[]) => arr.reduce((s, c) => s + bPrest(c), 0) / arr.length
  checar("os promovidos da B sao, em media, os mais fortes", media(subiram) > media(ficaram),
    `subiram=${media(subiram).toFixed(1)} ficaram=${media(ficaram).toFixed(1)}`)
}

// ── 4. Sizes constantes apos varias temporadas ─────────────────────────────
{
  // Aplica a evolucao repetidamente e confere que cada divisao mantem 20 clubes.
  let clubs: PyramidClub[] = []
  for (let i = 0; i < 20; i++) clubs.push({ curto: `X${i}`, division: "serie_a", prestige: 80 - i })
  for (let i = 0; i < 20; i++) clubs.push({ curto: `Y${i}`, division: "serie_b", prestige: 60 - i })

  for (let s = 0; s < 5; s++) {
    const ov = evolvePyramids({ clubs, userDivision: null, userFinalOrder: [], seed: s })
    clubs = clubs.map(c => ov[c.curto] ? { ...c, division: ov[c.curto] } : c)
  }
  const nA = clubs.filter(c => c.division === "serie_a").length
  const nB = clubs.filter(c => c.division === "serie_b").length
  checar("Serie A mantem 20 clubes apos 5 temporadas", nA === 20, `${nA}`)
  checar("Serie B mantem 20 clubes apos 5 temporadas", nB === 20, `${nB}`)
}

console.log(falhas === 0 ? "\n== TODOS OS TESTES PASSARAM ==" : `\n== ${falhas} FALHA(S) ==`)
process.exit(falhas === 0 ? 0 : 1)
