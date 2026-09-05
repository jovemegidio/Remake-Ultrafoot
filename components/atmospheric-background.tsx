// FUNDO ATMOSFERICO — a camada de luz ambiente atras do jogo inteiro.
//
// Monta uma vez em `app/layout.tsx` e vale para as 74 telas. As telas nao
// desenham mais o proprio fundo escuro: a raiz delas ficou transparente e quem
// pinta a base agora e esta camada.
//
// ⚠️ SEM `"use client"`, e isso e o ponto.
//
// Este componente nao tem estado, nao tem efeito e nao tem ouvinte — todo o
// movimento vive em `@keyframes` no CSS. Sem a diretiva ele e renderizado no
// servidor/na exportacao estatica e NAO custa um byte de JavaScript no pacote
// do Tauri. Um fundo animado que redesenha em React seria o oposto do pedido:
// ele reflui a tela inteira a cada quadro.
//
// ⚠️ E SEM `filter: blur()`. As manchas sao `radial-gradient`, que ja nasce
// difuso e custa uma passada de pintura; `blur()` rasterizaria a camada inteira
// fora da tela a cada quadro e derrubaria o FPS dentro da WebView — foi a mesma
// conclusao a que o carrossel do menu chegou (ver menu-background.tsx).
//
// O que cada camada faz, e o que sobra quando o perfil economico as remove:
//
//   .uf-atmos          base opaca em gradiente  ← SEMPRE fica (e o fallback)
//   .uf-atmos__luz     manchas de ciano/verde/violeta em deriva lenta
//   .uf-atmos__faixa   faixa de luz inclinada, sugere holofote fora do quadro
//   .uf-atmos__piso    grade em perspectiva, mascarada
//   .uf-atmos__vinheta fecha as quinas
//   .uf-atmos__ruido   granulado que tira o "banding" dos gradientes
//
// Em `html[data-performance-mode]` sobram a base, a vinheta e uma mancha
// parada. Em `prefers-reduced-motion` a deriva para, mas as luzes ficam: a
// preferencia existe contra desconforto vestibular, e mancha imovel nao e isso.
// As duas regras estao em `app/globals.css`, junto do resto do sistema `uf-*`.

export function AtmosphericBackground() {
  return (
    <div className="uf-atmos" aria-hidden="true">
      <div className="uf-atmos__luz uf-atmos__luz--violeta" />
      <div className="uf-atmos__luz uf-atmos__luz--ciano" />
      <div className="uf-atmos__luz uf-atmos__luz--verde" />
      <div className="uf-atmos__faixa" />
      <div className="uf-atmos__piso" />
      <div className="uf-atmos__ruido" />
      <div className="uf-atmos__vinheta" />
    </div>
  )
}
