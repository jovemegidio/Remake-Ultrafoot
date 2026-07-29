// FORMATO DO CÓDIGO DE REGISTRO — só o formato, nunca a validade.
//
// ETAPA 6 DO PLANO (docs/plano-licenca-ed25519.md): este arquivo TINHA o segredo
// mestre e o HMAC que validava o código offline. O problema não era configuração,
// era o algoritmo: HMAC é simétrico, a mesma chave assina e confere. Como a
// verificação era offline, o segredo precisava viajar dentro do app —
// `NEXT_PUBLIC_*` o deixava em texto puro no bundle, e um `grep` nos `.js` do
// instalador o devolvia. Com ele, qualquer pessoa emitia licença sem limite.
//
// Agora quem decide se um código vale é o SERVIDOR (`/licenca/ativar`), e quem
// confere o certificado devolvido é o Rust (`src-tauri/src/licenca.rs`) com a
// chave PÚBLICA. Ver `lib/licenca-certificado.ts`.
//
// O QUE SOBROU AQUI, e por quê: reconhecer o FORMATO. Os dois esquemas usam o
// mesmo desenho `UF26-XXXXX-XXXXX-XXXXX` — decisão de produto, o jogador digita
// a mesma coisa de sempre. Distinguir "chave velha" de "chave nova" olhando o
// texto é impossível; quem sabe é o servidor. O formato serve para duas coisas:
// não gastar uma ida à rede com texto que nem parece um código, e dar a mensagem
// de transição de §4 a quem tem chave do lote antigo.

const ALFABETO = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"
const PREFIXO = "UF26"

export interface ResultadoLicenca {
  valido: boolean
  motivo?: "formato" | "formato-antigo" | "servidor"
}

/**
 * Normaliza o que o jogador digitou: maiúsculas, sem espaço, e as trocas do
 * alfabeto Crockford (O→0, I/L→1, U→V).
 *
 * As trocas valem SÓ PARA O CORPO. O prefixo "UF26" tem um U — aplicar a regra
 * nele virava "VF26" e todo código legítimo era recusado por formato. Foi o teste
 * de ida e volta que pegou. O mesmo cuidado existe no servidor
 * (`services/auth-server/licenca.py:normalizar`); os dois precisam concordar.
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
 * O texto tem a cara de um código de registro?
 *
 * Só formato — NÃO diz se o código é válido. Quem decide isso é o servidor, e é
 * essa a diferença que fecha o buraco do esquema antigo: não existe mais nada no
 * cliente capaz de afirmar que uma chave vale.
 */
export function formatoValido(bruto: string): boolean {
  const limpo = normalizarCodigo(bruto)
  const partes = limpo.split("-")
  if (partes.length !== 4 || partes[0] !== PREFIXO) return false
  const corpo = partes.slice(1).join("")
  if (corpo.length !== 15) return false
  return [...corpo].every(ch => ALFABETO.includes(ch))
}

/**
 * Mensagem para o jogador — sem jargão e sem entregar a quem tenta forjar qual
 * parte falhou.
 */
export function mensagemDeErro(motivo: ResultadoLicenca["motivo"]): string {
  switch (motivo) {
    case "formato-antigo":
      // §4 do plano: quem pagou merece saber o que fazer, em vez de só
      // "inválido". Sem esta mensagem, o comprador com chave do lote antigo
      // ficaria sem explicação nenhuma depois do corte.
      return "Sua chave é de uma versão anterior. Entre na sua conta Ultrafoot para receber a nova chave, ou fale com o suporte."
    case "servidor":
      return "Não foi possível confirmar o registro agora. Conecte-se à internet e tente de novo."
    default:
      return "Código inválido. Confira as letras e tente de novo."
  }
}
