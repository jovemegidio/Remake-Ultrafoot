// PREFERENCIAS DE CONTROLE — da MAQUINA, nunca do save.
//
// ── Por que nao no save ─────────────────────────────────────────────────────
// `controllerType` mora em GameState desde antes desta auditoria, e isso e um
// erro que estamos corrigindo aqui (mantendo compatibilidade). Deadzone, escala
// de interface e modo TV descrevem a MAQUINA e a TELA de quem joga, nao a
// carreira: quem tem duas carreiras nao quer reconfigurar a deadzone do proprio
// controle duas vezes, e quem carrega o save para outro PC nao quer levar junto
// o "modo TV" de um monitor que ficou para tras.
//
// A leitura de `controllerType` do save continua sendo respeitada (ver
// `preferirGlifoDoSave`) para que ninguem perca a escolha que ja tinha feito.
//
// ── Por que nao guardar o identificador do controle ─────────────────────────
// Guardar "meu controle e o 054c:0ce6" parece util e e uma armadilha: o dia em
// que o DualSense fica sem bateria e a pessoa pega o Xbox, o jogo procuraria um
// aparelho que nao esta la. Guardamos PREFERENCIA (qual familia de glifo), nunca
// IDENTIDADE de aparelho.

import { safeLocalGet, safeLocalSet } from "@/lib/safe-storage"
import type { AmarracoesDoJogador } from "./bindings"
import { LIMIARES_PADRAO } from "./intent"
import { REPETICAO_PADRAO } from "./repeat"

const CHAVE = "ultrafoot:input"

/** Como o jogo decide quem esta no comando. */
export type PreferenciaDeEntrada = "auto" | "mouse" | "gamepad"

/** Preset de exibicao. `auto` decide pelo tamanho e pela distancia provaveis. */
export type PreferenciaDeExibicao = "auto" | "desktop" | "tv" | "handheld"

/** Familia de glifo a mostrar. `auto` segue o controle conectado. */
export type PreferenciaDeGlifo = "auto" | "xbox" | "playstation"

/**
 * Combinacao que liga o Modo Controle quando o botao central nao esta
 * disponivel. Guardada como par de botoes FISICOS — assim a mesma preferencia
 * vale para Xbox (View+Menu) e PlayStation (Share+Options) sem duas entradas.
 */
export interface ComboDeAtivacao {
  a: "SELECT" | "START" | "SHOULDER_L" | "SHOULDER_R" | "STICK_L" | "STICK_R"
  b: "SELECT" | "START" | "SHOULDER_L" | "SHOULDER_R" | "STICK_L" | "STICK_R"
  /** Quanto tempo segurar. 600 ms e o pedido; abaixo de ~400 ms dispara sem querer. */
  seguraMs: number
}

export interface PreferenciasDeInput {
  entrada: PreferenciaDeEntrada
  exibicao: PreferenciaDeExibicao
  glifo: PreferenciaDeGlifo
  deadzone: number
  /** Limiar para o analogico ASSUMIR o Modo Controle. */
  intencao: number
  atrasoInicialMs: number
  intervaloRepeticaoMs: number
  /** O botao central liga o Modo Controle? Desligavel para quem usa o overlay. */
  botaoCentralAtiva: boolean
  combo: ComboDeAtivacao
  amarracoes: AmarracoesDoJogador
  /** Escala extra sobre o preset, para quem quer maior/menor que o padrao. */
  ajusteDeEscala: number
}

export const PREFERENCIAS_PADRAO: PreferenciasDeInput = {
  entrada: "auto",
  exibicao: "auto",
  glifo: "auto",
  deadzone: LIMIARES_PADRAO.deadzone,
  intencao: LIMIARES_PADRAO.intencao,
  atrasoInicialMs: REPETICAO_PADRAO.atrasoInicialMs,
  intervaloRepeticaoMs: REPETICAO_PADRAO.intervaloMs,
  botaoCentralAtiva: true,
  combo: { a: "SELECT", b: "START", seguraMs: 600 },
  amarracoes: {},
  ajusteDeEscala: 1,
}

