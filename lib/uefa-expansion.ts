/**
 * Expansão UEFA da 1.0.279.
 *
 * Este catálogo separa três coisas que antes eram confundidas:
 *  - a associação existe;
 *  - a divisão é jogável;
 *  - a fotografia de participantes foi verificada para a temporada.
 *
 * Os participantes abaixo são clubes reais e explícitos. O campo
 * `participantStatus` permanece `provisional-snapshot` até cada federação ser
 * cruzada com a lista oficial da edição 2026/27. Assim o jogo ganha cobertura
 * sem chamar seleção por prestígio de "regulamento correto".
 */

export type UefaExpansionCode =
  | "alb" | "and" | "arm" | "aut" | "blr" | "bih" | "bgr" | "hrv"
  | "svk" | "svn" | "est" | "fin" | "geo" | "gib" | "hun" | "fro"
  | "irl" | "nir" | "isl" | "isr" | "kvx" | "lva" | "lie" | "ltu"
  | "lux" | "mkd" | "mlt" | "mda" | "mne" | "wal" | "pol" | "rou"
  | "smr" | "srb" | "swe" | "sui" | "ukr"

export type UefaExpansionDivision = `uefa_${UefaExpansionCode}_${1 | 2}`

export interface UefaTierDefinition {
  id: UefaExpansionDivision
  name: string
  teams: number
  rounds: number
  format: "points" | "league_playoff" | "group_knockout"
  promotion: number
  relegation: number
  participants: readonly string[]
  participantStatus: "provisional-snapshot" | "official-verified"
  sourceUrl?: string
  formatDetails?: string
}

export interface UefaFederationDefinition {
  code: UefaExpansionCode
  country: string
  aliases: readonly string[]
  associationSource: string
  top: UefaTierDefinition | null
  second: UefaTierDefinition | null
  crossBorderSystem?: string
}

const source = (code: string) => `https://www.uefa.com/nationalassociations/${code}/`
const tier = (
  code: UefaExpansionCode,
  level: 1 | 2,
  name: string,
  teams: number,
  participants: readonly string[],
  swaps = 2,
  format: UefaTierDefinition["format"] = "points",
  options: Partial<Pick<UefaTierDefinition, "rounds" | "participantStatus" | "sourceUrl" | "formatDetails">> = {},
): UefaTierDefinition => ({
  id: `uefa_${code}_${level}`,
  name,
  teams,
  rounds: teams > 1 ? (teams - 1) * 2 : 0,
  format,
  promotion: level === 2 ? swaps : 0,
  relegation: level === 1 ? swaps : 0,
  participants,
  participantStatus: options.participantStatus ?? "provisional-snapshot",
  sourceUrl: options.sourceUrl,
  formatDetails: options.formatDetails,
  ...options,
})

