// ATRIBUTOS COERENTES COM A POSICAO e overall reconciliado.

import { attributesFromOverall, overallFromAttributes, type Attrs } from "../lib/player-attributes"

let falhas = 0
function checar(nome: string, ok: boolean, detalhe = "") {
  console.log(`${ok ? "ok" : "FALHOU"}  ${nome}${detalhe ? ` — ${detalhe}` : ""}`)
  if (!ok) falhas++
}

function show(a: Attrs) {
  return `pac${a.pace} fin${a.shooting} pas${a.passing} dri${a.dribbling} def${a.defending} fis${a.physical}`
}

// ── 1. Zagueiro: defesa alta, finalizacao baixa ────────────────────────────
{
  const zag = attributesFromOverall(85, "ZAG", "Marquinhos")
  console.log(`   ZAG 85: ${show(zag)}`)
  checar("zagueiro 85 tem defesa alta (>=80)", zag.defending >= 80, `${zag.defending}`)
  checar("zagueiro 85 tem finalizacao baixa (<=65)", zag.shooting <= 65, `${zag.shooting}`)
  checar("zagueiro: defesa > finalizacao", zag.defending > zag.shooting + 15)
}

// ── 2. Atacante: finalizacao alta, defesa baixa ────────────────────────────
{
  const ata = attributesFromOverall(85, "ATA", "Haaland")
  console.log(`   ATA 85: ${show(ata)}`)
  checar("atacante 85 tem finalizacao alta (>=80)", ata.shooting >= 80, `${ata.shooting}`)
  checar("atacante 85 tem defesa baixa (<=70)", ata.defending <= 70, `${ata.defending}`)
  checar("atacante: finalizacao > defesa", ata.shooting > ata.defending + 15)
}

// ── 3. Goleiro: defending alto (habilidade de goleiro), resto baixo ─────────
{
  const gol = attributesFromOverall(85, "GOL", "Alisson")
  console.log(`   GOL 85: ${show(gol)}`)
  checar("goleiro 85 tem defending alto (>=80)", gol.defending >= 80, `${gol.defending}`)
  checar("goleiro tem finalizacao irrisoria (<=40)", gol.shooting <= 40, `${gol.shooting}`)
}

// ── 4. Overall reconciliado: media ponderada ~= overall ────────────────────
{
  const posicoes = ["GOL", "ZAG", "LD", "VOL", "MEI", "PE", "ATA"]
  let maxErro = 0
  for (const pos of posicoes) {
    for (const ovr of [55, 70, 85, 92]) {
      const a = attributesFromOverall(ovr, pos, `t${pos}${ovr}`)
      const recomputado = overallFromAttributes(a, pos)
      const erro = Math.abs(recomputado - ovr)
      maxErro = Math.max(maxErro, erro)
      if (erro > 3) console.log(`   ${pos} ${ovr}: recomputado ${recomputado} (erro ${erro})`)
    }
  }
  checar("overall recomputado bate com o exibido (erro <= 3)", maxErro <= 3, `erro max ${maxErro}`)
}

// ── 5. Determinismo: mesmo jogador, mesmos atributos ───────────────────────
{
  const a = attributesFromOverall(78, "MEI", "Paqueta")
  const b = attributesFromOverall(78, "MEI", "Paqueta")
  checar("mesmo jogador gera atributos identicos", JSON.stringify(a) === JSON.stringify(b))
}

// ── 6. Overall maior => atributos-chave maiores ────────────────────────────
{
  const fraco = attributesFromOverall(60, "ATA", "x")
  const forte = attributesFromOverall(88, "ATA", "x")
  checar("atacante melhor finaliza melhor", forte.shooting > fraco.shooting + 15)
}

console.log(falhas === 0 ? "\n== TODOS OS TESTES PASSARAM ==" : `\n== ${falhas} FALHA(S) ==`)
process.exit(falhas === 0 ? 0 : 1)
