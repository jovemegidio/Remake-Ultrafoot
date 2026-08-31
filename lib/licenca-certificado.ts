"use client"

// ETAPA 7 — O LADO DO JOGO NO ESQUEMA Ed25519.
//
// O que muda para o jogador: nada visível. Ele digita o mesmo formato de código
// de sempre. O que muda por baixo:
//
//   ANTES  o código era um HMAC conferido offline — e por isso o segredo que
//          EMITE licença viajava dentro do bundle, em texto puro.
//
//   AGORA  o código é um identificador aleatório. Na 1ª ativação o servidor
//          confere no banco e devolve um CERTIFICADO assinado. Daí em diante o
//          jogo confere o certificado offline, para sempre, com a chave PÚBLICA
//          — que não serve para emitir nada.
//
// POR QUE A VERIFICAÇÃO NÃO ESTÁ AQUI. Ed25519 no `crypto.subtle` só saiu do
// flag no Chrome 137. O jogo roda em WebView2, cuja versão é a que estiver na
// máquina do jogador — em Windows desatualizado o `importKey` lança e o
// COMPRADOR LEGÍTIMO perderia o registro. Por isso a verificação mora no Rust
// (`src-tauri/src/licenca.rs`), igual para todo mundo, e aqui só chamamos.
//
// A MIGRAÇÃO É SILENCIOSA. Quem tem chave antiga não precisa fazer nada: o jogo
// detecta o formato velho, busca a chave nova em `/licenca/minha` e ativa
// sozinho. Ver `migrarSePreciso()` no fim do arquivo.

import { contaLogada } from "@/lib/conta-ultrafoot"
import { getDeviceId } from "@/lib/device-id"
import { storeGet, storeSet } from "@/lib/persistent-store"
import { safeLocalGet, safeLocalSet } from "@/lib/safe-storage"

import { SERVIDOR_AUTH } from "@/lib/servidor-ultrafoot"
const BASE = SERVIDOR_AUTH

// Guardado no MESMO armazenamento durável do registro (lib/registration.ts), e
// não só no localStorage: o WebView2 pode limpar o localStorage numa
// atualização, e o jogador registrado voltaria a "não registrado". Já aconteceu.
const K_CERT = "ultrafoot:licenca-certificado"

export interface Certificado {
  codigo: string
  device: string
  kid: string
  emitido_em: number
  serie: number
}

export interface ResultadoLicenca {
  valido: boolean
  certificado?: Certificado
  /** "formato" | "assinatura" | "kid-desconhecido" | "device" | "sem-chave" */
  motivo?: string
}

/** Guarda o certificado onde ele sobrevive a atualização do jogo. */
export function guardarCertificado(bruto: string): void {
  storeSet(K_CERT, bruto)
  safeLocalSet(K_CERT, bruto)
}

/** Certificado guardado, ou "" se o jogo nunca foi ativado nesta máquina. */
export function lerCertificado(): string {
  return storeGet(K_CERT) ?? safeLocalGet(K_CERT) ?? ""
}

/**
 * Confere o certificado guardado. OFFLINE — não toca a rede.
 *
 * É o caminho normal: depois da primeira ativação o jogo nunca mais precisa de
 * internet para saber que está registrado. Era requisito do jogo desktop e
 * continua valendo.
 */
export async function verificarLocal(): Promise<ResultadoLicenca> {
  const bruto = lerCertificado()
  if (!bruto) return { valido: false, motivo: "formato" }

  try {
    const { invoke } = await import("@tauri-apps/api/core")
    return await invoke<ResultadoLicenca>("verificar_licenca", {
      certificado: bruto,
      device: getDeviceId(),
    })
  } catch {
    // Rodando no navegador (dev/web), ou launcher velho sem o comando. Não dá
    // para verificar — mas também não dá para ACUSAR: devolver "inválido" aqui
    // desregistraria quem pagou só por estar numa build sem Tauri.
    return { valido: false, motivo: "sem-chave" }
  }
}

/**
 * 1ª ativação: troca o código digitado por um certificado assinado.
 *
 * Precisa de internet UMA vez. Sem sessão de propósito — quem comprou fora do
 * launcher ativa sem ter conta.
 */
