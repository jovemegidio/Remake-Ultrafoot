"use client"

// FC HUB SOCIAL — amigos, conversa privada e mural de atividade.
//
// ## O QUE ISTO RESOLVE
//
// O FC Hub já tinha duas coisas: quem está online (presença) e o chat do saguão.
// Faltava o que transforma isso em vida social — saber quem é *seu* amigo,
// falar em particular com ele e ver o que ele andou fazendo enquanto você não
// estava. A lista de amigos que existia era a do **Discord**, e por isso vivia
// vazia: a maioria dos jogadores não usa Discord.
//
// Agora a identidade é a CONTA DO ULTRAFOOT — a mesma do launcher, da loja e do
// save na nuvem. Quem tem conta encontra quem tem conta.
//
// ## AS DUAS COISAS SÃO DIFERENTES, E ISSO É DE PROPÓSITO
//
//   • **Presença** responde "quem está jogando AGORA" e some sozinha em 90s.
//   • **Mural** responde "o que aconteceu" e SOBREVIVE ao jogador desligar o
//     PC. Título ganho e contratação é o que a pessoa quer ver quando abre o
//     jogo depois de dois dias — presença nunca conseguiria mostrar isso.
//
// ## NADA AQUI PODE DERRUBAR O JOGO
//
// Mesmo contrato de `lib/conta-ultrafoot.ts`: tudo é best-effort. Sem conta, sem
// rede ou com o servidor fora do ar, as funções devolvem lista vazia ou `false`
// — nunca lançam. Há jogadores que nunca fizeram conta, e para eles o jogo abre,
// joga e salva igual.

import { SERVIDOR_DA_CONTA, chamarConta, contaLogada } from "@/lib/conta-ultrafoot"

export interface AmigoDoHub {
  conta_id: number
  nome: string
  online: boolean
  clube: string
  situacao: string
  /** Linha pronta para a tela ("No mercado de transferências"). */
  detalhe: string
  /** Código da atividade — ver `atividadeDaRota`. */
  atividade: string
  /** "jogo" ou "launcher". */
  origem: string
  visto_em: number
  nao_lidas: number
  /** Prévia da última mensagem trocada, para a lista de conversas. */
  ultima: string
  ultima_em: number
}

export interface PedidoDeAmizade {
  conta_id: number
  nome: string
  quando: number
}

export interface PessoaEncontrada {
  conta_id: number
  nome: string
  /** nenhuma | enviado | recebido | amigo — decide qual botão mostrar. */
  relacao: "nenhuma" | "enviado" | "recebido" | "amigo"
}

export interface MensagemDireta {
  id: number
  de_id: number
  para_id: number
  texto: string
  quando: number
  lida_em: number | null
}

export interface EventoDoMural {
  id: number
  conta_id: number
  nome: string
  tipo: string
  texto: string
  clube: string
  quando: number
}

export interface PainelDeAmigos {
  eu: number
  amigos: AmigoDoHub[]
  recebidos: PedidoDeAmizade[]
  enviados: PedidoDeAmizade[]
  bloqueados: { conta_id: number; nome: string }[]
}

export const PAINEL_VAZIO: PainelDeAmigos = {
  eu: 0, amigos: [], recebidos: [], enviados: [], bloqueados: [],
}

/**
 * POST que devolve "" no sucesso e o MOTIVO no erro.
 *
 * `chamarConta` devolve `null` para qualquer falha, e é o suficiente para quase
 * tudo. Aqui não: "espere um instante antes de enviar de novo" e "sua lista de
 * amigos está cheia" são coisas que o jogador precisa ler — trocá-las por um
 * "não foi possível" genérico faz parecer que o recurso quebrou.
 */
async function postarComMotivo(rota: string, corpo: unknown, padrao: string): Promise<string> {
  const conta = await contaLogada()
  if (!conta) return "entre na sua conta para usar o FC Hub"
  try {
    const r = await fetch(`${SERVIDOR_DA_CONTA}${rota}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${conta.token}`, "Content-Type": "application/json" },
      body: JSON.stringify(corpo),
    })
    if (r.ok) return ""
    const d = await r.json().catch(() => ({})) as { erro?: string }
    return d.erro || padrao
  } catch {
    return "sem conexão com o servidor"
  }
}

/**
 * Amigos, pedidos e bloqueios numa chamada só.
 *
 * O servidor devolve os três juntos de propósito: a tela precisa dos três ao
 * mesmo tempo, e três sondagens separadas triplicariam o tráfego para mostrar a
 * mesma coisa.
 */
export async function listarAmigos(): Promise<PainelDeAmigos> {
  const r = await chamarConta<PainelDeAmigos>("/hub/amigos", null, "GET")
  return r ?? PAINEL_VAZIO
}

