"use client"

// A REDE DE SEGURANCA DE ROTA (1.0.379).
//
// ⚠️ POR QUE ELA FALTAVA E O QUE MUDA. So existia `app/global-error.tsx`, que e a
// rede do documento INTEIRO: quando ele entra, o React desmonta tudo — cabecalho,
// menu, estado da tela — e substitui por uma pagina de falha. Um erro na aba de
// contratos derrubava o jogo todo do mesmo jeito que um erro na inicializacao.
//
// Este arquivo, na raiz de `app/`, atende TODA rota que nao tenha um `error.tsx`
// proprio. O layout continua montado: o jogador ve a falha dentro do jogo, com o
// menu no lugar, e "Tentar de novo" remonta SO aquela tela.
//
// ⚠️ O SAVE NAO ESTA EM RISCO AQUI, e dize-lo importa. O progresso mora no
// `persistent-store`, em disco, e nao no componente que quebrou — por isso
// recarregar e voltar ao menu sao seguros, e a tela diz isso em vez de deixar o
// jogador com medo de perder a carreira.
//
// ⚠️ NAO DA PARA MOSTRAR `error.message` AO JOGADOR. Em build de producao o Next
// substitui a mensagem por um texto generico e entrega so o `digest`. Mostrar a
// mensagem crua daria "an error occurred in the Server Components render" — pior
// que nao dizer nada. O `digest` e o que serve ao suporte, e e ele que aparece.

import { useEffect } from "react"

export default function ErroDaRota({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Console do WebView: e o unico rastro quando o jogador manda print.
    console.error("[ultrafoot] erro de tela", error)
  }, [error])

  return (
    <div
      role="alert"
      style={{
        display: "flex",
        minHeight: "60vh",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 18,
        padding: "48px 24px",
        textAlign: "center",
      }}
    >
      <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: "#fff" }}>
        Esta tela travou
      </h2>

      <p style={{ margin: 0, maxWidth: 460, lineHeight: 1.6, color: "rgba(255,255,255,.65)", fontSize: 15 }}>
        O resto do jogo continua funcionando e a sua carreira está salva. Você pode tentar
        abrir esta tela de novo ou voltar ao menu.
      </p>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "center" }}>
        <button
          onClick={reset}
          style={{
            padding: "10px 22px",
            borderRadius: 8,
            border: "1px solid var(--brand, #00ffc8)",
            background: "var(--brand, #00ffc8)",
            color: "#04120e",
            fontWeight: 700,
            fontSize: 14,
            cursor: "pointer",
          }}
        >
          Tentar de novo
        </button>
        <button
          onClick={() => { window.location.href = "/" }}
          style={{
            padding: "10px 22px",
            borderRadius: 8,
            border: "1px solid rgba(255,255,255,.25)",
            background: "transparent",
            color: "rgba(255,255,255,.85)",
            fontWeight: 600,
            fontSize: 14,
            cursor: "pointer",
          }}
        >
          Voltar ao menu
        </button>
      </div>

      {error.digest && (
        <p style={{ margin: 0, fontSize: 12, color: "rgba(255,255,255,.35)", fontFamily: "monospace" }}>
          código da falha: {error.digest}
        </p>
      )}
    </div>
  )
}
