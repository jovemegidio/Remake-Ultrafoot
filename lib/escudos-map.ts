// Mapeamento centralizado de escudos
// Este arquivo nao deve importar de teams-data.ts ou international-teams.ts para evitar dependencias circulares

const ULTRAFOOT_RAW_URL = "https://raw.githubusercontent.com/jovemegidio/Ultrafoot/main"

// Mapeamento de file_keys para nomes de arquivos de escudos no repositorio
const escudoMap: Record<string, string> = {
  "botafogorj_bra": "botafogo",
  "flarj": "flamengo",
  "flurj": "fluminense",
  "vasco": "vasco",
  "corinthians_bra": "corinthians",
  "saopaulo_bra": "saopaulo",
  "palmeiras": "palmeiras",
  "santos": "santos",
  "gremio": "gremio",
  "internacional_bra": "internacional",
  "atleticomg_bra": "atleticomg",
  "cruzeiro_bra": "cruzeiro",
  "atleticopr_bra": "atleticopr",
  "coritiba_bra": "coritiba",
  "bahia": "bahia",
  "fortaleza": "fortaleza",
  "ceara_bra": "ceara",
  "sport": "sport",
  "vitoria": "vitoria",
  "bragantino_bra": "bragantino",
  "cuiaba": "cuiaba",
  "goias": "goias",
  "juventude": "juventude",
}

