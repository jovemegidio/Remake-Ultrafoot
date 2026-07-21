// Prova que "Simular ate esta partida" chama advanceWeek() o numero certo de
// vezes — reproduzindo o relato: tres jogos em 1, 5 e 8 de janeiro; ao escolher
// o dia 8, o jogo simulava UM e abria a partida do dia 5.
//
//   npx tsx scripts/test-simular-ate-partida.ts

interface F { id: number; week: number; played: boolean; isUserMatch: boolean; dia: string }

/** Conta ANTIGA: diferenca de semanas. */
function contaPorSemana(alvo: F, semanaAtual: number): number {
  return Math.max(0, alvo.week - semanaAtual - 1)
}

/** Conta NOVA: posicao na fila das minhas partidas pendentes. */
function contaPorFila(alvo: F, fixtures: F[]): number {
  const fila = fixtures
    .filter(f => f.isUserMatch && !f.played)
    .sort((a, b) => a.week - b.week || a.id - b.id)
  return Math.max(0, fila.findIndex(f => f.id === alvo.id))
}

/** Simula o motor: cada advanceWeek() resolve a partida pendente mais proxima. */
function partidaQueSeraAberta(fixtures: F[], chamadas: number): F | null {
  const fila = fixtures
    .filter(f => f.isUserMatch && !f.played)
    .sort((a, b) => a.week - b.week || a.id - b.id)
  return fila[chamadas] ?? null
}

let falhas = 0
function checa(nome: string, obtido: unknown, esperado: unknown) {
  const ok = obtido === esperado
  if (!ok) falhas++
  console.log(`${ok ? "OK  " : "FALHA"} ${nome}: obtido ${String(obtido)}, esperado ${String(esperado)}`)
}

// ── Caso do relato ────────────────────────────────────────────────────────────
// Copa do Brasil: 1/jan (semana 1), 5/jan (semana 2), 8/jan (semana 2).
// Repare: DUAS partidas na semana 2 — e por isso que contar semanas falha.
const calendario: F[] = [
  { id: 101, week: 1, played: false, isUserMatch: true, dia: "1/jan" },
  { id: 102, week: 2, played: false, isUserMatch: true, dia: "5/jan" },
  { id: 103, week: 2, played: false, isUserMatch: true, dia: "8/jan" },
]
const alvo = calendario[2] // o jogador clicou no dia 8
const semanaAtual = 0

console.log("Relato: escolher o jogo de 8/jan com jogos pendentes em 1, 5 e 8/jan\n")

const antigo = contaPorSemana(alvo, semanaAtual)
const novo = contaPorFila(alvo, calendario)

checa("conta antiga (por semana)", antigo, 1)
checa("conta nova (por fila)", novo, 2)

checa("com a conta ANTIGA, abre a partida de", partidaQueSeraAberta(calendario, antigo)?.dia, "5/jan")
checa("com a conta NOVA, abre a partida de", partidaQueSeraAberta(calendario, novo)?.dia, "8/jan")

// ── Alvo ja e o proximo jogo: nada a simular ─────────────────────────────────
checa("alvo e o proximo jogo", contaPorFila(calendario[0], calendario), 0)

// ── Partidas ja jogadas nao entram na conta ──────────────────────────────────
const comJogados: F[] = [
  { id: 101, week: 1, played: true, isUserMatch: true, dia: "1/jan" },
  { id: 102, week: 2, played: false, isUserMatch: true, dia: "5/jan" },
  { id: 103, week: 2, played: false, isUserMatch: true, dia: "8/jan" },
]
checa("ignora partida ja jogada", contaPorFila(comJogados[2], comJogados), 1)

// ── Partidas de outros times nao entram na conta ─────────────────────────────
const comTerceiros: F[] = [
  { id: 201, week: 1, played: false, isUserMatch: false, dia: "1/jan (outros)" },
  { id: 202, week: 1, played: false, isUserMatch: true, dia: "2/jan" },
  { id: 203, week: 2, played: false, isUserMatch: false, dia: "5/jan (outros)" },
  { id: 204, week: 2, played: false, isUserMatch: true, dia: "8/jan" },
]
checa("ignora jogo de outros times", contaPorFila(comTerceiros[3], comTerceiros), 1)

// ── Uma partida por semana: as duas contas concordam ─────────────────────────
const espacado: F[] = [
  { id: 301, week: 1, played: false, isUserMatch: true, dia: "s1" },
  { id: 302, week: 2, played: false, isUserMatch: true, dia: "s2" },
  { id: 303, week: 3, played: false, isUserMatch: true, dia: "s3" },
]
checa("espacado: antiga", contaPorSemana(espacado[2], 0), 2)
checa("espacado: nova", contaPorFila(espacado[2], espacado), 2)

console.log(falhas === 0 ? "\nTodos os casos passaram." : `\n${falhas} caso(s) falharam.`)
process.exit(falhas === 0 ? 0 : 1)
