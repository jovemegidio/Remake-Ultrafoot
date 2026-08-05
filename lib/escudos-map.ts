// Mapeamento centralizado de escudos
// Este arquivo nao deve importar de teams-data.ts ou international-teams.ts para evitar dependencias circulares

import { gameAssetUrl, isTauri } from "@/lib/game-asset"
import generatedEscudoMap from "@/data/seeds/escudos-generated-map.json"
// Escudos REAIS importados da pasta do usuario (scripts/import-missing-crests.ts):
// vencem os placeholders gerados, por isso sao aplicados DEPOIS do mapa gerado.
import userCrestOverrides from "@/data/seeds/user-crest-overrides.json"

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
export const localEscudoMap: Record<string, string> = {
  ...(generatedEscudoMap as Record<string, string>),
  ...(userCrestOverrides as Record<string, string>),
  // Serie A - arquivos raiz nomeados por file_key (confiáveis)
  "botafogorj_bra": "/escudos/botafogorj_bra.webp",
  "palmeiras": "/escudos/palmeiras.webp",
  "flarj": "/escudos/flarj.webp",
  "corinthians_bra": "/escudos/corinthians_bra.webp",
  "saopaulo_bra": "/escudos/saopaulo_bra.webp",
  "flurj": "/escudos/flurj.webp",
  "vasco": "/escudos/vasco.webp",
  "santos": "/escudos/santos.webp",
  "gremio": "/escudos/gremio.webp",
  "internacional_bra": "/escudos/internacional_bra.webp",
  "atleticomg_bra": "/escudos/atleticomg_bra.webp",
  "cruzeiro_bra": "/escudos/cruzeiro_bra.webp",
  "bahia": "/escudos/bahia.webp",
  "fortaleza": "/escudos/fortaleza.webp",
  "vitoria": "/escudos/vitoria.webp",
  "atleticopr_bra": "/escudos/atleticopr_bra.webp",
  "ceara_bra": "/escudos/ceara_bra.webp",
  "sport": "/escudos/sport.webp",
  "bragantino_bra": "/escudos/bragantino_bra.webp",
  "juventude": "/escudos/juventude.webp",
  "miirassol_sp": "/escudos/miirassol_sp.webp",
  // Serie B - existentes
  "americamg_bra": "/escudos/americamg_bra.webp",
  "goias": "/escudos/goias.webp",
  "coritiba_bra": "/escudos/coritiba_bra.webp",
  "crb_bra": "/escudos/crb_bra.webp",
  "avai_bra": "/escudos/avai_bra.webp",
  "paysandu": "/escudos/paysandu.webp",
  "chapecoense_bra": "/escudos/chapecoense_bra.webp",
  "vilago": "/escudos/vilago.webp",
  "amazonas_am": "/escudos/amazonas_am.webp",
  "operario_pr": "/escudos/operario_pr.webp",
  "novorinzontino_sp": "/escudos/novorinzontino_sp.webp",
  "botafogosp_bra": "/escudos/botafogosp_bra.webp",
  // Serie B - novos
  "saobernardo_sp": "/escudos/saobernardo_sp.webp",
  "guaranisp_bra": "/escudos/guaranisp_bra.webp",
  "pontepreta_bra": "/escudos/pontepreta_bra.webp",
  "criciuma_bra": "/escudos/criciuma_bra.webp",
  "cuiaba_bra": "/escudos/cuiaba_bra.webp",
  "atleticogo_bra": "/escudos/atleticogo_bra.webp",
  "ituano_sp": "/escudos/ituano_sp.webp",
  "aguasanta_sp": "/escudos/aguasantasp_bra.webp",
  // Serie C
  "remo_pa": "/escudos/remo.webp",
  "abc_rn": "/escudos/abcrn_bra.webp",
  "nautico_pe": "/escudos/nautico.webp",
  "santacruz_pe": "/escudos/santa.webp",
  "csa_al": "/escudos/csa_bra.webp",
  "sampaio_ma": "/escudos/samapaiocorrea_ma.webp",
  "figueirense_sc": "/escudos/figueirense.webp",
  "londrina_pr": "/escudos/londrina_pr.webp",
  "tombense_mg": "/escudos/tombense_mg.webp",
  "botafogo_pb": "/escudos/botafogopb_bra.webp",
  "aparecidense_go": "/escudos/aparecidense_go.webp",
  "ferroviario_ce": "/escudos/ferroviarioce_bra.webp",
  "confianca_se": "/escudos/confianca_se.webp",
  "voltaredonda_rj": "/escudos/voltaredondarj_bra.webp",
  "altos_pi": "/escudos/altos_pi.webp",
  "floresta_ce": "/escudos/florestace.webp",
  "ypiranga_rs": "/escudos/ypiranga_rs.webp",
  "saojose_rs": "/escudos/saojosers_bra.webp",
  "athletic_mg": "/escudos/athleticclub_mg.webp",
  "caxias_rs": "/escudos/caxias.webp",
  // Serie D
  "brasiliense_df": "/escudos/brasiliense_df_bra.webp",
  "river_pi": "/escudos/riverpi_bra.webp",
  "inter_sp": "/escudos/interlimeira.webp",
  "portovelho_ro": "/escudos/portovelho.webp",
  "trem_ap": "/escudos/ap_trem.webp",
  "saoraimundo_am": "/escudos/saoraimundo_am_bra.webp",
  "realnoroeste_es": "/escudos/realnoroeste_es.webp",
  "novaiguacu_rj": "/escudos/novaiguacu_rj.webp",
  "motoclub_ma": "/escudos/motoclubma_bra.webp",
  "guarany_ce": "/escudos/guaranysobral_bra.webp",
  // Premier League
  "manchester_city": "/escudos/premier_league/manchester_city.webp",
  "arsenal": "/escudos/premier_league/arsenal.webp",
  "liverpool": "/escudos/premier_league/liverpool.webp",
  "manchester_united": "/escudos/premier_league/manchester_united.webp",
  "chelsea": "/escudos/premier_league/chelsea.webp",
  "tottenham": "/escudos/premier_league/tottenham.webp",
  "newcastle": "/escudos/premier_league/newcastle.webp",
  "aston_villa": "/escudos/premier_league/aston_villa.webp",
  "west_ham": "/escudos/premier_league/west_ham.webp",
  "brighton": "/escudos/premier_league/brighton.webp",
  "everton": "/escudos/premier_league/everton.webp",
  "crystal_palace": "/escudos/premier_league/crystal_palace.webp",
  "bournemouth": "/escudos/premier_league/bournemouth.webp",
  "wolves": "/escudos/premier_league/wolves.webp",
  "fulham": "/escudos/premier_league/fulham.webp",
  "brentford": "/escudos/premier_league/brentford.webp",
  "nottingham_forest": "/escudos/premier_league/nottingham_forest.webp",
  "leicester": "/escudos/premier_league/leicester.webp",
  "southampton": "/escudos/premier_league/southampton.webp",
  "ipswich": "/escudos/premier_league/ipswich.webp",
  // La Liga
  "real_madrid": "/escudos/la_liga/real_madrid.webp",
  "barcelona": "/escudos/la_liga/barcelona.webp",
  "atletico_madrid": "/escudos/la_liga/atletico_madrid.webp",
  "sevilla": "/escudos/la_liga/sevilla.webp",
  "villarreal": "/escudos/la_liga/villarreal.webp",
  "real_sociedad": "/escudos/la_liga/real_sociedad.webp",
  "athletic_bilbao": "/escudos/la_liga/athletic_bilbao.webp",
  "valencia": "/escudos/la_liga/valencia.webp",
  "real_betis": "/escudos/la_liga/real_betis.webp",
  "girona": "/escudos/la_liga/girona.webp",
  "celta_vigo": "/escudos/la_liga/celta_vigo.webp",
  "getafe": "/escudos/la_liga/getafe.webp",
  "rayo_vallecano": "/escudos/la_liga/rayo_vallecano.webp",
  "osasuna": "/escudos/la_liga/osasuna.webp",
  "espanyol": "/escudos/la_liga/espanyol.webp",
  "las_palmas": "/escudos/la_liga/las_palmas.webp",
  "alaves": "/escudos/la_liga/alaves.webp",
  "leganes": "/escudos/la_liga/leganes.webp",
  "valladolid": "/escudos/la_liga/valladolid.webp",
  "mallorca": "/escudos/la_liga/mallorca.webp",
  // Serie A Italia
  "inter": "/escudos/serie_a_ita/inter.webp",
  "inter_milan": "/escudos/serie_a_ita/inter.webp",
  "ac_milan": "/escudos/serie_a_ita/ac_milan.webp",
  "juventus": "/escudos/serie_a_ita/juventus.webp",
  "napoli": "/escudos/serie_a_ita/napoli.webp",
  "roma": "/escudos/serie_a_ita/roma.webp",
  "lazio": "/escudos/serie_a_ita/lazio.webp",
  "atalanta": "/escudos/serie_a_ita/atalanta.webp",
  "fiorentina": "/escudos/serie_a_ita/fiorentina.webp",
  "bologna": "/escudos/serie_a_ita/bologna.webp",
  "torino": "/escudos/serie_a_ita/torino.webp",
  "udinese": "/escudos/serie_a_ita/udinese.webp",
  "genoa": "/escudos/serie_a_ita/genoa.webp",
  "verona": "/escudos/serie_a_ita/verona.webp",
  "hellas_verona": "/escudos/serie_a_ita/verona.webp",
  "sassuolo": "/escudos/serie_a_ita/sassuolo.webp",
  "empoli": "/escudos/serie_a_ita/empoli.webp",
  "lecce": "/escudos/serie_a_ita/lecce.webp",
  "cagliari": "/escudos/serie_a_ita/cagliari.webp",
  "como": "/escudos/serie_a_ita/como.webp",
  "parma": "/escudos/serie_a_ita/parma.webp",
  "venezia": "/escudos/serie_a_ita/venezia.webp",
  "monza": "/escudos/monza_ita.webp",
  // Bundesliga
  "bayern_munich": "/escudos/bundesliga/bayern_munich.webp",
  "borussia_dortmund": "/escudos/bundesliga/borussia_dortmund.webp",
  "rb_leipzig": "/escudos/bundesliga/rb_leipzig.webp",
  "bayer_leverkusen": "/escudos/bundesliga/bayer_leverkusen.webp",
  "eintracht_frankfurt": "/escudos/bundesliga/eintracht_frankfurt.webp",
  "freiburg": "/escudos/bundesliga/freiburg.webp",
  "wolfsburg": "/escudos/bundesliga/wolfsburg.webp",
  "borussia_monchengladbach": "/escudos/bundesliga/borussia_monchengladbach.webp",
  "borussia_mgladbach": "/escudos/bundesliga/borussia_monchengladbach.webp",
  "werder_bremen": "/escudos/bundesliga/werder_bremen.webp",
  "hoffenheim": "/escudos/bundesliga/hoffenheim.webp",
  "union_berlin": "/escudos/bundesliga/union_berlin.webp",
  "mainz": "/escudos/bundesliga/mainz.webp",
  "vfb_stuttgart": "/escudos/bundesliga/vfb_stuttgart.webp",
  "stuttgart": "/escudos/bundesliga/vfb_stuttgart.webp",
  "fc_koln": "/escudos/bundesliga/fc_koln.webp",
  "augsburg": "/escudos/bundesliga/augsburg.webp",
  "bochum": "/escudos/bundesliga/bochum.webp",
  "heidenheim": "/escudos/bundesliga/heidenheim.webp",
  "darmstadt": "/escudos/bundesliga/darmstadt.webp",
  // Convidados continentais cujo arquivo existe com OUTRO nome. Sem estas duas
  // linhas eram os unicos dois clubes do jogo inteiro sem escudo na tela, e a
  // arte estava no disco o tempo todo: `carabobo` -> "Carabobo.png" (maiuscula)
  // e `juventud_ury` -> "juventud_uru.png" (uru x ury).
  "carabobo": "/escudos/Carabobo.webp",
  "juventud_ury": "/escudos/juventud_uru.webp",
  // Clubes criados em 04/08 cuja arte JA estava no disco com outro nome.
  // ⚠️ Os dois de Concepcion ficaram de fora: o unico "Concepcion" no acervo e
  // `Concepcion_arg.png`, que e argentino — outro clube. E `suwon_kor.png` nao
  // da para dizer se e o Suwon FC ou o Suwon Samsung, entao nenhum dos dois o
  // recebe. Escudo generico e melhor do que o escudo de outro time.
  "gangwon_fc": "/escudos/gangwon_cor.webp",
  "albion_ury": "/escudos/albion_uru.webp",
  "central_espanol_ury": "/escudos/centralespanol_uru.webp",
  "dep_maldonado_ury": "/escudos/depmaldonado_uru.webp",
  "gimnasia_mendoza": "/escudos/gimnasiamendoza_arg.webp",
  "estudiantes_rio_cuarto": "/escudos/EstudiantesDeRioCuarto_arg.webp",
  // Ligue 1
  "psg": "/escudos/ligue_1/psg.webp",
  "monaco": "/escudos/ligue_1/monaco.webp",
  "marseille": "/escudos/ligue_1/marseille.webp",
  "lille": "/escudos/ligue_1/lille.webp",
  "lyon": "/escudos/ligue_1/lyon.webp",
  "rennes": "/escudos/ligue_1/rennes.webp",
  "nice": "/escudos/ligue_1/nice.webp",
  "lens": "/escudos/ligue_1/lens.webp",
  "reims": "/escudos/ligue_1/reims.webp",
  "nantes": "/escudos/ligue_1/nantes.webp",
  "strasbourg": "/escudos/ligue_1/strasbourg.webp",
  "montpellier": "/escudos/ligue_1/montpellier.webp",
  "angers": "/escudos/ligue_1/angers.webp",
  "toulouse": "/escudos/ligue_1/toulouse.webp",
  "brest": "/escudos/ligue_1/brest.webp",
  "auxerre": "/escudos/ligue_1/auxerre.webp",
  "le_havre": "/escudos/ligue_1/le_havre.webp",
  "saint_etienne": "/escudos/ligue_1/saint_etienne.webp",
  // Saudi Pro League
  "al_hilal": "/escudos/saudi_pro/al_hilal.webp",
  "al_nassr": "/escudos/saudi_pro/al_nassr.webp",
  "al_ittihad": "/escudos/saudi_pro/al_ittihad.webp",
  "al_ahli": "/escudos/saudi_pro/al_ahli.webp",
  "al_ahli_saudi": "/escudos/saudi_pro/al_ahli.webp",
  "al_shabab": "/escudos/saudi_pro/al_shabab.webp",
  "al_taawoun": "/escudos/saudi_pro/al_taawoun.webp",
  "al_fateh": "/escudos/saudi_pro/al_fateh.webp",
  "al_fayha": "/escudos/saudi_pro/al_fayha.webp",
  "al_ettifaq": "/escudos/saudi_pro/al_ettifaq.webp",
  "damac": "/escudos/saudi_pro/damac.webp",
  "al_riyadh": "/escudos/saudi_pro/al_riyadh.webp",
  "al_khaleej": "/escudos/saudi_pro/al_khaleej.webp",
  "al_raed": "/escudos/saudi_pro/al_raed.webp",
  "al_hazm": "/escudos/saudi_pro/al_hazm.webp",
  "al_orobah": "/escudos/saudi_pro/al_orobah.webp",
  "al_akhdoud": "/escudos/saudi_pro/al_akhdoud.webp",
  "al_wehda": "/escudos/saudi_pro/al_wehda.webp",
  "al_qadisiyah": "/escudos/saudi_pro/al_qadisiyah.webp",
  // MLS
  "inter_miami": "/escudos/mls/inter_miami.webp",
  "la_galaxy": "/escudos/mls/la_galaxy.webp",
  "lafc": "/escudos/mls/lafc.webp",
  "atlanta_united": "/escudos/mls/atlanta_united.webp",
  "seattle_sounders": "/escudos/mls/seattle_sounders.webp",
  "new_york_city": "/escudos/mls/new_york_city.webp",
  "new_york_red_bulls": "/escudos/mls/new_york_red_bulls.webp",
  "ny_red_bulls": "/escudos/mls/new_york_red_bulls.webp",
  "nycfc": "/escudos/mls/new_york_city.webp",
  "toronto_fc": "/escudos/mls/toronto_fc.webp",
  "cf_montreal": "/escudos/mls/cf_montreal.webp",
  "austin_fc": "/escudos/mls/austin_fc.webp",
  "columbus_crew": "/escudos/mls/columbus_crew.webp",
  "fc_cincinnati": "/escudos/mls/fc_cincinnati.webp",
  "nashville_sc": "/escudos/mls/nashville_sc.webp",
  "orlando_city": "/escudos/mls/orlando_city.webp",
  "philadelphia_union": "/escudos/mls/philadelphia_union.webp",
  "portland_timbers": "/escudos/mls/portland_timbers.webp",
  "minnesota_united": "/escudos/mls/minnesota_united.webp",
  "charlotte_fc": "/escudos/mls/charlotte_fc.webp",
  "dc_united": "/escudos/mls/dc_united.webp",
  "houston_dynamo": "/escudos/mls/houston_dynamo.webp",
  // Liga MX
  "club_america": "/escudos/liga_mx/club_america.webp",
  "chivas": "/escudos/liga_mx/chivas.webp",
  "cruz_azul": "/escudos/liga_mx/cruz_azul.webp",
  "tigres": "/escudos/liga_mx/tigres.webp",
  "monterrey": "/escudos/liga_mx/monterrey.webp",
  "pumas": "/escudos/liga_mx/pumas.webp",
  "leon": "/escudos/liga_mx/leon.webp",
  "santos_laguna": "/escudos/liga_mx/santos_laguna.webp",
  "toluca": "/escudos/liga_mx/toluca.webp",
  "pachuca": "/escudos/liga_mx/pachuca.webp",
  "atlas": "/escudos/liga_mx/atlas.webp",
  "necaxa": "/escudos/liga_mx/necaxa.webp",
  "queretaro": "/escudos/liga_mx/queretaro.webp",
  "tijuana": "/escudos/liga_mx/tijuana.webp",
  "puebla": "/escudos/liga_mx/puebla.webp",
  "mazatlan": "/escudos/liga_mx/mazatlan.webp",
  "san_luis": "/escudos/liga_mx/san_luis.webp",
  "fc_juarez": "/escudos/liga_mx/fc_juarez.webp",
  // Primeira Liga Portugal
  "benfica": "/escudos/primeira_liga/benfica.webp",
  "porto": "/escudos/primeira_liga/porto.webp",
  "sporting": "/escudos/primeira_liga/sporting.webp",
  "braga": "/escudos/primeira_liga/braga.webp",
  "vitoria_guimaraes": "/escudos/primeira_liga/vitoria_guimaraes.webp",
  "boavista": "/escudos/primeira_liga/boavista.webp",
  "santa_clara": "/escudos/primeira_liga/santa_clara.webp",
  "famalicao": "/escudos/primeira_liga/famalicao.webp",
  "rio_ave": "/escudos/primeira_liga/rio_ave.webp",
  "casa_pia": "/escudos/primeira_liga/casa_pia.webp",
  "moreirense": "/escudos/primeira_liga/moreirense.webp",
  "gil_vicente": "/escudos/primeira_liga/gil_vicente.webp",
  "arouca": "/escudos/primeira_liga/arouca.webp",
  "estoril": "/escudos/primeira_liga/estoril.webp",
  "nacional": "/escudos/primeira_liga/nacional.webp",
  "estrela_amadora": "/escudos/primeira_liga/estrela_amadora.webp",
  "farense": "/escudos/primeira_liga/farense.webp",
  "avs": "/escudos/primeira_liga/avs.webp",
  // Bundesliga extras
  "st_pauli": "/escudos/bundesliga/st_pauli.webp",
  "holstein_kiel": "/escudos/bundesliga/holstein_kiel.webp",
  // Ligue 1 extras
  "lorient": "/escudos/ligue_1/lorient.webp",
  "clermont": "/escudos/ligue_1/clermont.webp",
  // Escudos IMPORTADOS pelo usuario vencem TUDO (inclusive as entradas manuais
  // acima que apontam para subpastas antigas — ex.: al_nassr estava preso em
  // /escudos/saudi_pro/ e ignorava o escudo novo). Por isso o spread fica por
  // ultimo: a arte que o jogador forneceu tem a palavra final.
  ...(userCrestOverrides as Record<string, string>),
}

