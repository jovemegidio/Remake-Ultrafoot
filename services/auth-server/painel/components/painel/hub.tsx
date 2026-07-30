'use client'

import { useState } from 'react'
import { Ban, Trash2, Wifi } from 'lucide-react'
import { toast } from 'sonner'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import type { Hub as DadosDoHub } from '@/lib/api'
import { formatarData, formatarNumero, haQuantoTempo, iniciais } from '@/lib/formato'
import { BotaoRecarregar, CabecalhoDaTela, Estado, usarAcao, usarDados, Vazio } from './comuns'

export function FcHub() {
  // 20s: a presenca vale 90s, entao esta tela precisa ser mais rapida que isso
  // para nao mostrar como online quem ja fechou o jogo.
  const carga = usarDados<DadosDoHub>('/admin/hub', {}, 20)
  const { executar, ocupado } = usarAcao()
  const [apagando, setApagando] = useState<number | null>(null)
  const agora = Math.floor(Date.now() / 1000)
  const d = carga.dados

  async function apagar(id: number) {
    setApagando(id)
    const erro = await executar('/admin/chat/apagar', { mensagem_id: id })
    setApagando(null)
    if (erro) return toast.error(erro)
    toast.success('Mensagem apagada.', { description: 'A remoção entrou na auditoria.' })
    carga.recarregar()
  }

  return (
    <>
      <CabecalhoDaTela
        titulo="FC Hub"
        descricao="Quem está jogando neste momento e o chat público do saguão."
        acao={<BotaoRecarregar carga={carga} />}
      />

      <Estado carga={carga}>
        {d && (
          <section className="grid gap-4 xl:grid-cols-[1fr_1.3fr]">
            <Card className="min-w-0">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Wifi className="size-4 text-primary" />
                  {formatarNumero(d.online.length)} jogando agora
                </CardTitle>
                <CardDescription>
                  Presença por batida do jogo; some sozinho quem para de bater por {d.janela}s.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-2">
                {d.online.length === 0 && <Vazio>Ninguém no ar neste momento.</Vazio>}
                {d.online.map((p) => (
                  <div
                    key={p.conta_id}
                    className="flex items-center gap-3 rounded-lg border border-border p-3"
                  >
                    <Avatar className="size-8">
                      <AvatarFallback>{iniciais(p.nome, p.email)}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{p.nome || p.email}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {[p.clube, p.situacao].filter(Boolean).join(' · ') || p.email}
                      </p>
                    </div>
                    <span className="shrink-0 text-[10px] text-muted-foreground">
                      {haQuantoTempo(p.visto_em, agora)}
                    </span>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card className="min-w-0">
              <CardHeader>
                <CardTitle>Chat público</CardTitle>
                <CardDescription>
                  {formatarNumero(d.guardadas)} mensagens guardadas — o servidor descarta as mais
                  antigas sozinho.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-2">
                {d.chat.length === 0 && <Vazio>Nenhuma mensagem no chat.</Vazio>}
                {d.chat.map((m) => (
                  <div key={m.id} className="flex items-start gap-3 rounded-lg border border-border p-3">
                    <div className="min-w-0 flex-1">
                      <p className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <span className="font-medium text-foreground">{m.nome || m.email}</span>
                        {!!m.bloqueada && (
                          <Badge variant="destructive" className="gap-1">
                            <Ban />
                            banida
                          </Badge>
                        )}
                        <span title={formatarData(m.quando)}>{haQuantoTempo(m.quando, agora)}</span>
                      </p>
                      <p className="mt-1 break-words text-sm">{m.texto}</p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Apagar mensagem"
                      title="Apagar mensagem"
                      disabled={ocupado}
                      onClick={() => apagar(m.id)}
                      className="shrink-0 text-muted-foreground hover:text-destructive"
                    >
                      {apagando === m.id ? (
                        <Trash2 className="animate-pulse" />
                      ) : (
                        <Trash2 />
                      )}
                    </Button>
                  </div>
                ))}
              </CardContent>
            </Card>
          </section>
        )}
      </Estado>
    </>
  )
}
