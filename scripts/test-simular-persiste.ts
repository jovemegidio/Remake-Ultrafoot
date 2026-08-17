// O GATE DA PARTIDA SIMULADA QUE PRECISA SOBREVIVER (1.0.341).
//
// ⚠️ POR QUE ELE EXISTE. Relato do usuario: "ao apertar em simular ele simula o
// jogo, mas ao voltar para o office e como se nao tivesse sido simulada". E o
// MESMO defeito ja tinha sido relatado antes com outro sintoma ("ao atualizar
// volta para antes de simular") e "corrigido" com um `flushPersistentStore()`
// no fim da simulacao rapida. Voltar com sintoma diferente e a assinatura de
// correcao no sintoma, nao na causa.
//
// Voltar ao escritorio e `hardNavigate`, ou seja RECARGA COMPLETA: tudo que
// estava so em memoria morre e o calendario e REMONTADO. Entao a pergunta que
// decide o bug e uma so: o que fica gravado basta para a partida voltar
// marcada como disputada?
//
// Quem responde isso e `reconcilePlayedFixtures`, o passo da remontagem. Este
// gate cobra o contrato dela nos tres caminhos que o jogo usa:
//   1. pela CHAVE (`completedFixtureKeys`), que e o que o patch grava;
//   2. pelo RESULTADO (`results`), com o placar certo;
//   3. e — o caso que mais quebra neste projeto — quando o calendario foi
//      REGENERADO e a chave salva ficou com semana/ID antigos.
//
// Uso: npx tsx scripts/test-simular-persiste.ts

import { getCalendarFixtureKey, reconcilePlayedFixtures } from "@/lib/use-game-manager"
import { allTeams } from "@/lib/teams-data"

let falhas = 0
const erro = (m: string) => { console.log("FALHA: " + m); falhas++ }

const TEMPORADA = 2026
const casa = allTeams[0]
const fora = allTeams[1]

type F = Parameters<typeof reconcilePlayedFixtures>[0][number]

function fixture(id: number, week: number): F {
  return {
    id,
    week,
    competition: "Campeonato Paraense",
    competitionType: "estadual",
    homeTeam: casa,
    awayTeam: fora,
    isUserMatch: true,
    played: false,
  } as unknown as F
}

// ── 1. A CHAVE sozinha marca como disputada ─────────────────────────────────
// E o caminho do `registerUserMatchResult`: ele grava `completedFixtureKeys` no
// patch. Se isto falhar, simular nunca sobrevive a uma recarga.
{
  const f = fixture(1, 1)
  const chave = getCalendarFixtureKey(f, TEMPORADA)
  const [depois] = reconcilePlayedFixtures([f], [], TEMPORADA, [chave])
  if (!depois.played) erro("a chave gravada NAO marcou a partida como disputada na remontagem")
  else console.log("chave: partida volta marcada como disputada")
}

// ── 2. O RESULTADO traz o placar de volta ───────────────────────────────────
{
  const f = fixture(2, 1)
  const chave = getCalendarFixtureKey(f, TEMPORADA)
  const resultado = {
    season: TEMPORADA, fixtureKey: chave, week: 1,
    homeTeam: casa.curto, awayTeam: fora.curto,
    competition: "Campeonato Paraense", homeScore: 3, awayScore: 1,
  }
  const [depois] = reconcilePlayedFixtures(
    [f], [resultado] as unknown as Parameters<typeof reconcilePlayedFixtures>[1], TEMPORADA, [],
  )
  if (!depois.played) erro("o resultado gravado NAO marcou a partida como disputada")
  else if (depois.homeScore !== 3 || depois.awayScore !== 1) {
    erro(`placar perdido na remontagem: ${depois.homeScore}-${depois.awayScore} (esperado 3-1)`)
  } else console.log("resultado: placar 3-1 sobrevive a remontagem")
}

// ── 3. Calendario REGENERADO: a chave velha nao pode perder a partida ───────
// Aqui a semana e o id mudaram (correcao de regulamento, migracao de save). A
// chave salva nao casa mais, e o pareamento tem de cair no caminho por clubes.
{
  const antigo = fixture(7, 1)
  const chaveVelha = getCalendarFixtureKey(antigo, TEMPORADA)
  const regenerado = fixture(99, 3)   // outro id, outra semana
  const [depois] = reconcilePlayedFixtures([regenerado], [], TEMPORADA, [chaveVelha])
  if (depois.played) {
    console.log("calendario regenerado: a partida continua marcada (casou por compatibilidade)")
  } else {
    erro("APOS REGENERAR O CALENDARIO a partida disputada volta como NAO disputada — "
      + "e exatamente o sintoma 'como se nao tivesse sido simulada'")
  }
}

// ── 4. Partida de outro confronto NAO pode ser marcada por tabela ───────────
// O oposto do bug: marcar demais faria o jogador perder jogos sem disputar.
{
  const outro = fixture(5, 2)
  const chaveDeOutro = getCalendarFixtureKey(fixture(1, 1), TEMPORADA)
  const naoJogado = { ...outro, homeTeam: allTeams[2], awayTeam: allTeams[3] } as F
  const [depois] = reconcilePlayedFixtures([naoJogado], [], TEMPORADA, [chaveDeOutro])
  if (depois.played) erro("uma partida de OUTRO confronto foi marcada como disputada")
  else console.log("confronto alheio: continua por disputar, como deve")
}

console.log(falhas === 0
  ? "\nREMONTAGEM OK — o que fica gravado basta para a partida voltar disputada."
  : `\n${falhas} problema(s): a partida simulada NAO sobrevive a volta ao escritorio.`)
process.exit(falhas === 0 ? 0 : 1)
