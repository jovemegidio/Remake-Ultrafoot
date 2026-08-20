// GERENTE DE FOCO — onde o jogador esta, e para onde ele vai.
//
// ── O que existia antes ─────────────────────────────────────────────────────
// Duas coisas, nenhuma inteira. O provider tinha um registro de focaveis com a
// navegacao DESLIGADA (`void handleNavigate`) porque, ligada, ela clicava itens
// da barra lateral no meio de outras acoes. E `useTelaGamepad` fazia
// `document.querySelectorAll` do documento INTEIRO a cada toque de D-pad —
// sem escopo (o D-pad alcancava a tela atras do modal), sem memoria (fechar o
// modal perdia o atleta selecionado) e varrendo centenas de nos por aperto.
//
// ── As tres decisoes deste arquivo ──────────────────────────────────────────
//
// 1. ESCOPO. Um modal empilha o proprio escopo; enquanto ele existir, so os
//    focaveis dele sao alcancaveis. E o que impede o D-pad de selecionar coisa
//    atras do modal, sem cada modal precisar saber que gamepad existe.
//
// 2. MEMORIA POR ESCOPO. Ao desempilhar, o foco volta EXATAMENTE para onde
//    estava. Abrir a ficha do Neymar, fechar e continuar no Neymar — nao no
//    primeiro da lista. Sem isso, navegar um elenco de 30 no controle e
//    insuportavel.
//
// 3. RECT SOB DEMANDA, COM CACHE POR APERTO. `getBoundingClientRect()` forca
//    layout. Medir 300 focaveis a cada quadro travaria; medir uma vez por
//    APERTO (dezenas por minuto) e barato e sempre correto, porque entre dois
//    apertos nada mexeu sozinho.

import { ordemDeLeitura, vizinhoNaDirecao, type Candidato, type Direcao, type Retangulo } from "./graph"

export interface OpcoesDoFocavel {
  /** Escopo dono. Padrao: o escopo no topo no momento do registro. */
  escopo?: string
  /** O que "confirmar" faz. Sem isto, o gerente clica o elemento. */
  aoAtivar?: () => void
  /** Peso na escolha do foco inicial. Maior ganha. Padrao 0. */
  prioridadeInicial?: number
  /**
   * Item de lista virtualizada: o indice logico. Permite ao gerente pedir a
   * rolagem ANTES de o elemento existir no DOM.
   */
  indiceVirtual?: number
  /** Id da lista virtualizada dona deste item. */
  listaVirtual?: string
}

interface Focavel extends OpcoesDoFocavel {
  id: string
  escopo: string
  elemento: HTMLElement
}

/**
 * Contrato de uma lista virtualizada.
 *
 * Sem isto, navegar uma lista de 50 mil atletas quebra: o item 4.000 nao esta
 * no DOM, entao ele nao esta registrado, entao o gerente nao o encontra e o
 * foco para no ultimo item renderizado — a lista "acaba" no meio.
 *
 * Com isto, o gerente pede `rolarPara(4000)`, a lista renderiza aquela faixa e
 * o item se registra sozinho no quadro seguinte.
 */
export interface ListaVirtual {
  id: string
  total: () => number
  rolarPara: (indice: number) => void
  /** Indice atualmente em foco, se algum. */
  indiceEmFoco: () => number | null
}

type OuvinteDeFoco = (id: string | null, elemento: HTMLElement | null) => void

const ESCOPO_RAIZ = "raiz"

class GerenteDeFoco {
  private focaveis = new Map<string, Focavel>()
  private escopos: string[] = [ESCOPO_RAIZ]
  private memoria = new Map<string, string>()
  private listas = new Map<string, ListaVirtual>()
  private atual: string | null = null
  private ouvintes = new Set<OuvinteDeFoco>()
  /** Cache de medidas, valido por um unico movimento. Ver decisao 3. */
  private medidas: Map<string, Retangulo> | null = null

  // ── Escopos ───────────────────────────────────────────────────────────────

  escopoAtual(): string {
    return this.escopos[this.escopos.length - 1]
  }

  pushScope(id: string): () => void {
    // Guarda onde estavamos ANTES de subir, para o popScope devolver.
    if (this.atual) this.memoria.set(this.escopoAtual(), this.atual)
    this.escopos.push(id)
    this.atual = null
    this.medidas = null
    return () => this.popScope(id)
  }

  popScope(id: string): void {
    // Remove POR ID: em transicao, um modal pode desmontar depois de outro ter
    // subido. Um `pop()` cego tiraria o escopo errado e o foco ficaria preso
    // num escopo que ninguem mais desenha.
    const i = this.escopos.lastIndexOf(id)
    if (i <= 0) return
    this.escopos.splice(i, 1)
    this.memoria.delete(id)
    this.medidas = null
    this.restoreFocus()
  }

