"use client"

// DEMISSÕES NA RODADA — o resto do mundo também troca de técnico.
//
// O jogo já gerava propostas de emprego (board-engine.generateJobOffers), mas as
// vagas surgiam do nada: nenhum técnico era demitido em lugar nenhum. O mundo
// era estático e as ofertas, arbitrárias.
//
// Aqui as vagas passam a ter CAUSA: clubes com campanha ruim demitem, isso vira
// notícia da rodada, e é dessa lista que saem as propostas. O jogador entende
// por que foi procurado — e vê que o próprio emprego é do mesmo tipo.

export interface DemissaoRodada {
  clubeCurto: string
  clubeNome: string
  tecnico: string
  motivo: string
  /** Posição na tabela quando caiu — é o que justifica. */
  posicao: number
}

/** Clube candidato a demitir, do ponto de vista do simulador. */
export interface ClubeNaBerlinda {
  curto: string
  nome: string
  tecnico: string
  posicao: number
  totalTimes: number
  /** Vitórias nos últimos 5 jogos. */
  vitoriasRecentes: number
  /** Onde a diretoria esperava estar. */
  expectativa: number
}

const MOTIVOS = [
  "sequência de maus resultados",
  "campanha muito abaixo do esperado",
  "derrota em casa para rival direto",
  "pressão da torcida após novo tropeço",
  "eliminação precoce",
]

/**
 * Decide quem cai nesta rodada.
 *
 * A regra é a mesma do futebol: o que demite não é a posição absoluta, é a
 * DISTÂNCIA da expectativa. Um clube 12º que esperava ser 14º está bem; um 8º
 * que esperava título está em crise.
 *
 * Teto de 2 por rodada: mais que isso vira novela e tira o peso de cada queda.
 */
export function demissoesDaRodada(
  clubes: ClubeNaBerlinda[],
  sorteio: () => number = Math.random,
): DemissaoRodada[] {
  const candidatos = clubes
    .map(c => {
      const frustracao = c.posicao - c.expectativa          // positivo = pior que o esperado
      const seca = 2 - Math.min(2, c.vitoriasRecentes)      // 0..2
      const zona = c.posicao > c.totalTimes - 4 ? 2 : 0     // zona de rebaixamento pesa
      return { clube: c, risco: frustracao * 0.6 + seca * 1.5 + zona }
    })
    .filter(x => x.risco >= 4)
    .sort((a, b) => b.risco - a.risco)

  const saida: DemissaoRodada[] = []
  for (const { clube, risco } of candidatos.slice(0, 4)) {
    // Mesmo em crise, demissão não é certa — diretoria hesita, e isso é realista.
    const chance = Math.min(0.55, 0.10 + risco * 0.05)
    if (sorteio() >= chance) continue
    saida.push({
      clubeCurto: clube.curto,
      clubeNome: clube.nome,
      tecnico: clube.tecnico,
      motivo: MOTIVOS[Math.floor(sorteio() * MOTIVOS.length) % MOTIVOS.length],
      posicao: clube.posicao,
    })
    if (saida.length >= 2) break
  }
  return saida
}

/** Manchete pronta para o feed de notícias. */
export function manchete(d: DemissaoRodada): string {
  return `${d.clubeNome} demite ${d.tecnico} após ${d.motivo} (${d.posicao}º colocado).`
}

// ─── NOME DO TÉCNICO DOS OUTROS CLUBES ────────────────────────────────────────
//
// Os clubes da IA não têm técnico em lugar nenhum do jogo: só o usuário tem
// `managerName`. Sem um nome, a notícia sairia como "o Santos demite seu
// técnico", que é pior que não ter notícia.
//
// O nome é DERIVADO do clube (+ quantas vezes ele já trocou), então é estável
// entre semanas e entre recarregamentos do save — sem precisar guardar um
// técnico por clube do mundo inteiro.

const PRENOMES = [
  "Abel", "Adenor", "Antônio", "Bruno", "Carlos", "Cuca", "Dorival", "Eduardo",
  "Fábio", "Fernando", "Filipe", "Gabriel", "Hernán", "Jair", "Joel", "Lisca",
  "Luiz", "Marcelo", "Mano", "Márcio", "Odair", "Paulo", "Pedro", "Rafael",
  "Renato", "Roger", "Rogério", "Tiago", "Vagner", "Vanderlei", "Vítor", "Zé",
]
const SOBRENOMES = [
  "Almeida", "Barbosa", "Braga", "Caixinha", "Carille", "Ceni", "Coelho",
  "Crespo", "Cruz", "Dias", "Ferreira", "Gomes", "Guimarães", "Jesus",
  "Lopes", "Machado", "Maldonado", "Mendes", "Moreira", "Nunes", "Oliveira",
  "Pacheco", "Pereira", "Ramalho", "Ribeiro", "Rocha", "Sampaio", "Santana",
  "Silva", "Soares", "Teixeira", "Zubeldía",
]

function embaralhar(texto: string): number {
  let h = 2166136261
  for (const c of texto) h = Math.imul(h ^ c.charCodeAt(0), 16777619)
  return h >>> 0
}

/**
 * Nome do técnico de um clube da IA. `trocas` é quantas vezes o clube já
 * demitiu nesta carreira — é o que faz o substituto ser outra pessoa.
 */
export function tecnicoDoClube(curto: string, trocas = 0): string {
  const semente = embaralhar(`${curto}#${trocas}`)
  const prenome = PRENOMES[semente % PRENOMES.length]
  const sobrenome = SOBRENOMES[Math.floor(semente / PRENOMES.length) % SOBRENOMES.length]
  return `${prenome} ${sobrenome}`
}
