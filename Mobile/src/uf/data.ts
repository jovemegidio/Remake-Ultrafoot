// Dados de exemplo do Ultrafoot de bolso. Aqui é o ponto de plugar os dados reais
// do jogo (elenco, calendário, competições) — a estrutura já espelha a do desktop.

export type Player = {
  id: number
  name: string
  pos: "GOL" | "ZAG" | "LAT" | "VOL" | "MEI" | "PON" | "ATA"
  ovr: number
  age: number
  number: number
}

export type Fixture = {
  id: number
  home: string
  away: string
  comp: string
  date: string // ISO
  homeScore?: number
  awayScore?: number
}

export const CLUB = {
  name: "Seu Clube FC",
  short: "SCF",
  league: "Brasileirão Série A",
  position: 3,
  played: 12,
  points: 24,
  form: ["V", "V", "E", "D", "V"] as const,
  budget: "R$ 18,4 mi",
  manager: "Técnico",
}

export const SQUAD: Player[] = [
  { id: 1, name: "Bruno Alves", pos: "GOL", ovr: 82, age: 29, number: 1 },
  { id: 2, name: "Léo Ramos", pos: "LAT", ovr: 76, age: 24, number: 2 },
  { id: 3, name: "Diego Costa", pos: "ZAG", ovr: 84, age: 31, number: 3 },
  { id: 4, name: "Rafael Nunes", pos: "ZAG", ovr: 80, age: 27, number: 4 },
  { id: 5, name: "Fernando Dias", pos: "LAT", ovr: 74, age: 22, number: 6 },
  { id: 6, name: "Caio Menezes", pos: "VOL", ovr: 81, age: 28, number: 5 },
  { id: 7, name: "Pedro Henrique", pos: "MEI", ovr: 86, age: 26, number: 10 },
  { id: 8, name: "Gustavo Lima", pos: "MEI", ovr: 78, age: 23, number: 8 },
  { id: 9, name: "Vinícius Rocha", pos: "PON", ovr: 83, age: 21, number: 7 },
  { id: 10, name: "Matheus Silva", pos: "PON", ovr: 79, age: 25, number: 11 },
  { id: 11, name: "Anderson Souza", pos: "ATA", ovr: 88, age: 27, number: 9 },
  { id: 12, name: "Lucas Ferreira", pos: "GOL", ovr: 71, age: 20, number: 12 },
  { id: 13, name: "Thiago Barros", pos: "ZAG", ovr: 73, age: 19, number: 14 },
  { id: 14, name: "Ryan Oliveira", pos: "VOL", ovr: 75, age: 21, number: 15 },
  { id: 15, name: "Kauã Martins", pos: "ATA", ovr: 70, age: 18, number: 19 },
  { id: 16, name: "Enzo Cardoso", pos: "MEI", ovr: 72, age: 20, number: 20 },
]

export const FIXTURES: Fixture[] = [
  { id: 1, home: "Seu Clube FC", away: "Rival United", comp: "Brasileirão", date: "2026-08-02", homeScore: 2, awayScore: 1 },
  { id: 2, home: "Azulão EC", away: "Seu Clube FC", comp: "Brasileirão", date: "2026-08-09" },
  { id: 3, home: "Seu Clube FC", away: "Montanha FC", comp: "Copa do Brasil", date: "2026-08-13" },
  { id: 4, home: "Litoral SC", away: "Seu Clube FC", comp: "Brasileirão", date: "2026-08-17" },
  { id: 5, home: "Seu Clube FC", away: "Capital FC", comp: "Brasileirão", date: "2026-08-24" },
]

export const NEWS = [
  { id: 1, title: "Ultrafoot de bolso chegou!", body: "Gerencie seu clube no celular. Em breve, sincronizando com sua carreira do desktop." },
  { id: 2, title: "Anderson Souza em grande fase", body: "Artilheiro do time com 9 gols nos últimos 12 jogos." },
  { id: 3, title: "Clássico no próximo fim de semana", body: "Prepare a escalação para o duelo contra o Azulão EC." },
]

// Formação 4-3-3 para a tela de Táticas (posições em % do campo).
export const FORMATION_433: { label: string; x: number; y: number }[] = [
  { label: "GOL", x: 50, y: 92 },
  { label: "LD", x: 82, y: 74 },
  { label: "ZAG", x: 62, y: 78 },
  { label: "ZAG", x: 38, y: 78 },
  { label: "LE", x: 18, y: 74 },
  { label: "VOL", x: 50, y: 58 },
  { label: "MEI", x: 68, y: 46 },
  { label: "MEI", x: 32, y: 46 },
  { label: "PON", x: 82, y: 28 },
  { label: "ATA", x: 50, y: 20 },
  { label: "PON", x: 18, y: 28 },
]
