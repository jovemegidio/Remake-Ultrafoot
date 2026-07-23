// REGISTRO PERSISTENTE — sobrevive a atualizacoes do jogo.
//
// O registro ficava so no localStorage do WebView. Numa atualizacao o WebView2
// pode limpar o localStorage e o jogador REGISTRADO voltava a "nao registrado"
// (o "nao pode acontecer" relatado). Os saves nunca sofreram isso porque usam o
// persistent-store (arquivo em appdata, que sobrevive a reinstalacoes). Agora o
// registro usa o MESMO armazenamento durável, com o localStorage so como espelho
// para o primeiro render sincrono.

import { storeGet, storeSet } from "@/lib/persistent-store"
import { safeLocalGet, safeLocalSet } from "@/lib/safe-storage"

const K_REG = "ultrafoot:registered"
const K_SERIE = "ultrafoot:registro-serie"
const K_DEVICE = "ultrafoot:registro-device"
const K_DEV = "ultrafoot:registro-dev"

export interface RegistroSalvo {
  registrado: boolean
  serie?: string
  device?: string
  dev?: boolean
}

/** Le de onde for mais confiavel: primeiro o arquivo durável, depois o espelho. */
export function lerRegistro(): RegistroSalvo {
  const reg = storeGet(K_REG) ?? safeLocalGet(K_REG)
  const serie = storeGet(K_SERIE) ?? safeLocalGet(K_SERIE) ?? undefined
  const device = storeGet(K_DEVICE) ?? safeLocalGet(K_DEVICE) ?? undefined
  const dev = (storeGet(K_DEV) ?? safeLocalGet(K_DEV)) === "1"

  // MIGRACAO: registro antigo que so existe no localStorage e copiado para o
  // arquivo durável, para nao se perder na PROXIMA atualizacao.
  if (reg === "1" && storeGet(K_REG) == null) {
    gravarRegistro({ registrado: true, serie: serie ?? undefined, device: device ?? undefined, dev })
  }

  return { registrado: reg === "1", serie: serie ?? undefined, device: device ?? undefined, dev }
}

/** Grava nos DOIS: arquivo durável (fonte de verdade) + localStorage (espelho). */
export function gravarRegistro(r: RegistroSalvo): void {
  const escrever = (k: string, v: string) => { storeSet(k, v); safeLocalSet(k, v) }
  escrever(K_REG, r.registrado ? "1" : "0")
  if (r.serie !== undefined) escrever(K_SERIE, r.serie)
  if (r.device !== undefined) escrever(K_DEVICE, r.device)
  escrever(K_DEV, r.dev ? "1" : "0")
}
