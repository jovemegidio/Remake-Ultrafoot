// CAMADA ESPACIAL 1.0.286
//
// Converte uma tática por fases em ocupação de campo. O motor ainda não é uma
// simulação física contínua, mas os lances deixam de nascer apenas de três
// forças agregadas: largura, sobrecarga central, altura do bloco, proteção de
// transição e rotações passam a decidir por onde a equipe progride e a qualidade
// da chance criada.

export type CorredorEspacial286 = "esquerda" | "centro" | "direita"

export interface TaticasParaPerfilEspacial286 {
  formation?: string
  buildUpFormation?: string
  inPossessionFormation?: string
  outOfPossessionFormation?: string
  chanceCreation?: string
  width?: string
  defensiveLine?: string
  defenseLine?: string
  defensiveBlock?: string
  pressingIntensity?: string
  press?: string
  counterPress?: boolean
  postLossPress?: boolean
  counterAttack?: boolean
  holdPosition?: boolean
  buildUp?: string
  passingStyle?: string
  playingStyle?: string
  identity?: string
}

export interface PerfilEspacial286 {
  largura: number
  alturaDoBloco: number
  compactacao: number
  ocupacaoCentral: number
  protecaoTransicao: number
  rotacoes: number
  intensidadePressao: number
  corredores: Record<CorredorEspacial286, number>
  estruturaComBola: string
  estruturaSemBola: string
}

export interface ConfrontoEspacial286 {
  modificadorDeChance: number
  multiplicadorXG: number
  chanceRecuperacaoAlta: number
  corredorPreferido: CorredorEspacial286
  diagnostico: string
}

function limitar(valor: number, min = 0, max = 1): number {
  return Math.max(min, Math.min(max, valor))
}

function linhaDaFormacao(formacao: string | undefined): number[] {
  const numeros = String(formacao ?? "4-3-3").match(/\d+/g)?.map(Number).filter(Number.isFinite) ?? [4, 3, 3]
  return numeros.length >= 2 ? numeros : [4, 3, 3]
}

function frente(formacao: string | undefined): number {
  const linha = linhaDaFormacao(formacao)
  return linha.at(-1) ?? 1
}

function meio(formacao: string | undefined): number {
  const linha = linhaDaFormacao(formacao)
  return linha.slice(1, -1).reduce((soma, numero) => soma + numero, 0) || linha[1] || 3
}

function defesa(formacao: string | undefined): number {
  return linhaDaFormacao(formacao)[0] ?? 4
}

function valorPressao(value: string | undefined): number {
  const v = String(value ?? "media")
  if (v === "muito_alta" || v === "tudo_ou_nada") return 1
  if (v === "alta" || v === "alto") return 0.78
  if (v === "baixa" || v === "baixo" || v === "nenhuma") return 0.18
  return 0.48
}

function valorLinha(value: string | undefined): number {
  const v = String(value ?? "media")
  if (v === "muito_alta") return 1
  if (v === "alta" || v === "alto") return 0.78
  if (v === "baixa" || v === "baixo") return 0.2
  return 0.5
}

