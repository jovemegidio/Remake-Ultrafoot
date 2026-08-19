// QA DO ATLETA SEM CLUBE — a rescisão que o usuário pediu (1.0.358).
//
// O pedido: "pedir demissão no modo carreira de jogador deve ser como na vida
// real: o jogador fica sem time, até receber propostas de times superiores ou
// inferiores — vai depender do desempenho dele no clube anterior —, onde o
// jogador/agente farão contraproposta até fechar o contrato ou não".
//
// O que este teste garante, na ordem em que a coisa acontece:
//   1. RESCINDIR deixa o atleta sem clube, sem salário e sem proposta na mesa;
//   2. o TEMPO passa por semana e o telefone toca — e não toca no vazio: quem
//      jogou bem recebe de clube MAIOR do que quem jogou mal (é o "superiores
//      ou inferiores" ligado ao desempenho);
//   3. a MESA tem preço: insistir esgota a paciência e o clube sai — e
//      proposta retirada não se assina depois ("ou não");
//   4. ASSINAR fecha o estado: clube novo, calendário novo, rodada zerada;
//   5. `jogarProximaRodada` NÃO anda enquanto ele está sem clube (senão o
//      atleta pontuaria por um time que já não é dele).
import { allTeams } from "@/lib/teams-data"
import {
  aceitarProposta, avancarSemanaSemClube, contrapropor,
  criarAtletaDaCarreira, criarCarreiraDeJogador, jogarProximaRodada, rescindirContrato,
  type EstadoCarreiraDeJogador,
} from "@/lib/carreira-de-jogador"

let falhas = 0
const erro = (m: string) => { console.log("FALHA: " + m); falhas++ }

const clube = allTeams.find(t => t.prestigio >= 80 && t.prestigio <= 92) ?? allTeams[0]

function carreiraBase(nome: string): EstadoCarreiraDeJogador {
  const atleta = criarAtletaDaCarreira({
    nome, posicao: "ATA", idade: 24, nacionalidade: "Brasil",
    pePreferido: "direito", alturaCm: 182, pesoKg: 76, numero: 9,
  })
  return criarCarreiraDeJogador(clube, atleta, "Liga de Teste", 2026)
}

/** Uma temporada FALSA, escrita na mão: o teste precisa do desempenho, não do jogo. */
function comDesempenho(
  estado: EstadoCarreiraDeJogador,
  { jogos, gols, notaMedia, overall, reputacao }: { jogos: number; gols: number; notaMedia: number; overall: number; reputacao: number },
): EstadoCarreiraDeJogador {
  return {
    ...estado,
    atleta: { ...estado.atleta, overall },
    reputacao,
    notaDoTreinador: notaMedia >= 7 ? 78 : 22,
    temporadaAtual: {
      ...estado.temporadaAtual,
      jogos, titularidades: jogos, minutos: jogos * 85,
      gols, assistencias: Math.round(gols / 3), somaDasNotas: jogos * notaMedia,
    },
  }
}

// ── 1. Rescindir ────────────────────────────────────────────────────────────
const craque = rescindirContrato(comDesempenho(carreiraBase("Craque Teste"), {
  jogos: 34, gols: 22, notaMedia: 7.8, overall: 84, reputacao: 72,
}))
if (!craque.semClube) erro("rescindir nao deixou o atleta sem clube")
if (craque.contrato.salarioSemanal !== 0) erro("sem clube e com salario: o contrato nao foi encerrado")
if (craque.propostas.length !== 0) erro("as propostas do contrato antigo sobreviveram a rescisao")
if (craque.notaDoTreinador !== 0) erro("sem clube e com confianca de treinador")
console.log(`craque: cartaz ${craque.semClube!.cartaz}`)

const reserva = rescindirContrato(comDesempenho(carreiraBase("Reserva Teste"), {
  jogos: 5, gols: 0, notaMedia: 5.6, overall: 58, reputacao: 18,
}))
console.log(`reserva: cartaz ${reserva.semClube!.cartaz}`)
if (craque.semClube!.cartaz <= reserva.semClube!.cartaz) {
  erro("o cartaz nao distingue quem jogou bem de quem jogou mal")
}

// ── 2. O telefone toca conforme o cartaz ────────────────────────────────────
function mercado(estado: EstadoCarreiraDeJogador, semanas: number) {
  let atual = estado
  let melhorPrestigio = 0
  let quantasChegaram = 0
  const vistas = new Set<string>()
  for (let i = 0; i < semanas; i++) {
    atual = avancarSemanaSemClube(atual)
    for (const p of atual.propostas) {
      if (vistas.has(p.id)) continue
      vistas.add(p.id)
      quantasChegaram++
      melhorPrestigio = Math.max(melhorPrestigio, p.prestigio)
    }
  }
  return { atual, melhorPrestigio, quantasChegaram }
}

