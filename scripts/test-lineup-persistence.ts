// A ESCALACAO SALVA NAO PODE VOLTAR PARA A PADRAO.
//
// Relato do jogador (2026-07-23): "a escalacao salva para a partida continua
// voltando pra escalacao padrao apos a partida finalizada".
//
// Causa: a validacao do XI declarado era tudo-ou-nada — se nao fossem
// EXATAMENTE 11 com 1 goleiro, o time inteiro do tecnico era descartado em
// favor do automatico. E como as telas gravam de volta o que exibem, a
// escalacao salva era destruida de vez.
//
// Basta um evento comum para desequilibrar a conta: a conversa com o reserva
// prometia titularidade criando um 12o titular, e um titular vendido/emprestado
// deixava o XI com 10.

import { repararEscalacao, pickStartingXI } from "../lib/formations"

interface P { id: number; nome: string; position: string; overall: number; isStarter?: boolean }

function elenco(): P[] {
  const pos = ["GOL", "ZAG", "ZAG", "LD", "LE", "VOL", "MEI", "MEI", "PE", "PD", "ATA"]
  return Array.from({ length: 22 }, (_, i) => ({
    id: i + 1, nome: `J${i + 1}`, position: pos[i % 11], overall: 60 + ((i * 7) % 25),
  }))
}

/** Reproduz o caminho de use-user-roster: conserta, so cai no automatico se nao der. */
function xiExibido(squad: P[]) {
  const declarados = squad.filter(p => p.isStarter)
  const reparado = repararEscalacao(declarados, squad, p => p.position, p => p.overall)
  return reparado?.starters ?? pickStartingXI(squad, p => p.position, p => p.overall).starters
}

let falhas = 0
function checar(nome: string, ok: boolean, detalhe = "") {
  console.log(`${ok ? "ok" : "FALHOU"}  ${nome}${detalhe ? ` — ${detalhe}` : ""}`)
  if (!ok) falhas++
}

// O tecnico escolhe DE PROPOSITO um XI que nao e o melhor por overall: se o
// teste usasse o melhor XI, o automatico daria o mesmo resultado e nao provaria
// nada.
function escalacaoDoTecnico(squad: P[]): P[] {
  const gol = squad.find(p => p.position === "GOL")!
  const linha = squad.filter(p => p.position !== "GOL").slice(-10)
  const xi = [gol, ...linha]
  xi.forEach(p => { p.isStarter = true })
  return xi
}

// ── 1. Nada acontece: o XI salvo continua igual ────────────────────────────
{
  const squad = elenco()
  const salvo = escalacaoDoTecnico(squad).map(p => p.id).sort((a, b) => a - b)
  const saida = xiExibido(squad).map(p => p.id).sort((a, b) => a - b)
  checar("XI salvo sobrevive sem eventos", saida.join() === salvo.join())
}

// ── 2. Conversa com reserva cria um 12o titular ────────────────────────────
{
  const squad = elenco()
  const salvo = escalacaoDoTecnico(squad)
  const promovido = squad.find(p => !p.isStarter && p.position !== "GOL")!
  promovido.isStarter = true

  const saida = xiExibido(squad)
  checar("12o titular: XI volta a ter 11", saida.length === 11, `${saida.length}`)
  checar("12o titular: 1 goleiro", saida.filter(p => p.position === "GOL").length === 1)
  checar("12o titular: o promovido esta em campo", saida.some(p => p.id === promovido.id))
  const mantidos = saida.filter(p => salvo.some(s => s.id === p.id)).length
  checar("12o titular: escalacao do tecnico preservada (>=10 dos 11)", mantidos >= 10, `${mantidos}/11 mantidos`)
}

// ── 3. Titular vendido deixa o XI com 10 ───────────────────────────────────
{
  const squad = elenco()
  const salvo = escalacaoDoTecnico(squad)
  const vendido = salvo.find(p => p.position !== "GOL")!
  const restante = squad.filter(p => p.id !== vendido.id)

  const declarados = restante.filter(p => p.isStarter)
  const saida = repararEscalacao(declarados, restante, p => p.position, p => p.overall)?.starters ?? []
  checar("titular vendido: XI volta a ter 11", saida.length === 11, `${saida.length}`)
  const mantidos = saida.filter(p => salvo.some(s => s.id === p.id)).length
  checar("titular vendido: os outros 10 continuam titulares", mantidos >= 10, `${mantidos}/10 mantidos`)
}

// ── 4. Dois goleiros declarados ────────────────────────────────────────────
{
  const squad = elenco()
  escalacaoDoTecnico(squad)
  const segundoGol = squad.filter(p => p.position === "GOL").find(p => !p.isStarter)!
  segundoGol.isStarter = true
  const saida = xiExibido(squad)
  checar("2 goleiros: sobra exatamente 1", saida.filter(p => p.position === "GOL").length === 1)
  checar("2 goleiros: XI com 11", saida.length === 11, `${saida.length}`)
}

// ── 5. Sem escalacao salva: continua caindo no automatico ──────────────────
{
  const squad = elenco()
  const saida = xiExibido(squad)
  checar("sem XI salvo: monta o automatico", saida.length === 11 && saida.filter(p => p.position === "GOL").length === 1)
}

console.log(falhas === 0 ? "\n== TODOS OS TESTES PASSARAM ==" : `\n== ${falhas} FALHA(S) ==`)
process.exit(falhas === 0 ? 0 : 1)
