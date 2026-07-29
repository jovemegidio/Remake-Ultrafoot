"use client"

// A CONTA DO JOGADOR, vista pelo jogo.
//
// O jogo não tem tela de login — quem entra na conta é o launcher. Ele deixa a
// sessão num arquivo compartilhado (`sessao.json`) e o jogo lê daqui.
//
// PARA QUE SERVE. Sem conta, o código do save (ABC123) só existe na cabeça do
// jogador: formatou o computador e não lembra o código, perdeu a carreira. Com
// conta, o código fica catalogado no servidor e a lista aparece pronta ao
// entrar. O save em si continua no cloud-save-server; aqui só circula o
// CATÁLOGO — qual código é de quem.

const BASE = "https://ultrafoot.179-198-103-30.sslip.io/auth"

export interface ContaLogada {
  token: string
  email: string
  nome: string
}

export interface SaveDaConta {
  codigo: string
  rotulo: string
  criado_em: number
  atualizado_em: number
}

let cache: ContaLogada | null | undefined

/** Conta em que o launcher entrou, ou null. Lê o arquivo uma vez por sessão. */
export async function contaLogada(): Promise<ContaLogada | null> {
  if (cache !== undefined) return cache
  cache = null
  try {
    const { invoke } = await import("@tauri-apps/api/core")
    const cru = await invoke<string | null>("ler_sessao_do_launcher")
    if (cru) {
      const s = JSON.parse(cru) as ContaLogada
      if (s?.token) cache = s
    }
  } catch {
    // Web, ou launcher desatualizado: segue sem conta, tudo funciona por código.
  }
  return cache
}

/** Esquece o que foi lido — usado quando o servidor recusa o token. */
export function limparCacheDaConta(): void {
  cache = undefined
}

async function chamar<T>(rota: string, corpo: unknown, metodo = "POST"): Promise<T | null> {
  const conta = await contaLogada()
  if (!conta) return null
  try {
    const r = await fetch(`${BASE}${rota}`, {
      method: metodo,
      headers: {
        Authorization: `Bearer ${conta.token}`,
        ...(metodo === "POST" ? { "Content-Type": "application/json" } : {}),
      },
      ...(metodo === "POST" ? { body: JSON.stringify(corpo) } : {}),
    })
    if (r.status === 401 || r.status === 403) {
      // O launcher vai pedir login de novo; aqui só paramos de tentar.
      limparCacheDaConta()
      return null
    }
    if (!r.ok) return null
    return await r.json() as T
  } catch {
    return null
  }
}

/**
 * Anota o código do save na conta. Best-effort de propósito: o upload do save
 * já aconteceu e deu certo — falhar aqui não pode transformar um save salvo em
 * erro na cara do jogador.
 */
export async function catalogarSave(codigo: string, rotulo = ""): Promise<void> {
  await chamar("/saves/registrar", { codigo, rotulo })
}

/** Saves catalogados nesta conta, do mais recente para o mais antigo. */
export async function listarSavesDaConta(): Promise<SaveDaConta[]> {
  const r = await chamar<{ saves: SaveDaConta[] }>("/saves", null, "GET")
  return r?.saves ?? []
}

/** Tira o código da lista da conta. O save continua existindo no servidor. */
export async function esquecerSaveDaConta(codigo: string): Promise<void> {
  await chamar("/saves/esquecer", { codigo })
}
