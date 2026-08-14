// TESTE — Características do atleta (1.0.298) e prestígio evolutivo.
//
// A pergunta que este arquivo existe para responder não é "as funções devolvem
// alguma coisa?", e sim as duas que podem quebrar o jogo em silêncio:
//
//  1. Gerar característica para o mundo inteiro INFLACIONA o mundo inteiro?
//     Se sim, todo elenco fica mais forte de uma vez e a calibração de 20 mil
//     jogos ([[ultrafoot-calibracao-do-motor]]) vai para o lixo sem ninguém ver.
//  2. O prestígio mexe no overall em algum caminho?
//     Se mexer, "ganhou a Bola de Ouro" vira "ficou 10 pontos melhor" e a curva
//     de qualidade do mundo explode em dez temporadas.
//
// Rodar: npx tsx scripts/test-caracteristicas.ts

import {
  caracteristicasDoAtleta, goleiroPorCaracteristicas, MAX_CARACTERISTICAS,
  pesoDePenalti, pesosDeLance, PESOS_NEUTROS,
} from "../lib/caracteristicas-do-atleta"
import {
  semearMotorDePartida, simulateFullMatch,
  type MatchConfig, type SquadPlayer,
} from "../lib/match-engine"
import { forcaDeGoleiro, forcaDeGoleiroNoAlto, perfilDoAtleta } from "../lib/modelo-de-jogador"
import type { Team } from "../lib/teams-data"
import {
  DECAIMENTO_POR_TEMPORADA, multiplicadorDeSalario, multiplicadorDeValor,
  nivelDePrestigio, prestigioDe, promocoesDePrestigio, virarTemporada,
  type PrestigioDosAtletas,
} from "../lib/prestigio-do-atleta"

let falhas = 0
function ok(condicao: boolean, titulo: string, detalhe = ""): void {
  if (condicao) { console.log(`  ✓ ${titulo}`); return }
  falhas++
  console.log(`  ✗ ${titulo}${detalhe ? ` — ${detalhe}` : ""}`)
}

const POSICOES = ["GOL", "ZAG", "LD", "LE", "VOL", "MEI", "PD", "PE", "ATA"]

/** Atributos plausíveis para o teste: gira em volta do overall. */
function atributos(overall: number, viés: Partial<Record<string, number>> = {}) {
  return {
    pace: overall + (viés.pace ?? 0),
    shooting: overall + (viés.shooting ?? 0),
    passing: overall + (viés.passing ?? 0),
    dribbling: overall + (viés.dribbling ?? 0),
    defending: overall + (viés.defending ?? 0),
    physical: overall + (viés.physical ?? 0),
  }
}