// Fotografias explícitas de elite. Elas substituem a escolha silenciosa por
// prestígio e dão ao auditor uma lista concreta para aprovar ou rejeitar.
const TOP: Record<UefaExpansionCode, readonly string[]> = {
  alb: ["Egnatia", "Vllaznia Shkodër", "Partizani Tirana", "Dinamo City", "KF Tirana", "Teuta Durrës", "Elbasani", "Bylis", "Flamurtari", "Vora"],
  and: ["Inter d'Escaldes", "FC Santa Coloma", "UE Santa Coloma", "Ranger's", "Ordino", "Pas de la Casa", "Penya Encarnada", "Esperança d'Andorra", "Atlètic Escaldes", "Carroi"],
  arm: ["Noah", "Pyunik", "Ararat-Armenia", "Urartu", "Alashkert", "Shirak", "Ararat Yerevan", "Van", "BKMA Yerevan", "Gandzasar"],
  aut: ["Sturm Graz", "RB Salzburg", "Rapid Wien", "Austria Wien", "LASK", "Wolfsberger AC", "Hartberg", "Austria Lustenau", "Rheindorf Altach", "WSG Tirol", "Grazer AK", "Ried"],
  blr: ["Dinamo Minsk", "Neman Grodno", "Torpedo-BelAZ", "Dinamo Brest", "Slavia Mozyr", "Gomel", "Vitebsk", "Isloch", "BATE Borisov", "Minsk", "Naftan", "Smorgon", "Arsenal Dzerzhinsk", "Dnepr Mogilev", "Molodechno", "Maxline Vitebsk"],
  bih: ["Borac Banja Luka", "Zrinjski Mostar", "Sarajevo", "Željezničar", "Velež Mostar", "Široki Brijeg", "Posušje", "Sloga Doboj", "Radnik Bijeljina", "Rudar Prijedor"],
  bgr: ["Ludogorets", "Levski Sofia", "CSKA Sofia", "Cherno More", "Arda Kardzhali", "Botev Plovdiv", "Lokomotiv Plovdiv", "Slavia Sofia", "CSKA 1948", "Beroe", "Spartak Varna", "Septemvri Sofia", "Botev Vratsa", "Lokomotiv Sofia", "Montana", "Dobrudzha"],
  hrv: ["Dinamo Zagreb", "Hajduk Split", "Rijeka", "Osijek", "Varaždin", "Istra 1961", "Lokomotiva Zagreb", "Slaven Belupo", "Gorica", "Vukovar 1991"],
  svk: ["Slovan Bratislava", "Žilina", "Spartak Trnava", "DAC Dunajská Streda", "Ružomberok", "Podbrezová", "Košice", "Trenčín", "Skalica", "Komárno", "Tatran Prešov", "Zemplín Michalovce"],
  svn: ["Olimpija Ljubljana", "Maribor", "Celje", "Koper", "Bravo", "Mura", "Domžale", "Radomlje", "Primorje", "Aluminij"],
  est: ["Flora Tallinn", "Levadia Tallinn", "Nõmme Kalju", "Paide Linnameeskond", "Narva Trans", "Tammeka Tartu", "Kuressaare", "Pärnu Vaprus", "Harju Laagri", "Nõmme United"],
  fin: ["KuPS", "HJK Helsinki", "Ilves", "Inter Turku", "SJK", "VPS", "Haka", "Gnistan", "Mariehamn", "AC Oulu", "Jaro", "KTP"],
  geo: ["Dinamo Tbilisi", "Dinamo Batumi", "Torpedo Kutaisi", "Dila Gori", "Iberia 1999", "Samgurali", "Gagra", "Telavi", "Gareji Sagarejo", "Kolkheti Poti"],
  gib: ["Lincoln Red Imps", "St Joseph's", "Europa", "Magpies", "Manchester 62", "Lions Gibraltar", "Mons Calpe", "Glacis United", "College 1975", "Europa Point", "Lynx"],
  hun: ["Ferencváros", "Puskás Akadémia", "Paks", "MTK Budapest", "Újpest", "Debrecen", "Diósgyőr", "Fehérvár", "Zalaegerszeg", "Kecskemét", "Kisvárda", "Nyíregyháza"],
  fro: ["KÍ Klaksvík", "HB Tórshavn", "Víkingur Gøta", "NSÍ Runavík", "B36 Tórshavn", "EB/Streymur", "07 Vestur", "B68 Toftir", "TB Tvøroyri", "FC Suðuroy"],
  irl: ["Shamrock Rovers", "Shelbourne", "Bohemians", "St Patrick's Athletic", "Derry City", "Drogheda United", "Waterford", "Galway United", "Sligo Rovers", "Cork City"],
  nir: ["Linfield", "Larne", "Glentoran", "Cliftonville", "Crusaders", "Coleraine", "Ballymena United", "Dungannon Swifts", "Glenavon", "Carrick Rangers", "Portadown", "Bangor"],
  isl: ["Víkingur Reykjavík", "Breiðablik", "Valur", "Stjarnan", "KR Reykjavík", "FH", "Fram", "KA", "ÍA Akranes", "Vestri", "Afturelding", "Leiknir Reykjavík"],
  isr: ["Maccabi Tel Aviv", "Maccabi Haifa", "Hapoel Be'er Sheva", "Beitar Jerusalem", "Hapoel Tel Aviv", "Maccabi Netanya", "Hapoel Haifa", "Bnei Sakhnin", "Ashdod", "Hapoel Jerusalem", "Maccabi Petah Tikva", "Ironi Kiryat Shmona", "Ironi Tiberias", "Maccabi Bnei Raina"],
  kvx: ["Drita", "Ballkani", "Prishtina", "Gjilani", "Llapi", "Malisheva", "Dukagjini", "Ferizaj", "Feronikeli", "Prishtina e Re"],
  lva: ["RFS", "Riga FC", "Valmiera", "Auda", "Liepāja", "Daugavpils", "Jelgava", "Tukums 2000", "Grobiņa", "Super Nova"],
  lie: ["Vaduz", "Balzers", "Eschen/Mauren", "Ruggell", "Schaan", "Triesen", "Triesenberg"],
  ltu: ["Žalgiris", "Kauno Žalgiris", "Hegelmann", "Panevėžys", "Sūduva", "Banga", "Džiugas", "Šiauliai", "Riteriai", "TransINVEST"],
  lux: ["Differdange 03", "F91 Dudelange", "Swift Hesperange", "Racing Luxembourg", "Progrès Niederkorn", "Jeunesse Esch", "UNA Strassen", "Union Titus Pétange", "Victoria Rosport", "Mondorf", "Wiltz 71", "Hostert", "Rodange 91", "Fola Esch", "Rumelange", "Mamer 32"],
  mkd: ["Shkëndija", "Struga", "Vardar", "Shkupi", "Sileks", "Rabotnički", "Tikveš", "Pelister", "AP Brera", "Besa Dobërdoll", "Bashkimi", "Arsimi"],
  mlt: ["Ħamrun Spartans", "Floriana", "Birkirkara", "Sliema Wanderers", "Hibernians", "Mosta", "Marsaxlokk", "Gżira United", "Naxxar Lions", "Żabbar St Patrick", "Valletta", "Tarxien Rainbows"],
  mda: ["Sheriff Tiraspol", "Petrocub", "Zimbru Chișinău", "Milsami Orhei", "Dacia Buiucani", "Bălți", "Spartanii Sportul", "Florești"],
  mne: ["Budućnost", "Sutjeska", "Dečić", "Mornar", "Petrovac", "Arsenal Tivat", "Jedinstvo", "Jezero", "Bokelj", "Otrant-Olympic"],
  wal: ["The New Saints", "Penybont", "Haverfordwest County", "Caernarfon Town", "Cardiff Metropolitan", "Bala Town", "Barry Town United", "Newtown", "Connah's Quay", "Flint Town United", "Briton Ferry", "Aberystwyth Town"],
  pol: ["Lech Poznań", "Legia Warszawa", "Raków Częstochowa", "Jagiellonia Białystok", "Pogoń Szczecin", "Cracovia", "Górnik Zabrze", "Zagłębie Lubin", "Piast Gliwice", "Widzew Łódź", "Motor Lublin", "Korona Kielce", "Radomiak Radom", "GKS Katowice", "Wisła Płock", "Wisła Kraków", "Śląsk Wrocław", "Wieczysta Kraków"],
  rou: ["Universitatea Craiova", "Universitatea Cluj", "CFR Cluj", "Dinamo București", "Rapid București", "Argeș Pitești", "UTA Arad", "FCSB", "Botoșani", "Oțelul Galați", "Csikszereda", "Petrolul Ploiești", "Farul Constanța", "Corvinul Hunedoara", "Sepsi", "FC Voluntari"],
  smr: ["Virtus", "La Fiorita", "Tre Penne", "Tre Fiori", "Folgore", "Libertas", "Cosmos", "Murata", "Juvenes/Dogana", "Faetano", "Domagnano", "Fiorentino", "Pennarossa", "San Giovanni", "Cailungo"],
  srb: ["Red Star Belgrade", "Partizan", "Vojvodina", "TSC Bačka Topola", "Čukarički", "Radnički Niš", "Novi Pazar", "Mladost Lučani", "Železničar Pančevo", "Spartak Subotica", "IMT", "Napredak", "Radnički Kragujevac", "OFK Beograd", "Javor Ivanjica", "Dubocica"],
  swe: ["Malmö FF", "Djurgårdens IF", "AIK", "Hammarby", "BK Häcken", "IFK Göteborg", "IFK Norrköping", "Elfsborg", "Mjällby", "Sirius", "Brommapojkarna", "Halmstad", "GAIS", "Degerfors", "Öster", "Värnamo"],
  sui: ["Basel", "Young Boys", "Servette", "Lugano", "Zürich", "St. Gallen", "Lausanne-Sport", "Luzern", "Grasshoppers", "Sion", "Vaduz", "Thun"],
  ukr: ["Dynamo Kyiv", "Shakhtar Donetsk", "Oleksandriya", "Polissya Zhytomyr", "Kryvbas", "Karpaty Lviv", "Rukh Lviv", "Zorya Luhansk", "Vorskla Poltava", "Chornomorets Odesa", "Kolos Kovalivka", "Obolon Kyiv", "Veres Rivne", "LNZ Cherkasy", "Epitsentr", "Metalist 1925"],
}

