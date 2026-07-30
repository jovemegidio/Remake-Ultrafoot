"use client"

// AVISOS E CONFIRMAÇÕES DENTRO DO JOGO.
//
// Várias telas ainda chamavam `window.alert` / `window.confirm`. No navegador
// aquilo é feio; no Tauri é pior: abre uma CAIXA DO WINDOWS, com a barra de
// título "Ultrafoot 26", ícone azul do sistema e um botão "OK" cinza — nada a
// ver com o jogo, e ainda por cima travando a WebView inteira. Era o print que
// o usuário mandou: "A janela de transferências está FECHADA" numa janelinha
// do Windows no meio de uma partida.
//
// Aqui a mesma chamada vira um modal do jogo. A API continua imperativa (é o que
// permite trocar `if (!confirm(...)) return` por `if (!await confirmar(...)) return`
// sem reescrever a tela inteira), mas quem desenha é React — ver
// components/dialogo-do-jogo.tsx, montado uma única vez no layout.

export type TomDoDialogo = "info" | "alerta" | "perigo" | "sucesso"

export interface PedidoDeDialogo {
  id: number
  titulo: string
  mensagem: string
  tom: TomDoDialogo
  /** Rótulo do botão principal. */
  confirmar: string
  /** Presente = é uma CONFIRMAÇÃO (dois botões). Ausente = é um aviso. */
  cancelar?: string
  /** Presente = o diálogo pede um TEXTO (substitui o window.prompt). */
  campo?: { placeholder?: string; valorInicial?: string }
  resolver: (resposta: boolean | string | null) => void
}

type Ouvinte = () => void

let fila: PedidoDeDialogo[] = []
let proximoId = 1
const ouvintes = new Set<Ouvinte>()

function avisarOuvintes() {
  for (const o of ouvintes) o()
}

/** Assinatura para o componente (useSyncExternalStore). */
export function assinarDialogos(ouvinte: Ouvinte): () => void {
  ouvintes.add(ouvinte)
  return () => { ouvintes.delete(ouvinte) }
}

/** O diálogo que está na tela agora (null = nenhum). */
export function dialogoAtual(): PedidoDeDialogo | null {
  return fila[0] ?? null
}

/** Sempre null no servidor: no SSR não há diálogo aberto. */
export function dialogoAtualNoServidor(): PedidoDeDialogo | null {
  return null
}

/** Fecha o diálogo do topo devolvendo a resposta a quem esperava. */
export function responderDialogo(resposta: boolean | string | null): void {
  const atual = fila[0]
  if (!atual) return
  fila = fila.slice(1)
  avisarOuvintes()
  atual.resolver(resposta)
}

function enfileirar<T>(
  pedido: Omit<PedidoDeDialogo, "id" | "resolver">,
  respostaSemJanela: T,
): Promise<T> {
  // Fora do navegador (SSR, script de QA) não há onde desenhar: não trava o
  // fluxo — devolve a resposta neutra e o código segue como seguiria sem diálogo.
  if (typeof window === "undefined") return Promise.resolve(respostaSemJanela)
  return new Promise<T>(resolver => {
    fila = [...fila, { ...pedido, id: proximoId++, resolver: resolver as PedidoDeDialogo["resolver"] }]
    avisarOuvintes()
  })
}

/** Aviso de uma via — o substituto do `window.alert`. */
export function avisar(opts: {
  titulo: string
  mensagem: string
  tom?: TomDoDialogo
  confirmar?: string
}): Promise<boolean> {
  return enfileirar<boolean>({
    titulo: opts.titulo,
    mensagem: opts.mensagem,
    tom: opts.tom ?? "info",
    confirmar: opts.confirmar ?? "Entendi",
  }, true)
}

/** Confirmação de duas vias — o substituto do `window.confirm`. */
export function confirmar(opts: {
  titulo: string
  mensagem: string
  tom?: TomDoDialogo
  confirmar?: string
  cancelar?: string
}): Promise<boolean> {
  return enfileirar<boolean>({
    titulo: opts.titulo,
    mensagem: opts.mensagem,
    tom: opts.tom ?? "alerta",
    confirmar: opts.confirmar ?? "Confirmar",
    cancelar: opts.cancelar ?? "Cancelar",
  }, false)
}

/**
 * Pergunta um TEXTO — o substituto do `window.prompt`.
 * @returns o texto digitado, ou `null` se o jogador cancelou.
 */
export function pedirTexto(opts: {
  titulo: string
  mensagem: string
  placeholder?: string
  valorInicial?: string
  confirmar?: string
  cancelar?: string
}): Promise<string | null> {
  return enfileirar<string | null>({
    titulo: opts.titulo,
    mensagem: opts.mensagem,
    tom: "info",
    confirmar: opts.confirmar ?? "Confirmar",
    cancelar: opts.cancelar ?? "Cancelar",
    campo: { placeholder: opts.placeholder, valorInicial: opts.valorInicial },
  }, null)
}
