// Importa POSIÇÃO e NACIONALIDADE reais do Transfermarkt, elenco por elenco.
//
// Resolve dois relatos de jogador de uma vez:
//   - "Cole Palmer como goleiro / diversos jogadores fora de posição"
//   - nacionalidade inexistente (o chip do mercado era inferido do país do clube)
//
// POR QUE POR ELENCO, e não por atleta: buscar "Fulano futebol" no Google/TM
// devolve *alguém* — não necessariamente o atleta certo. Casando dentro da
// página do CLUBE, o par (clube, nome) é praticamente único e o risco de
// atribuir a nacionalidade da pessoa errada cai a quase zero. São ~2.900
// requisições em vez de 53.406.
//
// Uso:
//   node scripts/import-tm-squads.mjs --limit 20      (teste)
//   node scripts/import-tm-squads.mjs                 (tudo, retomando)
//
// Seguro para interromper: grava o progresso a cada clube e retoma de onde parou.

import { readFile, writeFile, mkdir, rename } from "node:fs/promises"
import { existsSync } from "node:fs"
import path from "node:path"

const SEED = path.resolve("data/seeds/imported-bf2026.json")
const OUT = path.resolve("data/seeds/tm-squads.json")
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36"

// Versão do parser. Clube gravado com versão anterior é rebaixado e refeito —
// foi assim que a v1 (que só lia o grupo grosso) foi descartada sem eu ter de
// apagar o cache na mão.
// v3 (30/07/2026): o parser passa a extrair a FOTO do atleta, que sempre estava
// na mesma pagina e vinha sendo ignorada. Subir a versao faz o script reprocessar
// os clubes ja baixados em vez de deixar metade do acervo sem retrato.
const PARSER_V = 3

/**
 * Transfermarkt PT-BR -> códigos do jogo.
 *
 * ⚠️ NÃO usar o title da célula da camisa (`rueckennummer`): ele traz só o GRUPO
 * ("Defensor", "Meio-Campo", "Atacante", "Goleiro") — quatro baldes. Importar
 * por ali transformava TODO lateral em zagueiro e TODO ponta em centroavante,
 * que é exatamente o bug que este script existe para corrigir. A posição real
 * está na sub-tabela, na linha logo abaixo do nome.
 *
 * Por palavra-chave e não por string exata porque o TM alterna entre "Lateral
 * Esq." e "Lateral esquerdo" conforme a página.
 */
