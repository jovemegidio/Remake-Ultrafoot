'use client'

import { FormEvent, useMemo, useState } from 'react'
import { Printer, ReceiptText } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { chamar, ErroDeSessao, type Recibo, type ReciboEmitido, type Recibos as Dados } from '@/lib/api'
import { formatarData, formatarDinheiro } from '@/lib/formato'
import { BotaoRecarregar, CabecalhoDaTela, Estado, usarDados, usarPainel, Vazio } from './comuns'

// O recibo e uma pagina estatica servida ao lado do painel (ver deploy-painel.sh,
// que copia public/recibo/ para dentro do pacote). Sai de `basePath` porque o
// painel nao mora na raiz do site.
const PAGINA_DO_RECIBO = `${process.env.NEXT_PUBLIC_BASE_PATH || ''}/recibo/`

/** "30", "30,00" e "R$ 30,00" viram 3000. Devolve null quando nao da para ler. */
function paraCentavos(texto: string): number | null {
  const limpo = texto.replace(/[^\d,.-]/g, '').replace(',', '.')
  if (!limpo) return null
  const n = Number(limpo)
  if (!isFinite(n) || n <= 0) return null
  // Arredonda ANTES de virar inteiro: 30.15 * 100 da 3014.9999... em ponto
  // flutuante, e truncar tiraria um centavo do recibo.
  return Math.round(n * 100)
}

/** Data do <input type="date"> → segundos. Meio-dia UTC para o dia impresso nao
 *  escorregar para o anterior em nenhum fuso. */
function paraSegundos(dia: string): number | undefined {
  if (!dia) return undefined
  const t = Date.parse(`${dia}T12:00:00Z`)
  return isNaN(t) ? undefined : Math.floor(t / 1000)
}

function paraDia(segundos: number): string {
  return new Date(segundos * 1000).toISOString().slice(0, 10)
}

function hoje(): string {
  return paraDia(Math.floor(Date.now() / 1000))
}

/**
 * Monta a URL do recibo e abre numa aba nova.
 *
 * O numero JA vem do servidor — esta funcao so imprime. Reimprimir um recibo
 * antigo passa por aqui de novo, com os mesmos dados e o mesmo numero: nunca
 * gera numeracao nova.
 */
function abrirRecibo(dados: {
  numero: string
  nome: string
  email: string
  valor_cents: number
  forma_nome: string
  chave: string
  item: string
  pago_em: number
}) {
  const q = new URLSearchParams({
    pedido: dados.numero,
    nome: dados.nome,
    email: dados.email,
    valor: (dados.valor_cents / 100).toFixed(2),
    data: paraDia(dados.pago_em),
    forma: dados.forma_nome,
    chave: dados.chave,
    item: dados.item,
  })
  // Depois do "#", nunca do "?": o fragmento nao viaja ao servidor, e a chave de
  // ativacao do comprador nao entra no log de acesso do nginx.
  window.open(`${PAGINA_DO_RECIBO}#${q}`, '_blank', 'noopener')
}

