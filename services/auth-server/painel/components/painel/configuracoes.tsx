'use client'

import { Monitor, Moon, Sun } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { BASE } from '@/lib/api'
import { CabecalhoDaTela, usarPainel } from './comuns'
import type { Tema } from './tema'

const ROTULOS: Record<Tema, string> = { claro: 'Claro', escuro: 'Escuro', sistema: 'Sistema' }

export function Configuracoes({
  tema,
  aoTrocarTema,
}: {
  tema: Tema
  aoTrocarTema: (tema: Tema) => void
}) {
  const { eu } = usarPainel()

  return (
    <>
      <CabecalhoDaTela
        titulo="Configurações"
        descricao="Preferências desta interface e para onde ela está falando."
      />

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>Sua conta</CardTitle>
          <CardDescription>
            É a mesma conta que você usa no jogo — o painel não tem cadastro próprio.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Campo rotulo="Nome" valor={eu.nome || '(sem nome)'} />
            <Campo rotulo="E-mail" valor={eu.email} />
          </div>

          <Separator />

          <div className="flex items-center justify-between gap-4 rounded-lg border border-border p-4">
            <div>
              <Label htmlFor="tema">Tema do painel</Label>
              <p className="mt-1 text-xs text-muted-foreground">
                Fica guardado neste navegador.
              </p>
            </div>
            <Select value={tema} onValueChange={(v) => aoTrocarTema(v as Tema)}>
              <SelectTrigger id="tema" className="w-36">
                <SelectValue>{ROTULOS[tema]}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="claro">
                    <Sun />
                    Claro
                  </SelectItem>
                  <SelectItem value="escuro">
                    <Moon />
                    Escuro
                  </SelectItem>
                  <SelectItem value="sistema">
                    <Monitor />
                    Sistema
                  </SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>

          <div className="rounded-lg border border-border p-4 text-sm">
            <p className="font-medium">Servidor de contas</p>
            <p className="mt-1 text-xs text-muted-foreground">
              O painel fala com <code className="font-mono">{BASE}</code> na mesma origem desta
              página. Trocar a VPS de endereço não exige republicar o painel.
            </p>
          </div>

          <div className="rounded-lg border border-border p-4 text-sm">
            <p className="font-medium">Sessão</p>
            <p className="mt-1 text-xs text-muted-foreground">
              O token fica na aba (sessionStorage) e some quando você a fecha — este painel costuma
              ser aberto em máquina compartilhada.
            </p>
          </div>
        </CardContent>
      </Card>
    </>
  )
}

function Campo({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="rounded-lg border border-border p-3">
      <p className="text-xs text-muted-foreground">{rotulo}</p>
      <p className="mt-1 truncate font-medium" title={valor}>
        {valor}
      </p>
    </div>
  )
}
