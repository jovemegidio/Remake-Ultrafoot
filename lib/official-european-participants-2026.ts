/** Participantes publicados pelas ligas para 2026/27. Esta camada existe para
 * impedir que `completarLigaComPool` escolha clubes apenas por prestígio. */
export interface OfficialParticipant {
  name: string
  aliases?: readonly string[]
}

export interface OfficialDivisionSnapshot {
  sourceUrl: string
  status: "official-verified"
  participants: readonly OfficialParticipant[]
}

const p = (name: string, ...aliases: string[]): OfficialParticipant => ({ name, ...(aliases.length ? { aliases } : {}) })
const ENGLAND_TOP = "https://www.premierleague.com/en/news/4673099/the-202627-premier-league-season-officially-starts/"
const ENGLAND_SECOND = "https://www.efl.com/competitions/efl-championship/"
const PORTUGAL_TOP = "https://www.ligaportugal.pt/calendar"
const PORTUGAL_SECOND = "https://www.ligaportugal.pt/news/28236/horarios-das-primeiras-duas-jornadas-da-liga-meu-super"
const NETHERLANDS_TOP = "https://eredivisie.nl/meer/merk/logos-18-clubs/"
const NETHERLANDS_SECOND = "https://keukenkampioendivisie.nl/nieuws/definitief-competitieprogramma-2026-27-vastgesteld"
const TURKEY_TOP = "https://www.tff.org/Default.aspx?hafta=36&pageID=198"
const TURKEY_SECOND = "https://www.tff.org/Default.aspx?hafta=28&lang=en&pageID=142"
const RUSSIA_TOP = "https://www.rfs.ru/cup/news?TournamentMatchesFilter%5BtournamentId%5D=123"
const RUSSIA_SECOND = "https://fnl.pro/melbet"
const SPAIN_TOP = "https://www.laliga.com/en-EG/laliga-easports/clubs"
const SPAIN_SECOND = "https://www.laliga.com/en-GB/laliga-hypermotion/clubs"
const GERMANY_TOP = "https://www.bundesliga.com/de/bundesliga/clubs"
const GERMANY_SECOND = "https://www.bundesliga.com/de/2bundesliga/clubs"
const FRANCE_TOP = "https://ligue1.com/fr/articles/l1_article_5293-les-dates-de-reprise-des-clubs-de-l1-2627"
const FRANCE_SECOND = "https://ligue1.com/fr/articles/l1_article_5343-les-dates-de-reprise-des-clubs-de-ligue-2-bkt-2627"
const ITALY_TOP = "https://en.legaseriea.it/serie-a/news/looking-forward-to-the-2026-27-serie-a-fixture-list"
const ITALY_SECOND = "https://www.legab.it/seriebkt/classifica"
const BELGIUM_TOP = "https://www.proleague.be/nieuws/kalender-2026-2027-club-brugge-opent-tegen-kv-kortrijk-eerste-super-sunday-al-op-speeldag-4"
const BELGIUM_SECOND = "https://www.proleague.be/nieuws/kalender-2026-2027-nieuwkomers-treffen-elkaar-meteen-in-challenger-pro-league"
const SCOTLAND = "https://spfl.co.uk/news/spfl-fixtures-for-202627"