  // ── Registro ──────────────────────────────────────────────────────────────

  registrar(id: string, elemento: HTMLElement, opcoes: OpcoesDoFocavel = {}): () => void {
    this.focaveis.set(id, {
      ...opcoes,
      id,
      elemento,
      escopo: opcoes.escopo ?? this.escopoAtual(),
    })
    this.medidas = null
    return () => this.desregistrar(id)
  }

  desregistrar(id: string): void {
    this.focaveis.delete(id)
    this.medidas = null
    if (this.atual === id) {
      // O item em foco saiu da tela (rolagem virtualizada, filtro, modal
      // fechando). Nao deixamos o foco em nada: o proximo movimento reentra
      // pelo comeco do escopo, o que e melhor do que apontar para um fantasma.
      this.atual = null
      this.avisar()
    }
  }

  registrarLista(lista: ListaVirtual): () => void {
    this.listas.set(lista.id, lista)
    return () => {
      this.listas.delete(lista.id)
    }
  }

  // ── Consulta ──────────────────────────────────────────────────────────────

  get currentFocus(): string | null {
    return this.atual
  }

  elementoAtual(): HTMLElement | null {
    return this.atual ? this.focaveis.get(this.atual)?.elemento ?? null : null
  }

  private doEscopo(): Focavel[] {
    const escopo = this.escopoAtual()
    const lista: Focavel[] = []
    for (const f of this.focaveis.values()) {
      if (f.escopo !== escopo) continue
      // Fora da arvore (React ja removeu, mas o cleanup ainda nao rodou) ou
      // invisivel: nao e alcancavel. `offsetParent` cobre display:none; o
      // retangulo cobre o resto (visibility, tamanho zero, colapsado).
      if (!f.elemento.isConnected) continue
      const r = f.elemento.getBoundingClientRect()
      if (r.width < 1 || r.height < 1) continue
      lista.push(f)
    }
    return lista
  }

  private candidatos(exceto?: string): Candidato<Focavel>[] {
    if (!this.medidas) this.medidas = new Map()
    const cache = this.medidas
    return this.doEscopo()
      .filter(f => f.id !== exceto)
      .map(f => {
        let rect = cache.get(f.id)
        if (!rect) {
          const r = f.elemento.getBoundingClientRect()
          rect = { left: r.left, top: r.top, right: r.right, bottom: r.bottom }
          cache.set(f.id, rect)
        }
        return { item: f, rect }
      })
  }

  // ── Movimento ─────────────────────────────────────────────────────────────

  mover(direcao: Direcao, suave = true): boolean {
    this.medidas = null // uma medida por movimento; ver decisao 3

    const atual = this.atual ? this.focaveis.get(this.atual) : null
    if (!atual || !atual.elemento.isConnected) {
      return this.focarPrimeiro(suave)
    }

    const r = atual.elemento.getBoundingClientRect()
    const origem: Retangulo = { left: r.left, top: r.top, right: r.right, bottom: r.bottom }
    const alvo = vizinhoNaDirecao(origem, this.candidatos(atual.id), direcao)

    if (alvo) return this.focar(alvo.id, suave)

    // Sem vizinho: talvez a lista virtualizada tenha mais itens fora do DOM.
    return this.tentarEsticarListaVirtual(atual, direcao)
  }

  /**
   * Bateu no fim do que esta renderizado — mas a lista pode continuar.
   *
   * Pedimos a rolagem e devolvemos `true` mesmo sem ter mudado o foco ainda: o
   * item novo se registra no proximo quadro e o `focarIndiceVirtual` pendente o
   * pega. Devolver `false` aqui faria a acao "vazar" para o contexto de baixo
   * (trocaria de aba em vez de rolar), que e pior do que um quadro de atraso.
   */
  private tentarEsticarListaVirtual(atual: Focavel, direcao: Direcao): boolean {
    if (direcao !== "up" && direcao !== "down") return false
    if (!atual.listaVirtual || atual.indiceVirtual == null) return false
    const lista = this.listas.get(atual.listaVirtual)
    if (!lista) return false

    const proximo = atual.indiceVirtual + (direcao === "down" ? 1 : -1)
    if (proximo < 0 || proximo >= lista.total()) return false

    lista.rolarPara(proximo)
    this.pendenteVirtual = { lista: atual.listaVirtual, indice: proximo }
    return true
  }

