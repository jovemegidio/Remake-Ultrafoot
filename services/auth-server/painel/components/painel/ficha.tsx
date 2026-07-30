'use client'

import { useState } from 'react'
import { Ban, CircleDollarSign, Loader2, ShieldCheck, Undo2 } from 'lucide-react'
import { toast } from 'sonner'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Textarea } from '@/components/ui/textarea'
import type { FichaDaConta } from '@/lib/api'
import { formatarData, formatarDinheiro, haQuantoTempo, iniciais } from '@/lib/formato'
import { usarAcao, usarDados } from './comuns'

type Aba = 'resumo' | 'compras' | 'carreiras' | 'sessoes' | 'historico'
type Acao = null | 'banir' | 'creditar'

const ABAS: { chave: Aba; rotulo: string }[] = [
  { chave: 'resumo', rotulo: 'Resumo' },
  { chave: 'compras', rotulo: 'Financeiro' },
  { chave: 'carreiras', rotulo: 'Carreiras' },
  { chave: 'sessoes', rotulo: 'Sessões' },
  { chave: 'historico', rotulo: 'Histórico' },
]

export function Ficha({
  contaId,
  aoFechar,
  aoMudar,
}: {
  contaId: number | null
  aoFechar: () => void
  aoMudar: () => void
}) {
  return (
    <Dialog open={contaId !== null} onOpenChange={(aberto) => !aberto && aoFechar()}>
      <DialogContent className="max-h-[85svh] gap-0 overflow-y-auto sm:max-w-2xl">
        {/* Montar o conteudo so com o dialogo aberto garante que a ficha seja
            buscada de novo a cada abertura — dado de conta muda o tempo todo. */}
        {contaId !== null && <Conteudo contaId={contaId} aoMudar={aoMudar} />}
      </DialogContent>
    </Dialog>
  )
}

