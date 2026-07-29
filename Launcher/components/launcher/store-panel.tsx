"use client"

import { useCallback, useEffect, useState } from "react"
import { cn } from "@/lib/utils"
import { ShoppingBag, Check, Loader2, Wallet, Palette, Banknote, LogIn, Info } from "lucide-react"
import { sessaoSalva } from "@/lib/auth"

/**
 * LOJA DO LAUNCHER.
 *
 * O catálogo vem do SERVIDOR, não daqui: assim dá para corrigir preço ou tirar
 * um item do ar sem publicar versão nova para todo mundo.
 *
 * ⚠️ NÃO HÁ MEIO DE PAGAMENTO LIGADO AINDA. O saldo entra por crédito
 * administrativo. Ligar um provedor (Mercado Pago, Stripe) precisa de conta e
 * chaves do dono do jogo; a loja já está pronta para receber esse passo — o que
 * falta é só a rota que confirma o pagamento e chama o mesmo `creditar`.
 */

const BASE = "https://ultrafoot.179-198-103-30.sslip.io/auth"

interface ItemDaLoja {
  id: string
  nome: string
  tipo: string
  descricao: string
  preco_cents: number
  carga?: Record<string, unknown>
}

interface EstadoDaLoja {
  catalogo: ItemDaLoja[]
  saldo_cents: number
  meus_itens: { produto: string; valor_cents: number; criada_em: number }[]
}

const emReais = (cents: number) =>
  (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })

const ICONE: Record<string, typeof Palette> = {
  tema_launcher: Palette,
  verba: Banknote,
}

export function StorePanel({ onEntrar }: { onEntrar: () => void }) {
  const [dados, setDados] = useState<EstadoDaLoja | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [comprando, setComprando] = useState("")
  const [erro, setErro] = useState("")
  const [aviso, setAviso] = useState("")
  const temSessao = !!sessaoSalva()

  const carregar = useCallback(async () => {
    const s = sessaoSalva()
    if (!s) { setCarregando(false); return }
    try {
      const r = await fetch(`${BASE}/loja`, { headers: { Authorization: `Bearer ${s.token}` } })
      if (r.ok) setDados(await r.json() as EstadoDaLoja)
      else setErro("não consegui carregar a loja agora")
    } catch {
      setErro("sem conexão com o servidor")
    } finally {
      setCarregando(false)
    }
  }, [])

  useEffect(() => { void carregar() }, [carregar])

  const comprar = async (item: ItemDaLoja) => {
    const s = sessaoSalva()
    if (!s || comprando) return
    setComprando(item.id)
    setErro("")
    setAviso("")
    try {
      const r = await fetch(`${BASE}/loja/comprar`, {
        method: "POST",
        headers: { Authorization: `Bearer ${s.token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ produto: item.id }),
      })
      const d = await r.json().catch(() => ({})) as { erro?: string; saldo_cents?: number }
      if (r.ok) {
        setAviso(`${item.nome} adicionado à sua conta.`)
        await carregar()
      } else if (r.status === 402) {
        setErro(`Saldo insuficiente: você tem ${emReais(d.saldo_cents ?? 0)} e o item custa ${emReais(item.preco_cents)}.`)
      } else {
        setErro(d.erro || "não foi possível concluir a compra")
      }
    } catch {
      setErro("sem conexão com o servidor")
    } finally {
      setComprando("")
    }
  }

  if (!temSessao) {
    return (
      <section className="rounded-2xl border border-border bg-card p-8 text-center">
        <ShoppingBag className="mx-auto mb-3 h-7 w-7 text-muted-foreground" />
        <p className="text-base font-semibold text-foreground">Entre para ver a loja</p>
        <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
          As compras ficam na sua conta e acompanham você em qualquer computador.
        </p>
        <button
          onClick={onEntrar}
          className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground hover:opacity-90"
        >
          <LogIn className="h-4 w-4" /> Entrar
        </button>
      </section>
    )
  }

  if (carregando) {
    return (
      <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Carregando a loja…
      </div>
    )
  }

  const comprados = new Set((dados?.meus_itens ?? []).map(m => m.produto))

  return (
    <div className="space-y-5">
      <section className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-border bg-card p-5">
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-full bg-primary/12 text-primary">
            <Wallet className="h-5 w-5" />
          </span>
          <div>
            <p className="text-xs text-muted-foreground">Seu saldo</p>
            <p className="text-2xl font-bold text-foreground">{emReais(dados?.saldo_cents ?? 0)}</p>
          </div>
        </div>
        {/* Honestidade com o jogador: nao ha botao de recarga porque nao ha
            pagamento ligado. Um botao que nao cobra nada seria pior. */}
        <p className="flex max-w-sm items-start gap-2 text-xs text-muted-foreground">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          A recarga com cartão ou Pix ainda não está ligada. Por enquanto o saldo é
          creditado pela administração.
        </p>
      </section>

      {erro && <p className="rounded-xl border border-red-500/25 bg-red-500/10 px-4 py-3 text-sm text-red-400">{erro}</p>}
      {aviso && <p className="rounded-xl border border-primary/25 bg-primary/10 px-4 py-3 text-sm text-primary">{aviso}</p>}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {(dados?.catalogo ?? []).map(item => {
          const Icone = ICONE[item.tipo] ?? ShoppingBag
          const jaTem = comprados.has(item.id) && item.tipo === "tema_launcher"
          return (
            <article
              key={item.id}
              className="flex flex-col overflow-hidden rounded-2xl border border-border bg-card transition-colors hover:border-primary/30"
            >
              <div className="flex h-28 items-center justify-center bg-primary/[0.06]">
                <Icone className="h-9 w-9 text-primary" />
              </div>
              <div className="flex flex-1 flex-col p-4">
                <h3 className="text-sm font-bold text-foreground">{item.nome}</h3>
                <p className="mt-1 flex-1 text-xs leading-relaxed text-muted-foreground">
                  {item.descricao}
                </p>
                <div className="mt-4 flex items-center justify-between gap-3">
                  <span className="text-lg font-bold text-foreground">{emReais(item.preco_cents)}</span>
                  {jaTem ? (
                    <span className="flex items-center gap-1.5 rounded-lg bg-primary/12 px-3 py-2 text-xs font-bold text-primary">
                      <Check className="h-3.5 w-3.5" /> Você tem
                    </span>
                  ) : (
                    <button
                      onClick={() => void comprar(item)}
                      disabled={!!comprando}
                      className={cn(
                        "flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 text-xs font-bold text-primary-foreground",
                        "transition-opacity hover:opacity-90 disabled:opacity-40",
                      )}
                    >
                      {comprando === item.id
                        ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        : <ShoppingBag className="h-3.5 w-3.5" />}
                      Comprar
                    </button>
                  )}
                </div>
              </div>
            </article>
          )
        })}
      </div>

      {(dados?.meus_itens?.length ?? 0) > 0 && (
        <section className="rounded-2xl border border-border bg-card p-5">
          <h3 className="mb-3 text-sm font-bold text-foreground">Suas compras</h3>
          <div className="space-y-1.5">
            {dados!.meus_itens.map((m, i) => (
              <div key={`${m.produto}-${i}`} className="flex items-center justify-between text-xs">
                <span className="text-foreground">
                  {dados!.catalogo.find(c => c.id === m.produto)?.nome ?? m.produto}
                </span>
                <span className="text-muted-foreground">
                  {emReais(m.valor_cents)} · {new Date(m.criada_em * 1000).toLocaleDateString("pt-BR")}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
