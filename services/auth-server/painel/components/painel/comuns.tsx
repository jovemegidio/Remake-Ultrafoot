'use client'

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { AlertTriangle, ArrowDownRight, ArrowUpRight, Loader2, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { chamar, ErroDeSessao, type Eu } from '@/lib/api'
import { formatarNumero, variacao } from '@/lib/formato'

// ─── Contexto ────────────────────────────────────────────────────────────────
//
// A sessao pode cair a qualquer momento (expirou, o admin foi despromovido, o
// servidor reiniciou). Quando isso acontece em QUALQUER tela, o painel inteiro
// tem de voltar ao login — deixar a tela quebrada com "falha" e o caminho curto
// para o operador achar que o servidor caiu.

type Painel = { eu: Eu; encerrarSessao: (motivo: string) => void }

export const ContextoDoPainel = createContext<Painel | null>(null)

export function usarPainel(): Painel {
  const painel = useContext(ContextoDoPainel)
  if (!painel) throw new Error('fora do painel')
  return painel
}

// ─── Carregamento de dados ───────────────────────────────────────────────────

export type Carga<T> = {
  dados: T | null
  carregando: boolean
  erro: string
  recarregar: () => void
}

/**
 * Busca uma rota do painel e mantem o resultado.
 *
 * `intervalo` (segundos) religa a busca sozinha — usado nas telas que mostram
 * estado do agora (quem esta online, chat). Sem isso a tela envelhece em
 * silencio e passa a mentir.
 */
export function usarDados<T>(
  rota: string,
  corpo: Record<string, unknown> = {},
  intervalo = 0,
): Carga<T> {
  const { encerrarSessao } = usarPainel()
  const [dados, setDados] = useState<T | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')
  const [gatilho, setGatilho] = useState(0)
  const chaveDoCorpo = JSON.stringify(corpo)
  // Guarda o pedido mais recente: resposta de busca antiga chegando depois da
  // nova sobrescreveria a lista com o resultado errado.
  const pedido = useRef(0)

  useEffect(() => {
    const meu = ++pedido.current
    let vivo = true
    setCarregando(true)
    chamar<T>(rota, JSON.parse(chaveDoCorpo))
      .then((resposta) => {
        if (!vivo || meu !== pedido.current) return
        setDados(resposta)
        setErro('')
      })
      .catch((e: Error) => {
        if (!vivo || meu !== pedido.current) return
        if (e instanceof ErroDeSessao) return encerrarSessao(e.message)
        setErro(e.message)
      })
      .finally(() => {
        if (vivo && meu === pedido.current) setCarregando(false)
      })
    return () => {
      vivo = false
    }
  }, [rota, chaveDoCorpo, gatilho, encerrarSessao])

  useEffect(() => {
    if (!intervalo) return
    const id = window.setInterval(() => setGatilho((n) => n + 1), intervalo * 1000)
    return () => window.clearInterval(id)
  }, [intervalo])

  const recarregar = useCallback(() => setGatilho((n) => n + 1), [])
  return { dados, carregando, erro, recarregar }
}

/** Executa uma acao (banir, creditar...) tratando sessao caida do mesmo jeito. */
export function usarAcao() {
  const { encerrarSessao } = usarPainel()
  const [ocupado, setOcupado] = useState(false)

  const executar = useCallback(
    async (rota: string, corpo: Record<string, unknown>): Promise<string> => {
      setOcupado(true)
      try {
        await chamar(rota, corpo)
        return ''
      } catch (e) {
        if (e instanceof ErroDeSessao) {
          encerrarSessao(e.message)
          return e.message
        }
        return (e as Error).message
      } finally {
        setOcupado(false)
      }
    },
    [encerrarSessao],
  )

  return { executar, ocupado }
}

// ─── Pecas visuais repetidas ─────────────────────────────────────────────────

export function CabecalhoDaTela({
  titulo,
  descricao,
  acao,
}: {
  titulo: string
  descricao: string
  acao?: React.ReactNode
}) {
  return (
    <section className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
      <div className="flex flex-col gap-1">
        <p className="text-sm text-muted-foreground">Central de operações</p>
        <h1 className="text-balance text-3xl font-semibold tracking-tight">{titulo}</h1>
        <p className="text-pretty text-sm text-muted-foreground">{descricao}</p>
      </div>
      {acao}
    </section>
  )
}

export function BotaoRecarregar({ carga }: { carga: Carga<unknown> }) {
  return (
    <Button variant="outline" size="sm" onClick={carga.recarregar} disabled={carga.carregando}>
      <RefreshCw className={carga.carregando ? 'animate-spin' : undefined} data-icon="inline-start" />
      Atualizar
    </Button>
  )
}

export function Estado({ carga, children }: { carga: Carga<unknown>; children: React.ReactNode }) {
  if (carga.erro) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
          <AlertTriangle className="size-6 text-destructive" />
          <p className="text-sm font-medium">Não foi possível carregar</p>
          <p className="max-w-md text-sm text-muted-foreground">{carga.erro}</p>
          <Button variant="outline" size="sm" onClick={carga.recarregar}>
            Tentar de novo
          </Button>
        </CardContent>
      </Card>
    )
  }
  if (!carga.dados && carga.carregando) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Carregando...
        </CardContent>
      </Card>
    )
  }
  if (!carga.dados) return null
  return <>{children}</>
}

export function Vazio({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-4 py-12 text-center text-sm text-muted-foreground">{children}</div>
  )
}

export function Indicador({
  icone: Icone,
  rotulo,
  valor,
  detalhe,
  hoje,
  ontem,
}: {
  icone: React.ComponentType<{ className?: string }>
  rotulo: string
  valor: string
  detalhe?: string
  hoje?: number
  ontem?: number
}) {
  const delta = hoje === undefined || ontem === undefined ? null : variacao(hoje, ontem)
  return (
    <Card>
      <CardContent className="flex items-start justify-between gap-3 p-5">
        <div className="flex min-w-0 flex-col gap-2">
          <p className="text-sm text-muted-foreground">{rotulo}</p>
          <p className="truncate text-3xl font-semibold tracking-tight">{valor}</p>
          {delta !== null ? (
            <span
              className={`flex items-center gap-1 text-xs ${delta >= 0 ? 'text-primary' : 'text-destructive'}`}
            >
              {delta >= 0 ? <ArrowUpRight className="size-3" /> : <ArrowDownRight className="size-3" />}
              {delta > 0 ? '+' : ''}
              {delta.toFixed(1).replace('.', ',')}%
              <span className="text-muted-foreground">vs. ontem</span>
            </span>
          ) : (
            <span className="text-xs text-muted-foreground">{detalhe ?? ' '}</span>
          )}
        </div>
        <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground">
          <Icone className="size-5" />
        </div>
      </CardContent>
    </Card>
  )
}

export function Contagem({ valor }: { valor: number }) {
  return <>{formatarNumero(valor)}</>
}
