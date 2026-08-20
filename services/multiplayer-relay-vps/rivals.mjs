// MATCHMAKING, RANKING E ANTI-CHEAT — o lado SERVIDOR dos modos competitivos.
//
// Fica num módulo próprio, e não dentro do `server.mjs`, por dois motivos: o
// relay já tem 300 linhas de sala/competição que não têm nada a ver com isto, e
// porque este arquivo precisa ser testável sozinho (ver
// `scripts/qa-rivals-servidor.mjs`, que sobe o relay num diretório temporário e
// simula dois técnicos).
//
// ⚠️ O SERVIDOR É A VERDADE. É esse o ponto do modo competitivo: o cliente
// manda INTENÇÃO (entrar na fila, enviar resultado), nunca fato consumado. Quem
// decide adversário, quem decide se o resultado vale e quem guarda o rating é
// este arquivo. Editar dinheiro, atributo ou placar no save local não muda uma
// linha do que está aqui.
//
// O que este arquivo NÃO faz, e é honesto dizer: ele não simula a partida. Os
// dois clientes rodam o mesmo motor determinístico e mandam o placar; o servidor
// compara. Divergiu, ninguém pontua e o caso fica gravado. Rodar a partida no
// servidor é o passo seguinte (exige o motor em Node), e é o que fecharia a
// porta para o último tipo de trapaça: o cliente adulterado que joga contra si
// mesmo com um motor modificado.

import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"

/** Divisões, do fundo ao topo — o mesmo desenho do Online Seasons. */
export const DIVISOES = [
  { id: 10, nome: "Divisão 10", piso: 0 },
  { id: 9, nome: "Divisão 9", piso: 900 },
  { id: 8, nome: "Divisão 8", piso: 1000 },
  { id: 7, nome: "Divisão 7", piso: 1100 },
  { id: 6, nome: "Divisão 6", piso: 1200 },
  { id: 5, nome: "Divisão 5", piso: 1300 },
  { id: 4, nome: "Divisão 4", piso: 1400 },
  { id: 3, nome: "Divisão 3", piso: 1500 },
  { id: 2, nome: "Divisão 2", piso: 1600 },
  { id: 1, nome: "Divisão 1", piso: 1700 },
  { id: 0, nome: "Divisão Elite", piso: 1850 },
]

export const RATING_INICIAL = 1000

export function divisaoDoRating(rating) {
  return [...DIVISOES].sort((a, b) => b.piso - a.piso).find(d => rating >= d.piso) ?? DIVISOES[0]
}

/**
 * Elo com fator K por experiência: quem tem poucas partidas se move rápido
 * (chega ao próprio nível logo) e quem tem muitas se move devagar.
 */
export function novoRating(atual, adversario, resultado, partidas) {
  const k = partidas < 10 ? 48 : partidas < 30 ? 32 : 20
  const esperado = 1 / (1 + 10 ** ((adversario - atual) / 400))
  return Math.max(0, Math.round(atual + k * (resultado - esperado)))
}

