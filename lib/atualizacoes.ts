"use client"

// CENTRAL DE ATUALIZACOES — os tres canais numa consulta so.
//
// O jogo tem duas fontes de novidade, com naturezas bem diferentes:
//
//   * o MANIFESTO DE DADOS (atualizacoes/elencos.json), poucos KB, que corrige
//     elenco, transferencia, escudo, uniforme e participante de competicao sem
//     reinstalar nada — e aplicado aqui mesmo, na hora;
//   * o LATEST.JSON da build, que so AVISA que existe versao nova: quem baixa e
//     instala o jogo e o Ultrafoot Launcher.
//
// Este modulo apresenta as duas como tres canais (elencos, times, jogo), diz o
// que cada um traz e aplica quando o jogador mandar. Nada aqui conecta sem
// consentimento — ver lib/atualizacoes-preferencias.

import {
  aplicarAtualizacao,
  canalTemNovidade,
  consultarServidor,
  getAtualizacao,
  resumir,
  versaoAtualizacao,
  type AtualizacaoElencos,
} from "@/lib/atualizacao-elencos"
import { canalAtivo, podeConectar, type Canal } from "@/lib/atualizacoes-preferencias"
import { consultarVersaoPublicada } from "@/lib/updater"

export type EstadoCanal =
  /** Nada novo: o que esta na maquina e o que esta publicado. */
  | "atualizado"
  /** Ha conteudo novo esperando o jogador aplicar. */
  | "disponivel"
  /** O jogador desligou este canal. */
  | "desligado"
  /** Sem consentimento — nem chegamos a consultar. */
  | "sem-consentimento"
  /** Consultamos e nao deu (sem rede, servidor fora, ou fora do app instalado). */
  | "indisponivel"

export interface ItemAtualizacao {
  canal: Canal
  titulo: string
  descricao: string
  estado: EstadoCanal
  /** Uma linha dizendo o que ha (ou nao ha) para este canal. */
  detalhe: string
  /** Notas de versao, quando o servidor mandar. */
  notas?: string
}

export interface Relatorio {
  itens: ItemAtualizacao[]
  /**
   * O manifesto baixado NESTA verificacao. Guardado para que "Atualizar" aplique
   * o que o jogador acabou de ver, sem uma segunda ida ao servidor — entre a
   * consulta e o clique o servidor poderia ter publicado outra coisa.
   */
  dados: AtualizacaoElencos | null
  verificadoEm: number
}

/** Rotulo de cada canal. Exportado para a tela desenhar a lista antes da 1a consulta. */
export const TITULOS: Record<Canal, { titulo: string; descricao: string }> = {
  elencos: {
    titulo: "Atualizar elencos",
    descricao: "Transferências oficiais, atletas corrigidos, posições e overalls.",
  },
  times: {
    titulo: "Atualizar times",
    descricao: "Escudos, uniformes, cores, estádios e participantes das competições.",
  },
  jogo: {
    titulo: "Atualizar jogo",
    descricao: "Nova versão do Ultrafoot 26 — instalada pelo Ultrafoot Launcher.",
  },
}

/** "3 clubes · 12 transferências" — só as seções que têm conteúdo. */
function descrever(partes: [number, string, string][]): string {
  const texto = partes
    .filter(([n]) => n > 0)
    .map(([n, um, varios]) => `${n} ${n === 1 ? um : varios}`)
    .join(" · ")
  return texto || "nenhum item"
}

function item(canal: Canal, estado: EstadoCanal, detalhe: string, notas?: string): ItemAtualizacao {
  return { canal, ...TITULOS[canal], estado, detalhe, notas }
}

/**
 * Consulta os três canais SEM aplicar nada.
 *
 * Devolve sempre os três itens, na mesma ordem, para a tela poder desenhar a
 * lista antes mesmo da primeira verificação.
 */
export async function verificarAtualizacoes(): Promise<Relatorio> {
  const verificadoEm = Date.now()

  if (!podeConectar()) {
    return {
      itens: (["elencos", "times", "jogo"] as Canal[]).map((c) =>
        item(c, "sem-consentimento", "É preciso autorizar a conexão com o servidor."),
      ),
      dados: null,
      verificadoEm,
    }
  }

  // As duas fontes são independentes: uma fora do ar não pode esconder a outra.
  const [dados, versao] = await Promise.all([consultarServidor(), consultarVersaoPublicada()])

  const itens: ItemAtualizacao[] = []

  for (const canal of ["elencos", "times"] as const) {
    if (!canalAtivo(canal)) {
      itens.push(item(canal, "desligado", "Canal desligado — o jogo usa os dados que já tem."))
      continue
    }
    if (!dados) {
      itens.push(item(canal, "indisponivel", "Não foi possível falar com o servidor agora."))
      continue
    }
    if (!canalTemNovidade(dados, canal)) {
      const v = versaoAtualizacao()
      // v0 = nunca baixou nada, e nao ha nada para baixar. Dizer "pacote v0"
      // soaria como erro; o que importa e que confere com o servidor.
      itens.push(item(canal, "atualizado", v > 0 ? `Tudo em dia (pacote de dados v${v}).` : "Tudo em dia com o servidor."))
      continue
    }
    const r = resumir(dados)
    const detalhe =
      canal === "elencos"
        ? `v${dados.versao}: ${descrever([
            [r.transferencias, "transferência", "transferências"],
            [r.jogadores, "atleta corrigido", "atletas corrigidos"],
          ])}.`
        : `v${dados.versao}: ${descrever([
            [r.clubes, "clube", "clubes"],
            [r.competicoes, "competição", "competições"],
          ])}.`
    itens.push(item(canal, "disponivel", detalhe, dados.notas))
  }

  if (!canalAtivo("jogo")) {
    itens.push(item("jogo", "desligado", "Canal desligado — o jogo não avisa sobre novas versões."))
  } else if (!versao) {
    // Fora do Tauri (navegador/dev) não existe versão instalada para comparar.
    itens.push(item("jogo", "indisponivel", "Disponível apenas no aplicativo instalado."))
  } else if (versao.nova) {
    itens.push(
      item(
        "jogo",
        "disponivel",
        `Versão ${versao.publicada} publicada (você tem a ${versao.atual}).`,
        versao.notas,
      ),
    )
  } else {
    itens.push(item("jogo", "atualizado", `Você está na versão mais recente (${versao.atual}).`))
  }

  return { itens, dados, verificadoEm }
}

/**
 * Aplica o manifesto de dados que veio da verificação.
 *
 * Vale para elencos E times: o manifesto é um só e a gravação é atômica — não
 * existe meio pacote no disco. O que decide o que passa a valer no jogo são os
 * canais (lib/atualizacoes-preferencias), consultados na hora de montar elenco
 * e clube.
 *
 * Devolve a versão aplicada, ou 0 se não havia nada mais novo.
 */
export function aplicarDados(dados: AtualizacaoElencos | null): number {
  if (!dados) return 0
  return aplicarAtualizacao(dados)
}

/** Versão do pacote de dados que está na máquina (0 = nunca baixou). */
export function versaoDadosLocal(): number {
  return getAtualizacao().versao
}