console.log("\n── Geração ──")
{
  // Determinismo: é a promessa que permite não gravar nada no save.
  const a = caracteristicasDoAtleta(4242, "ATA", atributos(78), 78)
  const b = caracteristicasDoAtleta(4242, "ATA", atributos(78), 78)
  ok(JSON.stringify(a) === JSON.stringify(b), "mesma entrada devolve a mesma lista")

  let excedeu = 0
  let semNenhuma = 0
  let comDuas = 0
  const total = 6000
  for (let id = 1; id <= total; id++) {
    const pos = POSICOES[id % POSICOES.length]
    const lista = caracteristicasDoAtleta(id, pos, atributos(70), 70)
    if (lista.length > MAX_CARACTERISTICAS) excedeu++
    if (lista.length === 0) semNenhuma++
    if (lista.length === 2) comDuas++
  }
  ok(excedeu === 0, `nunca passa de ${MAX_CARACTERISTICAS}`, `${excedeu} atletas passaram`)
  // As faixas são folgadas de propósito: o que não pode acontecer é o mundo
  // inteiro sair sem nenhuma (sistema morto) ou todo mundo com duas (ruído).
  const pctZero = (semNenhuma / total) * 100
  const pctDuas = (comDuas / total) * 100
  ok(pctZero > 12 && pctZero < 50, `${pctZero.toFixed(1)}% sem nenhuma característica (esperado 12-50%)`)
  ok(pctDuas > 10 && pctDuas < 45, `${pctDuas.toFixed(1)}% com duas (esperado 10-45%)`)

  // A escolha do editor VENCE. Sem isto a ficha promete uma coisa e o motor
  // sorteia outra — o defeito que este projeto já viu várias vezes.
  const editado = caracteristicasDoAtleta(999, "ZAG", atributos(70), 70, ["finalizacao", "drible"])
  ok(editado.join(",") === "finalizacao,drible", "marcação do editor vence a geração")

  // Coerência com o perfil DELE: um atacante cuja finalização se destaca tende a
  // sair com Finalização. Medido em amostra — não é garantia por atleta.
  let comFinalizacao = 0
  let amostra = 0
  for (let id = 1; id <= 1500; id++) {
    const lista = caracteristicasDoAtleta(id, "ATA", atributos(75, { shooting: 14 }), 75)
    if (lista.length > 0) { amostra++; if (lista.includes("finalizacao")) comFinalizacao++ }
  }
  const pctCoerente = (comFinalizacao / amostra) * 100
  ok(pctCoerente > 55, `${pctCoerente.toFixed(0)}% dos atacantes com finalização alta pegam "Finalização"`)

  // Posição manda no catálogo: zagueiro não sai daqui com "Finalização".
  let zagueiroFinalizador = 0
  for (let id = 1; id <= 2000; id++) {
    if (caracteristicasDoAtleta(id, "ZAG", atributos(72, { shooting: 20 }), 72).includes("finalizacao")) zagueiroFinalizador++
  }
  ok(zagueiroFinalizador === 0, "zagueiro nunca recebe Finalização", `${zagueiroFinalizador} receberam`)

  // Goleiro tem o catálogo dele, e só ele.
  const deLinha = new Set(["armacao", "cabeceio", "cruzamento", "desarme", "drible", "finalizacao", "marcacao", "passe", "resistencia", "velocidade", "lideranca"])
  let goleiroComTraitDeLinha = 0
  for (let id = 1; id <= 2000; id++) {
    for (const c of caracteristicasDoAtleta(id, "GOL", atributos(70), 70)) if (deLinha.has(c)) goleiroComTraitDeLinha++
  }
  ok(goleiroComTraitDeLinha === 0, "goleiro só recebe característica de goleiro")
}

console.log("\n── Efeito: redistribui, não infla ──")
{
  ok(JSON.stringify(pesosDeLance([])) === JSON.stringify(PESOS_NEUTROS), "lista vazia = pesos neutros")
  ok(JSON.stringify(pesosDeLance(undefined)) === JSON.stringify(PESOS_NEUTROS), "undefined = pesos neutros")

  // ⚠️ O TESTE QUE IMPORTA. Os pesos de sorteio decidem QUEM participa do lance,
  // dentro de um time que tem exatamente os mesmos onze. A soma dos pesos de um
  // elenco muda (é o ponto), mas a chance de o TIME criar o lance não sai daqui:
  // ela é calculada antes, em `calcDynamicProbs`, e nenhum campo destes entra lá.
  //
  // O que se pode medir aqui é o outro lado: os multiplicadores de eficiência
  // (`multChute`, `multCabeceio`) têm de ser pequenos e raros o bastante para o
  // elenco MÉDIO ficar em ~1,00. Um elenco inteiro com multChute 1,10 seria
  // +10% de conversão para todo mundo, e aí sim o mundo inflaria.
  let somaChute = 0
  let somaCabeceio = 0
  let somaDesgaste = 0
  const elencos = 3000
  for (let id = 1; id <= elencos; id++) {
    const pos = POSICOES[id % POSICOES.length]
    const p = pesosDeLance(caracteristicasDoAtleta(id, pos, atributos(72), 72))
    somaChute += p.multChute
    somaCabeceio += p.multCabeceio
    somaDesgaste += p.multDesgaste
  }
  const mediaChute = somaChute / elencos
  const mediaCabeceio = somaCabeceio / elencos
  const mediaDesgaste = somaDesgaste / elencos
  ok(mediaChute < 1.035, `conversão média do mundo em ${mediaChute.toFixed(4)} (teto 1,035)`)
  ok(mediaCabeceio < 1.03, `cabeceio médio do mundo em ${mediaCabeceio.toFixed(4)} (teto 1,03)`)
  ok(mediaDesgaste > 0.97, `desgaste médio do mundo em ${mediaDesgaste.toFixed(4)} (piso 0,97)`)

  // Nenhum multiplicador individual pode ser grande. Duas características são o
  // máximo, então o pior caso é o produto de duas.
  const p = pesosDeLance(["finalizacao", "drible"])
  ok(p.multChute <= 1.15, `pior caso de conversão individual em ${p.multChute} (teto 1,15)`)
  ok(pesosDeLance(["cabeceio"]).pesoAereo > 2, "Cabeceio pesa de verdade no sorteio aéreo")
  ok(pesosDeLance(["velocidade"]).pesoVelocidade > 1.8, "Velocidade puxa o contra-ataque")
  ok(pesosDeLance(["resistencia"]).multDesgaste < 0.9, "Resistência segura os noventa minutos")
}

