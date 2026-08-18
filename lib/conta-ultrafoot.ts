"use client"

// A CONTA DO JOGADOR, vista pelo jogo.
//
// PARA QUE SERVE. Sem conta, o código do save (ABC123) só existe na cabeça do
// jogador: formatou o computador e não lembra o código, perdeu a carreira. Com
// conta, o código fica catalogado no servidor e a lista aparece pronta ao
// entrar. O save em si continua no cloud-save-server; aqui só circula o
// CATÁLOGO — qual código é de quem.
//
// ## DE ONDE VEM A SESSÃO — são dois caminhos, e é a MESMA conta
//
// 1. **No PC, do launcher.** Quem entra na conta é ele, e deixa a sessão num
//    arquivo compartilhado (`sessao.json`) que o jogo lê pelo Tauri. O jogador
//    não digita nada duas vezes.
// 2. **No celular e na web, daqui mesmo.** Não existe launcher nem arquivo
//    compartilhado, então o jogo entra na conta ele próprio e guarda a sessão no
//    `localStorage`.
//
// ⚠️ ANTES ISTO ERA SÓ O CAMINHO 1, e o efeito passava despercebido: no APK,
// `contaLogada()` devolvia `null` SEMPRE. A tela de abertura já sabia listar os
// saves da conta e mostrar o nome do jogador — código pronto, escrito e
// testado — mas nada disso aparecia no celular, porque nunca havia conta. Não
// faltava funcionalidade: faltava a porta de entrada.
//
// ⚠️ **ENTRAR É OPCIONAL, E TEM DE CONTINUAR SENDO.** Há jogadores ativos que
// nunca fizeram conta. Tudo aqui é best-effort: sem conta, sem rede ou com o
// servidor fora do ar, o jogo abre igual, joga igual e salva igual — o que se
// perde é só o catálogo de saves, que é conveniência. Nenhuma função deste
// arquivo pode lançar exceção para quem está jogando.

const BASE = "https://ultrafoot.179-198-103-30.sslip.io/auth"

/** O mesmo endereço, para quem precisa ler o CORPO do erro que o servidor manda
 *  (`chamarConta` devolve só `null`, e "não foi possível" no lugar de "espere um
 *  instante antes de enviar de novo" faz o jogador achar que quebrou). */
export const SERVIDOR_DA_CONTA = BASE

/** Onde a sessão fica no celular/web. Uma conta por aparelho, como no launcher. */
const CHAVE_SESSAO = "ultrafoot:conta"

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

/** Lê a sessão guardada aqui (celular/web). Nunca lança: sessão ilegível é o
 *  mesmo que sessão nenhuma — e continuar jogando importa mais. */
function sessaoLocal(): ContaLogada | null {
  try {
    const cru = localStorage.getItem(CHAVE_SESSAO)
    if (!cru) return null
    const s = JSON.parse(cru) as ContaLogada
    return s?.token ? s : null
  } catch {
    return null
  }
}

function gravarSessaoLocal(conta: ContaLogada | null): void {
  try {
    if (conta) localStorage.setItem(CHAVE_SESSAO, JSON.stringify(conta))
    else localStorage.removeItem(CHAVE_SESSAO)
  } catch {
    // Armazenamento cheio ou bloqueado: a sessão vale só para esta abertura.
  }
}

/**
 * Conta em que o jogador entrou, ou null.
 *
 * O LAUNCHER TEM PREFERÊNCIA, e não é detalhe: no PC ele é a fonte da verdade —
 * quem sai da conta por lá tem de sair aqui também, e não continuar dentro por
 * causa de uma cópia velha guardada no navegador do jogo.
 */
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
    // Web ou celular: não existe launcher. Segue para a sessão local.
  }
  if (!cache) cache = sessaoLocal()
  return cache
}

/** Esquece o que foi lido — usado quando o servidor recusa o token. */
export function limparCacheDaConta(): void {
  cache = undefined
}

/**
 * ENTRA NA CONTA — a mesma do launcher, do site e da loja.
 *
 * Devolve a conta, ou uma mensagem em português para mostrar na tela. Não lança:
 * uma tela de login que estoura deixa o jogador sem saber se entrou.
 *
 * `dispositivo` vai para o servidor identificar a sessão na lista de aparelhos.
 */
