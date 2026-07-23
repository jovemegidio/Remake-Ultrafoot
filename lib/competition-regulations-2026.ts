import { competitionsByLeague, type Competition } from "./international-competitions"

// Regulamentos-base da temporada 2026. Estes dados ficam separados da simulação para
// impedir que telas diferentes descrevam formatos divergentes.
export interface CompetitionRegulation2026 {
  id: string
  name: string
  participants: number
  format: string
  promotion?: number
  relegation?: number
  season: 2026
  clubs?: readonly string[]
  firstPhaseRounds?: number
  groups?: number
  knockout?: readonly string[]
  finalLegs?: 1 | 2
  source?: string
  sourceUrl?: string
  cycle?: "2026" | "2026/27"
  validationLevel?: "official-specific-source" | "official-entity-index"
  tiebreakers?: readonly string[]
  registrationRules?: readonly string[]
  startsOn?: string
  endsOn?: string
  /** Quantidade de jogos por fase do mata-mata, na ordem oficial da edicao. */
  knockoutLegs?: Readonly<Record<string, 1 | 2>>
  stageRounds?: Readonly<Record<string, number>>
  /**
   * Potes do sorteio, quando a competicao usa esse formato (Paulistao 2026).
   * Diferente de `groups`: ali os times do mesmo grupo NAO se enfrentam; aqui o
   * clube enfrenta justamente os do proprio pote, mais alguns de fora.
   */
  pots?: readonly (readonly string[])[]
  /** Competições podem coexistir no calendário; prioridade não significa exclusividade. */
  calendarPolicy?: "parallel" | "after-state" | "season-cycle"
}

const DEFAULT_TIEBREAKERS = ["pontos", "saldo de gols", "gols marcados", "confronto direto quando previsto", "fair play", "sorteio"] as const

