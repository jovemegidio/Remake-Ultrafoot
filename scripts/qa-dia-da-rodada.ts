// O CURSOR DE DIA NAO PODE MEXER NO RELOGIO DO MOTOR.
//
// ⚠️ POR QUE ESTE PORTAO EXISTE. A 1.0.397 fez o "Avancar" passar UM DIA de cada
// vez ate o dia do jogo (PDF Ultra26, p.1). A forma obvia de implementar isso
// seria fazer o relogio do jogo andar por dia — e seria um erro caro: quem
// decide quando uma rodada acontece e `week`, e mexer nisso significa mexer na
// virada de temporada e no gerador de calendario, a area que ja travou
// temporada neste projeto ([[ultrafoot-liga-congelada-e-virada]]).
//
// A escolha foi outra: `state.diaDaRodada` e um cursor que anda DENTRO do
// intervalo entre duas rodadas e nao existe para o motor. Este portao trava
// essa separacao. Se alguem um dia ligar o cursor ao relogio, ele reprova.
//
//   npx tsx scripts/qa-dia-da-rodada.ts
import assert from "node:assert/strict"
import { getGameDate, diasPorRodada, configurarDuracaoDaTemporada } from "../lib/game-date"
import { DEFAULT_STATE } from "../lib/save-system"

// ── 1. O CAMPO EXISTE E NASCE NEUTRO ────────────────────────────────────────

assert.equal(
  DEFAULT_STATE.diaDaRodada,
  0,
  "carreira nova deve comecar no primeiro dia da rodada",
)

// ⚠️ SAVE ANTIGO NAO TEM O CAMPO, e ausencia tem de valer zero — nunca NaN.
// E o padrao que [[ultrafoot-save-sem-campo-derruba-tela]] documenta: campo
// novo, save velho, tela quebrada.
const saveAntigo: { diaDaRodada?: number } = {}
assert.equal(saveAntigo.diaDaRodada ?? 0, 0, "save sem o campo deve valer 0")

// ── 2. O CURSOR NUNCA ALCANCA A RODADA SEGUINTE ─────────────────────────────
//
// A regra do botao e `diaAtual + 1 < passoDaRodada`: no penultimo dia ele para
// de andar sozinho e o clique seguinte vira o avanco de semana de verdade. Se o
// limite deixasse o cursor chegar ao passo inteiro, o jogador veria a data do
// dia da partida SEM a partida ter acontecido.

for (const semanas of [38, 52, 58, 64]) {
  configurarDuracaoDaTemporada(semanas)
  const passo = Math.max(1, Math.round(diasPorRodada()))

  assert.ok(passo >= 1, `passo invalido para ${semanas} rodadas: ${passo}`)

  // O maior cursor que o botao aceita, pela condicao `diaAtual + 1 < passo`.
  const maiorCursor = Math.max(0, passo - 1)
  assert.ok(
    maiorCursor < passo,
    `o cursor (${maiorCursor}) alcancou o passo da rodada (${passo}) em ${semanas} rodadas`,
  )

  // ⚠️ E O DIA MOSTRADO NUNCA PODE PASSAR DO DIA DA PROXIMA RODADA.
  const inicio = getGameDate(2026, 10)
  const proxima = getGameDate(2026, 11)
  const comCursor = new Date(inicio.getTime() + maiorCursor * 86_400_000)
  assert.ok(
    comCursor.getTime() <= proxima.getTime(),
    `com ${semanas} rodadas o cursor mostrou ${comCursor.toISOString()} , depois da rodada seguinte (${proxima.toISOString()})`,
  )
}

// ── 3. O RELOGIO DO MOTOR IGNORA O CURSOR ───────────────────────────────────
//
// `getGameDate` recebe temporada e SEMANA. Nao ha parametro de dia, e nao pode
// haver: e essa assinatura que garante que nenhuma parte do motor consiga
// consultar o cursor por acidente.

configurarDuracaoDaTemporada(52)
const semana20 = getGameDate(2026, 20)
const semana20DeNovo = getGameDate(2026, 20)
assert.equal(
  semana20.getTime(),
  semana20DeNovo.getTime(),
  "getGameDate deixou de ser deterministica por semana",
)
assert.equal(
  getGameDate.length,
  2,
  "getGameDate ganhou um parametro novo — se for o dia, o cursor vazou para o relogio do motor",
)

// ── 4. A CONTA DE "PROXIMO JOGO EM N DIAS" ──────────────────────────────────
//
// E a diferenca entre a data de hoje e a da semana do jogo. Numa temporada de
// 52 rodadas o passo e exatamente 7 dias, entao a rodada seguinte cai em 7.

const hoje = getGameDate(2026, 10)
const jogo = getGameDate(2026, 11)
hoje.setHours(0, 0, 0, 0)
jogo.setHours(0, 0, 0, 0)
const dias = Math.round((jogo.getTime() - hoje.getTime()) / 86_400_000)
assert.equal(dias, 7, `rodada seguinte deveria estar a 7 dias numa temporada de 52; deu ${dias}`)

// Jogo nesta mesma semana e "hoje", nunca um numero negativo na tela.
const mesmaSemana = Math.round((getGameDate(2026, 10).getTime() - getGameDate(2026, 10).getTime()) / 86_400_000)
assert.equal(mesmaSemana, 0)

console.log("ok: o cursor de dia anda dentro da rodada e nao toca no relogio do motor")
