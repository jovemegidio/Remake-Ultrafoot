"use client"

// AVISO DE CONTROLE — um toque discreto, nunca um modal.
//
// A regra: conectar ou desconectar um controle NAO pode interromper o jogo.
// Numa tela de gestao, pausar por causa de periferico e desproporcional; e no
// meio de uma negociacao, um modal por cima rouba o foco e o jogador perde o
// que estava fazendo. Entao isto e um cartao no canto que some sozinho.
//
// A desconexao merece mais atencao que a conexao (o jogador ficou SEM entrada),
// entao ela fica mais tempo e diz o que fazer — mas continua sem travar nada,
// porque mouse e teclado seguem funcionando e essa e a saida.

import { cn } from "@/lib/utils"
import { useRetratoDoInput } from "@/hooks/use-input"

export function AvisoDeControle() {
  const { avisoDeConexao, avisoDeDesconexao, centro } = useRetratoDoInput()

  if (!avisoDeConexao && !avisoDeDesconexao) return null

  return (
    <div
      role="status"
      aria-live="polite"
      data-gamepad-exclude=""
      className={cn(
        "pointer-events-none fixed bottom-[calc(var(--uf-hint-bar,44px)+1rem)] left-1/2 z-[65] -translate-x-1/2",
        "animate-in fade-in slide-in-from-bottom-2 duration-200",
      )}
    >
      {avisoDeDesconexao ? (
        <Cartao
          titulo="Controle desconectado"
          detalhe="Reconecte o controle ou use mouse e teclado."
          tom="alerta"
        />
      ) : avisoDeConexao ? (
        <Cartao
          titulo={`${avisoDeConexao.label} detectado`}
          detalhe={
            // A dica MUDA conforme a capability medida. Dizer "aperte o botao
            // Xbox" numa maquina em que a Steam ficou com o Guide seria ensinar
            // algo que nao funciona — e o jogador concluiria que o jogo esta
            // quebrado, nao que o botao esta ocupado.
            avisoDeConexao.capabilities.centerButton
              ? "Aperte o botão central para ativar o Modo Controle."
              : centro.capability === "RESERVED_BY_SYSTEM"
                ? "Segure View + Menu para ativar o Modo Controle."
                : "Use o controle para ativar o Modo Controle."
          }
          tom="ok"
        />
      ) : null}
    </div>
  )
}

function Cartao({ titulo, detalhe, tom }: { titulo: string; detalhe: string; tom: "ok" | "alerta" }) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-xl border px-4 py-3 shadow-lg backdrop-blur-md",
        tom === "ok"
          ? "border-[var(--brand)]/40 bg-[#0a0e1a]/92"
          : "border-amber-400/40 bg-[#1a1208]/92",
      )}
    >
      <IconeDeControle className={cn("h-6 w-6", tom === "ok" ? "text-[var(--brand)]" : "text-amber-400")} />
      <div className="leading-tight">
        <div className="text-[calc(0.85rem*var(--uf-font-scale,1))] font-bold text-white">{titulo}</div>
        <div className="text-[calc(0.72rem*var(--uf-font-scale,1))] text-white/60">{detalhe}</div>
      </div>
    </div>
  )
}

/** Silhueta neutra de controle: serve para Xbox, PlayStation e genérico. */
function IconeDeControle({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d="M6.5 8h11a4.5 4.5 0 0 1 4.4 5.4l-.8 3.6a2.6 2.6 0 0 1-4.6 1L15 16H9l-1.5 2a2.6 2.6 0 0 1-4.6-1l-.8-3.6A4.5 4.5 0 0 1 6.5 8Z" />
      <path d="M7.2 11.4v2.2M6.1 12.5h2.2" strokeLinecap="round" />
      <circle cx="16.4" cy="11.9" r="0.9" fill="currentColor" stroke="none" />
      <circle cx="18.2" cy="13.6" r="0.9" fill="currentColor" stroke="none" />
    </svg>
  )
}
