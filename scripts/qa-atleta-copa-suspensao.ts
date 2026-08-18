// GATE 1.0.351 — A TEMPORADA DO ATLETA TEM COPA, E O CARTAO TEM PRECO.
//
// O que ele protege, e por que existe:
//
//  1. Ate a 1.0.351 `criarCarreiraDeJogador` montava `generateSeasonFixtures` e
//     mais nada: um atleta do Flamengo vivia o ano sem Copa do Brasil e sem
//     Libertadores. Aqui a copa nacional e a continental precisam APARECER na
//     sumula do atleta — nao basta o chaveamento existir no estado.
//
//  2. `simulateCupRound` resolve cada confronto por `teamMap.get(curto)` e PULA
//     em silencio o que nao encontrar. Passando os clubes da LIGA para a
//     continental, todo confronto era ignorado: o chaveamento andava de fase sem
//     jogo nenhum e a competicao terminava sem campeao. E o tipo de defeito que
//     nao parece defeito — por isso ele tem teste.
//
//  3. Cartao vermelho nao custava NADA na carreira de atleta: os contadores
//     subiam e o expulso entrava na rodada seguinte. A suspensao usa a mesma
//     funcao do modo de tecnico (`suspensaoPorCartoes`).
//
// ⚠️ A partida usa Math.random — sem `semearMotorDePartida` este gate daria
// veredicto diferente a cada execucao. Ver [[ultrafoot-1-0-347-348]].

import {
  criarAtletaDaCarreira, criarCarreiraDeJogador, encerrarTemporada, jogarProximaRodada,
  type EstadoCarreiraDeJogador,
} from "../lib/carreira-de-jogador"
import { getTeamByShort } from "../lib/teams-data"
import { semearMotorDePartida } from "../lib/match-engine"

const falhar = (mensagem: string): never => { throw new Error(mensagem) }
const atletaPadrao = () => criarAtletaDaCarreira({
  nome: "Antonio Teste", posicao: "ATA", idade: 18, nacionalidade: "Brasil",
  pePreferido: "direito", alturaCm: 180, pesoKg: 74, numero: 19,
})

function temporadaInteira(inicial: EstadoCarreiraDeJogador): EstadoCarreiraDeJogador {
  let estado = inicial
  const competicoes = new Set<string>()
  let voltas = 0
  while (!estado.temporadaEncerrada && voltas++ < 80) {
    estado = jogarProximaRodada(estado)
    for (const p of estado.ultimasPartidas) competicoes.add(p.competicao)
  }
  ;(estado as EstadoCarreiraDeJogador & { _competicoes?: string[] })._competicoes = [...competicoes]
  return estado
}

semearMotorDePartida(20260351)

// ── 1. Clube grande: copa nacional E continental ────────────────────────────
const flamengo = getTeamByShort("FLA") ?? falhar("Flamengo nao encontrado")
let grande = criarCarreiraDeJogador(flamengo, atletaPadrao(), "Brasileirao Serie A", 2026)
if (grande.copa?.competition !== "Copa do Brasil") falhar(`copa nacional errada: ${grande.copa?.competition}`)
if (!grande.continental) falhar("clube de G4 ficou sem continental")

grande = temporadaInteira(grande)
const competicoes = (grande as EstadoCarreiraDeJogador & { _competicoes?: string[] })._competicoes ?? []
if (!competicoes.some(c => c === "Copa do Brasil")) falhar(`o atleta nao jogou a copa nacional (jogou: ${competicoes.join(", ")})`)
if (!grande.copa?.champion) falhar("copa nacional terminou sem campeao")
if (!grande.continental?.champion) falhar("continental terminou sem campeao — os participantes do torneio nao chegaram ao simulador")

// ── 2. Titulo de mata-mata entra na carreira ────────────────────────────────
const campeaoDaCopa = grande.copa?.champion === grande.clubeNome
const campeaoContinental = grande.continental?.champion === grande.clubeNome
const encerrada = encerrarTemporada({ ...grande, temporadaEncerrada: true })
if (campeaoDaCopa && !encerrada.titulos.some(t => t.startsWith("Copa do Brasil"))) falhar("campeao da copa sem titulo registrado")
if (campeaoContinental && !encerrada.titulos.some(t => t.startsWith("Libertadores"))) falhar("campeao continental sem titulo registrado")
if (encerrada.amarelosAcumulados !== 0) falhar("acumulo de amarelos nao zerou na virada")
if (!encerrada.copa || encerrada.copa.season !== encerrada.temporada) falhar("temporada nova comecou sem copa")

// ── 3. Clube pequeno nao entra na continental ───────────────────────────────
const pequeno = getTeamByShort("CRI") ?? getTeamByShort("JUV") ?? falhar("clube pequeno nao encontrado")
const modesto = criarCarreiraDeJogador(pequeno, atletaPadrao(), "Brasileirao Serie A", 2026)
if (modesto.continental) falhar(`${pequeno.nome} entrou na continental sem se classificar`)

// ── 4. Suspenso NAO joga ────────────────────────────────────────────────────
const suspenso: EstadoCarreiraDeJogador = {
  ...criarCarreiraDeJogador(flamengo, atletaPadrao(), "Brasileirao Serie A", 2026),
  suspensao: { partidasRestantes: 2, motivo: "expulsao" },
}
const depoisDeUma = jogarProximaRodada(suspenso)
if (depoisDeUma.temporadaAtual.jogos !== 0) falhar("atleta suspenso entrou em campo")
if ((depoisDeUma.suspensao?.partidasRestantes ?? 0) !== 1) falhar("a rodada nao descontou a suspensao")
if ((depoisDeUma.rodadasPerdidasPorSuspensao ?? 0) !== 1) falhar("rodada perdida por suspensao nao foi contada")
const depoisDeDuas = jogarProximaRodada(depoisDeUma)
if (depoisDeDuas.suspensao) falhar("a suspensao nao terminou depois de cumprida")

console.log("OK carreira de atleta: copa nacional, continental com participantes de verdade, titulos de mata-mata e suspensao por cartao")
