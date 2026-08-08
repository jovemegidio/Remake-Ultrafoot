// Cobre o MOTOR DE CONVERSA COM O EMPRESÁRIO, regra a regra.
//
// O que este teste protege não é o texto — é o CUSTO das decisões. Uma conversa
// em que recusar tudo sai de graça vira botão de "não" e o sistema morre; uma em
// que recusar é sempre catastrófico vira chantagem. O equilíbrio entre esses dois
// erros é o que está aqui.

import {
  intencaoDoTextoComAgente, valorDoTexto, responderAgente, aberturaDoAgente,
  type EstadoDoAgente,
} from "@/lib/conversa-agente"
import { DESGASTE_DE_RUPTURA, salarioJusto, type AtletaParaAgente } from "@/lib/pressao-do-agente"

let falhas = 0
function ok(cond: boolean, msg: string) {
  console.log(`  ${cond ? "ok  " : "FALHA"} ${msg}`)
  if (!cond) falhas++
}

function atleta(over: Partial<AtletaParaAgente> = {}): AtletaParaAgente {
  return {
    id: 1, nome: "Fulano", overall: 78, idade: 26, salarioMensal: 100_000,
    valorDeMercado: 12_000_000, semanasDeContrato: 80, minutosNaTemporada: 900,
    jogosDoClube: 20, titular: true, moral: 60, ...over,
  }
}

function estado(over: Partial<EstadoDoAgente> = {}): EstadoDoAgente {
  const a = over.atleta ?? atleta()
  return {
    nome: "Empresário", perfil: "razoavel", desgaste: 10, pedidosRecusados: 0,
    pedido: { tipo: "salario", salarioPedido: salarioJusto(a) },
    atleta: a, caixaDoClube: 50_000_000, ...over,
  }
}

console.log("== Conversa com o empresario ==")

// ── Leitura da intenção ──────────────────────────────────────────────────────
{
  ok(intencaoDoTextoComAgente("fechado, aceito") === "aceitar", "'fechado, aceito' -> aceitar")
  ok(intencaoDoTextoComAgente("nao aceito esse valor") !== "aceitar",
    "'NAO aceito' nao vira aceitar (negacao)")
  ok(intencaoDoTextoComAgente("ele tem contrato e vai cumprir") === "pressionar", "contrato -> pressionar")
  ok(intencaoDoTextoComAgente("consigo 120 mil") === "contrapor", "'consigo X' -> contrapor")
  ok(intencaoDoTextoComAgente("blablabla") === null, "texto sem sentido devolve null (pede clareza)")
}

// ── Valor dito na frase ──────────────────────────────────────────────────────
{
  ok(valorDoTexto("consigo 120 mil") === 120_000, "'120 mil' -> 120000")
  ok(valorDoTexto("ate 1.2 mi") === 1_200_000, "'1.2 mi' -> 1200000")
  ok(valorDoTexto("sem numero aqui") === null, "frase sem numero devolve null")
}

// ── Aceitar fecha e melhora ──────────────────────────────────────────────────
{
  const d = responderAgente("aceitar", estado())
  ok(d.acordoFechado === true && d.encerra === true, "aceitar fecha o acordo e encerra")
  ok(d.desgasteDelta < 0, "aceitar MELHORA a relacao")
}

// ── Contraproposta: perto fecha, longe ofende ────────────────────────────────
{
  const e = estado()
  const pedido = e.pedido!.salarioPedido!
  const perto = responderAgente("contrapor", e, Math.round(pedido * 0.9))
  ok(perto.acordoFechado === true, "contraproposta a 90% fecha com perfil razoavel")

  const longe = responderAgente("contrapor", e, Math.round(pedido * 0.4))
  ok(!longe.acordoFechado && longe.desgasteDelta > 0, "contraproposta a 40% nao fecha e desgasta")

  const duro = responderAgente("contrapor", estado({ perfil: "duro" }), Math.round(pedido * 0.9))
  ok(!duro.acordoFechado, "o MESMO 90% nao basta para o perfil duro — perfil muda a negociacao")
}

