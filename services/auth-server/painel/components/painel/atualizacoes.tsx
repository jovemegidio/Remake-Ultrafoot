'use client'

/**
 * CANAL DE ATUALIZAÇÕES dentro do painel de administração.
 *
 * Isto existia como uma página HTML separada, servida pelo próprio serviço de
 * atualizações em /atualizacoes/painel: outra tela de login, outro visual, a
 * mesma pessoa digitando a mesma senha duas vezes. Como o canal valida o token
 * contra as sessões do servidor de contas (`conta_admin`), dava para ser uma
 * coisa só desde sempre.
 *
 * O que se edita aqui chega a quem JÁ TEM o jogo instalado, sem build:
 * identidade e escudo de clube, ficha e rosto de atleta, transferências e
 * participantes/regulamento de competição. Nada vai ao jogador até "Publicar".
 */

import { useCallback, useEffect, useState } from 'react'
import { CloudUpload, Eye, Plus, RefreshCw, Trash2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import {
  enviarAoCanal, ErroDeSessao, lerDoCanal,
  type AtributosDoCanal, type ClubeDoCanal, type JogadorDoCanal,
  type LigaDoCanal, type ResumoDoCanal,
} from '@/lib/api'
import { CabecalhoDaTela, usarPainel, Vazio } from './comuns'

type Secao = 'clubes' | 'jogadores' | 'competicoes'

const SECOES: { id: Secao; rotulo: string }[] = [
  { id: 'clubes', rotulo: 'Clubes' },
  { id: 'jogadores', rotulo: 'Jogadores' },
  { id: 'competicoes', rotulo: 'Competições' },
]

/** Lê do canal tratando sessão caída igual ao resto do painel. */
function usarCanal<T>(rota: string, ativo = true) {
  const { encerrarSessao } = usarPainel()
  const [dados, setDados] = useState<T | null>(null)
  const [erro, setErro] = useState('')
  const [carregando, setCarregando] = useState(ativo)

  const recarregar = useCallback(() => {
    if (!ativo) return
    setCarregando(true)
    lerDoCanal<T>(rota)
      .then((r) => { setDados(r); setErro('') })
      .catch((e: Error) => {
        if (e instanceof ErroDeSessao) return encerrarSessao(e.message)
        setErro(e.message)
      })
      .finally(() => setCarregando(false))
  }, [rota, ativo, encerrarSessao])

  useEffect(() => { recarregar() }, [recarregar])
  return { dados, erro, carregando, recarregar }
}

export function Atualizacoes() {
  const [secao, setSecao] = useState<Secao>('clubes')
  const [notas, setNotas] = useState('')
  const [aviso, setAviso] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const resumo = usarCanal<ResumoDoCanal>('/admin/resumo')

  async function agir(rota: string, corpo: Record<string, unknown>, comoDizer: (r: never) => string) {
    setOcupado(true)
    setAviso('')
    try {
      const r = await enviarAoCanal<never>(rota, corpo)
      setAviso(comoDizer(r))
      resumo.recarregar()
    } catch (e) {
      setAviso((e as Error).message)
    } finally {
      setOcupado(false)
    }
  }

  const d = resumo.dados

  return (
    <>
      <CabecalhoDaTela
        titulo="Canal de atualizações"
        descricao="Corrige clube, atleta e competição em quem já tem o jogo instalado, sem publicar versão nova."
        acao={
          <Button variant="outline" size="sm" onClick={() => resumo.recarregar()}>
            <RefreshCw className="size-4" /> Recarregar
          </Button>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>Situação</CardTitle>
          <CardDescription>
            {d ? `No ar: versão ${d.versao_publicada}` : 'carregando…'}
            {d?.ultima ? ` — ${d.ultima.notas || 'sem notas'}` : ''}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {resumo.erro && <p className="text-sm text-destructive">{resumo.erro}</p>}
          {d && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
              {([
                ['Clubes', d.clubes], ['Atletas', d.jogadores],
                ['Transferências', d.transferencias], ['Competições', d.ligas],
                ['Imagens', d.imagens],
              ] as const).map(([rotulo, valor]) => (
                <div key={rotulo} className="rounded-lg border p-3">
                  <p className="text-2xl font-semibold tabular-nums">{valor}</p>
                  <p className="text-xs text-muted-foreground">{rotulo}</p>
                </div>
              ))}
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="canal-notas">Notas desta publicação (o jogador lê)</Label>
            <Textarea
              id="canal-notas" rows={2} value={notas}
              onChange={(e) => setNotas(e.target.value)}
              placeholder="Ex.: janela fechada, escudos do Brasileirão atualizados"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline" disabled={ocupado}
              onClick={() => agir('/admin/previa', { notas }, (r: never) => {
                const p = r as unknown as { versao: number; bytes: number; clubes: number; jogadores: number; ligas: number }
                return `Prévia: versão ${p.versao} — ${p.clubes} clubes, ${p.jogadores} atletas, ${p.ligas} competições, ${Math.round(p.bytes / 1024)} KB.`
              })}
            >
              <Eye className="size-4" /> Ver prévia
            </Button>
            <Button
              disabled={ocupado}
              onClick={() => {
                // Publicar chega a TODO mundo de uma vez e não tem desfazer:
                // a confirmação é barata perto do estrago.
                if (!window.confirm('Publicar agora para todos os jogadores?')) return
                return agir('/admin/publicar', { notas }, (r: never) => {
                  const p = r as unknown as { versao: number; clubes: number; bytes: number }
                  return `Publicado: versão ${p.versao} — ${p.clubes} clubes, ${Math.round(p.bytes / 1024)} KB.`
                })
              }}
            >
              <CloudUpload className="size-4" /> Publicar para os jogadores
            </Button>
          </div>
          {aviso && <p className="text-sm text-muted-foreground">{aviso}</p>}
        </CardContent>
      </Card>

      <div className="flex gap-2 border-b">
        {SECOES.map((s) => (
          <button
            key={s.id} onClick={() => setSecao(s.id)}
            className={
              'border-b-2 px-3 py-2 text-sm font-medium transition-colors ' +
              (secao === s.id
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground')
            }
          >
            {s.rotulo}
          </button>
        ))}
      </div>

      {secao === 'clubes' && <Clubes aoMudar={resumo.recarregar} />}
      {secao === 'jogadores' && <Jogadores aoMudar={resumo.recarregar} />}
      {secao === 'competicoes' && <Competicoes aoMudar={resumo.recarregar} />}
    </>
  )
}

/**
 * Arquivo escolhido → data URL, que é como o servidor recebe imagem.
 *
 * Devolve null quando não há arquivo: assim quem salva sem trocar a imagem
 * simplesmente não envia o campo, e o servidor preserva a que já existe. Enviar
 * string vazia apagaria o escudo de quem só quis corrigir o nome.
 */
function lerArquivo(input: HTMLInputElement | null): Promise<string | null> {
  const arquivo = input?.files?.[0]
  if (!arquivo) return Promise.resolve(null)
  return new Promise((resolver) => {
    const leitor = new FileReader()
    leitor.onload = () => resolver(String(leitor.result))
    leitor.onerror = () => resolver(null)
    leitor.readAsDataURL(arquivo)
  })
}

/** Etiqueta de licença — o mesmo símbolo nas três listas. */
function Licenca({ ligada }: { ligada: boolean }) {
  return ligada
    ? <Badge variant="secondary">licenciado</Badge>
    : <Badge variant="outline">genérico</Badge>
}

// ─── Clubes ──────────────────────────────────────────────────────────────────
function Clubes({ aoMudar }: { aoMudar: () => void }) {
  const [busca, setBusca] = useState('')
  const [filtro, setFiltro] = useState('')
  useEffect(() => {
    const id = window.setTimeout(() => setFiltro(busca), 350)
    return () => window.clearTimeout(id)
  }, [busca])

  const lista = usarCanal<{ itens: ClubeDoCanal[] }>(
    '/admin/clubes?busca=' + encodeURIComponent(filtro))

  return (
    <Card>
      <CardHeader>
        <CardTitle>Clubes</CardTitle>
        <CardDescription>
          Sem licença o canal não envia escudo nem arte de uniforme; as cores continuam,
          para o jogo desenhar a camisa genérica.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <Input placeholder="Buscar por nome ou file_key…" value={busca}
          onChange={(e) => setBusca(e.target.value)} />
        {lista.erro && <p className="text-sm text-destructive">{lista.erro}</p>}
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10" />
              <TableHead>Clube</TableHead>
              <TableHead>file_key</TableHead>
              <TableHead>Licença</TableHead>
              <TableHead className="w-24" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {(lista.dados?.itens ?? []).map((c) => (
              <TableRow key={c.file_key}>
                <TableCell>
                  {c.escudo
                    // eslint-disable-next-line @next/next/no-img-element
                    ? <img src={c.escudo} alt="" className="size-7 object-contain" />
                    : null}
                </TableCell>
                <TableCell>{c.nome || <span className="text-muted-foreground">sem nome</span>}</TableCell>
                <TableCell className="font-mono text-xs">{c.file_key}</TableCell>
                <TableCell><Licenca ligada={c.licenciado} /></TableCell>
                <TableCell>
                  <BotaoLicenca
                    ligada={c.licenciado}
                    aoTrocar={async (valor) => {
                      // Só a licença muda: os demais campos NÃO são enviados de
                      // volta porque o servidor sobrescreve o que recebe, e um
                      // envio parcial apagaria nome, cores e estádio.
                      await enviarAoCanal('/admin/clube/salvar', {
                        file_key: c.file_key, nome: c.nome, curto: c.curto,
                        cor1: c.cor1, cor2: c.cor2, licenciado: valor,
                      })
                      lista.recarregar(); aoMudar()
                    }}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {!lista.carregando && (lista.dados?.itens ?? []).length === 0 && <Vazio>Nenhum clube encontrado.</Vazio>}
      </CardContent>
    </Card>
  )
}

function BotaoLicenca({ ligada, aoTrocar }: { ligada: boolean; aoTrocar: (v: boolean) => Promise<void> }) {
  const [ocupado, setOcupado] = useState(false)
  return (
    <Button
      size="sm" variant="outline" disabled={ocupado}
      onClick={async () => { setOcupado(true); try { await aoTrocar(!ligada) } finally { setOcupado(false) } }}
    >
      {ligada ? 'Tirar licença' : 'Licenciar'}
    </Button>
  )
}

// ─── Jogadores ───────────────────────────────────────────────────────────────
function Jogadores({ aoMudar }: { aoMudar: () => void }) {
  const [clube, setClube] = useState('')
  const [aplicado, setAplicado] = useState('')
  const [edicao, setEdicao] = useState<JogadorDoCanal | null>(null)
  const lista = usarCanal<{ itens: JogadorDoCanal[] }>(
    '/admin/jogadores?clube=' + encodeURIComponent(aplicado))

  return (
    <Card>
      <CardHeader>
        <CardTitle>Atletas</CardTitle>
        <CardDescription>
          Sem clube informado, mostra os 200 editados mais recentemente. Sem licença o canal
          não envia o rosto.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex gap-2">
          <Input placeholder="file_key do clube (ex.: palmeiras)" value={clube}
            onChange={(e) => setClube(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') setAplicado(clube.trim()) }} />
          <Button variant="outline" onClick={() => setAplicado(clube.trim())}>Listar</Button>
        </div>
        {lista.erro && <p className="text-sm text-destructive">{lista.erro}</p>}
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10" />
              <TableHead>Atleta</TableHead>
              <TableHead>Clube</TableHead>
              <TableHead>Pos</TableHead>
              <TableHead>Licença</TableHead>
              <TableHead className="w-24" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {(lista.dados?.itens ?? []).map((j) => (
              <TableRow key={j.chave}>
                <TableCell>
                  {j.foto
                    // eslint-disable-next-line @next/next/no-img-element
                    ? <img src={j.foto} alt="" className="size-7 rounded object-cover" />
                    : null}
                </TableCell>
                <TableCell>{j.nome || j.nome_original}</TableCell>
                <TableCell className="font-mono text-xs">{j.file_key}</TableCell>
                <TableCell>{j.pos}</TableCell>
                <TableCell><Licenca ligada={j.licenciado} /></TableCell>
                <TableCell>
                  <Button size="sm" variant="outline" onClick={() => setEdicao(j)}>Editar</Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {!lista.carregando && (lista.dados?.itens ?? []).length === 0 && <Vazio>Nenhum atleta editado ainda.</Vazio>}
      </CardContent>
      {edicao && (
        <EditorDeAtleta
          atleta={edicao}
          aoFechar={() => setEdicao(null)}
          aoSalvar={() => { setEdicao(null); lista.recarregar(); aoMudar() }}
        />
      )}
    </Card>
  )
}

const ATRIBUTOS: { campo: keyof AtributosDoCanal; rotulo: string }[] = [
  { campo: 'pace', rotulo: 'Velocidade' },
  { campo: 'shooting', rotulo: 'Finalização' },
  { campo: 'passing', rotulo: 'Passe' },
  { campo: 'dribbling', rotulo: 'Drible' },
  { campo: 'defending', rotulo: 'Defesa' },
  { campo: 'physical', rotulo: 'Físico' },
]

function EditorDeAtleta({ atleta, aoFechar, aoSalvar }: {
  atleta: JogadorDoCanal; aoFechar: () => void; aoSalvar: () => void
}) {
  const [f, setF] = useState<JogadorDoCanal>(atleta)
  const [erro, setErro] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const [foto, setFoto] = useState<HTMLInputElement | null>(null)

  const atributo = (campo: keyof AtributosDoCanal, valor: number | undefined) =>
    setF({ ...f, atributos: { ...f.atributos, [campo]: valor } })

  async function salvar() {
    setOcupado(true); setErro('')
    try {
      const corpo: Record<string, unknown> = {
        file_key: f.file_key, nome_original: f.nome_original,
        nome: f.nome || null, pos: f.pos || null, idade: f.idade, base: f.base,
        nac: f.nac || null, licenciado: f.licenciado,
        nome_generico: f.nome_generico || null, atributos: f.atributos,
      }
      const nova = await lerArquivo(foto)
      if (nova) corpo.foto_data = nova
      await enviarAoCanal('/admin/jogador/salvar', corpo)
      aoSalvar()
    } catch (e) {
      setErro((e as Error).message)
    } finally {
      setOcupado(false)
    }
  }

  return (
    <CardContent className="space-y-4 border-t pt-4">
      <div className="flex items-center gap-3">
        {f.foto
          // eslint-disable-next-line @next/next/no-img-element
          ? <img src={f.foto} alt="" className="size-12 rounded object-cover" />
          : null}
        <div>
          <p className="font-medium">{f.nome || f.nome_original}</p>
          <p className="font-mono text-xs text-muted-foreground">{f.chave}</p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-1">
          <Label htmlFor="j-nome">Nome exibido</Label>
          <Input id="j-nome" value={f.nome ?? ''} onChange={(e) => setF({ ...f, nome: e.target.value })} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="j-pos">Posição</Label>
          <Input id="j-pos" value={f.pos ?? ''} placeholder="ATA, MEI, ZAG…"
            onChange={(e) => setF({ ...f, pos: e.target.value })} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="j-nac">Nacionalidade</Label>
          <Input id="j-nac" value={f.nac ?? ''} onChange={(e) => setF({ ...f, nac: e.target.value })} />
        </div>
        <CampoNumero rotulo="Idade" valor={f.idade ?? undefined}
          aoMudar={(v) => setF({ ...f, idade: v ?? null })} />
        <CampoNumero rotulo="Força geral" valor={f.base ?? undefined}
          aoMudar={(v) => setF({ ...f, base: v ?? null })} />
        <div className="space-y-1">
          <Label htmlFor="j-foto">Rosto</Label>
          <Input id="j-foto" type="file" accept="image/*" ref={setFoto} />
        </div>
      </div>

      <div>
        <p className="mb-2 text-sm font-medium">Atributos</p>
        <p className="mb-2 text-xs text-muted-foreground">
          De 0 a 99. Em branco, o jogo usa o valor derivado da força e da posição — não zera.
        </p>
        <div className="grid gap-3 sm:grid-cols-3">
          {ATRIBUTOS.map((a) => (
            <CampoNumero key={a.campo} rotulo={a.rotulo}
              valor={f.atributos[a.campo] as number | undefined}
              aoMudar={(v) => atributo(a.campo, v)} />
          ))}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor="j-pe">Pé preferido</Label>
          <select id="j-pe" className="h-9 w-full rounded-md border bg-transparent px-3 text-sm"
            value={f.atributos.preferredFoot ?? ''}
            onChange={(e) => setF({ ...f, atributos: { ...f.atributos, preferredFoot: (e.target.value || undefined) as AtributosDoCanal['preferredFoot'] } })}>
            <option value="">— não definir —</option>
            <option value="Direita">Direita</option>
            <option value="Esquerda">Esquerda</option>
            <option value="Ambidestro">Ambidestro</option>
          </select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="j-rep">Reputação</Label>
          <select id="j-rep" className="h-9 w-full rounded-md border bg-transparent px-3 text-sm"
            value={f.atributos.reputation ?? ''}
            onChange={(e) => setF({ ...f, atributos: { ...f.atributos, reputation: (e.target.value || undefined) as AtributosDoCanal['reputation'] } })}>
            <option value="">— não definir —</option>
            <option value="normal">Normal</option>
            <option value="estrela">Estrela</option>
            <option value="top_mundial">Top mundial</option>
          </select>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <input id="j-lic" type="checkbox" checked={f.licenciado}
          onChange={(e) => setF({ ...f, licenciado: e.target.checked })} />
        <Label htmlFor="j-lic">Licenciado — usa nome e rosto reais</Label>
      </div>
      {!f.licenciado && (
        <div className="space-y-1">
          <Label htmlFor="j-gen">Nome genérico</Label>
          <Input id="j-gen" value={f.nome_generico ?? ''}
            placeholder="Vazio = o jogo usa o nome do próprio seed"
            onChange={(e) => setF({ ...f, nome_generico: e.target.value })} />
        </div>
      )}

      {erro && <p className="text-sm text-destructive">{erro}</p>}
      <div className="flex flex-wrap gap-2">
        <Button onClick={salvar} disabled={ocupado}>Salvar atleta</Button>
        <Button variant="outline" onClick={aoFechar}>Fechar</Button>
      </div>
    </CardContent>
  )
}

// ─── Competições ─────────────────────────────────────────────────────────────
const VAZIA: LigaDoCanal = {
  competicao: '', nome: null, nome_generico: null, licenciado: true,
  logo: null, clubes: [], regulamento: {}, rascunho: false,
}

function Competicoes({ aoMudar }: { aoMudar: () => void }) {
  const lista = usarCanal<{ itens: LigaDoCanal[] }>('/admin/ligas')
  const [edicao, setEdicao] = useState<LigaDoCanal | null>(null)
  const [erro, setErro] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const [logo, setLogo] = useState<HTMLInputElement | null>(null)

  async function salvar() {
    if (!edicao) return
    const clubes = edicao.clubes.map((c) => c.trim()).filter(Boolean)
    // Repetido aqui vira clube jogando duas vezes na mesma tabela; o servidor
    // aceitaria e o erro só apareceria na classificação.
    if (clubes.length !== new Set(clubes).size) {
      setErro('Há file_key repetido entre os participantes.')
      return
    }
    setOcupado(true); setErro('')
    try {
      const corpo: Record<string, unknown> = { ...edicao, clubes }
      const nova = await lerArquivo(logo)
      if (nova) corpo.logo_data = nova
      await enviarAoCanal('/admin/liga/salvar', corpo)
      setEdicao(null); lista.recarregar(); aoMudar()
    } catch (e) {
      setErro((e as Error).message)
    } finally {
      setOcupado(false)
    }
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Competições</CardTitle>
          <CardDescription>
            Participantes e regulamento chegam pelo canal: é assim que promovido e rebaixado
            entram sem versão nova do jogo.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button variant="outline" size="sm" onClick={() => setEdicao({ ...VAZIA })}>
            <Plus className="size-4" /> Nova competição
          </Button>
          {lista.erro && <p className="text-sm text-destructive">{lista.erro}</p>}
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Competição</TableHead>
                <TableHead>Clubes</TableHead>
                <TableHead>Formato</TableHead>
                <TableHead>Licença</TableHead>
                <TableHead className="w-20" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {(lista.dados?.itens ?? []).map((l) => (
                <TableRow key={l.competicao}>
                  <TableCell>
                    {l.nome || l.competicao}
                    <span className="block font-mono text-xs text-muted-foreground">{l.competicao}</span>
                  </TableCell>
                  <TableCell>{l.clubes.length}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {[
                      l.regulamento.turnos === 2 ? 'ida e volta' : l.regulamento.turnos === 1 ? 'turno único' : '',
                      l.regulamento.rebaixamentos ? `${l.regulamento.rebaixamentos} caem` : '',
                    ].filter(Boolean).join(' · ') || '—'}
                  </TableCell>
                  <TableCell><Licenca ligada={l.licenciado} /></TableCell>
                  <TableCell>
                    <Button size="sm" variant="outline" onClick={() => setEdicao(l)}>Editar</Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {!lista.carregando && (lista.dados?.itens ?? []).length === 0 && (
            <Vazio>Nenhuma competição cadastrada. Use “Nova competição”.</Vazio>
          )}
        </CardContent>
      </Card>

      {edicao && (
        <Card>
          <CardHeader>
            <CardTitle>{edicao.competicao || 'Nova competição'}</CardTitle>
            <CardDescription>
              A chave precisa ser idêntica à que o jogo usa. Chave diferente = regulamento que
              nunca encontra o torneio.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="c-chave">Chave</Label>
                <Input id="c-chave" value={edicao.competicao} placeholder="serie_a"
                  // A chave é a identidade da linha: deixar renomear criaria OUTRA.
                  disabled={Boolean(lista.dados?.itens.some((x) => x.competicao === edicao.competicao))}
                  onChange={(e) => setEdicao({ ...edicao, competicao: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="c-nome">Nome exibido</Label>
                <Input id="c-nome" value={edicao.nome ?? ''}
                  onChange={(e) => setEdicao({ ...edicao, nome: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="c-logo">Logo da competição</Label>
                <Input id="c-logo" type="file" accept="image/*" ref={setLogo} />
              </div>
              <div className="flex items-end">
                {edicao.logo
                  // eslint-disable-next-line @next/next/no-img-element
                  ? <img src={edicao.logo} alt="" className="h-12 object-contain" />
                  : <span className="text-xs text-muted-foreground">sem logo</span>}
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <CampoNumero rotulo="Turnos (1 ou 2)" valor={edicao.regulamento.turnos}
                aoMudar={(v) => setEdicao({ ...edicao, regulamento: { ...edicao.regulamento, turnos: v } })} />
              <CampoNumero rotulo="Caem" valor={edicao.regulamento.rebaixamentos}
                aoMudar={(v) => setEdicao({ ...edicao, regulamento: { ...edicao.regulamento, rebaixamentos: v } })} />
              <CampoNumero rotulo="Pontos por vitória" valor={edicao.regulamento.pontosVitoria}
                aoMudar={(v) => setEdicao({ ...edicao, regulamento: { ...edicao.regulamento, pontosVitoria: v } })} />
            </div>
            <p className="text-xs text-muted-foreground">
              <b>“Caem” manda.</b> Na pirâmide o mesmo número é o rebaixamento de uma divisão e o
              acesso da de baixo — editar as duas pontas em separado encolheria a primeira divisão
              uma vaga por temporada, em silêncio. <b>Rodadas</b> e <b>mata-mata</b> ainda não são
              aplicados pelo jogo.
            </p>

            <div className="space-y-1">
              <Label htmlFor="c-clubes">Participantes — um file_key por linha</Label>
              <Textarea id="c-clubes" rows={8} value={edicao.clubes.join('\n')}
                onChange={(e) => setEdicao({ ...edicao, clubes: e.target.value.split('\n') })} />
              <p className="text-xs text-muted-foreground">
                {edicao.clubes.filter((c) => c.trim()).length} participantes
              </p>
            </div>

            <div className="flex items-center gap-2">
              <input id="c-lic" type="checkbox" checked={edicao.licenciado}
                onChange={(e) => setEdicao({ ...edicao, licenciado: e.target.checked })} />
              <Label htmlFor="c-lic">Licenciada — usa nome e logo reais</Label>
            </div>
            {!edicao.licenciado && (
              <div className="space-y-1">
                <Label htmlFor="c-gen">Nome genérico</Label>
                <Input id="c-gen" value={edicao.nome_generico ?? ''}
                  onChange={(e) => setEdicao({ ...edicao, nome_generico: e.target.value })} />
              </div>
            )}

            {erro && <p className="text-sm text-destructive">{erro}</p>}
            <div className="flex flex-wrap gap-2">
              <Button onClick={salvar} disabled={ocupado}>Salvar competição</Button>
              <Button variant="outline" onClick={() => { setEdicao(null); setErro('') }}>Fechar</Button>
              {lista.dados?.itens.some((x) => x.competicao === edicao.competicao) && (
                <Button
                  variant="outline" disabled={ocupado}
                  onClick={async () => {
                    if (!window.confirm('Remover esta competição do canal?')) return
                    await enviarAoCanal('/admin/liga/remover', { competicao: edicao.competicao })
                    setEdicao(null); lista.recarregar(); aoMudar()
                  }}
                >
                  <Trash2 className="size-4" /> Remover
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </>
  )
}

function CampoNumero({ rotulo, valor, aoMudar }: {
  rotulo: string; valor: number | undefined; aoMudar: (v: number | undefined) => void
}) {
  return (
    <div className="space-y-1">
      <Label>{rotulo}</Label>
      <Input
        type="number" value={valor ?? ''}
        // Campo vazio precisa virar `undefined`, e não 0: o servidor ignora o
        // ausente e mantém o que o jogo já usa, enquanto 0 seria uma ordem.
        onChange={(e) => aoMudar(e.target.value === '' ? undefined : Number(e.target.value))}
      />
    </div>
  )
}
