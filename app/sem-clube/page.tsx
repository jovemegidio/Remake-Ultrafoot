"use client"

// A carreira SEM CLUBE foi unificada na Area do Treinador (/treinador), a pedido:
// ao pedir demissao ou ser demitido, o tecnico fica fixo la ate assumir um novo
// clube, e as propostas por reputacao aparecem naquela tela.
//
// Esta rota so encaminha para /treinador — mantida para nao quebrar back/bookmark
// de versoes anteriores que navegavam para ca.

import { useEffect } from "react"
import { hardNavigate } from "@/lib/hard-navigation"

export default function UnemployedCareerRedirect() {
  useEffect(() => {
    hardNavigate("/treinador")
  }, [])

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#05090b] text-white/60">
      <p className="text-sm">Redirecionando para a Área do Treinador…</p>
    </main>
  )
}
