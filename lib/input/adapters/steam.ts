// STEAM — o que da para fazer com honestidade SEM o Steamworks SDK.
//
// ── A decisao ───────────────────────────────────────────────────────────────
// O jogo NAO depende da Steam: ele e distribuido pelo launcher proprio, e um
// dia pode ir para a Steam ou para outra loja. Amarrar o input ao Steamworks
// (steam_api64.dll, App ID, `SteamInput()`) tornaria o executavel inutilizavel
// fora dela — abrir o .exe direto passaria a exigir a Steam aberta.
//
// Entao este adaptador nao carrega SDK nenhum. Ele faz as tres coisas que dao
// para fazer sem SDK, e que resolvem 90% do que o jogador percebe:
//
// 1. RECONHECER o controle virtual da Steam e tratar como layout Xbox — que e
//    o que o Steam Input entrega. Sem isso ele cairia em "generico".
// 2. Saber que o BOTAO CENTRAL e da Steam, nao nosso (ela abre o overlay/Big
//    Picture com ele), e ensinar o fallback em vez de prometer o Guide.
// 3. Nao brigar. Nada aqui desliga overlay, intercepta atalho da Steam ou
//    tenta "recuperar" o botao. Um jogo que quebra o overlay e um jogo que
//    perde a avaliacao.
//
// ── O que ficaria melhor COM o SDK ──────────────────────────────────────────
// Glifos por ACAO vindos da propria Steam (respeitando remapeamento que o
// jogador fez la), suporte a layouts da comunidade e ao touchpad do Steam Deck
// como origem separada. Nada disso e necessario para jogar; e polimento. A
// arquitetura ja esta pronta para receber: bastaria um adaptador novo que
// alimente o mesmo `QuadroNormalizado`.

import type { ControllerDevice } from "@/lib/controller/devices"

/** Nomes que a camada de Steam Input usa para o controle virtual que apresenta. */
const MARCAS_DA_STEAM = ["steam virtual gamepad", "steam controller", "steam deck", "valve"]

export function pareceSteamInput(device: ControllerDevice): boolean {
  const nome = device.rawName.toLowerCase()
  return device.family === "steam" || MARCAS_DA_STEAM.some(m => nome.includes(m))
}

/**
 * O processo foi aberto pela Steam?
 *
 * No frontend nao ha acesso a variavel de ambiente — quem sabe e o Rust, que ja
 * responde isso dentro de `centerButton.reason`. Aqui ficam apenas as pistas
 * observaveis do lado da janela, usadas quando NAO ha camada nativa (versao web,
 * modo de desenvolvimento).
 */
export function pistaDeSteamNaJanela(): boolean {
  if (typeof navigator === "undefined") return false
  // O cliente Steam abre o Big Picture em tela cheia e injeta o proprio agente
  // em algumas versoes. E uma pista fraca, e e usada como tal: nunca sozinha
  // para declarar `RESERVED_BY_SYSTEM`, so para somar ao que o nativo disse.
  return /steam/i.test(navigator.userAgent)
}

/**
 * Big Picture / Steam Deck comecam em tela cheia e em resolucao de sala.
 * Serve de sinal para o preset de exibicao (ver lib/display/presets.ts) — nunca
 * para decidir mapeamento de botao.
 */
export function pareceModoSala(): boolean {
  if (typeof window === "undefined") return false
  const emTelaCheia = Boolean(document.fullscreenElement) || window.innerHeight === screen.height
  return emTelaCheia && window.innerWidth >= 1600
}
