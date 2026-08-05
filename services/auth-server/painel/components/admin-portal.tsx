'use client'

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react'
import {
  ChevronDown,
  Eye,
  EyeOff,
  FileClock,
  LayoutDashboard,
  Loader2,
  LockKeyhole,
  LogOut,
  Menu,
  ReceiptText,
  Search,
  Settings,
  Shield,
  ShieldCheck,
  UserRoundCog,
  Users,
  WalletCards,
  Wifi,
  X,
} from 'lucide-react'
import { toast } from 'sonner'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Toaster } from '@/components/ui/sonner'
import { confirmarSessao, entrar, sair, type Eu } from '@/lib/api'
import { iniciais } from '@/lib/formato'
import { Auditoria } from './painel/auditoria'
import { ContextoDoPainel } from './painel/comuns'
import { Configuracoes } from './painel/configuracoes'
import { Economia } from './painel/economia'
import { Equipe } from './painel/equipe'
import { FcHub } from './painel/hub'
import { Jogadores } from './painel/jogadores'
import { Recibos } from './painel/recibos'
import { usarTema, type Tema } from './painel/tema'
import { VisaoGeral } from './painel/visao-geral'

// `basePath` do Next nao alcanca <img src>: o caminho do logo precisa carregar
// o prefixo na mao, senao a imagem some quando o painel sai da raiz do site.
const PREFIXO = process.env.NEXT_PUBLIC_BASE_PATH || ''
const LOGO = `${PREFIXO}/logo-ultrafoot.png`

const TELAS = [
  { rotulo: 'Visão geral', icone: LayoutDashboard },
  { rotulo: 'Jogadores', icone: Users },
  { rotulo: 'FC Hub', icone: Wifi },
  { rotulo: 'Economia', icone: WalletCards },
  { rotulo: 'Recibos', icone: ReceiptText },
  { rotulo: 'Equipe admin', icone: UserRoundCog },
  { rotulo: 'Auditoria', icone: FileClock },
]

