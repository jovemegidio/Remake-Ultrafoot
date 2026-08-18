// O DESAFIO DO RUSH TEM DE SER POSSÍVEL — e não garantido.
//
// ⚠️ POR QUE ISTO É UM GATE, E NÃO CONFIANÇA NO NÚMERO QUE EU ESCOLHI. A
// primeira versão do modo sorteava até DOIS gols de desvantagem e pedia o
// empate: dois gols em trinta minutos. Medido com o motor de verdade, vinte
// tentativas seguidas deram ZERO sucessos.
//
// Um desafio impossível não é difícil — é quebrado. E ele não quebra fazendo
// nada errado na tela: abre, joga, e o jogador perde sempre. Ele fecha e não
// volta, e ninguém descobre que o defeito era um número.
//
// O gate cobra as duas pontas: precisa dar para vencer, e não pode vencer
// sempre. Entre elas há um modo; fora delas há uma animação.
//
// Uso: npx tsx scripts/test-manager-rush.ts

import { allTeams } from "@/lib/teams-data"
import { desafioDoDia, avaliarRush, forcasDoRush, MINUTO_INICIAL, type PosturaRush } from "@/lib/manager-rush"
import {
  createInitialState, startMatch, tickMinute, semearMotorDePartida, type MatchState,
} from "@/lib/match-engine"

let falhas = 0
const erro = (m: string) => { console.log("FALHA: " + m); falhas++ }
const ok = (m: string) => console.log("ok   " + m)

/** Joga o desafio do minuto 60 ao apito, como a tela faz. */
function jogar(desafio: NonNullable<ReturnType<typeof desafioDoDia>>, semente: number, postura: PosturaRush = "equilibrado"): boolean {
  semearMotorDePartida(semente)
  let estado: MatchState = startMatch(createInitialState())
  estado = {
    ...estado,
    phase: "second",
    minute: MINUTO_INICIAL,
    home: { ...estado.home, goals: desafio.golsPro },
    away: { ...estado.away, goals: desafio.golsContra },
  }
  let voltas = 0
  while (estado.phase !== "fulltime" && voltas++ < 120) {
    if (estado.pendingVar || estado.pendingPenalty) {
      estado = { ...estado, pendingVar: null, pendingPenalty: null }
    }
    const forcas = forcasDoRush(desafio, postura)
    estado = tickMinute(estado, {
      homeTeam: desafio.clube, awayTeam: desafio.adversario,
      homeRating: forcas.homeRating, awayRating: forcas.awayRating,
      durationMinutes: 90,
    })
  }
  return avaliarRush(desafio, estado.home.goals, estado.away.goals)
}

// ── 1. O desafio existe e é o MESMO no mesmo dia ────────────────────────────
{
  const a = desafioDoDia(allTeams, "2026-08-18")
  const b = desafioDoDia(allTeams, "2026-08-18")
  const c = desafioDoDia(allTeams, "2026-08-19")
  if (!a) { erro("nao ha desafio para a data") }
  else if (a.clube.file_key !== b?.clube.file_key) {
    erro("o desafio muda ao reabrir a tela — reabrir ate vir um facil deixa de ser desafio")
  } else {
    ok(`desafio do dia estavel: ${a.clube.nome} ${a.golsPro}-${a.golsContra} ${a.adversario.nome}`)
  }
  if (a && c && a.clube.file_key === c.clube.file_key && a.golsContra === c.golsContra) {
    erro("dois dias seguidos com o mesmo desafio")
  }
  if (a && a.clube.file_key === a.adversario.file_key) {
    erro("o clube esta jogando contra ele mesmo")
  }
  if (a && a.golsContra <= a.golsPro) {
    erro(`o desafio comeca sem desvantagem (${a.golsPro}-${a.golsContra}) — nao ha o que virar`)
  }
}

// ── 2. Dá para vencer, e não se vence sempre ────────────────────────────────
for (const data of ["2026-08-18", "2026-09-02", "2026-10-15"]) {
  const desafio = desafioDoDia(allTeams, data)
  if (!desafio) continue
  let sucessos = 0
  const tentativas = 24
  for (let s = 1; s <= tentativas; s++) if (jogar(desafio, s)) sucessos++

  const taxa = sucessos / tentativas
  if (sucessos === 0) {
    erro(`${data}: ${desafio.objetivo} contra o ${desafio.adversario.nome} e IMPOSSIVEL `
      + `(0 de ${tentativas}) — o jogador perde sempre e fecha a tela`)
  } else if (taxa > 0.85) {
    erro(`${data}: ${(taxa * 100).toFixed(0)}% de sucesso — nao e desafio, e formalidade`)
  } else {
    ok(`${data}: ${sucessos}/${tentativas} (${(taxa * 100).toFixed(0)}%) — ${desafio.objetivo}`)
  }
}

semearMotorDePartida(null)

console.log(falhas === 0
  ? "\nRUSH OK — da para virar, e nao vira sozinho."
  : `\n${falhas} problema(s): o desafio do Rush pode estar impossivel ou gratuito.`)
process.exit(falhas === 0 ? 0 : 1)