export async function entrarNaConta(email: string, senha: string, dispositivo = "Ultrafoot (celular)"):
  Promise<{ conta: ContaLogada } | { erro: string }> {
  const limpo = email.trim().toLowerCase()
  if (!limpo || !senha) return { erro: "preencha e-mail e senha" }
  try {
    const r = await fetch(`${BASE}/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: limpo, senha, dispositivo }),
    })
    const d = await r.json().catch(() => ({})) as { token?: string; email?: string; nome?: string; erro?: string }
    if (!r.ok || !d.token) {
      // O servidor devolve a MESMA mensagem para e-mail inexistente e senha
      // errada, de propósito — não somos nós que vamos revelar qual é qual.
      return { erro: d.erro || (r.status === 429 ? "muitas tentativas; espere alguns minutos" : "e-mail ou senha inválidos") }
    }
    const conta: ContaLogada = { token: d.token, email: d.email || limpo, nome: d.nome || "" }
    gravarSessaoLocal(conta)
    cache = conta
    return { conta }
  } catch {
    return { erro: "sem conexão com o servidor" }
  }
}

/**
 * SAI DA CONTA. Apaga a sessão daqui ANTES de avisar o servidor: se a rede
 * falhar, o jogador tem de sair mesmo assim — senão "sair" vira um botão que às
 * vezes não sai, que é pior que não ter botão.
 */
export async function sairDaConta(): Promise<void> {
  const antes = cache ?? sessaoLocal()
  gravarSessaoLocal(null)
  cache = null
  if (!antes) return
  try {
    await fetch(`${BASE}/sair`, { method: "POST", headers: { Authorization: `Bearer ${antes.token}` } })
  } catch {
    // A sessão expira sozinha no servidor. Aqui já saiu.
  }
}

/**
 * Chamada autenticada ao servidor de contas. Exportada porque o FC Hub social
 * (`lib/hub-social.ts`) precisa exatamente do mesmo tratamento — inclusive do
 * 401 que APAGA a sessão local. Duas cópias dessa regra é como uma delas fica
 * para trás e o jogo passa a insistir com um token morto.
 */
export async function chamarConta<T>(rota: string, corpo: unknown, metodo = "POST"): Promise<T | null> {
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
      // Token morto (expirou, ou a conta saiu em outro aparelho). No PC o
      // launcher pede login de novo; no celular quem guarda a sessão somos nós,
      // então ela tem de ser APAGADA aqui — senão o jogo tentaria para sempre
      // com um token que o servidor já recusou, e a tela ficaria dizendo que há
      // uma conta que na prática não existe mais.
      gravarSessaoLocal(null)
      cache = null
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
  await chamarConta("/saves/registrar", { codigo, rotulo })
}

/** Saves catalogados nesta conta, do mais recente para o mais antigo. */
export async function listarSavesDaConta(): Promise<SaveDaConta[]> {
  const r = await chamarConta<{ saves: SaveDaConta[] }>("/saves", null, "GET")
  return r?.saves ?? []
}

/** Tira o código da lista da conta. O save continua existindo no servidor. */
export async function esquecerSaveDaConta(codigo: string): Promise<void> {
  await chamarConta("/saves/esquecer", { codigo })
}

// ─── FC Hub: quem está online e o chat ───────────────────────────────────────
//
// A lista de "jogadores online" saía dos amigos do Discord — ou seja, ficava
// vazia para quem não usa Discord. Agora sai da própria conta do Ultrafoot.

export interface JogadorOnline {
  conta_id: number
  nome: string
  clube: string
  situacao: string
  /** O que a pessoa está fazendo agora, já pronto para a tela. */
  detalhe: string
  /** O mesmo em código (partida, mercado, treino…), para escolher ícone. */
  atividade: string
  /** "jogo" ou "launcher" — chamar alguém para jogar vira loteria sem isto. */
  origem: string
  visto_em: number
}

export interface RespostaDePresenca {
  eu: number
  online: JogadorOnline[]
  /** Quem, da lista de online, é amigo desta conta. */
  amigos_online: number[]
  /** Pedidos de amizade esperando resposta. */
  pedidos: number
  /** Mensagens diretas não lidas. */
  nao_lidas: number
}

export interface MensagemDoChat {
  id: number
  conta_id: number
  nome: string
  texto: string
  quando: number
}

/**
 * Avisa que este jogador está online e devolve quem mais está.
 *
 * Não existe "sair": fechar o jogo no tapa nunca avisaria, e a lista encheria de
 * fantasma. Quem para de bater some sozinho depois de 90 segundos.
 */
export async function baterPresenca(dados: {
  nome?: string
  clube?: string
  situacao?: string
  /** Linha pronta para a tela: "Flamengo 2 × 1 Palmeiras · 67'". */
  detalhe?: string
  /** Código da atividade — ver `atividadeDaRota` em `lib/hub-social.ts`. */
  atividade?: string
  /** "jogo" aqui, sempre: o launcher manda "launcher". */
  origem?: string
}): Promise<RespostaDePresenca | null> {
  return chamarConta<RespostaDePresenca>("/hub/presenca", dados)
}

export async function enviarMensagem(texto: string): Promise<string> {
  const conta = await contaLogada()
  if (!conta) return "entre na sua conta para conversar"
  try {
    const r = await fetch(`${BASE}/hub/chat`, {
      method: "POST",
      headers: { Authorization: `Bearer ${conta.token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ texto }),
    })
    if (r.ok) return ""
    const d = await r.json().catch(() => ({})) as { erro?: string }
    return d.erro || "não foi possível enviar"
  } catch {
    return "sem conexão com o servidor"
  }
}

/** Mensagens novas desde a última lida. `desde: 0` traz as mais recentes. */
export async function lerChat(desde: number): Promise<MensagemDoChat[]> {
  const conta = await contaLogada()
  if (!conta) return []
  try {
    const r = await fetch(`${BASE}/hub/chat?desde=${desde}`, {
      headers: { Authorization: `Bearer ${conta.token}` },
    })
    if (!r.ok) return []
    const d = await r.json() as { mensagens: MensagemDoChat[] }
    return d.mensagens ?? []
  } catch {
    return []
  }
}