export const OFFICIAL_EUROPEAN_PARTICIPANTS_2026: Readonly<Record<string, OfficialDivisionSnapshot>> = {
  premier_league: { sourceUrl: ENGLAND_TOP, status: "official-verified", participants: [
    p("Arsenal"), p("Aston Villa"), p("AFC Bournemouth", "Bournemouth"), p("Brentford"),
    p("Brighton & Hove Albion", "Brighton"), p("Chelsea"), p("Coventry City"), p("Crystal Palace"),
    p("Everton"), p("Fulham"), p("Hull City"), p("Ipswich Town"), p("Leeds United"), p("Liverpool"),
    p("Manchester City"), p("Manchester United"), p("Newcastle United"), p("Nottingham Forest"),
    p("Sunderland"), p("Tottenham Hotspur", "Tottenham"),
  ]},
  championship: { sourceUrl: ENGLAND_SECOND, status: "official-verified", participants: [
    p("Birmingham City"), p("Blackburn Rovers"), p("Bolton Wanderers"), p("Bristol City"), p("Burnley"),
    p("Cardiff City"), p("Charlton Athletic"), p("Derby County"), p("Lincoln City"), p("Middlesbrough"),
    p("Millwall"), p("Norwich City"), p("Portsmouth"), p("Preston North End"),
    p("Queens Park Rangers", "QPR"), p("Sheffield United"), p("Southampton"), p("Stoke City"),
    p("Swansea City"), p("Watford"), p("West Bromwich Albion", "West Brom"), p("West Ham United", "West Ham"),
    p("Wolverhampton Wanderers", "Wolves"), p("Wrexham"),
  ]},
  primeira_liga: { sourceUrl: PORTUGAL_TOP, status: "official-verified", participants: [
    p("Académico de Viseu", "Académico"), p("FC Alverca"), p("FC Arouca", "Arouca"), p("SL Benfica", "Benfica"),
    p("SC Braga", "Braga"), p("Casa Pia AC", "Casa Pia"), p("Estoril Praia", "Estoril"),
    p("Estrela da Amadora", "Estrela Amadora"), p("FC Famalicão", "Famalicão"), p("Gil Vicente FC", "Gil Vicente"),
    p("CS Marítimo", "Marítimo"), p("Moreirense FC", "Moreirense"), p("CD Nacional", "Nacional"),
    p("FC Porto", "Porto"), p("Rio Ave FC", "Rio Ave"), p("Santa Clara"), p("Sporting CP", "Sporting"),
    p("Vitória SC", "Vitória Guimarães"),
  ]},
  liga_portugal_2: { sourceUrl: PORTUGAL_SECOND, status: "official-verified", participants: [
    p("GD Chaves", "Chaves"), p("Académica de Coimbra", "Académica"), p("FC Penafiel", "Penafiel"), p("Portimonense"),
    p("CD Tondela", "Tondela"), p("Amarante FC", "Amarante"), p("SC Farense", "Farense"),
    p("SCU Torreense", "Torreense"), p("CD Feirense", "Feirense"), p("FC Felgueiras", "Felgueiras"),
    p("FC Vizela", "Vizela"), p("UD Leiria", "União de Leiria"), p("AVS", "AFS"), p("Sporting CP B"),
    p("SL Benfica B", "Benfica B"), p("Leixões SC", "Leixões"), p("Lusitânia de Lourosa", "L. Lourosa FC"), p("FC Porto B"),
  ]},
  eredivisie: { sourceUrl: NETHERLANDS_TOP, status: "official-verified", participants: [
    p("ADO Den Haag"), p("Ajax", "AFC Ajax"), p("AZ Alkmaar", "AZ"), p("Excelsior Rotterdam", "Excelsior"),
    p("FC Groningen"), p("FC Twente"), p("FC Utrecht"), p("Feyenoord"), p("Fortuna Sittard"),
    p("Go Ahead Eagles"), p("NEC Nijmegen", "N.E.C. Nijmegen"), p("PEC Zwolle"), p("PSV Eindhoven", "PSV"),
    p("SC Cambuur"), p("SC Heerenveen", "sc Heerenveen"), p("Sparta Rotterdam"), p("Telstar"), p("Willem II"),
  ]},
  eerste_divisie: { sourceUrl: NETHERLANDS_SECOND, status: "official-verified", participants: [
    p("Almere City FC"), p("De Graafschap"), p("FC Den Bosch"), p("FC Dordrecht"), p("FC Eindhoven"), p("FC Emmen"),
    p("FC Volendam"), p("Helmond Sport"), p("Heracles Almelo"), p("Jong Ajax"), p("Jong AZ"), p("Jong PSV"),
    p("Jong FC Utrecht", "Jong Utrecht"), p("MVV Maastricht", "MVV"), p("NAC Breda"), p("RKC Waalwijk"),
    p("Roda JC"), p("TOP Oss"), p("Vitesse"), p("VVV-Venlo"),
  ]},
  super_lig: { sourceUrl: TURKEY_TOP, status: "official-verified", participants: [
    p("Galatasaray"), p("Çorum FK", "Corum FK"), p("Konyaspor"), p("Çaykur Rizespor", "Rizespor"),
    p("Gaziantep FK"), p("Alanyaspor"), p("Gençlerbirliği", "Genclerbirligi"), p("Fenerbahçe", "Fenerbahce"),
    p("Kasımpaşa", "Kasimpasa"), p("Trabzonspor"), p("Beşiktaş", "Besiktas"), p("Eyüpspor", "Eyupspor"),
    p("Amed SK", "Amed Sportif Faaliyetler"), p("Erzurumspor FK"), p("İstanbul Başakşehir", "Basaksehir"),
    p("Kocaelispor"), p("Samsunspor"), p("Göztepe", "Goztepe"),
  ]},
  tff_1_lig: { sourceUrl: TURKEY_SECOND, status: "official-verified", participants: [
    p("Bodrum FK"), p("Bursaspor"), p("Iğdır FK", "Igdir FK"), p("Fatih Karagümrük", "Fatih Karagumruk"),
    p("Bandırmaspor", "Bandirmaspor"), p("İstanbulspor", "Istanbulspor"), p("Boluspor"), p("Manisa FK"),
    p("Antalyaspor"), p("Ankara Keçiörengücü", "Keciorengucu"), p("Pendikspor"), p("Batman Petrolspor"),
    p("Vanspor"), p("Kayserispor"), p("Sarıyer", "Sariyer"), p("Muğlaspor", "Muglaspor"), p("Sivasspor"),
    p("Esenler Erokspor", "Erokspor"), p("Ümraniyespor", "Umraniyespor"), p("Mardin 1969 Spor"),
  ]},
  russian_prem: { sourceUrl: RUSSIA_TOP, status: "official-verified", participants: [
    p("Zenit Saint Petersburg", "Zenit"), p("Krasnodar"), p("Lokomotiv Moscow"), p("Spartak Moscow"),
    p("CSKA Moscow"), p("Baltika Kaliningrad", "Baltika"), p("Dynamo Moscow"), p("Rubin Kazan"),
    p("Akhmat Grozny"), p("Rostov"), p("Krylya Sovetov"), p("Orenburg"), p("Akron Tolyatti", "Akron"),
    p("Dynamo Makhachkala"), p("Rodina Moscow", "Rodina"), p("Fakel Voronezh", "Fakel"),
  ]},
  russian_first: { sourceUrl: RUSSIA_SECOND, status: "official-verified", participants: [
    p("Arsenal Tula"), p("Veles Moscow", "Veles"), p("Volga Ulyanovsk", "Volga"), p("Yenisey Krasnoyarsk", "Yenisey"),
    p("KAMAZ Naberezhnye Chelny", "KAMAZ"), p("Leningradets"), p("Neftekhimik Nizhnekamsk", "Neftekhimik"),
    p("Pari Nizhny Novgorod", "Nizhny Novgorod"), p("Rotor Volgograd", "Rotor"), p("SKA-Khabarovsk"), p("Sochi"),
    p("Spartak Kostroma"), p("Tekstilshchik Ivanovo", "Tekstilshchik"), p("Torpedo Moscow"),
    p("Ural Yekaterinburg", "Urals Yekaterinburg"), p("Ufa"), p("Chelyabinsk"), p("Shinnik Yaroslavl", "Shinnik"),
  ]},
  la_liga: { sourceUrl: SPAIN_TOP, status: "official-verified", participants: [
    p("Athletic Club", "Athletic Bilbao"), p("Atlético de Madrid", "Atletico Madrid"), p("CA Osasuna", "Osasuna"),
    p("Celta", "Celta Vigo"), p("Deportivo Alavés", "Alaves"), p("Elche CF", "Elche"), p("FC Barcelona"),
    p("Getafe CF"), p("Levante UD", "Levante"), p("Málaga CF", "Malaga"), p("Racing Santander"),
    p("Rayo Vallecano"), p("RC Deportivo", "Deportivo La Coruña"), p("RCD Espanyol", "Espanyol"),
    p("Real Betis"), p("Real Madrid"), p("Real Sociedad"), p("Sevilla FC", "Sevilla"), p("Valencia CF"), p("Villarreal CF"),
  ]},
  la_liga_2: { sourceUrl: SPAIN_SECOND, status: "official-verified", participants: [
    p("AD Ceuta FC"), p("Albacete BP", "Albacete Balompié"), p("Burgos CF"), p("Cádiz CF"), p("CD Castellón"), p("CD Eldense"),
    p("CD Leganés", "Leganés"), p("CD Tenerife"), p("CE Sabadell"), p("Celta Fortuna", "RC Celta Fortuna"), p("Córdoba CF"),
    p("FC Andorra"), p("Girona FC", "Girona"), p("Granada CF"), p("Real Sociedad B"), p("RCD Mallorca", "Mallorca"),
    p("Real Oviedo"), p("Real Sporting", "Real Sporting de Gijon"), p("Real Valladolid"), p("SD Eibar"), p("UD Almería"), p("UD Las Palmas"),
  ]},
  bundesliga: { sourceUrl: GERMANY_TOP, status: "official-verified", participants: [
    p("FC Augsburg"), p("1. FC Union Berlin", "Union Berlin"), p("Werder Bremen"), p("Borussia Dortmund"), p("SV Elversberg"),
    p("Eintracht Frankfurt"), p("SC Freiburg"), p("Hamburger SV", "Hamburgo"), p("TSG Hoffenheim"), p("1. FC Köln", "Koln"),
    p("RB Leipzig"), p("Bayer Leverkusen"), p("Mainz 05"), p("Borussia Mönchengladbach"), p("Bayern Munich"),
    p("SC Paderborn 07"), p("Schalke 04"), p("VfB Stuttgart", "Stuttgart"),
  ]},
  bundesliga_2: { sourceUrl: GERMANY_SECOND, status: "official-verified", participants: [
    p("Arminia Bielefeld"), p("VfL Bochum"), p("Eintracht Braunschweig"), p("Energie Cottbus"), p("SV Darmstadt 98"),
    p("Dynamo Dresden"), p("SpVgg Greuther Fürth", "SpVgg Greuther Furth"), p("Hannover 96"), p("1. FC Heidenheim"),
    p("Hertha BSC"), p("1. FC Kaiserslautern"), p("Karlsruher SC"), p("Holstein Kiel"), p("1. FC Magdeburg"),
    p("1. FC Nürnberg"), p("VfL Osnabrück"), p("FC St. Pauli"), p("VfL Wolfsburg"),
  ]},
  ligue_1: { sourceUrl: FRANCE_TOP, status: "official-verified", participants: [
    p("Angers SCO", "Angers"), p("AJ Auxerre", "Auxerre"), p("Stade Brestois 29", "Brest"), p("Le Havre AC"), p("Le Mans FC"),
    p("RC Lens"), p("FC Lorient", "Lorient"), p("LOSC Lille"), p("Olympique Lyonnais", "Lyon"), p("Olympique de Marseille", "Marseille"),
    p("AS Monaco"), p("OGC Nice"), p("Paris FC"), p("Paris Saint-Germain"), p("Stade Rennais", "Rennes"),
    p("RC Strasbourg Alsace", "Strasbourg"), p("Toulouse FC", "FC Toulouse"), p("ESTAC Troyes"),
  ]},
  ligue_2: { sourceUrl: FRANCE_SECOND, status: "official-verified", participants: [
    p("FC Annecy"), p("US Boulogne CO", "US Boulogne"), p("Clermont Foot 63"), p("Dijon FCO"), p("USL Dunkerque"),
    p("Grenoble Foot 38"), p("EA Guingamp"), p("Stade Lavallois"), p("FC Metz"), p("Montpellier Hérault SC", "Montpellier"),
    p("AS Nancy Lorraine", "AS Nancy-Lorraine"), p("FC Nantes"), p("Pau FC"), p("Stade de Reims"), p("Rodez AF"),
    p("AS Saint-Étienne", "Saint-Etienne"), p("FC Sochaux-Montbéliard"), p("Red Star FC"),
  ]},
  serie_a_ita: { sourceUrl: ITALY_TOP, status: "official-verified", participants: [
    p("Atalanta"), p("Bologna"), p("Cagliari"), p("Como"), p("Fiorentina"), p("Frosinone"), p("Genoa", "Genoa CFC"),
    p("Inter"), p("Juventus"), p("Lazio"), p("Lecce"), p("AC Milan"), p("Monza"), p("Napoli"), p("Parma"), p("Roma"),
    p("Sassuolo"), p("Torino"), p("Udinese"), p("Venezia"),
  ]},
  serie_b_ita: { sourceUrl: ITALY_SECOND, status: "official-verified", participants: [
    p("Arezzo"), p("Ascoli"), p("Avellino"), p("Benevento"), p("Carrarese"), p("Catanzaro"), p("Cesena"), p("Cremonese"),
    p("Empoli"), p("Hellas Verona"), p("Juve Stabia"), p("LR Vicenza"), p("Mantova"), p("Modena"), p("Padova"), p("Palermo"),
    p("Pisa"), p("Sampdoria"), p("Südtirol", "FC Sudtirol"), p("Virtus Entella"),
  ]},
  pro_league_bel: { sourceUrl: BELGIUM_TOP, status: "official-verified", participants: [
    p("Club Brugge"), p("KV Kortrijk", "Kortrijk"), p("Lommel SK"), p("Sint-Truiden", "STVV"), p("SK Beveren"),
    p("Royal Antwerp"), p("Union Saint-Gilloise"), p("Westerlo"), p("Standard Liege"), p("Cercle Brugge"), p("Zulte Waregem"),
    p("Genk"), p("Anderlecht"), p("RAAL La Louvière", "La Louvière"), p("Charleroi"), p("OHL Leuven"), p("KAA Gent"), p("Mechelen"),
  ]},
  challenger_pro: { sourceUrl: BELGIUM_SECOND, status: "official-verified", participants: [
    p("Sporting Hasselt"), p("FCV Dender EH", "Dender"), p("KSC Lokeren", "Lokeren"), p("RFC Seraing", "Seraing"), p("Patro Eisden"),
    p("RSCA Futures"), p("Jong Genk"), p("KAS Eupen", "Eupen"), p("K. Lierse SK", "Lierse"), p("Royal Excelsior Virton"),
    p("K. Beerschot VA", "Beerschot"), p("Jong Gent"), p("RFC Liège", "Royal Liège"), p("Royal Francs Borains"), p("Club NXT"),
  ]},
  scottish_prem: { sourceUrl: SCOTLAND, status: "official-verified", participants: [
    p("Dundee United"), p("Rangers"), p("Falkirk"), p("St Mirren"), p("Aberdeen"), p("Heart of Midlothian", "Hearts"),
    p("St Johnstone"), p("Kilmarnock"), p("Hibernian"), p("Motherwell"), p("Celtic"), p("Dundee"),
  ]},
  scottish_champ: { sourceUrl: SCOTLAND, status: "official-verified", participants: [
    p("Ayr United"), p("Arbroath"), p("Greenock Morton"), p("Partick Thistle"), p("Inverness Caledonian Thistle"),
    p("Dunfermline Athletic"), p("Livingston"), p("Queen's Park", "Queen’s Park"), p("Raith Rovers"), p("Stenhousemuir"),
  ]},
}