/** Participantes 2026/27 publicados pelas ligas/federações. */
const SECOND: Partial<Record<UefaExpansionCode, readonly string[]>> = {
  aut: [
    "SV Austria Salzburg", "KSV 1919", "FC Wacker Innsbruck", "ASK Voitsberg",
    "Schwarz-Weiss Bregenz", "FC Liefering", "Young Violets Austria Wien",
    "SKU Amstetten", "FC Hertha Wels", "SKN St. Pölten", "Admira Wacker",
    "First Vienna FC 1894", "SK Rapid II", "FAC Wien", "SK Sturm Graz II",
    "FC Blau-Weiß Linz",
  ],
  pol: [
    "Arka Gdynia", "Bruk-Bet Termalica Nieciecza", "Chrobry Głogów", "Lechia Gdańsk",
    "ŁKS Łódź", "Miedź Legnica", "Odra Opole", "Podbeskidzie Bielsko-Biała",
    "Pogoń Grodzisk Mazowiecki", "Pogoń Siedlce", "Polonia Bytom", "Polonia Warszawa",
    "Puszcza Niepołomice", "Ruch Chorzów", "Stal Mielec", "Stal Rzeszów",
    "Unia Skierniewice", "Warta Poznań",
  ],
  rou: [
    "CSM Cetatea 1932 Suceava", "CSL Ștefăneștii de Jos", "SCM Râmnicu Vâlcea",
    "Politehnica Timișoara", "SC Popești-Leordeni", "FC Bihor Oradea",
    "Steaua București", "Chindia Târgoviște", "ASA Târgu Mureș", "Metalul Buzău",
    "CSM Slatina", "Gloria Bistrița", "FC Bacău", "Concordia Chiajna", "CSM Reșița",
    "CS Afumați", "CSC Dumbrăvița", "CSC 1599 Șelimbăr", "CS Dinamo București",
    "Hermannstadt", "Unirea Slobozia", "Metaloglobus București",
  ],
  sui: [
    "Neuchâtel Xamax", "SC Kriens", "FC Rapperswil-Jona", "FC Wil 1900",
    "Stade Lausanne Ouchy", "Stade Nyonnais", "Étoile Carouge", "FC Aarau",
    "Winterthur", "Yverdon Sport",
  ],
}

