// GANHAR UMA CONTINENTAL PRECISA TER CONSEQUENCIA.
//
// Pergunta do usuario: o que acontece se eu ganhar a Sul-Americana ou a Europa
// League? Antes: so a cerimonia — o titulo nao entrava no seasonHistory, entao
// nao virava trofeu, nao dava vaga na Recopa/Supercopa, nao classificava para a
// Libertadores/Champions e nao rendia premio.
//
// Estes testes cobrem as pecas puras da correcao (o registro do titulo no
// seasonHistory e testado de fato pelo fluxo de partida no jogo).

import { berthsForSeason, continentalTitleBerth } from "../lib/super-cups"
import { cupTitlePrize } from "../lib/use-game-manager"
import { buildCareerStats } from "../lib/hall-of-fame-engine"
import type { SeasonRecord } from "../lib/career-types"

let falhas = 0
function checar(nome: string, ok: boolean, detalhe = "") {
  console.log(`${ok ? "ok" : "FALHOU"}  ${nome}${detalhe ? ` — ${detalhe}` : ""}`)
  if (!ok) falhas++
}

// Um registro de titulo de copa como o que o jogo passa a gravar (posicao 1).
function tituloCopa(competition: string, curto: string, season: number): SeasonRecord {
  return {
    season, competition, position: 1, points: 0, won: 0, drawn: 0, lost: 0,
    goalsFor: 0, goalsAgainst: 0, champion: curto, managerName: "Técnico",
    promoted: false, relegated: false, teamCurto: curto, teamNome: curto,
  }
}

// ── 1. Premiacao por peso da competicao ─────────────────────────────────────
{
  const liber = cupTitlePrize("CONMEBOL Libertadores")
  const sula = cupTitlePrize("CONMEBOL Sul-Americana")
  const europa = cupTitlePrize("UEFA Europa League")
  const champions = cupTitlePrize("UEFA Champions League")
  const estadual = cupTitlePrize("Campeonato Gaúcho")
  console.log(`   premios: Liberta=${liber} Sula=${sula} Europa=${europa} Champions=${champions} estadual=${estadual}`)
  checar("continental de topo paga mais que a secundaria", liber > sula && champions > europa)
  checar("titulo continental paga mais que estadual", sula > estadual)
  checar("todo titulo paga algo", [liber, sula, europa, champions, estadual].every(v => v > 0))
}

// ── 2. Sul-Americana -> Recopa; Europa League -> Supercopa da UEFA ──────────
{
  const histSula = [tituloCopa("CONMEBOL Sul-Americana", "GRE", 2026)]
  const vagasSula = berthsForSeason(histSula, "GRE", 2027)
  checar("campeao da Sul-Americana ganha a Recopa", vagasSula.some(v => v.id === "recopa_sulamericana"),
    vagasSula.map(v => v.id).join(", "))

  const histEuropa = [tituloCopa("UEFA Europa League", "TOT", 2026)]
  const vagasEuropa = berthsForSeason(histEuropa, "TOT", 2027)
  checar("campeao da Europa League ganha a Supercopa da UEFA", vagasEuropa.some(v => v.id === "supercopa_uefa"),
    vagasEuropa.map(v => v.id).join(", "))
}

// ── 3. Classificacao para a continental principal ──────────────────────────
{
  const sula = continentalTitleBerth([tituloCopa("CONMEBOL Sul-Americana", "GRE", 2026)], "GRE", 2027)
  const europa = continentalTitleBerth([tituloCopa("UEFA Europa League", "TOT", 2026)], "TOT", 2027)
  const nada = continentalTitleBerth([], "GRE", 2027)
  checar("campeao da Sul-Americana classifica para a principal (Libertadores)", sula === "primary")
  checar("campeao da Europa League classifica para a principal (Champions)", europa === "primary")
  checar("sem titulo continental, sem vaga garantida", nada === null)

  // So conta a temporada IMEDIATAMENTE anterior.
  const antigo = continentalTitleBerth([tituloCopa("CONMEBOL Sul-Americana", "GRE", 2024)], "GRE", 2027)
  checar("titulo de 3 anos atras nao garante vaga agora", antigo === null)
}

// ── 4. Reputacao do tecnico: o titulo de copa conta como trofeu ────────────
{
  const semTitulo = buildCareerStats([{
    season: 2026, competition: "Brasileirão Série A", position: 5, points: 60,
    won: 18, drawn: 6, lost: 14, goalsFor: 55, goalsAgainst: 50, champion: "",
    managerName: "T", promoted: false, relegated: false, teamCurto: "GRE", teamNome: "Grêmio",
  }])
  const comTitulo = buildCareerStats([
    {
      season: 2026, competition: "Brasileirão Série A", position: 5, points: 60,
      won: 18, drawn: 6, lost: 14, goalsFor: 55, goalsAgainst: 50, champion: "",
      managerName: "T", promoted: false, relegated: false, teamCurto: "GRE", teamNome: "Grêmio",
    },
    tituloCopa("CONMEBOL Sul-Americana", "GRE", 2026),
  ])
  console.log(`   reputacao: sem titulo=${semTitulo.reputation} com titulo=${comTitulo.reputation} | trofeus: ${semTitulo.trophies.length} -> ${comTitulo.trophies.length}`)
  checar("o titulo de copa vira trofeu na carreira", comTitulo.trophies.length > semTitulo.trophies.length)
  checar("a reputacao sobe com o titulo", comTitulo.reputation > semTitulo.reputation)
}

console.log(falhas === 0 ? "\n== TODOS OS TESTES PASSARAM ==" : `\n== ${falhas} FALHA(S) ==`)
process.exit(falhas === 0 ? 0 : 1)
