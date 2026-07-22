// REGISTRO DO JOGO — validação do código do comprador, offline.
//
// O que existia antes: qualquer texto no formato `ULTRA-FOOT-2026-XXXX` era
// aceito. Digitar `ULTRA-FOOT-2026-AAAA` registrava o jogo. Não havia como
// gerar códigos nem saber quem comprou.
//
// COMO FUNCIONA. O código carrega um número de série e um lote, mais uma
// assinatura curta (HMAC-SHA256 truncado) do segredo mestre. Sem o segredo não
// se produz uma assinatura válida: forjar exige tentar ~2^45 combinações.
//
//   UF26-ABCDE-FGHIJ-KLMNO
//        └── 15 caracteres em base32 = série (24 bits) + lote (6) + MAC (45)
//
// Alfabeto Crockford: sem I, L, O e U — some a confusão entre 1/I/L e 0/O na
// hora de o comprador digitar.
//
// ⚠️ LIMITE HONESTO: a verificação é offline, então o segredo precisa viajar
// dentro do aplicativo. Quem souber mexer consegue extraí-lo do binário e gerar
// códigos. Isso vale para todo jogo desktop sem servidor de ativação — o que o
// esquema entrega é impedir palpite, permitir revogar código vazado e saber
// quem comprou. Se um dia houver servidor, a mesma função pode consultá-lo.

const ALFABETO = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"
const PREFIXO = "UF26"

/** Segredo injetado no build (ver scripts/gerar-codigos.mjs para emitir). */
const SEGREDO = process.env.NEXT_PUBLIC_ULTRAFOOT_LICENSE_SECRET ?? ""

export interface ResultadoLicenca {
  valido: boolean
  /** Número de série do comprador — é o que você cruza com a planilha de vendas. */
  serie?: number
  /** Lote da emissão (campanha, loja, revendedor). */
  lote?: number
  motivo?: "formato" | "assinatura" | "revogado" | "sem-segredo"
}

/**
 * Normaliza o que o jogador digitou: maiusculas, sem espaco, e as trocas do
 * alfabeto Crockford (O→0, I/L→1, U→V).
 *
 * As trocas valem SO PARA O CORPO. O prefixo "UF26" tem um U — aplicar a regra
 * nele virava "VF26" e todo codigo legitimo era recusado por formato. Foi o
 * teste de ida e volta que pegou.
 */
export function normalizarCodigo(bruto: string): string {
  const limpo = bruto.toUpperCase().replace(/[^0-9A-Z-]/g, "")
  if (!limpo.startsWith(PREFIXO)) return limpo
  const corpo = limpo
    .slice(PREFIXO.length)
    .replace(/O/g, "0")
    .replace(/[IL]/g, "1")
    .replace(/U/g, "V")
  return PREFIXO + corpo
}

/**
 * O payload tem 75 bits — mais do que um number aguenta (53). Em vez de BigInt
 * (que o alvo do TypeScript deste projeto nao aceita), trabalhamos com a lista
 * de grupos de 5 bits do proprio base32 e lemos campo a campo. Cada campo cabe
 * folgado num number: serie 24 bits, lote 6, MAC 45.
 */
const BITS_POR_CARACTERE = 5

function paraGrupos(texto: string): number[] | null {
  const grupos: number[] = []
  for (const ch of texto) {
    const i = ALFABETO.indexOf(ch)
    if (i < 0) return null
    grupos.push(i)
  }
  return grupos
}

/** Le `quantos` bits a partir de `inicio` (0 = bit mais significativo). */
function lerBits(grupos: readonly number[], inicio: number, quantos: number): number {
  let valor = 0
  for (let i = 0; i < quantos; i++) {
    const bit = inicio + i
    const g = grupos[Math.floor(bit / BITS_POR_CARACTERE)] ?? 0
    const deslocamento = BITS_POR_CARACTERE - 1 - (bit % BITS_POR_CARACTERE)
    valor = valor * 2 + ((g >> deslocamento) & 1)
  }
  return valor
}

