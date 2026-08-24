"use client"

import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react"
import { Crosshair, Gauge, RotateCcw } from "lucide-react"
import { cn } from "@/lib/utils"
import { useTranslation } from "@/lib/i18n"

interface Ponto { x: number; y: number }

export type TipoDaMiraDoAtleta =
  | "finalizacao"
  | "falta"
  | "penalti"
  | "defesa"
  | "saida_do_gol"
  | "penalti_defensivo"

const limitar = (valor: number, minimo: number, maximo: number) => Math.max(minimo, Math.min(maximo, valor))

function numeroDaSemente(texto: string): number {
  return Array.from(texto).reduce((n, c) => Math.imul(n ^ c.charCodeAt(0), 16777619), 2166136261) >>> 0
}

export function MiraDoAtleta({ tipo, lanceId, aoFinalizar }: {
  tipo: TipoDaMiraDoAtleta
  lanceId: string
  aoFinalizar: (precisao: number) => void
}) {
  const t = useTranslation()
  const areaRef = useRef<HTMLDivElement>(null)
  const defensiva = ["defesa", "saida_do_gol", "penalti_defensivo"].includes(tipo)
  const [mira, setMira] = useState<Ponto>({ x: 50, y: 34 })
  const [arrastando, setArrastando] = useState(false)
  const [animando, setAnimando] = useState(false)
  const [forca, setForca] = useState(tipo.includes("penalti") ? 82 : 72)
  const [curva, setCurva] = useState(0)
  const semente = useMemo(() => numeroDaSemente(lanceId), [lanceId])
  const ladoDoGoleiro = (semente % 3) - 1
  const chuteDoAdversario = useMemo<Ponto>(() => ({
    x: 18 + (semente % 65),
    y: 13 + (Math.floor(semente / 67) % 35),
  }), [semente])

  const ponto = useCallback((evento: ReactPointerEvent): Ponto => {
    const caixa = areaRef.current?.getBoundingClientRect()
    if (!caixa) return mira
    return {
      x: limitar((evento.clientX - caixa.left) / caixa.width * 100, 8, 92),
      y: limitar((evento.clientY - caixa.top) / caixa.height * 100, 8, 60),
    }
  }, [mira])

  const finalizar = useCallback((alvo: Ponto = mira) => {
    if (animando) return
    setAnimando(true)
    setArrastando(false)
    setMira(alvo)

    let precisao: number
    if (defensiva) {
      const distancia = Math.hypot(alvo.x - chuteDoAdversario.x, (alvo.y - chuteDoAdversario.y) * 1.25)
      const leitura = limitar(1 - distancia / (tipo === "penalti_defensivo" ? 48 : 58), 0.18, 1)
      const tempo = 1 - Math.abs(forca - 70) / 90
      precisao = limitar(leitura * 0.82 + tempo * 0.18, 0.2, 1)
    } else {
      const dentroDoGol = alvo.x >= 12 && alvo.x <= 88 && alvo.y >= 10 && alvo.y <= 54
      const goleiroX = 50 + ladoDoGoleiro * 24
      const longeDoGoleiro = limitar(Math.abs(alvo.x - goleiroX) / 35, 0, 1)
      const canto = limitar((Math.abs(alvo.x - 50) / 38 + Math.abs(alvo.y - 32) / 28) / 1.5, 0, 1)
      const forcaIdeal = tipo === "penalti" ? 84 : tipo === "falta" ? 76 : 72
      const controleDaForca = limitar(1 - Math.abs(forca - forcaIdeal) / 72, 0.25, 1)
      const curvaUtil = tipo === "falta" ? Math.abs(curva) / 100 * 0.2 : Math.abs(curva) / 100 * 0.07
      const bateNaBarreira = tipo === "falta" && alvo.y > 37 && Math.abs(curva) < 24
      precisao = dentroDoGol
        ? limitar((0.4 + longeDoGoleiro * 0.27 + canto * 0.18 + curvaUtil) * controleDaForca * (bateNaBarreira ? 0.45 : 1), 0.2, 1)
        : 0.2
    }
    window.setTimeout(() => aoFinalizar(precisao), 820)
  }, [animando, aoFinalizar, curva, defensiva, chuteDoAdversario, forca, ladoDoGoleiro, mira, tipo])

  useEffect(() => {
    const moverMira = (dx: number, dy: number) => setMira(atual => ({
      x: limitar(atual.x + dx, 8, 92), y: limitar(atual.y + dy, 8, 60),
    }))
    const aoTeclar = (evento: KeyboardEvent) => {
      if (animando) return
      const passo = evento.shiftKey ? 6 : 3
      if (evento.key === "ArrowLeft") moverMira(-passo, 0)
      else if (evento.key === "ArrowRight") moverMira(passo, 0)
      else if (evento.key === "ArrowUp") moverMira(0, -passo)
      else if (evento.key === "ArrowDown") moverMira(0, passo)
      else if (evento.key.toLowerCase() === "a") setCurva(v => limitar(v - 10, -100, 100))
      else if (evento.key.toLowerCase() === "d") setCurva(v => limitar(v + 10, -100, 100))
      else if (evento.key.toLowerCase() === "w" || evento.key === "+") setForca(v => limitar(v + 5, 20, 100))
      else if (evento.key.toLowerCase() === "s" || evento.key === "-") setForca(v => limitar(v - 5, 20, 100))
      else if (evento.key === "Enter" || evento.key === " ") finalizar()
      else return
      evento.preventDefault()
    }
    const aoControle = (evento: Event) => {
      if (animando) return
      const botao = (evento as CustomEvent<{ button: string }>).detail?.button
      if (botao === "DPAD_LEFT") moverMira(-4, 0)
      else if (botao === "DPAD_RIGHT") moverMira(4, 0)
      else if (botao === "DPAD_UP") moverMira(0, -4)
      else if (botao === "DPAD_DOWN") moverMira(0, 4)
      else if (botao === "LB") setCurva(v => limitar(v - 12, -100, 100))
      else if (botao === "RB") setCurva(v => limitar(v + 12, -100, 100))
      else if (botao === "LT") setForca(v => limitar(v - 6, 20, 100))
      else if (botao === "RT") setForca(v => limitar(v + 6, 20, 100))
      else if (botao === "A") finalizar()
    }
    window.addEventListener("keydown", aoTeclar)
    window.addEventListener("gamepad:button", aoControle)
    return () => {
      window.removeEventListener("keydown", aoTeclar)
      window.removeEventListener("gamepad:button", aoControle)
    }
  }, [animando, finalizar])

  const mover = (evento: ReactPointerEvent<HTMLDivElement>) => {
    if (!arrastando || animando) return
    setMira(ponto(evento))
  }
  const soltar = (evento: ReactPointerEvent<HTMLDivElement>) => {
    if (!arrastando || animando) return
    finalizar(ponto(evento))
  }
  const alvoDaBola = defensiva ? chuteDoAdversario : mira
  const controleX = 50 + curva * 0.22
  const controleY = limitar(65 - forca * 0.38, 20, 58)
  const trajetoria = `M 50 86 Q ${controleX} ${controleY} ${alvoDaBola.x} ${alvoDaBola.y}`

  return (
    <div className="mt-3">
      <div
        ref={areaRef}
        role="application"
        aria-label={t.carreiraDeJogador.arraste_a_bola_para_mirar_e}
        tabIndex={0}
        onPointerMove={mover}
        onPointerUp={soltar}
        onPointerCancel={() => setArrastando(false)}
        className="relative h-64 touch-none select-none overflow-hidden rounded-2xl border-2 border-white/60 bg-[linear-gradient(90deg,#08743d_0_12.5%,#0b8446_12.5%_25%,#08743d_25%_37.5%,#0b8446_37.5%_50%,#08743d_50%_62.5%,#0b8446_62.5%_75%,#08743d_75%_87.5%,#0b8446_87.5%)] outline-none focus:border-cyan-300"
      >
        <div className="absolute left-1/2 top-[7%] h-[49%] w-[78%] -translate-x-1/2 border-2 border-white/70" />
        <div className="absolute left-1/2 top-[7%] h-[18%] w-[52%] -translate-x-1/2 border-4 border-b-0 border-white bg-black/20" />
        {tipo === "falta" && (
          <div className="absolute left-1/2 top-[46%] flex -translate-x-1/2 gap-1">
            {Array.from({ length: 5 }).map((_, i) => <span key={i} className="h-11 w-3.5 rounded-full bg-slate-950 shadow" />)}
          </div>
        )}
        {!defensiva && (
          <div className="absolute top-[12%] h-11 w-14 transition-transform duration-700 ease-out" style={{ left: "calc(50% - 28px)", transform: animando ? `translateX(${ladoDoGoleiro * 70}px) rotate(${ladoDoGoleiro * 45}deg)` : "none" }}>
            <div className="mx-auto h-8 w-5 rounded-t-full bg-amber-300" />
            <div className="h-2 w-14 rounded-full bg-amber-300" />
          </div>
        )}
        <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
          <path d={trajetoria} fill="none" stroke="rgba(165,243,252,.45)" strokeDasharray="2 2" strokeWidth="0.7" />
          {animando && (
            <circle r="2.7" fill="white" stroke="#111" strokeWidth="0.5">
              <animateMotion dur="0.75s" fill="freeze" path={trajetoria} />
            </circle>
          )}
        </svg>
        {!animando && <Crosshair className="pointer-events-none absolute h-10 w-10 -translate-x-1/2 -translate-y-1/2 text-cyan-200 drop-shadow" style={{ left: `${mira.x}%`, top: `${mira.y}%` }} />}
        <button
          type="button"
          aria-label={defensiva ? t.carreiraDeJogador.arraste_o_goleiro_para_o_ponto : t.carreiraDeJogador.arraste_a_bola_para_mirar_e}
          onPointerDown={evento => {
            if (animando) return
            evento.currentTarget.setPointerCapture(evento.pointerId)
            setArrastando(true)
          }}
          className={cn("absolute z-20 grid h-12 w-12 -translate-x-1/2 -translate-y-1/2 cursor-grab place-items-center rounded-full border-2 border-black/60 bg-white text-2xl shadow-xl", arrastando && "cursor-grabbing", animando && "opacity-0")}
          style={{ left: defensiva ? `${mira.x}%` : "50%", top: defensiva ? `${mira.y}%` : "86%" }}
        >
          {defensiva ? "🧤" : "⚽"}
        </button>
        <div className="absolute bottom-2 left-1/2 flex -translate-x-1/2 items-center gap-3 rounded-full bg-black/70 px-4 py-1.5 text-[10px] text-white/80">
          <span>{defensiva ? t.carreiraDeJogador.mire_a_defesa_e_confirme : t.carreiraDeJogador.mire_e_solte}</span>
          <span className="hidden sm:inline">{t.carreiraDeJogador.controles_da_mira}</span>
        </div>
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2 rounded-xl border border-white/10 bg-black/30 p-2 text-[10px] text-white/60">
        <label className="flex items-center gap-2">
          <Gauge className="h-3.5 w-3.5 text-amber-300" />
          <span className="w-12">{t.carreiraDeJogador.forca} {forca}</span>
          <input aria-label={t.carreiraDeJogador.forca} type="range" min={20} max={100} value={forca} onChange={e => setForca(Number(e.target.value))} className="min-w-0 flex-1 accent-amber-300" />
        </label>
        <label className={cn("flex items-center gap-2", defensiva && "opacity-35")}>
          <RotateCcw className="h-3.5 w-3.5 text-cyan-300" />
          <span className="w-12">{t.carreiraDeJogador.curva} {curva}</span>
          <input aria-label={t.carreiraDeJogador.curva} disabled={defensiva} type="range" min={-100} max={100} value={curva} onChange={e => setCurva(Number(e.target.value))} className="min-w-0 flex-1 accent-cyan-300" />
        </label>
      </div>
    </div>
  )
}
