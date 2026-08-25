"use client"

import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react"
import { Crosshair, Gauge, RotateCcw, Ruler, ShieldAlert, Footprints } from "lucide-react"
import { cn } from "@/lib/utils"
import { useTranslation } from "@/lib/i18n"
import type { ChuteDoJogador, ContextoDoChute, DesfechoDoChute } from "@/lib/fisica-do-chute"

interface Ponto { x: number; y: number }

export type TipoDaMiraDoAtleta =
  | "finalizacao"
  | "falta"
  | "penalti"
  | "defesa"
  | "saida_do_gol"
  | "penalti_defensivo"

const limitar = (valor: number, minimo: number, maximo: number) => Math.max(minimo, Math.min(maximo, valor))

/**
 * ONDE O GOL ESTÁ NA TELA, em porcentagem da área de mira.
 *
 * ⚠️ ESTES NÚMEROS SÃO A PONTE ENTRE A TELA E A FÍSICA, e até a 1.0.373 os dois
 * lados discordavam: o gol DESENHADO ocupava 24% a 76% da largura, e o código
 * aceitava como "dentro" qualquer mira entre 12% e 88%. Na prática o jogador
 * mirava visivelmente fora das traves e o lance contava como chute a gol.
 *
 * Agora existe um só retângulo, e a conversão para o espaço da física
 * (`lib/fisica-do-chute`: x de −1 a +1 entre os postes, y de 0 a 1 até o
 * travessão) sai dele. Mirar fora do desenho vira, corretamente, bola fora.
 */
const GOL = { esquerda: 24, direita: 76, topo: 7, base: 25 }

const paraFisica = (p: Ponto) => ({
  x: (p.x - (GOL.esquerda + GOL.direita) / 2) / ((GOL.direita - GOL.esquerda) / 2),
  y: (GOL.base - p.y) / (GOL.base - GOL.topo),
})

function numeroDaSemente(texto: string): number {
  return Array.from(texto).reduce((n, c) => Math.imul(n ^ c.charCodeAt(0), 16777619), 2166136261) >>> 0
}

