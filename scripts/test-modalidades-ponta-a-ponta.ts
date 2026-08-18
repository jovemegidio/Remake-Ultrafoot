// O GATE DAS TRÊS MODALIDADES (1.0.347).
//
// ⚠️ POR QUE ELE EXISTE. A auditoria de 18/08/2026 mediu uma coisa
// desconfortável: apenas SETE arquivos do jogo consultavam a modalidade da
// carreira, e só mercado e leilões mudavam de comportamento. Diretoria,
// imprensa e treino falavam com a técnica do feminino e com o técnico do Sub-20
// exatamente como falariam com o de um clube masculino de Série A — mesma
// escala de dinheiro, mesma cobrança, mesmo vocabulário.
//
// Era daí que vinha a queixa de que as outras modalidades parecem "menos
// profissionais": os sistemas ao redor delas existiam e estavam certos, mas não
// sabiam onde estavam.
//
// ⚠️ E NENHUM PORTÃO COBRIA ISSO. O motor tem harness de 20 mil partidas; as
// modalidades não tinham uma linha. Um `switch` que perdesse um `case` voltaria
// a tratar todo mundo igual sem quebrar teste nenhum — que é exatamente como
// esse tipo de regressão passa despercebida por versões.
//
// Uso: npx tsx scripts/test-modalidades-ponta-a-ponta.ts

import {
  pesoDasAreas, tomDaModalidade, naEscalaDaModalidade,
  rendimentoDeTreinoDaModalidade, sincronizarModalidade, modalidadeAtual, limparModalidade,
} from "@/lib/tom-da-modalidade"
import { confiancaPorArea, areaMaisFragil } from "@/lib/confianca-da-diretoria"
import { aberturaDaDiretoria } from "@/lib/conversa-diretoria"
import { allTeams } from "@/lib/teams-data"
import {
  criarAtletaDaCarreira, criarCarreiraDeJogador, jogarProximaRodada, encerrarTemporada,
  type EstadoCarreiraDeJogador,
} from "@/lib/carreira-de-jogador"

let falhas = 0
const erro = (m: string) => { console.log("FALHA: " + m); falhas++ }
const ok = (m: string) => console.log("ok   " + m)

// ── 1. A DIRETORIA COBRA COISAS DIFERENTES ──────────────────────────────────
{
  const sub20 = pesoDasAreas("sub20")
  const prof = pesoDasAreas("profissional")
  const fem = pesoDasAreas("feminino")

  if (!(sub20.base > sub20.resultados)) {
    erro("no Sub-20 a base deveria pesar MAIS que resultado — formar e o trabalho")
  } else ok("Sub-20: formar pesa mais que resultado")

  if (!(sub20.base > prof.base * 1.5)) {
    erro("a base do Sub-20 pesa quase igual a do profissional; a modalidade nao mudou nada")
  } else ok("Sub-20: a base pesa muito mais que no profissional")

  if (!(fem.financas < prof.financas)) {
    erro("o clube feminino e cobrado pelas financas na mesma regua do masculino")
  } else ok("feminino: cobranca financeira proporcional a modalidade")

  // ⚠️ NENHUMA AREA PODE SUMIR. Peso 0 faria a leitura mentir por omissao.
  for (const id of ["profissional", "feminino", "sub20", "jogador"] as const) {
    const pesos = pesoDasAreas(id)
    for (const [area, peso] of Object.entries(pesos)) {
      if (peso <= 0) erro(`${id}: a area "${area}" sumiu da leitura da diretoria (peso ${peso})`)
    }
  }
  ok("nenhuma area some da leitura em nenhuma modalidade")
}

// ── 2. A AREA MAIS FRAGIL SEGUE O QUE A MODALIDADE COBRA ────────────────────
//
// O caso concreto: um Sub-20 com mercado ruim e base mediana. A pior NOTA e o
// mercado; o pior PROBLEMA e a base, porque e por ela que aquele emprego existe.
{
  const contexto = {
    confiancaEsportiva: 70, bonusDeGovernanca: 0, saldo: 1_000_000, dividaTotal: 0,
    gastoDoOrcamento: 1.4,          // mercado estourado -> nota baixa
    promovidosDaBase: 0,            // base sem entregar  -> nota 45
    moralDoElenco: 70,
  }
  const comoSub20 = areaMaisFragil(confiancaPorArea({ ...contexto, modalidade: "sub20" }))
  const comoProfissional = areaMaisFragil(confiancaPorArea({ ...contexto, modalidade: "profissional" }))

  if (comoSub20?.area !== "base") {
    erro(`Sub-20: a area mais fragil deveria ser a base, veio "${comoSub20?.area}"`)
  } else ok("Sub-20: a diretoria aponta a BASE como o problema")

  if (comoProfissional?.area !== "mercado") {
    erro(`profissional: a area mais fragil deveria ser o mercado, veio "${comoProfissional?.area}"`)
  } else ok("profissional: a mesma situacao aponta o MERCADO")

  if (comoSub20?.area === comoProfissional?.area) {
    erro("a modalidade nao mudou o diagnostico da diretoria")
  }
}

