"use client"

import { useCallback, useEffect, useState } from "react"
import { cn } from "@/lib/utils"
import {
  ShoppingBag, Check, Loader2, Wallet, Palette, Banknote, LogIn, Info,
  KeyRound, QrCode, Copy, X, RefreshCw, WifiOff,
} from "lucide-react"
import { sessaoSalva } from "@/lib/auth"

/**
 * LOJA DO LAUNCHER.
 *
 * O catálogo vem do SERVIDOR, não daqui: assim dá para corrigir preço ou tirar
 * um item do ar sem publicar versão nova para todo mundo.
 *
 * PAGAMENTO: Asaas, por Pix. O registro do jogo é pago direto (é o produto
 * principal); os demais itens saem do saldo da carteira.
 *
 * A liberação NÃO acontece no clique — acontece quando o Asaas confirma o
 * recebimento, pelo webhook do servidor. Por isso o modal fica esperando e
 * oferece "já paguei — verificar", em vez de dizer "pronto" antes da hora.
 *
 * `pagamento_ligado` vem do servidor: quando as chaves do Asaas ainda não estão
 * configuradas, o botão fica desabilitado com a explicação em vez de gerar uma
 * cobrança que falharia.
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
  pedidos_pendentes: { id: number; produto: string; valor_cents: number; criado_em: number }[]
  ativado: boolean
  /** false = o servidor ainda não tem as chaves do Asaas. */
  pagamento_ligado: boolean
}

interface Cobranca {
  pedido: number
  link?: string
  pix_copia_e_cola?: string
  pix_qr_base64?: string
  valor_cents: number
  item: ItemDaLoja
}

const emReais = (cents: number) =>
  (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })

const ICONE: Record<string, typeof Palette> = {
  registro: KeyRound,
  tema_launcher: Palette,
  verba: Banknote,
}