export function Recibos() {
  const carga = usarDados<Dados>('/admin/recibos')
  const { encerrarSessao } = usarPainel()
  const d = carga.dados

  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [valor, setValor] = useState('')
  const [forma, setForma] = useState('PIX')
  const [chave, setChave] = useState('')
  const [item, setItem] = useState('')
  const [pagoEm, setPagoEm] = useState(hoje)
  const [erro, setErro] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const [emitido, setEmitido] = useState<ReciboEmitido | null>(null)

  const nomeDaForma = useMemo(() => {
    const mapa = new Map((d?.formas || []).map((f) => [f.id, f.nome]))
    // Forma que nao esta na lista (veio do webhook do Asaas, por exemplo) sai
    // como o codigo cru em vez de virar campo vazio no recibo.
    return (id: string) => mapa.get(id) || id
  }, [d])

  async function emitir(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    const centavos = paraCentavos(valor)
    if (centavos === null) {
      setErro('informe o valor pago, ex: 30,00')
      return
    }
    setErro('')
    setOcupado(true)
    try {
      const resposta = await chamar<ReciboEmitido>('/admin/recibo/emitir', {
        nome: nome.trim(),
        email: email.trim(),
        valor_cents: centavos,
        forma,
        chave: chave.trim(),
        item: item.trim(),
        pago_em: paraSegundos(pagoEm),
      })
      setEmitido(resposta)
      // O formulario e limpo porque o proximo recibo e de outra venda: deixar os
      // campos preenchidos e o caminho curto para emitir duas vezes a mesma coisa
      // com numeros diferentes.
      setNome('')
      setEmail('')
      setValor('')
      setChave('')
      setItem('')
      setPagoEm(hoje())
      carga.recarregar()
      abrirRecibo(resposta)
    } catch (e) {
      if (e instanceof ErroDeSessao) return encerrarSessao(e.message)
      setErro((e as Error).message)
    } finally {
      setOcupado(false)
    }
  }

  function reimprimir(r: Recibo) {
    abrirRecibo({ ...r, forma_nome: nomeDaForma(r.forma) })
  }

  return (
    <>
      <CabecalhoDaTela
        titulo="Recibos"
        descricao="Comprovante de compra do registro. O número é reservado aqui no servidor e nunca se repete."
        acao={<BotaoRecarregar carga={carga} />}
      />

      <Estado carga={carga}>
        {d && (
          <section className="grid gap-4 xl:grid-cols-[minmax(0,26rem)_1fr]">
            <Card className="h-fit">
              <CardHeader>
                <CardTitle>Emitir recibo</CardTitle>
                <CardDescription>
                  Preenchido à mão: a chave de ativação é colada na hora e não trafega entre
                  sistemas.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form className="flex flex-col gap-4" onSubmit={emitir}>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="recibo-nome">Nome do comprador</Label>
                    <Input
                      id="recibo-nome"
                      value={nome}
                      onChange={(e) => setNome(e.target.value)}
                      placeholder="Fulano de Tal"
                      required
                    />
                  </div>

                  <div className="flex flex-col gap-2">
                    <Label htmlFor="recibo-email">E-mail</Label>
                    <Input
                      id="recibo-email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="fulano@exemplo.com"
                      required
                    />
                    <p className="text-xs text-muted-foreground">
                      Se bater com uma conta existente, o recibo fica amarrado a ela.
                    </p>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="flex flex-col gap-2">
                      <Label htmlFor="recibo-valor">Valor pago</Label>
                      <Input
                        id="recibo-valor"
                        inputMode="decimal"
                        value={valor}
                        onChange={(e) => setValor(e.target.value)}
                        placeholder={(d.catalogo[0]?.preco_cents ?? 0) / 100 + ''}
                        required
                      />
                    </div>
                    <div className="flex flex-col gap-2">
                      <Label htmlFor="recibo-data">Data do pagamento</Label>
                      <Input
                        id="recibo-data"
                        type="date"
                        value={pagoEm}
                        max={hoje()}
                        onChange={(e) => setPagoEm(e.target.value)}
                        required
                      />
                    </div>
                  </div>

                  <div className="flex flex-col gap-2">
                    <Label htmlFor="recibo-forma">Forma de pagamento</Label>
                    {/* O Select pode devolver null ao limpar a escolha; o recibo
                        nao pode sair sem forma de pagamento, entao ignoramos e
                        mantemos a anterior. */}
                    <Select value={forma} onValueChange={(v) => v && setForma(String(v))}>
                      <SelectTrigger id="recibo-forma">
                        <SelectValue>{nomeDaForma(forma)}</SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          {d.formas.map((f) => (
                            <SelectItem key={f.id} value={f.id}>
                              {f.nome}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex flex-col gap-2">
                    <Label htmlFor="recibo-chave">Chave de ativação</Label>
                    <Input
                      id="recibo-chave"
                      value={chave}
                      onChange={(e) => setChave(e.target.value)}
                      placeholder="UF26-XXXXX-XXXXX-XXXXX"
                      className="font-mono"
                    />
                  </div>

                  <div className="flex flex-col gap-2">
                    <Label htmlFor="recibo-item">Descrição</Label>
                    <Input
                      id="recibo-item"
                      value={item}
                      onChange={(e) => setItem(e.target.value)}
                      placeholder={d.catalogo[0]?.nome || 'Registro do Ultrafoot 26'}
                    />
                    <p className="text-xs text-muted-foreground">
                      Em branco usa &ldquo;{d.catalogo[0]?.nome || 'Registro do Ultrafoot 26'}&rdquo;.
                    </p>
                  </div>

                  {erro && (
                    <p role="alert" className="text-sm text-destructive">
                      {erro}
                    </p>
                  )}

                  <Button type="submit" disabled={ocupado}>
                    <ReceiptText data-icon="inline-start" />
                    {ocupado ? 'Reservando número...' : 'Emitir e abrir'}
                  </Button>
                </form>

                {emitido && (
                  <div className="mt-4 flex items-center justify-between gap-3 rounded-lg border border-primary/30 bg-primary/5 p-3">
                    <div className="min-w-0">
                      <p className="font-mono text-sm font-semibold">{emitido.numero}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {emitido.nome} · {formatarDinheiro(emitido.valor_cents)}
                      </p>
                    </div>
                    {/* O bloqueador de pop-up do navegador pode barrar a aba
                        aberta logo depois da resposta. Este botao e a segunda
                        chance — sem ele o admin acharia que a emissao falhou,
                        e emitiria de novo gastando outro numero. */}
                    <Button size="sm" variant="outline" onClick={() => abrirRecibo(emitido)}>
                      <Printer data-icon="inline-start" />
                      Abrir
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="min-w-0">
              <CardHeader>
                <CardTitle>Emitidos</CardTitle>
                <CardDescription>
                  Os 200 mais recentes. Reimprimir usa o mesmo número — não gera outro.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                {d.recibos.length === 0 ? (
                  <Vazio>Nenhum recibo emitido ainda.</Vazio>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Número</TableHead>
                        <TableHead>Comprador</TableHead>
                        <TableHead>Pago em</TableHead>
                        <TableHead>Forma</TableHead>
                        <TableHead className="text-right">Valor</TableHead>
                        <TableHead />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {d.recibos.map((r) => (
                        <TableRow key={r.id}>
                          <TableCell className="font-mono text-xs">{r.numero}</TableCell>
                          <TableCell>
                            <p className="text-sm font-medium">{r.nome}</p>
                            <p className="text-xs text-muted-foreground">{r.email}</p>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {formatarData(r.pago_em)}
                          </TableCell>
                          <TableCell className="text-sm">{nomeDaForma(r.forma) || '—'}</TableCell>
                          <TableCell className="text-right font-medium">
                            {formatarDinheiro(r.valor_cents)}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              size="xs"
                              variant="ghost"
                              onClick={() => reimprimir(r)}
                              aria-label={`Reimprimir ${r.numero}`}
                            >
                              <Printer />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </section>
        )}
      </Estado>
    </>
  )
}
