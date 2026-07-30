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
  textos: Translations
  variantes?: string[]
  /** Escrita da direita para a esquerda (árabe, hebraico). */
  rtl?: boolean
}

export const IDIOMAS: IdiomaRegistrado[] = [
  { id: "pt-BR", label: "Português", flag: "BR", textos: ptBR, variantes: ["pt-PT"] },
  { id: "en-US", label: "English", flag: "US", textos: enUS, variantes: ["en-GB"] },
  { id: "es-ES", label: "Español", flag: "ES", textos: esES, variantes: ["es-MX"] },
  { id: "it-IT", label: "Italiano", flag: "IT", textos: itIT },
]

const map: Record<string, Translations> = Object.fromEntries(
  IDIOMAS.flatMap(i => [[i.id, i.textos] as const, ...(i.variantes ?? []).map(v => [v, i.textos] as const)]),
)

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