const mercadoDoCraque = mercado(craque, 8)
const mercadoDoReserva = mercado(reserva, 8)
console.log(`craque: ${mercadoDoCraque.quantasChegaram} proposta(s), melhor prestigio ${mercadoDoCraque.melhorPrestigio}`)
console.log(`reserva: ${mercadoDoReserva.quantasChegaram} proposta(s), melhor prestigio ${mercadoDoReserva.melhorPrestigio}`)

if (mercadoDoCraque.quantasChegaram === 0) erro("oito semanas e nenhum clube ligou para quem fez 22 gols")
// ⚠️ E O BECO SEM SAIDA NAO PODE VOLTAR: quem jogou mal recebe MENOS e de clube
// menor, mas nunca zero — senao a carreira congela sem caminho de volta.
if (mercadoDoReserva.quantasChegaram === 0) erro("oito semanas e NENHUM clube ligou: o atleta ficou preso sem clube")
if (mercadoDoCraque.melhorPrestigio <= mercadoDoReserva.melhorPrestigio) {
  erro("quem jogou mal recebeu proposta tao boa quanto quem jogou bem")
}
if (mercadoDoCraque.atual.semClube!.diario.length === 0) erro("o diario do mercado ficou vazio")
// A ferrugem: parado, o cartaz cai.
if (mercadoDoCraque.atual.semClube!.cartaz >= craque.semClube!.cartaz) {
  erro("oito semanas parado e o cartaz nao cedeu")
}

// ── 3. A mesa tem preco ─────────────────────────────────────────────────────
let comMesa = mercadoDoCraque.atual
const alvo = comMesa.propostas[0]
if (!alvo) {
  erro("sem proposta na mesa para negociar")
} else {
  const salarioInicial = alvo.salarioSemanal
  let retirou = false
  for (let i = 0; i < 6 && !retirou; i++) {
    comMesa = contrapropor(comMesa, alvo.id, "salario")
    const p = comMesa.propostas.find(x => x.id === alvo.id)
    if (!p) break
    retirou = Boolean(p.negociacao?.retirada)
    if (!p.negociacao?.ultimaResposta) erro("o clube nao respondeu a contraproposta")
  }
  const depois = comMesa.propostas.find(x => x.id === alvo.id)
  console.log(`mesa: ${depois?.negociacao?.rodadas} rodada(s) de conversa | retirada: ${retirou} | salario ${salarioInicial} -> ${depois?.salarioSemanal}`)
  if (!retirou) erro("insistir seis vezes e o clube nunca sai da mesa: a paciencia nao tem fim")
  if (depois) {
    const tentouAssinar = aceitarProposta(comMesa, depois.id)
    if (tentouAssinar !== comMesa) erro("deu para assinar uma proposta que o clube ja tinha retirado")
  }
}

// ── 4. Assinar fecha o estado ───────────────────────────────────────────────
const paraAssinar = mercado(rescindirContrato(comDesempenho(carreiraBase("Assina Teste"), {
  jogos: 30, gols: 15, notaMedia: 7.5, overall: 80, reputacao: 60,
})), 6).atual
const escolhida = paraAssinar.propostas.find(p => !p.negociacao?.retirada)
if (!escolhida) {
  erro("nenhuma proposta para assinar depois de seis semanas")
} else {
  const assinado = aceitarProposta(paraAssinar, escolhida.id)
  console.log(`assinou com ${assinado.clubeNome} | rodada ${assinado.rodada} | ${assinado.calendario.filter(f => f.isUserMatch).length} jogos no calendario`)
  if (assinado.semClube) erro("assinou e continuou sem clube")
  if (assinado.clubeFileKey !== escolhida.clubeFileKey) erro("assinou com um clube e foi para outro")
  if (assinado.rodada !== 0) erro("assinou no meio do ano e herdou a rodada do clube antigo")
  if (assinado.temporadaAtual.jogos !== 0) erro("assinou e herdou os jogos que fez no clube antigo")
  if (assinado.calendario.filter(f => f.isUserMatch).length === 0) erro("assinou e ficou sem calendario")
  if (assinado.contrato.salarioSemanal !== escolhida.salarioSemanal) erro("o contrato assinado nao e o da proposta")
}

// ── 5. Sem clube nao se joga rodada ─────────────────────────────────────────
const congelado = avancarSemanaSemClube(craque)
if (jogarProximaRodada(congelado) !== congelado) {
  erro("a rodada andou com o atleta sem clube")
}

console.log(falhas === 0
  ? "SEM CLUBE OK — rescinde, o mercado responde ao desempenho, a mesa cansa e a assinatura fecha o ciclo."
  : `${falhas} FALHA(S)`)
process.exit(falhas === 0 ? 0 : 1)
