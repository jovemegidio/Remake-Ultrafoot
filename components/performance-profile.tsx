"use client"

// PERFIL DE DESEMPENHO — o jogo tem que rodar liso em PC modesto.
//
// Dois problemas que este arquivo resolve:
//
// 1) O JOGO TINHA DOIS INTERRUPTORES SEPARADOS. O CSS reage a DOIS atributos
//    diferentes no <html>: `data-performance="economy"` (mata animacoes e
//    backdrop-blur) e `data-performance-mode` (mata sombras pesadas, video de
//    fundo e as camadas animadas do escritorio). Este arquivo so ligava o
//    primeiro; o segundo so era ligado pela deteccao automatica do
//    native-app-provider, com OUTRA chave de localStorage. Resultado: quem
//    escolhia "Economico" na mao continuava com sombra gigante e video de
//    fundo rodando — justamente o que mais pesa. Agora o perfil economico liga
//    os dois de uma vez.
//
// 2) DETECTAR PELA FICHA TECNICA NAO BASTA. A deteccao olhava so
//    hardwareConcurrency e deviceMemory. Um i7 de 2014 com grafico integrado
//    reporta 8 nucleos e 8 GB e passava como "balanced" — mas backdrop-filter
//    naquela GPU e brutal. Por isso agora tem um vigia que mede o TEMPO REAL
//    DE QUADRO depois do boot: se a maquina esta engasgando de verdade, cai
//    para economico sozinho. Medir bate palpite.
//
// A escolha manual do jogador sempre vence: o vigia so age em quem nunca
// mexeu na configuracao, e nunca sobe o perfil de volta (evita ficar
// oscilando entre dois modos no meio da partida).

import { safeLocalSet } from "@/lib/safe-storage"
import { useEffect } from "react"

export type PerformanceProfile = "economy" | "balanced" | "quality"
export const PERFORMANCE_STORAGE_KEY = "ultrafoot:performance-profile"
/** Marca que o perfil veio do JOGADOR, nao da deteccao. Escolha manual manda. */
export const PERFORMANCE_CHOICE_KEY = "ultrafoot:performance-choice"

function ehPerfil(v: unknown): v is PerformanceProfile {
  return v === "economy" || v === "balanced" || v === "quality"
}

// ── Perfil observavel ────────────────────────────────────────────────────
// O CSS reage sozinho aos atributos do <html>, mas o framer-motion NAO: ele
// anima estilo inline via requestAnimationFrame, entao `animation-duration:
// 0.001ms` do modo economico nao encosta nele. Quem precisa desligar animacao
// em JS (ver components/motion-profile.tsx) assina aqui.
let perfilAtual: PerformanceProfile = "balanced"
const ouvintes = new Set<() => void>()

export const performanceStore = {
  subscribe(fn: () => void) { ouvintes.add(fn); return () => { ouvintes.delete(fn) } },
  getSnapshot(): PerformanceProfile { return perfilAtual },
  // No servidor nao existe <html> nem localStorage: assume o meio-termo, que e
  // o mesmo do primeiro render no cliente (evita erro de hidratacao).
  getServerSnapshot(): PerformanceProfile { return "balanced" },
}

/**
 * Aplica o perfil no <html> e persiste.
 *
 * @param origem "user" quando veio da tela de configuracoes — trava o vigia
 *   automatico para nao passar por cima da escolha do jogador.
 */
export function applyPerformanceProfile(profile: PerformanceProfile, origem: "user" | "auto" = "user") {
  const root = document.documentElement
  root.dataset.performance = profile
  // O economico liga TAMBEM o interruptor pesado (sombras, video, camadas do
  // escritorio). Sem esta linha o modo economico entregava metade do ganho.
  root.toggleAttribute("data-performance-mode", profile === "economy")
  safeLocalSet(PERFORMANCE_STORAGE_KEY, profile)
  if (origem === "user") safeLocalSet(PERFORMANCE_CHOICE_KEY, "user")

  if (perfilAtual !== profile) {
    perfilAtual = profile
    for (const fn of ouvintes) fn()
  }
}

/**
 * Vigia de fluidez: mede o tempo real de quadro por alguns segundos e cai para
 * economico se a maquina estiver engasgando.
 *
 * Usa a MEDIANA, nao a media: um engasgo isolado (carregar imagem, GC) nao
 * pode condenar uma maquina boa, mas uma mediana ruim significa que esta
 * lento o tempo todo. Acima de ~28 ms por quadro o jogo esta abaixo de 36 fps
 * de forma sustentada — ai vale trocar efeito por fluidez.
 */
function vigiarFluidez(aplicarEconomico: () => void): () => void {
  const AQUECIMENTO_MS = 1500   // ignora o boot: layout inicial sempre engasga
  const JANELA_MS = 4000        // tempo de observacao
  const LIMITE_MEDIANA_MS = 28  // ~36 fps sustentados
  const MINIMO_AMOSTRAS = 40

  const amostras: number[] = []
  let anterior = 0
  let inicio = 0
  let rafId = 0
  let cancelado = false

  const passo = (agora: number) => {
    if (cancelado) return
    if (!inicio) inicio = agora
    const decorrido = agora - inicio

    if (decorrido > AQUECIMENTO_MS) {
      if (anterior) amostras.push(agora - anterior)
      anterior = agora
    }

    if (decorrido < AQUECIMENTO_MS + JANELA_MS) {
      rafId = requestAnimationFrame(passo)
      return
    }

    // Poucas amostras = aba em segundo plano (o navegador congela o rAF).
    // Nao da para concluir nada; melhor nao mexer.
    if (amostras.length < MINIMO_AMOSTRAS) return

    amostras.sort((a, b) => a - b)
    const mediana = amostras[Math.floor(amostras.length / 2)]
    if (mediana > LIMITE_MEDIANA_MS) aplicarEconomico()
  }

  rafId = requestAnimationFrame(passo)
  return () => { cancelado = true; cancelAnimationFrame(rafId) }
}

export function PerformanceProfileBootstrap() {
  useEffect(() => {
    const guardado = localStorage.getItem(PERFORMANCE_STORAGE_KEY)
    const escolhaDoJogador = localStorage.getItem(PERFORMANCE_CHOICE_KEY) === "user"

    const nav = navigator as Navigator & { deviceMemory?: number }
    const lowSpec = (nav.deviceMemory ?? 8) <= 4 || (nav.hardwareConcurrency ?? 8) <= 4

    const profile: PerformanceProfile = ehPerfil(guardado)
      ? guardado
      : lowSpec ? "economy" : "balanced"

    applyPerformanceProfile(profile, escolhaDoJogador ? "user" : "auto")

    // Quem ja escolheu na mao, ou ja esta no economico, nao precisa de vigia.
    if (escolhaDoJogador || profile === "economy") return

    return vigiarFluidez(() => {
      applyPerformanceProfile("economy", "auto")
    })
  }, [])
  return null
}
