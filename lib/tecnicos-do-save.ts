// VÁRIOS TÉCNICOS HUMANOS NO MESMO MUNDO — o multitécnico do Brasfoot.
//
// A ideia, na forma como o usuário a descreveu
// ────────────────────────────────────────────
// Não são carreiras isoladas. É UM save, UM mundo, e vários técnicos humanos
// controlando clubes diferentes dentro dele:
//
//     MUNDO (temporada, clubes, atletas, competições, mercado)
//       ├── Gustavo → Cruzeiro
//       ├── João    → Flamengo
//       ├── Pedro   → Palmeiras
//       └── Lucas   → Grêmio
//
// Se o Cruzeiro compra um atacante do Santos, ele deixa de existir para os
// outros três. O mercado é um só. O caixa, não: cada clube tem o seu.
//
// O que já existia e NÃO precisa ser reinventado
// ─────────────────────────────────────────────
// `lib/universo-286.ts` já é esse mundo: guarda todo clube com saldo, orçamento,
// teto de folha, elenco com contratos, tabelas e negócios — puro e testável.
// O que faltava era só o conceito de CONTROLADOR: o save conhecia um técnico
// (`managerName` + `selectedTeamShort`, no singular) e o mundo inteiro girava em
// torno dele.
//
// ⚠️ `lib/multiplayer-engine.ts` tem sessão com slots e "pronto", mas é uma
// maquete: NADA além de `app/multiplayer-local/page.tsx` o importa, e ele grava
// numa chave própria de localStorage, fora do save. Não dirige carreira nenhuma.
// Este módulo é o que liga a ideia ao mundo de verdade.
//
// Este arquivo é PURO: sem React, sem store, sem localStorage.

export type TipoDeTecnico = "humano" | "ia"

export interface TecnicoDoSave {
  id: string
  nome: string
  /** Clube que ele comanda. `null` = desempregado (existe no mundo, sem clube). */
  clubeCurto: string | null
  /**
   * IDENTIDADE REAL DO CLUBE.
   *
   * ⚠️ `curto` NÃO é único: 134 códigos se repetem no banco, e desde a 1.0.304
   * cada técnico escolhe o clube dele em qualquer país — ou seja, a colisão
   * deixou de ser hipótese. Sem o `file_key`, `getTeamByShort` devolveria o
   * primeiro homônimo e a pessoa sentaria num clube que não é o dela.
   *
   * Opcional só por causa dos saves criados na 1.0.302/303, em que a escolha era
   * limitada à liga do anfitrião; ausente, vale o `clubeCurto`.
   */
  clubeFileKey?: string
  /** Nome cheio do clube, para a mesa não virar uma lista de siglas. */
  clubeNome?: string
  /** Liga escolhida por ele — pode não ser a do anfitrião. */
  ligaLabel?: string
  /** País da liga escolhida. */
  paisNome?: string
  /** Seleção acumulada, como Diniz no Fluminense e no Brasil. */
  selecaoId?: string | null
  tipo: TipoDeTecnico
}

/**
 * TETO DE OITO no co-op local.
 *
 * Não é limitação técnica: é a mesa. Em hot-seat cada técnico segura o
 * computador enquanto decide, então uma rodada custa o tempo de todos somado —
 * é isso, e não o motor, que impõe um teto.
 *
 * ⚠️ Quem mexer neste número mexe no custo de uma rodada, não numa constante
 * qualquer: com oito pessoas, ninguém avança enquanto a oitava não fechar.
 */
export const MAXIMO_DE_TECNICOS = 8

export type FaseDaRodada =
  | "preparacao"
  | "aguardando_tecnicos"
  | "processando"
  | "pos_rodada"

export interface RodadaCompartilhada {
  numero: number
  fase: FaseDaRodada
  /** Ids dos técnicos que já fecharam as decisões desta rodada. */
  prontos: string[]
}

export interface ErroDeElenco {
  campo: "nome" | "clube" | "quantidade"
  mensagem: string
}