/** Procura alguém para adicionar. E-mail só casa EXATO (o servidor decide). */
export async function buscarPessoas(termo: string): Promise<PessoaEncontrada[]> {
  const limpo = termo.trim()
  if (limpo.length < 3) return []
  const r = await chamarConta<{ pessoas: PessoaEncontrada[] }>(
    `/hub/buscar?q=${encodeURIComponent(limpo)}`, null, "GET")
  return r?.pessoas ?? []
}

/**
 * Manda pedido de amizade. Devolve "" quando deu certo, ou o motivo.
 *
 * Aceita id de conta ou e-mail: na lista de online só temos o id, e quem digita
 * o e-mail de um amigo não faz ideia de qual é o id dele.
 */
export async function pedirAmizade(alvo: { conta_id?: number; email?: string }): Promise<string> {
  return postarComMotivo("/hub/amigos/pedir", alvo, "não foi possível enviar o pedido")
}

export async function responderPedido(conta_id: number, aceitar: boolean): Promise<boolean> {
  const r = await chamarConta<{ ok?: boolean }>("/hub/amigos/responder", { conta_id, aceitar })
  return !!r?.ok
}

export async function removerAmigo(conta_id: number): Promise<boolean> {
  const r = await chamarConta<{ ok?: boolean }>("/hub/amigos/remover", { conta_id })
  return !!r?.ok
}

/** Bloquear também DESFAZ a amizade (regra do servidor). */
export async function bloquearPessoa(conta_id: number, bloquear = true): Promise<boolean> {
  const r = await chamarConta<{ ok?: boolean }>("/hub/bloquear", { conta_id, bloquear })
  return !!r?.ok
}

/**
 * Conversa privada com um amigo, a partir da mensagem `desde`.
 *
 * ⚠️ LER MARCA COMO LIDA no servidor. Só chame quando a conversa estiver
 * realmente aberta na tela — sondar em segundo plano zeraria o "não lidas" de
 * quem nunca olhou.
 */
export async function lerConversa(com: number, desde = 0): Promise<MensagemDireta[]> {
  const r = await chamarConta<{ mensagens: MensagemDireta[] }>(
    `/hub/dm?com=${com}&desde=${desde}`, null, "GET")
  return r?.mensagens ?? []
}

/** Devolve "" quando deu certo, ou a mensagem de erro para mostrar na tela. */
export async function enviarDireta(para: number, texto: string): Promise<string> {
  return postarComMotivo("/hub/dm", { para, texto }, "não foi possível enviar")
}

/** O que os amigos (e você) andaram fazendo. Sobrevive a estar offline. */
export async function lerMural(): Promise<EventoDoMural[]> {
  const r = await chamarConta<{ eventos: EventoDoMural[] }>("/hub/feed", null, "GET")
  return r?.eventos ?? []
}

/**
 * Publica um acontecimento no mural dos amigos.
 *
 * `chave` é o que impede o mesmo fato de entrar duas vezes quando o jogador
 * recarrega um save antigo — o servidor ignora repetição em silêncio. Sempre
 * passe uma chave estável do fato (temporada + competição, por exemplo), nunca
 * a hora atual.
 */
export async function publicarNoMural(evento: {
  tipo: "titulo" | "contratacao" | "temporada" | "partida" | "marco"
  texto: string
  clube?: string
  chave?: string
}): Promise<void> {
  await chamarConta("/hub/feed", evento)
}

/**
 * Código da atividade a partir da rota aberta.
 *
 * Existe para a interface escolher ícone e cor sem tentar interpretar o texto
 * livre de `detalhe` — texto é para o jogador ler, não para o programa decidir.
 */
export function atividadeDaRota(rota: string): string {
  if (rota.startsWith("/partida/ao-vivo")) return "jogo"
  if (rota.startsWith("/partida")) return "partida"
  if (rota.startsWith("/mercado") || rota.startsWith("/transferencias") || rota.startsWith("/contratos")) return "mercado"
  if (rota.startsWith("/elenco") || rota.startsWith("/taticas")) return "elenco"
  if (rota.startsWith("/treinamento")) return "treino"
  if (rota.startsWith("/base")) return "base"
  if (rota.startsWith("/selecao")) return "selecao"
  if (rota.startsWith("/financas") || rota.startsWith("/infraestrutura")) return "gestao"
  if (rota.startsWith("/olheiros") || rota.startsWith("/relatorios") || rota.startsWith("/adversarios")) return "scout"
  if (rota.startsWith("/novo-jogo")) return "nova-carreira"
  return "escritorio"
}

/** Rótulo curto de "há quanto tempo", para a lista de amigos offline. */
export function desdeQuando(segundos: number): string {
  if (!segundos) return "nunca visto"
  const minutos = Math.max(0, Math.floor((Date.now() / 1000 - segundos) / 60))
  if (minutos < 1) return "agora"
  if (minutos < 60) return `há ${minutos} min`
  const horas = Math.floor(minutos / 60)
  if (horas < 24) return `há ${horas} h`
  const dias = Math.floor(horas / 24)
  return dias === 1 ? "ontem" : `há ${dias} dias`
}
