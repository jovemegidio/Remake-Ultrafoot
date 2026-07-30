'use client'

import { useState } from 'react'
import { CircleDollarSign, Clock3, Undo2, Wallet } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import type { Economia as DadosDaEconomia } from '@/lib/api'
import { formatarData, formatarDinheiro, formatarNumero } from '@/lib/formato'
import { BotaoRecarregar, CabecalhoDaTela, Estado, Indicador, usarDados, Vazio } from './comuns'

type Aba = 'compras' | 'pedidos' | 'creditos'

const ABAS: { chave: Aba; rotulo: string }[] = [
  { chave: 'compras', rotulo: 'Compras' },
  { chave: 'pedidos', rotulo: 'Pedidos' },
  { chave: 'creditos', rotulo: 'Créditos' },
]

export function Economia() {
  const carga = usarDados<DadosDaEconomia>('/admin/economia')
  const [aba, setAba] = useState<Aba>('compras')
  const d = carga.dados

  return (
    <>
      <CabecalhoDaTela
        titulo="Economia"
        descricao="Vendas do registro, pedidos aguardando pagamento e créditos lançados à mão."
        acao={<BotaoRecarregar carga={carga} />}
      />

      <Estado carga={carga}>
        {d && (
          <>
            <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <Indicador
                icone={CircleDollarSign}
                rotulo="Receita"
                valor={formatarDinheiro(d.resumo.receita_total_cents)}
                detalhe={`${formatarDinheiro(d.resumo.receita_30d_cents)} nos últimos 30 dias`}
              />
              <Indicador
                icone={Clock3}
                rotulo="Pedidos pendentes"
                valor={formatarNumero(d.resumo.pedidos_pendentes)}
                detalhe={
                  d.resumo.pagamento_ligado
                    ? 'aguardando confirmação do Asaas'
                    : 'pagamento desligado no servidor'
                }
              />
              <Indicador
                icone={Undo2}
                rotulo="Estornos"
                valor={formatarNumero(d.resumo.estornos)}
                detalhe={`${formatarDinheiro(d.resumo.estornos_cents)} devolvidos`}
              />
              <Indicador
                icone={Wallet}
                rotulo="Saldo em carteiras"
                valor={formatarDinheiro(d.resumo.saldo_em_carteiras_cents)}
                detalhe={`${formatarDinheiro(d.resumo.creditado_cents)} já creditados`}
              />
            </section>

            <section className="grid gap-4 xl:grid-cols-[1fr_1.6fr]">
              <Card>
                <CardHeader>
                  <CardTitle>Por produto</CardTitle>
                  <CardDescription>Só entra aqui o que foi pago de verdade</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-3">
                  {d.por_produto.length === 0 && <Vazio>Nenhuma venda ainda.</Vazio>}
                  {d.por_produto.map((p) => {
                    const item = d.catalogo.find((c) => c.id === p.produto)
                    return (
                      <div
                        key={p.produto}
                        className="flex items-center justify-between gap-3 rounded-lg border border-border p-3"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{item?.nome || p.produto}</p>
                          <p className="text-xs text-muted-foreground">
                            {p.quantidade} {p.quantidade === 1 ? 'venda' : 'vendas'}
                          </p>
                        </div>
                        <span className="shrink-0 text-sm font-medium">
                          {formatarDinheiro(p.total_cents)}
                        </span>
                      </div>
                    )
                  })}
                  {d.catalogo.map((item) =>
                    d.por_produto.some((p) => p.produto === item.id) ? null : (
                      <div
                        key={item.id}
                        className="flex items-center justify-between gap-3 rounded-lg border border-dashed border-border p-3"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{item.nome}</p>
                          <p className="text-xs text-muted-foreground">à venda, sem vendas ainda</p>
                        </div>
                        <span className="shrink-0 text-sm text-muted-foreground">
                          {formatarDinheiro(item.preco_cents)}
                        </span>
                      </div>
                    ),
                  )}
                </CardContent>
              </Card>

              <Card className="min-w-0">
                <CardHeader className="flex-row items-center justify-between gap-4">
                  <div>
                    <CardTitle>Movimentação</CardTitle>
                    <CardDescription>Os 100 lançamentos mais recentes de cada tipo</CardDescription>
                  </div>
                  <div className="flex shrink-0 gap-1">
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
                </CardHeader>
                <CardContent className="p-0">
                  {aba === 'compras' &&
                    (d.compras.length === 0 ? (
                      <Vazio>Nenhuma compra registrada.</Vazio>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Conta</TableHead>
                            <TableHead>Produto</TableHead>
                            <TableHead>Quando</TableHead>
                            <TableHead className="text-right">Valor</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {d.compras.map((c) => (
                            <TableRow key={c.id}>
                              <TableCell>
                                <p className="text-sm font-medium">{c.nome || '(sem nome)'}</p>
                                <p className="text-xs text-muted-foreground">{c.email}</p>
                              </TableCell>
                              <TableCell>
                                <span className="flex items-center gap-2">
                                  {c.produto}
                                  {c.estorno_de && <Badge variant="destructive">estorno</Badge>}
                                </span>
                              </TableCell>
                              <TableCell className="text-xs text-muted-foreground">
                                {formatarData(c.criada_em)}
                              </TableCell>
                              <TableCell className="text-right font-medium">
                                {formatarDinheiro(c.valor_cents)}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    ))}

                  {aba === 'pedidos' &&
                    (d.pedidos.length === 0 ? (
                      <Vazio>Nenhum pedido criado.</Vazio>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Conta</TableHead>
                            <TableHead>Produto</TableHead>
                            <TableHead>Situação</TableHead>
                            <TableHead>Criado</TableHead>
                            <TableHead className="text-right">Valor</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {d.pedidos.map((p) => (
                            <TableRow key={p.id}>
                              <TableCell>
                                <p className="text-sm font-medium">{p.nome || '(sem nome)'}</p>
                                <p className="text-xs text-muted-foreground">{p.email}</p>
                              </TableCell>
                              <TableCell>{p.produto}</TableCell>
                              <TableCell>
                                <Badge
                                  variant={
                                    p.status === 'pendente'
                                      ? 'secondary'
                                      : p.status === 'entregue'
                                        ? 'outline'
                                        : 'destructive'
                                  }
                                >
                                  {p.status}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-xs text-muted-foreground">
                                {formatarData(p.criado_em)}
                              </TableCell>
                              <TableCell className="text-right font-medium">
                                {formatarDinheiro(p.valor_cents)}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    ))}

                  {aba === 'creditos' &&
                    (d.creditos.length === 0 ? (
                      <Vazio>Nenhum crédito lançado.</Vazio>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Conta</TableHead>
                            <TableHead>Origem</TableHead>
                            <TableHead>Quando</TableHead>
                            <TableHead className="text-right">Valor</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {d.creditos.map((c) => (
                            <TableRow key={c.id}>
                              <TableCell>
                                <p className="text-sm font-medium">{c.nome || '(sem nome)'}</p>
                                <p className="text-xs text-muted-foreground">{c.email}</p>
                              </TableCell>
                              <TableCell>{c.origem || '—'}</TableCell>
                              <TableCell className="text-xs text-muted-foreground">
                                {formatarData(c.quando)}
                              </TableCell>
                              <TableCell className="text-right font-medium">
                                {formatarDinheiro(c.valor_cents)}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    ))}
                </CardContent>
              </Card>
            </section>
          </>
        )}
      </Estado>
    </>
  )
}
