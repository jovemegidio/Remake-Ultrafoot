"use client"

import { useRef, useState, type PointerEvent as ReactPointerEvent } from "react"
import { Crosshair } from "lucide-react"
import { cn } from "@/lib/utils"
import { useTranslation } from "@/lib/i18n"

interface Ponto { x: number; y: number }

export function MiraDoAtleta({
  tipo, lanceId, aoFinalizar,
}: {
  tipo: "finalizacao" | "falta" | "penalti"
  lanceId: string
  aoFinalizar: (precisao: number) => void
}) {
  const t = useTranslation()
  const areaRef = useRef<HTMLDivElement>(null)
  const [mira, setMira] = useState<Ponto>({ x: 50, y: 34 })
  const [bola, setBola] = useState<Ponto>({ x: 50, y: 86 })
  const [arrastando, setArrastando] = useState(false)
  const [animando, setAnimando] = useState(false)
  const ladoDoGoleiro = (Array.from(lanceId).reduce((n, c) => n + c.charCodeAt(0), 0) % 3) - 1

  const ponto = (evento: ReactPointerEvent): Ponto => {
    const caixa = areaRef.current?.getBoundingClientRect()
    if (!caixa) return mira
    return {
      x: Math.max(8, Math.min(92, (evento.clientX - caixa.left) / caixa.width * 100)),
      y: Math.max(8, Math.min(60, (evento.clientY - caixa.top) / caixa.height * 100)),
    }
  }

  const mover = (evento: ReactPointerEvent<HTMLDivElement>) => {
    if (!arrastando || animando) return
    setMira(ponto(evento))
  }

  const soltar = (evento: ReactPointerEvent<HTMLDivElement>) => {
    if (!arrastando || animando) return
    const alvo = ponto(evento)
    setArrastando(false)
    setAnimando(true)
    setMira(alvo)
    setBola(alvo)
    const dentroDoGol = alvo.x >= 12 && alvo.x <= 88 && alvo.y >= 10 && alvo.y <= 54
    const goleiroX = 50 + ladoDoGoleiro * 24
    const longeDoGoleiro = Math.min(1, Math.abs(alvo.x - goleiroX) / 35)
    const canto = Math.min(1, (Math.abs(alvo.x - 50) / 38 + Math.abs(alvo.y - 32) / 28) / 1.5)
    const precisao = dentroDoGol ? Math.max(0.28, Math.min(1, 0.48 + longeDoGoleiro * 0.32 + canto * 0.2)) : 0.2
    window.setTimeout(() => aoFinalizar(precisao), 760)
  }

  return (
    <div className="mt-3">
      <div
        ref={areaRef}
        onPointerMove={mover}
        onPointerUp={soltar}
        onPointerCancel={() => setArrastando(false)}
        className="relative h-64 touch-none select-none overflow-hidden rounded-2xl border-2 border-white/60 bg-[linear-gradient(90deg,#08743d_0_12.5%,#0b8446_12.5%_25%,#08743d_25%_37.5%,#0b8446_37.5%_50%,#08743d_50%_62.5%,#0b8446_62.5%_75%,#08743d_75%_87.5%,#0b8446_87.5%)]"
      >
        <div className="absolute left-1/2 top-[7%] h-[49%] w-[78%] -translate-x-1/2 border-2 border-white/70" />
        <div className="absolute left-1/2 top-[7%] h-[18%] w-[52%] -translate-x-1/2 border-4 border-b-0 border-white bg-black/20" />
        {tipo === "falta" && (
          <div className="absolute left-1/2 top-[46%] flex -translate-x-1/2 gap-1">
            {Array.from({ length: 5 }).map((_, i) => <span key={i} className="h-11 w-3.5 rounded-full bg-slate-950 shadow" />)}
          </div>
        )}
        <div
          className="absolute top-[12%] h-11 w-14 transition-transform duration-700 ease-out"
          style={{ left: "calc(50% - 28px)", transform: animando ? `translateX(${ladoDoGoleiro * 70}px) rotate(${ladoDoGoleiro * 45}deg)` : "none" }}
        >
          <div className="mx-auto h-8 w-5 rounded-t-full bg-amber-300" />
          <div className="h-2 w-14 rounded-full bg-amber-300" />
        </div>
        {arrastando && (
          <Crosshair className="pointer-events-none absolute h-10 w-10 -translate-x-1/2 -translate-y-1/2 text-cyan-200 drop-shadow" style={{ left: `${mira.x}%`, top: `${mira.y}%` }} />
        )}
        <button
          type="button"
          aria-label={t.carreiraDeJogador.arraste_a_bola_para_mirar_e}
          onPointerDown={evento => {
            if (animando) return
            evento.currentTarget.setPointerCapture(evento.pointerId)
            setArrastando(true)
          }}
          className={cn("absolute z-20 h-12 w-12 -translate-x-1/2 -translate-y-1/2 cursor-grab rounded-full border-2 border-black/60 bg-white text-2xl shadow-xl", arrastando && "cursor-grabbing")}
          style={{ left: `${bola.x}%`, top: `${bola.y}%`, transition: animando ? "left 700ms cubic-bezier(.2,.8,.2,1), top 700ms cubic-bezier(.2,.8,.2,1)" : "none" }}
        >
          ⚽
        </button>
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 rounded-full bg-black/60 px-4 py-1.5 text-[11px] text-white/80">
          Arraste a bola, mire no gol e solte
        </div>
      </div>
    </div>
  )
}
