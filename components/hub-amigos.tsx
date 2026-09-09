"use client"

// AMIGOS, CONVERSA PRIVADA E MURAL — dentro do jogo.
//
// Antes, a aba "Amigos" do FC Hub mostrava a lista do **Discord**: quem não usa
// Discord (a maioria) via um painel permanentemente vazio, e não havia como
// adicionar ninguém nem falar em particular. Aqui a identidade é a conta do
// Ultrafoot, a mesma do launcher.
//
// SONDAGEM, NÃO WEBSOCKET, pelo mesmo motivo do chat do saguão: o servidor de
// contas é HTTP simples, sem dependência externa. A lista de amigos anda a cada
// 20s; a conversa aberta, a cada 5s.
//
// ⚠️ A CONVERSA SÓ É BUSCADA QUANDO ESTÁ ABERTA NA TELA. Ler marca como lida no
// servidor — sondar em segundo plano zeraria o "não lidas" de quem nunca olhou.

import { useCallback, useEffect, useRef, useState } from "react"
import {
  Check, Inbox, LoaderCircle, MessageSquare, Newspaper, Search, Send, Shield,
  Trophy, UserMinus, UserPlus, Users, X,
} from "lucide-react"
import {
  PAINEL_VAZIO, bloquearPessoa, buscarPessoas, desdeQuando, enviarDireta, lerConversa,
  lerMural, listarAmigos, pedirAmizade, removerAmigo, responderPedido,
  type AmigoDoHub, type EventoDoMural, type MensagemDireta, type PainelDeAmigos,
  type PessoaEncontrada,
} from "@/lib/hub-social"

const INTERVALO_LISTA = 20_000
const INTERVALO_CONVERSA = 5_000

export type SecaoDoHub = "amigos" | "pedidos" | "buscar" | "mural"

/** Frase de estado de um amigo. Online mostra o que ele está fazendo; offline,
 *  há quanto tempo sumiu — que é a informação útil de quem não está lá. */
function estadoDoAmigo(a: AmigoDoHub): string {
  if (!a.online) return desdeQuando(a.visto_em)
  if (a.origem === "launcher") return "No launcher"
  return a.detalhe || a.clube || a.situacao || "No Ultrafoot"
}