export function perfilEspacial286(tatica: TaticasParaPerfilEspacial286): PerfilEspacial286 {
  const comBola = tatica.inPossessionFormation ?? tatica.buildUpFormation ?? tatica.formation ?? "4-3-3"
  const semBola = tatica.outOfPossessionFormation ?? tatica.formation ?? "4-4-2"
  const criacao = String(tatica.chanceCreation ?? tatica.width ?? "misto")
  const estilo = String(tatica.playingStyle ?? tatica.identity ?? "equilibrado")
  const construcao = String(tatica.buildUp ?? tatica.passingStyle ?? "misto")
  const intensidadePressao = valorPressao(tatica.pressingIntensity ?? tatica.press)
  const alturaDoBloco = valorLinha(tatica.defensiveLine ?? tatica.defenseLine ?? tatica.defensiveBlock)
  const largura = criacao === "largura" || criacao === "ampla" ? 0.84 : criacao === "centro" || criacao === "estreita" ? 0.34 : 0.58
  const ocupacaoCentral = limitar(0.38 + meio(comBola) * 0.07 + (criacao === "centro" ? 0.2 : 0) - (largura - 0.5) * 0.18)
  const protecaoTransicao = limitar(0.34 + defesa(comBola) * 0.09 + (tatica.holdPosition ? 0.15 : 0) - (tatica.counterAttack ? 0.08 : 0))
  const rotacoes = limitar(
    0.25 +
    (estilo.includes("posse") || estilo.includes("posicional") ? 0.28 : 0) +
    (construcao.includes("curt") ? 0.16 : 0) +
    (frente(comBola) >= 5 ? 0.12 : 0),
  )
  const compactacao = limitar(0.72 - largura * 0.3 + (defesa(semBola) >= 5 ? 0.12 : 0) + (meio(semBola) >= 4 ? 0.08 : 0))
  const pesoLado = limitar(0.25 + largura * 0.22, 0.2, 0.44)
  const pesoCentro = limitar(1 - pesoLado * 2 + (ocupacaoCentral - 0.55) * 0.25, 0.2, 0.6)
  const normalizador = pesoLado * 2 + pesoCentro
  return {
    largura,
    alturaDoBloco,
    compactacao,
    ocupacaoCentral,
    protecaoTransicao,
    rotacoes,
    intensidadePressao,
    corredores: {
      esquerda: pesoLado / normalizador,
      centro: pesoCentro / normalizador,
      direita: pesoLado / normalizador,
    },
    estruturaComBola: comBola,
    estruturaSemBola: semBola,
  }
}

export function confrontoEspacial286(atacante?: PerfilEspacial286, defensor?: PerfilEspacial286): ConfrontoEspacial286 {
  const a = atacante ?? perfilEspacial286({})
  const d = defensor ?? perfilEspacial286({})
  const vantagemCentro = a.ocupacaoCentral - d.compactacao
  const vantagemLados = a.largura - (1 - d.compactacao)
  const rotacaoContraMarcacao = a.rotacoes * (0.55 + d.intensidadePressao * 0.45)
  const transicao = Math.max(0, d.alturaDoBloco - d.protecaoTransicao) * (0.35 + a.largura * 0.2)
  const modificadorDeChance = limitar(
    vantagemCentro * 0.012 + vantagemLados * 0.008 + rotacaoContraMarcacao * 0.007 + transicao * 0.01,
    -0.014,
    0.018,
  )
  const multiplicadorXG = limitar(1 + vantagemCentro * 0.08 + transicao * 0.1 + rotacaoContraMarcacao * 0.04, 0.88, 1.16)
  const chanceRecuperacaoAlta = limitar(a.intensidadePressao * a.alturaDoBloco * (1 - d.rotacoes * 0.22), 0.02, 0.72)
  const corredorPreferido: CorredorEspacial286 = vantagemCentro >= Math.max(0.04, vantagemLados)
    ? "centro"
    : a.corredores.esquerda >= a.corredores.direita ? "esquerda" : "direita"
  const diagnostico = transicao > 0.22
    ? "espaço às costas da última linha"
    : vantagemCentro > 0.08 ? "superioridade entre as linhas"
      : vantagemLados > 0.08 ? "amplitude contra bloco estreito" : "confronto espacial equilibrado"
  return { modificadorDeChance, multiplicadorXG, chanceRecuperacaoAlta, corredorPreferido, diagnostico }
}

export function escolherCorredor286(perfil: PerfilEspacial286 | undefined, sorteio: number): CorredorEspacial286 {
  const corredores = perfil?.corredores ?? { esquerda: 0.33, centro: 0.34, direita: 0.33 }
  if (sorteio < corredores.esquerda) return "esquerda"
  if (sorteio < corredores.esquerda + corredores.centro) return "centro"
  return "direita"
}

