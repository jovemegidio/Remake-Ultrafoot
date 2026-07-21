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
const PARSER_V = 2

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
async function findClubUrl(clubName, clubCountry, buscar, seedNames) {
  // Segunda chance com o nome encurtado: a busca do TM é bem literal e não acha
  // "Racing Montevideo" (lá é "Racing Club de Montevideo") nem "Barcelona
  // Guayaquil" (é "Barcelona SC Guayaquil"). Tirando o qualificador final, acha.
  //
  // Só que encurtar joga fora justamente a palavra que DISTINGUE: na primeira
  // versão "Juventus Jaraguá" (SC) casou com o "Clube Atlético Juventus" (SP) —
  // mesmo país, nome curto único, tudo "válido". Por isso a tentativa curta
  // exige que o candidato ainda contenha a palavra descartada.
  const palavras = clubName.trim().split(/\s+/)
  const tentativas = [{ termo: clubName, exigir: null }]
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
  const distintos = [...new Map(plausiveis.map(c => [c.href, c])).values()]
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
    out.push({
      tmId: link[1],
      nome,
      posicaoTM: pos[1],
      posicao: mapPos(pos[1]),
      nacionalidade: nac ? nac[1] : null,
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
  const pendentes = teams
    .filter(t => (cache.clubs[chaveClube(t)]?.v ?? 0) < PARSER_V)
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
        if (achado.falhou) {
          // Não grava nada: fica pendente e uma passada posterior tenta de novo.
          erro++
        } else if (achado.semClube) {
          cache.clubs[chaveClube(team)] = { v: PARSER_V, curto: team.curto, nome: team.nome, players: [], naoEncontrado: true }
          semClube++
        } else {
          await sleep(delayMs)
          const res = await buscar(achado.url)
          if (!res.ok) { erro++; feitos++; await sleep(delayMs); continue }
          const squad = parseSquad(await res.text())
          cache.clubs[chaveClube(team)] = { v: PARSER_V, curto: team.curto, nome: team.nome, url: achado.url, players: squad }
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
