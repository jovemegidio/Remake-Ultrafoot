"use client"

// AMIGOS, CONVERSA PRIVADA E MURAL — no launcher.
//
// O launcher é onde a pessoa está ANTES de jogar: é ali que ela combina uma
// liga, responde um pedido de amizade e vê o que os amigos andaram fazendo.
// Enquanto isso morava só dentro do jogo, era preciso abrir o jogo inteiro para
// descobrir que não havia ninguém online.
//
// Sondagem, não WebSocket, pelo mesmo motivo do saguão: o servidor de contas é
// HTTP simples, sem dependência externa. Lista a cada 20s, conversa aberta a
// cada 5s.
//
// ⚠️ A CONVERSA SÓ É BUSCADA COM A JANELA ABERTA. Ler marca como lida no
// servidor — sondar em segundo plano zeraria o "não lidas" de quem nunca olhou.

import { useCallback, useEffect, useRef, useState } from "react"
import { cn } from "@/lib/utils"
import {
  Check, Inbox, Loader2, MessageSquare, Newspaper, Search, Send, Shield,
  Trophy, UserMinus, UserPlus, Users, X,
} from "lucide-react"
import {
  bloquearPessoa, buscarPessoas, desdeQuando, enviarDireta, lerConversa,
  lerMural, pedirAmizade, removerAmigo, responderPedido,
  type AmigoDoHub, type EventoDoMural, type MensagemDireta,
  type PessoaEncontrada,
} from "@/lib/hub"
import { abrirConversa, recarregarHub, useAmigosDoHub } from "@/lib/hub-store"

const INTERVALO_LISTA = 20_000
const INTERVALO_CONVERSA = 5_000

/** Online mostra o que a pessoa está fazendo; offline, há quanto tempo sumiu —
 *  que é a informação útil de quem não está lá. */
function estadoDoAmigo(a: AmigoDoHub): string {
  if (!a.online) return desdeQuando(a.visto_em)
  if (a.origem === "launcher") return "No launcher"
  return a.detalhe || a.clube || a.situacao || "No Ultrafoot"
}

function Avatar({ nome, online }: { nome: string; online?: boolean }) {
  return (
    <span className="relative grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary/15 text-xs font-bold text-primary">
      {(nome || "?").slice(0, 1).toUpperCase()}
      {online !== undefined && (
        <span className={cn(
          "absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-card",
          online ? "bg-emerald-400" : "bg-white/25",
        )} />
      )}
    </span>
  )
}

