"use client"

/**
 * ADICIONAR AMIGO — o diálogo do "+" do painel da direita.
 *
 * ⚠️ O CÓDIGO DE AMIGO É O CAMINHO PRINCIPAL, e é assim que os launchers grandes
 * fazem: ninguém troca e-mail para jogar junto. Cada conta tem um código curto
 * (`7KM2-49XB`) que a pessoa cola no grupo do WhatsApp ou dita por voz — e o
 * alfabeto não tem I, L, O nem U justamente para não haver "é i ou 1?".
 *
 * O e-mail continua funcionando (casa EXATO, no servidor) para quem já sabe o do
 * amigo, e a busca por nome existe para quem não sabe nem uma coisa nem outra.
 *
 * Os pedidos recebidos aparecem AQUI DENTRO: quem abre "adicionar amigo" muitas
 * vezes está justo respondendo ao convite que acabou de receber, e mandá-la para
 * outra aba para isso é um passo a mais sem motivo.
 */

import { useEffect, useState } from "react"
import { Check, Copy, Loader2, Search, UserPlus, X } from "lucide-react"

import {
  buscarPessoas, meuPerfil, pedirAmizade, responderPedido,
  type PerfilDoHub, type PessoaEncontrada,
} from "@/lib/hub"
import { recarregarHub, useAmigosDoHub } from "@/lib/hub-store"
import { cn } from "@/lib/utils"

