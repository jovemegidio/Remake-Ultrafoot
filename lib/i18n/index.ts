"use client"

import { useState, useEffect } from "react"
import { ptBR, type Translations } from "./translations/pt-BR"
import { enUS } from "./translations/en-US"
import { esES } from "./translations/es-ES"
import { itIT } from "./translations/it-IT"
import { storeGet, initPersistentStore } from "@/lib/persistent-store"

// ⚠️ BUG CORRIGIDO (2026-07-20): este arquivo lia SEMPRE "ultrafoot:save" — a
// chave LEGADA. Desde o sistema de múltiplas carreiras o save vive em
// "ultrafoot:save:<careerId>", então a escolha de idioma da splash era gravada
// numa chave e lida de outra: TODO idioma caía no fallback pt-BR. Era isso o
// "os idiomas não estão funcionando".
// Não importamos save-system aqui (risco de ciclo) — replicamos a resolução.
const LEGACY_KEY = "ultrafoot:save"
const ACTIVE_CAREER_KEY = "ultrafoot:active-career"
function saveKey(): string {
  const careerId = storeGet(ACTIVE_CAREER_KEY)
  return careerId ? `ultrafoot:save:${careerId}` : LEGACY_KEY
}

/**
 * REGISTRO DE IDIOMAS — a lista única.
 *
 * A tela de Configurações montava a lista de idiomas à mão, num array separado
 * (`languageOptions`). Duas listas para a mesma coisa é como um idioma acaba
 * oferecido sem existir, ou existindo sem ser oferecido. Agora a tela lê DAQUI:
 * acrescentar um idioma é escrever o arquivo de tradução e somar uma linha.
 *
 * `variantes` são códigos que caem no mesmo arquivo (pt-PT usa o pt-BR, es-MX
 * usa o es-ES). "Castelhano" é o próprio es-ES; "mandarim" é o chinês (zh);
 * "austríaco" é alemão (de) — por isso os três não viram arquivos separados.
 */
export interface IdiomaRegistrado {
  id: string
  /** Nome do idioma NO PRÓPRIO idioma — é assim que se escolhe idioma. */
  label: string
  /** Sigla mostrada no seletor. */
  flag: string
  /**
   * O que este idioma TEM. O que faltar cai no português na montagem do mapa —
   * ver `comReservaEmPortugues`. Só o pt-BR precisa estar completo.
   */
  textos: Profunda<Translations>
  variantes?: string[]
  /** Escrita da direita para a esquerda (árabe, hebraico). */
  rtl?: boolean
  /** Cobertura editorial da versão 1.0.291. */
  releaseStatus: "official" | "preview"
}

export const IDIOMAS: IdiomaRegistrado[] = [
  { id: "pt-BR", label: "Português", flag: "BR", textos: ptBR, variantes: ["pt-PT"], releaseStatus: "official" },
  { id: "en-US", label: "English", flag: "US", textos: enUS, variantes: ["en-GB"], releaseStatus: "preview" },
  { id: "es-ES", label: "Español", flag: "ES", textos: esES, variantes: ["es-MX"], releaseStatus: "preview" },
  { id: "it-IT", label: "Italiano", flag: "IT", textos: itIT, releaseStatus: "preview" },
]

export const RELEASE_LANGUAGE_POLICY_291 = {
  official: ["pt-BR"],
  previews: ["en-US", "es-ES", "it-IT"],
} as const

/**
 * ⚠️ A TRADUÇÃO INCOMPLETA CAI NO PORTUGUÊS — E ISSO É A FUNDAÇÃO DO RESTO.
 *
 * Até a 1.0.348 todo idioma era tipado como `Translations` COMPLETO: acrescentar
 * uma chave em pt-BR quebrava o type-check dos outros três até alguém traduzir
 * as três. Com 403 chaves isso era administrável. Com o jogo inteiro extraído
 * — alguns milhares de frases — vira um portão intransponível: ninguém extrai
 * 200 frases de uma tela sabendo que precisa de 600 traduções no mesmo commit.
 *
 * Era ESSA tipagem, e não a falta de tradutor, que mantinha o jogo em 9% de
 * cobertura. Agora cada idioma declara o que TEM, e o que falta é preenchido
 * com o texto em português na hora de montar o mapa. O jogador nunca vê chave
 * crua nem espaço em branco: vê a frase em português, que é a degradação certa.
 *
 * A fusão acontece UMA vez, na carga do módulo — não a cada `useTranslation`.
 */