  private pendenteVirtual: { lista: string; indice: number } | null = null

  /**
   * Chamado pela lista virtualizada depois de renderizar a faixa nova.
   *
   * E o unico caminho de volta do "pedi rolagem, espero o item aparecer".
   */
  resolverPendenteVirtual(): void {
    const pendente = this.pendenteVirtual
    if (!pendente) return
    for (const f of this.focaveis.values()) {
      if (f.listaVirtual === pendente.lista && f.indiceVirtual === pendente.indice) {
        this.pendenteVirtual = null
        this.focar(f.id, false)
        return
      }
    }
  }

  focusNext(suave = true): boolean {
    return this.andarNaOrdem(1, suave)
  }

  focusPrevious(suave = true): boolean {
    return this.andarNaOrdem(-1, suave)
  }

  private andarNaOrdem(passo: number, suave: boolean): boolean {
    this.medidas = null
    const ordenados = ordemDeLeitura(this.candidatos())
    if (!ordenados.length) return false
    const i = this.atual ? ordenados.findIndex(f => f.id === this.atual) : -1
    // Circular de proposito: numa barra de abas, passar do ultimo para o
    // primeiro e o esperado; parar seria o controle "morrendo" na ponta.
    const proximo = i < 0 ? (passo > 0 ? 0 : ordenados.length - 1) : (i + passo + ordenados.length) % ordenados.length
    return this.focar(ordenados[proximo].id, suave)
  }

  focarPrimeiro(suave = true): boolean {
    this.medidas = null
    const candidatos = this.candidatos()
    if (!candidatos.length) return false
    // Prioridade explicita primeiro (a tela sabe qual e "o item importante");
    // sem ela, o primeiro na ordem de leitura.
    const comPrioridade = candidatos
      .filter(c => (c.item.prioridadeInicial ?? 0) > 0)
      .sort((a, b) => (b.item.prioridadeInicial ?? 0) - (a.item.prioridadeInicial ?? 0))
    const alvo = comPrioridade[0]?.item ?? ordemDeLeitura(candidatos)[0]
    return alvo ? this.focar(alvo.id, suave) : false
  }

  focar(id: string, suave = true): boolean {
    const f = this.focaveis.get(id)
    if (!f || !f.elemento.isConnected) return false

    this.atual = id
    this.memoria.set(f.escopo, id)

    // `preventScroll` e depois `scrollIntoView` de proposito: deixar o
    // navegador rolar sozinho no `focus()` produz um salto seco e as vezes
    // horizontal. Controlamos a rolagem para poder escolher o comportamento.
    f.elemento.focus({ preventScroll: true })
    f.elemento.scrollIntoView({
      // Suave so quando NAO e repeticao rapida: com o D-pad segurado, animar
      // cada passo faz a lista arrastar atras do foco e a navegacao parece
      // travada. Ver o `suave: false` no repeat do InputManager.
      behavior: suave ? "smooth" : "auto",
      block: "nearest",
      inline: "nearest",
    })
    this.avisar()
    return true
  }

  activate(): boolean {
    const f = this.atual ? this.focaveis.get(this.atual) : null
    if (!f) return false
    if (f.aoAtivar) {
      f.aoAtivar()
    } else {
      f.elemento.click()
    }
    return true
  }

  // ── Memoria ───────────────────────────────────────────────────────────────

  saveFocus(): string | null {
    if (this.atual) this.memoria.set(this.escopoAtual(), this.atual)
    return this.atual
  }

  restoreFocus(): boolean {
    const lembrado = this.memoria.get(this.escopoAtual())
    if (lembrado && this.focaveis.get(lembrado)?.elemento.isConnected) {
      return this.focar(lembrado, false)
    }
    return this.focarPrimeiro(false)
  }

  /** Tela nova: esquece a memoria da raiz, senao o foco tenta voltar para um item que nao existe mais. */
  aoTrocarDeRota(): void {
    this.memoria.delete(ESCOPO_RAIZ)
    this.atual = null
    this.medidas = null
    this.pendenteVirtual = null
    this.avisar()
  }

  limparFoco(): void {
    this.atual = null
    this.avisar()
  }

  // ── Observadores ──────────────────────────────────────────────────────────

  observar(ouvinte: OuvinteDeFoco): () => void {
    this.ouvintes.add(ouvinte)
    return () => {
      this.ouvintes.delete(ouvinte)
    }
  }

  private avisar(): void {
    const el = this.elementoAtual()
    this.ouvintes.forEach(o => o(this.atual, el))
  }
}

export const gerenteDeFoco = new GerenteDeFoco()
export type { Direcao }