export function getEscudoUrl(fileKey: string): string {
  // No app desktop (Tauri) os escudos sao empacotados localmente.
  // Na web nao existe pasta public/escudos, entao usamos o repositorio remoto
  // (padrao /teams/escudos/{file_key}.png), evitando 404 e o fallback generico.
  if (isTauri()) {
    // Empacotado = WebP sem perdas. Remoto = PNG (repositório de terceiros).
    const raw = localEscudoMap[fileKey] ?? `/escudos/${fileKey}.webp`
    return gameAssetUrl(raw)
  }
  return `${ULTRAFOOT_RAW_URL}/teams/escudos/${fileKey}.png`
}

/** Caminho empacotado, independente do ambiente; usado pelo preflight de release. */
// ⚠️ `.webp` AQUI, `.png` no remoto — os dois estão certos.
//
// Os escudos empacotados no jogo foram convertidos para WebP SEM PERDAS (bitmap
// idêntico ao PNG, 52% menor): 67 MB viraram 32 MB sem tirar um pixel. Já o
// `getRemoteEscudoUrl` aponta para um repositório de terceiros que continua
// servindo PNG — mudar a extensão lá quebraria o download.
export function getLocalEscudoPath(fileKey: string): string {
  return localEscudoMap[fileKey] ?? `/escudos/${fileKey}.webp`
}

export function getRemoteEscudoUrl(fileKey: string): string {
  // O repositorio nomeia os arquivos pelo proprio file_key (ex: botafogorj_bra.png).
  return `${ULTRAFOOT_RAW_URL}/teams/escudos/${fileKey}.png`
}

export function getEscudoMiniUrl(fileKey: string): string {
  if (isTauri()) {
    const raw = localEscudoMap[fileKey] ?? `/escudos/${fileKey}.webp`
    return gameAssetUrl(raw)
  }
  return `${ULTRAFOOT_RAW_URL}/teams/escudos/${fileKey}.png`
}
