"use client"

import { useState, useEffect } from "react"
import { ptBR, type Translations } from "./translations/pt-BR"
import { enUS } from "./translations/en-US"
import { esES } from "./translations/es-ES"

const STORAGE_KEY = "ultrafoot:save"

const map: Record<string, Translations> = {
  "pt-BR": ptBR,
  "en-US": enUS,
  "es-ES": esES,
}

function readLanguage(): string {
  if (typeof window === "undefined") return "pt-BR"
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
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
    setLang(readLanguage())

    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY || e.key === null) {
        setLang(readLanguage())
      }
    }
    window.addEventListener("storage", onStorage)
    return () => window.removeEventListener("storage", onStorage)
  }, [])

  return map[lang] ?? ptBR
}

export type { Translations }
