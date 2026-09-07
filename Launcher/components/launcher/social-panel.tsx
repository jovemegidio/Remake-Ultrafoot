"use client"

import { useEffect, useRef, useState } from "react"
import { cn } from "@/lib/utils"
import {
  Users, Wifi, WifiOff, MessageCircle, ExternalLink, KeyRound, LogIn, ShieldCheck,
  Send, ShieldAlert, UserPlus,
} from "lucide-react"
import type { LauncherConfig, ServerStatus } from "@/lib/launcher-bridge"
import type { Sessao } from "@/lib/auth"
import { iniciais, type Preferencias } from "@/lib/preferencias"
import {
  lerChat, enviarMensagem,
  type MensagemDoChat, type RespostaDePresenca,
} from "@/lib/hub"
import { AmigosPanel } from "@/components/launcher/amigos-panel"
import { PAINEL } from "@/lib/servidor"

/**
 * FC HUB — a aba social do launcher.
 *
 * Junta num lugar só o que estava espalhado: quem você é, se o servidor do modo
 * online está de pé e por onde falar com a comunidade. Antes, para saber se dava
 * para jogar online, era preciso abrir o jogo e descobrir lá dentro.
 */
export function SocialPanel({
  sessao,
  prefs,
  serverStatus,
  config,
  ativado,
  presenca,
  ehAdmin,
  comRede = true,
  onEntrar,
  onAtivar,
  onOpen,
}: {
  sessao: Sessao | null
  prefs: Preferencias
  serverStatus: ServerStatus | null
  config: LauncherConfig | null
  ativado: boolean
  /** Resultado da batida de presença, que agora mora no shell.
   *
   *  ⚠️ A BATIDA SAIU DAQUI DE PROPÓSITO. Enquanto ela vivia neste painel, a
   *  pessoa só aparecia online para os outros ENQUANTO a aba FC Hub estivesse
   *  aberta — em qualquer outra aba do launcher ela sumia da lista, mesmo com o
   *  launcher aberto na frente dela. */
  presenca: RespostaDePresenca | null
  /** false = sem rede (ou modo offline). Presenca e chat sao 100% servidor:
   *  offline a gente PARA de sondar e diz o motivo, em vez de mostrar um saguao
   *  vazio que parece defeito. */
  comRede?: boolean
  /** Mostra o atalho do painel de administração. */
  ehAdmin: boolean
  onEntrar: () => void
  onAtivar: () => void
  onOpen: (url: string) => void
}) {
  // CHAT DO SAGUAO, buscado a cada 5s. Sondagem, e nao WebSocket, de proposito:
  // o servidor de contas e HTTP simples, sem dependencia externa, e um saguao
  // nao precisa de tempo real ao segundo. (A batida de PRESENCA mora no shell —
  // ver a propriedade `presenca` acima.)
  //
  // SAGUAO x AMIGOS. Sao coisas diferentes: o saguao e publico (quem tem conta
  // esta la) e a aba de amigos e a sua rede — conversa privada, pedidos e o
  // mural. Uma tela so, com tudo empilhado, so faria rolagem.
  const [visao, setVisao] = useState<"saguao" | "amigos">("saguao")
  // Contadores que a PROPRIA batida de presenca devolve. Sem eles, o launcher
  // precisaria de uma segunda sondagem so para mostrar um numerinho vermelho.
  const naSala = presenca?.online ?? []
  const eu = presenca?.eu ?? 0
  const avisos = { pedidos: presenca?.pedidos ?? 0, nao_lidas: presenca?.nao_lidas ?? 0 }
  const [mensagens, setMensagens] = useState<MensagemDoChat[]>([])
  const [texto, setTexto] = useState("")
  const [erroChat, setErroChat] = useState("")
  const [enviando, setEnviando] = useState(false)
  const ultimoId = useRef(0)
  const fimDoChat = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!sessao || !comRede || visao !== "saguao") return
    let vivo = true
    const buscar = async () => {
      const novas = await lerChat(ultimoId.current)
      if (!vivo || novas.length === 0) return
      ultimoId.current = novas[novas.length - 1].id
      // Corta o historico na tela: conversa longa acumulando vira milhares de
      // nos no DOM e o painel comeca a travar.
      setMensagens(antes => [...antes, ...novas].slice(-120))
    }
    void buscar()
    const t = setInterval(buscar, 5_000)
    return () => { vivo = false; clearInterval(t) }
  }, [sessao, comRede, visao])

  useEffect(() => {
    fimDoChat.current?.scrollIntoView({ behavior: "smooth", block: "end" })
  }, [mensagens.length])

  const mandar = async () => {
    const limpo = texto.trim()
    if (!limpo || enviando) return
    setEnviando(true)
    const problema = await enviarMensagem(limpo)
    setErroChat(problema)
    if (!problema) {
      setTexto("")
      const novas = await lerChat(ultimoId.current)
      if (novas.length) {
        ultimoId.current = novas[novas.length - 1].id
        setMensagens(antes => [...antes, ...novas].slice(-120))
      }
    }
    setEnviando(false)
  }

  const online = serverStatus?.online ?? false
  const social = config?.social

  const redes: { nome: string; url?: string; discord?: boolean }[] = [
    { nome: "Discord", url: social?.discord, discord: true },
    { nome: "YouTube", url: social?.youtube },
    { nome: "TikTok", url: social?.tiktok },
    { nome: "Instagram", url: social?.instagram },
  ]

  return (
    <div className="space-y-5">
      {/* Cartao do jogador */}
      <section className="overflow-hidden rounded-2xl border border-border bg-card">
        <div className="flex items-center gap-4 p-5">
          {prefs.fotoAvatar ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={prefs.fotoAvatar} alt=""
              className="h-16 w-16 shrink-0 rounded-full object-cover"
              style={{ boxShadow: `0 0 0 2px ${prefs.corAvatar}` }}
            />
          ) : (
            <span
              className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full text-2xl font-bold"
              style={{ background: `${prefs.corAvatar}22`, color: prefs.corAvatar }}
            >
              {prefs.avatar || iniciais(sessao?.nome || sessao?.email || "")}
            </span>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-lg font-bold text-foreground">
              {sessao ? (sessao.nome || sessao.email) : "Você ainda não entrou"}
            </p>
            <p className="truncate text-sm text-muted-foreground">
              {sessao ? sessao.email : "Crie sua conta para levar compras e carreiras para qualquer computador."}
            </p>
            {sessao && (
              <span
                className={cn(
                  "mt-2 inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold",
                  ativado
                    ? "bg-primary/15 text-primary"
                    : "bg-white/[0.06] text-muted-foreground",
                )}
              >
                <ShieldCheck className="h-3 w-3" />
                {ativado ? "Versão completa ativada" : "Versão simples"}
              </span>
            )}
          </div>
          {!sessao ? (
            <button
              onClick={onEntrar}
              className="flex shrink-0 items-center gap-1.5 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground hover:opacity-90"
            >
              <LogIn className="h-4 w-4" /> Entrar
            </button>
          ) : !ativado ? (
            <button
              onClick={onAtivar}
              className="flex shrink-0 items-center gap-1.5 rounded-xl border border-primary/30 bg-primary/10 px-4 py-2.5 text-sm font-bold text-primary hover:bg-primary/20"
            >
              <KeyRound className="h-4 w-4" /> Ativar
            </button>
          ) : null}
        </div>
      </section>

      {sessao && comRede && (
        <div className="flex gap-1 rounded-2xl border border-border bg-card p-1.5">
          {([
            { id: "saguao" as const, nome: "Saguão", icone: MessageCircle, contador: 0 },
            { id: "amigos" as const, nome: "Amigos", icone: UserPlus, contador: avisos.pedidos + avisos.nao_lidas },
          ]).map(item => {
            const Icone = item.icone
            return (
              <button
                key={item.id}
                onClick={() => setVisao(item.id)}
                className={cn(
                  "flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition-colors",
                  visao === item.id ? "bg-primary/12 text-primary" : "text-muted-foreground hover:bg-white/[0.04] hover:text-foreground",
                )}
              >
                <Icone className="h-4 w-4" />{item.nome}
                {item.contador > 0 && (
                  <span className="rounded-full bg-red-500/85 px-1.5 text-[10px] font-black text-white">{item.contador}</span>
                )}
              </button>
            )
          })}
        </div>
      )}

      {sessao && comRede && visao === "amigos" && (
        <AmigosPanel temSessao={!!sessao} comRede={comRede} />
      )}

      {!comRede && (
        <section className="flex items-start gap-3 rounded-2xl border border-accent/25 bg-accent/[0.07] p-5">
          <WifiOff className="mt-0.5 h-5 w-5 shrink-0 text-accent" />
          <div>
            <p className="text-sm font-bold text-foreground">Saguão indisponível offline</p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              Quem está online e a conversa vêm do servidor. Conecte-se (ou volte para o modo
              Online no topo) para ver o saguão. Sua conta e o jogo instalado continuam funcionando.
            </p>
          </div>
        </section>
      )}

      {/* QUEM ESTA ONLINE + CONVERSA. So aparece com sessao: sem conta nao ha como
          identificar ninguem, e uma lista vazia sem explicacao parece defeito. */}
      {sessao && comRede && visao === "saguao" ? (
        <section className="grid gap-4 lg:grid-cols-[240px_1fr]">
          <div className="rounded-2xl border border-border bg-card p-4">
            <p className="mb-2.5 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
              <Users className="h-3.5 w-3.5" /> Online · {naSala.length}
            </p>
            <div className="max-h-72 space-y-1 overflow-y-auto">
              {naSala.length === 0 && (
                <p className="px-1 py-2 text-xs text-muted-foreground">
                  Ninguém mais por aqui agora.
                </p>
              )}
              {naSala.map(j => (
                <div
                  key={j.conta_id}
                  className={cn(
                    "flex items-center gap-2.5 rounded-lg p-2",
                    j.conta_id === eu ? "bg-primary/10" : "hover:bg-white/[0.04]",
                  )}
                >
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-primary/15 text-xs font-bold text-primary">
                    {(j.nome || "?").slice(0, 1).toUpperCase()}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-xs font-semibold text-foreground">
                      {j.nome}
                      {j.conta_id === eu && <span className="text-muted-foreground"> (você)</span>}
                    </span>
                    <span className="block truncate text-[10px] text-primary/70">
                      {j.origem === "launcher" ? "No launcher" : j.detalhe || j.clube || j.situacao || "No Ultrafoot"}
                    </span>
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="flex min-h-[280px] flex-col rounded-2xl border border-border bg-card">
            <p className="flex items-center gap-1.5 border-b border-border px-4 py-3 text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
              <MessageCircle className="h-3.5 w-3.5" /> Conversa
            </p>
            <div className="min-h-0 flex-1 space-y-2.5 overflow-y-auto p-4">
              {mensagens.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  Nenhuma mensagem ainda. Diga oi — quem estiver online vai ver.
                </p>
              )}
              {mensagens.map(m => (
                <div key={m.id} className="text-[13px] leading-snug">
                  <span className={cn("font-bold", m.conta_id === eu ? "text-primary" : "text-foreground")}>
                    {m.nome}
                  </span>
                  <span className="ml-1.5 text-[10px] text-muted-foreground">
                    {new Date(m.quando * 1000).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                  </span>
                  <p className="text-muted-foreground">{m.texto}</p>
                </div>
              ))}
              <div ref={fimDoChat} />
            </div>
            {erroChat && <p className="px-4 pb-1 text-xs text-red-400">{erroChat}</p>}
            <div className="flex gap-2 border-t border-border p-3">
              <input
                value={texto}
                onChange={e => setTexto(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") void mandar() }}
                maxLength={300}
                placeholder="Escreva uma mensagem…"
                className="flex-1 rounded-lg border border-border bg-black/25 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/50"
              />
              <button
                onClick={() => void mandar()}
                disabled={!texto.trim() || enviando}
                className="rounded-lg bg-primary px-3 py-2 text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-35"
                aria-label="Enviar"
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
          </div>
        </section>
      ) : null}

      {/* Estado do FC Hub */}
      <section className="rounded-2xl border border-border bg-card p-5">
        <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-foreground">
          <Users className="h-4 w-4 text-primary" /> FC Hub — modo online
        </h3>
        <div className="flex flex-wrap items-center gap-4">
          {/* Sem rede a gente NAO sabe se o servidor caiu — nao consultamos. Dizer
              "fora do ar" nesse caso jogaria a culpa no servidor errado. */}
          <span
            className={cn(
              "flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold",
              online ? "bg-primary/12 text-primary" : "bg-white/[0.05] text-muted-foreground",
            )}
          >
            {online ? <Wifi className="h-4 w-4" /> : <WifiOff className="h-4 w-4" />}
            {!comRede ? "Sem internet para verificar" : online ? "Servidor no ar" : "Servidor fora do ar"}
          </span>
          {serverStatus?.game_version && (
            <span className="text-xs text-muted-foreground">
              Versão aceita no online:{" "}
              <span className="font-mono text-foreground">v{serverStatus.game_version}</span>
            </span>
          )}
        </div>
        <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
          O campeonato pela internet, o mercado entre amigos e as mensagens ficam dentro do jogo,
          na aba FC Hub. O servidor só aceita clientes na versão indicada acima — por isso, quando
          ela mudar, atualize antes de entrar numa sala.
        </p>
      </section>

      {/* PAINEL DE ADMINISTRACAO. Aparece so para quem e admin — e antes disto o
          endereco nao existia em lugar nenhum da interface, entao a pagina
          existia e ninguem tinha como chegar nela. */}
      {ehAdmin && (
        <section className="rounded-2xl border border-primary/25 bg-primary/[0.05] p-5">
          <h3 className="mb-1 flex items-center gap-2 text-sm font-bold text-foreground">
            <ShieldAlert className="h-4 w-4 text-primary" /> Administração
          </h3>
          <p className="mb-3 text-xs text-muted-foreground">
            Gerenciar contas, banir e consultar o histórico. Entre com este mesmo e-mail e senha.
          </p>
          <button
            onClick={() => onOpen(`${PAINEL}/`)}
            className="flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground hover:opacity-90"
          >
            <ExternalLink className="h-4 w-4" /> Abrir o painel
          </button>
        </section>
      )}

      {/* Comunidade */}
      <section className="rounded-2xl border border-border bg-card p-5">
        <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-foreground">
          <MessageCircle className="h-4 w-4 text-primary" /> Comunidade
        </h3>
        {redes.some(r => r.url) ? (
          <div className="flex flex-wrap gap-2">
            {redes.filter(r => r.url).map(r => (
              <button
                key={r.nome}
                onClick={() => onOpen(r.url!)}
                className="flex items-center gap-1.5 rounded-xl border border-border px-3.5 py-2 text-sm font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
              >
                {r.discord ? <MessageCircle className="h-4 w-4" /> : <ExternalLink className="h-4 w-4" />}
                {r.nome}
              </button>
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            Os canais da comunidade aparecem aqui assim que o launcher conseguir falar com o servidor.
          </p>
        )}
      </section>
    </div>
  )
}