export class Competitivo {
  constructor(dataDir) {
    this.arquivo = path.join(dataDir, "rivals.json")
    this.jogadores = new Map()   // id -> { id, nome, rating, partidas, v, e, d, ultimaPartida }
    this.fila = new Map()        // modo -> [{ id, nome, rating, forcaDoClube, desde }]
    this.partidas = new Map()    // matchId -> { ... }
    this.suspeitas = []          // registro de anti-cheat, para auditoria
    /**
     * MANAGER CHAMPIONS — a tabela da SEMANA (1.0.358).
     *
     * O competitivo do fim de semana não é outro pareamento: é a MESMA fila e o
     * MESMO Elo do Rivals, com uma contagem que zera toda segunda-feira. Por
     * isso ele mora aqui e não num serviço à parte — dois matchmakings para o
     * mesmo jogo discordariam na primeira mudança de regra.
     *
     * `semana -> (jogador -> { pontos, v, e, d, gp, gc })`. Só as últimas seis
     * semanas ficam no disco: o histórico completo não serve a ninguém e o
     * arquivo é reescrito inteiro a cada gravação.
     */
    this.semanal = new Map()
    /**
     * EVENTOS DA SEMANA — a tabela do desafio semanal (1.0.358).
     *
     * Aqui NÃO há pareamento: o jogador joga sozinho as tres partidas com a
     * regra da semana e manda o resultado. O servidor guarda a MELHOR tentativa
     * de cada um, e so isso — deixar a soma de todas premiaria quem repete a
     * tarde inteira, e a tabela viraria um ranking de tempo livre.
     *
     * A REGRA da semana nao mora aqui de proposito: ela e derivada da string da
     * semana no cliente (`regraDaSemana` em lib/eventos-da-semana.ts). Uma copia
     * da lista de regras no relay seria uma segunda verdade para manter em dia.
     *
     * `semana -> (jogador -> { nome, pontos, saldo, gp })`.
     */
    this.eventos = new Map()
    try {
      const salvo = JSON.parse(fs.readFileSync(this.arquivo, "utf8"))
      for (const j of salvo.jogadores ?? []) this.jogadores.set(j.id, j)
      this.suspeitas = salvo.suspeitas ?? []
      for (const [semana, linhas] of salvo.semanal ?? []) this.semanal.set(semana, new Map(linhas))
      for (const [semana, linhas] of salvo.eventos ?? []) this.eventos.set(semana, new Map(linhas))
    } catch { /* primeira execução */ }
  }