function Conteudo({ contaId, aoMudar }: { contaId: number; aoMudar: () => void }) {
  const carga = usarDados<FichaDaConta>('/admin/conta', { conta_id: contaId })
  const [aba, setAba] = useState<Aba>('resumo')
  const [acao, setAcao] = useState<Acao>(null)

  if (carga.erro) {
    return (
      <>
        <DialogHeader>
          <DialogTitle>Ficha da conta</DialogTitle>
          <DialogDescription>{carga.erro}</DialogDescription>
        </DialogHeader>
        <Button variant="outline" className="mt-4 w-fit" onClick={carga.recarregar}>
          Tentar de novo
        </Button>
      </>
    )
  }

  if (!carga.dados) {
    return (
      <>
        <DialogHeader>
          <DialogTitle>Ficha da conta</DialogTitle>
          <DialogDescription>Buscando os dados desta conta...</DialogDescription>
        </DialogHeader>
        <div className="flex items-center justify-center py-10">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        </div>
      </>
    )
  }

  const d = carga.dados
  const c = d.conta
  const agora = Math.floor(Date.now() / 1000)
  const jogando = !!d.presenca && agora - d.presenca.visto_em <= d.janela_presenca

  return (
    <>
      <DialogHeader>
        <DialogTitle className="sr-only">{c.nome || c.email}</DialogTitle>
        <DialogDescription className="sr-only">Ficha administrativa da conta</DialogDescription>
        <div className="flex items-center gap-3 pr-8">
          <Avatar className="size-12">
            <AvatarFallback>{iniciais(c.nome, c.email)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="flex flex-wrap items-center gap-1.5 text-base font-medium">
              {c.nome || '(sem nome)'}
              {c.admin && (
                <Badge variant="outline" className="gap-1">
                  <ShieldCheck />
                  admin
                </Badge>
              )}
              {c.bloqueada && (
                <Badge variant="destructive" className="gap-1">
                  <Ban />
                  banida
                </Badge>
              )}
              {jogando && <Badge>jogando agora</Badge>}
            </p>
            <p className="truncate text-sm text-muted-foreground">{c.email}</p>
          </div>
        </div>
      </DialogHeader>

      {c.bloqueada && (
        <div className="mt-4 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          <strong>Banida em {formatarData(c.bloqueada_em)}.</strong>{' '}
          {c.motivo_bloqueio || 'sem motivo registrado'}
        </div>
      )}

      <div className="mt-4 flex flex-wrap gap-1 border-b border-border pb-2">
        {ABAS.map((a) => (
          <Button
            key={a.chave}
            size="xs"
            variant={aba === a.chave ? 'secondary' : 'ghost'}
            onClick={() => setAba(a.chave)}
          >
            {a.rotulo}
          </Button>
        ))}
      </div>

      <div className="py-4">
        {aba === 'resumo' && (
          <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
            <Campo rotulo="Conta nº" valor={`#${c.id}`} />
            <Campo rotulo="Telefone" valor={c.telefone || '—'} />
            <Campo rotulo="Entra por" valor={c.via_google ? 'Google' : 'E-mail e senha'} />
            <Campo rotulo="Criada em" valor={formatarData(c.criada_em)} />
            <Campo rotulo="Último acesso" valor={haQuantoTempo(c.ultimo_login, agora)} />
            <Campo rotulo="Sessões válidas" valor={String(d.sessoes.length)} />
            <Campo rotulo="Versão" valor={c.ativado ? 'completa (registrada)' : 'simples'} />
            <Campo rotulo="Chave de registro" valor={c.codigo_ativacao || '—'} />
            <Campo rotulo="Saldo na loja" valor={formatarDinheiro(c.saldo_cents)} />
            {d.presenca && (
              <>
                <Campo rotulo="Clube no jogo" valor={d.presenca.clube || '—'} />
                <Campo rotulo="Situação" valor={d.presenca.situacao || '—'} />
                <Campo rotulo="Visto" valor={haQuantoTempo(d.presenca.visto_em, agora)} />
              </>
            )}
          </dl>
        )}

        {aba === 'compras' && (
          <div className="flex flex-col gap-4">
            <Lista
              titulo="Compras"
              vazio="Nenhuma compra registrada."
              itens={d.compras.map((x) => ({
                chave: `c${x.id}`,
                titulo: x.produto,
                detalhe: formatarData(x.criada_em),
                valor: formatarDinheiro(x.valor_cents),
                etiqueta: x.estorno_de ? 'estorno' : undefined,
              }))}
            />
            <Lista
              titulo="Pedidos"
              vazio="Nenhum pedido."
              itens={d.pedidos.map((x) => ({
                chave: `p${x.id}`,
                titulo: x.produto,
                detalhe: formatarData(x.criado_em),
                valor: formatarDinheiro(x.valor_cents),
                etiqueta: x.status,
              }))}
            />
            <Lista
              titulo="Créditos"
              vazio="Nenhum crédito lançado."
              itens={d.creditos.map((x) => ({
                chave: `r${x.id}`,
                titulo: x.origem || 'crédito',
                detalhe: formatarData(x.quando),
                valor: formatarDinheiro(x.valor_cents),
              }))}
            />
          </div>
        )}

        {aba === 'carreiras' && (
          <Lista
            titulo="Carreiras salvas na nuvem"
            vazio="Esta conta não registrou nenhuma carreira."
            itens={d.saves.map((s) => ({
              chave: s.codigo,
              titulo: s.rotulo || 'carreira sem nome',
              detalhe: `código ${s.codigo} · atualizada ${haQuantoTempo(s.atualizado_em, agora)}`,
            }))}
          />
        )}

        {aba === 'sessoes' && (
          <Lista
            titulo="Sessões válidas"
            vazio="Nenhuma sessão aberta. Banir uma conta derruba todas."
            itens={d.sessoes.map((s, i) => ({
              chave: `s${i}`,
              titulo: s.dispositivo || 'dispositivo não informado',
              detalhe: `aberta ${haQuantoTempo(s.criada_em, agora)} · vence ${formatarData(s.expira_em)}`,
            }))}
          />
        )}

        {aba === 'historico' && (
          <Lista
            titulo="Ações administrativas sobre esta conta"
            vazio="Nenhuma ação registrada."
            itens={d.historico.map((h, i) => ({
              chave: `h${i}`,
              titulo: h.acao,
              detalhe: `${formatarData(h.quando)} · ${h.admin_email}${h.motivo ? ` · ${h.motivo}` : ''}`,
            }))}
          />
        )}
      </div>

      <Separator />

      <div className="pt-4">
        {acao === null && (
          <div className="flex flex-wrap gap-2">
            {c.bloqueada ? (
              <Desbanir contaId={c.id} aoMudar={aoMudar} />
            ) : (
              <Button
                variant="destructive"
                onClick={() => setAcao('banir')}
                disabled={c.admin}
                title={c.admin ? 'Um administrador não pode ser banido pelo painel' : undefined}
              >
                <Ban data-icon="inline-start" />
                Banir conta
              </Button>
            )}
            <Button variant="outline" onClick={() => setAcao('creditar')}>
              <CircleDollarSign data-icon="inline-start" />
              Lançar crédito
            </Button>
          </div>
        )}

        {acao === 'banir' && (
          <Banir
            contaId={c.id}
            nome={c.nome || c.email}
            aoCancelar={() => setAcao(null)}
            aoMudar={aoMudar}
          />
        )}

        {acao === 'creditar' && (
          <Creditar contaId={c.id} aoCancelar={() => setAcao(null)} aoMudar={aoMudar} />
        )}
      </div>
    </>
  )
}

function Campo({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="rounded-lg border border-border p-3">
      <dt className="text-xs text-muted-foreground">{rotulo}</dt>
      <dd className="mt-1 truncate font-medium" title={valor}>
        {valor}
      </dd>
    </div>
  )
}

function Lista({
  titulo,
  vazio,
  itens,
}: {
  titulo: string
  vazio: string
  itens: { chave: string; titulo: string; detalhe: string; valor?: string; etiqueta?: string }[]
}) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">{titulo}</p>
      {itens.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
          {vazio}
        </p>
      ) : (
        itens.map((i) => (
          <div
            key={i.chave}
            className="flex items-center justify-between gap-3 rounded-lg border border-border p-3"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-medium first-letter:uppercase">{i.titulo}</p>
              <p className="truncate text-xs text-muted-foreground">{i.detalhe}</p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {i.etiqueta && <Badge variant="outline">{i.etiqueta}</Badge>}
              {i.valor && <span className="text-sm font-medium">{i.valor}</span>}
            </div>
          </div>
        ))
      )}
    </div>
  )
}