const SECOND_RULES: Partial<Record<UefaExpansionCode, {
  promotion: number
  rounds: number
  format: UefaTierDefinition["format"]
  sourceUrl: string
  formatDetails: string
}>> = {
  aut: {
    promotion: 1,
    rounds: 30,
    format: "points",
    sourceUrl: "https://cdn.bundesliga.at/downloads/2026-07-06/ADMIRAL-2Liga_Spielplan_2026-27.pdf",
    formatDetails: "Dezesseis clubes em turno e returno, totalizando 30 jogos. Equipes reservas não podem subir.",
  },
  pol: {
    promotion: 3,
    rounds: 34,
    format: "league_playoff",
    sourceUrl: "https://www.1liga.org/",
    formatDetails: "Dezoito clubes em 34 rodadas; os dois primeiros sobem diretamente e do 3º ao 6º disputam a terceira vaga.",
  },
  rou: {
    // Duas vagas são acessos diretos. 3º e 4º apenas disputam barragens contra
    // clubes da elite, portanto não podem virar quatro trocas automáticas no
    // fechamento da temporada.
    promotion: 2,
    rounds: 21,
    format: "league_playoff",
    sourceUrl: "https://www.frf.ro/competitii/competitii-masculin/liga-2-casa-pariurilor/miercuri-22-iulie-tragerea-la-sorti-pentru-stabilirea-programului-sezonului-2026-2027-din-liga-2-casa-pariurilor/",
    formatDetails: "Vinte e dois clubes jogam 21 rodadas; seis seguem ao playoff de dez jogos. Dois sobem diretamente e 3º/4º disputam barragens.",
  },
  sui: {
    promotion: 1,
    rounds: 36,
    format: "points",
    sourceUrl: "https://sfl.ch/de/articles/sfl-veroffentlichtspielplane-der-saison-202627",
    formatDetails: "Dez clubes disputam quatro turnos, totalizando 36 partidas por equipe.",
  },
}

