// ATA/MEI/DEF DA TELA DE PARTIDA PRECISAM VIR DO ELENCO REAL.
//
// Relato (2026-07-23, print): Palmeiras 88/88/89 e Corinthians 90/92/90 na
// selecao de times. Dois defeitos somados:
//
// 1. O valor de cada linha era `rating + (curto.charCodeAt(n) % 5) - 2` — as
//    LETRAS do codigo do clube. A seta de tendencia idem.
// 2. O `rating` vinha de `teamRating`, que le o seed CRU (getPlayersByTeam),
//    sem `calibrateSquadRatings`. Devolvia ~90 para Palmeiras, Corinthians,
//    Flamengo, Santos e Bahia — todos iguais e inflados. Esse mesmo numero
//    alimentava a simulacao da partida rapida.

import { teamSectorRatings } from "../lib/players-data"
import { getTeamByShort } from "../lib/teams-data"

let falhas = 0
function checar(nome: string, ok: boolean, detalhe = "") {
  console.log(`${ok ? "ok" : "FALHOU"}  ${nome}${detalhe ? ` — ${detalhe}` : ""}`)
  if (!ok) falhas++
}

const clubes = ["PAL", "COR", "FLA", "SAN", "BAH", "CRI"]
const lidos = clubes
  .map(c => getTeamByShort(c))
  .filter((t): t is NonNullable<typeof t> => Boolean(t))

checar("os clubes de teste existem", lidos.length === clubes.length, `${lidos.length}/${clubes.length}`)

const medidos = lidos.map(t => ({ time: t, r: teamSectorRatings(t) }))
for (const { time, r } of medidos) {
  console.log(`   ${time.nome}: overall ${r.overall} | ATA ${r.ata} MEI ${r.mei} DEF ${r.def}`)
}

// ── 1. Escala plausivel ────────────────────────────────────────────────────
// Nenhum clube brasileiro deve chegar aos 88-92 que a tela mostrava; esse era
// exatamente o sintoma da falta de calibracao.
{
  const acima = medidos.filter(m => m.r.overall > 85)
  checar("nenhum clube brasileiro acima de 85 de overall", acima.length === 0,
    acima.map(m => `${m.time.nome}=${m.r.overall}`).join(", "))
  const foraDaFaixa = medidos.filter(m =>
    [m.r.overall, m.r.ata, m.r.mei, m.r.def].some(v => v < 40 || v > 95))
  checar("todas as linhas dentro de 40-95", foraDaFaixa.length === 0,
    foraDaFaixa.map(m => m.time.nome).join(", "))
}

// ── 2. Clubes diferenciados ────────────────────────────────────────────────
// O sintoma antigo era todo grande valendo o mesmo. Um clube da Serie B tem de
// ficar visivelmente abaixo de um grande da Serie A.
{
  const distintos = new Set(medidos.map(m => m.r.overall)).size
  checar("os clubes nao tem todos o mesmo overall", distintos >= 3, `${distintos} valores distintos em ${medidos.length}`)

  const fla = medidos.find(m => m.time.curto === "FLA")!
  const cri = medidos.find(m => m.time.curto === "CRI")!
  checar("Flamengo acima do Criciuma", fla.r.overall > cri.r.overall + 3,
    `${fla.r.overall} x ${cri.r.overall}`)
}

// ── 3. Nao depende das letras do codigo do clube ───────────────────────────
// A prova direta contra o bug antigo: mudar so o `curto` nao pode mover nada.
{
  const pal = lidos.find(t => t.curto === "PAL")!
  const original = teamSectorRatings(pal)
  const comOutroCodigo = teamSectorRatings({ ...pal, curto: "ZZZ" })
  checar("trocar o codigo do clube nao muda os numeros",
    original.ata === comOutroCodigo.ata &&
    original.mei === comOutroCodigo.mei &&
    original.def === comOutroCodigo.def,
    `${original.ata}/${original.mei}/${original.def} vs ${comOutroCodigo.ata}/${comOutroCodigo.mei}/${comOutroCodigo.def}`)
}

// ── 4. Estavel entre chamadas ──────────────────────────────────────────────
{
  const pal = lidos.find(t => t.curto === "PAL")!
  const a = teamSectorRatings(pal)
  const b = teamSectorRatings(pal)
  checar("duas chamadas dao o mesmo resultado",
    a.overall === b.overall && a.ata === b.ata && a.mei === b.mei && a.def === b.def)
}

// ── 5. Clube sem elenco nao quebra ─────────────────────────────────────────
{
  const pal = lidos.find(t => t.curto === "PAL")!
  const fantasma = teamSectorRatings({ ...pal, nome: "Clube Inexistente FC", curto: "XXX", file_key: "inexistente" })
  const ok = [fantasma.overall, fantasma.ata, fantasma.mei, fantasma.def]
    .every(v => Number.isFinite(v) && v >= 40 && v <= 95)
  checar("clube sem elenco devolve numeros validos", ok, JSON.stringify(fantasma))
}

console.log(falhas === 0 ? "\n== TODOS OS TESTES PASSARAM ==" : `\n== ${falhas} FALHA(S) ==`)
process.exit(falhas === 0 ? 0 : 1)
