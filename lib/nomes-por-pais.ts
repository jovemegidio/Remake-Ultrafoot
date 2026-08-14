// NOMES DE ATLETA POR PAÍS.
//
// A base do jogo revelava sempre nomes brasileiros — "Lucas Silva", "Kauan
// Oliveira" — porque `youth-academy` sorteava de duas listas fixas e não sabia
// de que país era o clube. Num jogo com 3 mil clubes do mundo inteiro, a base do
// Ajax revelava "Matheus Nascimento", e isso quebra a imersão em toda liga que
// não seja a brasileira.
//
// Isto NÃO inventa dado de jogador real: continua sendo nome gerado, como deve
// ser (um garoto que ainda não estreou não existe em base de dados profissional
// — usar nome real ali duplicaria alguém que já está num elenco). O que muda é
// que o nome gerado passa a combinar com o país do clube.
//
// Módulo sem dependências de propósito: é chamado de dentro de geradores que já
// são puros e determinísticos, e não pode arrastar `teams-data` para eles.

interface ParDeNomes { pri: readonly string[]; ult: readonly string[] }

/**
 * Só os países com liga jogável de peso ganham lista própria. O resto cai no
 * fallback — e o fallback NÃO é o brasileiro: é um conjunto neutro, para não
 * reproduzir o mesmo defeito num país sem lista.
 */
