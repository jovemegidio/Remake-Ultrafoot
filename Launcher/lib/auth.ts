"use client"

// Cliente de contas do launcher: cadastro, login por senha e login com Google.
//
// ⚠️ NESTA FASE O LOGIN E OPCIONAL. Ha jogadores ativos e com REGISTRO por codigo
// serial; exigir conta de uma vez faria o jogo parar de abrir para quem ja pagou.
// O launcher mostra a area de conta, mas nunca bloqueia o botao Jogar.
//
// O registro antigo NAO SE PERDE: `codigoRegistroLocal()` le o codigo que ja
// esta na maquina e o envia no cadastro/login. O servidor vincula esse codigo a
// conta (tabela `licencas_migradas`) e impede que outra pessoa o reaproveite.

import { invoke } from "@tauri-apps/api/core"

const BASE = "https://ultrafoot.179-198-103-30.sslip.io/auth"
const SESSAO_KEY = "ultrafoot-launcher:sessao"

export interface Sessao {
  token: string
  email: string
  nome: string
  /** true = versao completa liberada por codigo de ativacao. */
  ativado?: boolean
  /** Chave de ativacao da conta, repassada ao jogo (ver `entregarAtivacaoAoJogo`). */
  codigoAtivacao?: string
}

export function sessaoSalva(): Sessao | null {
  if (typeof window === "undefined") return null
  try {
    const cru = localStorage.getItem(SESSAO_KEY)
    if (!cru) return null
    const s = JSON.parse(cru) as Sessao
    return s?.token ? s : null
  } catch {
    return null
  }
}

function guardarSessao(s: Sessao | null): void {
  if (typeof window === "undefined") return
  if (s) localStorage.setItem(SESSAO_KEY, JSON.stringify(s))
  else localStorage.removeItem(SESSAO_KEY)
}

/**
 * Codigo de registro que ja existe nesta maquina, se houver.
 *
 * O jogo grava o registro em `ultrafoot:registro-serie`. Lemos e mandamos junto
 * para o servidor migrar — e por isso que quem ja pagou nao perde nada ao criar
 * a conta. Se nao houver registro, segue vazio e o cadastro e normal.
 */
function codigoRegistroLocal(): string {
  if (typeof window === "undefined") return ""
  for (const chave of ["ultrafoot:registro-serie", "ultrafoot:registro-dev", "ultrafoot:registered"]) {
    const v = localStorage.getItem(chave)
    if (!v) continue
    try {
      const j = JSON.parse(v)
      const c = j?.codigo ?? j?.serie ?? j?.code
      if (typeof c === "string" && c.trim()) return c.trim()
    } catch {
      if (v.trim()) return v.trim()
    }
  }
  return ""
}

