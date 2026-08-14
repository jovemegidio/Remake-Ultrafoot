import { setorDaPosicao286, type JogadorUniverso286, type UniversoPersistente286 } from "@/lib/universo-286"

export const TRANSFERROOM_26_SCHEMA = 1

export type TipoNegocioTransferRoom = "compra" | "emprestimo" | "ambos"
export type TempoDeJogoTransferRoom = "estrela" | "titular" | "rotacao" | "profundidade"
export type PerfilEtarioTransferRoom = "promessa" | "auge" | "experiente" | "qualquer"
export type PapelComBola26 = "construtor" | "amplitude" | "infiltrador" | "finalizador" | "apoio"
export type PapelSemBola26 = "pressao" | "cobertura" | "marcacao" | "bloco_baixo" | "saida"
export type SetorTransferRoom = "GOL" | "DEF" | "MEI" | "ATA"

export interface RespostaRequirement26 {
  jogadorId: string
  jogador: string
  clubeCurto: string
  clube: string
  posicao: string
  idade: number
  overall: number
  valor: number
  pontuacao: number
  recomendacao: "ideal" | "bom" | "alternativa"
}

export interface Requirement26 {
  id: string
  criadoTemporada: number
  criadoSemana: number
  expiraSemanaAbsoluta: number
  setor: SetorTransferRoom
  papelComBola: PapelComBola26
  papelSemBola: PapelSemBola26
  tempoDeJogo: TempoDeJogoTransferRoom
  tipoNegocio: TipoNegocioTransferRoom
  perfilEtario: PerfilEtarioTransferRoom
  status: "ativo" | "encerrado"
  respostas: RespostaRequirement26[]
}

export interface OportunidadePitch26 {
  id: string
  clubeCurto: string
  clube: string
  pais: string
  setor: SetorTransferRoom
  papelComBola: PapelComBola26
  papelSemBola: PapelSemBola26
  tempoDeJogo: TempoDeJogoTransferRoom
  tipoNegocio: TipoNegocioTransferRoom
  perfilEtario: PerfilEtarioTransferRoom
  orcamento: number
}

export interface Pitch26 {
  id: string
  oportunidadeId: string
  clube: string
  jogadorId: number
  jogador: string
  tipoNegocio: Exclude<TipoNegocioTransferRoom, "ambos">
  valor: number
  criadoTemporada: number
  criadoSemana: number
  status: "aceito" | "rejeitado" | "concluido"
  justificativa: string
}

export interface EstadoTransferRoom26 {
  schema: typeof TRANSFERROOM_26_SCHEMA
  requirements: Requirement26[]
  pitches: Pitch26[]
}

export const ESTADO_TRANSFERROOM_26: EstadoTransferRoom26 = {
  schema: TRANSFERROOM_26_SCHEMA,
  requirements: [],
  pitches: [],
}

export function normalizarTransferRoom26(valor?: Partial<EstadoTransferRoom26> | null): EstadoTransferRoom26 {
  return {
    schema: TRANSFERROOM_26_SCHEMA,
    requirements: Array.isArray(valor?.requirements) ? valor.requirements : [],
    pitches: Array.isArray(valor?.pitches) ? valor.pitches : [],
  }
}

function hash(texto: string): number {
  let h = 2166136261
  for (const char of texto) h = Math.imul(h ^ char.charCodeAt(0), 16777619)
  return h >>> 0
}

function semanaAbsoluta(temporada: number, semana: number): number {
  return Math.max(0, temporada - 2026) * 52 + semana
}

function faixaIdade(perfil: PerfilEtarioTransferRoom): [number, number] {
  if (perfil === "promessa") return [16, 22]
  if (perfil === "auge") return [23, 29]
  if (perfil === "experiente") return [29, 38]
  return [16, 40]
}

function notaPapelComBola(jogador: JogadorUniverso286, papel: PapelComBola26): number {
  const a = jogador.atributos
  if (papel === "construtor") return a.passing * 0.65 + a.dribbling * 0.2 + jogador.overall * 0.15
  if (papel === "amplitude") return a.pace * 0.45 + a.dribbling * 0.35 + a.passing * 0.2
  if (papel === "infiltrador") return a.pace * 0.35 + a.dribbling * 0.3 + a.shooting * 0.35
  if (papel === "finalizador") return a.shooting * 0.65 + a.pace * 0.15 + jogador.overall * 0.2
  return a.passing * 0.4 + a.physical * 0.25 + jogador.overall * 0.35
}