export function AmigosPanel({ temSessao, comRede }: { temSessao: boolean; comRede: boolean }) {
  const [aba, setAba] = useState<"amigos" | "pedidos" | "buscar" | "mural">("amigos")
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

  // A LISTA VEM DO STORE, nao de uma sondagem propria. Este painel, o painel da
  // direita e a doca de conversa mostravam o mesmo dado buscado tres vezes — e
  // com retratos diferentes: aqui dizia "2 nao lidas" enquanto a conversa ao
  // lado ja estava lida. Ver lib/hub-store.ts.
  const painel = useAmigosDoHub()
  const recarregar = useCallback(async () => { await recarregarHub() }, [])

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
      // Ler zerou o contador no servidor; a lista precisa refletir isso agora,
      // senão o "2 não lidas" fica ao lado da conversa recém-lida por 20s.
      void recarregar()
    }
    void buscar()
    const t = setInterval(buscar, INTERVALO_CONVERSA)
    return () => { vivo = false; clearInterval(t) }
  }, [conversaCom, recarregar])

  useEffect(() => { fim.current?.scrollIntoView({ behavior: "smooth", block: "end" }) }, [mensagens.length])

  useEffect(() => {
    if (aba !== "mural" || !temSessao || !comRede) return
    let vivo = true
    const puxar = async () => { const e = await lerMural(); if (vivo) setMural(e) }
    void puxar()
    const t = setInterval(puxar, INTERVALO_LISTA)
    return () => { vivo = false; clearInterval(t) }
  }, [aba, temSessao, comRede])

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
    setErro(await pedirAmizade(alvo))
    await recarregar()
    if (termo.trim().length >= 3) setAchados(await buscarPessoas(termo.trim()))
  }

  if (!temSessao) {
    return (
      <section className="rounded-2xl border border-border bg-card p-6 text-center">
        <Users className="mx-auto mb-2 h-6 w-6 text-muted-foreground" />
        <p className="text-sm font-bold text-foreground">Entre na sua conta para ter amigos aqui</p>
        <p className="mx-auto mt-1 max-w-md text-xs leading-relaxed text-muted-foreground">
          É a conta do Ultrafoot que identifica você para os outros técnicos — a mesma do jogo, da
          loja e dos saves na nuvem.
        </p>
      </section>
    )
  }

  if (!comRede) {
    return (
      <section className="rounded-2xl border border-border bg-card p-6 text-center text-xs text-muted-foreground">
        Amigos, conversas e mural vêm do servidor. Conecte-se para carregar.
      </section>
    )
  }

  const amigoAberto = painel.amigos.find(a => a.conta_id === conversaCom) ?? null
  const naoLidas = painel.amigos.reduce((total, a) => total + a.nao_lidas, 0)
  const abas = [
    { id: "amigos" as const, nome: "Amigos", icone: Users, contador: naoLidas },
    { id: "pedidos" as const, nome: "Solicitações", icone: Inbox, contador: painel.recebidos.length },
    { id: "buscar" as const, nome: "Adicionar", icone: Search, contador: 0 },
    { id: "mural" as const, nome: "Atividade", icone: Newspaper, contador: 0 },
  ]

  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-card">
      <div className="flex flex-wrap gap-1 border-b border-border p-2">
        {abas.map(item => {
          const Icone = item.icone
          return (
            <button
              key={item.id}
              onClick={() => { setAba(item.id); if (item.id !== "amigos") setConversaCom(null) }}
              className={cn(
                "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-colors",
                aba === item.id ? "bg-primary/12 text-primary" : "text-muted-foreground hover:bg-white/[0.04] hover:text-foreground",
              )}
            >
              <Icone className="h-3.5 w-3.5" />{item.nome}
              {item.contador > 0 && (
                <span className="rounded-full bg-red-500/85 px-1.5 text-[10px] font-black text-white">{item.contador}</span>
              )}
            </button>
          )
        })}
      </div>

      {erro && <p className="px-4 pt-3 text-xs text-red-400">{erro}</p>}

      {aba === "amigos" && (
        <div className="grid gap-3 p-3 lg:grid-cols-[240px_1fr]">
          <div className="rounded-xl border border-border bg-black/20 p-2">
            <p className="px-1 pb-2 text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
              {painel.amigos.filter(a => a.online).length}/{painel.amigos.length} online
            </p>
                        {painel.amigos.length === 0 && (
              <p className="px-1 py-2 text-xs leading-relaxed text-muted-foreground">
                Nenhum amigo ainda. Use <b className="text-foreground">Adicionar</b> para encontrar
                alguém pelo nome ou pelo e-mail da conta.
              </p>
            )}
            <div className="max-h-80 space-y-1 overflow-y-auto">
              {[...painel.amigos].sort((a, b) => Number(b.online) - Number(a.online)).map(a => (
                <button
                  key={a.conta_id}
                  onClick={() => { setConversaCom(a.conta_id); setErro("") }}
                  className={cn(
                    "flex w-full items-center gap-2.5 rounded-lg p-2 text-left transition-colors",
                    a.conta_id === conversaCom ? "bg-primary/10" : "hover:bg-white/[0.04]",
                  )}
                >
                  <Avatar nome={a.nome} online={a.online} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs font-semibold text-foreground">{a.nome}</span>
                    <span className={cn("block truncate text-[10px]", a.online ? "text-primary/80" : "text-muted-foreground")}>
                      {estadoDoAmigo(a)}
                    </span>
                  </span>
                  {a.nao_lidas > 0 && (
                    <span className="rounded-full bg-red-500/85 px-1.5 text-[10px] font-black text-white">{a.nao_lidas}</span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {amigoAberto ? (
            <div className="flex min-h-[300px] flex-col rounded-xl border border-border bg-black/20">
              <div className="flex items-center gap-2 border-b border-border px-3 py-2">
                <Avatar nome={amigoAberto.nome} online={amigoAberto.online} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-bold text-foreground">{amigoAberto.nome}</p>
                  <p className={cn("truncate text-[10px]", amigoAberto.online ? "text-primary/80" : "text-muted-foreground")}>
                    {estadoDoAmigo(amigoAberto)}
                  </p>
                </div>
                <button
                  onClick={async () => { await removerAmigo(amigoAberto.conta_id); setConversaCom(null); await recarregar() }}
                  title="Desfazer amizade"
                  className="rounded-md border border-border p-1.5 text-muted-foreground hover:text-foreground"
                >
                  <UserMinus className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={async () => { await bloquearPessoa(amigoAberto.conta_id); setConversaCom(null); await recarregar() }}
                  title="Bloquear"
                  className="rounded-md border border-border p-1.5 text-muted-foreground hover:text-red-400"
                >
                  <Shield className="h-3.5 w-3.5" />
                </button>
                <button onClick={() => setConversaCom(null)} className="rounded-md border border-border p-1.5 text-muted-foreground hover:text-foreground">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3">
                {mensagens.length === 0 && (
                  <p className="text-xs text-muted-foreground">
                    Nenhuma mensagem ainda. Combine uma liga ou mande um oi — ele lê quando abrir.
                  </p>
                )}
                {mensagens.map(m => {
                  const meu = m.de_id === painel.eu
                  return (
                    <div key={m.id} className={cn("flex", meu ? "justify-end" : "justify-start")}>
                      <div className={cn(
                        "max-w-[80%] rounded-xl px-3 py-1.5 text-[13px] leading-snug",
                        meu ? "bg-primary/15 text-foreground" : "bg-white/[0.06] text-muted-foreground",
                      )}>
                        <p className="whitespace-pre-wrap break-words">{m.texto}</p>
                        <p className="mt-0.5 text-[10px] text-muted-foreground">
                          {new Date(m.quando * 1000).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                        </p>
                      </div>
                    </div>
                  )
                })}
                <div ref={fim} />
              </div>
              <div className="flex gap-2 border-t border-border p-2.5">
                <input
                  value={texto}
                  onChange={e => setTexto(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") void mandar() }}
                  maxLength={500}
                  placeholder={`Mensagem para ${amigoAberto.nome}…`}
                  className="flex-1 rounded-lg border border-border bg-black/25 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/50"
                />
                <button
                  onClick={() => void mandar()}
                  disabled={!texto.trim() || enviando}
                  className="rounded-lg bg-primary px-3 py-2 text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-35"
                  aria-label="Enviar"
                >
                  {enviando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </button>
              </div>
            </div>
          ) : (
            <div className="grid min-h-[240px] place-items-center rounded-xl border border-dashed border-border p-6 text-center">
              <div>
                <MessageSquare className="mx-auto mb-2 h-6 w-6 text-muted-foreground" />
                <p className="text-sm font-semibold text-foreground">Escolha um amigo para conversar</p>
                <p className="mx-auto mt-1 max-w-sm text-xs text-muted-foreground">
                  A conversa é privada e fica guardada — quem estiver offline lê quando voltar.
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {aba === "pedidos" && (
        <div className="space-y-5 p-4">
          <div>
            <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
              Esperando sua resposta · {painel.recebidos.length}
            </p>
            {painel.recebidos.length === 0 && <p className="text-xs text-muted-foreground">Nenhum pedido novo.</p>}
            <div className="space-y-2">
              {painel.recebidos.map(p => (
                <div key={p.conta_id} className="flex items-center gap-3 rounded-xl bg-black/20 p-2.5">
                  <Avatar nome={p.nome} />
                  <p className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground">{p.nome}</p>
                  <button
                    onClick={async () => { await responderPedido(p.conta_id, true); await recarregar() }}
                    className="flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground hover:opacity-90"
                  >
                    <Check className="h-3.5 w-3.5" />Aceitar
                  </button>
                  <button
                    onClick={async () => { await responderPedido(p.conta_id, false); await recarregar() }}
                    className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground"
                  >
                    Recusar
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
              Enviados por você · {painel.enviados.length}
            </p>
            {painel.enviados.length === 0 && <p className="text-xs text-muted-foreground">Nenhum pedido em aberto.</p>}
            <div className="space-y-2">
              {painel.enviados.map(p => (
                <div key={p.conta_id} className="flex items-center gap-3 rounded-xl bg-black/20 p-2.5">
                  <Avatar nome={p.nome} />
                  <p className="min-w-0 flex-1 truncate text-sm text-muted-foreground">{p.nome}</p>
                  <span className="text-[11px] text-muted-foreground">aguardando</span>
                  <button
                    onClick={async () => { await removerAmigo(p.conta_id); await recarregar() }}
                    className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground"
                  >
                    Cancelar
                  </button>
                </div>
              ))}
            </div>
          </div>

          {painel.bloqueados.length > 0 && (
            <div>
              <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
                Bloqueados · {painel.bloqueados.length}
              </p>
              <div className="space-y-2">
                {painel.bloqueados.map(p => (
                  <div key={p.conta_id} className="flex items-center gap-3 rounded-xl bg-black/20 p-2.5">
                    <Avatar nome={p.nome} />
                    <p className="min-w-0 flex-1 truncate text-sm text-muted-foreground">{p.nome}</p>
                    <button
                      onClick={async () => { await bloquearPessoa(p.conta_id, false); await recarregar() }}
                      className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground"
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
              className="flex-1 rounded-lg border border-border bg-black/25 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/50"
            />
            {/* O e-mail casa EXATO no servidor: quem digitou o endereço inteiro
                já sabe de quem é a conta, então o convite vai direto. */}
            {termo.includes("@") && (
              <button
                onClick={() => void adicionar({ email: termo.trim() })}
                className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-bold text-primary-foreground hover:opacity-90"
              >
                <UserPlus className="h-3.5 w-3.5" />Convidar
              </button>
            )}
          </div>
          <p className="text-[11px] text-muted-foreground">
            Procure pelo nome que a pessoa usa na conta, ou cole o e-mail dela. Quem bloqueou você
            não aparece.
          </p>
          {buscando && <p className="text-xs text-muted-foreground">Procurando…</p>}
          {!buscando && termo.trim().length >= 3 && achados.length === 0 && (
            <p className="text-xs text-muted-foreground">Ninguém encontrado com esse nome.</p>
          )}
          <div className="space-y-2">
            {achados.map(p => (
              <div key={p.conta_id} className="flex items-center gap-3 rounded-xl bg-black/20 p-2.5">
                <Avatar nome={p.nome} />
                <p className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground">{p.nome}</p>
                {p.relacao === "amigo" && <span className="text-[11px] font-semibold text-primary/80">já é seu amigo</span>}
                {p.relacao === "enviado" && <span className="text-[11px] text-muted-foreground">pedido enviado</span>}
                {p.relacao === "recebido" && (
                  <button
                    onClick={async () => { await responderPedido(p.conta_id, true); await recarregar(); setAchados(await buscarPessoas(termo.trim())) }}
                    className="rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground hover:opacity-90"
                  >
                    Aceitar
                  </button>
                )}
                {p.relacao === "nenhuma" && (
                  <button
                    onClick={() => void adicionar({ conta_id: p.conta_id })}
                    className="flex items-center gap-1.5 rounded-lg border border-primary/40 px-3 py-1.5 text-xs font-bold text-primary hover:bg-primary/10"
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
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            O que seus amigos andaram fazendo no Ultrafoot — títulos, acessos e contratações.
            Diferente de "quem está online", isto continua aqui quando eles desligam o PC.
          </p>
          {mural.length === 0 && (
            <p className="pt-2 text-xs text-muted-foreground">
              Nada por aqui ainda. Ganhe um título ou feche uma contratação e seus amigos vão ver.
            </p>
          )}
          {mural.map(e => (
            <div key={e.id} className="flex items-start gap-3 rounded-xl bg-black/20 p-2.5">
              <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-primary/12 text-primary">
                {e.tipo === "titulo" ? <Trophy className="h-3.5 w-3.5" /> : <Newspaper className="h-3.5 w-3.5" />}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[13px] leading-snug text-muted-foreground">
                  <b className="text-foreground">{e.conta_id === painel.eu ? "Você" : e.nome}</b> {e.texto}
                </p>
                <p className="text-[10px] text-muted-foreground/70">
                  {e.clube ? `${e.clube} · ` : ""}{desdeQuando(e.quando)}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