/**
 * Valida um grupo de técnicos ANTES de criar a carreira.
 *
 * ⚠️ A invariante que mais importa é **um clube por técnico**. Dois humanos no
 * mesmo clube não é uma variante do modo: é um mundo incoerente, em que dois
 * elencos titulares e dois caixas disputam o mesmo registro. Barrar na criação é
 * a única hora barata de barrar.
 */
export function validarTecnicos(tecnicos: TecnicoDoSave[]): ErroDeElenco[] {
  const erros: ErroDeElenco[] = []
  const humanos = tecnicos.filter(t => t.tipo === "humano")

  if (humanos.length < 1) {
    erros.push({ campo: "quantidade", mensagem: "É preciso ao menos um técnico." })
  }
  if (humanos.length > MAXIMO_DE_TECNICOS) {
    erros.push({
      campo: "quantidade",
      mensagem: `No máximo ${MAXIMO_DE_TECNICOS} técnicos por save.`,
    })
  }

  const nomesVistos = new Set<string>()
  for (const t of humanos) {
    const nome = t.nome.trim()
    if (!nome) {
      erros.push({ campo: "nome", mensagem: "Todo técnico precisa de um nome." })
      continue
    }
    // Nome repetido não quebra o mundo, mas quebra a MESA: na hora de passar o
    // computador ninguém sabe de quem é a vez.
    const chave = nome.toLowerCase()
    if (nomesVistos.has(chave)) {
      erros.push({ campo: "nome", mensagem: `Há dois técnicos chamados "${nome}".` })
    }
    nomesVistos.add(chave)
  }

  // ⚠️ Técnico SEM clube não é erro: `clubeCurto: null` é o desempregado, que
  // existe no mundo sem comandar ninguém. Quem exige clube é a tela de criação
  // da mesa, e ela o faz não deixando entrar sem escolher.

  // ⚠️ A comparação é pelo `file_key`, não pelo `curto`. Com a escolha livre de
  // país (1.0.304) dois clubes DIFERENTES podem ter o mesmo `curto` — barrá-los
  // como "o mesmo clube" impediria uma mesa perfeitamente válida.
  const clubesVistos = new Set<string>()
  for (const t of humanos) {
    if (!t.clubeCurto) continue
    const chave = chaveDoClube(t)
    if (clubesVistos.has(chave)) {
      erros.push({
        campo: "clube",
        mensagem: `Dois técnicos escolheram o mesmo clube (${t.clubeNome ?? t.clubeCurto}).`,
      })
    }
    clubesVistos.add(chave)
  }

  return erros
}

/**
 * Identidade do clube de um técnico.
 *
 * O `file_key` manda quando existe; o `curto` é a saída para os saves feitos
 * antes de ele passar a ser gravado.
 */
export function chaveDoClube(tecnico: Pick<TecnicoDoSave, "clubeCurto" | "clubeFileKey">): string {
  return tecnico.clubeFileKey ?? tecnico.clubeCurto ?? ""
}

/**
 * Quem controla este clube? `null` = a máquina.
 *
 * ⚠️ Passe o `fileKey` sempre que tiver: sem ele, um clube de outro país com o
 * mesmo `curto` seria confundido com o do técnico da mesa, e a partida entraria
 * no caminho de "dois humanos" contra um adversário que é da CPU.
 */
export function tecnicoDoClube(
  tecnicos: TecnicoDoSave[],
  clubeCurto: string | null | undefined,
  fileKey?: string | null,
): TecnicoDoSave | null {
  if (!clubeCurto) return null
  const humanos = tecnicos.filter(t => t.tipo === "humano")
  if (fileKey) {
    const porArquivo = humanos.find(t => t.clubeFileKey === fileKey)
    if (porArquivo) return porArquivo
    // Um técnico COM file_key que não bate não é este clube, mesmo que o `curto`
    // coincida — é justamente o homônimo que este parâmetro existe para separar.
    return humanos.find(t => !t.clubeFileKey && t.clubeCurto === clubeCurto) ?? null
  }
  return humanos.find(t => t.clubeCurto === clubeCurto) ?? null
}

/** O confronto é entre dois humanos? É o caso que muda a experiência da rodada. */
export function ehDuploHumano(
  tecnicos: TecnicoDoSave[],
  mandante: string | null | undefined,
  visitante: string | null | undefined,
): boolean {
  return Boolean(tecnicoDoClube(tecnicos, mandante) && tecnicoDoClube(tecnicos, visitante))
}