function Banir({
  contaId,
  nome,
  aoCancelar,
  aoMudar,
}: {
  contaId: number
  nome: string
  aoCancelar: () => void
  aoMudar: () => void
}) {
  const [motivo, setMotivo] = useState('')
  const { executar, ocupado } = usarAcao()

  async function confirmar() {
    // O servidor tambem exige motivo; checar aqui evita a ida e volta e explica
    // melhor por que ele e obrigatorio.
    if (motivo.trim().length < 5) {
      toast.error('Descreva o motivo do banimento (fica registrado na auditoria).')
      return
    }
    const erro = await executar('/admin/banir', { conta_id: contaId, motivo: motivo.trim() })
    if (erro) return toast.error(erro)
    toast.success(`${nome} foi banido.`, { description: 'As sessões abertas foram derrubadas.' })
    aoMudar()
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
        A conta perde o acesso imediatamente e todas as sessões abertas são derrubadas.
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="motivo-banimento">Motivo do banimento</Label>
        <Textarea
          id="motivo-banimento"
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          placeholder="Descreva a infração — este texto fica registrado na auditoria."
          rows={3}
        />
      </div>
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button variant="outline" onClick={aoCancelar} disabled={ocupado}>
          Cancelar
        </Button>
        <Button variant="destructive" onClick={confirmar} disabled={ocupado}>
          {ocupado ? 'Banindo...' : 'Confirmar banimento'}
        </Button>
      </div>
    </div>
  )
}

function Desbanir({ contaId, aoMudar }: { contaId: number; aoMudar: () => void }) {
  const { executar, ocupado } = usarAcao()
  return (
    <Button
      variant="outline"
      disabled={ocupado}
      onClick={async () => {
        const erro = await executar('/admin/desbanir', { conta_id: contaId })
        if (erro) return toast.error(erro)
        toast.success('Conta desbanida.', { description: 'A pessoa já pode entrar de novo.' })
        aoMudar()
      }}
    >
      <Undo2 data-icon="inline-start" />
      {ocupado ? 'Desbanindo...' : 'Desbanir conta'}
    </Button>
  )
}

function Creditar({
  contaId,
  aoCancelar,
  aoMudar,
}: {
  contaId: number
  aoCancelar: () => void
  aoMudar: () => void
}) {
  const [reais, setReais] = useState('')
  const [motivo, setMotivo] = useState('')
  const { executar, ocupado } = usarAcao()

  async function confirmar() {
    // Dinheiro vai para o servidor em CENTAVOS, inteiro. Converter aqui, uma vez
    // so, evita que arredondamento de ponto flutuante vire saldo errado.
    const valor = Math.round(Number(reais.replace(',', '.')) * 100)
    if (!Number.isFinite(valor) || valor <= 0) {
      toast.error('Informe um valor maior que zero.')
      return
    }
    const erro = await executar('/admin/creditar', {
      conta_id: contaId,
      valor_cents: valor,
      motivo: motivo.trim() || 'crédito manual pelo painel',
    })
    if (erro) return toast.error(erro)
    toast.success(`${formatarDinheiro(valor)} creditados.`, {
      description: 'O lançamento entrou no extrato e na auditoria.',
    })
    aoMudar()
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted-foreground">
        Crédito manual na carteira da loja. Fica registrado na auditoria com o seu nome.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="valor-credito">Valor (R$)</Label>
          <Input
            id="valor-credito"
            inputMode="decimal"
            value={reais}
            onChange={(e) => setReais(e.target.value)}
            placeholder="30,00"
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="motivo-credito">Motivo</Label>
          <Input
            id="motivo-credito"
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            placeholder="reembolso, brinde..."
          />
        </div>
      </div>
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button variant="outline" onClick={aoCancelar} disabled={ocupado}>
          Cancelar
        </Button>
        <Button onClick={confirmar} disabled={ocupado}>
          {ocupado ? 'Lançando...' : 'Lançar crédito'}
        </Button>
      </div>
    </div>
  )
}
