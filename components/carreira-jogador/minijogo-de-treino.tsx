"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Play, Square } from "lucide-react"
import { useTranslation } from "@/lib/i18n"

export function MinijogoDeTreino({ desabilitado, aoConcluir }: {
  desabilitado?: boolean
  aoConcluir: (precisao: number) => void
}) {
  const t = useTranslation()
  const [ativo, setAtivo] = useState(false)
  const [cursor, setCursor] = useState(0)
  const direcao = useRef(1)
  const cursorRef = useRef(0)

  useEffect(() => {
    if (!ativo) return
    const id = window.setInterval(() => {
      const proximo = cursorRef.current + direcao.current * 2.5
      if (proximo >= 100 || proximo <= 0) direcao.current *= -1
      cursorRef.current = Math.max(0, Math.min(100, proximo))
      setCursor(cursorRef.current)
    }, 24)
    return () => window.clearInterval(id)
  }, [ativo])

  const acionar = useCallback(() => {
    if (desabilitado) return
    if (!ativo) {
      cursorRef.current = 0
      direcao.current = 1
      setCursor(0)
      setAtivo(true)
      return
    }
    setAtivo(false)
    const distancia = Math.abs(cursorRef.current - 50)
    aoConcluir(Math.max(0, 1 - distancia / 50))
  }, [ativo, aoConcluir, desabilitado])

  useEffect(() => {
    const teclado = (e: KeyboardEvent) => {
      if ((e.key === " " || e.key === "Enter") && (ativo || document.activeElement?.getAttribute("data-treino") === "true")) {
        e.preventDefault()
        acionar()
      }
    }
    const controle = (e: Event) => {
      if ((e as CustomEvent<{ button: string }>).detail?.button === "A" && ativo) acionar()
    }
    window.addEventListener("keydown", teclado)
    window.addEventListener("gamepad:button", controle)
    return () => {
      window.removeEventListener("keydown", teclado)
      window.removeEventListener("gamepad:button", controle)
    }
  }, [acionar, ativo])

  return (
    <div className="mt-3 rounded-xl border border-white/10 bg-black/30 p-3">
      <div className="relative h-5 overflow-hidden rounded-full bg-red-500/25">
        <div className="absolute inset-y-0 left-[34%] w-[32%] bg-amber-300/35" />
        <div className="absolute inset-y-0 left-[44%] w-[12%] bg-emerald-400/70" />
        <div className="absolute inset-y-0 w-1 -translate-x-1/2 bg-white shadow" style={{ left: `${cursor}%` }} />
      </div>
      <button data-treino="true" disabled={desabilitado} onClick={acionar} className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg border border-[var(--brand)]/25 px-3 py-2 text-xs font-bold text-[var(--brand)] disabled:opacity-30">
        {ativo ? <Square className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
        {ativo ? t.carreiraDeJogador.parar_na_faixa_verde : t.carreiraDeJogador.iniciar_desafio_de_precisao}
      </button>
      <p className="mt-1 text-center text-[10px] text-white/35">{t.carreiraDeJogador.uma_tentativa_por_rodada}</p>
    </div>
  )
}