// ── Recusar: o custo depende de o pedido ser justo ───────────────────────────
{
  const a = atleta({ overall: 82 })
  const justoP = salarioJusto(a)
  const recusaJusta = responderAgente("recusar", estado({ atleta: a, pedido: { tipo: "salario", salarioPedido: justoP } }))
  const recusaInflada = responderAgente("recusar", estado({ atleta: a, pedido: { tipo: "salario", salarioPedido: Math.round(justoP * 2.5) } }))
  ok(recusaJusta.desgasteDelta > recusaInflada.desgasteDelta,
    "recusar pedido JUSTO custa mais que recusar pedido inflado")
  ok(recusaInflada.desgasteDelta > 0, "mas recusar nunca sai de graca")
}

// ── Ruptura: recusar com a relação rompida joga o atleta no mercado ──────────
{
  const d = responderAgente("recusar", estado({ desgaste: DESGASTE_DE_RUPTURA + 5 }))
  ok(d.vaiOferecerNoMercado === true, "recusar com relacao rompida faz o agente oferecer o atleta")
  ok(d.encerra === true, "e encerra a conversa")
}

// ── Prometer minutos só vale para quem não joga ──────────────────────────────
{
  const titular = responderAgente("prometer", estado({ atleta: atleta({ titular: true, minutosNaTemporada: 1700, jogosDoClube: 20 }) }))
  ok(!titular.registraPromessaDeMinutos && titular.desgasteDelta > 0,
    "prometer minutos a quem JA joga e conversa vazia, e o agente percebe")

  const reserva = responderAgente("prometer", estado({ atleta: atleta({ titular: false, minutosNaTemporada: 120, jogosDoClube: 20 }) }))
  ok(reserva.registraPromessaDeMinutos === true && reserva.desgasteDelta < 0,
    "prometer a um reserva acalma e registra a divida")

  const jaProm = responderAgente("prometer", estado({
    pedidosRecusados: 3,
    atleta: atleta({ titular: false, minutosNaTemporada: 120, jogosDoClube: 20 }),
  }))
  ok(!jaProm.registraPromessaDeMinutos, "quem ja prometeu e nao cumpriu nao consegue prometer de novo")
}

// ── Contrato curto vira fraqueza, não força ──────────────────────────────────
{
  const longo = responderAgente("pressionar", estado({ atleta: atleta({ semanasDeContrato: 120 }) }))
  const curto = responderAgente("pressionar", estado({ atleta: atleta({ semanasDeContrato: 12 }) }))
  ok(curto.desgasteDelta > longo.desgasteDelta,
    "bater no contrato CURTO sai mais caro — o agente sabe que a faca esta com ele")
}

// ── Liberar a saída é acordo, não briga ──────────────────────────────────────
{
  const d = responderAgente("vender", estado())
  ok(d.vaiOferecerNoMercado === true, "liberar a saida manda o atleta ao mercado")
  ok(d.desgasteDelta < 0, "e NAO piora a relacao: os dois queriam a saida")
}

// ── Perguntar é barato e informativo ─────────────────────────────────────────
{
  const d = responderAgente("perguntar", estado())
  ok(d.desgasteDelta <= 0, "perguntar nao custa relacao")
  ok(d.resposta.length > 40, "e devolve conteudo, nao evasiva")
}

// ── Abertura reflete o estado ────────────────────────────────────────────────
{
  const rompido = aberturaDoAgente(estado({ desgaste: 90 }))
  ok(/outro clube|outro lugar/.test(rompido), "com relacao rompida a abertura ja fala em levar o atleta embora")
  const semPedido = aberturaDoAgente(estado({ pedido: undefined }))
  ok(semPedido.length > 40 && !/reajuste/.test(semPedido), "sem pedido na mesa a abertura nao inventa reajuste")
}

console.log(falhas === 0 ? "\nTODOS OS TESTES PASSARAM" : `\n${falhas} TESTE(S) FALHARAM`)
process.exit(falhas ? 1 : 0)
