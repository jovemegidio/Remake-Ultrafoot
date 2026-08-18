"use client"

/**
 * O PAINEL DA DIREITA — quem é você, seus AMIGOS e quem mais está online.
 *
 * ⚠️ POR QUE ELE EXISTE. O launcher mostrava a conta num canto do rodapé da barra
 * lateral e "quem está online" só dentro do FC Hub. Quem abria a Loja, o
 * Changelog ou o Gerenciar perdia as duas coisas de vista — e são justamente as
 * que dizem se dá para jogar com alguém agora.
 *
 * ⚠️ AMIGOS VÊM ANTES DO SAGUÃO, e é isso que separa este painel de uma lista de
 * gente aleatória: é a mesma ordem do Riot e da Epic. Quem você conhece fica em
 * cima, com o que está fazendo agora; os outros técnicos online ficam embaixo,
 * como contexto ("tem gente jogando"), e não como atração principal.
 *
 * ⚠️ E OS NOMES SÃO REAIS. Tudo vem de `lib/hub-store` — a MESMA sondagem que o
 * FC Hub usa; nada é inventado para encher o painel. Sem sessão, sem rede ou sem
 * ninguém online, o painel diz isso em uma linha em vez de mostrar avatares de
 * mentira — um painel social falso é pior que painel nenhum, porque ensina o
 * jogador a não confiar no que está escrito ali.
 *
 * ⚠️ NADA DE COR CHUMBADA. Tudo sai de `var(--primary)` e das variáveis do tema:
 * o launcher tem 20 paletas trocáveis (ver lib/preferencias) e um `#48eed6`
 * escrito aqui ficaria verde-menta num tema vinho.
 */

import { useState } from "react"
import { MessageSquare, UserPlus, Users, WifiOff } from "lucide-react"

import type { Sessao } from "@/lib/auth"
import { desdeQuando, type AmigoDoHub, type JogadorOnline } from "@/lib/hub"
import { abrirConversa, useAmigosDoHub, usePresencaDoHub } from "@/lib/hub-store"
import type { ServerStatus } from "@/lib/launcher-bridge"
import { cn } from "@/lib/utils"
import { AdicionarAmigo } from "./adicionar-amigo"

/** Iniciais para o avatar — duas letras, como o resto do launcher já faz. */
function iniciais(nome: string): string {
  const partes = nome.trim().split(/\s+/).filter(Boolean)
  if (partes.length === 0) return "?"
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase()
  return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase()
}

/** Online diz o que a pessoa está fazendo; offline, há quanto tempo sumiu. */
function estadoDoAmigo(a: AmigoDoHub): string {
  if (!a.online) return desdeQuando(a.visto_em)
  if (a.origem === "launcher") return "No launcher"
  return a.detalhe || a.clube || a.situacao || "No Ultrafoot"
}