function notaPapelSemBola(jogador: JogadorUniverso286, papel: PapelSemBola26): number {
  const a = jogador.atributos
  if (papel === "pressao") return a.physical * 0.45 + a.pace * 0.3 + a.defending * 0.25
  if (papel === "cobertura") return a.pace * 0.3 + a.defending * 0.5 + jogador.overall * 0.2
  if (papel === "marcacao") return a.defending * 0.65 + a.physical * 0.35
  if (papel === "bloco_baixo") return a.defending * 0.55 + a.physical * 0.3 + jogador.overall * 0.15
  return a.passing * 0.35 + a.defending * 0.35 + jogador.overall * 0.3
}

function notaTempoDeJogo(overall: number, tempo: TempoDeJogoTransferRoom): number {
  const alvo = tempo === "estrela" ? 82 : tempo === "titular" ? 74 : tempo === "rotacao" ? 66 : 58
  return Math.max(0, 100 - Math.abs(overall - alvo) * 5)
}

export function criarRequirement26(
  dados: Omit<Requirement26, "id" | "criadoTemporada" | "criadoSemana" | "expiraSemanaAbsoluta" | "status" | "respostas">,
  temporada: number,
  semana: number,
  universo?: UniversoPersistente286 | null,
  clubeUsuario?: string,
): Requirement26 {
  const id = `req-${temporada}-${semana}-${hash(JSON.stringify(dados)).toString(36)}`
  const requirement: Requirement26 = {
    ...dados,
    id,
    criadoTemporada: temporada,
    criadoSemana: semana,
    expiraSemanaAbsoluta: semanaAbsoluta(temporada, semana) + 4,
    status: "ativo",
    respostas: [],
  }
  if (!universo) return requirement

  const [idadeMin, idadeMax] = faixaIdade(dados.perfilEtario)
  const respostas = Object.values(universo.jogadores)
    .filter(jogador => jogador.clubeCurto && jogador.clubeCurto !== clubeUsuario)
    .filter(jogador => setorDaPosicao286(jogador.posicao) === dados.setor)
    .filter(jogador => jogador.idade >= idadeMin && jogador.idade <= idadeMax)
    .map(jogador => {
      const clube = universo.clubes[jogador.clubeCurto!]
      const papel = (notaPapelComBola(jogador, dados.papelComBola) + notaPapelSemBola(jogador, dados.papelSemBola)) / 2
      const tempo = notaTempoDeJogo(jogador.overall, dados.tempoDeJogo)
      const disponibilidade = dados.tipoNegocio === "emprestimo" && jogador.idade <= 24 ? 92 : 72
      const pontuacao = Math.round(papel * 0.62 + tempo * 0.28 + disponibilidade * 0.1)
      return {
        jogadorId: jogador.id,
        jogador: jogador.nome,
        clubeCurto: jogador.clubeCurto!,
        clube: clube?.nome ?? jogador.clubeCurto!,
        posicao: jogador.posicao,
        idade: jogador.idade,
        overall: jogador.overall,
        valor: jogador.valor,
        pontuacao,
        recomendacao: pontuacao >= 80 ? "ideal" as const : pontuacao >= 68 ? "bom" as const : "alternativa" as const,
      }
    })
    .filter(item => item.pontuacao >= 55)
    .sort((a, b) => b.pontuacao - a.pontuacao || a.valor - b.valor || a.jogador.localeCompare(b.jogador, "pt-BR"))
    .slice(0, 12)

  return { ...requirement, respostas }
}

const PAPEL_COM_BOLA_POR_SETOR: Record<SetorTransferRoom, PapelComBola26[]> = {
  GOL: ["construtor", "apoio"], DEF: ["construtor", "amplitude", "apoio"],
  MEI: ["construtor", "infiltrador", "apoio"], ATA: ["infiltrador", "finalizador", "amplitude"],
}

const PAPEL_SEM_BOLA_POR_SETOR: Record<SetorTransferRoom, PapelSemBola26[]> = {
  GOL: ["cobertura", "saida"], DEF: ["cobertura", "marcacao", "bloco_baixo"],
  MEI: ["pressao", "marcacao", "cobertura"], ATA: ["pressao", "saida", "marcacao"],
}

