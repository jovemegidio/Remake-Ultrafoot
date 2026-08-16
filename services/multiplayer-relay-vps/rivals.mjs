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
    try {
      const salvo = JSON.parse(fs.readFileSync(this.arquivo, "utf8"))
      for (const j of salvo.jogadores ?? []) this.jogadores.set(j.id, j)
      this.suspeitas = salvo.suspeitas ?? []
    } catch { /* primeira execução */ }
  }

  persistir() {
    const temporario = `${this.arquivo}.tmp`
    fs.writeFileSync(temporario, JSON.stringify({
      jogadores: [...this.jogadores.values()],
      suspeitas: this.suspeitas.slice(-500),
    }))
    fs.renameSync(temporario, this.arquivo)
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
