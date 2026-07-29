"use client"

// CONSENTIMENTO DE REDE E CANAIS DE ATUALIZACAO.
//
// Ate aqui o jogo se conectava sozinho: no boot ele baixava a atualizacao de
// elencos e consultava a versao publicada sem perguntar nada. Agora existe uma
// porta: enquanto o jogador nao aceitar, NENHUMA conexao de atualizacao sai da
// maquina. Quem recusar joga com o que veio no build, e pode mudar de ideia a
// qualquer momento em Personalizar > Atualizacoes.
//
// Este modulo e FOLHA de proposito. Quem consulta as camadas de override
// (team-overrides, player-overrides, players-data) precisa saber se o canal
// esta ligado, e essas leituras sao SINCRONAS, no meio da montagem do elenco.
// Deixar o consentimento aqui — sem nada de rede — evita o ciclo de import com
// lib/atualizacao-elencos, que importa estas funcoes.

import { storeGet, storeSet } from "@/lib/persistent-store"

const CHAVE_CONSENTIMENTO = "ultrafoot:atualizacoes:consentimento"
const CHAVE_AUTOMATICO = "ultrafoot:atualizacoes:automatico"
const CHAVE_CANAIS = "ultrafoot:atualizacoes:canais"

/** Disparado sempre que qualquer preferencia daqui muda. */
export const EVENTO_PREFERENCIAS = "ultrafoot:atualizacoes:preferencias"

/** "nao-perguntado" = primeira execucao; e o que faz o convite aparecer. */
export type Consentimento = "aceito" | "recusado" | "nao-perguntado"

/**
 * Os tres canais que o jogador liga e desliga separadamente:
 *
 *  - elencos — atletas, transferencias oficiais e edicoes de jogador;
 *  - times   — escudo, uniforme, cores, estadio e participantes de competicao;
 *  - jogo    — aviso de que existe build nova (quem instala e o launcher).
 */
export type Canal = "elencos" | "times" | "jogo"

export interface Canais {
  elencos: boolean
  times: boolean
  jogo: boolean
}

const CANAIS_PADRAO: Canais = { elencos: true, times: true, jogo: true }

function avisar() {
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent(EVENTO_PREFERENCIAS))
}

// ─── Consentimento ────────────────────────────────────────────────────────────

export function getConsentimento(): Consentimento {
  const v = storeGet(CHAVE_CONSENTIMENTO)
  return v === "aceito" || v === "recusado" ? v : "nao-perguntado"
}

/**
 * A unica pergunta que o resto do codigo precisa fazer antes de tocar na rede.
 *
 * Note que "nao-perguntado" e FALSO: no silencio, nao conecta. Um consentimento
 * que vale por omissao nao e consentimento.
 */
export function podeConectar(): boolean {
  return getConsentimento() === "aceito"
}

export function setConsentimento(valor: "aceito" | "recusado"): void {
  storeSet(CHAVE_CONSENTIMENTO, valor)
  avisar()
}

// ─── Atualizacao automatica ───────────────────────────────────────────────────

/**
 * Com o consentimento dado, o padrao e buscar sozinho no boot — e o que o
 * jogador espera de quem aceitou. Desligar aqui mantem o consentimento (as
 * conexoes manuais continuam valendo) e so tira a busca automatica.
 */
export function getAtualizacaoAutomatica(): boolean {
  return storeGet(CHAVE_AUTOMATICO) !== "0"
}

export function setAtualizacaoAutomatica(ligado: boolean): void {
  storeSet(CHAVE_AUTOMATICO, ligado ? "1" : "0")
  avisar()
}

// ─── Canais ───────────────────────────────────────────────────────────────────

export function getCanais(): Canais {
  const cru = storeGet(CHAVE_CANAIS)
  if (!cru) return CANAIS_PADRAO
  try {
    const lido = JSON.parse(cru) as Partial<Canais>
    return {
      elencos: lido.elencos !== false,
      times: lido.times !== false,
      jogo: lido.jogo !== false,
    }
  } catch {
    return CANAIS_PADRAO
  }
}

/**
 * Canal desligado nao apaga o que ja foi baixado: so deixa de ser consultado.
 * Religar devolve tudo na hora, sem baixar de novo.
 */
export function canalAtivo(canal: Canal): boolean {
  return getCanais()[canal]
}

export function setCanal(canal: Canal, ligado: boolean): void {
  storeSet(CHAVE_CANAIS, JSON.stringify({ ...getCanais(), [canal]: ligado }))
  avisar()
}