type Meta = [UefaExpansionCode, string, readonly string[], string, number, string | null, number]
const META: readonly Meta[] = [
  ["alb","Albania",["ALB","Albânia"],"Kategoria Superiore",10,"Kategoria e Parë",12],
  ["and","Andorra",["AND"],"Primera Divisió",10,"Segona Divisió",12],
  ["arm","Armenia",["ARM","Armênia"],"Armenian Premier League",10,"Armenian First League",13],
  ["aut","Austria",["Áustria"],"Austrian Bundesliga",12,"2. Liga",16],
  ["blr","Belarus",["BIE","BLR","Bielorrússia"],"Belarusian Premier League",16,"Belarusian First League",18],
  ["bih","Bosnia e Herzegovina",["BOS","Bósnia e Herzegovina"],"Premijer Liga",10,"First League",16],
  ["bgr","Bulgaria",["BUL","Bulgária"],"First Professional League",16,"Second Professional League",18],
  ["hrv","Croacia",["Croácia","CRO"],"HNL",10,"First Football League",12],
  ["svk","Eslovaquia",["SLK","Eslováquia"],"Slovak Super Liga",12,"2. Liga",14],
  ["svn","Eslovenia",["ESL","Eslovênia"],"Slovenian PrvaLiga",10,"Slovenian Second League",16],
  ["est","Estonia",["EST","Estônia"],"Meistriliiga",10,"Esiliiga",10],
  ["fin","Finlandia",["FIN","Finlândia"],"Veikkausliiga",12,"Ykkösliiga",10],
  ["geo","Georgia",["GEO","Geórgia"],"Erovnuli Liga",10,"Erovnuli Liga 2",10],
  ["gib","Gibraltar",["GIB"],"Gibraltar Football League",11,null,0],
  ["hun","Hungria",["HUN","Hungria"],"Nemzeti Bajnokság I",12,"Nemzeti Bajnokság II",16],
  ["fro","Ilhas Faroe",["Ilhas Faroé","FRO"],"Betri deildin",10,"1. deild",10],
  ["irl","Irlanda",["IRL"],"League of Ireland Premier Division",10,"League of Ireland First Division",10],
  ["nir","Irlanda do Norte",["NIR"],"NIFL Premiership",12,"NIFL Championship",12],
  ["isl","Islandia",["ISL","Islândia"],"Besta deild karla",12,"1. deild karla",12],
  ["isr","Israel",["ISR"],"Israeli Premier League",14,"Liga Leumit",16],
  ["kvx","Kosovo",["KOS"],"Football Superleague of Kosovo",10,"First Football League of Kosovo",10],
  ["lva","Letonia",["LET","Letônia"],"Virslīga",10,"Latvian First League",14],
  ["lie","Liechtenstein",["LIE"],"",0,null,0],
  ["ltu","Lituania",["LIT","Lituânia"],"A Lyga",10,"I Lyga",16],
  ["lux","Luxemburgo",["LUX"],"Luxembourg National Division",16,"Division of Honour",16],
  ["mkd","Macedonia do Norte",["MKD","Macedônia do Norte"],"Macedonian First League",12,"Macedonian Second League",16],
  ["mlt","Malta",["MTA"],"Maltese Premier League",12,"Maltese Challenge League",16],
  ["mda","Moldavia",["MOL","Moldávia"],"Moldovan Super Liga",8,"Liga 1",12],
  ["mne","Montenegro",["MON"],"Montenegrin First League",10,"Montenegrin Second League",10],
  ["wal","Pais de Gales",["WAL","País de Gales"],"Cymru Premier",12,"Cymru North/South",32],
  ["pol","Polonia",["POL","Polônia"],"Ekstraklasa",18,"I liga",18],
  ["rou","Romenia",["ROM","Romênia"],"Liga I",16,"Liga II",22],
  ["smr","San Marino",["SMR"],"Campionato Sammarinese",15,null,0],
  ["srb","Servia",["Sérvia","SER"],"Serbian SuperLiga",16,"Serbian First League",16],
  ["swe","Suecia",["Suécia","SUE"],"Allsvenskan",16,"Superettan",16],
  ["sui","Suica",["Suíça","SUI"],"Swiss Super League",12,"Swiss Challenge League",10],
  ["ukr","Ucrania",["Ucrânia","UCR"],"Ukrainian Premier League",16,"Ukrainian First League",16],
]

