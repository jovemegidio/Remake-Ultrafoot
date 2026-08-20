"use client"

// TELA DE DEPURACAO DO CONTROLE — so em desenvolvimento.
//
// Ela existe porque problema de gamepad quase nunca acontece na maquina de quem
// programa: acontece com o DualShock 4 de outra pessoa, por Bluetooth, sem
// driver, com a Steam aberta. Sem um lugar que mostre indice cru, perfil
// escolhido e capability medida, o diagnostico vira adivinhacao por mensagem.
//
// ── Como ela NAO vaza para producao ─────────────────────────────────────────
// A guarda e `process.env.NODE_ENV`, que o Next substitui por literal no build.
// `"production" !== "production"` vira `false` constante e o bundler remove o
// componente inteiro — nao e so "nao renderiza", e nao vai junto.
//
// Atalho: Ctrl+Shift+G.

import { useEffect, useRef, useState } from "react"

import { cn } from "@/lib/utils"
import { barramentoDeAcoes } from "@/lib/input/bus"
import { pilhaDeContextos } from "@/lib/input/contexts"
import { gerenteDeFoco } from "@/lib/focus/manager"
import { TODOS_OS_BOTOES } from "@/lib/controller/profiles"
import type { EventoDeAcao } from "@/lib/input/actions"
import { useModoDeExibicao, usePreferenciasDeInput, useRetratoDoInput } from "@/hooks/use-input"

const EM_DESENVOLVIMENTO = process.env.NODE_ENV !== "production"

export function DepuracaoDeControle() {
  const [visivel, setVisivel] = useState(false)

  useEffect(() => {
    if (!EM_DESENVOLVIMENTO) return
    const aoTecla = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === "g") {
        e.preventDefault()
        setVisivel(v => !v)
      }
    }
    window.addEventListener("keydown", aoTecla)
    return () => window.removeEventListener("keydown", aoTecla)
  }, [])

  if (!EM_DESENVOLVIMENTO || !visivel) return null
  return <Painel aoFechar={() => setVisivel(false)} />
}

function Painel({ aoFechar }: { aoFechar: () => void }) {
  const retrato = useRetratoDoInput()
  const prefs = usePreferenciasDeInput()
  const exibicao = useModoDeExibicao()
  const [ultimas, setUltimas] = useState<EventoDeAcao[]>([])
  const [cru, setCru] = useState<{ botoes: string[]; eixos: number[] } | null>(null)
  const [foco, setFoco] = useState<string | null>(null)
  const [contexto, setContexto] = useState<string>("GLOBAL")
  const raf = useRef<number | null>(null)

  useEffect(() => barramentoDeAcoes.espiar(e => setUltimas(l => [e, ...l].slice(0, 8))), [])
  useEffect(() => gerenteDeFoco.observar(id => setFoco(id)), [])
  useEffect(() => pilhaDeContextos.observar(t => setContexto(t)), [])

  // Leitura crua do navegador, a ~10 Hz. É a única coisa aqui que faz polling —
  // e só enquanto o painel está aberto, que por definição é durante depuração.
  useEffect(() => {
    let ultimo = 0
    const laco = (t: number) => {
      raf.current = requestAnimationFrame(laco)
      if (t - ultimo < 100) return
      ultimo = t
      const gp = (navigator.getGamepads?.() ?? []).find(g => g?.connected)
      if (!gp) return setCru(null)
      setCru({
        botoes: gp.buttons.map((b, i) => (b.pressed ? String(i) : "")).filter(Boolean),
        eixos: gp.axes.map(v => Number(v.toFixed(2))),
      })
    }
    raf.current = requestAnimationFrame(laco)
    return () => {
      if (raf.current != null) cancelAnimationFrame(raf.current)
    }
  }, [])

  const d = retrato.primario

  return (
    <div
      data-gamepad-modal="off"
      data-gamepad-exclude=""
      className="fixed right-3 top-3 z-[200] max-h-[86vh] w-[380px] overflow-auto rounded-xl border border-white/15 bg-black/92 p-3 font-mono text-[11px] text-white/85 shadow-2xl backdrop-blur"
    >
      <div className="mb-2 flex items-center justify-between">
        <strong className="text-[var(--brand)]">Controller Debug</strong>
        <button type="button" onClick={aoFechar} className="rounded px-2 py-0.5 text-white/50 hover:bg-white/10">
          fechar
        </button>
      </div>

      <Secao titulo="Dispositivo">
        <Linha k="Device" v={d?.label ?? "—"} />
        <Linha k="Raw name" v={d?.rawName ?? "—"} />
        <Linha k="Vendor ID" v={d?.vendorId != null ? `0x${d.vendorId.toString(16).padStart(4, "0")}` : "—"} />
        <Linha k="Product ID" v={d?.productId != null ? `0x${d.productId.toString(16).padStart(4, "0")}` : "—"} />
        <Linha k="Family / Model" v={d ? `${d.family} / ${d.model}` : "—"} />
        <Linha k="Connection" v={d?.connection ?? "—"} />
        <Linha k="Profile" v={d?.profile.id ?? "—"} />
        <Linha k="Conectados" v={String(retrato.dispositivos.length)} />
      </Secao>

      <Secao titulo="Botão central">
        <Linha k="Capability" v={retrato.centro.capability} destaque={retrato.centro.capability !== "AVAILABLE"} />
        <Linha k="Backend" v={retrato.centro.backend} />
        <Linha k="Reason" v={retrato.centro.reason} />
        <Linha k="Fallback" v={`${prefs.combo.a} + ${prefs.combo.b} (${prefs.combo.seguraMs}ms)`} />
      </Secao>

      <Secao titulo="Modo">
        <Linha k="InputMode" v={retrato.inputMode} />
        <Linha k="DisplayMode" v={exibicao} />
        <Linha k="InputContext" v={contexto} />
        <Linha k="Current focus" v={foco ?? "—"} />
        <Linha k="Deadzone / intenção" v={`${prefs.deadzone} / ${prefs.intencao}`} />
      </Secao>

      <Secao titulo="Leitura crua (navegador)">
        <Linha k="Botões" v={cru?.botoes.join(", ") || "—"} />
        <Linha k="Eixos" v={cru?.eixos.join(", ") || "—"} />
      </Secao>

      <Secao titulo="Botões normalizados">
        <div className="grid grid-cols-3 gap-x-2">
          {TODOS_OS_BOTOES.map(b => (
            <span key={b} className="truncate text-white/45">
              {b}
            </span>
          ))}
        </div>
      </Secao>

      <Secao titulo="Últimas ações">
        {ultimas.length === 0 ? (
          <div className="text-white/40">— nenhuma —</div>
        ) : (
          ultimas.map((e, i) => (
            <div key={`${e.instante}-${i}`} className="flex justify-between gap-2">
              <span className="text-[var(--brand)]">{e.action}</span>
              <span className="text-white/40">
                {e.origem}
                {e.repetida ? " ·rep" : ""} · {e.contexto}
              </span>
            </div>
          ))
        )}
      </Secao>
    </div>
  )
}

function Secao({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="mb-2 border-t border-white/10 pt-2">
      <div className="mb-1 text-[10px] uppercase tracking-widest text-white/40">{titulo}</div>
      {children}
    </div>
  )
}

function Linha({ k, v, destaque }: { k: string; v: string; destaque?: boolean }) {
  return (
    <div className="flex justify-between gap-2">
      <span className="shrink-0 text-white/45">{k}</span>
      <span className={cn("truncate text-right", destaque ? "text-amber-400" : "text-white/85")}>{v}</span>
    </div>
  )
}