  persistir() {
    const temporario = `${this.arquivo}.tmp`
    // Só as seis semanas mais recentes: o arquivo é reescrito inteiro a cada
    // gravação, e guardar todo o histórico o faria crescer sem fim.
    const semanas = [...this.semanal.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1)).slice(0, 6)
    const eventos = [...this.eventos.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1)).slice(0, 6)
    fs.writeFileSync(temporario, JSON.stringify({
      jogadores: [...this.jogadores.values()],
      suspeitas: this.suspeitas.slice(-500),
      semanal: semanas.map(([semana, linhas]) => [semana, [...linhas.entries()]]),
      eventos: eventos.map(([semana, linhas]) => [semana, [...linhas.entries()]]),
    }))
    fs.renameSync(temporario, this.arquivo)
  }

  /**
   * O identificador da semana corrente, no fuso de Brasília e começando na
   * SEGUNDA — é o recorte que o jogador entende por "fim de semana competitivo".
   */
  semanaCorrente(agora = Date.now()) {
    const d = new Date(agora - 3 * 3600 * 1000)          // UTC-3
    const diaDaSemana = (d.getUTCDay() + 6) % 7          // 0 = segunda
    const segunda = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - diaDaSemana))
    return segunda.toISOString().slice(0, 10)
  }

  /** Quando a semana vira (em ms desde a época), para a tela mostrar a contagem. */
  fimDaSemana(agora = Date.now()) {
    const [ano, mes, dia] = this.semanaCorrente(agora).split("-").map(Number)
    return Date.UTC(ano, mes - 1, dia + 7) + 3 * 3600 * 1000
  }

  linhaSemanal(semana, id) {
    const tabela = this.semanal.get(semana) ?? new Map()
    if (!tabela.has(id)) tabela.set(id, { pontos: 0, j: 0, v: 0, e: 0, d: 0, gp: 0, gc: 0 })
    this.semanal.set(semana, tabela)
    return tabela.get(id)
  }

  /**
   * Pontua a semana. Vitória 3, empate 1 — e o saldo desempata, como em
   * qualquer tabela de futebol.
   */
  pontuarSemana(casaId, foraId, golsCasa, golsFora) {
    const semana = this.semanaCorrente()
    const casa = this.linhaSemanal(semana, casaId)
    const fora = this.linhaSemanal(semana, foraId)
    casa.j++; fora.j++
    casa.gp += golsCasa; casa.gc += golsFora
    fora.gp += golsFora; fora.gc += golsCasa
    if (golsCasa > golsFora) { casa.pontos += 3; casa.v++; fora.d++ }
    else if (golsCasa < golsFora) { fora.pontos += 3; fora.v++; casa.d++ }
    else { casa.pontos++; fora.pontos++; casa.e++; fora.e++ }
  }

  /** A classificação da semana, já ordenada — pontos, saldo, gols pró. */
  classificacaoSemanal(limite = 50) {
    const semana = this.semanaCorrente()
    const tabela = this.semanal.get(semana) ?? new Map()
    return {
      semana,
      terminaEm: this.fimDaSemana(),
      linhas: [...tabela.entries()]
        .map(([id, l]) => ({ id, nome: this.jogadores.get(id)?.nome ?? "Tecnico", ...l, saldo: l.gp - l.gc }))
        .sort((a, b) => b.pontos - a.pontos || b.saldo - a.saldo || b.gp - a.gp)
        .slice(0, limite)
        .map((l, i) => ({ posicao: i + 1, ...l })),
    }
  }

  /**
   * EVENTOS DA SEMANA — registra uma tentativa e devolve a linha valendo.
   *
   * ⚠️ O QUE CHEGA AQUI E PALAVRA DO CLIENTE, e por isso vem TRAVADO nos
   * limites do modo: no maximo tres partidas, logo no maximo 9 pontos, e um
   * saldo que uma goleada tripla nao alcanca. Nao fecha a porta de um cliente
   * adulterado — nada fecha, enquanto a partida roda na maquina do jogador —,
   * mas impede o caso trivial de mandar 9.999 pontos por curl e liderar para
   * sempre. A porta final e simular no servidor, anotada no fim deste arquivo.
   */
  registrarEvento(id, nome, pontos, saldo, gp) {
    const semana = this.semanaCorrente()
    const tabela = this.eventos.get(semana) ?? new Map()
    this.eventos.set(semana, tabela)

    const limpo = {
      nome: String(nome || "Tecnico").slice(0, 32),
      pontos: Math.max(0, Math.min(9, Math.trunc(Number(pontos) || 0))),
      saldo: Math.max(-30, Math.min(30, Math.trunc(Number(saldo) || 0))),
      gp: Math.max(0, Math.min(30, Math.trunc(Number(gp) || 0))),
      tentativas: 1,
    }

    const anterior = tabela.get(id)
    if (!anterior) { tabela.set(id, limpo); return limpo }

    limpo.tentativas = anterior.tentativas + 1
    // Melhor tentativa: pontos, depois saldo, depois gols pro.
    const melhorou =
      limpo.pontos > anterior.pontos ||
      (limpo.pontos === anterior.pontos && limpo.saldo > anterior.saldo) ||
      (limpo.pontos === anterior.pontos && limpo.saldo === anterior.saldo && limpo.gp > anterior.gp)
    const linha = melhorou ? limpo : { ...anterior, tentativas: limpo.tentativas }
    tabela.set(id, linha)
    return linha
  }

  /** A classificacao do evento da semana, ja ordenada. */
  classificacaoDoEvento(limite = 50) {
    const semana = this.semanaCorrente()
    const tabela = this.eventos.get(semana) ?? new Map()
    return {
      semana,
      terminaEm: this.fimDaSemana(),
      linhas: [...tabela.entries()]
        .map(([id, l]) => ({ id, ...l }))
        .sort((a, b) => b.pontos - a.pontos || b.saldo - a.saldo || b.gp - a.gp)
        .slice(0, limite)
        .map((l, i) => ({ posicao: i + 1, ...l })),
    }
  }

  perfil(id, nome) {
    let j = this.jogadores.get(id)
    if (!j) {
      j = { id, nome: String(nome || "Tecnico").slice(0, 32), rating: RATING_INICIAL, partidas: 0, v: 0, e: 0, d: 0, ultimaPartida: 0 }
      this.jogadores.set(id, j)
    }
    return j
  }

  /**
   * Entra na fila. Devolve `{ pareado }` quando já havia alguém compatível.
   *
   * ⚠️ O PAREAMENTO OLHA DUAS COISAS: o rating do TÉCNICO e a força do CLUBE.
   * Só o rating produziria "Real Madrid × Criciúma entre dois jogadores de
   * mesmo ranking", que é justamente o que o usuário apontou como errado. A
   * janela de tolerância ABRE com o tempo de espera — senão quem está no topo
   * ou no fundo da tabela nunca acha ninguém.
   */
  entrarNaFila(modo, { id, nome, forcaDoClube }) {
    const perfil = this.perfil(id, nome)
    const fila = this.fila.get(modo) ?? []
    const agora = Date.now()
    const candidato = fila.find(outro => {
      if (outro.id === id) return false
      const espera = Math.max(agora - outro.desde, agora - (this.esperaDe?.get?.(id) ?? agora)) / 1000
      const janelaRating = 60 + espera * 12          // ±60 no início, abrindo 12 por segundo
      const janelaForca = 6 + espera * 1.2
      return Math.abs(outro.rating - perfil.rating) <= janelaRating
        && Math.abs((outro.forcaDoClube ?? 70) - (forcaDoClube ?? 70)) <= janelaForca
    })

    if (candidato) {
      this.fila.set(modo, fila.filter(x => x.id !== candidato.id))
      return { pareado: candidato }
    }
    if (!fila.some(x => x.id === id)) {
      fila.push({ id, nome: perfil.nome, rating: perfil.rating, forcaDoClube: forcaDoClube ?? 70, desde: agora })
    }
    this.fila.set(modo, fila)
    return { pareado: null }
  }

  sairDaFila(modo, id) {
    const fila = this.fila.get(modo) ?? []
    this.fila.set(modo, fila.filter(x => x.id !== id))
  }

  abrirPartida(modo, casa, fora, sala) {
    const matchId = crypto.randomUUID()
    this.partidas.set(matchId, {
      matchId, modo, sala,
      casa: casa.id, fora: fora.id,
      nomeCasa: casa.nome, nomeFora: fora.nome,
      envios: [],
      criadaEm: Date.now(),
      estado: "aberta",
    })
    return matchId
  }

  /**
   * A PARTIDA ABERTA DE ALGUÉM — e por que ela precisava existir (19/08/2026).
   *
   * ⚠️ O PRIMEIRO DA FILA NUNCA FICAVA SABENDO QUE FOI PAREADO. Quem chegava
   * depois recebia `matchId` e código de sala na resposta; quem já esperava saía
   * da fila em silêncio e continuava perguntando "e agora?" — e como a consulta
   * dele não achava adversário, o servidor o RECOLOCAVA na fila e respondia
   * "na_fila". Resultado, medido contra a VPS: o técnico A ficava em "Procurando
   * adversário…" para sempre enquanto o técnico B já estava numa sala esperando.
   * Pior: A podia ser pareado de novo, com uma partida em aberto.
   *
   * Com este índice a consulta responde a mesma verdade para os dois lados.
   */
  partidaAbertaDe(id) {
    for (const partida of this.partidas.values()) {
      if (partida.estado !== "aberta") continue
      if (partida.casa === id || partida.fora === id) return partida
    }
    return null
  }

  /**
   * Recebe o placar de UM lado. O resultado só vale quando os dois batem.
   *
   * ANTI-CHEAT, nas três camadas que dá para fazer sem simular no servidor:
   *   1. só participante da partida envia (nada de terceiro pontuando);
   *   2. um envio por pessoa — reenviar não sobrescreve o próprio placar
   *      depois de ver o do adversário;
   *   3. placar dentro do possível, e divergência não vira ponto para ninguém.
   */
  enviarResultado(matchId, participanteId, { golsCasa, golsFora, assinatura }) {
    const partida = this.partidas.get(matchId)
    if (!partida) return { erro: "partida_desconhecida" }
    if (partida.estado !== "aberta") return { erro: "partida_encerrada" }
    if (![partida.casa, partida.fora].includes(participanteId)) return { erro: "nao_e_participante" }
    if (partida.envios.some(e => e.de === participanteId)) return { erro: "ja_enviou" }

    const c = Number(golsCasa), f = Number(golsFora)
    if (!Number.isInteger(c) || !Number.isInteger(f) || c < 0 || f < 0 || c > 20 || f > 20) {
      this.registrarSuspeita(participanteId, "placar_impossivel", { matchId, golsCasa, golsFora })
      return { erro: "placar_invalido" }
    }

    partida.envios.push({ de: participanteId, golsCasa: c, golsFora: f, assinatura: String(assinatura || "").slice(0, 128), em: Date.now() })
    if (partida.envios.length < 2) return { estado: "aguardando_confirmacao" }

    const [a, b] = partida.envios
    if (a.golsCasa !== b.golsCasa || a.golsFora !== b.golsFora) {
      partida.estado = "divergente"
      // Divergência não pontua NINGUÉM. Punir os dois seria injusto com quem
      // enviou certo; premiar um deles seria escolher no escuro.
      this.registrarSuspeita(a.de, "resultado_divergente", { matchId, a, b })
      this.registrarSuspeita(b.de, "resultado_divergente", { matchId, a, b })
      this.persistir()
      return { estado: "divergente" }
    }

    partida.estado = "confirmada"
    partida.golsCasa = a.golsCasa
    partida.golsFora = a.golsFora
    // ── MANAGER CHAMPIONS: a partida também conta para a semana ──
    // O rating (Elo) vale nos dois modos; a TABELA semanal é o que distingue o
    // fim de semana competitivo da escada permanente do Rivals.
    if (partida.modo === "champions") {
      this.pontuarSemana(partida.casa, partida.fora, a.golsCasa, a.golsFora)
    }
    return { estado: "confirmada", ...this.aplicarRating(partida) }
  }

  aplicarRating(partida) {
    const casa = this.perfil(partida.casa), fora = this.perfil(partida.fora)
    const pontoCasa = partida.golsCasa > partida.golsFora ? 1 : partida.golsCasa === partida.golsFora ? 0.5 : 0
    const antesCasa = casa.rating, antesFora = fora.rating
    casa.rating = novoRating(antesCasa, antesFora, pontoCasa, casa.partidas)
    fora.rating = novoRating(antesFora, antesCasa, 1 - pontoCasa, fora.partidas)
    for (const [p, ponto] of [[casa, pontoCasa], [fora, 1 - pontoCasa]]) {
      p.partidas++
      p.ultimaPartida = Date.now()
      if (ponto === 1) p.v++
      else if (ponto === 0.5) p.e++
      else p.d++
    }
    this.persistir()
    return {
      casa: { rating: casa.rating, delta: casa.rating - antesCasa, divisao: divisaoDoRating(casa.rating) },
      fora: { rating: fora.rating, delta: fora.rating - antesFora, divisao: divisaoDoRating(fora.rating) },
    }
  }

  registrarSuspeita(id, tipo, detalhe) {
    this.suspeitas.push({ id, tipo, detalhe, em: Date.now() })
  }

  ranking(limite = 50) {
    return [...this.jogadores.values()]
      .sort((a, b) => b.rating - a.rating)
      .slice(0, limite)
      .map((j, i) => ({ posicao: i + 1, nome: j.nome, rating: j.rating, partidas: j.partidas, v: j.v, e: j.e, d: j.d, divisao: divisaoDoRating(j.rating).nome }))
  }
}
