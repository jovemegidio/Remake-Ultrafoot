"use client"

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
  return (
    <html lang="pt-BR">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#050508",
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

          {/* A mensagem REAL do erro, copiavel: sem ela todo relato de jogador
              vira "da erro na tela" e a causa fica impossivel de rastrear. */}
          <pre
            style={{ marginTop: 20, fontSize: 11, color: "#8b8fa0", background: "rgba(255,255,255,0.04)", borderRadius: 8, padding: "10px 12px", textAlign: "left", whiteSpace: "pre-wrap", wordBreak: "break-word", userSelect: "text" }}
          >
            {error?.message ?? "erro desconhecido"}
            {error?.digest ? "\ndigest: " + error.digest : ""}
            {error?.stack ? "\n" + error.stack.split("\n").slice(1, 3).join("\n") : ""}
          </pre>
        </div>
      </body>
    </html>
  )
}