type Profunda<T> = { [K in keyof T]?: T[K] extends object ? Profunda<T[K]> : T[K] }
export type TraducaoParcial = Profunda<Translations>

function comReservaEmPortugues<T>(base: T, parcial: Profunda<T> | undefined): T {
  if (!parcial) return base
  const saida = { ...base } as T
  for (const chave of Object.keys(base as object) as (keyof T)[]) {
    const doIdioma = parcial[chave]
    if (doIdioma === undefined) continue
    const original = base[chave]
    saida[chave] = (original !== null && typeof original === "object" && !Array.isArray(original))
      ? comReservaEmPortugues(original, doIdioma as Profunda<typeof original>)
      : (doIdioma as T[keyof T])
  }
  return saida
}

const map: Record<string, Translations> = Object.fromEntries(
  IDIOMAS.flatMap(i => {
    const completo = comReservaEmPortugues(ptBR, i.textos as Profunda<Translations>)
    return [[i.id, completo] as const, ...(i.variantes ?? []).map(v => [v, completo] as const)]
  }),
)

/**
 * Quanto de um idioma está de fato traduzido (0 a 1). É o número que o gate
 * `qa:traducao` cobra e que a tela de Configurações pode mostrar — "preview"
 * deixa de ser um rótulo escrito à mão e passa a ser um fato medido.
 */
export function coberturaDoIdioma(id: string): number {
  const idioma = IDIOMAS.find(i => i.id === id || i.variantes?.includes(id))
  if (!idioma) return 0
  const contar = (base: unknown, parcial: unknown): [number, number] => {
    if (base === null || typeof base !== "object") return [1, parcial === undefined ? 0 : 1]
    let total = 0, traduzidas = 0
    for (const [k, v] of Object.entries(base as Record<string, unknown>)) {
      const [t, d] = contar(v, (parcial as Record<string, unknown> | undefined)?.[k])
      total += t; traduzidas += d
    }
    return [total, traduzidas]
  }
  const [total, traduzidas] = contar(ptBR, idioma.textos)
  return total === 0 ? 1 : traduzidas / total
}

/** O idioma escolhido escreve da direita para a esquerda? */
export function idiomaEhRtl(id: string): boolean {
  return IDIOMAS.find(i => i.id === id || i.variantes?.includes(id))?.rtl ?? false
}

// O idioma vive dentro do save (GameState.language), que agora fica no
// persistent-store (sobrevive a reinstalacao). Ler do localStorage — como antes —
// devolvia sempre pt-BR pos-update, ignorando a escolha do usuario.
function readLanguage(): string {
  try {
    // Career-scoped primeiro; legado como fallback para saves antigos.
    const raw = storeGet(saveKey()) ?? storeGet(LEGACY_KEY)
    if (!raw) return "pt-BR"
    const parsed = JSON.parse(raw) as { language?: string }
    return parsed.language || "pt-BR"
  } catch {
    return "pt-BR"
  }
}

export function useTranslation(): Translations {
  const [lang, setLang] = useState<string>("pt-BR")

  useEffect(() => {
    const refresh = () => setLang(readLanguage())
    refresh()
    // O store carrega do disco de forma async; reaplica o idioma escolhido no boot
    // e sempre que ele mudar (ex.: troca nas Configuracoes).
    void initPersistentStore().then(refresh)
    window.addEventListener("ultrafoot:store:ready", refresh)
    window.addEventListener("ultrafoot:store:changed", refresh)
    return () => {
      window.removeEventListener("ultrafoot:store:ready", refresh)
      window.removeEventListener("ultrafoot:store:changed", refresh)
    }
  }, [])

  return map[lang] ?? ptBR
}

export type { Translations }