function Marca({ compacto = false }: { compacto?: boolean }) {
  return (
    <span className={`relative block shrink-0 overflow-hidden ${compacto ? 'h-5 w-28' : 'h-8 w-40'}`}>
      {/* A marca do jogo e BRANCA e sem fundo — no tema claro ela sumia na
          pagina. Como e monocromatica, inverter resolve sem precisar de um
          segundo arquivo para manter em dia. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={LOGO}
        alt="ULTRAFOOT"
        className="absolute left-1/2 top-1/2 w-full -translate-x-1/2 -translate-y-1/2 invert dark:invert-0"
      />
    </span>
  )
}

// ─── Login ───────────────────────────────────────────────────────────────────

function TelaDeLogin({ aoEntrar, aviso }: { aoEntrar: (eu: Eu) => void; aviso: string }) {
  const [mostrarSenha, setMostrarSenha] = useState(false)
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState(aviso)
  const [ocupado, setOcupado] = useState(false)

  useEffect(() => setErro(aviso), [aviso])

  async function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    setErro('')
    setOcupado(true)
    try {
      aoEntrar(await entrar(email, senha))
    } catch (e) {
      setErro((e as Error).message)
    } finally {
      setOcupado(false)
    }
  }

  return (
    <main className="flex min-h-svh bg-background">
      <section className="relative hidden flex-1 overflow-hidden border-r border-border bg-card lg:flex lg:flex-col lg:justify-between lg:p-12">
        <div className="flex items-center gap-3">
          <Marca />
          <Badge variant="outline">ADMIN</Badge>
        </div>
        <div className="relative flex max-w-xl flex-col gap-6">
          <div className="flex size-14 items-center justify-center rounded-2xl border border-primary/30 bg-primary/10 text-primary">
            <ShieldCheck className="size-7" aria-hidden="true" />
          </div>
          <h1 className="text-balance text-5xl font-semibold tracking-tight">
            Controle total. Decisões registradas.
          </h1>
          <p className="max-w-lg text-pretty text-lg leading-relaxed text-muted-foreground">
            Administração das contas do Ultrafoot: quem joga, quem comprou e o que a equipe fez.
          </p>
        </div>
        <p className="text-sm text-muted-foreground">© 2026 ULTRAFOOT. Acesso restrito à equipe.</p>
      </section>

      <section className="flex w-full items-center justify-center p-6 lg:max-w-xl lg:p-12">
        <div className="flex w-full max-w-sm flex-col gap-8">
          <div className="flex items-center gap-3 lg:hidden">
            <Marca />
            <Badge variant="outline">ADMIN</Badge>
          </div>
          <div className="flex flex-col gap-2">
            <Badge className="w-fit" variant="secondary">
              <LockKeyhole data-icon="inline-start" />
              Área restrita
            </Badge>
            <h2 className="text-balance text-3xl font-semibold tracking-tight">Acesse o painel</h2>
            <p className="text-pretty text-sm leading-relaxed text-muted-foreground">
              Entre com a mesma conta que você usa no jogo. Ela precisa ter permissão de
              administrador.
            </p>
          </div>
          <form className="flex flex-col gap-5" onSubmit={enviar}>
            <div className="flex flex-col gap-2">
              <Label htmlFor="email">E-mail</Label>
              <Input
                id="email"
                type="email"
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="voce@exemplo.com"
                required
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="senha">Senha</Label>
              <div className="relative">
                <Input
                  id="senha"
                  type={mostrarSenha ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                  className="pr-11"
                  required
                />
                <button
                  type="button"
                  onClick={() => setMostrarSenha(!mostrarSenha)}
                  className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-muted-foreground"
                  aria-label={mostrarSenha ? 'Ocultar senha' : 'Mostrar senha'}
                >
                  {mostrarSenha ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>
            {erro && (
              <p role="alert" className="text-sm text-destructive">
                {erro}
              </p>
            )}
            <Button type="submit" size="lg" disabled={ocupado} className="w-full">
              {ocupado ? 'Verificando acesso...' : 'Entrar no painel'}
            </Button>
          </form>
          <div className="flex items-center justify-center gap-2 text-center text-xs text-muted-foreground">
            <Shield className="size-4 shrink-0" aria-hidden="true" />
            <span>Quem entra, o que muda e por quê fica registrado na auditoria.</span>
          </div>
        </div>
      </section>
    </main>
  )
}

// ─── Painel ──────────────────────────────────────────────────────────────────

function Lateral({
  tela,
  irPara,
  aberta,
  fechar,
  eu,
}: {
  tela: string
  irPara: (tela: string) => void
  aberta: boolean
  fechar: () => void
  eu: Eu
}) {
  return (
    <>
      {aberta && (
        <button
          type="button"
          aria-label="Fechar menu"
          onClick={fechar}
          className="fixed inset-0 z-30 bg-black/40 md:hidden"
        />
      )}
      <aside
        className={`${aberta ? 'flex' : 'hidden'} fixed inset-y-0 left-0 z-40 w-64 flex-col border-r border-sidebar-border bg-sidebar md:flex`}
      >
        <div className="flex h-20 items-center justify-between px-6">
          <div className="flex items-center gap-2">
            <Marca compacto />
            <span className="text-[10px] font-semibold tracking-widest text-primary">ADMIN</span>
          </div>
          <Button
            variant="ghost"
            size="icon-sm"
            className="md:hidden"
            onClick={fechar}
            aria-label="Fechar menu"
          >
            <X />
          </Button>
        </div>
        <nav className="flex flex-1 flex-col gap-1 overflow-y-auto px-3" aria-label="Navegação principal">
          <p className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            Operações
          </p>
          {TELAS.map((item) => (
            <button
              key={item.rotulo}
              type="button"
              aria-current={tela === item.rotulo ? 'page' : undefined}
              onClick={() => irPara(item.rotulo)}
              className={`flex h-10 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors ${
                tela === item.rotulo
                  ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                  : 'text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground'
              }`}
            >
              <item.icone className="size-4" aria-hidden="true" />
              <span>{item.rotulo}</span>
            </button>
          ))}
        </nav>
        <div className="p-3">
          <div className="flex items-center gap-3 rounded-xl border border-sidebar-border bg-sidebar-accent/40 p-3">
            <Avatar className="size-9">
              <AvatarFallback>{iniciais(eu.nome, eu.email)}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{eu.nome || '(sem nome)'}</p>
              <p className="truncate text-xs text-muted-foreground">{eu.email}</p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label="Abrir configurações"
              onClick={() => irPara('Configurações')}
            >
              <Settings />
            </Button>
          </div>
        </div>
      </aside>
    </>
  )
}

function Painel({
  eu,
  aoSair,
  tema,
  trocarTema,
}: {
  eu: Eu
  aoSair: () => void
  tema: Tema
  trocarTema: (tema: Tema) => void
}) {
  const [tela, setTela] = useState('Visão geral')
  const [menuAberto, setMenuAberto] = useState(false)
  const [buscaInicial, setBuscaInicial] = useState('')
  const [buscaDoTopo, setBuscaDoTopo] = useState('')

  const irPara = useCallback((destino: string) => {
    setTela(destino)
    setMenuAberto(false)
    setBuscaInicial('')
  }, [])

  function buscarNoTopo(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    setBuscaInicial(buscaDoTopo)
    setTela('Jogadores')
    setMenuAberto(false)
  }

  return (
    <div className="min-h-svh bg-background">
      <Lateral
        tela={tela}
        irPara={irPara}
        aberta={menuAberto}
        fechar={() => setMenuAberto(false)}
        eu={eu}
      />
      <div className="md:pl-64">
        <header className="sticky top-0 z-20 flex h-20 items-center justify-between gap-3 border-b border-border bg-background/95 px-4 backdrop-blur md:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <Button
              variant="outline"
              size="icon"
              className="md:hidden"
              onClick={() => setMenuAberto(true)}
              aria-label="Abrir menu"
            >
              <Menu />
            </Button>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{tela}</p>
              <p className="hidden text-xs text-muted-foreground sm:block">
                Central de operações ULTRAFOOT
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <form onSubmit={buscarNoTopo} className="relative hidden lg:block">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={buscaDoTopo}
                onChange={(e) => setBuscaDoTopo(e.target.value)}
                placeholder="Buscar jogador..."
                aria-label="Buscar jogador"
                className="w-56 pl-8"
              />
            </form>
            <DropdownMenu>
              <DropdownMenuTrigger render={<Button variant="ghost" className="gap-2 px-2" />}>
                <Avatar className="size-8">
                  <AvatarFallback>{iniciais(eu.nome, eu.email)}</AvatarFallback>
                </Avatar>
                <ChevronDown />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuGroup>
                  <DropdownMenuItem onClick={() => irPara('Configurações')}>
                    <Settings />
                    Configurações
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={aoSair}>
                    <LogOut />
                    Sair do painel
                  </DropdownMenuItem>
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        <main className="flex flex-col gap-6 p-4 md:p-8">
          {tela === 'Visão geral' && <VisaoGeral irPara={irPara} />}
          {/* `key` remonta a tela quando a busca do topo muda: sem isso o campo
              de busca de Jogadores continuaria com o texto anterior. */}
          {tela === 'Jogadores' && <Jogadores key={buscaInicial} buscaInicial={buscaInicial} />}
          {tela === 'FC Hub' && <FcHub />}
          {tela === 'Economia' && <Economia />}
          {tela === 'Recibos' && <Recibos />}
          {tela === 'Equipe admin' && <Equipe />}
          {tela === 'Auditoria' && <Auditoria />}
          {tela === 'Configurações' && <Configuracoes tema={tema} aoTrocarTema={trocarTema} />}
        </main>
      </div>
    </div>
  )
}