export function MiraDoAtleta({ tipo, lanceId, contexto, aoFinalizar }: {
  tipo: TipoDaMiraDoAtleta
  lanceId: string
  /**
   * DE ONDE O CHUTE SAI — mostrado ao jogador ANTES de ele mirar (1.0.374).
   *
   * ⚠️ SEM ISTO A FÍSICA SERIA INJUSTA. Distância, ângulo e marcação mudam o
   * desvio em até 4x; deixar o jogador apontar sem saber se está na pequena
   * área ou chutando de 30 metros sob marcação é pedir uma decisão no escuro e
   * depois cobrar por ela.
   */
  contexto?: ContextoDoChute
  /**
   * Devolve a mira e o CHUTE. Se o consumidor retornar o desfecho da física,
   * a bola é animada pela trajetória REAL em vez de por uma curva estimada —
   * ver a bola cair é o que separa "entendi por que não foi" de "foi azar".
   */
  aoFinalizar: (precisao: number, chute: ChuteDoJogador) => DesfechoDoChute | void
}) {
  const t = useTranslation()
  const areaRef = useRef<HTMLDivElement>(null)
  const defensiva = ["defesa", "saida_do_gol", "penalti_defensivo"].includes(tipo)
  const [mira, setMira] = useState<Ponto>({ x: 50, y: 16 })
  const [arrastando, setArrastando] = useState(false)
  const [animando, setAnimando] = useState(false)
  const [voo, setVoo] = useState<DesfechoDoChute | null>(null)
  const [forca, setForca] = useState(tipo.includes("penalti") ? 82 : 72)
  const [curva, setCurva] = useState(0)
  const semente = useMemo(() => numeroDaSemente(lanceId), [lanceId])
  const ladoDoGoleiro = (semente % 3) - 1

  const ponto = useCallback((evento: ReactPointerEvent): Ponto => {
    const caixa = areaRef.current?.getBoundingClientRect()
    if (!caixa) return mira
    return {
      x: limitar((evento.clientX - caixa.left) / caixa.width * 100, 14, 86),
      y: limitar((evento.clientY - caixa.top) / caixa.height * 100, 3, 34),
    }
  }, [mira])

  const finalizar = useCallback((alvo: Ponto = mira) => {
    if (animando) return
    setAnimando(true)
    setArrastando(false)
    setMira(alvo)

    const chute: ChuteDoJogador = {
      alvo: paraFisica(alvo),
      forca: limitar(forca / 100, 0, 1),
      efeito: limitar(curva / 100, -1, 1),
    }

    // ⚠️ A PRECISÃO CONTINUA SENDO CALCULADA, e não é dívida técnica. Passe,
    // drible e desarme não passam pela física — não têm trave nem goleiro — e
    // seguem usando este número. Só a finalização e a defesa viram geometria.
    const daFisica = chute.alvo
    const dentroDoGol = Math.abs(daFisica.x) <= 1 && daFisica.y >= 0 && daFisica.y <= 1
    const precisao = dentroDoGol
      ? limitar(0.55 + (1 - Math.abs(daFisica.x)) * 0.2 + (1 - Math.abs(forca - 74) / 80) * 0.25, 0.2, 1)
      : 0.2

    const desfecho = aoFinalizar(precisao, chute)
    if (desfecho) setVoo(desfecho)
    window.setTimeout(() => setAnimando(false), 900)
  }, [animando, aoFinalizar, curva, forca, mira])

  useEffect(() => {
    const moverMira = (dx: number, dy: number) => setMira(atual => ({
      x: limitar(atual.x + dx, 14, 86), y: limitar(atual.y + dy, 3, 34),
    }))
    const aoTeclar = (evento: KeyboardEvent) => {
      if (animando) return
      const passo = evento.shiftKey ? 5 : 2.5
      if (evento.key === "ArrowLeft") moverMira(-passo, 0)
      else if (evento.key === "ArrowRight") moverMira(passo, 0)
      else if (evento.key === "ArrowUp") moverMira(0, -passo * 0.6)
      else if (evento.key === "ArrowDown") moverMira(0, passo * 0.6)
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
      // ⚠️ O DIRECIONAL E O ANALÓGICO ESQUERDO FAZEM O MESMO, e comparar os
      // oito nomes um a um era o caminho óbvio e errado: o jogador que mira com
      // o analógico não pensa "isto é LSTICK". Um sufixo resolve os dois, e
      // qualquer eixo novo entra sem tocar nesta lista.
      const direcional = botao?.replace(/^(DPAD|LSTICK)_/, "")
      const eDirecional = botao !== direcional
      if (eDirecional && direcional === "LEFT") moverMira(-3, 0)
      else if (eDirecional && direcional === "RIGHT") moverMira(3, 0)
      else if (eDirecional && direcional === "UP") moverMira(0, -2)
      else if (eDirecional && direcional === "DOWN") moverMira(0, 2)
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

  // ── A TRAJETÓRIA DESENHADA ────────────────────────────────────────────────
  // Com o voo da física em mãos, o caminho é o caminho REAL: os pontos que o
  // motor calculou, convertidos de volta para a tela. Sem ele (lance que não
  // passa pela física, ou consumidor que não devolve nada), cai numa curva
  // estimada — que é só enfeite de mira, e por isso não decide nada.
  const trajetoria = useMemo(() => {
    if (voo) {
      const pts = voo.trajetoria.caminho.map(p => {
        const x = (GOL.esquerda + GOL.direita) / 2 + p.x * ((GOL.direita - GOL.esquerda) / 2)
        const yGol = GOL.base - p.y * (GOL.base - GOL.topo)
        // z vai de 0 (pé do jogador) a 1 (linha do gol): interpola da base da
        // área até a altura do gol, para a bola parecer se afastar.
        const y = 86 + (yGol - 86) * p.z
        return `${x.toFixed(2)} ${y.toFixed(2)}`
      })
      return `M ${pts.join(" L ")}`
    }
    const controleX = 50 + curva * 0.22
    const controleY = limitar(65 - forca * 0.38, 20, 58)
    return `M 50 86 Q ${controleX} ${controleY} ${mira.x} ${mira.y}`
  }, [voo, curva, forca, mira])

  const corDoVoo = voo?.tipo === "gol" ? "rgba(74,222,128,.9)"
    : voo?.tipo === "defesa" ? "rgba(251,191,36,.9)"
      : voo?.tipo === "trave" ? "rgba(244,114,182,.9)"
        : voo ? "rgba(248,113,113,.9)" : "rgba(165,243,252,.45)"

  // O goleiro adiantado é DESENHADO adiantado: a física faz ele sair do gol em
  // lance de perto, e mostrá-lo sempre na linha mentiria sobre por que o cara a
  // cara é difícil.
  const avancoDoGoleiro = contexto && !contexto.goleiroNaLinha
    ? Math.pow(1 - limitar(contexto.distancia, 0, 1), 2) * 22
    : 0

  const ladoDaAnimacao = voo?.tipo === "defesa" && voo.ladoDoGoleiro
    ? Math.sign(voo.ladoDoGoleiro)
    : ladoDoGoleiro

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
        <div
          className="absolute -translate-x-1/2 border-4 border-b-0 border-white bg-black/25"
          style={{
            left: "50%",
            top: `${GOL.topo}%`,
            height: `${GOL.base - GOL.topo}%`,
            width: `${GOL.direita - GOL.esquerda}%`,
            backgroundImage: "repeating-linear-gradient(90deg,rgba(255,255,255,.16) 0 1px,transparent 1px 7px),repeating-linear-gradient(0deg,rgba(255,255,255,.16) 0 1px,transparent 1px 7px)",
          }}
        />
        {tipo === "falta" && (
          <div className="absolute left-1/2 top-[46%] flex -translate-x-1/2 gap-1">
            {Array.from({ length: 5 }).map((_, i) => <span key={i} className="h-11 w-3.5 rounded-full bg-slate-950 shadow" />)}
          </div>
        )}
        <div
          className="absolute h-11 w-14 transition-transform duration-700 ease-out"
          style={{
            left: "calc(50% - 28px)",
            top: `${GOL.base - 4 + avancoDoGoleiro}%`,
            transform: animando ? `translateX(${ladoDaAnimacao * 70}px) rotate(${ladoDaAnimacao * 45}deg)` : "none",
          }}
        >
          <div className="mx-auto h-8 w-5 rounded-t-full bg-amber-300" />
          <div className="h-2 w-14 rounded-full bg-amber-300" />
        </div>
        <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
          <path d={trajetoria} fill="none" stroke={corDoVoo} strokeDasharray={voo ? undefined : "2 2"} strokeWidth={voo ? 1.1 : 0.7} />
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
        {/* DE ONDE ESTE CHUTE SAI — a informação que a física exige que o
            jogador tenha antes de decidir. Só números e ícones, sem frase: a
            distância em metros e a marcação em porcentagem são legíveis em
            qualquer idioma sem uma chave de tradução nova por rótulo. */}
        {contexto && !defensiva && (
          <div className="absolute left-2 top-2 flex flex-col gap-1 rounded-lg bg-black/70 px-2 py-1.5 text-[10px] font-semibold text-white/85">
            <span className="flex items-center gap-1.5">
              <Ruler className="h-3 w-3 text-cyan-300" />
              {Math.round(6 + contexto.distancia * 26)} m
            </span>
            <span className="flex items-center gap-1.5">
              <ShieldAlert className={cn("h-3 w-3", contexto.pressao > 0.6 ? "text-rose-400" : "text-emerald-300")} />
              {Math.round(contexto.pressao * 100)}%
            </span>
            {contexto.deCabeca
              ? <span className="text-sm leading-none">🗣️</span>
              : contexto.pe
                ? (
                  <span className="flex items-center gap-1.5">
                    <Footprints className="h-3 w-3 text-amber-300" />
                    {contexto.pe === "direito" ? "D" : "E"}
                  </span>
                )
                : null}
          </div>
        )}
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
        <label className={cn("flex items-center gap-2", (defensiva || contexto?.deCabeca) && "opacity-35")}>
          <RotateCcw className="h-3.5 w-3.5 text-cyan-300" />
          <span className="w-12">{t.carreiraDeJogador.curva} {curva}</span>
          <input aria-label={t.carreiraDeJogador.curva} disabled={defensiva || contexto?.deCabeca} type="range" min={-100} max={100} value={curva} onChange={e => setCurva(Number(e.target.value))} className="min-w-0 flex-1 accent-cyan-300" />
        </label>
      </div>
    </div>
  )
}
