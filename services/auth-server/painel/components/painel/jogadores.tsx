'use client'

import { useEffect, useState } from 'react'
import { Ban, Search, ShieldCheck } from 'lucide-react'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import type { Conta, RespostaContas } from '@/lib/api'
import { formatarData, formatarDinheiro, formatarNumero, haQuantoTempo, iniciais } from '@/lib/formato'
import { BotaoRecarregar, CabecalhoDaTela, Estado, usarDados, Vazio } from './comuns'
import { Ficha } from './ficha'

const FILTROS = [
  { valor: 'todas', rotulo: 'Todas as contas' },
  { valor: 'online', rotulo: 'Jogando agora' },
  { valor: 'ativadas', rotulo: 'Com registro' },
  { valor: 'sem-ativacao', rotulo: 'Sem registro' },
  { valor: 'banidas', rotulo: 'Banidas' },
  { valor: 'admins', rotulo: 'Administradores' },
]

export function Jogadores({ buscaInicial = '' }: { buscaInicial?: string }) {
  const [texto, setTexto] = useState(buscaInicial)
  const [busca, setBusca] = useState(buscaInicial)
  const [filtro, setFiltro] = useState('todas')
  const [aberta, setAberta] = useState<number | null>(null)

  // Espera a digitacao parar: uma consulta por tecla castiga o SQLite da VPS
  // sem melhorar nada para quem esta procurando.
  useEffect(() => {
    const id = window.setTimeout(() => setBusca(texto), 350)
    return () => window.clearTimeout(id)
  }, [texto])

  const carga = usarDados<RespostaContas>('/admin/contas', { busca, filtro })
  const d = carga.dados
  const agora = Math.floor(Date.now() / 1000)

  return (
    <>
      <CabecalhoDaTela
        titulo="Jogadores"
        descricao="Cada conta criada no launcher ou no jogo. Buscar, ver a ficha e aplicar ações."
        acao={<BotaoRecarregar carga={carga} />}
      />

      <section className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative w-full sm:max-w-sm">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder="Buscar por nome ou e-mail..."
            className="pl-8"
            aria-label="Buscar conta"
          />
        </div>
        <Select value={filtro} onValueChange={(v) => setFiltro(String(v))}>
          <SelectTrigger className="w-52" aria-label="Filtrar contas">
            <SelectValue>{FILTROS.find((f) => f.valor === filtro)?.rotulo}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {FILTROS.map((f) => (
                <SelectItem key={f.valor} value={f.valor}>
                  {f.rotulo}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      </section>

      <Estado carga={carga}>
        {d && (
          <Card className="min-w-0">
            <CardHeader>
              <CardTitle>
                {d.contas.length === 1 ? '1 conta' : `${formatarNumero(d.contas.length)} contas`}
              </CardTitle>
              <CardDescription>
                {formatarNumero(d.total)} no total
                {d.contas.length >= 200 && ' · mostrando as 200 mais recentes; refine a busca'}
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {d.contas.length === 0 ? (
                <Vazio>Nenhuma conta encontrada com esse filtro.</Vazio>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Conta</TableHead>
                      <TableHead>Situação</TableHead>
                      <TableHead>Entrou por</TableHead>
                      <TableHead className="text-right">Compras</TableHead>
                      <TableHead className="text-right">Saldo</TableHead>
                      <TableHead>Último acesso</TableHead>
                      <TableHead>Criada</TableHead>
                      <TableHead>
                        <span className="sr-only">Ações</span>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {d.contas.map((c) => (
                      <Linha
                        key={c.id}
                        conta={c}
                        agora={agora}
                        janela={d.presenca_janela}
                        aoAbrir={() => setAberta(c.id)}
                      />
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        )}
      </Estado>

      <Ficha
        contaId={aberta}
        aoFechar={() => setAberta(null)}
        aoMudar={() => {
          setAberta(null)
          carga.recarregar()
        }}
      />
    </>
  )
}

function Linha({
  conta,
  agora,
  janela,
  aoAbrir,
}: {
  conta: Conta
  agora: number
  janela: number
  aoAbrir: () => void
}) {
  const online = !!conta.visto_em && agora - conta.visto_em <= janela
  return (
    <TableRow>
      <TableCell>
        <div className="flex items-center gap-3">
          <Avatar className="size-8">
            <AvatarFallback>{iniciais(conta.nome, conta.email)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 whitespace-nowrap text-sm font-medium">
              {conta.nome || '(sem nome)'}
              {!!conta.admin && (
                <Badge variant="outline" className="gap-1">
                  <ShieldCheck />
                  admin
                </Badge>
              )}
            </p>
            <p className="text-xs text-muted-foreground">{conta.email}</p>
          </div>
        </div>
      </TableCell>
      <TableCell>
        {conta.bloqueada ? (
          <Badge variant="destructive" className="gap-1">
            <Ban />
            banida
          </Badge>
        ) : (
          <span className="flex items-center gap-2 whitespace-nowrap text-xs">
            <span className={`size-1.5 rounded-full ${online ? 'bg-primary' : 'bg-muted-foreground'}`} />
            {online ? 'jogando' : conta.ativado ? 'registrada' : 'versão simples'}
          </span>
        )}
      </TableCell>
      <TableCell>
        <Badge variant="secondary">{conta.via_google ? 'Google' : 'Senha'}</Badge>
      </TableCell>
      <TableCell className="text-right">
        {conta.compras > 0 ? (
          <span title={formatarDinheiro(conta.gasto_cents)}>{conta.compras}</span>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </TableCell>
      <TableCell className="text-right text-xs">
        {conta.saldo_cents ? formatarDinheiro(conta.saldo_cents) : '—'}
      </TableCell>
      <TableCell className="text-xs text-muted-foreground">
        {haQuantoTempo(conta.ultimo_login, agora)}
      </TableCell>
      <TableCell className="text-xs text-muted-foreground">{formatarData(conta.criada_em)}</TableCell>
      <TableCell className="text-right">
        <Button variant="outline" size="sm" onClick={aoAbrir}>
          Abrir ficha
        </Button>
      </TableCell>
    </TableRow>
  )
}
