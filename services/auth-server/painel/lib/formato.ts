/** Formatacao para leitura humana. Tudo em pt-BR, como o resto do jogo. */

const dataHora = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
})
const dataCurta = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short' })
const numero = new Intl.NumberFormat('pt-BR')
const dinheiro = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

/** Carimbos vem em SEGUNDOS do servidor (time.time()), nao em milissegundos. */
export function formatarData(segundos?: number | null): string {
  if (!segundos) return '—'
  return dataHora.format(new Date(segundos * 1000))
}

export function formatarDia(segundos: number): string {
  return dataCurta.format(new Date(segundos * 1000)).replace('.', '')
}

export function formatarNumero(valor: number): string {
  return numero.format(valor)
}

/** Centavos → R$. Guardamos dinheiro em inteiro justamente para nao arredondar. */
export function formatarDinheiro(centavos: number): string {
  return dinheiro.format((centavos || 0) / 100)
}

export function formatarBytes(bytes: number): string {
  if (!bytes) return '—'
  const unidades = ['B', 'kB', 'MB', 'GB']
  let valor = bytes
  let i = 0
  while (valor >= 1024 && i < unidades.length - 1) {
    valor /= 1024
    i += 1
  }
  return `${valor.toFixed(valor < 10 && i > 0 ? 1 : 0)} ${unidades[i]}`
}

/** "há 4 min", "há 2 h". Sempre no passado: todo carimbo daqui ja aconteceu. */
export function haQuantoTempo(segundos?: number | null, agora?: number): string {
  if (!segundos) return '—'
  const decorrido = Math.max(0, (agora ?? Math.floor(Date.now() / 1000)) - segundos)
  if (decorrido < 60) return 'agora mesmo'
  if (decorrido < 3600) return `há ${Math.floor(decorrido / 60)} min`
  if (decorrido < 86400) return `há ${Math.floor(decorrido / 3600)} h`
  const dias = Math.floor(decorrido / 86400)
  if (dias < 30) return `há ${dias} ${dias === 1 ? 'dia' : 'dias'}`
  const meses = Math.floor(dias / 30)
  if (meses < 12) return `há ${meses} ${meses === 1 ? 'mês' : 'meses'}`
  const anos = Math.floor(dias / 365)
  return `há ${anos} ${anos === 1 ? 'ano' : 'anos'}`
}

export function duracao(segundos: number): string {
  if (segundos < 60) return `${Math.floor(segundos)}s`
  if (segundos < 3600) return `${Math.floor(segundos / 60)} min`
  if (segundos < 86400) return `${Math.floor(segundos / 3600)} h`
  const dias = Math.floor(segundos / 86400)
  return `${dias} ${dias === 1 ? 'dia' : 'dias'}`
}

/**
 * Variacao percentual entre hoje e ontem. Devolve null quando ontem foi zero:
 * "+∞%" nao informa nada e "+100%" seria mentira.
 */
export function variacao(hoje: number, ontem: number): number | null {
  if (!ontem) return null
  return ((hoje - ontem) / ontem) * 100
}

export function iniciais(nome: string, email: string): string {
  const base = (nome || email.split('@')[0] || '?').trim()
  const partes = base.split(/[\s._-]+/).filter(Boolean)
  if (partes.length >= 2) return (partes[0][0] + partes[1][0]).toUpperCase()
  return base.slice(0, 2).toUpperCase()
}
