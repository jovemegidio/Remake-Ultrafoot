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

const BRL = CURRENCIES[0]
const USD = CURRENCIES[1]!

/**
 * Paises cujo mercado negocia em REAL. Todo o resto negocia em DOLAR.
 *
 * O jogo guarda TODO valor em BRL internacionalmente; aqui so escolhemos em que
 * moeda aquele negocio e apresentado. Negociacao dentro do Brasil sai em R$;
 * negociacao com clube de fora sai em US$, com o valor convertido pela taxa —
 * nao e so trocar o simbolo.
 */
const PAISES_EM_REAL = new Set(["brasil", "brazil"])

function normalizarPais(pais?: string | null): string {
  return (pais ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLowerCase()
}

/** Moeda do negocio conforme o pais da contraparte (Brasil = BRL, resto = USD). */
export function currencyForCountry(pais?: string | null): CurrencyDef {
  return PAISES_EM_REAL.has(normalizarPais(pais)) ? BRL : USD
}

/**
 * Converte um valor guardado em BRL para a moeda daquele pais.
 * Use junto de `currencyForCountry` para montar o texto.
 */
export function convertToCountryCurrency(valorEmBRL: number, pais?: string | null): number {
  return valorEmBRL * currencyForCountry(pais).rate
}

export function getCurrency(): CurrencyDef { return _current }
export function getCurrencyCode(): string { return _current.code }

// Não usa Intl.NumberFormat: builds Node com small-icu podem produzir HTML
// diferente do navegador e causar mismatch de hidratação. A formatação manual
// permanece determinística nos dois ambientes.
function groupBR(n: number): string {
  return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".")
}

function compactBR(value: number, prefix: string): string {
  const neg = value < 0 ? "-" : ""
  const v = Math.abs(value)
  // BILHAO tem escala propria: sem ela, o valor de mercado de um gigante saia
  // como "R$ 3410 mi" — numero que ninguem le. Foi por isso que a vitrine do
  // clube escreveu o proprio formatador com R$ chumbado; agora ela pode usar
  // este e respeitar a moeda escolhida.
  if (v >= 1_000_000_000) {
    const n = (v / 1_000_000_000).toFixed(2).replace(/0$/, "").replace(/\.$/, "").replace(".", ",")
    return `${neg}${prefix}${n} bi`
  }
  if (v >= 1_000_000) {
    const n = (v / 1_000_000).toFixed(1).replace(/\.0$/, "").replace(".", ",")
    return `${neg}${prefix}${n} mi`
  }
  if (v >= 1_000 && prefix === "") {
    const n = (v / 1_000).toFixed(1).replace(/\.0$/, "").replace(".", ",")
    return `${neg}${n} mil`
  }
  return `${neg}${prefix}${groupBR(v)}`
}

/** Formata um valor guardado em BRL usando a moeda escolhida pelo jogador. */
export function formatCurrency(value: number): string {
  const c = getCurrency()
  return compactBR(value * c.rate, `${c.symbol} `)
}

/** Formata um negócio na moeda do país da contraparte. */
export function formatCurrencyFor(value: number, pais?: string | null): string {
  const c = currencyForCountry(pais)
  return compactBR(value * c.rate, `${c.symbol} `)
}

/** Formata números sem moeda com sufixos compactos. */
export function formatNumber(value: number): string {
  return compactBR(value, "")
}

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