const POR_PAIS: Record<string, ParDeNomes> = {
  brasil: {
    pri: ["Lucas", "Gabriel", "Pedro", "Matheus", "João", "Rafael", "Felipe", "André", "Bruno", "Kauan", "Thiago", "Vitor", "Diego", "Kayke", "Guilherme", "Luan", "Enzo", "Miguel", "Davi", "Arthur"],
    ult: ["Silva", "Santos", "Oliveira", "Lima", "Costa", "Ferreira", "Ribeiro", "Alves", "Carvalho", "Nascimento", "Gomes", "Martins", "Pereira", "Araújo", "Souza", "Rocha", "Barbosa", "Moraes", "Cardoso", "Pinto"],
  },
  argentina: {
    pri: ["Santiago", "Mateo", "Joaquín", "Tomás", "Lautaro", "Facundo", "Nicolás", "Agustín", "Franco", "Julián", "Thiago", "Bautista", "Valentín", "Emiliano"],
    ult: ["González", "Rodríguez", "Fernández", "López", "Martínez", "Pérez", "Sosa", "Romero", "Álvarez", "Benítez", "Acosta", "Medina", "Ortiz", "Cabrera"],
  },
  espanha: {
    pri: ["Pablo", "Álvaro", "Hugo", "Marcos", "Sergio", "Iker", "Adrián", "Javier", "Rubén", "Nico", "Marc", "Gerard", "Aitor", "Unai"],
    ult: ["García", "Martín", "Sánchez", "Ruiz", "Torres", "Navarro", "Molina", "Iglesias", "Vidal", "Serrano", "Castillo", "Ortega", "Herrera", "Gallego"],
  },
  inglaterra: {
    pri: ["Jack", "Harry", "Callum", "Ollie", "Reece", "Mason", "Tyler", "Ethan", "Louie", "Charlie", "Alfie", "Kai", "Jude", "Rhys"],
    ult: ["Smith", "Taylor", "Brown", "Wilson", "Davies", "Walker", "Hughes", "Bennett", "Clarke", "Foster", "Hayes", "Reid", "Ward", "Palmer"],
  },
  franca: {
    pri: ["Lucas", "Enzo", "Nathan", "Théo", "Ilan", "Rayan", "Noah", "Amine", "Yanis", "Mattéo", "Ousmane", "Kylian", "Bilal", "Éric"],
    ult: ["Martin", "Bernard", "Dubois", "Moreau", "Laurent", "Lefebvre", "Girard", "Fontaine", "Diallo", "Traoré", "Camara", "Mendy", "Rousseau", "Perrin"],
  },
  italia: {
    pri: ["Lorenzo", "Matteo", "Francesco", "Alessandro", "Riccardo", "Giacomo", "Davide", "Simone", "Nicolò", "Andrea", "Tommaso", "Federico", "Luca", "Gianluca"],
    ult: ["Rossi", "Ferrari", "Esposito", "Bianchi", "Romano", "Colombo", "Ricci", "Marino", "Greco", "Bruno", "Gallo", "Conti", "De Luca", "Costa"],
  },
  alemanha: {
    pri: ["Leon", "Jonas", "Luca", "Maximilian", "Niklas", "Felix", "Tim", "Jannik", "Elias", "Moritz", "Paul", "Nico", "Youssoufa", "Karim"],
    ult: ["Müller", "Schmidt", "Weber", "Wagner", "Becker", "Hoffmann", "Schäfer", "Koch", "Richter", "Klein", "Wolf", "Neumann", "Braun", "Krüger"],
  },
  portugal: {
    pri: ["Diogo", "Tomás", "Rodrigo", "Gonçalo", "Francisco", "Afonso", "Duarte", "Martim", "Rúben", "Vasco", "Nuno", "Tiago", "Bernardo", "Salvador"],
    ult: ["Silva", "Ferreira", "Pereira", "Sousa", "Fernandes", "Gonçalves", "Marques", "Lopes", "Ramos", "Teixeira", "Correia", "Almeida", "Cardoso", "Pinto"],
  },
  "paises baixos": {
    pri: ["Sem", "Daan", "Luuk", "Jurriën", "Ryan", "Thijs", "Bram", "Stijn", "Jesse", "Mees", "Kick", "Youri", "Quinten", "Milan"],
    ult: ["de Jong", "van Dijk", "Bakker", "Visser", "Smit", "Meijer", "Mulder", "de Boer", "van Rijn", "Timber", "Koopmeiners", "Brobbey", "Hartman", "Veerman"],
  },
  uruguai: {
    pri: ["Facundo", "Mateo", "Nicolás", "Rodrigo", "Santiago", "Bruno", "Maximiliano", "Diego", "Sebastián", "Agustín"],
    ult: ["Rodríguez", "Pereira", "Silva", "González", "Fernández", "Suárez", "Cavani", "Olivera", "Bentancur", "Núñez"],
  },
  peru: {
    pri: ["Luis", "Diego", "Renzo", "Jairo", "Piero", "José", "Carlos", "Adrián", "Franco", "Sebastián"],
    ult: ["Quispe", "Flores", "García", "Rojas", "Ramírez", "Chávez", "Huamán", "Vargas", "Castillo", "Paredes"],
  },
  bolivia: {
    pri: ["José", "Carlos", "Miguel", "Diego", "Luis", "Ramiro", "Marcelo", "Jhon", "Bruno", "Daniel"],
    ult: ["Mamani", "Quispe", "Flores", "Vargas", "Rojas", "Gutiérrez", "Condori", "Mendoza", "Suárez", "Fernández"],
  },
  paraguai: {
    pri: ["Ángel", "Derlis", "Óscar", "Julio", "Matías", "Blas", "Hugo", "Miguel", "Diego", "Alexis"],
    ult: ["González", "Martínez", "Benítez", "Gómez", "Romero", "Ortiz", "Villalba", "Rojas", "Cardozo", "Almirón"],
  },
  venezuela: {
    pri: ["Yeferson", "Jefferson", "José", "Cristian", "Daniel", "Andrés", "Telasco", "Darwin", "Eduard", "Kevin"],
    ult: ["Martínez", "Rondón", "Machís", "Soteldo", "Herrera", "Osorio", "Cásseres", "Navarro", "Rincón", "Aramburu"],
  },
  escocia: {
    pri: ["Lewis", "Jack", "Callum", "Ryan", "Scott", "Ross", "Connor", "Liam", "Ewan", "Jamie"],
    ult: ["Campbell", "Stewart", "Robertson", "McLean", "McGregor", "Fraser", "Murray", "Gordon", "Morrison", "Ferguson"],
  },
  grecia: {
    pri: ["Giorgos", "Dimitris", "Kostas", "Nikos", "Vangelis", "Christos", "Giannis", "Manolis", "Sotiris", "Andreas"],
    ult: ["Papadopoulos", "Georgiou", "Nikolaou", "Christodoulou", "Pappas", "Vasileiou", "Karagiannis", "Oikonomou", "Kostas", "Manolas"],
  },
  dinamarca: {
    pri: ["Mikkel", "Emil", "Oliver", "Magnus", "Frederik", "Rasmus", "Christian", "Jonas", "Victor", "Andreas"],
    ult: ["Nielsen", "Jensen", "Hansen", "Andersen", "Pedersen", "Christensen", "Larsen", "Sørensen", "Rasmussen", "Madsen"],
  },
  tchequia: {
    pri: ["Tomáš", "Jan", "Jakub", "Lukáš", "Petr", "Matěj", "Adam", "Martin", "David", "Václav"],
    ult: ["Novák", "Svoboda", "Novotný", "Dvořák", "Černý", "Procházka", "Kučera", "Veselý", "Horák", "Němec"],
  },
  azerbaijao: {
    pri: ["Ali", "Elvin", "Tural", "Ramil", "Namik", "Mahir", "Emin", "Rashad", "Araz", "Nijat"],
    ult: ["Mammadov", "Aliyev", "Huseynov", "Hasanov", "Ibrahimov", "Abbasov", "Jafarov", "Karimov", "Quliyev", "Suleymanov"],
  },
  noruega: {
    pri: ["Erik", "Magnus", "Kristoffer", "Sander", "Martin", "Emil", "Oskar", "Marius", "Andreas", "Jonas"],
    ult: ["Hansen", "Johansen", "Olsen", "Larsen", "Andersen", "Nilsen", "Pedersen", "Kristiansen", "Berg", "Solberg"],
  },
  chipre: {
    pri: ["Andreas", "Giorgos", "Marios", "Christos", "Nicolas", "Michalis", "Ioannis", "Constantinos", "Panayiotis", "Sotiris"],
    ult: ["Georgiou", "Christodoulou", "Ioannou", "Andreou", "Kyriakou", "Nicolaou", "Michael", "Charalambous", "Demetriou", "Constantinou"],
  },
  cazaquistao: {
    pri: ["Abat", "Bauyrzhan", "Askhat", "Islam", "Maksim", "Serik", "Daniyar", "Bakhtiyar", "Nuraly", "Arman"],
    ult: ["Aymbetov", "Zaynutdinov", "Tagybergen", "Alip", "Vorogovskiy", "Suyumbayev", "Orazov", "Kuat", "Maliy", "Bystrov"],
  },
  turquia: {
    pri: ["Arda", "Kerem", "Emir", "Yusuf", "Mert", "Hakan", "Ozan", "Kaan", "Efe", "Burak"],
    ult: ["Yılmaz", "Kaya", "Demir", "Şahin", "Çelik", "Yıldız", "Aydın", "Öztürk", "Arslan", "Doğan"],
  },
  russia: {
    pri: ["Aleksandr", "Dmitri", "Maksim", "Ivan", "Nikita", "Mikhail", "Artem", "Kirill", "Pavel", "Andrei"],
    ult: ["Ivanov", "Smirnov", "Kuznetsov", "Popov", "Sokolov", "Lebedev", "Kozlov", "Novikov", "Morozov", "Volkov"],
  },
  japao: {
    pri: ["Haruto", "Yuto", "Sota", "Ren", "Kaito", "Daiki", "Takumi", "Riku", "Hinata", "Shota"],
    ult: ["Sato", "Suzuki", "Takahashi", "Tanaka", "Watanabe", "Ito", "Yamamoto", "Nakamura", "Kobayashi", "Kato"],
  },
  "coreia do sul": {
    pri: ["Min-jun", "Seo-jun", "Ji-ho", "Hyun-woo", "Jun-ho", "Dong-hyun", "Sung-min", "Jae-won", "Tae-yang", "Woo-jin"],
    ult: ["Kim", "Lee", "Park", "Choi", "Jung", "Kang", "Cho", "Yoon", "Jang", "Lim"],
  },
  china: {
    pri: ["Wei", "Jun", "Hao", "Tao", "Lei", "Bo", "Jian", "Peng", "Ming", "Long"],
    ult: ["Wang", "Li", "Zhang", "Liu", "Chen", "Yang", "Huang", "Zhao", "Wu", "Zhou"],
  },
  "arabia saudita": {
    pri: ["Mohammed", "Abdullah", "Fahad", "Saud", "Khalid", "Nawaf", "Salem", "Yasser", "Sultan", "Hassan"],
    ult: ["Al-Qahtani", "Al-Dawsari", "Al-Harbi", "Al-Shammari", "Al-Ghamdi", "Al-Otaibi", "Al-Zahrani", "Al-Anazi", "Al-Mutairi", "Al-Shehri"],
  },
}