async function chamar<T>(rota: string, corpo: unknown, token?: string): Promise<T> {
  const r = await fetch(`${BASE}${rota}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(corpo),
  })
  const dado = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error((dado as { erro?: string }).erro || "nao foi possivel concluir")
  return dado as T
}

/**
 * Resposta crua do servidor -> Sessao. O servidor fala snake_case; converter
 * aqui evita espalhar `codigo_ativacao` pela interface toda.
 */
interface RespostaSessao {
  token: string; email: string; nome: string
  ativado?: boolean; codigo_ativacao?: string
}

async function concluir(r: RespostaSessao): Promise<Sessao> {
  const s: Sessao = {
    token: r.token, email: r.email, nome: r.nome,
    ativado: !!r.ativado, codigoAtivacao: r.codigo_ativacao || "",
  }
  guardarSessao(s)
  await entregarAtivacaoAoJogo(s)
  await compartilharSessaoComOJogo(s)
  return s
}

/**
 * Passa a sessao para o jogo, que nao tem tela de login propria.
 *
 * Com ela o jogo consegue catalogar os saves na conta — e e assim que a pessoa
 * recupera as carreiras depois de formatar o computador.
 */
async function compartilharSessaoComOJogo(s: Sessao | null): Promise<void> {
  try {
    await invoke("salvar_sessao", {
      token: s?.token ?? "", email: s?.email ?? "", nome: s?.nome ?? "",
    })
  } catch {
    // Fora do Tauri nao ha o que compartilhar; o launcher segue funcionando.
  }
}

export async function cadastrar(
  email: string, senha: string, nome: string,
  telefone = "", codigoAtivacao = "",
): Promise<Sessao> {
  return concluir(await chamar<RespostaSessao>("/registrar", {
    email, senha, nome, telefone,
    codigo_ativacao: codigoAtivacao,
    dispositivo: navigator.userAgent.slice(0, 100),
    codigo_registro: codigoRegistroLocal(),
  }))
}

export async function entrar(email: string, senha: string): Promise<Sessao> {
  return concluir(await chamar<RespostaSessao>("/login", {
    email, senha,
    dispositivo: navigator.userAgent.slice(0, 100),
    codigo_registro: codigoRegistroLocal(),
  }))
}

/** Ativa a versao completa depois, para quem criou a conta sem a chave. */
export async function ativar(codigoAtivacao: string): Promise<Sessao> {
  const atual = sessaoSalva()
  if (!atual) throw new Error("entre na sua conta primeiro")
  const r = await chamar<{ codigo_ativacao?: string }>(
    "/ativar", { codigo_ativacao: codigoAtivacao }, atual.token)
  const s: Sessao = { ...atual, ativado: true, codigoAtivacao: r.codigo_ativacao || codigoAtivacao }
  guardarSessao(s)
  await entregarAtivacaoAoJogo(s)
  return s
}

/**
 * Deposita a chave num arquivo que o JOGO le ao abrir.
 *
 * E o que cumpre "ativou uma vez, nao pede registro de novo": o launcher so
 * entrega a chave; quem valida e o proprio jogo, com o segredo dele. Assim o
 * launcher nao vira uma porta para registrar o jogo sem chave legitima.
 */
async function entregarAtivacaoAoJogo(s: Sessao): Promise<void> {
  if (!s.ativado || !s.codigoAtivacao) return
  try {
    await invoke("salvar_ativacao", { codigo: s.codigoAtivacao, email: s.email })
  } catch {
    // Sem Tauri (ou sem permissao) o login continua valendo — a pessoa so
    // digita a chave uma vez no jogo, como antes.
  }
}

/**
 * Confere se a sessao guardada ainda vale e atualiza os dados dela.
 *
 * "Entrou uma vez, continua entrado": o servidor empurra o prazo a cada uso, e
 * aqui a gente so descarta a sessao quando ele diz que ela morreu (401). Falha
 * de REDE nao desloga — quem esta sem internet continua vendo a propria conta.
 */
export async function revalidar(): Promise<Sessao | null> {
  const atual = sessaoSalva()
  if (!atual) return null
  try {
    const r = await fetch(`${BASE}/me`, { headers: { Authorization: `Bearer ${atual.token}` } })
    if (r.status === 401 || r.status === 403) {
      guardarSessao(null)
      await compartilharSessaoComOJogo(null)
      return null
    }
    if (!r.ok) return atual
    const d = await r.json() as { nome?: string; email?: string; ativado?: boolean; codigo_ativacao?: string }
    const s: Sessao = {
      ...atual,
      nome: d.nome ?? atual.nome,
      email: d.email ?? atual.email,
      ativado: !!d.ativado,
      codigoAtivacao: d.codigo_ativacao || atual.codigoAtivacao || "",
    }
    guardarSessao(s)
    await entregarAtivacaoAoJogo(s)
    await compartilharSessaoComOJogo(s)
    return s
  } catch {
    return atual  // offline: mantem a sessao
  }
}

export async function sair(): Promise<void> {
  const s = sessaoSalva()
  guardarSessao(null)
  // Apaga a sessao compartilhada ANTES da chamada de rede: se o servidor estiver
  // fora do ar, o token nao pode continuar no disco valendo para o jogo.
  await compartilharSessaoComOJogo(null)
  if (s) await chamar("/sair", {}, s.token).catch(() => undefined)
}

// ─── Google (PKCE) ────────────────────────────────────────────────────────────
//
// App DESKTOP nao pode embutir client_secret — qualquer um extrai do binario.
// O padrao correto e PKCE: geramos um `verifier` aleatorio, mandamos o Google
// so o SHA-256 dele (`challenge`), e no fim provamos a posse enviando o
// verifier. Sem isso, um codigo interceptado seria trocavel por token.

const GOOGLE_CLIENT_ID = "381589978146-tkrlbf40498vvihdlmjh13tcsttu8shc.apps.googleusercontent.com"

function base64url(buf: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buf)))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
}

export async function gerarPkce(): Promise<{ verifier: string; challenge: string }> {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  const verifier = base64url(bytes.buffer)
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier))
  return { verifier, challenge: base64url(digest) }
}

export function urlDoGoogle(challenge: string, redirectUri: string): string {
  const p = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "openid email profile",
    code_challenge: challenge,
    code_challenge_method: "S256",
    access_type: "offline",
    prompt: "select_account",
  })
  return `https://accounts.google.com/o/oauth2/v2/auth?${p}`
}

/** Troca o `code` por sessao. Quem fala com o Google e o SERVIDOR, nao o launcher. */
export async function entrarComGoogle(code: string, verifier: string, redirectUri: string): Promise<Sessao> {
  return concluir(await chamar<RespostaSessao>("/google", {
    code, code_verifier: verifier, redirect_uri: redirectUri,
    dispositivo: navigator.userAgent.slice(0, 100),
    codigo_registro: codigoRegistroLocal(),
  }))
}