console.log("\n── Goleiro: redistribui mantendo a média ──")
{
  // A soma dos deltas tem de ser ~0 — é o que garante que a característica de
  // goleiro não seja buff. Se somasse, todo arqueiro do mundo ficaria melhor.
  for (const trait of ["reflexo", "colocacao", "saida_gol", "reposicao"]) {
    const d = goleiroPorCaracteristicas([trait])
    const soma = d.reflexos + d.saidaDoGol + d.jogoAereo + d.jogoComOsPes + d.posicionamento
    ok(Math.abs(soma) < 0.01, `"${trait}" soma zero nas cinco habilidades`, `somou ${soma}`)
  }

  // E o ponto do desenho: com DUAS leituras (corrido e aéreo), a redistribuição
  // deixa de ser invisível. "Saída Gol" tem de subir a força aérea E descer a de
  // jogo corrido — se as duas andassem juntas, o sistema não valeria nada.
  const perfil = perfilDoAtleta(7777, "GOL", 80)
  const neutro = forcaDeGoleiro(perfil) ?? 0
  const neutroAlto = forcaDeGoleiroNoAlto(perfil) ?? 0
  const comSaida = forcaDeGoleiro(perfil, ["saida_gol"]) ?? 0
  const comSaidaAlto = forcaDeGoleiroNoAlto(perfil, ["saida_gol"]) ?? 0
  ok(comSaidaAlto > neutroAlto, `"Saída Gol" sobe a força aérea (${neutroAlto} → ${comSaidaAlto})`)
  ok(comSaida < neutro, `"Saída Gol" custa na força de jogo corrido (${neutro} → ${comSaida})`)

  const comReflexo = forcaDeGoleiro(perfil, ["reflexo"]) ?? 0
  const comReflexoAlto = forcaDeGoleiroNoAlto(perfil, ["reflexo"]) ?? 0
  ok(comReflexo > neutro, `"Reflexo" sobe o jogo corrido (${neutro} → ${comReflexo})`)
  ok(comReflexoAlto < neutroAlto, `"Reflexo" custa na bola alta (${neutroAlto} → ${comReflexoAlto})`)

  ok(pesoDePenalti(["defesa_penalty"]) > 1, "Defesa Penalty pesa na marca da cal")
  ok(pesoDePenalti(["reflexo"]) === 1, "quem não tem a característica não muda o pênalti")

  // Jogador de linha não tem atributo de goleiro — não pode devolver número.
  ok(forcaDeGoleiroNoAlto(perfilDoAtleta(10, "ATA", 80)) === null, "atacante não tem força aérea de goleiro")
}

