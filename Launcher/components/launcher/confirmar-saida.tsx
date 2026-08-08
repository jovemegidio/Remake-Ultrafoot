"use client"

/**
 * "VOCÊ REALMENTE DESEJA FECHAR O LAUNCHER?"
 *
 * Fechar não é um clique inocente aqui: o launcher supervisiona o jogo (tempo de
 * jogo, presença no FC Hub, detecção de crash) e pode estar no meio de um
 * download de centenas de megabytes. Um X apertado sem querer custava tudo isso
 * sem uma palavra — por isso a pergunta.
 *
 * O modal DIZ o que se perde, em vez de só perguntar: quando há download em
 * andamento ou jogo aberto, a linha correspondente aparece. Um "tem certeza?"
 * seco não ajuda ninguém a decidir.
 *
 * "Minimizar" fica ao lado de propósito: na maioria das vezes é isso que a
 * pessoa queria — tirar a janela da frente, não matar o launcher.
 */

import { useEffect, useRef } from "react"
import { X } from "lucide-react"
import { useT } from "@/lib/i18n"

export function ConfirmarSaida({
  jogoRodando,
  baixando,
  aoCancelar,
  aoMinimizar,
  aoConfirmar,
}: {
  jogoRodando: boolean
  baixando: boolean
  aoCancelar: () => void
  aoMinimizar: () => void
  aoConfirmar: () => void
}) {
  const t = useT()
  const cancelarRef = useRef<HTMLButtonElement>(null)

  // O foco nasce em "Cancelar", e o Esc cancela: nenhum Enter distraído fecha o
  // launcher, que é o desfecho caro deste diálogo.
  useEffect(() => {
    cancelarRef.current?.focus()
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault()
        aoCancelar()
      }
    }
    window.addEventListener("keydown", aoTeclar)
    return () => window.removeEventListener("keydown", aoTeclar)
  }, [aoCancelar])

  return (
    <div
      // Acima da barra de título (z-250) e das bordas de redimensionar (z-300):
      // com o diálogo aberto, nada mais na janela responde.
      className="fixed inset-0 z-[320] flex items-center justify-center bg-black/75 p-6 backdrop-blur"
      onClick={aoCancelar}
      role="dialog"
      aria-modal="true"
      aria-labelledby="titulo-confirmar-saida"
    >
      <section
        className="w-full max-w-sm rounded-2xl border border-border bg-card p-6 shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-red-500/12 text-red-400">
            <X className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <h2 id="titulo-confirmar-saida" className="font-display text-lg font-bold text-foreground">
              {t("sair.titulo")}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">{t("sair.texto")}</p>
          </div>
        </div>

        {(baixando || jogoRodando) && (
          <ul className="mt-4 space-y-1.5 rounded-xl border border-amber-500/25 bg-amber-500/10 p-3 text-xs text-amber-200">
            {baixando && <li>{t("sair.avisoDownload")}</li>}
            {jogoRodando && <li>{t("sair.avisoJogo")}</li>}
          </ul>
        )}

        <div className="mt-5 flex flex-col gap-2">
          <div className="flex gap-2">
            <button
              ref={cancelarRef}
              onClick={aoCancelar}
              className="flex-1 rounded-lg border border-border bg-secondary px-4 py-2.5 text-sm font-semibold text-foreground transition-colors hover:bg-secondary/70"
            >
              {t("acao.cancelar")}
            </button>
            <button
              onClick={aoConfirmar}
              className="flex-1 rounded-lg bg-red-500/90 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-red-500"
            >
              {t("sair.confirmar")}
            </button>
          </div>
          <button
            onClick={aoMinimizar}
            className="text-xs text-muted-foreground underline underline-offset-4 transition hover:text-foreground"
          >
            {t("sair.bandeja")}
          </button>
        </div>
      </section>
    </div>
  )
}