const CORE_COMPETITION_REGULATIONS_2026: Record<string, CompetitionRegulation2026> = {
  brasileirao_a: { id: "brasileirao_a", name: "Brasileirão Série A", participants: 20, format: "Pontos corridos, turno e returno (38 rodadas)", relegation: 4, season: 2026, startsOn: "2026-01-28", endsOn: "2026-12-02", calendarPolicy: "parallel" },
  brasileirao_b: { id: "brasileirao_b", name: "Brasileirão Série B", participants: 20, format: "38 rodadas; 1º e 2º sobem direto; playoffs em ida e volta entre 3º x 6º e 4º x 5º definem as outras duas vagas", promotion: 4, relegation: 4, season: 2026, startsOn: "2026-03-21", endsOn: "2026-11-28", calendarPolicy: "after-state" },
  brasileirao_c: { id: "brasileirao_c", name: "Brasileirão Série C", participants: 20, format: "Grupo único; G8 em dois quadrangulares; dois primeiros de cada grupo sobem", promotion: 4, relegation: 2, season: 2026, startsOn: "2026-04-05", endsOn: "2026-10-25", calendarPolicy: "after-state" },
  brasileirao_d: { id: "brasileirao_d", name: "Brasileirão Série D", participants: 96, format: "16 grupos de 6; G4 avança ao mata-mata; semifinalistas e 2 vencedores dos playoffs sobem", promotion: 6, season: 2026, startsOn: "2026-04-05", endsOn: "2026-09-13", calendarPolicy: "after-state" },
  copa_brasil: { id: "copa_brasil", name: "Copa do Brasil", participants: 126, format: "1ª e 3ª/4ª fases em jogo único; 2ª e 5ª fases e oitavas até semifinais em ida e volta; final única", season: 2026, startsOn: "2026-02-18", endsOn: "2026-12-06", calendarPolicy: "parallel" },
  paulistao_a1: { id: "paulistao_a1", name: "Paulistão A1", participants: 16, format: "Quatro potes de quatro; cada clube enfrenta os 3 do seu pote e mais 5 de outros potes (8 jogos, turno único); G8 avança; quartas e semifinal em jogo único, com pênaltis em caso de empate; final em ida e volta; dois rebaixados", relegation: 2, season: 2026, firstPhaseRounds: 8, pots: [["Corinthians", "Palmeiras", "São Paulo", "Santos"], ["São Bernardo", "Novorizontino", "RB Bragantino", "Mirassol"], ["Guarani", "Ponte Preta", "Velo Clube", "Portuguesa"], ["Botafogo-SP", "Primavera", "Noroeste", "Capivariano"]], knockout: ["quartas", "semifinal", "final"], knockoutLegs: { quartas: 1, semifinal: 1, final: 2 }, finalLegs: 2, startsOn: "2026-01-10", endsOn: "2026-03-08", calendarPolicy: "season-cycle", source: "FPF REC 2026", sourceUrl: "https://futebolpaulista.com.br/Repositorio/Competicao/Regulamento/2026", cycle: "2026", validationLevel: "official-specific-source", tiebreakers: DEFAULT_TIEBREAKERS, clubs: ["Ponte Preta", "Velo Clube", "Botafogo-SP", "Capivariano", "Noroeste", "Novorizontino", "Guarani", "Mirassol", "Portuguesa", "Primavera", "RB Bragantino", "Santos", "São Bernardo", "São Paulo", "Palmeiras", "Corinthians"] },
  paulistao_a2: { id: "paulistao_a2", name: "Paulistão A2", participants: 16, format: "Turno único de 15 rodadas; G8 em dois quadrangulares de turno e returno; semifinais e final em ida e volta", promotion: 2, relegation: 2, season: 2026, firstPhaseRounds: 15, knockout: ["segunda_fase", "semifinal", "final"], stageRounds: { segunda_fase: 6, semifinal: 2, final: 2 }, knockoutLegs: { semifinal: 2, final: 2 }, finalLegs: 2, startsOn: "2026-01-11", endsOn: "2026-05-13", calendarPolicy: "season-cycle", source: "FPF REC A2 2026", clubs: ["Água Santa", "Inter de Limeira", "Ituano", "Taubaté", "Ferroviária", "XV de Piracicaba", "São José", "Santo André", "Grêmio Prudente", "Oeste", "Juventus", "Linense", "Votuporanguense", "São Bento", "Sertãozinho", "Monte Azul"] },
  paulistao_a3: { id: "paulistao_a3", name: "Paulistão A3", participants: 16, format: "Turno único de 15 rodadas; G8 no mata-mata em ida e volta", promotion: 2, relegation: 2, season: 2026, firstPhaseRounds: 15, knockout: ["quartas", "semifinal", "final"], knockoutLegs: { quartas: 2, semifinal: 2, final: 2 }, finalLegs: 2, source: "FPF REC A3 2026", clubs: ["Portuguesa Santista", "Rio Claro", "Marília", "Rio Branco", "Desportivo Brasil", "União São João", "Catanduva", "Itapirense", "Rio Preto", "União Suzano", "XV de Jaú", "Francana", "EC São Bernardo", "Bandeirante", "União Barbarense", "Paulista"] },
  carioca_a1: { id: "carioca_a1", name: "Campeonato Carioca A1", participants: 12, format: "Dois grupos de seis enfrentam a outra chave em seis rodadas; G8 nas quartas; quartas e semifinais sem vantagem e com pênaltis", relegation: 1, season: 2026, firstPhaseRounds: 6, groups: 2, knockout: ["quartas", "semifinal", "final"], knockoutLegs: { quartas: 1, semifinal: 1, final: 2 }, finalLegs: 2, startsOn: "2026-01-11", endsOn: "2026-03-08", calendarPolicy: "season-cycle", clubs: ["Bangu", "Boavista", "Botafogo", "Flamengo", "Fluminense", "Madureira", "Maricá", "Nova Iguaçu", "Portuguesa-RJ", "Sampaio Corrêa-RJ", "Vasco da Gama", "Volta Redonda"], source: "FERJ REC 2026" },
  mineiro_modulo_i: { id: "mineiro_modulo_i", name: "Campeonato Mineiro Módulo I", participants: 12, format: "Três grupos de quatro; oito jogos somente contra as outras chaves; líderes e melhor segundo às semifinais; semifinal em ida e volta e final única", relegation: 2, season: 2026, firstPhaseRounds: 8, groups: 3, knockout: ["semifinal", "final"], knockoutLegs: { semifinal: 2, final: 1 }, finalLegs: 1, startsOn: "2026-01-10", endsOn: "2026-03-08", calendarPolicy: "season-cycle", clubs: ["Atlético-MG", "Uberlândia", "Democrata-GV", "URT", "América-MG", "Tombense", "Betim", "Pouso Alegre", "Cruzeiro", "Athletic Club", "Itabirito", "North"], source: "FMF REC 2026" },
  gaucho_a1: { id: "gaucho_a1", name: "Gauchão A1", participants: 12, format: "Dois grupos de seis; seis jogos contra a outra chave; G8 às quartas em jogo único; semifinais e final em ida e volta; quadrangular de permanência do 9º ao 12º", relegation: 2, season: 2026, firstPhaseRounds: 6, groups: 2, knockout: ["quartas", "semifinal", "final"], knockoutLegs: { quartas: 1, semifinal: 2, final: 2 }, finalLegs: 2, startsOn: "2026-01-10", endsOn: "2026-03-08", calendarPolicy: "season-cycle", clubs: ["Avenida", "Caxias", "Grêmio", "Guarany de Bagé", "Internacional", "Inter-SM", "Juventude", "Monsoon", "Novo Hamburgo", "São José-RS", "São Luiz", "Ypiranga-RS"], source: "FGF REC 2026" },
  // ── Estaduais 2026 confirmados na fonte (auditoria 2026-07-23) ────────────
  // Sem regulamento proprio, estes seis rodavam num turno-unico generico que
  // nao correspondia a nenhuma federacao. Cada formato abaixo foi conferido na
  // divulgacao oficial da edicao de 2026, nao herdado de temporada anterior.
  baiano: { id: "baiano", name: "Campeonato Baiano", participants: 10, format: "Turno único de nove rodadas; G4 às semifinais; NOVIDADE de 2026: semifinal e final em jogo único (antes ida e volta); dois rebaixados", relegation: 2, season: 2026, firstPhaseRounds: 9, knockout: ["semifinal", "final"], knockoutLegs: { semifinal: 1, final: 1 }, finalLegs: 1, startsOn: "2026-01-10", endsOn: "2026-03-08", calendarPolicy: "season-cycle", source: "FBF REC 2026", clubs: ["Bahia", "Vitória", "Atlético de Alagoinhas", "Bahia de Feira", "Barcelona de Ilhéus", "Galícia", "Jacuipense", "Jequié", "Juazeirense", "Porto"] },
  paranaense: { id: "paranaense", name: "Campeonato Paranaense", participants: 12, format: "MUDOU em 2026: saiu do turno único para dois grupos de seis, que se enfrentam somente contra a outra chave (seis rodadas); os quatro melhores de cada grupo vão às quartas e se enfrentam dentro do próprio grupo; quartas, semifinal e final em ida e volta; VAR a partir das quartas", relegation: 2, season: 2026, firstPhaseRounds: 6, groups: 2, knockout: ["quartas", "semifinal", "final"], knockoutLegs: { quartas: 2, semifinal: 2, final: 2 }, finalLegs: 2, startsOn: "2026-01-10", endsOn: "2026-03-08", calendarPolicy: "season-cycle", source: "FPF-PR REC 2026" },
  pernambucano: { id: "pernambucano", name: "Campeonato Pernambucano", participants: 8, format: "Menor edição desde 1978: oito clubes em turno único de sete rodadas; os seis primeiros avançam; 1º e 2º entram direto na semifinal, enquanto 3º a 6º disputam a segunda fase em ida e volta; semifinal e final em ida e volta", relegation: 2, season: 2026, firstPhaseRounds: 7, knockout: ["segunda_fase", "semifinal", "final"], knockoutLegs: { segunda_fase: 2, semifinal: 2, final: 2 }, finalLegs: 2, startsOn: "2026-01-10", endsOn: "2026-03-08", calendarPolicy: "season-cycle", source: "FPF-PE REC 2026", clubs: ["Sport", "Náutico", "Santa Cruz", "Retrô", "Decisão", "Jaguar", "Maguary", "Vitória-PE"] },
  cearense: { id: "cearense", name: "Campeonato Cearense", participants: 10, format: "Dois grupos de cinco em turno único (quatro jogos por clube); os três melhores de cada grupo vão à segunda fase, em dois novos grupos de três com jogo único; os dois melhores de cada avançam; semifinal e final em ida e volta; os dois últimos de cada grupo disputam o quadrangular do rebaixamento", relegation: 2, season: 2026, firstPhaseRounds: 4, groups: 2, knockout: ["segunda_fase", "semifinal", "final"], stageRounds: { segunda_fase: 2 }, knockoutLegs: { semifinal: 2, final: 2 }, finalLegs: 2, startsOn: "2026-01-10", endsOn: "2026-03-08", calendarPolicy: "season-cycle", source: "FCF-CE REC 2026", clubs: ["Fortaleza", "Ceará", "Ferroviário", "Floresta", "Horizonte", "Iguatu", "Maracanã", "Maranguape", "Quixadá", "Tirol"] },
  goiano: { id: "goiano", name: "Campeonato Goiano", participants: 12, format: "Três grupos de quatro; oito rodadas somente contra os outros dois grupos; os oito melhores da classificação geral avançam; quartas, semifinal e final em ida e volta", relegation: 2, season: 2026, firstPhaseRounds: 8, groups: 3, knockout: ["quartas", "semifinal", "final"], knockoutLegs: { quartas: 2, semifinal: 2, final: 2 }, finalLegs: 2, startsOn: "2026-01-10", endsOn: "2026-03-08", calendarPolicy: "season-cycle", source: "FGF-GO Regulamento Goianão 2026", sourceUrl: "https://www.fgf.esp.br/assets/uploads/file/Regulamento%20Goian%C3%A3o%202026.pdf" },
  catarinense: { id: "catarinense", name: "Campeonato Catarinense", participants: 12, format: "Dois grupos de seis que se enfrentam apenas contra a outra chave (seis rodadas); os quatro melhores de cada grupo vão às quartas e se enfrentam dentro do próprio grupo, em confrontos inéditos (1º x 4º e 2º x 3º); quartas, semifinal e final em ida e volta", relegation: 2, season: 2026, firstPhaseRounds: 6, groups: 2, knockout: ["quartas", "semifinal", "final"], knockoutLegs: { quartas: 2, semifinal: 2, final: 2 }, finalLegs: 2, startsOn: "2026-01-10", endsOn: "2026-03-08", calendarPolicy: "season-cycle", source: "FCF REC Série A 2026", sourceUrl: "https://fcf.com.br/regulamento-geral-de-competicoes-2026/" },
  // ── Os 17 estaduais restantes (auditoria 2026-07-23) ─────────────────────
  // Com estes, os 27 estados rodam no formato da propria federacao em vez do
  // turno unico generico. Dezesseis foram conferidos na divulgacao de 2026; o
  // Amapaense so teve o numero de clubes confirmado (ver nota no proprio item).
  alagoano: { id: "alagoano", name: "Campeonato Alagoano", participants: 8, format: "Oito clubes em turno único de sete rodadas; G4 às semifinais; semifinal e final em ida e volta, com o melhor colocado mandando o segundo jogo; o oitavo é rebaixado", relegation: 1, season: 2026, firstPhaseRounds: 7, knockout: ["semifinal", "final"], knockoutLegs: { semifinal: 2, final: 2 }, finalLegs: 2, startsOn: "2026-01-10", endsOn: "2026-03-22", calendarPolicy: "season-cycle", source: "FAF REC Série A 2026" },
  paraense: { id: "paraense", name: "Campeonato Paraense", participants: 12, format: "Dois grupos de seis que se enfrentam somente contra a outra chave (seis rodadas); os oito melhores da classificação geral avançam; quartas e semifinais em JOGO ÚNICO e final em ida e volta", relegation: 2, season: 2026, firstPhaseRounds: 6, groups: 2, knockout: ["quartas", "semifinal", "final"], knockoutLegs: { quartas: 1, semifinal: 1, final: 2 }, finalLegs: 2, startsOn: "2026-01-24", endsOn: "2026-03-08", calendarPolicy: "season-cycle", source: "FPF-PA REC Série A1 2026" },
  amazonense: { id: "amazonense", name: "Campeonato Amazonense", participants: 8, format: "Barezão em DOIS TURNOS: no primeiro os clubes do Grupo A enfrentam os do B; no segundo jogam dentro do próprio grupo. Em cada turno os quatro melhores vão às quartas em cruzamento olímpico, com vantagem do empate para a melhor campanha; a final do estadual é entre os campeões dos dois turnos, e quem vencer os dois é campeão direto", season: 2026, firstPhaseRounds: 7, groups: 2, knockout: ["quartas", "semifinal", "final"], knockoutLegs: { quartas: 1, semifinal: 1, final: 2 }, finalLegs: 2, startsOn: "2026-01-10", endsOn: "2026-03-22", calendarPolicy: "season-cycle", source: "FAF-AM REC Série A 2026" },
  brasiliense: { id: "brasiliense", name: "Campeonato Brasiliense", participants: 10, format: "Candangão em fórmula simples: primeira fase em turno único de nove rodadas, semifinal e final", season: 2026, firstPhaseRounds: 9, knockout: ["semifinal", "final"], knockoutLegs: { semifinal: 2, final: 2 }, finalLegs: 2, startsOn: "2026-01-10", endsOn: "2026-03-21", calendarPolicy: "season-cycle", source: "FFDF Regulamento Candangão 2026" },
  capixaba: { id: "capixaba", name: "Campeonato Capixaba", participants: 10, format: "Dez clubes em turno único de nove rodadas; G8 às quartas; quartas, semifinal e final em ida e volta; NOVIDADE de 2026: volta a vantagem nas quartas para os quatro primeiros, mas semifinal e final são sem vantagem, com pênaltis; dois rebaixados", relegation: 2, season: 2026, firstPhaseRounds: 9, knockout: ["quartas", "semifinal", "final"], knockoutLegs: { quartas: 2, semifinal: 2, final: 2 }, finalLegs: 2, startsOn: "2026-01-10", endsOn: "2026-03-22", calendarPolicy: "season-cycle", source: "FES REC Capixabão 2026" },
  mato_grossense: { id: "mato_grossense", name: "Campeonato Mato-Grossense", participants: 10, format: "Pontos corridos em turno único de nove rodadas; 1º e 2º vão direto à semifinal e do 3º ao 6º disputam as quartas em jogo único; 7º e 8º estão eliminados; 9º e 10º são rebaixados", relegation: 2, season: 2026, firstPhaseRounds: 9, knockout: ["quartas", "semifinal", "final"], knockoutLegs: { quartas: 1, semifinal: 2, final: 2 }, finalLegs: 2, startsOn: "2026-01-10", endsOn: "2026-03-22", calendarPolicy: "season-cycle", source: "FMF-MT REC 2026", clubs: ["Cuiabá", "Mixto", "Luverdense", "Operário-VG", "Nova Mutum", "União-MT", "Sport Sinop", "Primavera-MT", "Chapada", "Várzea Grande"] },
  potiguar: { id: "potiguar", name: "Campeonato Potiguar", participants: 8, format: "Oito clubes em turno único de sete rodadas; 1º e 2º avançam direto e os demais passam por um mata-mata que define os outros semifinalistas", season: 2026, firstPhaseRounds: 7, knockout: ["quartas", "semifinal", "final"], knockoutLegs: { quartas: 1, semifinal: 2, final: 2 }, finalLegs: 2, startsOn: "2026-01-10", endsOn: "2026-03-22", calendarPolicy: "season-cycle", source: "FNF REC 2026", clubs: ["ABC", "América-RN", "Globo", "Santa Cruz de Natal", "Potiguar de Mossoró", "Potyguar Seridoense", "Laguna", "QFC"] },
  paraibano: { id: "paraibano", name: "Campeonato Paraibano", participants: 10, format: "Grupo único com jogos só de ida (nove rodadas); G4 à semifinal, com 1º x 4º e 2º x 3º; semifinal e final em ida e volta, com a melhor campanha decidindo em casa — 13 datas no total; dois rebaixados", relegation: 2, season: 2026, firstPhaseRounds: 9, knockout: ["semifinal", "final"], knockoutLegs: { semifinal: 2, final: 2 }, finalLegs: 2, startsOn: "2026-01-17", endsOn: "2026-04-08", calendarPolicy: "season-cycle", source: "FPF-PB REC 2026" },
  maranhense: { id: "maranhense", name: "Campeonato Maranhense", participants: 8, format: "Grupo único com jogos só de ida (sete rodadas); G4 à semifinal em 1º x 4º e 2º x 3º; semifinal e final em ida e volta; 6º e 7º disputam um mata-mata de permanência", relegation: 1, season: 2026, firstPhaseRounds: 7, knockout: ["semifinal", "final"], knockoutLegs: { semifinal: 2, final: 2 }, finalLegs: 2, startsOn: "2026-01-10", endsOn: "2026-03-22", calendarPolicy: "season-cycle", source: "FMF-MA REC Série A 2026", clubs: ["Sampaio Corrêa", "Moto Club", "Maranhão", "Imperatriz", "IAPE", "Tuntum", "Luminense", "ITZ Sport"] },
  piauiense: { id: "piauiense", name: "Campeonato Piauiense", participants: 8, format: "Oito clubes em turno único de sete rodadas, com as fases classificatórias somando pontos; G4 à semifinal; semifinal e final em ida e volta", season: 2026, firstPhaseRounds: 7, knockout: ["semifinal", "final"], knockoutLegs: { semifinal: 2, final: 2 }, finalLegs: 2, startsOn: "2026-01-10", endsOn: "2026-03-18", calendarPolicy: "season-cycle", source: "FFP REC Série A 2026" },
  sergipano: { id: "sergipano", name: "Campeonato Sergipano", participants: 10, format: "Dez clubes em grupo único de turno único (nove jogos); o LÍDER vai direto à semifinal e do 2º ao 7º formam três chaves de eliminatória em jogo único, com o melhor colocado em casa; os três vencedores completam a semifinal; semifinal e final em ida e volta", relegation: 2, season: 2026, firstPhaseRounds: 9, knockout: ["segunda_fase", "semifinal", "final"], stageRounds: { segunda_fase: 1 }, knockoutLegs: { semifinal: 2, final: 2 }, finalLegs: 2, startsOn: "2026-01-10", endsOn: "2026-03-22", calendarPolicy: "season-cycle", source: "FSF REC Série A1 2026", sourceUrl: "https://fsf-se.com.br/wp-content/uploads/2025/12/Regulamento-Campeonato-Sergipano-de-Futebol-Profissional-da-Serie-A1-2026-1.pdf" },
  rondoniense: { id: "rondoniense", name: "Campeonato Rondoniense", participants: 7, format: "Sete clubes em TURNO E RETURNO (42 jogos, o único estadual de returno completo nesta lista); G4 à semifinal em cruzamento olímpico; semifinal e final em ida e volta, com 1º e 2º decidindo em casa", season: 2026, firstPhaseRounds: 14, knockout: ["semifinal", "final"], knockoutLegs: { semifinal: 2, final: 2 }, finalLegs: 2, startsOn: "2026-01-17", endsOn: "2026-03-14", calendarPolicy: "season-cycle", source: "FFER REC Série A 2026", clubs: ["Porto Velho", "Rondoniense", "Genus", "Barcelona-RO", "Ji-Paraná", "Cacoalense", "Guaporé"] },
  // AMAPAENSE: unico dos 27 em que a divulgacao publica confirmou apenas o
  // numero de clubes (8) e o periodo. O mata-mata segue o padrao dominante dos
  // estaduais pequenos (G4, semifinal e final em ida e volta) — por isso o
  // validationLevel abaixo e o de indice da entidade, nao o de fonte especifica.
  amapaense: { id: "amapaense", name: "Campeonato Amapaense", participants: 8, format: "Oito clubes em turno único de sete rodadas; G4 à semifinal; semifinal e final em ida e volta", season: 2026, firstPhaseRounds: 7, knockout: ["semifinal", "final"], knockoutLegs: { semifinal: 2, final: 2 }, finalLegs: 2, startsOn: "2026-02-11", endsOn: "2026-04-22", calendarPolicy: "season-cycle", source: "FAF-AP Amapazão Série A 2026", validationLevel: "official-entity-index" },
  sul_mato_grossense: { id: "sul_mato_grossense", name: "Campeonato Sul-Mato-Grossense", participants: 10, format: "Dez clubes em pontos corridos de turno único (nove rodadas); 1º e 2º vão direto à semifinal e do 3º ao 6º disputam as quartas em ida e volta; semifinal e final também em dois jogos, com pênaltis em caso de empate no agregado; dois rebaixados", relegation: 2, season: 2026, firstPhaseRounds: 9, knockout: ["quartas", "semifinal", "final"], knockoutLegs: { quartas: 2, semifinal: 2, final: 2 }, finalLegs: 2, startsOn: "2026-01-18", endsOn: "2026-03-22", calendarPolicy: "season-cycle", source: "FFMS REC Série A 2026" },
  acreano: { id: "acreano", name: "Campeonato Acreano", participants: 8, format: "Oito clubes em turno único de sete rodadas; G4 à semifinal, em ida e volta com vantagem do empate para os dois primeiros; a FINAL é em jogo único e sem vantagem, com pênaltis se empatar", season: 2026, firstPhaseRounds: 7, knockout: ["semifinal", "final"], knockoutLegs: { semifinal: 2, final: 1 }, finalLegs: 1, startsOn: "2026-01-12", endsOn: "2026-03-29", calendarPolicy: "season-cycle", source: "FFAC REC 2026", clubs: ["Rio Branco-AC", "Galvez", "Humaitá", "Independência-AC", "Vasco-AC", "ADESG", "São Francisco - AC", "Santa Cruz-AC"] },
  roraimense: { id: "roraimense", name: "Campeonato Roraimense", participants: 9, format: "Nove clubes em chave única de turno único; G4 à semifinal; as fases eliminatórias são disputadas em PARTIDAS ÚNICAS", season: 2026, firstPhaseRounds: 9, knockout: ["semifinal", "final"], knockoutLegs: { semifinal: 1, final: 1 }, finalLegs: 1, startsOn: "2026-01-24", endsOn: "2026-03-22", calendarPolicy: "season-cycle", source: "FRF REC 2026" },
  tocantinense: { id: "tocantinense", name: "Campeonato Tocantinense", participants: 8, format: "Oito clubes com jogos só de ida (sete rodadas); os quatro melhores vão à semifinal; semifinal e final em ida e volta; os dois últimos são rebaixados", relegation: 2, season: 2026, firstPhaseRounds: 7, knockout: ["semifinal", "final"], knockoutLegs: { semifinal: 2, final: 2 }, finalLegs: 2, startsOn: "2026-01-10", endsOn: "2026-03-22", calendarPolicy: "season-cycle", source: "FTF REC 2026", clubs: ["Tocantinópolis", "Palmas", "Capital-TO", "Guaraí", "Bela Vista-TO", "Gurupi", "União-TO", "Araguaína"] },
  champions_league: { id: "champions_league", name: "UEFA Champions League", participants: 36, format: "Liga única com 8 jogos; 1º–8º às oitavas, 9º–24º aos playoffs", season: 2026 },
  europa_league: { id: "europa_league", name: "UEFA Europa League", participants: 36, format: "Liga única com 8 jogos e playoffs antes das oitavas", season: 2026 },
  conference_league: { id: "conference_league", name: "UEFA Conference League", participants: 36, format: "Liga única com 6 jogos e playoffs antes das oitavas", season: 2026 },
  libertadores: { id: "libertadores", name: "CONMEBOL Libertadores", participants: 47, format: "Três fases preliminares, 8 grupos de 4 e mata-mata; final em jogo único", season: 2026 },
  sulamericana: { id: "sulamericana", name: "CONMEBOL Sul-Americana", participants: 44, format: "Fase preliminar, 8 grupos de 4, playoffs e mata-mata; final em jogo único", season: 2026 },
}

