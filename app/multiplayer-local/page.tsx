"use client"

// MODOS LOCAIS — REMOVIDO (pedido de 12/08/2026).
//
// A tela oferecia carreira compartilhada, Versus, Draft e mata-mata "no mesmo
// computador", e nenhum dos quatro passava de um formulário: o Draft, por
// exemplo, era um campo de texto onde se DIGITAVA o nome do atleta — sem
// catálogo, sem elenco montado no fim e sem partida.
//
// O Draft foi para onde ele faz sentido: a sala ONLINE do FC Hub, como modo
// draft x draft (ver components/hub-draft.tsx e lib/draft-online.ts). Lá o
// atleta que você não pegou vai para a mão de alguém de verdade.
//
// A rota continua existindo só para não quebrar atalho antigo: ela leva ao FC
// Hub, que é onde o multijogador mora agora.
import { useEffect } from "react"
import { hardNavigate } from "@/lib/hard-navigation"

export default function ModosLocaisRemovidos() {
  useEffect(() => {
    const id = window.setTimeout(() => hardNavigate("/"), 2_500)
    // Abre o FC Hub assim que a tela de destino montar.
    try { sessionStorage.setItem("ultrafoot:abrir-fc-hub", "1") } catch { /* opcional */ }
    return () => window.clearTimeout(id)
  }, [])

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-3 bg-[#050508] px-6 text-center">
      <h1 className="text-xl font-black text-white">Os modos locais saíram do jogo</h1>
      <p className="max-w-md text-sm text-white/50">
        O Draft agora é um modo <b className="text-white/80">online, técnico contra técnico</b>, dentro
        da sala do FC Hub. Levando você para lá…
      </p>
    </main>
  )
}
