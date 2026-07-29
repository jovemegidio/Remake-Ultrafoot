"use client"

// APRESENTAÇÃO DA TORCIDA — rótulo e frase para um número que já existe.
//
// ATENÇÃO A QUEM FOR MEXER AQUI: este arquivo NÃO calcula satisfação. Quem
// calcula é lib/torcida.ts (`satisfacaoDaTorcida`, `humorDasOrganizadas`,
// `pressaoDasOrganizadas`), e aquele sistema já roda em lib/use-game-manager
// desde antes desta versão.
//
// A primeira versão deste arquivo tinha um modelo PRÓPRIO de confiança da
// torcida — eu não havia visto que o sistema existia. Seriam dois números
// discordando sobre o mesmo assunto, o mesmo defeito que o leilão teve ao
// inventar uma escala de valor paralela ao calcMarketValue. Foi reescrito para
// ser só a camada de leitura humana.
//
// O que faltava de verdade era VISIBILIDADE: a satisfação era calculada,
// alimentava o quadro de sócios e nunca aparecia em tela nenhuma.

import { satisfacaoDaTorcida, pressaoDasOrganizadas, type Organizada } from "@/lib/torcida"

export type ClimaTorcida = "festa" | "apoio" | "paciencia" | "impaciencia" | "revolta"

/** Traduz a satisfação (0-100) do sistema existente em clima legível. */
export function climaDaTorcida(satisfacao: number): ClimaTorcida {
  if (satisfacao >= 80) return "festa"
  if (satisfacao >= 62) return "apoio"
  if (satisfacao >= 45) return "paciencia"
  if (satisfacao >= 28) return "impaciencia"
  return "revolta"
}

export const ROTULO_CLIMA: Record<ClimaTorcida, string> = {
  festa: "Em festa",
  apoio: "Apoiando",
  paciencia: "Na expectativa",
  impaciencia: "Impaciente",
  revolta: "Revoltada",
}

/** Cor do clima, alinhada ao tema (usa a cor da marca no extremo positivo). */
export const COR_CLIMA: Record<ClimaTorcida, string> = {
  festa: "var(--brand)",
  apoio: "#22c55e",
  paciencia: "#eab308",
  impaciencia: "#f59e0b",
  revolta: "#ef4444",
}

const FRASES: Record<ClimaTorcida, string[]> = {
  festa: ["A torcida faz festa na porta do CT.", "Ingressos esgotados: a arquibancada confia no time."],
  apoio: ["A torcida apoia o trabalho.", "Clima bom nas redes sociais do clube."],
  paciencia: ["A torcida observa, sem euforia nem revolta.", "Cobrança pontual, nada fora do normal."],
  impaciencia: ["Vaias no fim do jogo.", "Faixas de protesto apareceram no estádio."],
  revolta: [
    "A torcida organizada protestou no centro de treinamento.",
    "A pressão da torcida está grande pelos maus resultados.",
    "Cobrança pesada: pedem sua saída nas redes.",
  ],
}

/** Frase determinística por clima+semana: não muda a cada render da tela. */
export function recadoDaTorcida(satisfacao: number, semana: number): string {
  const lista = FRASES[climaDaTorcida(satisfacao)]
  return lista[Math.abs(semana) % lista.length]
}

/** Leitura pronta para a tela, a partir das organizadas do save. */
export interface LeituraDaTorcida {
  satisfacao: number
  clima: ClimaTorcida
  rotulo: string
  cor: string
  /** Empurrão no estádio em jogo da casa (-12 a +12), do sistema existente. */
  pressaoEmCasa: number
}

export function lerTorcida(organizadas: Organizada[] | undefined, semana = 0): LeituraDaTorcida & { recado: string } {
  const lista = organizadas ?? []
  const satisfacao = satisfacaoDaTorcida(lista)
  const clima = climaDaTorcida(satisfacao)
  return {
    satisfacao,
    clima,
    rotulo: ROTULO_CLIMA[clima],
    cor: COR_CLIMA[clima],
    pressaoEmCasa: pressaoDasOrganizadas(lista),
    recado: recadoDaTorcida(satisfacao, semana),
  }
}