/** Nem brasileiro nem de nenhum país específico: mistura sóbria e internacional. */
const NEUTRO: ParDeNomes = {
  pri: ["Adam", "Daniel", "David", "Marko", "Stefan", "Ivan", "Omar", "Karim", "Nikola", "Anton", "Milan", "Emre", "Luka", "Filip"],
  ult: ["Novak", "Petrov", "Horvat", "Popescu", "Kovač", "Nowak", "Andersson", "Jansen", "Hassan", "Yilmaz", "Marković", "Nilsen", "Varga", "Sørensen"],
}

const semAcento = (s: string) =>
  (s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim()

/**
 * Grafias que aparecem no catálogo e no pool para o mesmo país. O `country-normalize`
 * resolve boa parte, mas este módulo é chamado de geradores puros que não o importam.
 */
const APELIDOS: Record<string, string> = {
  "franca": "franca", "frança": "franca",
  "italia": "italia", "itália": "italia",
  "holanda": "paises baixos", "países baixos": "paises baixos",
  "inglaterra": "inglaterra", "reino unido": "inglaterra",
  "espanha": "espanha", "alemanha": "alemanha", "portugal": "portugal",
  "brasil": "brasil", "argentina": "argentina", "uruguai": "uruguai",
  "peru": "peru", "bolivia": "bolivia", "paraguai": "paraguai", "venezuela": "venezuela",
  "escocia": "escocia", "grécia": "grecia", "grecia": "grecia", "dinamarca": "dinamarca",
  "tchéquia": "tchequia", "tchequia": "tchequia", "república tcheca": "tchequia",
  "azerbaijão": "azerbaijao", "azerbaijao": "azerbaijao", "noruega": "noruega",
  "chipre": "chipre", "cazaquistão": "cazaquistao", "cazaquistao": "cazaquistao",
  "turquia": "turquia", "rússia": "russia", "russia": "russia",
  "japão": "japao", "japao": "japao", "coreia do sul": "coreia do sul",
  "china": "china", "arábia saudita": "arabia saudita", "arabia saudita": "arabia saudita",
}

/** Listas de nome do país, ou o conjunto neutro quando não houver. */
export function nomesDoPais(pais: string | undefined): ParDeNomes {
  const chave = APELIDOS[semAcento(pais ?? "")] ?? semAcento(pais ?? "")
  return POR_PAIS[chave] ?? NEUTRO
}

/**
 * Nome completo gerado para o país. `sorteio` é injetado para o chamador manter
 * o determinismo dele — os geradores da base são semeados, e trocar isso por um
 * `Math.random` interno faria a mesma peneira devolver nomes diferentes a cada
 * abertura da tela.
 */
export function nomeDeAtleta(pais: string | undefined, sorteio: () => number): string {
  const { pri, ult } = nomesDoPais(pais)
  return `${pri[Math.floor(sorteio() * pri.length)]} ${ult[Math.floor(sorteio() * ult.length)]}`
}