console.log("\n── Prestígio ──")
{
  ok(nivelDePrestigio(0) === "normal", "zero ponto = normal")
  ok(nivelDePrestigio(99) === "normal", "99 pontos ainda é normal")
  ok(nivelDePrestigio(100) === "estrela", "100 pontos = estrela")
  ok(nivelDePrestigio(250) === "top_mundial", "250 pontos = top mundial")

  // A CARREIRA DO SEU EXEMPLO: artilheiro nacional aos 19, depois Bola de Ouro.
  let mapa: PrestigioDosAtletas = {}
  mapa = virarTemporada(mapa, [{ playerId: 1, feito: "artilheiro" }, { playerId: 1, feito: "selecao_do_campeonato" }])
  ok(prestigioDe(mapa, 1) === "normal", "uma artilharia ainda não faz estrela")
  mapa = virarTemporada(mapa, [
    { playerId: 1, feito: "bola_de_ouro" }, { playerId: 1, feito: "artilheiro" },
  ])
  ok(prestigioDe(mapa, 1) === "estrela", `virou estrela na segunda temporada (${mapa[1]} pts)`)
  mapa = virarTemporada(mapa, [
    { playerId: 1, feito: "bola_de_ouro" }, { playerId: 1, feito: "titulo_continental" },
  ])
  ok(prestigioDe(mapa, 1) === "top_mundial", `virou top mundial na terceira (${mapa[1]} pts)`)

  // DECAIMENTO. Quem some do mapa perde a distinção — senão o prestígio só sobe
  // e em dez temporadas o mundo inteiro é Top Mundial.
  let esfriando: PrestigioDosAtletas = { 2: 120 }
  const antesDoEsfriamento = esfriando[2]
  esfriando = virarTemporada(esfriando, [])
  ok(esfriando[2] === antesDoEsfriamento - DECAIMENTO_POR_TEMPORADA, "temporada em branco esfria o prestígio")
  for (let i = 0; i < 20; i++) esfriando = virarTemporada(esfriando, [])
  ok(esfriando[2] === undefined, "atleta esquecido sai do save (mapa não cresce para sempre)")

  // ⚠️ ORDEM: decai antes de creditar. Ao contrário, quem ganhou a Bola de Ouro
  // pagaria o decaimento no ano em que a ganhou.
  const creditado = virarTemporada({ 3: 100 }, [{ playerId: 3, feito: "bola_de_ouro" }])
  ok(creditado[3] === 100 - DECAIMENTO_POR_TEMPORADA + 100, `crédito não paga o decaimento do próprio ano (${creditado[3]})`)

  // Promoções: só sobe é notícia; descer e ficar igual, não.
  const promocoes = promocoesDePrestigio({ 4: 90 }, { 4: 190, 5: 40 })
  ok(promocoes.length === 1 && promocoes[0].playerId === 4 && promocoes[0].para === "estrela",
    "só quem trocou de nível para cima vira notícia")

  // O EFEITO NUNCA É FORÇA. Estes multiplicadores são os únicos que existem, e
  // nenhum deles toca overall nem atributo.
  ok(multiplicadorDeValor("top_mundial") > multiplicadorDeValor("estrela"), "top mundial vale mais que estrela")
  ok(multiplicadorDeValor("normal") === 1, "normal não muda o valor de mercado")
  ok(multiplicadorDeSalario("top_mundial") > 1, "top mundial cobra mais para renovar")
  // ⚠️ O SALÁRIO SOBE MENOS QUE O VALOR. Ao contrário, o craque reconhecido
  // seria prejuízo garantido: custaria mais na folha do que renderia na venda.
  ok(multiplicadorDeSalario("top_mundial") < multiplicadorDeValor("top_mundial"),
    "o salário sobe menos que o valor de mercado")
}

