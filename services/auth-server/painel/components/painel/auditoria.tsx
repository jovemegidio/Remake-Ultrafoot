'use client'

import { useEffect, useState } from 'react'
import { Ban, CircleDollarSign, MessageSquareX, Search, Undo2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import type { Acao } from '@/lib/api'
import { formatarData, formatarNumero, haQuantoTempo } from '@/lib/formato'
import { BotaoRecarregar, CabecalhoDaTela, Estado, usarDados, Vazio } from './comuns'

const ICONES: Record<string, React.ComponentType<{ className?: string }>> = {
  banir: Ban,
  desbanir: Undo2,
  creditar: CircleDollarSign,
  'apagar mensagem': MessageSquareX,
}

export function Auditoria() {
  const [texto, setTexto] = useState('')
  const [busca, setBusca] = useState('')

  useEffect(() => {
    const id = window.setTimeout(() => setBusca(texto), 350)
    return () => window.clearTimeout(id)
  }, [texto])

  const carga = usarDados<{ registros: Acao[]; total: number }>('/admin/auditoria', { busca })
  const d = carga.dados
  const agora = Math.floor(Date.now() / 1000)

  return (
    <>
      <CabecalhoDaTela
        titulo="Auditoria"
        descricao="Toda ação administrativa fica registrada: quem fez, em quem, quando e por quê."
        acao={<BotaoRecarregar carga={carga} />}
      />

      <div className="relative w-full sm:max-w-sm">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="Filtrar por ação, motivo ou e-mail..."
          className="pl-8"
          aria-label="Filtrar auditoria"
        />
      </div>

      <Estado carga={carga}>
        {d && (
          <Card className="min-w-0">
            <CardHeader>
              <CardTitle>{formatarNumero(d.registros.length)} registros</CardTitle>
              <CardDescription>
                {formatarNumero(d.total)} no total
                {d.registros.length >= 300 && ' · mostrando os 300 mais recentes'}
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {d.registros.length === 0 ? (
                <Vazio>Nenhuma ação registrada com esse filtro.</Vazio>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Ação</TableHead>
                      <TableHead>Conta afetada</TableHead>
                      <TableHead>Administrador</TableHead>
                      <TableHead>Motivo</TableHead>
                      <TableHead>Quando</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {d.registros.map((r) => {
                      const Icone = ICONES[r.acao]
                      return (
                        <TableRow key={r.id}>
                          <TableCell>
                            <Badge variant={r.acao === 'banir' ? 'destructive' : 'secondary'} className="gap-1">
                              {Icone && <Icone />}
                              {r.acao}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <p className="text-sm font-medium">{r.alvo_nome || '(sem nome)'}</p>
                            <p className="text-xs text-muted-foreground">{r.alvo_email}</p>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">{r.admin_email}</TableCell>
                          <TableCell className="max-w-xs whitespace-normal text-xs text-muted-foreground">
                            {r.motivo || '—'}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground" title={formatarData(r.quando)}>
                            {haQuantoTempo(r.quando, agora)}
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        )}
      </Estado>
    </>
  )
}