function Avatar({ nome, online }: { nome: string; online?: boolean }) {
  return (
    <span className="relative grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[var(--brand)]/15 text-xs font-black text-[var(--brand)]">
      {(nome || "?").slice(0, 1).toUpperCase()}
      {online !== undefined && (
        <span className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-[#071017] ${online ? "bg-emerald-400" : "bg-white/25"}`} />
      )}
    </span>
  )
}

export function HubAmigos({ secao = "amigos" }: { secao?: SecaoDoHub }) {
  const [painel, setPainel] = useState<PainelDeAmigos>(PAINEL_VAZIO)
  const [carregando, setCarregando] = useState(true)
  const [aba, setAba] = useState<SecaoDoHub>(secao)
  const [conversaCom, setConversaCom] = useState<number | null>(null)
  const [mensagens, setMensagens] = useState<MensagemDireta[]>([])
  const [texto, setTexto] = useState("")
  const [erro, setErro] = useState("")
  const [enviando, setEnviando] = useState(false)
  const [termo, setTermo] = useState("")
  const [achados, setAchados] = useState<PessoaEncontrada[]>([])
  const [buscando, setBuscando] = useState(false)
  const [mural, setMural] = useState<EventoDoMural[]>([])
  const ultimaMsg = useRef(0)
  const fim = useRef<HTMLDivElement>(null)

  // A aba pedida de fora (as abas do topo do FC Hub) manda, mas o painel também
  // troca sozinho ao abrir uma conversa — por isso é estado, e não só a prop.
  useEffect(() => { setAba(secao) }, [secao])

  const recarregar = useCallback(async () => {
    const dados = await listarAmigos()
    setPainel(dados)
    setCarregando(false)
  }, [])

  useEffect(() => {
    let vivo = true
    void (async () => { const d = await listarAmigos(); if (vivo) { setPainel(d); setCarregando(false) } })()
    const t = setInterval(() => { void recarregar() }, INTERVALO_LISTA)
    return () => { vivo = false; clearInterval(t) }
  }, [recarregar])

  // Conversa aberta: histórico do zero na troca de amigo, depois só o que é novo.
  useEffect(() => {
    if (conversaCom === null) return
    let vivo = true
    ultimaMsg.current = 0
    setMensagens([])
    const buscar = async () => {
      const novas = await lerConversa(conversaCom, ultimaMsg.current)
      if (!vivo || novas.length === 0) return
      ultimaMsg.current = novas[novas.length - 1].id
      setMensagens(antes => [...antes, ...novas].slice(-200))
      // Ler zerou o contador no servidor; a lista tem de refletir isso sem
      // esperar os 20s, senão o "2 não lidas" fica na tela ao lado da conversa
      // que a pessoa acabou de ler.
      void recarregar()
    }
    void buscar()
    const t = setInterval(buscar, INTERVALO_CONVERSA)
    return () => { vivo = false; clearInterval(t) }
  }, [conversaCom, recarregar])

  useEffect(() => { fim.current?.scrollIntoView({ behavior: "smooth", block: "end" }) }, [mensagens.length])

  useEffect(() => {
    if (aba !== "mural") return
    let vivo = true
    void (async () => { const e = await lerMural(); if (vivo) setMural(e) })()
    const t = setInterval(async () => { const e = await lerMural(); if (vivo) setMural(e) }, INTERVALO_LISTA)
    return () => { vivo = false; clearInterval(t) }
  }, [aba])

  // Busca com respiro: procurar a cada tecla mandaria uma consulta por letra.
  useEffect(() => {
    if (aba !== "buscar") return
    const limpo = termo.trim()
    if (limpo.length < 3) { setAchados([]); return }
    let vivo = true
    setBuscando(true)
    const t = setTimeout(async () => {
      const pessoas = await buscarPessoas(limpo)
      if (!vivo) return
      setAchados(pessoas)
      setBuscando(false)
    }, 400)
    return () => { vivo = false; clearTimeout(t) }
  }, [termo, aba])

  const mandar = async () => {
    const limpo = texto.trim()
    if (!limpo || conversaCom === null || enviando) return
    setEnviando(true)
    const problema = await enviarDireta(conversaCom, limpo)
    setErro(problema)
    if (!problema) {
      setTexto("")
      const novas = await lerConversa(conversaCom, ultimaMsg.current)
      if (novas.length) {
        ultimaMsg.current = novas[novas.length - 1].id
        setMensagens(antes => [...antes, ...novas].slice(-200))
      }
    }
    setEnviando(false)
  }

  const adicionar = async (alvo: { conta_id?: number; email?: string }) => {
    const problema = await pedirAmizade(alvo)
    setErro(problema)
    await recarregar()
    if (termo.trim().length >= 3) setAchados(await buscarPessoas(termo.trim()))
  }

  const abrirConversa = (conta_id: number) => { setConversaCom(conta_id); setAba("amigos"); setErro("") }

  const amigoAberto = painel.amigos.find(a => a.conta_id === conversaCom) ?? null
  const naoLidas = painel.amigos.reduce((total, a) => total + a.nao_lidas, 0)
  const abas: { id: SecaoDoHub; nome: string; icone: typeof Users; contador?: number }[] = [
    { id: "amigos", nome: "Amigos", icone: Users, contador: naoLidas },
    { id: "pedidos", nome: "Solicitações", icone: Inbox, contador: painel.recebidos.length },
    { id: "buscar", nome: "Adicionar", icone: Search },
    { id: "mural", nome: "Atividade", icone: Newspaper },
  ]

  return (
    <div className="rounded-xl border border-white/10 bg-white/[.03]">
      <div className="flex flex-wrap gap-1 border-b border-white/10 p-2">
        {abas.map(item => {
          const Icone = item.icone
          const ativa = aba === item.id
          return (
            <button
              key={item.id}
              onClick={() => { setAba(item.id); if (item.id !== "amigos") setConversaCom(null) }}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-bold transition-colors ${ativa ? "bg-[var(--brand)]/15 text-[var(--brand)]" : "text-white/45 hover:bg-white/5 hover:text-white/75"}`}
            >
              <Icone className="h-3.5 w-3.5" />{item.nome}
              {!!item.contador && (
                <span className="rounded-full bg-red-500/85 px-1.5 text-[9px] font-black text-white">{item.contador}</span>
              )}
            </button>
          )
        })}
      </div>

      {erro && <p className="px-4 pt-3 text-[11px] text-red-400">{erro}</p>}

      {aba === "amigos" && (
        <div className="grid gap-3 p-3 lg:grid-cols-[240px_1fr]">
          <div className="rounded-lg border border-white/10 bg-black/20 p-2">
            <p className="px-1 pb-2 text-[9px] font-black uppercase tracking-[.18em] text-white/30">
              Meus amigos · {painel.amigos.filter(a => a.online).length}/{painel.amigos.length} online
            </p>
            {carregando && <p className="px-1 py-2 text-[11px] text-white/30">Carregando…</p>}
            {!carregando && painel.amigos.length === 0 && (
              <p className="px-1 py-2 text-[11px] leading-relaxed text-white/35">
                Você ainda não tem amigos aqui. Use <b className="text-white/60">Adicionar</b> para
                encontrar alguém pelo nome ou pelo e-mail da conta.
              </p>
            )}
            {/* ⚠️ AGRUPADO POR PRESENCA (PDF Ultra26, p.6).
                A lista era UMA so, ordenada com os online no topo. Funciona, mas
                nao responde de relance a pergunta que se faz ao abrir o hub:
                "quantos dos meus estao online AGORA". A referencia separa em dois
                blocos com o numero no cabecalho — "Online : 2", "Offline : 4" — e
                e so isso que muda aqui. Os dados sao os mesmos; a leitura, nao. */}
            <div className="max-h-72 space-y-2 overflow-y-auto">
              {([
                { chave: "online" as const, rotulo: "Online", lista: painel.amigos.filter(a => a.online) },
                { chave: "offline" as const, rotulo: "Offline", lista: painel.amigos.filter(a => !a.online) },
              ]).map(({ chave, rotulo, lista }) => lista.length === 0 ? null : (
                <div key={chave}>
                  <p className="px-1 pb-1 text-[9px] font-black uppercase tracking-[.18em] text-white/25">
                    {rotulo} : {lista.length}
                  </p>
                  <div className="space-y-1">
                    {lista.map(a => (
                      <button
                        key={a.conta_id}
                        onClick={() => abrirConversa(a.conta_id)}
                        className={`flex w-full items-center gap-2.5 rounded-lg p-2 text-left transition-colors ${a.conta_id === conversaCom ? "bg-[var(--brand)]/10" : "hover:bg-white/[0.05]"}`}
                      >
                        <Avatar nome={a.nome} online={a.online} />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[11px] font-bold text-white/85">{a.nome}</span>
                          <span className={`block truncate text-[9px] ${a.online ? "text-emerald-300/85" : "text-white/30"}`}>
                            {estadoDoAmigo(a)}
                          </span>
                        </span>
                        {a.nao_lidas > 0 && (
                          <span className="rounded-full bg-red-500/85 px-1.5 text-[9px] font-black text-white">{a.nao_lidas}</span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {amigoAberto ? (
            <div className="flex min-h-[280px] flex-col rounded-lg border border-white/10 bg-black/20">
              <div className="flex items-center gap-2 border-b border-white/10 px-3 py-2">
                <Avatar nome={amigoAberto.nome} online={amigoAberto.online} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-bold text-white">{amigoAberto.nome}</p>
                  <p className={`truncate text-[9px] ${amigoAberto.online ? "text-emerald-300/85" : "text-white/30"}`}>
                    {estadoDoAmigo(amigoAberto)}
                  </p>
                </div>
                <button
                  onClick={async () => { await removerAmigo(amigoAberto.conta_id); setConversaCom(null); await recarregar() }}
                  title="Desfazer amizade"
                  className="rounded-md border border-white/10 p-1.5 text-white/40 hover:text-white/80"
                >
                  <UserMinus className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={async () => { await bloquearPessoa(amigoAberto.conta_id); setConversaCom(null); await recarregar() }}
                  title="Bloquear"
                  className="rounded-md border border-white/10 p-1.5 text-white/40 hover:text-red-300"
                >
                  <Shield className="h-3.5 w-3.5" />
                </button>
                <button onClick={() => setConversaCom(null)} className="rounded-md border border-white/10 p-1.5 text-white/40 hover:text-white/80">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3">
                {mensagens.length === 0 && (
                  <p className="text-[11px] text-white/30">
                    Nenhuma mensagem ainda. Combine uma liga, troque uma dica de contratação.
                  </p>
                )}
                {mensagens.map(m => {
                  const meu = m.de_id === painel.eu
                  return (
                    <div key={m.id} className={`flex ${meu ? "justify-end" : "justify-start"}`}>
                      <div className={`max-w-[80%] rounded-xl px-3 py-1.5 text-[12px] leading-snug ${meu ? "bg-[var(--brand)]/15 text-white" : "bg-white/[0.06] text-white/80"}`}>
                        <p className="whitespace-pre-wrap break-words">{m.texto}</p>
                        <p className="mt-0.5 text-[9px] text-white/25">
                          {new Date(m.quando * 1000).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                        </p>
                      </div>
                    </div>
                  )
                })}
                <div ref={fim} />
              </div>
              <div className="flex gap-2 border-t border-white/10 p-2.5">
                <input
                  value={texto}
                  onChange={e => setTexto(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") void mandar() }}
                  maxLength={500}
                  placeholder={`Mensagem para ${amigoAberto.nome}…`}
                  className="flex-1 rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-xs text-white placeholder:text-white/25 outline-none focus:border-[var(--brand)]/40"
                />
                <button
                  onClick={() => void mandar()}
                  disabled={!texto.trim() || enviando}
                  className="rounded-lg bg-[var(--brand)] px-3 py-2 text-[var(--brand-ink)] transition-opacity hover:opacity-90 disabled:opacity-35"
                  aria-label="Enviar"
                >
                  {enviando ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </button>
              </div>
            </div>
          ) : (
            <div className="grid min-h-[220px] place-items-center rounded-lg border border-dashed border-white/10 p-6 text-center">
              <div>
                <MessageSquare className="mx-auto mb-2 h-6 w-6 text-white/20" />
                <p className="text-xs font-semibold text-white/55">Escolha um amigo para conversar</p>
                <p className="mt-1 text-[11px] text-white/30">
                  A conversa é privada e fica guardada — quem estiver offline lê depois.
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {aba === "pedidos" && (
        <div className="space-y-4 p-4">
          <div>
            <p className="mb-2 text-[9px] font-black uppercase tracking-[.18em] text-white/30">
              Esperando sua resposta · {painel.recebidos.length}
            </p>
            {painel.recebidos.length === 0 && <p className="text-[11px] text-white/30">Nenhum pedido novo.</p>}
            <div className="space-y-2">
              {painel.recebidos.map(p => (
                <div key={p.conta_id} className="flex items-center gap-3 rounded-lg bg-black/20 p-2.5">
                  <Avatar nome={p.nome} />
                  <p className="min-w-0 flex-1 truncate text-xs font-semibold text-white/85">{p.nome}</p>
                  <button
                    onClick={async () => { await responderPedido(p.conta_id, true); await recarregar() }}
                    className="flex items-center gap-1 rounded-lg bg-[var(--brand)] px-2.5 py-1.5 text-[11px] font-black text-[var(--brand-ink)]"
                  >
                    <Check className="h-3.5 w-3.5" />Aceitar
                  </button>
                  <button
                    onClick={async () => { await responderPedido(p.conta_id, false); await recarregar() }}
                    className="rounded-lg border border-white/10 px-2.5 py-1.5 text-[11px] font-bold text-white/50 hover:text-white/80"
                  >
                    Recusar
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-2 text-[9px] font-black uppercase tracking-[.18em] text-white/30">
              Enviados por você · {painel.enviados.length}
            </p>
            {painel.enviados.length === 0 && <p className="text-[11px] text-white/30">Nenhum pedido em aberto.</p>}
            <div className="space-y-2">
              {painel.enviados.map(p => (
                <div key={p.conta_id} className="flex items-center gap-3 rounded-lg bg-black/20 p-2.5">
                  <Avatar nome={p.nome} />
                  <p className="min-w-0 flex-1 truncate text-xs text-white/70">{p.nome}</p>
                  <span className="text-[10px] text-white/30">aguardando</span>
                  <button
                    onClick={async () => { await removerAmigo(p.conta_id); await recarregar() }}
                    className="rounded-lg border border-white/10 px-2.5 py-1.5 text-[11px] font-bold text-white/45 hover:text-white/80"
                  >
                    Cancelar
                  </button>
                </div>
              ))}
            </div>
          </div>

          {painel.bloqueados.length > 0 && (
            <div>
              <p className="mb-2 text-[9px] font-black uppercase tracking-[.18em] text-white/30">
                Bloqueados · {painel.bloqueados.length}
              </p>
              <div className="space-y-2">
                {painel.bloqueados.map(p => (
                  <div key={p.conta_id} className="flex items-center gap-3 rounded-lg bg-black/20 p-2.5">
                    <Avatar nome={p.nome} />
                    <p className="min-w-0 flex-1 truncate text-xs text-white/55">{p.nome}</p>
                    <button
                      onClick={async () => { await bloquearPessoa(p.conta_id, false); await recarregar() }}
                      className="rounded-lg border border-white/10 px-2.5 py-1.5 text-[11px] font-bold text-white/45 hover:text-white/80"
                    >
                      Desbloquear
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {aba === "buscar" && (
        <div className="space-y-3 p-4">
          <div className="flex gap-2">
            <input
              value={termo}
              onChange={e => setTermo(e.target.value)}
              placeholder="Nome do técnico ou e-mail da conta"
              className="flex-1 rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-xs text-white placeholder:text-white/25 outline-none focus:border-[var(--brand)]/40"
            />
            {/* O e-mail casa EXATO no servidor, então o botão manda direto: quem
                digitou o e-mail inteiro já sabe de quem é a conta. */}
            {termo.includes("@") && (
              <button
                onClick={() => void adicionar({ email: termo.trim() })}
                className="flex items-center gap-1.5 rounded-lg bg-[var(--brand)] px-3 py-2 text-[11px] font-black text-[var(--brand-ink)]"
              >
                <UserPlus className="h-3.5 w-3.5" />Convidar
              </button>
            )}
          </div>
          <p className="text-[10px] text-white/30">
            Procure pelo nome que a pessoa usa na conta, ou cole o e-mail dela. Quem bloqueou você
            não aparece.
          </p>
          {buscando && <p className="text-[11px] text-white/35">Procurando…</p>}
          {!buscando && termo.trim().length >= 3 && achados.length === 0 && (
            <p className="text-[11px] text-white/35">Ninguém encontrado com esse nome.</p>
          )}
          <div className="space-y-2">
            {achados.map(p => (
              <div key={p.conta_id} className="flex items-center gap-3 rounded-lg bg-black/20 p-2.5">
                <Avatar nome={p.nome} />
                <p className="min-w-0 flex-1 truncate text-xs font-semibold text-white/85">{p.nome}</p>
                {p.relacao === "amigo" && <span className="text-[10px] font-bold text-emerald-300/80">já é seu amigo</span>}
                {p.relacao === "enviado" && <span className="text-[10px] text-white/35">pedido enviado</span>}
                {p.relacao === "recebido" && (
                  <button
                    onClick={async () => { await responderPedido(p.conta_id, true); await recarregar(); setAchados(await buscarPessoas(termo.trim())) }}
                    className="rounded-lg bg-[var(--brand)] px-2.5 py-1.5 text-[11px] font-black text-[var(--brand-ink)]"
                  >
                    Aceitar
                  </button>
                )}
                {p.relacao === "nenhuma" && (
                  <button
                    onClick={() => void adicionar({ conta_id: p.conta_id })}
                    className="flex items-center gap-1.5 rounded-lg border border-[var(--brand)]/40 px-2.5 py-1.5 text-[11px] font-bold text-[var(--brand)] hover:bg-[var(--brand)]/10"
                  >
                    <UserPlus className="h-3.5 w-3.5" />Adicionar
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {aba === "mural" && (
        <div className="space-y-2 p-4">
          <p className="text-[10px] leading-relaxed text-white/35">
            O que os seus amigos andaram fazendo no Ultrafoot — títulos, contratações e viradas de
            temporada. Diferente de "quem está online", isto continua aqui quando eles desligam o PC.
          </p>
          {mural.length === 0 && (
            <p className="pt-2 text-[11px] text-white/30">
              Nada por aqui ainda. Ganhe um título ou feche uma contratação e seus amigos vão ver.
            </p>
          )}
          {mural.map(e => (
            <div key={e.id} className="flex items-start gap-3 rounded-lg bg-black/20 p-2.5">
              <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[var(--brand)]/12 text-[var(--brand)]">
                {e.tipo === "titulo" ? <Trophy className="h-3.5 w-3.5" /> : <Newspaper className="h-3.5 w-3.5" />}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[12px] leading-snug text-white/80">
                  <b className="text-white">{e.conta_id === painel.eu ? "Você" : e.nome}</b> {e.texto}
                </p>
                <p className="text-[9px] text-white/25">
                  {e.clube ? `${e.clube} · ` : ""}{desdeQuando(e.quando)}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
