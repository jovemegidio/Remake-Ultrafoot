"use client"

// Moeda de EXIBICAO. O jogo guarda tudo em R$ (BRL); aqui convertemos para a moeda escolhida
// (simbolo + cambio fixo) so na exibicao.
//
// CUIDADO com hidratacao (#418): formatCurrency roda no build (SSR) E no navegador. Se o
// primeiro render do cliente divergir do HTML gerado no build, o React quebra. Por isso o
// simbolo/cambio comecam SEMPRE no padrao BRL (igual ao build); a preferencia salva so e
// aplicada DEPOIS de montar (syncCurrencyFromStore, chamado num effect) e um provider forca
// o re-render da arvore — assim o primeiro render bate com o build e nao ha mismatch.

import { storeGet, storeSet } from "@/lib/persistent-store"

export interface CurrencyDef { code: string; symbol: string; rate: number }

// Cambio aproximado a partir do BRL (base). So exibicao.
export const CURRENCIES: CurrencyDef[] = [
  { code: "BRL", symbol: "R$", rate: 1 },
  { code: "USD", symbol: "$", rate: 0.18 },
  { code: "EUR", symbol: "€", rate: 0.16 },
  { code: "GBP", symbol: "£", rate: 0.14 },
]

const KEY = "ultrafoot:currency"
let _current: CurrencyDef = CURRENCIES[0] // padrao BRL (igual ao build)

export function getCurrency(): CurrencyDef { return _current }
export function getCurrencyCode(): string { return _current.code }

/** Le a preferencia salva e aplica na variavel de modulo (chamar num effect, pos-mount). */
export function syncCurrencyFromStore(): void {
  const code = typeof window === "undefined" ? null : storeGet(KEY)
  const def = CURRENCIES.find((c) => c.code === code)
  if (def) _current = def
}

export function setCurrency(code: string): void {
  const def = CURRENCIES.find((c) => c.code === code)
  if (!def) return
  _current = def
  storeSet(KEY, code)
  if (typeof window !== "undefined")
    window.dispatchEvent(new CustomEvent("ultrafoot:currency:changed", { detail: { code } }))
}