const OFFICIAL_SOURCE_BY_ID: Partial<Record<string, string>> = {
  brasileirao_a: "https://www.cbf.com.br/futebol-brasileiro/noticias/campeonato-brasileiro/serie-a/cbf-divulga-tabela-detalhada-das-primeiras-rodadas-do-brasileirao-2026",
  brasileirao_b: "https://www.cbf.com.br/futebol-brasileiro/noticias/campeonato-brasileiro-serie-c/a/cbf-divulga-documentos-tecnicos-do-brasileirao-da-serie-b-de-2026",
  brasileirao_c: "https://www.cbf.com.br/futebol-brasileiro/noticias/amistoso/amistosos/cbf-publica-documentos-tecnicos-da-serie-c-de-2026",
  brasileirao_d: "https://www.cbf.com.br/futebol-brasileiro/noticias/campeonato-brasileiro/S%C3%A3o%20Paulo-x-Corinthians/cbf-divulga-grupos-da-serie-d-de-2026",
  copa_brasil: "https://www.cbf.com.br/futebol-brasileiro/noticias/competicoes-ranking/a/cbf-divulga-tabela-basica-plano-geral-de-acoes-e-regulamento-especifico-da-copa-do-brasil-2026",
  champions_league: "https://documents.uefa.com/r/Regulations-of-the-UEFA-Champions-League-2026/27/Article-17-Match-system-league-phase-Online",
  europa_league: "https://documents.uefa.com/r/Regulations-of-the-UEFA-Europa-League-2026/27/Article-17-Match-system-league-phase-Online",
  conference_league: "https://documents.uefa.com/r/Regulations-of-the-UEFA-Conference-League-2026/27/Article-17-Match-system-league-phase-Online",
  libertadores: "https://cdn.conmebol.com/wp-content/uploads/2025/12/Manual-de-Clubes-CONMEBOL-Libertadores-2026-ESP.pdf",
  sulamericana: "https://cdn.conmebol.com/wp-content/uploads/2025/12/Manual-de-Clubes-CONMEBOL-Sudamericana-2026-ESP.pdf",
  afc_champions_league: "https://assets.the-afc.com/downloads/tournament-regulations/Amended-ACL-Elite-26-27-Competition-Regulations-Apr28upd.pdf",
  concacaf_champions: "https://www.concacaf.com/media/jgvd55qf/2026-concacaf-champions-cup-regulations-english.pdf",
  mls: "https://www.mlssoccer.com/league-reports/competition-guidelines/",
  mls_cup: "https://www.mlssoccer.com/league-reports/competition-guidelines/",
  liga_argentina: "https://www.ligaprofesional.ar/wp-content/uploads/2026/01/Reglamento-Torneos-LPF-Primera-2026.pdf",
  primera_a_col: "https://dimayor.com.co/wp-content/uploads/2026/01/REGLAMENTO-LIGA-2026-V12.pdf",
  primera_div_chi: "https://www.anfp.cl/bases-de-campeonatos/bases-campeonato-nacional-de-primera-division-2026/",
  pro_league_bel: "https://www.proleague.be/nieuws/vanaf-seizoen-26-27-met-18-clubs-in-de-jupiler-pro-league",
  challenger_pro: "https://www.proleague.be/nieuws/vanaf-seizoen-26-27-met-18-clubs-in-de-jupiler-pro-league",
  j_league: "https://www.jleague.jp/sp/news/article/31576/",
  j2_league: "https://www.jleague.jp/sp/news/article/31576/",
  k_league_1: "https://www.kleague.com/about/competition.do",
  k_league_2: "https://www.kleague.com/about/competition.do",
  primeira_liga: "https://lojaoficial.ligaportugal.pt/en/liga-portugal/about-us_204.html",
  liga_portugal_2: "https://lojaoficial.ligaportugal.pt/en/liga-portugal/about-us_204.html",
  ligue_1: "https://www.lfp.fr/assets/20251204_CA_Calendrier_General_26_27_Annexe_a0e398aab0.pdf",
  ligue_2: "https://www.lfp.fr/article/publication-du-calendrier-general-de-la-ligue-2-bkt-pour-la-saison-2026-2027",
  serie_a_ita: "https://en.legaseriea.it/serie-a/news/looking-forward-to-the-2026-27-serie-a-fixture-list",
  coppa_italia: "https://img.legaseriea.it/vimages/68a58bc9/Regolamento%20Generale%20Competizioni%20Lega%20Serie%20A_2025-26.pdf",
  championship: "https://www.efl.com/news/2026/march/05/efl-statement--sky-bet-championship-play-off-format/",
  fa_cup: "https://www.thefa.com/news/2026/jun/26/clubs-accepted-exemptions-mens-fa-cup-fa-youth-fa-trophy-fa-vase-2026-27",
  scottish_prem: "https://spfl.co.uk/admin/filemanager/images/shares/pdfs/MASTER%20-%20Rules%20and%20Regulations%20%2824%20April%202024%29.pdf",
  tff_1_lig: "https://www.tff.org/Resources/TFF/Auto/18c19be2866242679eb483a7a154e0cf.pdf",
  super_lig: "https://www.tff.org/Resources/TFF/Documents/STATULER/2026-2027/2026-2027-sezonu-super-lig-musabakalari-statusu.pdf",
  saudi_pro_league: "https://www.spl.com.sa/en/news/1071407/spl-confirms-2026-27-season-calendar",
  leagues_cup: "https://subinternacional.ligamx.net/cancha/detallenoticia/47205",
  premier_league: "https://www.premierleague.com/en/news/3011036",
  efl_cup: "https://www.efl.com/news/2026/january/12/efl-kick-off-dates-confirmed-for-2026-27-season/",
  la_liga: "https://rfef.es/es/noticias/el-futbol-espanol-conoce-los-calendarios-para-la-temporada-202627",
  copa_del_rey: "https://rfef.es/sites/default/files/pdf/circulares/5._Circular_88_-_Torneos_Federacion___Anexo.pdf",
  supercopa_espana: "https://rfef.es/sites/default/files/pdf/circulares/5._Circular_88_-_Torneos_Federacion___Anexo.pdf",
  bundesliga: "https://www.dfb.de/rahmenterminkalender",
  bundesliga_2: "https://www.dfb.de/rahmenterminkalender",
  dfb_pokal: "https://www.dfb.de/maenner/wettbewerbe/dfb-pokal/rahmentermine",
  supercup_ger: "https://www.dfb.de/rahmenterminkalender",
  eredivisie: "https://www.knvb.nl/downloads/bestand/30062/definitiefcompetitieprogrammavriendenloterijeredivisie",
  eerste_divisie: "https://www.knvb.nl/competities/keuken-kampioen-divisie",
  us_open_cup: "https://www.ussoccer.com/stories/2025/12/format-schedule-participating-teams-finalized-for-2026-lamar-hunt-us-open-cup",
  primera_b_arg: "https://assets1.afa.com.ar/2025/LEA-2026/ENERO/Boletin-Especial-6823---Reglamento-del-Campeonato-de-Primera-Nacional-2026.pdf",
  torneo_betplay: "https://dimayor.com.co/wp-content/uploads/2026/04/REGLAMENTO-TORNEO-2026-V3.pdf",
  primera_b_chi: "https://www.anfp.cl/bases-de-campeonatos/bases-campeonato-primera-b-2026/",
  chinese_super: "https://www.thecfa.cn/lstz/20251120/37089.html",
  china_league_one: "https://www.thecfa.cn/lstz/20251120/37089.html",
  paulistao: "https://futebolpaulista.com.br/Repositorio/Competicao/Regulamento/2026",
  carioca: "https://www.fferj.com.br/Campeonatos",
  mineiro: "https://m.fmf.com.br/competicoes/proxjogos.aspx?d=1",
  gaucho: "https://fgf.com.br/competicoes/profissional/23",
  supercoppa: "https://img.legaseriea.it/vimages/649ac001/IAO%20COPPA%20ITALIA_SUPERCOPPA%20ITALIANA_2024-2027.pdf",
  coupe_de_france: "https://www.fff.fr/11-les-reglements/390-les-reglements-des-competitions-nationales.html",
  coupe_de_la_ligue: "https://www.fff.fr/article/15924-le-calendrier-general-2026-2027-officialise.html",
  taca_portugal: "https://www.fpf.pt/DownloadDocument.ashx?id=32637",
  kings_cup: "https://www.saff.com.sa/en/news.php?id=3631",
  saudi_first_division: "https://www.saff.com.sa/en/teams.php?id=2&season=24",
  liga_mx: "https://subinternacional.ligamx.net/cancha/detallenoticia/46954/por-el-mundial-el-torneo-que-hoy-inicia-se-llamara-clausura-2026-con-mexico",
  liguilla: "https://subinternacional.ligamx.net/cancha/detallenoticia/46954/por-el-mundial-el-torneo-que-hoy-inicia-se-llamara-clausura-2026-con-mexico",
  primera_div_ury: "https://www.auf.org.uy/liga-auf-uruguaya/",
  serie_b_ita: "https://www.legab.it/news/elezione-figc-mandato-esplorativo-a-bedin-focus-su-contenuti-da-presentare-ai-candidati",
  segunda_div_ury: "https://auf.org.uy/se-sorteo-el-fixture-de-la-segunda-division-profesional-2026/",
}