function mapPos(txt) {
  const s = (txt || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
  if (s.includes("goleiro")) return "GOL"
  // Lateral antes de zagueiro/defensor: "Lateral" não pode cair em ZAG.
  if (s.includes("lateral")) return s.includes("esq") ? "LE" : s.includes("dir") ? "LD" : "LD"
  if (s.includes("zagueiro") || s.includes("libero") || s.includes("defensor")) return "ZAG"
  if (s.includes("volante")) return "VOL"
  // Ponta antes de atacante: "Ponta" não pode cair em ATA.
  if (s.includes("ponta")) return s.includes("esq") ? "PE" : s.includes("dir") ? "PD" : "PD"
  if (s.includes("centroavante") || s.includes("atacante") || s.includes("ataque")) return "ATA"
  if (s.includes("meia") || s.includes("meio")) return "MEI"
  return null
}

const args = process.argv.slice(2)
const limit = args.includes("--limit") ? Number(args[args.indexOf("--limit") + 1]) : Infinity
const delayMs = args.includes("--delay") ? Number(args[args.indexOf("--delay") + 1]) : 1500
// Concorrência modesta de propósito: 2.947 clubes em série levariam ~4h. Quatro
// tarefas, cada uma ainda respeitando o delay, derrubam para ~1h sem virar
// enxurrada em cima do site.
const conc = args.includes("--conc") ? Number(args[args.indexOf("--conc") + 1]) : 4

const sleep = ms => new Promise(r => setTimeout(r, ms))

/** Normaliza nome para casar entre as duas bases (acentos, caixa, pontuação). */
export function nameKey(s) {
  return (s || "")
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()
}

// O campo `pais` do seed é inconsistente: às vezes nome inteiro ("Uruguai"),
// às vezes sigla ("ENG", "FR", "UZB"), às vezes UF brasileira ("RJ"). Comparar
// cru contra o nome em português do Transfermarkt reprovava TODO clube com
// sigla — Preston, Caen e Bristol City caíam por isso, não por não existirem.
const PAIS_ALIAS = {
  eng: "inglaterra", gbr: "inglaterra", uk: "inglaterra", sco: "escocia", wal: "gales", nir: "irlanda do norte",
  fr: "franca", fra: "franca", esp: "espanha", es: "espanha", ita: "italia", it: "italia",
  ale: "alemanha", ger: "alemanha", de: "alemanha", por: "portugal", pt: "portugal",
  hol: "paises baixos", ned: "paises baixos", nl: "paises baixos", holanda: "paises baixos",
  bel: "belgica", sui: "suica", tur: "turquia", gre: "grecia", rus: "russia", ucr: "ucrania",
  aut: "austria", din: "dinamarca", sue: "suecia", nor: "noruega", fin: "finlandia",
  pol: "polonia", tch: "republica tcheca", cze: "republica tcheca", cro: "croacia",
  ser: "servia", srb: "servia", rom: "romenia", bul: "bulgaria", hun: "hungria",
  esl: "eslovenia", svn: "eslovenia", elv: "eslovenia", svk: "eslovaquia",
  uzb: "uzbequistao", jap: "japao", jpn: "japao", cor: "coreia do sul", kor: "coreia do sul",
  chn: "china", ara: "arabia saudita", ksa: "arabia saudita", eau: "emirados arabes unidos",
  eua: "estados unidos", usa: "estados unidos", mex: "mexico", can: "canada",
  arg: "argentina", uru: "uruguai", ury: "uruguai", par: "paraguai", chi: "chile",
  col: "colombia", equ: "equador", ecu: "equador", per: "peru", bol: "bolivia", ven: "venezuela",
  bra: "brasil", br: "brasil", aus: "australia", mar: "marrocos", egi: "egito", rsa: "africa do sul",
}

// UFs brasileiras: um clube cujo "país" é RJ/SP/MG é, obviamente, do Brasil.
const UF_BR = new Set(["ac","al","ap","am","ba","ce","df","es","go","ma","mt","ms","mg","pa","pb","pr","pe","pi","rj","rn","rs","ro","rr","sc","sp","se","to"])

// Siglas de tipo de clube. "Chelsea" x "Chelsea FC" e "Palmeiras" x "SE
// Palmeiras" sao o mesmo time; sem tirar essas siglas nenhum casamento exato
// acontecia e o clube caia na regra de ambiguidade junto com "Berekum Chelsea
// FC" e "Ferrocarril Palmeiras".
const SIGLAS_CLUBE = new Set("fc cf sc ca ac se cr ec ud cd afc ssc as ss us rc rcd sv tsv vfb vfl bsc if ik fk nk hnk sk ask club clube cp cs ce aa ad sd rs bk gk os fk1 psv ogc rcs".split(" "))

/** Nome comparável: sem acento, sem pontuação e sem sigla de tipo de clube. */
function limparNome(s) {
  return nameKey(s).split(" ").filter(w => w && !SIGLAS_CLUBE.has(w)).join(" ")
}

/**
 * Chaves pelas quais um candidato pode ser reconhecido.
 *
 * Inclui o SLUG da URL de propósito: o Transfermarkt em português TRADUZ nomes
 * de cidade — o Bayern aparece como "FC Bayern Munique" — então comparar só
 * pelo texto exibido nunca casava, e o único candidato que ainda escrevia
 * "München" era o time SUB-17. O slug (`fc-bayern-munchen`) não é traduzido.
 */
/**
 * Palavras que IDENTIFICAM o clube: 4+ letras e nada de genérico.
 *
 * "Salzburg" identifica; "Sport", "FC" e "Clube" aparecem em meio mundo e casariam
 * qualquer coisa com qualquer coisa. Usado só no resgate por token (ver
 * `tentarBusca`), onde uma palavra em comum precisa valer como evidência.
 */
const GENERICAS_CLUBE = new Set([
  "sport", "sporting", "sportivo", "sportif", "club", "clube", "futbol", "futebol",
  "football", "atletico", "atletica", "athletic", "deportivo", "deportes", "unido",
  "united", "city", "town", "real", "nacional", "internacional", "juventude",
  "esporte", "esportivo", "calcio", "verein", "sociedad", "sociedade", "asociacion",
  "associacao", "recreativo", "regatas", "academica", "academy", "munkipal",
  "municipal", "provincial", "central", "estrela", "olimpico", "olympique",
])

function tokensDistintivos(nome) {
  return new Set(nameKey(nome).split(" ")
    .filter(t => t.length >= 4 && !GENERICAS_CLUBE.has(t)))
}

function chavesCandidato(c) {
  const slug = c.href.split("/").filter(Boolean)[0] ?? ""
  return new Set([limparNome(c.nome), limparNome(slug.replace(/-/g, " "))])
}

/**
 * Chave do cache. NÃO use `curto` sozinho: ele não é único no seed — 134 códigos
 * são compartilhados por 400 times. `BARCELON` serve a CINCO clubes (Guayaquil,
 * Ilhéus, Espanha, Barcelona-RO, Barcelona II), `FORTUNAX` serve Sittard e
 * Düsseldorf, `SALZBURG` serve RB Salzburg e Salzburger AK.
 *
 * Com `curto` de chave, esses clubes dividiam UMA entrada e o último processado
 * sobrescrevia os outros — foi isso, e não erro de casamento, que fez o
 * "Barcelona Guayaquil" aparecer com o elenco do Barcelona da Espanha.
 */
export function chaveClube(team) {
  return `${team.curto}|${nameKey(team.nome)}`
}

/** Devolve o país em forma comparável, ou null se não der para saber. */
function paisKey(bruto) {
  const k = nameKey(bruto)
  if (!k) return null
  if (UF_BR.has(k)) return "brasil"
  // "es" é Espírito Santo E Espanha; a UF vence porque o seed usa UF com muito
  // mais frequência do que sigla de país de duas letras.
  return PAIS_ALIAS[k] ?? k
}

/**
 * Busca o clube no TM exigindo que o PAÍS bata. Devolve a URL do elenco ou null.
 *
 * ⚠️ Duas armadilhas que a versão ingênua caiu (teste real):
 *  1. A busca rápida lista JOGADORES primeiro. Pegar o primeiro link
 *     `/startseite/verein/` capturava o clube DO ATLETA homônimo — "Fénix"
 *     (Uruguai) virou "Atlético San Cristóbal II" (Rep. Dominicana).
 *  2. Mesmo dentro dos clubes há homônimos em países diferentes ("CA Fénix"
 *     existe no Uruguai E na Argentina). Sem checar o país, "Orense" (Equador)
 *     virou um clube italiano.
 * Por isso: recorta a seção de CLUBES e só aceita país compatível.
 */
/**
 * Devolve { url } | { semClube: true } | { falhou: true }.
 *
 * A distinção importa: "falhou" (HTTP ruim, resposta sem a seção de clubes —
 * tipicamente throttling) NÃO pode virar cache definitivo. Na primeira versão
 * virava, e 39% dos clubes ficavam marcados como inexistentes para sempre
 * enquanto a mesma busca, feita à mão, achava o clube na hora. Seria uma base
 * silenciosamente pela metade se dando por concluída.
 */
/**
 * ALIAS de busca: o nome do clube no jogo x o nome no Transfermarkt.
 *
 * A busca do TM e literal. Clubes grandes ficavam sem elenco so porque o jogo os
 * chama de um jeito e o TM de outro: "Gremio" (sem acento) x "Grêmio",
 * "Bayer Leverkusen" x "Bayer 04 Leverkusen", "Rennes" x "Stade Rennais".
 * Eram 35 clubes JOGAVEIS sem elenco real — Leverkusen, Benfica, Fiorentina,
 * Betis, Anderlecht, Colo-Colo, o proprio Gremio.
 *
 * O alias so muda o TERMO BUSCADO. A validacao continua a mesma (mesmo pais,
 * sem time B/juvenil, sobreposicao de elenco): alias errado e REJEITADO, nao
 * importa elenco de outro clube.
 */
const ALIAS_TM = {
  // "Colo-Colo" puro casa com o Colo Colo de Futebol e Regatas (BA). O chileno
  // e o CSD Colo-Colo — a trava de sobreposicao rejeitou o errado, mas melhor
  // nem buscar ambiguo.
  "colo colo": "CSD Colo-Colo",
  "bayer leverkusen": "Bayer 04 Leverkusen",
  "benfica": "SL Benfica",
  "cska moscow": "CSKA Moscou",
  "anderlecht": "RSC Anderlecht",
  "spartak moscow": "Spartak Moscou",
  "gremio": "Grêmio Foot-Ball Porto Alegrense",
  "fiorentina": "ACF Fiorentina",
  "real betis": "Real Betis Balompié",
  "standard liege": "Standard de Liège",
  "godoy cruz": "Godoy Cruz Antonio Tomba",
  "union berlin": "1.FC Union Berlin",
  "rennes": "Stade Rennais FC",
  "new york red bulls": "New York Red Bulls",
  "vitesse": "Vitesse Arnhem",
  "dalian pro": "Dalian Pro",
  "udinese": "Udinese Calcio",
  "parma": "Parma Calcio 1913",
  "strasbourg": "RC Strasbourg Alsace",
  "sport": "Sport Recife",
  // O TM nao conhece "Atletico-MG": la e "Clube Atletico Mineiro". Sem o alias a
  // busca voltava vazia e o clube ficava `naoEncontrado` — era o unico time
  // GRANDE da Serie A sem elenco real, caindo no curado (uma temporada atras).
  "atletico-mg": "Clube Atlético Mineiro",
  "cagliari": "Cagliari Calcio",
  "montpellier": "Montpellier HSC",
  "dc united": "DC United",
  "charleroi": "Sporting Charleroi",
  "krylya sovetov": "Krylya Sovetov Samara",
  "auxerre": "AJ Auxerre",
  "alaves": "Deportivo Alavés",
  "westerlo": "KVC Westerlo",
  "kortrijk": "KV Kortrijk",
  "como": "Como 1907",
  "dynamo dresden": "Dynamo Dresden",
  "remo": "Clube do Remo",
  "csa": "Centro Sportivo Alagoano",
  "inter de limeira": "Inter de Limeira",
  "trem": "Trem Desportivo Clube",
}

function aliasTm(clubName) {
  const k = (clubName || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim()
  return ALIAS_TM[k] ?? null
}

/**
 * URL FIXA, para quando nem o alias resolve.
 *
 * O alias so troca o TERMO buscado; a validacao continua. "Atletico-MG" cai num
 * caso que o alias nao alcanca: a busca por "Clube Atletico Mineiro" devolve
 * DEZENAS de "Atletico ..." do Brasil, todos plausiveis, e o desempate final e
 * por sobrecarga de nomes do elenco do SEED — que para este clube e ficticio.
 * Zero nomes em comum, entao o desempate recusa tudo e o clube fica
 * `naoEncontrado` para sempre. Era o unico time GRANDE da Serie A sem elenco
 * real (caia no curado, uma temporada atras).
 *
 * ⚠️ URL fixada e afirmacao de identidade: confira o elenco da pagina ANTES de
 * incluir aqui. A de baixo foi conferida em 03/08/2026 (Everson, Renan Lodi,
 * Scarpa, Bernard, Cassierra).
 */
const URL_TM = {
  "atletico-mg": "https://www.transfermarkt.com.br/atletico-mineiro/startseite/verein/330",
}

function urlTm(clubName) {
  const k = (clubName || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim()
  return URL_TM[k] ?? null
}

async function findClubUrl(clubName, clubCountry, buscar, seedNames) {
  // URL fixada vence tudo: ela existe justamente para os casos que a busca nao
  // consegue resolver, entao tentar buscar antes so gastaria requisicao.
  const fixa = urlTm(clubName)
  if (fixa) return { url: fixa }

  // Segunda chance com o nome encurtado: a busca do TM é bem literal e não acha
  // "Racing Montevideo" (lá é "Racing Club de Montevideo") nem "Barcelona
  // Guayaquil" (é "Barcelona SC Guayaquil"). Tirando o qualificador final, acha.
  //
  // Só que encurtar joga fora justamente a palavra que DISTINGUE: na primeira
  // versão "Juventus Jaraguá" (SC) casou com o "Clube Atlético Juventus" (SP) —
  // mesmo país, nome curto único, tudo "válido". Por isso a tentativa curta
  // exige que o candidato ainda contenha a palavra descartada.
  const palavras = clubName.trim().split(/\s+/)
  const tentativas = []
  // O ALIAS vem primeiro: e o nome exato do clube no TM (ver ALIAS_TM).
  const alias = aliasTm(clubName)
  if (alias) tentativas.push({ termo: alias, exigir: null })
  tentativas.push({ termo: clubName, exigir: null })
  if (palavras.length > 1) {
    tentativas.push({ termo: palavras.slice(0, -1).join(" "), exigir: nameKey(palavras.at(-1)) })
  }

  let ultimo = { semClube: true }
  for (const { termo, exigir } of tentativas) {
    const r = await tentarBusca(termo, clubName, clubCountry, buscar, exigir, seedNames)
    if (r.url) return r
    if (r.falhou) return r // problema de rede: não gasta a segunda tentativa
    ultimo = r
  }
  return ultimo
}

async function tentarBusca(termo, clubName, clubCountry, buscar, exigirPalavra, seedNames) {
  const q = encodeURIComponent(termo)
  const url = `https://www.transfermarkt.com.br/schnellsuche/ergebnis/schnellsuche?query=${q}`
  const res = await buscar(url)
  if (!res.ok) return { falhou: true }
  const html = await res.text()

  // ⚠️ Busca vazia é RESPOSTA VÁLIDA, não falha. Eu usava a presença de
  // "Resultados da pesquisa" como prova de que a busca funcionou; quando o TM
  // não acha nada ele responde "Pesquisa sem resultado?" e aquela string some,
  // então um vazio legítimo era classificado como bloqueio e o clube voltava
  // para a fila PARA SEMPRE — 262 clubes girando em erro eterno, 50 de 50
  // "falhando" com o site respondendo 200 normalmente.
  if (html.includes("Pesquisa sem resultado")) return { semClube: true }

  const i = html.indexOf("Resultados da pesquisa para Clubes")
  if (i < 0) {
    // Nem resultados, nem o aviso de busca vazia: aí sim a resposta é anômala.
    return html.includes("Resultados da pesquisa") ? { semClube: true } : { falhou: true }
  }
  const secao = html.slice(i, i + 20000)

  const alvoPais = paisKey(clubCountry)
  const alvoNome = nameKey(clubName)
  const candidatos = []
  for (const row of secao.split(/<tr class="(?:odd|even)[^"]*">/).slice(1)) {
    const link = row.match(/href="(\/[^"]*\/startseite\/verein\/\d+)"[^>]*>\s*([^<]+)/)
    const pais = row.match(/title="([^"]+)"[^>]*class="flaggenrahmen/)
    if (!link) continue
    candidatos.push({ href: link[1], nome: link[2].trim(), pais: pais ? pais[1] : "" })
  }
  if (candidatos.length === 0) return { semClube: true }

  // Times B / juvenis / sub-XX aparecem primeiro em algumas buscas e NAO sao o
  // clube. Sem "jugend" e "juvenil" na lista, "Bayern München" foi casado com o
  // fc-bayern-munchen-JUGEND e teria importado o elenco da base.
  const principal = c =>
    !/\b(ii|b|u\s?\d{2}|sub\s?\d{2})\b/i.test(c.nome) &&
    !/(jugend|juvenil|youth|academy|amateure|reserv)/i.test(c.nome) &&
    !/(jugend|juvenil|youth|academy|amateure|u\d{2})/i.test(c.href)

  const mesmoPais = alvoPais ? candidatos.filter(c => paisKey(c.pais) === alvoPais) : []

  // Times B / juvenis / femininos saem do jogo INTEIRAMENTE, nunca ficam como
  // ultimo recurso: quando so eles sobravam, o Bayern acabava importando o
  // elenco do sub-17.
  const alvoLimpo = limparNome(clubName)
  let elegiveis = (mesmoPais.length > 0 ? mesmoPais : candidatos).filter(principal)
  // Busca encurtada: o candidato tem de trazer de volta a palavra que eu tirei,
  // senão "Juventus Jaraguá" vira o "Juventus" de São Paulo.
  if (exigirPalavra) {
    elegiveis = elegiveis.filter(c =>
      [...chavesCandidato(c)].some(k => k.includes(exigirPalavra)),
    )
  }
  if (elegiveis.length === 0) return { semClube: true }

  // Candidatos plausiveis: nome identico OU um contido no outro. Botafogo-RJ
  // ("Botafogo FR") e Botafogo-SP ("Botafogo FC") sao AMBOS plausiveis para o
  // alvo "botafogo" — juntar os dois aqui e o que permite desempatar depois.
  const plausiveis = elegiveis.filter(c =>
    [...chavesCandidato(c)].some(k => k && (k === alvoLimpo || k.includes(alvoLimpo) || alvoLimpo.includes(k))),
  )
  let distintos = [...new Map(plausiveis.map(c => [c.href, c])).values()]

  // RESGATE POR TOKEN DISTINTIVO — só quando a plausibilidade não achou NADA.
  //
  // "RB Salzburg" não contém nem está contido em "Red Bull Salzburg", e o clube
  // ficava `naoEncontrado` para sempre: 928 clubes assim, com elenco fictício
  // eterno, porque a sigla do jogo não é a razão social do TM (Baltika ->
  // Baltika Kaliningrad, Brann Bergen -> SK Brann).
  //
  // Exige UM só candidato, no MESMO PAÍS, compartilhando uma palavra de 4+ letras
  // que não seja genérica. Dois candidatos = ambiguidade, e aí continua recusando:
  // é assim que Botafogo RJ/SP/PB não vira loteria.
  if (distintos.length === 0 && mesmoPais.length > 0) {
    const proprias = [...tokensDistintivos(clubName)]
    const porToken = elegiveis.filter(c =>
      [...chavesCandidato(c)].some(k => proprias.some(t => k.includes(t))))
    const unicos = [...new Map(porToken.map(c => [c.href, c])).values()]
    if (unicos.length === 1) distintos = unicos
  }
  if (distintos.length === 0) return { semClube: true }
  if (distintos.length === 1) return { url: `https://www.transfermarkt.com.br${distintos[0].href}` }

  // AMBIGUIDADE (Botafogo RJ/SP/PB, America MG/RJ...): mesmo nome, mesmo pais.
  // Nome nao separa; o ELENCO separa. Baixa o elenco de cada candidato e escolhe
  // o que mais casa com os nomes do seed — a mesma metrica que o apply usa para
  // rejeitar. Sem os nomes do seed (chamada antiga) nao ha como desempatar:
  // devolve semClube em vez de chutar, que foi como o RJ virou SP.
  if (!seedNames || seedNames.length === 0) return { semClube: true }
  const alvoSet = new Set(seedNames.map(nameKey))

  let melhor = null
  for (const c of distintos.slice(0, 4)) { // no maximo 4 fetches por clube ambiguo
    const url = `https://www.transfermarkt.com.br${c.href}`
    try {
      const res = await buscar(url)
      if (!res.ok) continue
      const squad = parseSquad(await res.text())
      let hit = 0
      for (const p of squad) if (alvoSet.has(nameKey(p.nome))) hit++
      if (!melhor || hit > melhor.hit) melhor = { url, hit, total: squad.length }
    } catch { /* candidato ruim, ignora */ }
  }
  // Exige pelo menos 2 nomes em comum: 1 pode ser homonimo de jogador.
  if (!melhor || melhor.hit < 2) return { semClube: true }
  return { url: melhor.url }
}

