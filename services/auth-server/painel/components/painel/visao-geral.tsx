'use client'

import { useState } from 'react'
import {
  Ban,
  CircleDollarSign,
  Database,
  KeyRound,
  MessageSquare,
  ShieldCheck,
  Timer,
  Users,
  Wifi,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import type { DiaDaSerie, Resumo } from '@/lib/api'
import {
  duracao,
  formatarBytes,
  formatarData,
  formatarDia,
  formatarDinheiro,
  formatarNumero,
  haQuantoTempo,
} from '@/lib/formato'
import { BotaoRecarregar, Estado, Indicador, usarDados, usarPainel, Vazio } from './comuns'

type Metrica = 'entradas' | 'contas' | 'receita_cents'

const METRICAS: { chave: Metrica; rotulo: string }[] = [
  { chave: 'entradas', rotulo: 'Entradas' },
  { chave: 'contas', rotulo: 'Cadastros' },
  { chave: 'receita_cents', rotulo: 'Receita' },
]

function saudacao(agora: number) {
  const hora = new Date(agora * 1000).getHours()
  if (hora < 12) return 'Bom dia'
  if (hora < 18) return 'Boa tarde'
  return 'Boa noite'
}

export function VisaoGeral({ irPara }: { irPara: (tela: string) => void }) {
  const { eu } = usarPainel()
  // 30s: o cartao de "online agora" usa a janela de 90s da presenca, entao um
  // minuto de atraso ja mostraria gente que saiu como se estivesse jogando.
  const carga = usarDados<Resumo>('/admin/resumo', {}, 30)
  const [metrica, setMetrica] = useState<Metrica>('entradas')
  const d = carga.dados

  return (
    <>
      <section className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
        <div className="flex flex-col gap-1">
          <p className="text-sm text-muted-foreground">
            {d ? formatarData(d.agora) : 'Central de operações'}
          </p>
          <h1 className="text-balance text-3xl font-semibold tracking-tight">
            {d ? `${saudacao(d.agora)}, ${(eu.nome || eu.email).split(' ')[0]}.` : 'Visão geral'}
          </h1>
          <p className="text-pretty text-sm text-muted-foreground">
            Contas, acessos e vendas do Ultrafoot — números lidos direto do servidor.
          </p>
        </div>
        <BotaoRecarregar carga={carga} />
      </section>

      <Estado carga={carga}>
        {d && (
          <>
            <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <Indicador
                icone={Wifi}
                rotulo="Jogando agora"
                valor={formatarNumero(d.online_agora)}
                detalhe="visto nos últimos 90 s"
              />
              <Indicador
                icone={Users}
                rotulo="Contas"
                valor={formatarNumero(d.contas_total)}
                detalhe={`${formatarNumero(d.contas_7d)} nos últimos 7 dias`}
              />
              <Indicador
                icone={KeyRound}
                rotulo="Registros ativados"
                valor={formatarNumero(d.ativadas)}
                detalhe={`${
                  d.contas_total ? Math.round((d.ativadas / d.contas_total) * 100) : 0
                }% das contas`}
              />
              <Indicador
                icone={CircleDollarSign}
                rotulo="Receita hoje"
                valor={formatarDinheiro(d.receita_hoje_cents)}
                hoje={d.receita_hoje_cents}
                ontem={d.receita_ontem_cents}
                detalhe={`${formatarDinheiro(d.receita_total_cents)} no total`}
              />
            </section>

            <section className="grid gap-4 xl:grid-cols-[1.6fr_1fr]">
              <Card className="min-w-0">
                <CardHeader className="flex-row items-start justify-between gap-4">
                  <div>
                    <CardTitle>Últimos 14 dias</CardTitle>
                    <CardDescription>
                      {metrica === 'entradas'
                        ? 'Sessões abertas por dia (cada entrada no jogo ou no launcher)'
                        : metrica === 'contas'
                          ? 'Contas criadas por dia'
                          : 'Receita confirmada por dia'}
                    </CardDescription>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    {METRICAS.map((m) => (
                      <Button
                        key={m.chave}
                        size="xs"
                        variant={metrica === m.chave ? 'secondary' : 'ghost'}
                        onClick={() => setMetrica(m.chave)}
                      >
                        {m.rotulo}
                      </Button>
                    ))}
                  </div>
                </CardHeader>
                <CardContent>
                  <Grafico serie={d.serie} metrica={metrica} />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Estado do serviço</CardTitle>
                  <CardDescription>O que está de pé neste momento</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-4">
                  <Sinal
                    icone={Timer}
                    rotulo="Servidor de contas"
                    valor={`de pé há ${duracao(d.agora - d.servidor.iniciado_em)}`}
                    ok
                  />
                  <Sinal
                    icone={KeyRound}
                    rotulo="Emissão de chaves"
                    valor={d.servidor.licenca_ligada ? 'ligada' : 'sem segredo configurado'}
                    ok={d.servidor.licenca_ligada}
                  />
                  <Sinal
                    icone={CircleDollarSign}
                    rotulo="Pagamento (Asaas)"
                    valor={d.servidor.pagamento_ligado ? 'ligado' : 'desligado'}
                    ok={d.servidor.pagamento_ligado}
                  />
                  <Sinal
                    icone={ShieldCheck}
                    rotulo="Entrar com Google"
                    valor={d.servidor.google_ligado ? 'ligado' : 'desligado'}
                    ok={d.servidor.google_ligado}
                  />
                  <Sinal
                    icone={Database}
                    rotulo="Banco de dados"
                    valor={formatarBytes(d.servidor.banco_bytes)}
                    ok
                  />
                  <Separator />
                  <Numero rotulo="Sessões válidas" valor={formatarNumero(d.sessoes_ativas)} />
                  <Numero
                    rotulo="Entradas hoje"
                    valor={formatarNumero(d.entradas_hoje)}
                  />
                  <Numero rotulo="Carreiras salvas" valor={formatarNumero(d.saves_total)} />
                  <Numero rotulo="Mensagens no chat (24 h)" valor={formatarNumero(d.chat_24h)} />
                </CardContent>
              </Card>
            </section>

            <section className="grid gap-4 xl:grid-cols-[1.6fr_1fr]">
              <Card className="min-w-0">
                <CardHeader className="flex-row items-center justify-between gap-4">
                  <div>
                    <CardTitle>Precisa de atenção</CardTitle>
                    <CardDescription>Situações que costumam pedir uma decisão</CardDescription>
                  </div>
                </CardHeader>
                <CardContent className="grid gap-3 sm:grid-cols-2">
                  <Atencao
                    icone={Ban}
                    rotulo="Contas banidas"
                    valor={d.bloqueadas}
                    detalhe="perdem o acesso na hora"
                    aoClicar={() => irPara('Jogadores')}
                  />
                  <Atencao
                    icone={CircleDollarSign}
                    rotulo="Pedidos pendentes"
                    valor={d.pedidos_pendentes}
                    detalhe="pagamento ainda não confirmado"
                    aoClicar={() => irPara('Economia')}
                  />
                  <Atencao
                    icone={Users}
                    rotulo="Contas sem registro"
                    valor={d.contas_total - d.ativadas}
                    detalhe="usam a versão simples"
                    aoClicar={() => irPara('Jogadores')}
                  />
                  <Atencao
                    icone={MessageSquare}
                    rotulo="Mensagens no chat (24 h)"
                    valor={d.chat_24h}
                    detalhe="moderação do FC Hub"
                    aoClicar={() => irPara('FC Hub')}
                  />
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex-row items-center justify-between gap-4">
                  <div>
                    <CardTitle>Ações da equipe</CardTitle>
                    <CardDescription>Últimos registros da auditoria</CardDescription>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => irPara('Auditoria')}>
                    Ver tudo
                  </Button>
                </CardHeader>
                <CardContent className="flex flex-col gap-4">
                  {d.atividade.length === 0 && <Vazio>Nenhuma ação registrada ainda.</Vazio>}
                  {d.atividade.map((a) => (
                    <div key={a.id} className="flex gap-3">
                      <div
                        className={`flex size-9 shrink-0 items-center justify-center rounded-lg ${
                          a.acao === 'banir'
                            ? 'bg-destructive/10 text-destructive'
                            : 'bg-muted text-muted-foreground'
                        }`}
                      >
                        {a.acao === 'banir' ? (
                          <Ban className="size-4" />
                        ) : a.acao === 'creditar' ? (
                          <CircleDollarSign className="size-4" />
                        ) : (
                          <ShieldCheck className="size-4" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className="truncate text-sm font-medium first-letter:uppercase">
                            {a.acao}
                          </p>
                          <span className="whitespace-nowrap text-[10px] text-muted-foreground">
                            {haQuantoTempo(a.quando, d.agora)}
                          </span>
                        </div>
                        <p className="mt-1 truncate text-xs text-muted-foreground">
                          {a.alvo_nome || a.alvo_email} · por {a.admin_email}
                        </p>
                        {a.motivo && (
                          <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{a.motivo}</p>
                        )}
                      </div>
                    </div>
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

function Grafico({ serie, metrica }: { serie: DiaDaSerie[]; metrica: Metrica }) {
  const maior = Math.max(1, ...serie.map((d) => d[metrica]))
  const formatar = (v: number) => (metrica === 'receita_cents' ? formatarDinheiro(v) : formatarNumero(v))
  return (
    <>
      <div className="flex h-56 items-end gap-1.5 pt-6">
        {serie.map((dia) => (
          <div
            key={dia.inicio}
            className="group flex h-full flex-1 items-end"
            title={`${formatarDia(dia.inicio)}: ${formatar(dia[metrica])}`}
          >
            <div
              className="w-full rounded-t-sm bg-primary/25 transition-colors group-hover:bg-primary"
              // `max` garante que um dia com valor 1 ainda apareca como barra.
              style={{ height: `${Math.max(dia[metrica] ? 3 : 0.5, (dia[metrica] / maior) * 100)}%` }}
            />
          </div>
        ))}
      </div>
      <div className="mt-3 flex justify-between text-[10px] text-muted-foreground">
        <span>{formatarDia(serie[0]?.inicio ?? 0)}</span>
        <span>{formatarDia(serie[Math.floor(serie.length / 2)]?.inicio ?? 0)}</span>
        <span>hoje</span>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        Pico do período: {formatar(maior)}
      </p>
    </>
  )
}

function Sinal({
  icone: Icone,
  rotulo,
  valor,
  ok,
}: {
  icone: React.ComponentType<{ className?: string }>
  rotulo: string
  valor: string
  ok: boolean
}) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className="flex min-w-0 items-center gap-2">
        <Icone className={`size-4 shrink-0 ${ok ? 'text-primary' : 'text-muted-foreground'}`} />
        <span className="truncate">{rotulo}</span>
      </span>
      <Badge variant={ok ? 'outline' : 'secondary'} className="shrink-0">
        {valor}
      </Badge>
    </div>
  )
}

function Numero({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{rotulo}</span>
      <strong>{valor}</strong>
    </div>
  )
}

function Atencao({
  icone: Icone,
  rotulo,
  valor,
  detalhe,
  aoClicar,
}: {
  icone: React.ComponentType<{ className?: string }>
  rotulo: string
  valor: number
  detalhe: string
  aoClicar: () => void
}) {
  return (
    <button
      type="button"
      onClick={aoClicar}
      className="flex items-center gap-3 rounded-lg border border-border p-4 text-left transition-colors hover:bg-muted/50"
    >
      <div
        className={`flex size-10 shrink-0 items-center justify-center rounded-lg ${
          valor > 0 ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
        }`}
      >
        <Icone className="size-5" />
      </div>
      <div className="min-w-0">
        <p className="text-2xl font-semibold leading-none">{formatarNumero(valor)}</p>
        <p className="mt-1 truncate text-sm font-medium">{rotulo}</p>
        <p className="truncate text-xs text-muted-foreground">{detalhe}</p>
      </div>
    </button>
  )
}