// ─── Raiz ────────────────────────────────────────────────────────────────────

/** 'sistema' e o mesmo conceito de "system" do sonner — so o nome muda. */
const TEMA_DO_AVISO = { claro: 'light', escuro: 'dark', sistema: 'system' } as const

export function AdminPortal() {
  const [eu, setEu] = useState<Eu | null>(null)
  const [verificando, setVerificando] = useState(true)
  const [aviso, setAviso] = useState('')
  // O tema fica aqui, e nao dentro do painel, porque a tela de login e os avisos
  // do sonner tambem precisam dele.
  const [tema, trocarTema] = usarTema()

  // Sessao ainda viva nesta aba: pula o login. Se o token nao valer mais — ou a
  // conta tiver perdido o poder de admin — cai para o login em vez de montar um
  // painel que falha em cada tela.
  useEffect(() => {
    let vivo = true
    confirmarSessao()
      .then((conta) => {
        if (vivo) setEu(conta)
      })
      .finally(() => {
        if (vivo) setVerificando(false)
      })
    return () => {
      vivo = false
    }
  }, [])

  const encerrarSessao = useCallback((motivo: string) => {
    setEu(null)
    setAviso(motivo)
    void sair()
    toast.error(motivo)
  }, [])

  const contexto = useMemo(() => (eu ? { eu, encerrarSessao } : null), [eu, encerrarSessao])

  return (
    <>
      {verificando ? (
        <main className="flex min-h-svh items-center justify-center gap-2 bg-background text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Verificando sessão...
        </main>
      ) : contexto ? (
        <ContextoDoPainel.Provider value={contexto}>
          <Painel
            eu={contexto.eu}
            tema={tema}
            trocarTema={trocarTema}
            aoSair={async () => {
              await sair()
              setEu(null)
              setAviso('')
            }}
          />
        </ContextoDoPainel.Provider>
      ) : (
        <TelaDeLogin
          aoEntrar={(conta) => {
            setAviso('')
            setEu(conta)
          }}
          aviso={aviso}
        />
      )}
      <Toaster richColors position="top-right" theme={TEMA_DO_AVISO[tema]} />
    </>
  )
}