/** Extrai [{nome, posicao, nacionalidade}] da página de elenco. */
export function parseSquad(html) {
  const out = []
  // As linhas contêm tabelas aninhadas; cortar por INÍCIO de linha, não por </tr>
  // (o </tr> interno truncava a linha e a bandeira ficava de fora).
  const parts = html.split(/<tr class="(?:odd|even)[^"]*">/).slice(1)
  for (const row of parts) {
    // O nome pode vir com markup DENTRO do link: quem esta lesionado ou suspenso
    // ganha um <span title="Lesao muscular..."> antes do </a>. Exigir texto puro
    // ate o </a> descartava esses atletas em silencio, em TODOS os clubes (3 de
    // 16 so no Real Madrid). Por isso: pega o conteudo inteiro do link e limpa.
    const link = row.match(/\/profil\/spieler\/(\d+)">([\s\S]*?)<\/a>/)
    if (!link) continue
    const nome = link[2].replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ").trim()
    if (!nome) continue

    // A posicao especifica vem na linha seguinte da sub-tabela, depois do nome.
    const depois = row.slice(row.indexOf(link[0]) + link[0].length)
    const pos = depois.match(/<tr>\s*<td>\s*([^<]+?)\s*<\/td>/)
    if (!pos) continue

    const nac = row.match(/title="([^"]+)"[^>]*class="flaggenrahmen/)
    // Idade: a celula "DD/MM/AAAA (NN)" traz a idade entre parenteses.
    const idade = row.match(/\((\d{2})\)/)
    // FOTO — vem em `data-src` porque o TM carrega o retrato tardiamente; ler
    // `src` pega o gif de espera. Ela sempre esteve nesta mesma pagina, mas o
    // parser nao a extraia: os 348 clubes que eu acabei de recuperar entraram com
    // 5.576 atletas SEM NENHUMA foto, e o rosto teria de vir de outra passada.
    const foto = row.match(/data-src="(https:\/\/img\.a\.transfermarkt\.technology\/portrait\/[^"]+)"/)
      ?? row.match(/src="(https:\/\/img\.a\.transfermarkt\.technology\/portrait\/[^"]+)"/)
    out.push({
      tmId: link[1],
      nome,
      posicaoTM: pos[1],
      posicao: mapPos(pos[1]),
      nacionalidade: nac ? nac[1] : null,
      idade: idade ? Number(idade[1]) : null,
      ...(foto ? { foto: foto[1] } : {}),
    })
  }
  return out
}

