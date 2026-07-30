'use client'

import { ShieldCheck, Terminal } from 'lucide-react'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import type { MembroDaEquipe } from '@/lib/api'
import { formatarData, haQuantoTempo, iniciais } from '@/lib/formato'
import { BotaoRecarregar, CabecalhoDaTela, Estado, usarDados, usarPainel, Vazio } from './comuns'

export function Equipe() {
  const { eu } = usarPainel()
  const carga = usarDados<{ admins: MembroDaEquipe[] }>('/admin/equipe')
  const d = carga.dados
  const agora = Math.floor(Date.now() / 1000)

  return (
    <>
      <CabecalhoDaTela
        titulo="Equipe admin"
        descricao="Quem pode entrar neste painel e o que cada um já fez."
        acao={<BotaoRecarregar carga={carga} />}
      />

      <Estado carga={carga}>
        {d && (
          <section className="grid gap-4 xl:grid-cols-[1.5fr_1fr]">
            <Card>
              <CardHeader>
                <CardTitle>
                  {d.admins.length === 1 ? '1 administrador' : `${d.admins.length} administradores`}
                </CardTitle>
                <CardDescription>
                  Não existe senha de painel: quem abre esta área é a própria conta do jogo, com a
                  marca de administrador.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                {d.admins.length === 0 && <Vazio>Nenhum administrador cadastrado.</Vazio>}
                {d.admins.map((m) => (
                  <div
                    key={m.id}
                    className="flex items-center gap-3 rounded-lg border border-border p-4"
                  >
                    <Avatar className="size-10">
                      <AvatarFallback>{iniciais(m.nome, m.email)}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-2 truncate text-sm font-medium">
                        {m.nome || '(sem nome)'}
                        {m.id === eu.id && <Badge variant="outline">você</Badge>}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">{m.email}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Admin desde {formatarData(m.criada_em)} · último acesso{' '}
                        {haQuantoTempo(m.ultimo_login, agora)}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-2xl font-semibold leading-none">{m.acoes}</p>
                      <p className="text-xs text-muted-foreground">
                        {m.acoes === 1 ? 'ação' : 'ações'}
                      </p>
                      {m.ultima_acao && (
                        <p className="mt-1 text-[10px] text-muted-foreground">
                          {haQuantoTempo(m.ultima_acao, agora)}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ShieldCheck className="size-4 text-primary" />
                  Como promover alguém
                </CardTitle>
                <CardDescription>
                  De propósito, isto não se faz pelo painel.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-4 text-sm text-muted-foreground">
                <p>
                  Dar poder de administrador é a única ação que exige acesso ao servidor. Se
                  coubesse aqui, bastaria uma sessão de admin roubada para o invasor criar outras e
                  nunca mais perder o acesso.
                </p>
                <div className="flex items-start gap-2 rounded-lg border border-border bg-muted/40 p-3 font-mono text-xs text-foreground">
                  <Terminal className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                  <code className="break-all">
                    python3 /opt/ultrafoot-auth/tornar-admin.py conta@exemplo.com
                  </code>
                </div>
                <p>
                  O mesmo comando com <code className="font-mono">--tirar</code> rebaixa a conta, e{' '}
                  <code className="font-mono">--listar</code> mostra os administradores atuais. A
                  conta precisa existir antes: crie-a pelo launcher e só então promova.
                </p>
              </CardContent>
            </Card>
          </section>
        )}
      </Estado>
    </>
  )
}
