/**
 * Ponte com o servidor de contas (services/auth-server/server.py).
 *
 * O painel e uma pagina ESTATICA: nao existe segredo aqui e nenhuma decisao de
 * permissao acontece neste arquivo. Quem autoriza e o servidor, olhando a coluna
 * `admin` da conta em cada rota /admin/*. Esconder um botao nunca foi controle
 * de acesso — as telas abaixo so decidem o que mostrar.
 */

// Em producao o mesmo nginx serve /painel/ e faz proxy de /auth: caminho
// relativo evita cravar o IP da VPS aqui e quebrar de novo quando ela mudar.
// Em `next dev` da para apontar para outro servidor com NEXT_PUBLIC_AUTH_BASE.
export const BASE = process.env.NEXT_PUBLIC_AUTH_BASE || '/auth'

const CHAVE_TOKEN = 'ultrafoot-painel:token'

// sessionStorage, nunca localStorage: este painel costuma ser aberto em maquina
// compartilhada e o token deve morrer junto com a aba.
export function pegarToken(): string {
  if (typeof window === 'undefined') return ''
  return window.sessionStorage.getItem(CHAVE_TOKEN) || ''
}

function guardarToken(token: string) {
  window.sessionStorage.setItem(CHAVE_TOKEN, token)
}

function esquecerToken() {
  window.sessionStorage.removeItem(CHAVE_TOKEN)
}

export class ErroDeSessao extends Error {}

async function ler(resposta: Response) {
  return (await resposta.json().catch(() => ({}))) as Record<string, unknown>
}

export async function chamar<T>(rota: string, corpo: Record<string, unknown> = {}): Promise<T> {
  let resposta: Response
  try {
    resposta = await fetch(BASE + rota, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + pegarToken() },
      body: JSON.stringify(corpo),
    })
  } catch {
    throw new Error('sem resposta do servidor — verifique a conexão')
  }
  const dado = await ler(resposta)
  if (!resposta.ok) {
    // 401 em rota comum e sessao vencida; 404 em /admin/* e "voce nao e admin"
    // (o servidor esconde a area de proposito). Os dois pedem voltar ao login.
    if (resposta.status === 401) throw new ErroDeSessao('sua sessão expirou — entre de novo')
    if (resposta.status === 404 && rota.startsWith('/admin/')) {
      throw new ErroDeSessao('esta conta não tem permissão de administrador')
    }
    throw new Error((dado.erro as string) || 'falha na requisição')
  }
  return dado as T
}

export async function pegar<T>(rota: string): Promise<T> {
  let resposta: Response
  try {
    resposta = await fetch(BASE + rota, {
      headers: { Authorization: 'Bearer ' + pegarToken() },
    })
  } catch {
    throw new Error('sem resposta do servidor — verifique a conexão')
  }
  const dado = await ler(resposta)
  if (!resposta.ok) {
    if (resposta.status === 401) throw new ErroDeSessao('sua sessão expirou — entre de novo')
    throw new Error((dado.erro as string) || 'falha na requisição')
  }
  return dado as T
}

export type Eu = {
  id: number
  email: string
  nome: string
  admin: boolean
  ativado: boolean
}

/**
 * Entra e CONFIRMA que a conta e administradora antes de abrir o painel.
 *
 * Sem a segunda checagem a pessoa entraria, veria o painel montado e so
 * descobriria a falta de permissao no primeiro erro de carregamento — que era
 * exatamente o que acontecia antes.
 */
export async function entrar(email: string, senha: string): Promise<Eu> {
  const resposta = await fetch(BASE + '/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: email.trim(), senha, dispositivo: 'painel-admin' }),
  }).catch(() => null)
  if (!resposta) throw new Error('sem resposta do servidor — verifique a conexão')
  const dado = await ler(resposta)
  if (!resposta.ok) throw new Error((dado.erro as string) || 'não foi possível entrar')

  guardarToken(dado.token as string)
  const eu = await confirmarSessao()
  if (!eu) {
    esquecerToken()
    throw new Error('esta conta não tem permissão de administrador')
  }
  return eu
}

/** Devolve a conta se a sessao guardada ainda vale E for de admin; senao null. */
export async function confirmarSessao(): Promise<Eu | null> {
  if (!pegarToken()) return null
  try {
    const eu = await pegar<Eu>('/me')
    return eu.admin ? eu : null
  } catch {
    return null
  }
}

export async function sair() {
  // Apaga primeiro: se a rede falhar, a aba nao pode continuar com o token.
  const token = pegarToken()
  esquecerToken()
  if (!token) return
  await fetch(BASE + '/sair', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
    body: '{}',
  }).catch(() => {})
}

// ─── Formatos devolvidos pelo servidor ───────────────────────────────────────

export type Conta = {
  id: number
  email: string
  nome: string
  telefone: string
  criada_em: number
  ultimo_login: number | null
  bloqueada: number
  motivo_bloqueio: string
  bloqueada_em: number | null
  admin: number
  ativado: number
  licenca_serie: number | null
  via_google: number
  compras: number
  gasto_cents: number
  saldo_cents: number
  saves: number
  visto_em: number | null
  sessoes: number
}

