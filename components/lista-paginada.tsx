"use client"

// PAGINAR EM VEZ DE ROLAR.
//
// Pedido: "preciso de todas as informações cabendo na tela sem necessidade de
// scroll". Há listas que simplesmente não cabem — 39 contratos numa linha de
// ~65px são 2.500px, e a janela oferece ~850px. Encolher a letra até caber já
// foi tentado nesta base e produziu 2.197 trechos ilegíveis (ver a auditoria de
// responsividade). A saída que sobra é mostrar um pedaço por vez.
//
// A conta de quantos itens cabem NÃO é chutada aqui: quem chama informa
// `porPagina` calibrado pela altura real da caixa daquela tela, medida com o
// harness. Um número solto geraria meia fileira cortada no pé.

import { useEffect, useMemo, useState } from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"

export interface ListaPaginada<T> {
  /** Os itens da página atual — é isto que a tela renderiza. */
  fatia: T[]
  pagina: number
  totalDePaginas: number
  irPara: (p: number) => void
  /** Verdadeiro quando tudo cabe numa página só: aí o rodapé nem aparece. */
  paginaUnica: boolean
  primeiroDaPagina: number
  totalDeItens: number
}

export function usePaginacao<T>(itens: T[], porPagina: number): ListaPaginada<T> {
  const [pagina, setPagina] = useState(0)
  const totalDeItens = itens.length
  const totalDePaginas = Math.max(1, Math.ceil(totalDeItens / porPagina))

  // A lista encolhe (filtro, venda, dispensa) e a página atual pode deixar de
  // existir. Sem isto a tela ficava VAZIA e parecia quebrada — o clássico
  // "sumiu tudo" de quem filtra estando na última página.
  useEffect(() => {
    setPagina(p => Math.min(p, Math.max(0, Math.ceil(itens.length / porPagina) - 1)))
  }, [itens.length, porPagina])

  const atual = Math.min(pagina, totalDePaginas - 1)
  const fatia = useMemo(
    () => itens.slice(atual * porPagina, atual * porPagina + porPagina),
    [itens, atual, porPagina],
  )

  return {
    fatia,
    pagina: atual,
    totalDePaginas,
    irPara: (p: number) => setPagina(Math.max(0, Math.min(p, totalDePaginas - 1))),
    paginaUnica: totalDePaginas <= 1,
    primeiroDaPagina: atual * porPagina,
    totalDeItens,
  }
}

/**
 * Rodapé do paginador. Discreto de propósito: é navegação, não conteúdo — numa
 * tela que já está cheia, um controle chamativo rouba a atenção do que importa.
 */
export function Paginador({
  lista,
  rotulo = "itens",
  className,
}: {
  lista: ListaPaginada<unknown>
  rotulo?: string
  className?: string
}) {
  if (lista.paginaUnica) return null
  const inicio = lista.primeiroDaPagina + 1
  const fim = Math.min(lista.primeiroDaPagina + lista.fatia.length, lista.totalDeItens)
  return (
    <div className={cn("flex shrink-0 items-center justify-between gap-3 border-t border-white/[0.06] px-3 py-2", className)}>
      <span className="text-[10px] tabular-nums text-white/40">
        {inicio}–{fim} de {lista.totalDeItens} {rotulo}
      </span>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => lista.irPara(lista.pagina - 1)}
          disabled={lista.pagina === 0}
          aria-label="Página anterior"
          className="flex h-7 w-7 items-center justify-center rounded-md text-white/50 transition-colors hover:bg-white/10 hover:text-white disabled:pointer-events-none disabled:opacity-25"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="min-w-[52px] text-center text-[11px] font-semibold tabular-nums text-white/70">
          {lista.pagina + 1} / {lista.totalDePaginas}
        </span>
        <button
          type="button"
          onClick={() => lista.irPara(lista.pagina + 1)}
          disabled={lista.pagina >= lista.totalDePaginas - 1}
          aria-label="Próxima página"
          className="flex h-7 w-7 items-center justify-center rounded-md text-white/50 transition-colors hover:bg-white/10 hover:text-white disabled:pointer-events-none disabled:opacity-25"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