console.log("\n── No motor: 3.200 partidas ──")
{
  // ⚠️ ESTA É A MEDIÇÃO QUE VALE, e é a razão de o arquivo existir.
  //
  // As seções acima provam que as funções se comportam. Nenhuma prova o que
  // realmente pode quebrar o jogo: ligar característica para o mundo inteiro e
  // descobrir, três versões depois, que a média de gols do campeonato subiu.
  //
  // Cada par abaixo simula o MESMO confronto com a MESMA semente, mudando um
  // campo só. Sem a semente fixa a diferença medida seria ruído — o
  // `test-modelo-no-motor` já foi mordido por isso.
  const POSICOES_XI = ["GOL", "ZAG", "ZAG", "LD", "LE", "VOL", "VOL", "MEI", "PD", "PE", "ATA"]

  const time = (nome: string) => ({
    nome, curto: nome.slice(0, 3).toUpperCase(), cor1: "#000", cor2: "#fff",
    file_key: nome.toLowerCase(), divisao: "serie_a",
  }) as unknown as Team

  /**
   * XI com atributos DESIGUAIS de propósito.
   *
   * Com todo mundo em 75 o peso de sorteio seria invisível: trocar quem chuta
   * não muda nada quando os onze chutam igual. O desnível é o que permite medir
   * o mecanismo — o "Finalização" do elenco chuta mais, e ele é justamente quem
   * chuta melhor. A média do time continua 75.
   */
  function elenco(comCaracteristicas: boolean, semente = 0): SquadPlayer[] {
    return POSICOES_XI.map((pos, i) => {
      // Alterna ±12 em volta de 75, sem mexer na média do elenco.
      const desnivel = i % 2 === 0 ? 12 : -12
      const attrs = atributos(75, { shooting: desnivel, pace: -desnivel, physical: desnivel })
      const base: SquadPlayer = {
        nome: `${pos}${i}`, pos, posNatural: pos,
        rating: 75, passing: 75, dribbling: 75, defending: 75,
        shooting: attrs.shooting, pace: attrs.pace, physical: attrs.physical,
        stamina: 100,
      }
      if (!comCaracteristicas) return base
      const lista = caracteristicasDoAtleta(semente * 100 + i + 1, pos, attrs, 75)
      const p = pesosDeLance(lista)
      return {
        ...base,
        pesoFinalizar: p.pesoFinalizar, pesoAereo: p.pesoAereo,
        pesoCriar: p.pesoCriar, pesoVelocidade: p.pesoVelocidade,
        multChute: p.multChute, multCabeceio: p.multCabeceio,
      }
    })
  }

  function golsMedios(casa: SquadPlayer[], fora: SquadPlayer[], n: number): { pro: number; contra: number } {
    let pro = 0
    let contra = 0
    for (let i = 0; i < n; i++) {
      semearMotorDePartida(5000 + i)
      const r = simulateFullMatch({
        homeTeam: time("Casa"), awayTeam: time("Fora"),
        homeRating: 75, awayRating: 75,
        homeSquad: casa, awaySquad: fora,
        durationMinutes: 90,
      } as MatchConfig)
      pro += r.home.goals
      contra += r.away.goals
    }
    semearMotorDePartida(null)
    return { pro: pro / n, contra: contra / n }
  }

  const N = 800
  const semNada = golsMedios(elenco(false), elenco(false), N)
  // Mesmo elenco, mesmos atributos, mesma semente — só as características ligadas
  // dos DOIS lados. É o mundo inteiro com característica contra o mundo inteiro sem.
  const comTudo = golsMedios(elenco(true, 1), elenco(true, 2), N)
  const totalSem = semNada.pro + semNada.contra
  const totalCom = comTudo.pro + comTudo.contra
  const variacao = Math.abs(totalCom - totalSem) / totalSem
  console.log(`     gols/jogo: ${totalSem.toFixed(3)} sem características → ${totalCom.toFixed(3)} com`)
  ok(variacao < 0.06,
    `ligar característica no mundo inteiro move a média de gols em ${(variacao * 100).toFixed(1)}% (teto 6%)`)

  // E O OUTRO LADO: se não mudasse NADA, o sistema seria enfeite caro. Um elenco
  // com característica contra um sem tem de render diferente.
  const soUmLado = golsMedios(elenco(true, 3), elenco(false), N)
  ok(Math.abs(soUmLado.pro - semNada.pro) > 0.01 || Math.abs(soUmLado.contra - semNada.contra) > 0.01,
    `característica muda o jogo (${semNada.pro.toFixed(2)} → ${soUmLado.pro.toFixed(2)} gols)`)

  // O GOLEIRO AÉREO chega ao placar. Um arqueiro que domina a área tem de sofrer
  // menos que um de mesma força total que não domina — senão as características
  // de goleiro voltam a ser rótulo, que era o estado anterior.
  function comGoleiro(alto: number | undefined, n: number): number {
    const xi = elenco(false).map(p => p.pos === "GOL" ? { ...p, forcaGoleiro: 75, forcaGoleiroAlto: alto } : p)
    return golsMedios(elenco(false), xi, n).pro
  }
  //
  // A amostra é maior aqui de propósito: o escanteio é uma fatia pequena dos
  // gols, então o efeito verdadeiro é de centésimos de gol por jogo e some no
  // ruído de 800 partidas. Medir pouco e concluir "não faz nada" seria o erro
  // caro — foi assim que a força aérea passou despercebida até agora.
  const contraAereoRuim = comGoleiro(50, 2500)
  const contraAereoBom = comGoleiro(99, 2500)
  const reducao = ((contraAereoRuim - contraAereoBom) / contraAereoRuim) * 100
  ok(contraAereoBom < contraAereoRuim,
    `goleiro que domina a área sofre ${reducao.toFixed(1)}% menos (${contraAereoRuim.toFixed(3)} → ${contraAereoBom.toFixed(3)} gols)`)
}

console.log(falhas === 0 ? "\n✅ Características e prestígio OK\n" : `\n❌ ${falhas} falha(s)\n`)
process.exit(falhas === 0 ? 0 : 1)
