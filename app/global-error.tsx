"use client"

import { useEffect, useState } from "react"

// Rede de seguranca do app inteiro.
//
// Sem isto, um erro de render (ex.: o React #310 de hooks fora de ordem) fazia o WebView
// mostrar a tela nativa "This page couldn't load" — feia e sem saida. Agora qualquer erro
// nao tratado cai AQUI: uma tela amigavel, com "Recarregar" e "Voltar ao menu", em vez do
// erro cru do navegador. O progresso do jogador esta salvo (persistent-store), entao
// recarregar/voltar e seguro.
//
// global-error precisa renderizar as proprias tags <html>/<body> (substitui o layout raiz
// quando o erro acontece nele).

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  // RECUPERACAO SILENCIOSA (pedido: "nao exibir a tela de erro para os
  // jogadores"). A maioria dos erros de render e transitoria — um re-render
  // limpo resolve. Entao, na primeira vez, tentamos nos recuperar sozinhos sem
  // mostrar nada ao jogador.
  //
  // A TRAVA importa: se a recuperacao ja foi tentada ha pouco, NAO tentamos de
  // novo. Sem isso, um erro persistente (ex.: laco de render) viraria um ciclo
  // infinito de recarga — pior do que a tela de erro. Passados 30s sem novo
  // erro, a trava expira e o jogo volta a ter direito a uma tentativa.
  const [recuperando, setRecuperando] = useState(true)

  useEffect(() => {
    const CHAVE_TS = "ultrafoot:auto-recover-ts"
    const CHAVE_N = "ultrafoot:auto-recover-n"
    let tentativa = 1
    try {
      const ts = Number(sessionStorage.getItem(CHAVE_TS) ?? 0)
      // Passados 30s sem novo erro, considera-se resolvido: a contagem zera e o
      // jogo volta a ter direito a escada inteira.
      const recente = Date.now() - ts < 30_000
      tentativa = recente ? Number(sessionStorage.getItem(CHAVE_N) ?? 1) + 1 : 1
      sessionStorage.setItem(CHAVE_TS, String(Date.now()))
      sessionStorage.setItem(CHAVE_N, String(tentativa))
      // Guarda o ultimo erro para diagnostico posterior, mesmo quando o jogador
      // nunca chega a ver a tela.
      localStorage.setItem("ultrafoot:ultimo-erro", JSON.stringify({
        quando: new Date().toISOString(),
        tela: window.location.pathname,
        msg: error?.message ?? "",
        digest: error?.digest ?? "",
        stack: (error?.stack ?? "").split("\n").slice(0, 8).join("\n"),
      }))
    } catch { /* sem storage: cai direto na tela visivel */ }

    // Descobre a raiz do app exportado (o fallback nao tem roteador do Next).
    const raiz = () => {
      const s = document.querySelector("script[src*='/_next/']") as HTMLScriptElement | null
      const i = (s?.src ?? "").indexOf("/_next/")
      return i >= 0 ? (s as HTMLScriptElement).src.slice(0, i) : window.location.origin
    }

    // 1a tentativa: remontar a arvore. Resolve o caso comum (erro transitorio de
    // render) sem o jogador perceber nada.
    if (tentativa === 1) {
      const t = setTimeout(() => { try { reset() } catch { setRecuperando(false) } }, 60)
      return () => clearTimeout(t)
    }

    // 2a: o erro se repetiu, ou seja, e determinístico naquela tela — remontar de
    // novo so repetiria o erro. Em vez de mostrar o aviso, devolvemos o jogador
    // ao pre-office, que e o hub do jogo. O progresso ja esta salvo.
    if (tentativa === 2) {
      const t = setTimeout(() => {
        try { window.location.replace(`${raiz()}/pre-office/index.html`) }
        catch { setRecuperando(false) }
      }, 60)
      return () => clearTimeout(t)
    }

    // 3a: nem o hub carrega. Ai o problema e serio e a tela com o detalhe tecnico
    // e mais util do que uma recarga eterna.
    setRecuperando(false)
  }, [reset, error])

  // Enquanto tenta se recuperar, mostra apenas o fundo do jogo — o jogador nao
  // ve mensagem de erro nenhuma.
  if (recuperando) {
    return (
      <html lang="pt-BR">
        <body style={{ margin: 0, minHeight: "100vh", background: "#071114" }} />
      </html>
    )
  }

  return (
    <html lang="pt-BR">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#071114",
          color: "#f4f5f7",
          fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
          padding: "24px",
        }}
      >
        <div style={{ maxWidth: 440, textAlign: "center" }}>
          <div
            style={{
              width: 56,
              height: 56,
              margin: "0 auto 20px",
              borderRadius: 14,
              display: "grid",
              placeItems: "center",
              background: "rgba(255,84,104,0.14)",
              color: "#ff8a97",
              fontSize: 28,
            }}
            aria-hidden
          >
            !
          </div>
          <h1 style={{ fontSize: 20, fontWeight: 800, margin: "0 0 8px" }}>
            Algo deu errado ao carregar esta tela
          </h1>
          <p style={{ fontSize: 14, lineHeight: 1.5, color: "#a2a6b2", margin: "0 0 16px" }}>
            Seu progresso está salvo. Você pode recarregar esta tela ou voltar ao menu
            principal.
          </p>

          {/* DIAGNOSTICO VISIVEL. Sem isto o relato do jogador e sempre "deu erro
              em uma tela", sem tela nem causa — impossivel corrigir. Aqui ele ve
              a mensagem real e o endereco, e pode copiar com um clique. */}
          <div
            style={{
              textAlign: "left",
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.10)",
              borderRadius: 10,
              padding: "12px 14px",
              margin: "0 0 20px",
              fontSize: 12,
              lineHeight: 1.6,
              color: "#c9ccd6",
              wordBreak: "break-word",
            }}
          >
            <div style={{ color: "#8b90a0", fontSize: 10, letterSpacing: 1, marginBottom: 6 }}>
              DETALHE TÉCNICO
            </div>
            <div><b>Tela:</b> {typeof window !== "undefined" ? window.location.pathname : "?"}</div>
            <div><b>Erro:</b> {error?.message || "(sem mensagem)"}</div>
            {error?.digest && <div><b>Código:</b> {error.digest}</div>}
            <button
              onClick={() => {
                if (typeof navigator === "undefined") return
                const txt = [
                  `Tela: ${window.location.pathname}`,
                  `Erro: ${error?.message ?? ""}`,
                  error?.digest ? `Codigo: ${error.digest}` : "",
                  (error?.stack ?? "").split("\n").slice(0, 6).join("\n"),
                ].filter(Boolean).join("\n")
                void navigator.clipboard?.writeText(txt)
              }}
              style={{
                marginTop: 10, borderRadius: 8, padding: "6px 12px", fontSize: 11,
                fontWeight: 700, cursor: "pointer", background: "rgba(255,255,255,0.08)",
                color: "#e6e8ee", border: "1px solid rgba(255,255,255,0.14)",
              }}
            >
              Copiar detalhes do erro
            </button>
          </div>

          <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
            <button
              onClick={() => reset()}
              style={{
                border: 0,
                borderRadius: 10,
                padding: "11px 20px",
                fontSize: 14,
                fontWeight: 700,
                cursor: "pointer",
                background: "#00ffc8",
                color: "#05231b",
              }}
            >
              Recarregar
            </button>
            <button
              onClick={() => {
                if (typeof window === "undefined") return
                // O fallback de erro não tem o provider/roteador do Next. Navega para
                // o arquivo exportado real, em vez de pedir `/splash/` ao Windows.
                const script = document.querySelector("script[src*='/_next/']") as HTMLScriptElement | null
                const scriptUrl = script?.src ?? ""
                const nextIndex = scriptUrl.indexOf("/_next/")
                const appRoot = nextIndex >= 0
                  ? scriptUrl.slice(0, nextIndex)
                  : window.location.origin
                window.location.replace(`${appRoot}/splash/index.html?menu=1`)
              }}
              style={{
                borderRadius: 10,
                padding: "11px 20px",
                fontSize: 14,
                fontWeight: 700,
                cursor: "pointer",
                background: "transparent",
                color: "#a2a6b2",
                border: "1px solid rgba(255,255,255,0.14)",
              }}
            >
              Voltar ao menu
            </button>
          </div>

          
        </div>
      </body>
    </html>
  )
}