/**
 * Faixas aceitas. Um valor fora da faixa nao e rejeitado: e GRAMPEADO.
 *
 * Preferencia vem de localStorage, que qualquer um edita. Uma deadzone de 0.99
 * salva a mao deixaria o controle inerte e pareceria defeito do jogo; um
 * `intervaloRepeticaoMs` de 0 travaria a interface num laco de foco.
 */
function grampear(p: PreferenciasDeInput): PreferenciasDeInput {
  const limite = (v: number, min: number, max: number, padrao: number) =>
    Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : padrao
  return {
    ...p,
    deadzone: limite(p.deadzone, 0.02, 0.6, PREFERENCIAS_PADRAO.deadzone),
    intencao: limite(p.intencao, 0.2, 0.95, PREFERENCIAS_PADRAO.intencao),
    atrasoInicialMs: limite(p.atrasoInicialMs, 80, 1000, PREFERENCIAS_PADRAO.atrasoInicialMs),
    intervaloRepeticaoMs: limite(p.intervaloRepeticaoMs, 30, 400, PREFERENCIAS_PADRAO.intervaloRepeticaoMs),
    ajusteDeEscala: limite(p.ajusteDeEscala, 0.75, 1.6, 1),
    combo: {
      ...p.combo,
      seguraMs: limite(p.combo?.seguraMs, 250, 2000, PREFERENCIAS_PADRAO.combo.seguraMs),
    },
  }
}

let cache: PreferenciasDeInput | null = null

export function lerPreferencias(): PreferenciasDeInput {
  if (cache) return cache
  const bruto = safeLocalGet(CHAVE)
  if (!bruto) {
    cache = PREFERENCIAS_PADRAO
    return cache
  }
  try {
    const lido = JSON.parse(bruto) as Partial<PreferenciasDeInput>
    // Mescla com o padrao em vez de confiar no que veio: preferencia gravada por
    // uma versao antiga do jogo NAO tem os campos novos, e um `undefined` num
    // limiar viraria `NaN` na primeira comparacao — o controle simplesmente
    // pararia de andar, sem erro nenhum no console.
    cache = grampear({
      ...PREFERENCIAS_PADRAO,
      ...lido,
      combo: { ...PREFERENCIAS_PADRAO.combo, ...(lido.combo ?? {}) },
      amarracoes: lido.amarracoes ?? {},
    })
  } catch {
    cache = PREFERENCIAS_PADRAO
  }
  return cache
}

type Ouvinte = (p: PreferenciasDeInput) => void
const ouvintes = new Set<Ouvinte>()

export function observarPreferencias(ouvinte: Ouvinte): () => void {
  ouvintes.add(ouvinte)
  return () => {
    ouvintes.delete(ouvinte)
  }
}

export function gravarPreferencias(mudanca: Partial<PreferenciasDeInput>): PreferenciasDeInput {
  const proximo = grampear({ ...lerPreferencias(), ...mudanca })
  cache = proximo
  safeLocalSet(CHAVE, JSON.stringify(proximo))
  ouvintes.forEach(o => o(proximo))
  return proximo
}

export function restaurarPadroes(): PreferenciasDeInput {
  cache = PREFERENCIAS_PADRAO
  safeLocalSet(CHAVE, JSON.stringify(PREFERENCIAS_PADRAO))
  ouvintes.forEach(o => o(PREFERENCIAS_PADRAO))
  return PREFERENCIAS_PADRAO
}

/**
 * Compatibilidade com o `controllerType` do save.
 *
 * Quem ja tinha escolhido "PlayStation" nas configuracoes antigas continua com
 * PlayStation. A preferencia NOVA vence quando alguem a define explicitamente;
 * enquanto ela estiver em "auto", a antiga ainda manda.
 */
export function preferirGlifoDoSave(doSave: "auto" | "xbox" | "playstation" | undefined): PreferenciaDeGlifo {
  const nova = lerPreferencias().glifo
  if (nova !== "auto") return nova
  return doSave && doSave !== "auto" ? doSave : "auto"
}