export const UEFA_EXPANSION_FEDERATIONS: readonly UefaFederationDefinition[] = META.map(([code, country, aliases, topName, topTeams, secondName, secondTeams]) => {
  const topParticipants = TOP[code].slice(0, topTeams)
  // A segunda divisão só recebe participantes quando o snapshot explícito os
  // trouxer. Não voltamos ao pool silencioso que esta expansão substitui.
  const secondParticipants = (SECOND[code] ?? []).slice(0, secondTeams)
  const secondRules = SECOND_RULES[code]
  if (code === "lie") return {
    code, country, aliases, associationSource: source(code), top: null, second: null,
    crossBorderSystem: "Clubes disputam a pirâmide suíça; a federação organiza a Liechtenstein Cup.",
  }
  return {
    code, country, aliases, associationSource: source(code),
    // O mesmo número alimenta os dois lados da pirâmide viva. Antes a elite
    // sempre declarava dois rebaixados, mesmo quando a regra verificada da
    // segunda divisão dizia um (Áustria/Suíça) ou três (Polônia).
    top: tier(code, 1, topName, topTeams, topParticipants, secondRules?.promotion ?? 2, topTeams <= 12 ? "league_playoff" : "points"),
    second: secondName ? tier(
      code, 2, secondName, secondTeams, secondParticipants,
      secondRules?.promotion ?? 2,
      secondRules?.format ?? "points",
      secondRules ? {
        rounds: secondRules.rounds,
        participantStatus: "official-verified",
        sourceUrl: secondRules.sourceUrl,
        formatDetails: secondRules.formatDetails,
      } : {},
    ) : null,
  }
})

export interface UefaExpansionClub {
  nome: string
  curto: string
  cidade: string
  pais: string
  divisao: UefaExpansionDivision
  file_key: string
  dataQuality: "federation-snapshot" | "provisional"
}

function slug(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
    .replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "")
}

export const UEFA_EXPANSION_CLUBS: readonly UefaExpansionClub[] = UEFA_EXPANSION_FEDERATIONS.flatMap(federation => {
  const divisions = [federation.top, federation.second].filter((entry): entry is UefaTierDefinition => Boolean(entry))
  return divisions.flatMap(division => division.participants.map((nome, index) => ({
    nome,
    curto: `${federation.code.toUpperCase()}${division.id.endsWith("_1") ? "A" : "B"}${String(index + 1).padStart(2, "0")}`,
    cidade: nome,
    pais: federation.code === "sui" && nome === "Vaduz" ? "Liechtenstein" : federation.country,
    divisao: division.id,
    file_key: `${slug(nome)}_${federation.code}`,
    dataQuality: "provisional" as const,
  })))
})

export const UEFA_EXPANSION_COMPETITIONS = Object.fromEntries(
  UEFA_EXPANSION_FEDERATIONS.flatMap(federation => [federation.top, federation.second]
    .filter((entry): entry is UefaTierDefinition => Boolean(entry?.participants.length))
    .map(division => [division.id, [{
      id: division.id,
      name: division.name,
      shortName: division.name,
      type: "league" as const,
      region: slug(federation.country),
      format: division.format,
      teams: division.participants.length,
      rounds: division.rounds,
      // TURNOS. A Challenge League suica joga QUATRO turnos entre dez clubes
      // (36 jogos), e o gate de regulamentos so aceita `rounds` igual a
      // (teams-1) x turnos — assumindo 2 quando o campo falta. Sem declarar
      // isto, a Suica reprovava a publicacao inteira. Derivado, e nao escrito a
      // mao, para nao criar uma segunda verdade sobre o mesmo numero.
      roundRobinCycles: Math.max(
        1,
        Math.round(division.rounds / Math.max(1, division.participants.length - 1)),
      ),
      prize: division.id.endsWith("_1") ? 3_000_000 : 900_000,
      prestige: division.id.endsWith("_1") ? 50 : 32,
      promotion: division.id.endsWith("_2") ? division.promotion : 0,
      relegation: division.id.endsWith("_1") && federation.second?.participants.length ? division.relegation : 0,
      continentalSpots: division.id.endsWith("_1")
        ? [{ competition: "champions_league", spots: 1 }, { competition: "europa_league", spots: 1 }, { competition: "conference_league", spots: 2 }]
        : [],
      formatDetails: division.formatDetails ?? `${division.participants.length} clubes em turno e returno. Snapshot de participantes pendente de certificação oficial 2026/27.`,
      sourceUrl: division.sourceUrl ?? federation.associationSource,
      participantStatus: division.participantStatus,
    }]]),
  ),
) as Record<string, Array<{
  id: string; name: string; shortName: string; type: "league"; region: string
  format: UefaTierDefinition["format"]; teams: number; rounds: number; roundRobinCycles: number
  prize: number; prestige: number; promotion: number; relegation: number
  continentalSpots: { competition: string; spots: number }[]
  formatDetails: string; sourceUrl: string; participantStatus: UefaTierDefinition["participantStatus"]
}>>
