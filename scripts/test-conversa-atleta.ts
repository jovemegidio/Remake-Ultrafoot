/**
 * O ATLETA TEM DE REBATER — e o argumento tem de sair da situação REAL dele.
 *
 * Pedido: "eu responder a um jogador 'você não está treinando o suficiente' e ele
 * ter uma resposta pra rebater e afins".
 *
 * O que este teste trava:
 *   1. a frase do exemplo é lida como CRÍTICA, não como cobrança genérica;
 *   2. quem está há muitos jogos sem entrar REBATE a crítica (não aceita calado)
 *      e a moral cai — a fala tem consequência;
 *   3. ameaçar quem já está no banco há tempo não intimida (ele já vive aquilo);
 *   4. a conversa CONTINUA depois da crítica — crítica pede resposta, e resposta
 *      pede tréplica;
 *   5. o vocabulário cobre forma falada e gíria (é o que faz o microfone servir).
 */
export {}

import { intencaoDoTexto, responderAtleta, type EstadoDoAtleta } from "../lib/conversa-atleta"

let falhas = 0
const ok = (nome: string, condicao: boolean, detalhe = "") => {
  console.log(`${condicao ? "OK  " : "FALHA"} ${nome}${detalhe ? ` — ${detalhe}` : ""}`)
  if (!condicao) falhas++
}

const base: EstadoDoAtleta = {
  nome: "Victor Sallinas", posicao: "ZAG", moral: "Normal", overall: 62, idade: 24,
  jogosSemJogar: 0, concorrencia: 0, promessasQuebradas: 0, naListaDeTransferencias: false,
}
const encostado: EstadoDoAtleta = { ...base, jogosSemJogar: 12 }

// ── 1. a frase do pedido ────────────────────────────────────────────────────
ok("'voce nao esta treinando o suficiente' e lido como CRITICA",
  intencaoDoTexto("Você não está treinando o suficiente") === "criticar",
  String(intencaoDoTexto("Você não está treinando o suficiente")))

// ── 2. quem esta encostado rebate ───────────────────────────────────────────
const rebate = responderAtleta("criticar", encostado)
ok("o encostado REBATE a critica citando os jogos sem entrar",
  /12 jogos|não entro|já mostrei/i.test(rebate.resposta), rebate.resposta.slice(0, 80))
ok("...e a critica custa moral", rebate.moralDegraus < 0, `moral ${rebate.moralDegraus}`)
ok("...e a conversa NAO acaba ali", rebate.encerra === false)

// ── 3. ameaca nao funciona com quem ja perdeu ───────────────────────────────
const ameaca = responderAtleta("ameacar", encostado)
ok("ameacar quem ja esta no banco nao intimida",
  /já conheço|já vivo|estou nele/i.test(ameaca.resposta), ameaca.resposta.slice(0, 80))
const ameacaTitular = responderAtleta("ameacar", { ...base, moral: "Feliz" })
ok("...mas com quem tem o que perder, surte efeito",
  ameacaTitular.resposta !== ameaca.resposta)

// ── 4. quem esta bem recebe a critica de outro jeito ────────────────────────
const tranquilo = responderAtleta("criticar", { ...base, moral: "Motivado" })
ok("quem esta bem recebe a critica sem revidar",
  /recebo a crítica|me diz o que é/i.test(tranquilo.resposta), tranquilo.resposta.slice(0, 70))

// ── 5. vocabulario falado (o que faz o microfone servir) ────────────────────
const frases: [string, string][] = [
  ["cara, você tá devendo em campo", "criticar"],
  ["se não mudar vai pro banco", "ameacar"],
  ["como você está? algum problema?", "perguntar"],
  ["quero renovar seu contrato", "renovar"],
  ["você vai ser titular no próximo jogo", "prometer"],
  ["pode procurar outro clube", "liberar"],
  ["parabéns, jogou muito", "elogiar"],
  ["é questão tática, nada contra você", "explicar"],
]
let acertos = 0
for (const [frase, esperado] of frases) {
  const lido = intencaoDoTexto(frase)
  if (lido === esperado) acertos++
  else console.log(`     (leu "${frase}" como ${lido}, esperado ${esperado})`)
}
ok("o vocabulario cobre a forma falada", acertos === frases.length, `${acertos}/${frases.length}`)

// ── 6. frase sem sinal nenhum nao inventa intencao ──────────────────────────
ok("frase vazia de sentido nao vira intencao", intencaoDoTexto("hmm entao ta") === null,
  String(intencaoDoTexto("hmm entao ta")))

console.log(`\nRESULTADO: ${falhas === 0 ? "TUDO OK" : `${falhas} FALHA(S)`}`)
process.exit(falhas === 0 ? 0 : 1)