export async function ativarOnline(codigo: string): Promise<{ ok: boolean; erro?: string }> {
  const device = getDeviceId()
  try {
    const r = await fetch(`${BASE}/licenca/ativar`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ codigo, device }),
    })
    const corpo = await r.json().catch(() => ({})) as { certificado?: string; erro?: string }

    if (r.ok && corpo.certificado) {
      guardarCertificado(corpo.certificado)
      return { ok: true }
    }
    // 503 = a VPS está sem a chave configurada. É falha NOSSA, e dizer "código
    // inválido" faria o comprador achar que a chave dele não presta.
    if (r.status === 503) {
      return { ok: false, erro: "O servidor de licenças está indisponível. Tente mais tarde." }
    }
    if (r.status === 429) {
      return { ok: false, erro: "Muitas tentativas. Espere alguns minutos e tente de novo." }
    }
    return { ok: false, erro: corpo.erro || "Código inválido. Confira as letras e tente de novo." }
  } catch {
    // Rede fora. Distinguir de "código errado" importa: mandar o jogador
    // conferir as letras quando o problema é a internet dele é frustrante.
    return { ok: false, erro: "Sem conexão para ativar. Conecte-se à internet uma vez para registrar." }
  }
}

/**
 * O código é do formato ANTIGO (HMAC)?
 *
 * Os dois formatos têm o mesmo desenho — `UF26-XXXXX-XXXXX-XXXXX` — porque isso
 * foi decisão de produto: o jogador digita a mesma coisa de sempre. Então NÃO dá
 * para distinguir olhando o texto.
 *
 * O que distingue é o servidor: código novo existe na tabela `licencas`, código
 * velho não. Por isso esta função só confere o FORMATO, e quem decide é a
 * ativação. Ela existe para a mensagem de transição do §4 do plano.
 */
export function pareceFormatoDeCodigo(bruto: string): boolean {
  return /^UF26-[0-9A-Z]{5}-[0-9A-Z]{5}-[0-9A-Z]{5}$/.test(bruto.trim().toUpperCase())
}

/**
 * MIGRAÇÃO SILENCIOSA (§4 do plano, passo 3).
 *
 * Roda na abertura do jogo. Se esta máquina tem registro antigo mas nenhum
 * certificado, busca a chave nova na conta e ativa sozinha. O jogador que
 * comprou não percebe nada: abre o jogo e continua registrado.
 *
 * Devolve `true` quando conseguiu migrar — a tela pode então tratar como
 * registrado sem pedir nada.
 *
 * Best-effort de propósito: falhar aqui NÃO pode desregistrar ninguém. Quem não
 * for alcançado (sem conta, sem rede) cai na mensagem de transição, e o jogo
 * continua não travando.
 */
export async function migrarSePreciso(): Promise<boolean> {
  // Já tem certificado válido? Não há o que migrar.
  const atual = await verificarLocal()
  if (atual.valido) return true

  // Sem conta não há como descobrir a chave nova desta pessoa. O suporte resolve
  // esse caso (§4, passo 4).
  const conta = await contaLogada()
  if (!conta) return false

  try {
    const r = await fetch(`${BASE}/licenca/minha`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${conta.token}`,
      },
      body: JSON.stringify({}),
    })
    if (!r.ok) return false
    const { codigo } = await r.json() as { codigo?: string }
    if (!codigo) return false

    const ativou = await ativarOnline(codigo)
    return ativou.ok
  } catch {
    return false
  }
}

/**
 * Mensagem para o jogador. Sem jargão, e sem entregar a quem tenta forjar qual
 * parte falhou.
 */
export function mensagemDeErro(motivo?: string): string {
  switch (motivo) {
    case "device":
      return "Este código já está registrado em outro computador. Fale com o suporte para liberar a troca."
    case "kid-desconhecido":
      return "Este registro é de uma versão mais nova do jogo. Atualize pela loja oficial."
    case "sem-chave":
      return "Esta versão do jogo não consegue validar o registro. Reinstale pela loja oficial."
    case "formato-antigo":
      // §4 do plano: quem pagou merece saber o que fazer, em vez de só
      // "inválido". Sem isto, o comprador com chave velha fica sem explicação.
      return "Sua chave é de uma versão anterior. Entre na sua conta Ultrafoot para receber a nova chave, ou fale com o suporte."
    default:
      return "Código inválido. Confira as letras e tente de novo."
  }
}