function escreverBits(grupos: number[], inicio: number, quantos: number, valor: number): void {
  for (let i = 0; i < quantos; i++) {
    const bit = inicio + i
    const indice = Math.floor(bit / BITS_POR_CARACTERE)
    const deslocamento = BITS_POR_CARACTERE - 1 - (bit % BITS_POR_CARACTERE)
    const umOuZero = Math.floor(valor / Math.pow(2, quantos - 1 - i)) % 2
    if (umOuZero) grupos[indice] = (grupos[indice] ?? 0) | (1 << deslocamento)
  }
}

/** HMAC-SHA256 no navegador (Web Crypto) — mesmo calculo do script de emissao. */
async function hmac(segredo: string, mensagem: string): Promise<Uint8Array> {
  const enc = new TextEncoder()
  const chave = await crypto.subtle.importKey(
    "raw", enc.encode(segredo), { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  )
  const assinatura = await crypto.subtle.sign("HMAC", chave, enc.encode(mensagem))
  return new Uint8Array(assinatura)
}

/** Os 45 bits mais significativos do HMAC, montados sem estourar o number. */
function macCurto(bytes: Uint8Array): number {
  // 45 bits = 5 bytes inteiros (40) + os 5 bits mais altos do sexto.
  let alto = 0
  for (let i = 0; i < 5; i++) alto = alto * 256 + bytes[i]
  return alto * 32 + (bytes[5] >> 3)
}

/** Monta o codigo a partir da serie e do lote. Usado pelo script de emissao. */
export async function montarCodigo(serie: number, lote: number, segredo = SEGREDO): Promise<string> {
  const mac = macCurto(await hmac(segredo, `${serie}:${lote}`))
  const grupos = new Array<number>(15).fill(0)
  escreverBits(grupos, 0, 24, serie)
  escreverBits(grupos, 24, 6, lote)
  escreverBits(grupos, 30, 45, mac)
  const texto = grupos.map(g => ALFABETO[g]).join("")
  return `${PREFIXO}-${texto.slice(0, 5)}-${texto.slice(5, 10)}-${texto.slice(10, 15)}`
}

/**
 * Confere o codigo digitado. `revogados` vem embutido no build e permite cortar
 * um codigo que vazou sem precisar mexer no segredo (o que invalidaria todos).
 */
export async function validarCodigo(
  bruto: string,
  revogados: readonly number[] = [],
  segredo = SEGREDO,
): Promise<ResultadoLicenca> {
  if (!segredo) return { valido: false, motivo: "sem-segredo" }

  const limpo = normalizarCodigo(bruto)
  const partes = limpo.split("-")
  if (partes.length !== 4 || partes[0] !== PREFIXO) return { valido: false, motivo: "formato" }
  const texto = partes.slice(1).join("")
  if (texto.length !== 15) return { valido: false, motivo: "formato" }

  const grupos = paraGrupos(texto)
  if (!grupos) return { valido: false, motivo: "formato" }

  const serie = lerBits(grupos, 0, 24)
  const lote = lerBits(grupos, 24, 6)
  const macRecebido = lerBits(grupos, 30, 45)

  const macEsperado = macCurto(await hmac(segredo, `${serie}:${lote}`))
  if (macRecebido !== macEsperado) return { valido: false, motivo: "assinatura" }
  if (revogados.includes(serie)) return { valido: false, serie, lote, motivo: "revogado" }

  return { valido: true, serie, lote }
}

/** Mensagem para o jogador — sem jargão e sem entregar o motivo exato a quem tenta forjar. */
export function mensagemDeErro(motivo: ResultadoLicenca["motivo"]): string {
  switch (motivo) {
    case "revogado": return "Este código foi cancelado. Fale com o suporte."
    case "sem-segredo": return "Esta versão do jogo não consegue validar códigos. Reinstale pela loja oficial."
    default: return "Código inválido. Confira as letras e tente de novo."
  }
}