export function AdicionarAmigo({ onFechar }: { onFechar: () => void }) {
  const painel = useAmigosDoHub()
  const [perfil, setPerfil] = useState<PerfilDoHub | null>(null)
  const [copiado, setCopiado] = useState(false)
  const [termo, setTermo] = useState("")
  const [achados, setAchados] = useState<PessoaEncontrada[]>([])
  const [buscando, setBuscando] = useState(false)
  const [aviso, setAviso] = useState("")

  useEffect(() => { void meuPerfil().then(setPerfil) }, [])

  // Busca com respiro: uma consulta por tecla digitada seria uma rajada.
  useEffect(() => {
    const limpo = termo.trim()
    if (limpo.length < 3) { setAchados([]); setBuscando(false); return }
    let vivo = true
    setBuscando(true)
    const t = window.setTimeout(async () => {
      const pessoas = await buscarPessoas(limpo)
      if (!vivo) return
      setAchados(pessoas)
      setBuscando(false)
    }, 400)
    return () => { vivo = false; window.clearTimeout(t) }
  }, [termo])

  const convidar = async (alvo: { conta_id?: number; codigo?: string; email?: string }) => {
    const problema = await pedirAmizade(alvo)
    setAviso(problema || "Pedido enviado. Ele aparece para a outra pessoa no FC Hub.")
    await recarregarHub()
    if (termo.trim().length >= 3) setAchados(await buscarPessoas(termo.trim()))
  }

  const copiar = async () => {
    if (!perfil?.codigo_amigo) return
    try {
      await navigator.clipboard.writeText(perfil.codigo_amigo)
      setCopiado(true)
      window.setTimeout(() => setCopiado(false), 1800)
    } catch {
      // Área de transferência bloqueada: o código está na tela para copiar à mão.
    }
  }

  // Um código digitado inteiro pode ser enviado direto, sem esperar a busca —
  // é o caso mais comum e o que dá menos passos.
  const pareceCodigo = /^[0-9a-zA-Z]{4}-?[0-9a-zA-Z]{4}$/.test(termo.trim())
  const pareceEmail = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(termo.trim())

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4" onClick={onFechar}>
      <div
        onClick={e => e.stopPropagation()}
        className="w-full max-w-md overflow-hidden rounded-2xl border border-border bg-card shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
          <h3 className="flex items-center gap-2 text-sm font-bold text-foreground">
            <UserPlus className="h-4 w-4 text-primary" /> Adicionar amigo
          </h3>
          <button onClick={onFechar} className="rounded p-1 text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4 p-5">
          {/* O SEU código, para dar a alguém. */}
          <div className="rounded-xl border border-primary/25 bg-primary/[0.06] p-3.5">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
              Seu código de amigo
            </p>
            <div className="mt-1.5 flex items-center gap-2">
              <span className="font-mono text-lg font-bold tracking-[0.18em] text-primary">
                {perfil?.codigo_amigo || "————-————"}
              </span>
              <button
                onClick={() => void copiar()}
                disabled={!perfil?.codigo_amigo}
                className="ml-auto flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-[11px] font-semibold text-muted-foreground hover:text-foreground disabled:opacity-40"
              >
                {copiado ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                {copiado ? "Copiado" : "Copiar"}
              </button>
            </div>
            <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
              Passe este código para quem quiser te adicionar. Ele não muda e não revela seu e-mail.
            </p>
          </div>

          {/* O código (ou nome/e-mail) DO OUTRO. */}
          <div>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <input
                  autoFocus
                  value={termo}
                  onChange={e => { setTermo(e.target.value); setAviso("") }}
                  onKeyDown={e => {
                    if (e.key !== "Enter") return
                    if (pareceCodigo) void convidar({ codigo: termo.trim() })
                    else if (pareceEmail) void convidar({ email: termo.trim() })
                  }}
                  placeholder="Código do amigo, e-mail ou nome"
                  className="w-full rounded-lg border border-border bg-black/25 py-2 pl-8 pr-3 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/50"
                />
              </div>
              {(pareceCodigo || pareceEmail) && (
                <button
                  onClick={() => void convidar(pareceCodigo ? { codigo: termo.trim() } : { email: termo.trim() })}
                  className="shrink-0 rounded-lg bg-primary px-3.5 text-[12px] font-bold text-primary-foreground hover:opacity-90"
                >
                  Enviar
                </button>
              )}
            </div>
            {aviso && <p className="mt-2 text-[11.5px] text-muted-foreground">{aviso}</p>}
          </div>

          {buscando && (
            <p className="flex items-center gap-2 text-[11.5px] text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Procurando…
            </p>
          )}
          {!buscando && termo.trim().length >= 3 && achados.length === 0 && !pareceEmail && (
            <p className="text-[11.5px] text-muted-foreground">Ninguém encontrado.</p>
          )}

          <div className="space-y-1.5">
            {achados.map(p => (
              <div key={p.conta_id} className="flex items-center gap-2.5 rounded-lg bg-white/[0.03] p-2">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-primary/15 text-[11px] font-bold text-primary">
                  {(p.nome || "?").slice(0, 1).toUpperCase()}
                </span>
                <p className="min-w-0 flex-1 truncate text-[12.5px] font-semibold text-foreground">{p.nome}</p>
                {p.relacao === "amigo" && <span className="text-[11px] text-emerald-400">já é amigo</span>}
                {p.relacao === "enviado" && <span className="text-[11px] text-muted-foreground">convite enviado</span>}
                {p.relacao === "recebido" && (
                  <button
                    onClick={async () => { await responderPedido(p.conta_id, true); await recarregarHub() }}
                    className="rounded-lg bg-primary px-2.5 py-1.5 text-[11px] font-bold text-primary-foreground"
                  >
                    Aceitar
                  </button>
                )}
                {p.relacao === "nenhuma" && (
                  <button
                    onClick={() => void convidar({ conta_id: p.conta_id })}
                    className="rounded-lg border border-primary/40 px-2.5 py-1.5 text-[11px] font-bold text-primary hover:bg-primary/10"
                  >
                    Adicionar
                  </button>
                )}
              </div>
            ))}
          </div>

          {/* Pedidos recebidos, no mesmo lugar. */}
          {painel.recebidos.length > 0 && (
            <div className="border-t border-border pt-3">
              <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
                Esperando sua resposta · {painel.recebidos.length}
              </p>
              <div className="space-y-1.5">
                {painel.recebidos.map(p => (
                  <div key={p.conta_id} className="flex items-center gap-2.5 rounded-lg bg-white/[0.03] p-2">
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-primary/15 text-[11px] font-bold text-primary">
                      {(p.nome || "?").slice(0, 1).toUpperCase()}
                    </span>
                    <p className="min-w-0 flex-1 truncate text-[12.5px] font-semibold text-foreground">{p.nome}</p>
                    <button
                      onClick={async () => { await responderPedido(p.conta_id, true); await recarregarHub() }}
                      className={cn("rounded-lg bg-primary px-2.5 py-1.5 text-[11px] font-bold text-primary-foreground")}
                    >
                      Aceitar
                    </button>
                    <button
                      onClick={async () => { await responderPedido(p.conta_id, false); await recarregarHub() }}
                      className="rounded-lg border border-border px-2.5 py-1.5 text-[11px] font-semibold text-muted-foreground hover:text-foreground"
                    >
                      Recusar
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