const OFFICIAL_SOURCE_BY_REGION: Record<string, string> = {
  brasil: "https://www.cbf.com.br/futebol-brasileiro",
  inglaterra: "https://www.thefa.com/football-rules-governance/lawsandrules",
  espanha: "https://rfef.es/es/federacion/normativas-y-circulares",
  italia: "https://www.legaseriea.it/lega-serie-a/documentazione",
  alemanha: "https://www.dfb.de/verbandsservice/publikationen/fussballregeln",
  franca: "https://www.lfp.fr/reglements",
  portugal: "https://www.ligaportugal.pt/pt/epocas/20262027/regulamentos",
  arabia_saudita: "https://www.spl.com.sa/en/regulations",
  usa: "https://www.mlssoccer.com/league-reports/competition-guidelines/",
  mexico: "https://fmf.mx/justicia-deportiva/reglamentos",
  sao_paulo: "https://futebolpaulista.com.br/Repositorio/Competicao/Regulamento/2026",
  rio_de_janeiro: "https://www.fferj.com.br/Campeonatos",
  minas_gerais: "https://fmf.com.br/Competicoes/Regulamentos",
  rio_grande_sul: "https://fgf.com.br/competicoes",
  japao: "https://www.jleague.jp/sp/news/article/31576/",
  holanda: "https://www.knvb.nl/assist/assist-wedstrijdsecretarissen/veldvoetbal/regelgeving",
  escocia: "https://spfl.co.uk/pages/rules-and-regulations",
  turquia: "https://www.tff.org/default.aspx?pageID=687",
  belgica: "https://www.proleague.be/nieuws/vanaf-seizoen-26-27-met-18-clubs-in-de-jupiler-pro-league",
  russia: "https://premierliga.ru/rfpl/documents/",
  argentina: "https://www.ligaprofesional.ar/institucional/reglamentos/",
  colombia: "https://dimayor.com.co/reglamentos/",
  chile: "https://www.anfp.cl/bases-de-campeonatos/",
  uruguai: "https://www.auf.org.uy/documentos/",
  coreia_do_sul: "https://www.kleague.com/about/competition.do",
  china: "https://www.thecfa.cn/lstz/20251120/37089.html",
  asia: "https://www.the-afc.com/en/more/content/official_documents.html",
  america_norte: "https://www.concacaf.com/competitions/champions-cup/regulations/",
  europa: "https://documents.uefa.com/",
  america_sul: "https://www.conmebol.com/documentos/",
}

