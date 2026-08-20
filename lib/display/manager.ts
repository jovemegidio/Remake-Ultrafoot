// MODO DE EXIBICAO — separado do modo de ENTRADA, de proposito.
//
// Sao dois eixos independentes, e confundi-los e o erro classico de "modo
// console" em PC:
//
//   InputMode = mouse   + DisplayMode = tv        joga no sofa com mouse sem fio
//   InputMode = gamepad + DisplayMode = desktop   joga no monitor com controle
//
// Se o preset de TV viesse junto com o controle, o segundo caso ficaria com
// tudo enorme sem motivo, e o primeiro nunca aconteceria. Por isso o modo de
// exibicao tem escolha, palpite e persistencia PROPRIOS — e o modo de entrada
// nao encosta nele em lugar nenhum.

"use client"

import { aplicarPreset, palpiteDeExibicao, PRESETS, type DisplayMode, type TokensDeExibicao } from "./presets"
import { lerPreferencias, observarPreferencias } from "@/lib/input/preferences"

type Ouvinte = (modo: DisplayMode) => void

class GerenteDeExibicao {
  private modo: DisplayMode = "desktop"
  private ouvintes = new Set<Ouvinte>()
  private iniciado = false
  private limpezas: Array<() => void> = []

  iniciar(): void {
    if (this.iniciado || typeof window === "undefined") return
    this.iniciado = true

    this.recalcular()
    this.limpezas.push(observarPreferencias(() => this.recalcular()))

    // Só em "Automático" a janela importa. Com escolha explícita, redimensionar
    // não pode trocar o preset: quem escolheu TV e depois arrastou a janela não
    // pediu para voltar ao Desktop.
    const aoRedimensionar = () => {
      if (lerPreferencias().exibicao === "auto") this.recalcular()
    }
    window.addEventListener("resize", aoRedimensionar, { passive: true })
    this.limpezas.push(() => window.removeEventListener("resize", aoRedimensionar))
  }

  parar(): void {
    this.limpezas.forEach(f => f())
    this.limpezas = []
    this.iniciado = false
  }

  private recalcular(): void {
    const prefs = lerPreferencias()
    const alvo: DisplayMode = prefs.exibicao === "auto" ? palpiteDeExibicao() : prefs.exibicao
    aplicarPreset(alvo, prefs.ajusteDeEscala)
    if (alvo === this.modo) return
    this.modo = alvo
    this.ouvintes.forEach(o => o(alvo))
  }

  get atual(): DisplayMode {
    return this.modo
  }

  get tokens(): TokensDeExibicao {
    return PRESETS[this.modo]
  }

  assinar(ouvinte: Ouvinte): () => void {
    this.ouvintes.add(ouvinte)
    return () => {
      this.ouvintes.delete(ouvinte)
    }
  }
}

export const gerenteDeExibicao = new GerenteDeExibicao()
export type { DisplayMode }