// ── 3. A DIRETORIA FALA A LINGUA DA MODALIDADE ──────────────────────────────
{
  const estado = { confianca: 40, posicao: 9, metaPosicao: 4, verbaDisponivel: 0, temporada: 2026 }
  const falas = new Map<string, string>()
  for (const id of ["profissional", "feminino", "sub20"] as const) {
    falas.set(id, aberturaDaDiretoria("verba", estado as never, id))
  }
  if (new Set(falas.values()).size !== 3) {
    erro("a diretoria abre a conversa de verba com o MESMO texto em modalidades diferentes")
  } else ok("verba: cada modalidade tem a propria abertura")

  const doSub20 = falas.get("sub20") ?? ""
  if (!doSub20.toLowerCase().includes("formar") && !doSub20.toLowerCase().includes("base")) {
    erro(`a fala do Sub-20 nao menciona formar nem base: "${doSub20}"`)
  } else ok("Sub-20: a diretoria fala em formar")

  // O vocabulario tem de chegar as frases que citam a equipe.
  const elenco = aberturaDaDiretoria("elenco", estado as never, "feminino")
  if (!elenco.includes(tomDaModalidade("feminino").equipe)) {
    erro(`a fala sobre elenco nao usa o vocabulario da modalidade: "${elenco}"`)
  } else ok("feminino: a diretoria chama a equipe pelo nome certo")
}

// ── 4. A ESCALA DE DINHEIRO NAO E A DO MASCULINO PROFISSIONAL ───────────────
{
  const doMasculino = 10_000_000
  const noFeminino = naEscalaDaModalidade(doMasculino, "feminino")
  const naBase = naEscalaDaModalidade(doMasculino, "sub20")
  if (!(noFeminino < doMasculino * 0.3)) erro(`escala do feminino nao reduz o suficiente: ${noFeminino}`)
  else ok(`feminino: R$ ${(doMasculino / 1e6).toFixed(0)}M viram R$ ${(noFeminino / 1e6).toFixed(1)}M na escala da modalidade`)
  if (!(naBase < noFeminino)) erro("a base deveria operar numa escala menor que o feminino")
  else ok("Sub-20: escala menor ainda que a do feminino")
}

// ── 5. O TREINO RENDE MAIS ONDE FORMAR E O TRABALHO ─────────────────────────
{
  if (!(rendimentoDeTreinoDaModalidade("sub20") > rendimentoDeTreinoDaModalidade("profissional"))) {
    erro("o treino do Sub-20 rende igual ao do profissional — formar nao tem vantagem nenhuma")
  } else ok("Sub-20: o treino rende mais")
  if (rendimentoDeTreinoDaModalidade("profissional") !== 1) {
    erro("o profissional deixou de ser a referencia 1 do rendimento de treino")
  }
}

// ── 6. O RETRATO ATRAVESSA A PAREDE ATE O MOTOR ─────────────────────────────
//
// O motor e um store separado e nao pode importar o save. Se este retrato parar
// de ser publicado, a imprensa volta a perguntar a um Sub-20 sobre briga por
// titulo — e nada quebra.
{
  limparModalidade()
  if (modalidadeAtual() !== "profissional") erro("o retrato limpo deveria ser 'profissional'")
  sincronizarModalidade({ modalidade: "feminino" })
  if (modalidadeAtual() !== "feminino") erro("o retrato nao recebeu a modalidade do save")
  else ok("retrato: o motor enxerga a modalidade da carreira aberta")
  // Save ANTIGO de carreira de base nao tem o campo `modalidade`.
  sincronizarModalidade({ youthCareer: { active: true } })
  if (modalidadeAtual() !== "sub20") {
    erro("save antigo de base deveria ser lido como sub20")
  } else ok("retrato: save antigo de base e reconhecido")
  limparModalidade()
}

