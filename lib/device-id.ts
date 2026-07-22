// IDENTIDADE DA MÁQUINA — usada para vincular o registro ao aparelho.
//
// Gerado uma vez e guardado no persistent-store (arquivo em appdata, que
// sobrevive a atualizações do jogo). Não é um número de série de hardware — é um
// identificador aleatório por instalação.
//
// ⚠️ LIMITE HONESTO: sem servidor, isto vincula o código a ESTA instalação, não
// à máquina física de forma inviolável. Reinstalar limpando o appdata gera um id
// novo. O que ele entrega: impedir que o mesmo aparelho registre vários códigos
// diferentes (troca-troca local) e, quando houver servidor, detectar o mesmo
// código aparecendo em aparelhos diferentes. A trava "um código = uma máquina no
// mundo" exige o backend — ver lib/license.ts.

import { storeGet, storeSet } from "@/lib/persistent-store"

const CHAVE = "ultrafoot:device-id"

/** Id estável desta instalação. Cria na primeira chamada e reusa depois. */
export function getDeviceId(): string {
  const existente = storeGet(CHAVE)
  if (existente) return existente

  const novo = gerarId()
  storeSet(CHAVE, novo)
  return novo
}

function gerarId(): string {
  try {
    // crypto.randomUUID existe no WebView2 e no Android/iOS webview atuais.
    if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID()
  } catch { /* cai no fallback */ }
  // Fallback determinístico-o-suficiente para ambientes sem crypto.
  return `dev-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`
}