async function main() {
  const seed = JSON.parse(await readFile(SEED, "utf8"))
  const teams = seed.teams ?? []
  const cache = existsSync(OUT) ? JSON.parse(await readFile(OUT, "utf8")) : { clubs: {}, updatedAt: null }

  // Refaz o que foi gravado por um parser antigo.
  //
  // ORDEM POR PRESTIGIO, e nao pela ordem do arquivo: o site so tolera ~1
  // requisicao a cada 2s (rajada leva bloqueio temporario), entao a importacao
  // completa leva horas e pode ser interrompida a qualquer momento. Comecando
  // pelos clubes de maior prestigio, uma corrida parcial ja conserta justamente
  // os elencos que o jogador enxerga — que e de onde vem o relato do "Cole
  // Palmer como goleiro". Deixar em ordem de arquivo gastaria as primeiras horas
  // em times de divisao estadual.
  // --retry-alias: reprocessa os clubes marcados como NAO ENCONTRADO que agora
  // tem alias (ver ALIAS_TM). Sem isto eles ficariam para sempre no cache como
  // vazios, porque a retomada normal so pega quem tem versao de parser antiga.
  const retryAlias = args.includes("--retry-alias")
  // --retry-tudo: retenta TODO clube marcado como nao encontrado, tenha alias ou
  // nao. O --retry-alias so alcanca quem ganhou apelido novo; este e para varrer
  // o acervo inteiro de uma vez. Boa parte vai falhar de novo e isso e esperado:
  // o pool tem entrada corrompida (nome de estadio, nome de pessoa) e time B,
  // que a validacao recusa de proposito.
  const retryTudo = args.includes("--retry-tudo")
  // --force: audita novamente TODOS os clubes, inclusive os que ja passaram
  // pelo parser atual. Usado antes de uma publicacao integral de elencos.
  const force = args.includes("--force")
  // --clube <texto>: so os clubes cujo nome contem o texto (varios por virgula).
  // A fila e ordenada por prestigio e tem clubes que voltam a cada rodada
  // (nome com espaco sobrando, razao social longa), entao um clube de prestigio
  // medio como o Atletico-MG nunca alcancava as primeiras posicoes: eu subia o
  // --limit e a vaga era tomada por Liverpool, Montpellier, Lille de novo.
  const filtroClube = args.includes("--clube")
    ? args[args.indexOf("--clube") + 1].toLowerCase().split(",").map(s => s.trim()).filter(Boolean)
    : null
  const pendentes = teams
    .filter(t => {
      if (filtroClube && !filtroClube.some(f => (t.nome ?? "").toLowerCase().includes(f))) return false
      const c = cache.clubs[chaveClube(t)]
      if (filtroClube) return true // pedido explicito refaz mesmo se ja tem cache
      if (force || (c?.v ?? 0) < PARSER_V) return true
      if (retryTudo && c?.naoEncontrado) return true
      if (retryAlias && c?.naoEncontrado && aliasTm(t.nome)) return true
      return false
    })
    .sort((a, b) => (b.prestigio ?? 0) - (a.prestigio ?? 0))
    .slice(0, limit)
  console.log(`${teams.length} clubes no seed | ${Object.keys(cache.clubs).length} já importados | processando ${pendentes.length}`)

  let ok = 0, semClube = 0, erro = 0, feitos = 0
  let sujo = false
  const t0 = Date.now()

  // Grava em intervalo, não a cada clube: com várias tarefas em paralelo,
  // reserializar 2.900 clubes a cada resposta custava mais que o download.
  const salvar = async () => {
    if (!sujo) return
    sujo = false
    cache.updatedAt = new Date().toISOString()
    await mkdir(path.dirname(OUT), { recursive: true })
    // Grava em temporário e RENOMEIA. writeFile direto trunca o arquivo antes de
    // escrever: uma interrupção no instante errado — ou só ler o arquivo enquanto
    // ele grava — devolve JSON pela metade. Num trabalho de horas, retomável, um
    // arquivo corrompido custaria tudo o que já foi baixado. rename é atômico.
    const tmp = `${OUT}.tmp`
    await writeFile(tmp, JSON.stringify(cache, null, 1))
    await rename(tmp, OUT)
  }
  const timerSalvar = setInterval(() => { salvar().catch(() => {}) }, 10_000)

  /**
   * Uma tarefa puxa clubes da fila comum. Concorrência baixa e delay mantido por
   * tarefa: o site continua vendo requisições espaçadas, só que intercaladas.
   * Se ele reclamar (429/403), TODAS recuam juntas — ser bloqueado no meio
   * perderia horas de download.
   */
  let proximo = 0
  let pausaAte = 0
  // Recuo PROGRESSIVO. A primeira versao parava todas as tarefas por 60s a cada
  // 429; como o recuo era global, um unico tropeco congelava a corrida inteira e
  // o ritmo caiu de ~30 para ~6 clubes/min. Agora comeca curto e so escala se o
  // site insistir — e volta ao normal no primeiro sucesso.
  let recuos = 0
  const respeitarPausa = async () => {
    const espera = pausaAte - Date.now()
    if (espera > 0) await sleep(espera)
  }
  const recuar = motivo => {
    recuos++
    const seg = Math.min(120, 8 * 2 ** (recuos - 1))
    pausaAte = Math.max(pausaAte, Date.now() + seg * 1000)
    console.log(`  ! ${motivo} — pausando ${seg}s (recuo ${recuos})`)
  }

  const buscar = async url => {
    await respeitarPausa()
    const res = await fetch(url, { headers: { "User-Agent": UA, "Accept-Language": "pt-BR,pt;q=0.9" } })
    if (res.status === 429 || res.status === 403) {
      recuar(`HTTP ${res.status}`)
      await respeitarPausa()
      return fetch(url, { headers: { "User-Agent": UA, "Accept-Language": "pt-BR,pt;q=0.9" } })
    }
    if (res.ok) recuos = 0
    return res
  }

  async function tarefa() {
    while (true) {
      const i = proximo++
      if (i >= pendentes.length) return
      const team = pendentes[i]
      try {
        // Nomes do elenco do seed: usados para desempatar clubes homonimos
        // (Botafogo RJ/SP/PB) pela sobreposicao de jogadores.
        const seedNames = (team.jogadores ?? []).map(j => j.nome)
        const achado = await findClubUrl(team.nome, team.pais, buscar, seedNames)
        if (args.includes("--verboso")) console.log(`   [${team.nome}] -> ${JSON.stringify(achado)}`)
        if (achado.falhou) {
          // Não grava nada: fica pendente e uma passada posterior tenta de novo.
          erro++
        } else if (achado.semClube) {
          // ⚠️ NUNCA TROCAR ELENCO BOM POR VAZIO.
          //
          // Esta linha, antes incondicional, e a origem do estrago de
          // 30/07/2026: 17 clubes que TINHAM elenco (Santa Cruz, Bangu,
          // Tenerife, Barnsley, Chester...) foram reprocessados, a busca falhou
          // naquele momento, e o registro bom virou `players: []`. O prejuizo so
          // aparece um build depois, quando o clube some do jogo — e a essa
          // altura ninguem liga uma coisa a outra. Eu mesmo repeti o erro hoje:
          // restaurei os 17 do backup e as rodadas seguintes zeraram tres de
          // novo. Busca que falha e evento transitorio; nao e prova de que o
          // clube deixou de existir.
          const chave = chaveClube(team)
          const tinha = cache.clubs[chave]?.players?.length ?? 0
          if (tinha > 0) {
            cache.clubs[chave] = { ...cache.clubs[chave], v: PARSER_V, buscaFalhouEm: new Date().toISOString() }
            console.log(`  ~ ${team.nome}: busca sem resultado, mantendo os ${tinha} atletas ja coletados`)
          } else {
            cache.clubs[chave] = { v: PARSER_V, curto: team.curto, nome: team.nome, players: [], naoEncontrado: true }
          }
          semClube++
        } else {
          await sleep(delayMs)
          const res = await buscar(achado.url)
          if (!res.ok) { erro++; feitos++; await sleep(delayMs); continue }
          const squad = parseSquad(await res.text())
          // Mesma trava do ramo de cima, para o outro jeito de perder dado: a
          // pagina responde 200 mas o parser nao acha ninguem (layout do TM
          // muda, pagina de clube extinto). Zero atleta NAO substitui elenco.
          const chave = chaveClube(team)
          const tinha = cache.clubs[chave]?.players?.length ?? 0
          if (squad.length === 0 && tinha > 0) {
            console.log(`  ~ ${team.nome}: pagina sem elenco, mantendo os ${tinha} atletas ja coletados`)
          } else {
            // ⚠️ PRESERVAR O VALOR DE MERCADO.
            //
            // `parseSquad` nao le valor — quem preenche e import-tm-values.mjs,
            // num segundo passe caro (uma requisicao por clube, horas). Trocar o
            // objeto do clube inteiro aqui APAGA `valor` e `valoresEm`, e o
            // clube volta para a fila daquele passe como se nunca tivesse sido
            // feito. Foi assim que 16 mil valores sumiram em 30/07/2026 e outros
            // 13 mil em 03/08 — nos dois casos o sintoma so apareceu depois, no
            // build, com clube inteiro achatado na mediana.
            const antigo = cache.clubs[chave]
            const valorPorId = new Map()
            for (const p of antigo?.players ?? []) if (p.valor != null) valorPorId.set(String(p.tmId), p.valor)
            let herdados = 0
            for (const p of squad) {
              const v = valorPorId.get(String(p.tmId))
              if (v != null) { p.valor = v; herdados++ }
            }
            cache.clubs[chave] = {
              v: PARSER_V, curto: team.curto, nome: team.nome, url: achado.url, players: squad,
              ...(antigo?.valoresEm && herdados > 0 ? { valoresEm: antigo.valoresEm } : {}),
            }
          }
          ok++
        }
      } catch {
        erro++ // idem: transitório, não vira registro definitivo
      }
      sujo = true
      feitos++
      if (feitos % 25 === 0) {
        const min = (Date.now() - t0) / 60000
        const restam = ((pendentes.length - feitos) / (feitos / min)).toFixed(0)
        console.log(`${feitos}/${pendentes.length} | ok ${ok} | s/clube ${semClube} | erro ${erro} | ~${restam} min restantes`)
      }
      await sleep(delayMs)
    }
  }

  await Promise.all(Array.from({ length: conc }, tarefa))
  clearInterval(timerSalvar)
  sujo = true
  await salvar()

  const totalAtletas = Object.values(cache.clubs).reduce((n, c) => n + (c.players?.length ?? 0), 0)
  console.log(`\nOK: ${ok} | clube não encontrado: ${semClube} | erro: ${erro}`)
  console.log(`Total acumulado: ${totalAtletas} atletas em ${Object.keys(cache.clubs).length} clubes`)
  console.log(`Tempo: ${((Date.now() - t0) / 60000).toFixed(1)} min`)
  console.log(`Arquivo: ${OUT}`)
}

if (process.argv[1]?.includes("import-tm-squads")) main()
