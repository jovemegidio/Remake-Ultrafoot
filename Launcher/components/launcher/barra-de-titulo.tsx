"use client"

/**
 * BARRA DE TÍTULO PRÓPRIA.
 *
 * A janela agora abre SEM decoração do sistema (`decorations: false` no
 * tauri.conf.json) — é o que Steam, Epic e EA App fazem, e é o detalhe que mais
 * separa um app nativo de "um site dentro de uma janela".
 *
 * Tirar a decoração tem duas consequências que o config sozinho não resolve, e
 * que este arquivo existe para cobrir:
 *
 * 1. NÃO HÁ MAIS COMO ARRASTAR NEM FECHAR. Sem barra do sistema não há botões
 *    nem área de arrasto. Antes o launcher abria em tela cheia e a única saída
 *    era saber F11/Esc — dava para ficar preso numa janela sem controles.
 *    Aqui os três botões voltam, e o `data-tauri-drag-region` devolve o arrasto.
 *
 * 2. NÃO HÁ MAIS BORDA DE REDIMENSIONAR. O Windows desenha essa borda junto com
 *    a decoração. As oito faixas invisíveis das beiradas repõem o
 *    comportamento — sem elas, a janela ficaria presa num tamanho só.
 *
 * O X NÃO fecha nada por conta própria: ele só avisa (`aoFechar`). Quem decide é
 * o launcher — sumir na bandeja, para quem ligou a opção, ou perguntar antes de
 * sair. É o mesmo caminho do Alt+F4, para os dois não divergirem.
 */

import { useCallback, useEffect, useState } from "react"
import { Minus, Square, Copy, X } from "lucide-react"
import { cn } from "@/lib/utils"

const isTauri = () =>
  typeof window !== "undefined" && "__TAURI_INTERNALS__" in window

async function janela() {
  const { getCurrentWindow } = await import("@tauri-apps/api/window")
  return getCurrentWindow()
}

/** Direções aceitas pelo `startResizeDragging` do Tauri. */
const BEIRADAS = [
  { dir: "North", classe: "left-2 right-2 top-0 h-[3px] cursor-n-resize" },
  { dir: "South", classe: "left-2 right-2 bottom-0 h-[3px] cursor-s-resize" },
  { dir: "West", classe: "top-2 bottom-2 left-0 w-[3px] cursor-w-resize" },
  { dir: "East", classe: "top-2 bottom-2 right-0 w-[3px] cursor-e-resize" },
  { dir: "NorthWest", classe: "top-0 left-0 h-2 w-2 cursor-nw-resize" },
  { dir: "NorthEast", classe: "top-0 right-0 h-2 w-2 cursor-ne-resize" },
  { dir: "SouthWest", classe: "bottom-0 left-0 h-2 w-2 cursor-sw-resize" },
  { dir: "SouthEast", classe: "bottom-0 right-0 h-2 w-2 cursor-se-resize" },
] as const

export function BordasParaRedimensionar() {
  if (!isTauri()) return null
  return (
    <>
      {BEIRADAS.map(({ dir, classe }) => (
        <div
          key={dir}
          className={cn("fixed z-[300]", classe)}
          onMouseDown={(e) => {
            if (e.button !== 0) return
            e.preventDefault()
            void janela().then((j) => j.startResizeDragging(dir as never))
          }}
        />
      ))}
    </>
  )
}

export function BarraDeTitulo({
  titulo,
  aoFechar,
}: {
  titulo: string
  /** Pedido de fechamento. A decisão (bandeja ou confirmar a saída) é de quem chama. */
  aoFechar: () => void
}) {
  const [maximizada, setMaximizada] = useState(true)

  useEffect(() => {
    if (!isTauri()) return
    let vivo = true
    void janela().then(async (j) => {
      if (vivo) setMaximizada(await j.isMaximized())
    })
    return () => {
      vivo = false
    }
  }, [])

  const minimizar = useCallback(() => {
    void janela().then((j) => j.minimize())
  }, [])

  const alternarTamanho = useCallback(() => {
    void janela().then(async (j) => {
      await j.toggleMaximize()
      setMaximizada(await j.isMaximized())
    })
  }, [])

  return (
    <div
      data-tauri-drag-region
      className="relative z-[250] flex h-9 shrink-0 select-none items-center justify-between border-b border-white/[0.06] bg-[#05090b] px-3"
    >
      {/* O texto também arrasta: barra em que só o vazio arrasta é a pegadinha
          clássica de janela sem decoração. */}
      <div data-tauri-drag-region className="flex items-center gap-2 text-[11px] font-semibold text-white/45">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/games/ultrafoot-icon.png" alt="" className="h-4 w-4 rounded-sm object-contain" />
        {titulo}
      </div>

      <div className="flex items-center">
        <BotaoDaJanela aoClicar={minimizar} rotulo="Minimizar">
          <Minus className="h-3.5 w-3.5" />
        </BotaoDaJanela>
        <BotaoDaJanela aoClicar={alternarTamanho} rotulo={maximizada ? "Restaurar" : "Maximizar"}>
          {maximizada ? <Copy className="h-3 w-3" /> : <Square className="h-3 w-3" />}
        </BotaoDaJanela>
        <BotaoDaJanela aoClicar={aoFechar} rotulo="Fechar" perigo>
          <X className="h-3.5 w-3.5" />
        </BotaoDaJanela>
      </div>
    </div>
  )
}

function BotaoDaJanela({
  children,
  aoClicar,
  rotulo,
  perigo,
}: {
  children: React.ReactNode
  aoClicar: () => void
  rotulo: string
  perigo?: boolean
}) {
  return (
    <button
      onClick={aoClicar}
      title={rotulo}
      aria-label={rotulo}
      className={cn(
        "flex h-9 w-11 items-center justify-center text-white/50 transition-colors",
        perigo ? "hover:bg-red-500/90 hover:text-white" : "hover:bg-white/10 hover:text-white",
      )}
    >
      {children}
    </button>
  )
}