function catalogRegulation(competition: Competition): CompetitionRegulation2026 {
  const sourceUrl = OFFICIAL_SOURCE_BY_ID[competition.id] ?? OFFICIAL_SOURCE_BY_REGION[competition.region]
  const cycle: "2026" | "2026/27" = ["brasil", "argentina", "colombia", "chile", "uruguai", "usa", "japao", "coreia_do_sul", "china", "america_sul", "america_norte"].includes(competition.region) ? "2026" : "2026/27"
  return {
    id: competition.id,
    name: competition.name,
    participants: competition.teams,
    format: competition.formatDetails ?? `${competition.format}${competition.rounds ? `; ${competition.rounds} rodadas` : ""}`,
    promotion: competition.promotion,
    relegation: competition.relegation,
    season: 2026,
    firstPhaseRounds: competition.rounds,
    groups: competition.groups,
    source: sourceUrl ? new URL(sourceUrl).hostname : "",
    sourceUrl,
    cycle,
    validationLevel: OFFICIAL_SOURCE_BY_ID[competition.id] ? "official-specific-source" : "official-entity-index",
    tiebreakers: DEFAULT_TIEBREAKERS,
    registrationRules: competition.id === "primera_div_chi"
      ? ["até seis estrangeiros habilitados", "máximo de cinco estrangeiros simultaneamente em campo, além da exceção formativa", "um chileno nascido a partir de 2005 na súmula", "mínimo de 70% dos minutos da fase regular para atletas jovens elegíveis"]
      : competition.id === "torneo_betplay"
        ? ["até 25 profissionais", "até cinco profissionais adicionais nascidos a partir de 2006 e vinculados à base do clube"]
        : competition.id === "afc_champions_league"
          ? ["lista máxima de 35 atletas", "Lista A de até 25 e Lista B de até 10", "seis vagas da Lista A reservadas a jogadores formados localmente"]
          : undefined,
  }
}