// Mapeamento de file_keys para escudos locais
const localEscudoMap: Record<string, string> = {
  // Times brasileiros
  "botafogorj_bra": "/escudos/brasil/botafogo.png",
  "palmeiras": "/escudos/brasil/palmeiras.png",
  "flarj": "/escudos/brasil/flamengo.png",
  "corinthians_bra": "/escudos/brasil/corinthians.png",
  "saopaulo_bra": "/escudos/brasil/saopaulo.png",
  "flurj": "/escudos/brasil/fluminense.png",
  "vasco": "/escudos/brasil/vasco.png",
  "santos": "/escudos/brasil/santos.png",
  "gremio": "/escudos/brasil/gremio.png",
  "internacional_bra": "/escudos/brasil/internacional.png",
  "atleticomg_bra": "/escudos/brasil/atleticomg.png",
  "cruzeiro_bra": "/escudos/brasil/cruzeiro.png",
  "bahia": "/escudos/brasil/bahia.png",
  "fortaleza": "/escudos/brasil/fortaleza.png",
  "vitoria": "/escudos/brasil/vitoria.png",
  "atleticopr_bra": "/escudos/brasil/atleticopr.png",
  "ceara_bra": "/escudos/brasil/ceara.png",
  "sport": "/escudos/brasil/sport.png",
  "bragantino_bra": "/escudos/brasil/bragantino.png",
  "juventude": "/escudos/brasil/juventude.png",
  // Premier League
  "manchester_city": "/escudos/premier_league/manchester_city.png",
  "arsenal": "/escudos/premier_league/arsenal.png",
  "liverpool": "/escudos/premier_league/liverpool.png",
  "manchester_united": "/escudos/premier_league/manchester_united.png",
  "chelsea": "/escudos/premier_league/chelsea.png",
  "tottenham": "/escudos/premier_league/tottenham.png",
  "newcastle": "/escudos/premier_league/newcastle.png",
  "aston_villa": "/escudos/premier_league/aston_villa.png",
  "west_ham": "/escudos/premier_league/west_ham.png",
  "brighton": "/escudos/premier_league/brighton.png",
  "everton": "/escudos/premier_league/everton.png",
  "crystal_palace": "/escudos/premier_league/crystal_palace.png",
  "bournemouth": "/escudos/premier_league/bournemouth.png",
  "wolves": "/escudos/premier_league/wolves.png",
  "fulham": "/escudos/premier_league/fulham.png",
  "brentford": "/escudos/premier_league/brentford.png",
  "nottingham_forest": "/escudos/premier_league/nottingham_forest.png",
  "leicester": "/escudos/premier_league/leicester.png",
  "southampton": "/escudos/premier_league/southampton.png",
  "ipswich": "/escudos/premier_league/ipswich.png",
  // La Liga
  "real_madrid": "/escudos/la_liga/real_madrid.png",
  "barcelona": "/escudos/la_liga/barcelona.png",
  "atletico_madrid": "/escudos/la_liga/atletico_madrid.png",
  "sevilla": "/escudos/la_liga/sevilla.png",
  "villarreal": "/escudos/la_liga/villarreal.png",
  "real_sociedad": "/escudos/la_liga/real_sociedad.png",
  "athletic_bilbao": "/escudos/la_liga/athletic_bilbao.png",
  "valencia": "/escudos/la_liga/valencia.png",
  "real_betis": "/escudos/la_liga/real_betis.png",
  "girona": "/escudos/la_liga/girona.png",
  "celta_vigo": "/escudos/la_liga/celta_vigo.png",
  "getafe": "/escudos/la_liga/getafe.png",
  "rayo_vallecano": "/escudos/la_liga/rayo_vallecano.png",
  "osasuna": "/escudos/la_liga/osasuna.png",
  "espanyol": "/escudos/la_liga/espanyol.png",
  "las_palmas": "/escudos/la_liga/las_palmas.png",
  "alaves": "/escudos/la_liga/alaves.png",
  "leganes": "/escudos/la_liga/leganes.png",
  "valladolid": "/escudos/la_liga/valladolid.png",
  "mallorca": "/escudos/la_liga/mallorca.png",
  // Serie A Italia
  "inter": "/escudos/serie_a_ita/inter.png",
  "ac_milan": "/escudos/serie_a_ita/ac_milan.png",
  "juventus": "/escudos/serie_a_ita/juventus.png",
  "napoli": "/escudos/serie_a_ita/napoli.png",
  "roma": "/escudos/serie_a_ita/roma.png",
  "lazio": "/escudos/serie_a_ita/lazio.png",
  "atalanta": "/escudos/serie_a_ita/atalanta.png",
  "fiorentina": "/escudos/serie_a_ita/fiorentina.png",
  "bologna": "/escudos/serie_a_ita/bologna.png",
  "torino": "/escudos/serie_a_ita/torino.png",
  "udinese": "/escudos/serie_a_ita/udinese.png",
  "genoa": "/escudos/serie_a_ita/genoa.png",
  "verona": "/escudos/serie_a_ita/verona.png",
  "sassuolo": "/escudos/serie_a_ita/sassuolo.png",
  "empoli": "/escudos/serie_a_ita/empoli.png",
  "lecce": "/escudos/serie_a_ita/lecce.png",
  "cagliari": "/escudos/serie_a_ita/cagliari.png",
  "como": "/escudos/serie_a_ita/como.png",
  "parma": "/escudos/serie_a_ita/parma.png",
  "venezia": "/escudos/serie_a_ita/venezia.png",
  // Bundesliga
  "bayern_munich": "/escudos/bundesliga/bayern_munich.png",
  "borussia_dortmund": "/escudos/bundesliga/borussia_dortmund.png",
  "rb_leipzig": "/escudos/bundesliga/rb_leipzig.png",
  "bayer_leverkusen": "/escudos/bundesliga/bayer_leverkusen.png",
  "eintracht_frankfurt": "/escudos/bundesliga/eintracht_frankfurt.png",
  "freiburg": "/escudos/bundesliga/freiburg.png",
  "wolfsburg": "/escudos/bundesliga/wolfsburg.png",
  "borussia_monchengladbach": "/escudos/bundesliga/borussia_monchengladbach.png",
  "werder_bremen": "/escudos/bundesliga/werder_bremen.png",
  "hoffenheim": "/escudos/bundesliga/hoffenheim.png",
  "union_berlin": "/escudos/bundesliga/union_berlin.png",
  "mainz": "/escudos/bundesliga/mainz.png",
  "vfb_stuttgart": "/escudos/bundesliga/vfb_stuttgart.png",
  "fc_koln": "/escudos/bundesliga/fc_koln.png",
  "augsburg": "/escudos/bundesliga/augsburg.png",
  "bochum": "/escudos/bundesliga/bochum.png",
  "heidenheim": "/escudos/bundesliga/heidenheim.png",
  "darmstadt": "/escudos/bundesliga/darmstadt.png",
  // Ligue 1
  "psg": "/escudos/ligue_1/psg.png",
  "monaco": "/escudos/ligue_1/monaco.png",
  "marseille": "/escudos/ligue_1/marseille.png",
  "lille": "/escudos/ligue_1/lille.png",
  "lyon": "/escudos/ligue_1/lyon.png",
  "rennes": "/escudos/ligue_1/rennes.png",
  "nice": "/escudos/ligue_1/nice.png",
  "lens": "/escudos/ligue_1/lens.png",
  "reims": "/escudos/ligue_1/reims.png",
  "nantes": "/escudos/ligue_1/nantes.png",
  "strasbourg": "/escudos/ligue_1/strasbourg.png",
  "montpellier": "/escudos/ligue_1/montpellier.png",
  "angers": "/escudos/ligue_1/angers.png",
  "toulouse": "/escudos/ligue_1/toulouse.png",
  "brest": "/escudos/ligue_1/brest.png",
  "auxerre": "/escudos/ligue_1/auxerre.png",
  "le_havre": "/escudos/ligue_1/le_havre.png",
  "saint_etienne": "/escudos/ligue_1/saint_etienne.png",
}

export function getEscudoUrl(fileKey: string): string {
  // Primeiro verifica se tem escudo local
  if (localEscudoMap[fileKey]) {
    return localEscudoMap[fileKey]
  }
  // Fallback para o repositorio remoto
  const key = escudoMap[fileKey] || fileKey
  return `${ULTRAFOOT_RAW_URL}/teams/escudos/${key}.png`
}

export function getEscudoMiniUrl(fileKey: string): string {
  // Usa o mesmo escudo local em tamanho menor via CSS
  if (localEscudoMap[fileKey]) {
    return localEscudoMap[fileKey]
  }
  const key = escudoMap[fileKey] || fileKey
  return `${ULTRAFOOT_RAW_URL}/teams/escudosMini/${key}.png`
}