export function StorePanel({ onEntrar, online = true }: {
  onEntrar: () => void
  /** false = sem rede (ou modo offline). A loja é 100% servidor: offline ela diz
   *  isso, em vez de ficar girando num fetch que não vai voltar. */
  online?: boolean
}) {
  const [dados, setDados] = useState<EstadoDaLoja | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [comprando, setComprando] = useState("")
  const [erro, setErro] = useState("")
  const [aviso, setAviso] = useState("")
  const [cobranca, setCobranca] = useState<Cobranca | null>(null)
  const [copiado, setCopiado] = useState(false)
  const temSessao = !!sessaoSalva()

  const carregar = useCallback(async () => {
    const s = sessaoSalva()
    if (!s) { setCarregando(false); return }
    if (!online) { setCarregando(false); return }
    try {
      const r = await fetch(`${BASE}/loja`, { headers: { Authorization: `Bearer ${s.token}` } })
      if (r.ok) setDados(await r.json() as EstadoDaLoja)
      else setErro("não consegui carregar a loja agora")
    } catch {
      setErro("sem conexão com o servidor")
    } finally {
      setCarregando(false)
    }
  }, [online])

  // Recarrega quando a rede volta: sem isto a loja ficava vazia até trocar de aba.
  useEffect(() => { void carregar() }, [carregar])

  /**
   * Abre a cobrança no Asaas. A entrega NÃO acontece aqui — o servidor só libera
   * quando o Asaas confirma o recebimento. Por isso a tela fica esperando e
   * reconsulta, em vez de dizer "pronto" no clique.
   */
  const pagar = async (item: ItemDaLoja) => {
    const s = sessaoSalva()
    if (!s || comprando) return
    setComprando(item.id)
    setErro("")
    setAviso("")
    try {
      const r = await fetch(`${BASE}/loja/pagar`, {
        method: "POST",
        headers: { Authorization: `Bearer ${s.token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ produto: item.id, forma: "PIX" }),
      })
      const d = await r.json().catch(() => ({})) as Partial<Cobranca> & { erro?: string }
      if (r.ok && d.pedido) setCobranca({ ...(d as Cobranca), item })
      else setErro(d.erro || "não foi possível gerar a cobrança")
    } catch {
      setErro("sem conexão com o servidor")
    } finally {
      setComprando("")
    }
  }

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

  if (!online) {
    return (
      <section className="rounded-2xl border border-border bg-card p-8 text-center">
        <WifiOff className="mx-auto mb-3 h-7 w-7 text-accent" />
        <p className="text-base font-semibold text-foreground">Loja indisponível offline</p>
        <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
          O catálogo e o pagamento por Pix vêm do servidor. Conecte-se para comprar — o que
          você já tem na conta continua valendo no jogo, com ou sem internet.
        </p>
      </section>
    )
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
      {cobranca && (
        <div
          className="fixed inset-0 z-[160] flex items-center justify-center bg-black/75 p-5 backdrop-blur"
          onClick={() => setCobranca(null)}
        >
          <div
            className="w-full max-w-sm rounded-2xl border border-border bg-card p-6 text-center"
            onClick={e => e.stopPropagation()}
          >
            <button
              onClick={() => setCobranca(null)}
              className="float-right -mr-2 -mt-2 rounded-lg p-1.5 text-muted-foreground hover:bg-white/10 hover:text-foreground"
              aria-label="Fechar"
            >
              <X className="h-4 w-4" />
            </button>
            <h3 className="text-base font-bold text-foreground">{cobranca.item.nome}</h3>
            <p className="mt-0.5 text-sm text-muted-foreground">{emReais(cobranca.valor_cents)}</p>

            {cobranca.pix_qr_base64 ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={`data:image/png;base64,${cobranca.pix_qr_base64}`}
                alt="QR Code do Pix"
                className="mx-auto my-4 h-48 w-48 rounded-xl bg-white p-2"
              />
            ) : (
              <div className="my-6 flex items-center justify-center gap-2 text-sm text-muted-foreground">
                <QrCode className="h-4 w-4" /> QR Code indisponível — use o link abaixo.
              </div>
            )}

            {cobranca.pix_copia_e_cola && (
              <button
                onClick={() => {
                  void navigator.clipboard.writeText(cobranca.pix_copia_e_cola!)
                  setCopiado(true)
                  window.setTimeout(() => setCopiado(false), 2000)
                }}
                className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-border py-2.5 text-xs font-semibold text-foreground hover:bg-white/[0.05]"
              >
                {copiado ? <Check className="h-3.5 w-3.5 text-primary" /> : <Copy className="h-3.5 w-3.5" />}
                {copiado ? "Código copiado" : "Copiar código Pix"}
              </button>
            )}

            {cobranca.link && (
              <p className="mt-3 text-[11px] text-muted-foreground">
                Prefere cartão ou boleto?{" "}
                <button
                  onClick={() => window.open(cobranca.link, "_blank")}
                  className="text-primary underline underline-offset-2"
                >
                  abrir a fatura
                </button>
              </p>
            )}

            {/* O jogador precisa saber que a liberacao nao e no clique: ela
                depende da confirmacao do banco, que leva alguns segundos. */}
            <p className="mt-4 text-[11px] leading-relaxed text-muted-foreground">
              Assim que o pagamento for confirmado, sua conta é liberada automaticamente.
              Pode levar alguns segundos.
            </p>
            <button
              onClick={() => void carregar()}
              className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl bg-primary py-2.5 text-xs font-bold text-primary-foreground hover:opacity-90"
            >
              <RefreshCw className="h-3.5 w-3.5" /> Já paguei — verificar
            </button>
          </div>
        </div>
      )}

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
          {dados?.pagamento_ligado
            ? "O registro é pago por Pix, na hora. Os demais itens usam o saldo da carteira."
            : "O pagamento ainda não está configurado neste servidor. Por enquanto o saldo é creditado pela administração."}
        </p>
      </section>

      {erro && <p className="rounded-xl border border-red-500/25 bg-red-500/10 px-4 py-3 text-sm text-red-400">{erro}</p>}
      {aviso && <p className="rounded-xl border border-primary/25 bg-primary/10 px-4 py-3 text-sm text-primary">{aviso}</p>}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {(dados?.catalogo ?? []).map(item => {
          const Icone = ICONE[item.tipo] ?? ShoppingBag
          // O registro nao vem de `compras`: quem manda e o `ativado` da conta,
          // porque ele pode ter vindo de um codigo digitado, nao de uma compra.
          const jaTem = item.tipo === "registro"
            ? !!dados?.ativado
            : comprados.has(item.id) && item.tipo === "tema_launcher"
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
                  ) : item.tipo === "registro" ? (
                    <button
                      onClick={() => void pagar(item)}
                      disabled={!!comprando || !dados?.pagamento_ligado}
                      title={dados?.pagamento_ligado ? undefined : "pagamento ainda não configurado"}
                      className={cn(
                        "flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 text-xs font-bold text-primary-foreground",
                        "transition-opacity hover:opacity-90 disabled:opacity-40",
                      )}
                    >
                      {comprando === item.id
                        ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        : <QrCode className="h-3.5 w-3.5" />}
                      Pagar com Pix
                    </button>
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