const CATALOG_REGULATIONS_2026 = Object.values(competitionsByLeague)
  .flat()
  .reduce<Record<string, CompetitionRegulation2026>>((rules, competition) => {
    rules[competition.id] ??= catalogRegulation(competition)
    return rules
  }, {})

export const COMPETITION_REGULATIONS_2026: Record<string, CompetitionRegulation2026> = {
  ...CATALOG_REGULATIONS_2026,
  ...Object.fromEntries(Object.entries(CORE_COMPETITION_REGULATIONS_2026).map(([id, regulation]) => [
    id,
    {
      ...CATALOG_REGULATIONS_2026[id],
      sourceUrl: regulation.sourceUrl ?? CATALOG_REGULATIONS_2026[id]?.sourceUrl ?? (
        id.startsWith("paulistao") ? OFFICIAL_SOURCE_BY_REGION.sao_paulo
          : id === "carioca_a1" ? OFFICIAL_SOURCE_BY_REGION.rio_de_janeiro
            : id === "mineiro_modulo_i" ? OFFICIAL_SOURCE_BY_REGION.minas_gerais
              : id === "gaucho_a1" ? OFFICIAL_SOURCE_BY_REGION.rio_grande_sul
                : undefined
      ),
      cycle: regulation.cycle ?? CATALOG_REGULATIONS_2026[id]?.cycle ?? "2026",
      validationLevel: regulation.validationLevel ?? CATALOG_REGULATIONS_2026[id]?.validationLevel ?? "official-specific-source",
      tiebreakers: regulation.tiebreakers ?? CATALOG_REGULATIONS_2026[id]?.tiebreakers ?? DEFAULT_TIEBREAKERS,
      ...regulation,
    },
  ])),
}

export const BRAZIL_MOVEMENTS_2026 = {
  serieA: {
    promoted: ["Athletico-PR", "Chapecoense", "Coritiba", "Remo"],
    relegated: ["Ceará", "Fortaleza", "Juventude", "Sport"],
  },
  serieC: {
    promotedFromD: ["Barra-SC", "Inter de Limeira", "Maranhão", "Santa Cruz"],
  },
  paulistaoA2: {
    relegatedFromA1: ["Água Santa", "Inter de Limeira"],
    promotedFromA3: ["Sertãozinho", "Monte Azul"],
  },
} as const