export function iniciarRodada(numero: number): RodadaCompartilhada {
  return { numero, fase: "aguardando_tecnicos", prontos: [] }
}

/** Marca que este técnico fechou as decisões dele. Idempotente. */
export function marcarPronto(rodada: RodadaCompartilhada, tecnicoId: string): RodadaCompartilhada {
  if (rodada.prontos.includes(tecnicoId)) return rodada
  return { ...rodada, prontos: [...rodada.prontos, tecnicoId] }
}

/** Desmarca — o técnico voltou para mexer no time antes de a rodada rodar. */
export function desmarcarPronto(rodada: RodadaCompartilhada, tecnicoId: string): RodadaCompartilhada {
  if (!rodada.prontos.includes(tecnicoId)) return rodada
  return { ...rodada, prontos: rodada.prontos.filter(id => id !== tecnicoId) }
}

/** Falta alguém? Devolve os técnicos que ainda não fecharam. */
export function faltamFechar(
  rodada: RodadaCompartilhada,
  tecnicos: TecnicoDoSave[],
): TecnicoDoSave[] {
  return tecnicos.filter(t => t.tipo === "humano" && !rodada.prontos.includes(t.id))
}

/**
 * A rodada só anda quando TODOS fecharam.
 *
 * ⚠️ Esta é a trava do hot-seat, e ela precisa existir no MODELO, não só no
 * botão: se a interface esquecer de desabilitar "avançar", o mundo avançaria
 * com o time de alguém sem escalação — e essa pessoa perderia a rodada sem ter
 * jogado.
 */
export function podeAvancar(rodada: RodadaCompartilhada, tecnicos: TecnicoDoSave[]): boolean {
  return faltamFechar(rodada, tecnicos).length === 0
}

/** Próximo técnico a sentar no computador; `null` quando todos já fecharam. */
export function proximoAJogar(
  rodada: RodadaCompartilhada,
  tecnicos: TecnicoDoSave[],
): TecnicoDoSave | null {
  return faltamFechar(rodada, tecnicos)[0] ?? null
}

/**
 * Passa a rodada para a fase seguinte quando ela pode andar.
 * Devolve a MESMA rodada se ainda falta alguém — quem chama compara por
 * referência e sabe que nada aconteceu.
 */
export function avancarFase(
  rodada: RodadaCompartilhada,
  tecnicos: TecnicoDoSave[],
): RodadaCompartilhada {
  if (rodada.fase === "aguardando_tecnicos") {
    if (!podeAvancar(rodada, tecnicos)) return rodada
    return { ...rodada, fase: "processando" }
  }
  if (rodada.fase === "processando") return { ...rodada, fase: "pos_rodada" }
  if (rodada.fase === "pos_rodada") return iniciarRodada(rodada.numero + 1)
  return { ...rodada, fase: "aguardando_tecnicos" }
}

/**
 * COMPATIBILIDADE COM SAVE DE UM TÉCNICO SÓ.
 *
 * Todo save existente tem `managerName` e `selectedTeamShort` no singular, e
 * dezenas de telas leem esses dois campos. Em vez de migrar tudo de uma vez,
 * um save antigo é lido como uma lista de UM técnico — e os campos singulares
 * continuam valendo como "de quem é a vez". É o que permite o modo novo entrar
 * sem reescrever o jogo inteiro.
 */
export function tecnicosDoSave(
  guardados: TecnicoDoSave[] | undefined,
  managerName: string,
  selectedTeamShort: string | null,
): TecnicoDoSave[] {
  if (guardados?.length) return guardados
  return [{
    id: "tecnico-1",
    nome: managerName || "Técnico",
    clubeCurto: selectedTeamShort,
    tipo: "humano",
  }]
}

/** É um save multitécnico? Um só técnico segue sendo carreira normal. */
export function ehMultitecnico(tecnicos: TecnicoDoSave[]): boolean {
  return tecnicos.filter(t => t.tipo === "humano").length > 1
}