export function gerarOportunidadesPitch26(
  universo?: UniversoPersistente286 | null,
  clubeUsuario?: string,
  temporada = 2026,
  semana = 0,
): OportunidadePitch26[] {
  if (!universo) return []
  return Object.values(universo.clubes)
    .filter(clube => clube.curto !== clubeUsuario && clube.carencias.length > 0)
    .flatMap(clube => clube.carencias.slice(0, 1).map(carencia => {
      const setor = carencia.setor
      const seed = hash(`${temporada}:${semana}:${clube.curto}:${setor}`)
      const comBola = PAPEL_COM_BOLA_POR_SETOR[setor]
      const semBola = PAPEL_SEM_BOLA_POR_SETOR[setor]
      return {
        id: `opp-${clube.curto}-${setor}-${temporada}-${Math.floor(semana / 2)}`,
        clubeCurto: clube.curto,
        clube: clube.nome,
        pais: clube.pais,
        setor,
        papelComBola: comBola[seed % comBola.length],
        papelSemBola: semBola[Math.floor(seed / 7) % semBola.length],
        tempoDeJogo: carencia.prioridade >= 75 ? "titular" : carencia.prioridade >= 55 ? "rotacao" : "profundidade",
        tipoNegocio: seed % 4 === 0 ? "emprestimo" : seed % 5 === 0 ? "ambos" : "compra",
        perfilEtario: carencia.motivo === "idade" ? "promessa" : seed % 3 === 0 ? "auge" : "qualquer",
        orcamento: Math.max(250_000, Math.min(clube.orcamentoTransferencias, Math.round(clube.saldo * 0.12))),
      } satisfies OportunidadePitch26
    }))
    .sort((a, b) => b.orcamento - a.orcamento || a.clube.localeCompare(b.clube, "pt-BR"))
    .slice(0, 36)
}

export interface JogadorParaPitch26 {
  id: number
  name: string
  position: string
  age: number
  overall: number
  marketValue?: number
  isLoanedIn?: boolean
}

export function avaliarPitch26(
  oportunidade: OportunidadePitch26,
  jogador: JogadorParaPitch26,
  tipoNegocio: Exclude<TipoNegocioTransferRoom, "ambos">,
  temporada: number,
  semana: number,
): Pitch26 {
  if (jogador.isLoanedIn) {
    return { id: `pitch-${oportunidade.id}-${jogador.id}`, oportunidadeId: oportunidade.id, clube: oportunidade.clube, jogadorId: jogador.id, jogador: jogador.name, tipoNegocio, valor: 0, criadoTemporada: temporada, criadoSemana: semana, status: "rejeitado", justificativa: "O passe pertence ao clube de origem e não pode ser oferecido." }
  }
  const setorCerto = setorDaPosicao286(jogador.position) === oportunidade.setor
  const [idadeMin, idadeMax] = faixaIdade(oportunidade.perfilEtario)
  const idadeCerta = jogador.age >= idadeMin && jogador.age <= idadeMax
  const tipoCerto = oportunidade.tipoNegocio === "ambos" || oportunidade.tipoNegocio === tipoNegocio
  const valorBase = Math.max(100_000, jogador.marketValue ?? jogador.overall ** 3 * 35)
  const cabeNoOrcamento = tipoNegocio === "emprestimo" || valorBase <= oportunidade.orcamento * 1.25
  const ruido = hash(`${oportunidade.id}:${jogador.id}:${temporada}:${semana}`) % 13
  const nota = (setorCerto ? 35 : 0) + (idadeCerta ? 20 : 0) + (tipoCerto ? 20 : 0) + (cabeNoOrcamento ? 15 : 0) + ruido
  const aceito = nota >= 66
  const multiplicador = 0.88 + (hash(`valor:${oportunidade.id}:${jogador.id}`) % 21) / 100
  const valor = tipoNegocio === "emprestimo" ? Math.round(valorBase * 0.08) : Math.min(oportunidade.orcamento, Math.round(valorBase * multiplicador / 10_000) * 10_000)
  return {
    id: `pitch-${oportunidade.id}-${jogador.id}-${temporada}-${semana}`,
    oportunidadeId: oportunidade.id,
    clube: oportunidade.clube,
    jogadorId: jogador.id,
    jogador: jogador.name,
    tipoNegocio,
    valor: aceito ? valor : 0,
    criadoTemporada: temporada,
    criadoSemana: semana,
    status: aceito ? "aceito" : "rejeitado",
    justificativa: aceito
      ? `${oportunidade.clube} considera o atleta compatível com a necessidade publicada.`
      : !setorCerto ? "O atleta não corresponde ao setor procurado." : !idadeCerta ? "O perfil de idade não corresponde ao anúncio." : !tipoCerto ? "A modalidade do negócio não interessa ao clube." : "A avaliação técnica ou financeira ficou abaixo do necessário.",
  }
}
