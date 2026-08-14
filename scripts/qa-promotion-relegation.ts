// ACESSO E REBAIXAMENTO — a regra que o jogo REALMENTE executa.
//
// ⚠️ ESTE PORTÃO ESTAVA PROVANDO CÓDIGO MORTO (achado em 14/08/2026).
//
// Ele importava `resolveDivisionChange` de `lib/promotion-relegation`, um módulo
// que NENHUMA tela e NENHUMA lib importam. Quem decide acesso e rebaixamento no
// jogo é `lib/league-pyramid` — o `use-game-manager` chama `evolvePyramids` e o
// `resolveDivisionChange` de LÁ na virada de temporada.
//
// Ou seja: o portão passava, e não dizia nada sobre o jogo. Pior, ele afirmava
// uma inverdade — que um clube inglês em 20º **fica** na Premier League, porque
// o módulo morto só conhecia a escada brasileira e tratava toda liga estrangeira
// como "fora da pirâmide". Na regra viva a Inglaterra tem seis níveis e rebaixa
// três.
//
// Duas implementações da mesma regra, e a morta parecendo a certa pelo nome: é o
// mesmo defeito que a base tinha entre "evoluir um mês" e "acompanhar uma
// semana". Por isso o módulo morto foi REMOVIDO, e não apenas contornado.
//
//   npx tsx scripts/qa-promotion-relegation.ts

import {
  divisionAbove, divisionBelow, promotionCount, relegationCount,
  resolveDivisionChange, PYRAMIDS,
} from "../lib/league-pyramid"

let falhas = 0
const ok = (m: string) => console.log("  ok   " + m)
const bad = (m: string) => { console.log(" FALHA " + m); falhas++ }

/** ⚠️ A assinatura VIVA pede o TAMANHO da liga: a zona de queda é contada do fim. */
function espera(division: string, pos: number, size: number, expDiv: string, expMov: string) {
  const r = resolveDivisionChange(division, pos, size, "Time")
  if (r.nextDivision === expDiv && r.movement === expMov) {
    ok(`${division} ${pos}º de ${size} -> ${r.nextDivision} (${r.movement})`)
  } else {
    bad(`${division} ${pos}º de ${size} -> ${r.nextDivision}/${r.movement}, esperado ${expDiv}/${expMov}`)
  }
}

console.log("\nBrasil — 4 sobem e 4 caem em cada degrau\n")

espera("serie_a", 1, 20, "serie_a", "stay")
espera("serie_a", 16, 20, "serie_a", "stay")
espera("serie_a", 17, 20, "serie_b", "relegated")
espera("serie_a", 20, 20, "serie_b", "relegated")
espera("serie_b", 1, 20, "serie_a", "promoted")
espera("serie_b", 4, 20, "serie_a", "promoted")
espera("serie_b", 5, 20, "serie_b", "stay")
espera("serie_b", 17, 20, "serie_c", "relegated")
espera("serie_c", 2, 20, "serie_b", "promoted")
espera("serie_d", 3, 20, "serie_c", "promoted")

console.log("\nO TOPO NÃO SOBE E A BASE NÃO CAI\n")

espera("serie_a", 1, 20, "serie_a", "stay")
espera("serie_d", 20, 20, "serie_d", "stay")

console.log("\n⚠️ O QUE O PORTÃO ANTIGO ERRAVA: liga estrangeira TAMBÉM rebaixa\n")

// O módulo morto devolvia "stay" para tudo que não fosse brasileiro. Estas quatro
// linhas são a diferença entre provar o jogo e provar um arquivo esquecido.
espera("premier_league", 20, 20, "championship", "relegated")
espera("championship", 1, 24, "premier_league", "promoted")
espera("la_liga", 20, 20, "la_liga_2", "relegated")
espera("bundesliga", 18, 18, "bundesliga_2", "relegated")

console.log("\nO tamanho da liga MOVE a zona de queda\n")

// A zona de queda é contada do FIM, então ela ANDA com o tamanho da liga: com 4
// rebaixados, ela começa no 17º numa liga de 20 e no 15º numa de 18. É a mesma
// posição com destinos diferentes — e foi aqui que eu errei a expectativa na
// primeira escrita deste teste, o que é justamente o que ele existe para pegar.
espera("serie_a", 16, 20, "serie_a", "stay")
espera("serie_a", 16, 18, "serie_b", "relegated")
espera("serie_a", 14, 18, "serie_a", "stay")
espera("serie_a", 15, 18, "serie_b", "relegated")

console.log("\n⚠️ A PIRÂMIDE NÃO PODE ENCOLHER: quem cai de cima = quem sobe de baixo\n")

// Se as duas pontas divergissem, a divisão de cima perderia (ou ganharia) uma
// vaga por temporada, em silêncio. Ver o aviso em `promotionCount`.
for (const p of PYRAMIDS) {
  for (let i = 0; i < p.tiers.length - 1; i++) {
    const cima = p.tiers[i]
    const baixo = p.tiers[i + 1]
    const caem = relegationCount(cima)
    const sobem = promotionCount(baixo)
    if (caem === sobem) ok(`${p.country}: ${cima} -> ${baixo} (${caem} trocam)`)
    else bad(`${p.country}: caem ${caem} de ${cima} mas sobem ${sobem} de ${baixo}`)
  }
}

console.log("\nAs escadas são coerentes nos dois sentidos\n")

for (const p of PYRAMIDS) {
  for (let i = 0; i < p.tiers.length; i++) {
    const atual = p.tiers[i]
    const acima = divisionAbove(atual)
    const abaixo = divisionBelow(atual)
    const esperadoAcima = i === 0 ? null : p.tiers[i - 1]
    const esperadoAbaixo = i === p.tiers.length - 1 ? null : p.tiers[i + 1]
    if (acima !== esperadoAcima) bad(`${atual}: acima deu ${acima}, esperado ${esperadoAcima}`)
    if (abaixo !== esperadoAbaixo) bad(`${atual}: abaixo deu ${abaixo}, esperado ${esperadoAbaixo}`)
  }
}
ok(`${PYRAMIDS.length} pirâmides conferidas nos dois sentidos`)

console.log(falhas === 0
  ? "\nRESULTADO: OK — acesso e rebaixamento corretos NA REGRA VIVA\n"
  : `\nRESULTADO: ${falhas} falha(s)\n`)
process.exitCode = falhas ? 1 : 0