export type RespostaContas = { contas: Conta[]; total: number; presenca_janela: number }

export type DiaDaSerie = { inicio: number; contas: number; entradas: number; receita_cents: number }

export type Acao = {
  id: number
  acao: string
  motivo: string
  quando: number
  admin_email: string
  alvo_email: string
  alvo_nome: string
  alvo_id: number
}

export type Resumo = {
  agora: number
  contas_total: number
  contas_hoje: number
  contas_ontem: number
  contas_7d: number
  ativadas: number
  bloqueadas: number
  admins: number
  via_google: number
  online_agora: number
  sessoes_ativas: number
  entradas_hoje: number
  entradas_ontem: number
  receita_total_cents: number
  receita_hoje_cents: number
  receita_ontem_cents: number
  receita_30d_cents: number
  compras_total: number
  pedidos_pendentes: number
  saves_total: number
  chat_24h: number
  serie: DiaDaSerie[]
  atividade: Acao[]
  servidor: {
    iniciado_em: number
    banco_bytes: number
    pagamento_ligado: boolean
    google_ligado: boolean
    licenca_ligada: boolean
    python: string
  }
}

export type Compra = {
  id: number
  produto: string
  valor_cents: number
  moeda: string
  criada_em: number
  estorno_de: number | null
  conta_id: number
  email: string
  nome: string
}

export type Pedido = {
  id: number
  produto: string
  valor_cents: number
  /** Vazio nos pedidos anteriores à versão que passou a guardar isto. */
  forma: string
  status: string
  criado_em: number
  entregue_em: number | null
  conta_id: number
  email: string
  nome: string
}

export type Recibo = {
  id: number
  numero: string
  ano: number
  sequencia: number
  conta_id: number | null
  /** Preenchido quando o próprio comprador pediu o recibo pelo launcher. */
  pedido_id: number | null
  nome: string
  email: string
  valor_cents: number
  forma: string
  chave: string
  item: string
  pago_em: number
  emitido_por: number
  emitido_por_email: string | null
  emitido_em: number
}

export type Recibos = {
  recibos: Recibo[]
  formas: { id: string; nome: string }[]
  catalogo: { id: string; nome: string; preco_cents: number; descricao: string }[]
}

/** O que /admin/recibo/emitir devolve: o número já reservado no banco. */
export type ReciboEmitido = {
  numero: string
  nome: string
  email: string
  valor_cents: number
  forma: string
  forma_nome: string
  chave: string
  item: string
  pago_em: number
  conta_id: number | null
  pedido_id: number | null
}

export type Credito = {
  id: number
  valor_cents: number
  origem: string
  quando: number
  conta_id: number
  email: string
  nome: string
}

export type Economia = {
  compras: Compra[]
  pedidos: Pedido[]
  creditos: Credito[]
  por_produto: { produto: string; quantidade: number; total_cents: number }[]
  catalogo: { id: string; nome: string; preco_cents: number; descricao: string }[]
  resumo: {
    receita_total_cents: number
    receita_30d_cents: number
    estornos: number
    estornos_cents: number
    creditado_cents: number
    saldo_em_carteiras_cents: number
    pedidos_pendentes: number
    pagamento_ligado: boolean
  }
}

export type Online = {
  conta_id: number
  nome: string
  clube: string
  situacao: string
  visto_em: number
  email: string
  bloqueada: number
}

export type Mensagem = {
  id: number
  conta_id: number
  nome: string
  texto: string
  quando: number
  email: string
  bloqueada: number
}

export type Hub = { online: Online[]; chat: Mensagem[]; janela: number; guardadas: number }

export type MembroDaEquipe = {
  id: number
  email: string
  nome: string
  criada_em: number
  ultimo_login: number | null
  acoes: number
  ultima_acao: number | null
}

export type FichaDaConta = {
  conta: {
    id: number
    email: string
    nome: string
    telefone: string
    criada_em: number
    ultimo_login: number | null
    bloqueada: boolean
    motivo_bloqueio: string
    bloqueada_em: number | null
    admin: boolean
    ativado: boolean
    via_google: boolean
    codigo_ativacao: string
    saldo_cents: number
  }
  compras: { id: number; produto: string; valor_cents: number; moeda: string; criada_em: number; estorno_de: number | null }[]
  creditos: { id: number; valor_cents: number; origem: string; quando: number }[]
  pedidos: { id: number; produto: string; valor_cents: number; status: string; criado_em: number; entregue_em: number | null }[]
  saves: { codigo: string; rotulo: string; criado_em: number; atualizado_em: number }[]
  sessoes: { dispositivo: string; criada_em: number; expira_em: number }[]
  historico: { acao: string; motivo: string; quando: number; admin_email: string }[]
  presenca: { nome: string; clube: string; situacao: string; visto_em: number } | null
  janela_presenca: number
}