// ── 7. CARREIRA DE JOGADOR: O CORPO COBRA E A BRACADEIRA EXISTE ─────────────
{
  const clube = allTeams.find(t => t.prestigio >= 78 && t.prestigio <= 90) ?? allTeams[0]
  // ⚠️ 24 ANOS, NAO 21. Com um atleta que entra 20 minutos por jogo a exposicao
  // e minima e o teste nao mede nada — foi assim que a primeira versao deste
  // gate passou seis temporadas sem uma lesao e quase deixou passar uma taxa
  // calibrada errado (base "por partida" em vez de por 90 minutos).
  const atleta = criarAtletaDaCarreira({
    nome: "Teste Modalidade", posicao: "MEI", idade: 24, nacionalidade: "Brasil",
    pePreferido: "direito", alturaCm: 178, pesoKg: 72, numero: 8,
  })
  let carreira: EstadoCarreiraDeJogador = criarCarreiraDeJogador(clube, atleta, "Brasileirao Serie A", 2026)

  let lesoes = 0
  let rodadasComPreTemporada = 0
  let minutosJogados = 0
  for (let temporada = 0; temporada < 6; temporada++) {
    let n = 0
    while (!carreira.temporadaEncerrada && n < 120) {
      const tinhaPre = (carreira.preTemporada?.rodadasRestantes ?? 0) > 0
      const estavaInteiro = (carreira.lesao?.semanasRestantes ?? 0) === 0
      carreira = jogarProximaRodada(carreira)
      if (tinhaPre) rodadasComPreTemporada++
      if (estavaInteiro && (carreira.lesao?.semanasRestantes ?? 0) > 0) lesoes++
      n++
    }
    minutosJogados += carreira.temporadaAtual.minutos
    carreira = encerrarTemporada(carreira)
    if (carreira.aposentado) break
  }

  // ⚠️ O EQUILIBRIO E O TESTE. Lesao demais irrita; lesao nenhuma tira metade do
  // drama da carreira. Seis temporadas sem UMA lesao significa que o sorteio
  // nao esta ligado no caminho real.
  if (lesoes === 0) {
    erro("seis temporadas sem uma unica lesao — o corpo nao cobra nada")
  } else if (lesoes > 18) {
    erro(`${lesoes} lesoes em seis temporadas: o atleta vive no departamento medico`)
  } else {
    ok(`lesoes: ${lesoes} em seis temporadas, e elas custaram ${carreira.rodadasPerdidasPorLesao ?? 0} rodadas`)
  }

  if ((carreira.rodadasPerdidasPorLesao ?? 0) === 0 && lesoes > 0) {
    erro("houve lesao mas nenhuma rodada foi perdida — a lesao nao tem consequencia")
  }

  if (rodadasComPreTemporada === 0) {
    erro("a pre-temporada nunca valeu numa rodada — o calendario nao respira")
  } else ok(`pre-temporada: ${rodadasComPreTemporada} rodadas de trabalho sem jogo`)

  // ⚠️ ESTE ASSERT NASCEU DE UM DEFEITO REAL. A primeira versao do gate aceitava
  // "nao virou capitao" como resultado valido, e com isso quase deixou passar um
  // criterio de personalidade tao alto que a bracadeira NUNCA saia — um atleta
  // que chegou a nota 100 em seis temporadas no mesmo clube seguia sem capitania.
  // Um teste que aceita o silencio nao testa nada.
  if (!carreira.capitao) {
    erro("seis temporadas de titular no mesmo clube e nenhuma bracadeira — a capitania nao acontece")
  } else {
    ok(`capitania: recebeu a bracadeira em ${carreira.temporadaEmQueVirouCapitao}`)
  }

  // A taxa tem de ser de futebol, nao de enfermaria nem de invencibilidade.
  const noventas = Math.max(1, minutosJogados / 90)
  const porNoventa = lesoes / noventas
  if (porNoventa > 0.15) {
    erro(`taxa de lesao alta demais: ${(porNoventa * 100).toFixed(1)}% por 90 minutos`)
  } else {
    ok(`taxa: ${(porNoventa * 100).toFixed(1)}% por 90 minutos (~${(porNoventa * 30).toFixed(1)} por temporada de titular)`)
  }
}

console.log(falhas === 0
  ? "\nMODALIDADES OK — cada carreira e cobrada, falada e treinada pelo que ela e."
  : `\n${falhas} problema(s): alguma modalidade voltou a ser tratada como as outras.`)
process.exit(falhas === 0 ? 0 : 1)