export function RailDireita({
  sessao,
  serverStatus,
  comRede,
  onEntrar,
  onAbrirHub,
}: {
  sessao: Sessao | null
  serverStatus: ServerStatus | null
  comRede: boolean
  onEntrar: () => void
  onAbrirHub: () => void
}) {
  const presenca = usePresencaDoHub()
  const painel = useAmigosDoHub()
  const [adicionando, setAdicionando] = useState(false)
  const servidorNoAr = serverStatus?.online ?? false
  const vivo = Boolean(sessao) && comRede && servidorNoAr

  // Amigos primeiro, online no topo. Offline continua na lista de propósito:
  // saber que o amigo esteve aqui "há 2 h" é o que faz alguém deixar uma
  // mensagem em vez de desistir.
  const amigos = vivo
    ? [...painel.amigos].sort((a, b) =>
        Number(b.online) - Number(a.online) || b.visto_em - a.visto_em)
    : []
  const amigosOnline = amigos.filter(a => a.online).length
  const idsAmigos = new Set(amigos.map(a => a.conta_id))
  // O saguão SEM os amigos (eles já estão em cima) e sem você.
  const outros: JogadorOnline[] = vivo
    ? (presenca?.online ?? []).filter(j => j.conta_id !== presenca?.eu && !idsAmigos.has(j.conta_id))
    : []
  const pedidos = presenca?.pedidos ?? painel.recebidos.length

  return (
    <aside className="hidden w-[248px] shrink-0 flex-col border-l border-white/[0.07] bg-card/70 backdrop-blur-xl xl:flex">

      {/* ── Quem é você ── */}
      <div className="flex items-center gap-3 border-b border-white/[0.07] px-4 py-3.5">
        {sessao ? (
          <>
            <div className="relative shrink-0">
              <div className="grid h-9 w-9 place-items-center rounded-lg bg-primary/15 text-[12px] font-bold text-primary ring-1 ring-primary/25">
                {iniciais(sessao.nome || sessao.email)}
              </div>
              <span
                className={cn(
                  "absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full ring-2 ring-card",
                  servidorNoAr ? "bg-primary" : "bg-white/25",
                )}
              />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-semibold text-foreground">{sessao.nome || sessao.email}</p>
              {sessao.ativado ? (
                <span className="mt-0.5 inline-flex h-4 items-center rounded-full bg-primary/12 px-2 text-[9px] font-bold uppercase tracking-wider text-primary ring-1 ring-primary/25">
                  Edição liberada
                </span>
              ) : (
                <span className="text-[10.5px] text-muted-foreground">Conta gratuita</span>
              )}
            </div>
          </>
        ) : (
          <button
            onClick={onEntrar}
            className="flex w-full items-center gap-3 rounded-lg px-1 py-1 text-left transition-colors hover:bg-white/[0.04]"
          >
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-white/[0.05] text-[12px] font-bold text-muted-foreground">?</div>
            <div className="min-w-0">
              <p className="text-[13px] font-semibold text-foreground">Entrar</p>
              <p className="text-[10.5px] text-muted-foreground">Ative e jogue em qualquer PC</p>
            </div>
          </button>
        )}
      </div>

      {/* ── Amigos ── */}
      <div className="flex items-center justify-between px-4 pb-2 pt-4">
        <div className="flex items-baseline gap-2">
          <span className="text-[12.5px] font-semibold text-foreground">Amigos</span>
          {amigos.length > 0 && (
            <span className="text-[11px] text-muted-foreground">{amigosOnline}/{amigos.length} online</span>
          )}
        </div>
        {vivo && (
          <button
            onClick={() => setAdicionando(true)}
            className="relative rounded-md p-1 text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary"
            title="Adicionar amigo"
            aria-label="Adicionar amigo"
          >
            <UserPlus className="h-4 w-4" />
            {/* Pedido esperando resposta: o convite chega enquanto a pessoa faz
                outra coisa, e sem este ponto ninguém descobre. */}
            {pedidos > 0 && (
              <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-red-500 ring-2 ring-card" />
            )}
          </button>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
        {/* Cada estado diz a VERDADE do porquê a lista está vazia. "0 online"
            para quem está sem internet seria mentira com cara de dado. */}
        {!sessao ? (
          <p className="px-2 py-3 text-[11.5px] leading-relaxed text-muted-foreground">
            Entre na sua conta para ver seus amigos e quem está jogando agora.
          </p>
        ) : !comRede ? (
          <p className="flex items-center gap-2 px-2 py-3 text-[11.5px] text-muted-foreground">
            <WifiOff className="h-3.5 w-3.5" /> Sem internet.
          </p>
        ) : !servidorNoAr ? (
          <p className="px-2 py-3 text-[11.5px] leading-relaxed text-muted-foreground">
            O servidor está fora do ar. O jogo funciona normalmente offline.
          </p>
        ) : (
          <>
            {amigos.length === 0 && (
              <button
                onClick={() => setAdicionando(true)}
                className="w-full rounded-lg border border-dashed border-border px-2 py-3 text-left text-[11.5px] leading-relaxed text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
              >
                Você ainda não tem amigos aqui. Clique para adicionar pelo código —
                o seu fica dentro desta janela.
              </button>
            )}

            <ul className="flex flex-col gap-0.5">
              {amigos.map(a => (
                <li key={a.conta_id}>
                  <button
                    onClick={() => abrirConversa(a.conta_id)}
                    title={`Conversar com ${a.nome}`}
                    className="group flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-white/[0.05]"
                  >
                    <div className="relative shrink-0">
                      <div className={cn(
                        "grid h-7 w-7 place-items-center rounded-lg bg-white/[0.06] text-[10px] font-bold text-foreground/80",
                        !a.online && "opacity-50",
                      )}>
                        {iniciais(a.nome)}
                      </div>
                      <span className={cn(
                        "absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full ring-2 ring-card",
                        a.online ? "bg-primary" : "bg-white/20",
                      )} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className={cn(
                        "truncate text-[11.5px] font-medium",
                        a.online ? "text-foreground" : "text-muted-foreground",
                      )}>
                        {a.nome}
                      </p>
                      <p className="truncate text-[10px] text-muted-foreground">{estadoDoAmigo(a)}</p>
                    </div>
                    {a.nao_lidas > 0 ? (
                      <span className="shrink-0 rounded-full bg-red-500/90 px-1.5 text-[10px] font-bold text-white">
                        {a.nao_lidas}
                      </span>
                    ) : (
                      <MessageSquare className="h-3.5 w-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                    )}
                  </button>
                </li>
              ))}
            </ul>

            {/* ── Outros técnicos online (o saguão) ── */}
            {outros.length > 0 && (
              <>
                <p className="flex items-center gap-1.5 px-2 pb-1 pt-4 text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
                  <Users className="h-3 w-3" /> Também online · {outros.length}
                </p>
                <ul className="flex flex-col gap-0.5">
                  {outros.slice(0, 12).map(j => (
                    <li key={j.conta_id}>
                      <button
                        onClick={onAbrirHub}
                        title="Abrir o FC Hub"
                        className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-white/[0.05]"
                      >
                        <div className="relative shrink-0">
                          <div className="grid h-7 w-7 place-items-center rounded-lg bg-white/[0.04] text-[10px] font-bold text-muted-foreground">
                            {iniciais(j.nome)}
                          </div>
                          <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-primary/60 ring-2 ring-card" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[11.5px] text-muted-foreground">{j.nome}</p>
                          <p className="truncate text-[10px] text-muted-foreground/70">
                            {j.origem === "launcher" ? "No launcher" : j.detalhe || j.clube || j.situacao || "Online"}
                          </p>
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            )}

            {amigos.length > 0 && amigosOnline === 0 && outros.length === 0 && (
              <p className="px-2 py-3 text-[11.5px] leading-relaxed text-muted-foreground">
                Ninguém online neste momento. Deixe uma mensagem — ela espera.
              </p>
            )}
          </>
        )}
      </div>

      {/* ── Estado do servidor ── */}
      <div className="border-t border-white/[0.07] px-4 py-2.5">
        <button
          onClick={onAbrirHub}
          className="flex w-full items-center justify-between text-[11px] text-muted-foreground transition-colors hover:text-foreground"
        >
          <span className="flex items-center gap-1.5">
            <span className={cn("h-1.5 w-1.5 rounded-full", servidorNoAr ? "bg-primary" : "bg-white/25")} />
            {!comRede ? "Sem internet" : servidorNoAr ? "Servidor no ar" : "Servidor fora do ar"}
          </span>
          <span className="font-medium text-primary">FC Hub</span>
        </button>
      </div>

      {adicionando && <AdicionarAmigo onFechar={() => setAdicionando(false)} />}
    </aside>
  )
}
