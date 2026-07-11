"use client"

import { useState, useEffect } from "react"
import { ptBR, type Translations } from "./translations/pt-BR"
import { enUS } from "./translations/en-US"
import { esES } from "./translations/es-ES"
import { storeGet, initPersistentStore } from "@/lib/persistent-store"

const STORAGE_KEY = "ultrafoot:save"

const map: Record<string, Translations> = {
  "pt-BR": ptBR,
  "en-US": enUS,
  "es-ES": esES,
}

// O idioma vive dentro do save (GameState.language), que agora fica no
// persistent-store (sobrevive a reinstalacao). Ler do localStorage — como antes —
// devolvia sempre pt-BR pos-update, ignorando a escolha do usuario.
function readLanguage(): string {
  try {
    const raw = storeGet(STORAGE_KEY)
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
