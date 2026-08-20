"use client"

import { safeLocalSet } from "@/lib/safe-storage"

/**
 * VIBRAÇÃO DO CONTROLE (rumble).
 *
 * Auditoria de gamepad, 19/08/2026: o jogo tinha um subsistema de controle
 * genuinamente bom — mapa oficial por contexto, ícones Xbox/PlayStation,
 * tratamento de DirectInput e hat switch para DualShock/DualSense, teclado
 * virtual, barra de dicas, bateria por Bluetooth via Tauri — e **nenhuma
 * vibração**. Não havia uma única chamada a `vibrationActuator` no repositório
 * inteiro.
 *
 * É a metade que faltava do controle. Num jogo de futebol, o rumble é o que
 * transforma o gol em acontecimento: a webview do Tauri é Chromium, então
 * `playEffect("dual-rumble", …)` está disponível sem dependência nenhuma.
 *
 * TAMBÉM É ACESSIBILIDADE. Quem joga sem som — por surdez, por estar em lugar
 * silencioso, ou com o volume desligado — perde o apito, a rede balançando e a
 * expulsão. O toque devolve esses três eventos por um canal que não depende de
 * ouvir.
 *
 * ⚠️ PRECISA SER DESLIGÁVEL. Vibração é desconforto para parte das pessoas e
 * consome bateria de controle sem fio. A preferência mora aqui, em localStorage,
 * e o padrão é LIGADO — mas com intensidade média, não máxima.
 */

export type IntensidadeDaVibracao = "desligada" | "suave" | "media" | "forte"

const CHAVE = "ultrafoot:vibracao"

/** Multiplicador aplicado à força de todos os padrões. */
const FATOR: Record<IntensidadeDaVibracao, number> = {
  desligada: 0,
  suave: 0.45,
  media: 1,
  forte: 1.6,
}

export interface PadraoDeVibracao {
  /** Motor pesado (grave, "soco"), 0-1. */
  forte: number
  /** Motor leve (agudo, "chiado"), 0-1. */
  fraco: number
  /** Duração em ms. */
  duracao: number
}

/**
 * Os padrões, escolhidos pelo que o evento SIGNIFICA e não pelo tamanho dele.
 *
 * Gol é o único pulso longo e cheio — se tudo vibrar forte, nada vibra forte.
 * Defesa e trave são curtos e agudos (susto). Cartão vermelho é grave e seco.
 * O apito final é um pulso médio que fecha a partida.
 */
export const PADROES = {
  gol: { forte: 1, fraco: 0.7, duracao: 520 },
  golSofrido: { forte: 0.45, fraco: 0.15, duracao: 300 },
  trave: { forte: 0.2, fraco: 0.85, duracao: 140 },
  defesa: { forte: 0.15, fraco: 0.6, duracao: 110 },
  penalti: { forte: 0.75, fraco: 0.4, duracao: 380 },
  cartaoAmarelo: { forte: 0.3, fraco: 0.25, duracao: 130 },
  cartaoVermelho: { forte: 0.9, fraco: 0.2, duracao: 420 },
  apito: { forte: 0.5, fraco: 0.35, duracao: 240 },
  lesao: { forte: 0.55, fraco: 0.1, duracao: 320 },
  /** Toque curto de interface: confirmar algo importante, não cada clique. */
  toque: { forte: 0.12, fraco: 0.3, duracao: 55 },
} as const satisfies Record<string, PadraoDeVibracao>

export type NomeDePadrao = keyof typeof PADROES

let intensidade: IntensidadeDaVibracao | null = null

function carregar(): IntensidadeDaVibracao {
  if (intensidade) return intensidade
  if (typeof window === "undefined") return "media"
  try {
    const bruto = localStorage.getItem(CHAVE)
    intensidade = bruto === "desligada" || bruto === "suave" || bruto === "media" || bruto === "forte"
      ? bruto
      : "media"
  } catch {
    intensidade = "media"
  }
  return intensidade
}

export function intensidadeDaVibracao(): IntensidadeDaVibracao {
  return carregar()
}

export function definirIntensidadeDaVibracao(valor: IntensidadeDaVibracao): void {
  intensidade = valor
  try { safeLocalSet(CHAVE, valor) } catch { /* sem storage: vale só nesta sessão */ }
  // Devolve a sensação na hora: quem escolhe "forte" quer sentir o que escolheu.
  if (valor !== "desligada") vibrar("toque")
}

/**
 * O controle ativo, se houver.
 *
 * Lê `getGamepads` na hora em vez de guardar referência: o objeto `Gamepad` é um
 * snapshot que o navegador substitui a cada quadro, e um guardado envelhece.
 */
function controleAtivo(): Gamepad | null {
  if (typeof navigator === "undefined") return null
  const lista = navigator.getGamepads?.() ?? []
  for (const g of lista) if (g?.connected) return g
  return null
}

/**
 * Vibra, se houver controle, se o navegador expuser o atuador e se a pessoa
 * quiser. Silenciosa em qualquer outro caso — nunca deve lançar dentro de um
 * tratador de evento de partida.
 */
export function vibrar(padrao: NomeDePadrao | PadraoDeVibracao): void {
  const nivel = carregar()
  if (nivel === "desligada") return

  const p = typeof padrao === "string" ? PADROES[padrao] : padrao
  if (!p) return

  const gamepad = controleAtivo()
  // `vibrationActuator` não existe no lib.dom de todo TypeScript, e nem todo
  // navegador o expõe — daí a checagem em runtime em vez de confiar no tipo.
  const atuador = (gamepad as (Gamepad & {
    vibrationActuator?: { playEffect?: (tipo: string, opcoes: Record<string, number>) => Promise<string> }
  }) | null)?.vibrationActuator
  if (!atuador?.playEffect) return

  const fator = FATOR[nivel]
  const limite = (v: number) => Math.max(0, Math.min(1, v * fator))
  try {
    void atuador.playEffect("dual-rumble", {
      startDelay: 0,
      duration: p.duracao,
      strongMagnitude: limite(p.forte),
      weakMagnitude: limite(p.fraco),
    }).catch(() => { /* controle desconectou no meio: sem consequência */ })
  } catch { /* atuador recusou o tipo de efeito */ }
}

/**
 * O padrão que corresponde a um evento da partida.
 *
 * `souEuQueSofri` inverte o gol: levar um gol não pode dar a mesma comemoração
 * de marcar. Devolve `null` para o que não merece toque — se tudo vibrar, a
 * vibração deixa de significar qualquer coisa.
 */
export function padraoDoEventoDaPartida(
  tipo: string,
  souEuQueSofri = false,
): NomeDePadrao | null {
  switch (tipo) {
    case "goal": return souEuQueSofri ? "golSofrido" : "gol"
    case "post": return "trave"
    case "save": return "defesa"
    case "penalty": return "penalti"
    case "yellow_card": return "cartaoAmarelo"
    case "red_card": return "cartaoVermelho"
    case "injury": return "lesao"
    case "kickoff":
    case "halftime":
    case "fulltime": return "apito"
    default: return null
  }
}
