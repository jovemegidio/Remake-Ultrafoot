// Assa os dados do Transfermarkt (tm-squads.json) dentro do seed principal.
//
// Por que assar no seed em vez de consultar em runtime: o seed já é a fonte de
// verdade de TODA tela (elenco, mercado, partida, olheiros). Corrigindo lá, as
// telas herdam a posição e a nacionalidade certas sem nenhuma delas precisar
// saber que o Transfermarkt existe — e sem carregar um segundo JSON no bundle.
//
//   node scripts/import-tm-squads.mjs   (baixa; ~2h, retomável)
//   node scripts/apply-tm-squads.mjs    (aplica; segundos)
//
// Idempotente: rodar duas vezes dá o mesmo resultado.

import { readFile, writeFile, copyFile } from "node:fs/promises"
import { existsSync } from "node:fs"
import path from "node:path"

const SEED = path.resolve("data/seeds/imported-bf2026.json")
const TM = path.resolve("data/seeds/tm-squads.json")
const BACKUP = path.resolve("data/seeds/imported-bf2026.pre-tm.json")

const nameKey = s => (s || "")
  .normalize("NFD").replace(/[̀-ͯ]/g, "")
  .toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()

/**
 * Só nome IDÊNTICO dentro do mesmo clube. O casamento por sobrenome, que eu
 * tinha antes, rendia +15% de acertos e não vale o risco: se o clube tiver sido
 * casado errado lá no importador, "Silva" bate com "Silva" e a gente escreve a
 * posição de um atleta em cima de outro — que é justamente o defeito que este
 * trabalho existe para corrigir.
 */
function buildIndex(players) {
  const exato = new Map()
  for (const p of players) {
    const k = nameKey(p.nome)
    if (k && !exato.has(k)) exato.set(k, p)
  }
  return exato
}

/**
 * Quanto do elenco do seed aparece no elenco do TM.
 *
 * É a validação mais útil que existe aqui, porque usa dado que já temos: se o
 * importador casou o clube errado, os nomes simplesmente não se encontram.
 * "Barcelona Guayaquil" recebeu o FC Barcelona da Espanha e ficou com 0% de
 * sobreposição; "Fortuna Sittard" recebeu o Fortuna Düsseldorf, idem. Abaixo do
 * piso, ignoramos o clube inteiro em vez de confiar em coincidência de nome.
 */
// 5% e no MÍNIMO 2 atletas casados. Medi 20/10/5/2/0%: descer de 20% para 5%
// recupera 268 clubes e 722 atletas, e abaixo de 5% não há mais ganho nenhum —
// quem limita é a regra dos 2. E é ela a proteção que importa: um clube casado
// errado pode colidir em UM nome por acaso, dificilmente em dois.
//
// O piso alto de 20% estava jogando fora correção boa: Fénix, Orense, Sturm
// Graz e Cercle Brugge foram casados CERTO; a sobreposição é baixa porque o
// elenco no seed é fictício, não porque o clube esteja errado.
const PISO_SOBREPOSICAO = 0.05
const MIN_CASADOS = 2
/** Só vincula foto, sem tocar em posição, nacionalidade ou elenco. */
const SO_FOTOS = process.argv.includes("--so-fotos")
/**
 * Mostra o que faria e NÃO grava.
 *
 * Trocar elenco fictício por elenco real mexe em dado de jogo de ~1.200 clubes de
 * uma vez, e a armadilha de clube homônimo (Botafogo RJ/SP/PB, Barcelona
 * ESP/Guayaquil) já casou clube errado antes. Ver a lista antes de gravar é
 * barato; descobrir depois que o Botafogo-PB recebeu o elenco do RJ, não.
 */
const SIMULAR = process.argv.includes("--simular")

/**
 * Referência COMPACTA da foto do Transfermarkt ("371247-1780359299"), ou "" se
 * não há foto de verdade.
 *
 * ⚠️ ISTO JÁ CUSTOU 8.622 ROSTOS. A regex antiga exigia `.jpg` e o TM serve muita
 * foto como `.png` (7.693 delas) e algumas com outras extensões (929): todas eram
 * descartadas em silêncio, e o atleta ficava sem rosto sem ninguém saber por quê.
 *
 * A extensão fica GUARDADA quando não é jpg (`"275412-1771071867.png"`), porque
 * `lib/player-photos.ts` remonta a URL — sem isso o link daria 404. Token sem
 * ponto continua significando jpg, para não invalidar o que já está gravado.
 *
 * `default` é o placeholder do próprio TM (silhueta cinza): pior que não ter foto,
 * porque o jogo mostraria um vazio em vez de cair nas iniciais do atleta.
 */
function fichaDaFoto(url) {
  const u = String(url ?? "")
  if (!u || /default/i.test(u)) return ""
  const m = /portrait\/\w+\/([\d-]+)\.(jpg|jpeg|png|webp)/i.exec(u)
  if (!m) return ""
  return m[2].toLowerCase() === "jpg" ? m[1] : `${m[1]}.${m[2].toLowerCase()}`
}

function sobreposicao(jogadores, idx) {
  if (!jogadores?.length) return { pct: 0, hit: 0 }
  let hit = 0
  for (const j of jogadores) if (idx.has(nameKey(j.nome))) hit++
  return { pct: hit / jogadores.length, hit }
}

// ── Elenco DESATUALIZADO x clube casado errado ─────────────────────────────
//
// A trava de sobreposicao nao sabia distinguir as duas coisas. Wigan casou com
// wigan-athletic (certo!) e mesmo assim foi rejeitado: o seed tem o elenco de
// ~2019 (David Marshall, Antonee Robinson) e o TM tem o de hoje. Eram 1.236
// clubes assim — com URL certa e elenco velho, ficando fictícios no jogo.
//
// Confianca vem do SLUG da URL do TM contra o nome do clube no jogo. Slug
// batendo = clube certo; ai o elenco do TM (atual) SUBSTITUI o do seed.

/** Tokens uteis do nome de um clube (tira siglas e ruido). */
function tokensClube(s) {
  const RUIDO = new Set(["fc", "cf", "sc", "ec", "ca", "cr", "ac", "se", "afc", "ud", "cd", "club", "clube",
    "futebol", "football", "futbol", "calcio", "de", "do", "da", "dos", "das", "the", "1", "sport"])
  return new Set(
    (s || "").normalize("NFD").replace(/[̀-ͯ]/g, "")
      .toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().split(" ")
      .filter(w => w.length > 2 && !RUIDO.has(w)),
  )
}

/** O slug do TM confirma que e este clube? */
function casamentoConfiavel(nomeJogo, url) {
  const slug = (url || "").split("/")[3] ?? ""
  if (!slug) return false
  const a = tokensClube(nomeJogo)
  const b = tokensClube(slug.replace(/-/g, " "))
  if (a.size === 0 || b.size === 0) return false
  let comuns = 0
  for (const t of a) if (b.has(t)) comuns++
  // Todo token distintivo do nome do jogo aparece no slug (ex.: "wigan" em
  // "wigan-athletic", "cercle"+"brugge" em "cercle-brugge").
  return comuns === a.size || (comuns >= 2 && comuns / a.size >= 0.6)
}

/**
 * Converte o elenco do TM em atletas do seed, derivando o OVERALL do valor de
 * mercado e ancorando na forca atual do clube — o clube nao fica mais forte nem
 * mais fraco do que era, mas passa a ter os jogadores CERTOS.
 */
function elencoDoTm(playersTm, jogadoresSeed) {
  const basesAntigas = (jogadoresSeed ?? []).map(j => j.overall).filter(Number.isFinite)
  const media = basesAntigas.length ? basesAntigas.reduce((a, b) => a + b, 0) / basesAntigas.length : 62
  // Faixa do elenco. O seed antigo as vezes vem COMPRIMIDO (todo mundo entre 82
  // e 84), e ancorar so nele achataria o elenco novo — o quarto goleiro saia com
  // o mesmo overall do craque. Garantimos uma amplitude minima de 20 pontos.
  const teto = Math.max(basesAntigas.length ? Math.max(...basesAntigas) : media + 8, Math.round(media) + 8)
  const piso = Math.min(basesAntigas.length ? Math.min(...basesAntigas) : media - 8, teto - 20)
  const maxAntigo = teto
  const minAntigo = piso

  // Ordena por valor de mercado: o mais caro vira o melhor do elenco.
  const ordenados = [...playersTm].sort((a, b) => (b.valor ?? 0) - (a.valor ?? 0))
  const n = Math.max(1, ordenados.length - 1)
  return ordenados.map((p, i) => {
    // Distribui do teto antigo ao piso antigo, seguindo o ranking de valor.
    const overall = Math.round(maxAntigo - (i / n) * (maxAntigo - minAntigo))
    const foto = fichaDaFoto(p.foto)
    return {
      id: `tm_${p.tmId ?? i}`,
      nome: p.nome,
      posicao: p.posicao,
      overall,
      idade: p.idade ?? 25,
      salario: Math.round(overall * 800),
      nac: p.nacionalidade || undefined,
      ...(foto ? { ft: foto } : {}),
    }
  })
}

async function main() {
  if (!existsSync(TM)) {
    console.error("Falta data/seeds/tm-squads.json — rode antes: node scripts/import-tm-squads.mjs")
    process.exit(1)
  }
  const tm = JSON.parse(await readFile(TM, "utf8"))
  const seed = JSON.parse(await readFile(SEED, "utf8"))

  if (!existsSync(BACKUP)) await copyFile(SEED, BACKUP)

  let clubesComDados = 0, clubesRejeitados = 0, atletas = 0
  let posCorrigida = 0, nacDefinida = 0, fotoDefinida = 0, semMatch = 0
  const mudancasPos = []
  const rejeitados = []
  let elencosSubstituidos = 0, atletasSubstituidos = 0
  const substituidos = []

  for (const team of seed.teams ?? []) {
    const club = tm.clubs?.[`${team.curto}|${nameKey(team.nome)}`]
    if (!club?.players?.length) continue
    const idx = buildIndex(club.players)

    // SLUG CONFIAVEL => o elenco do TM (atual e completo) SUBSTITUI o do seed,
    // independentemente da sobreposicao.
    //
    // A regra antiga so substituia quando a sobreposicao era BAIXA, e isso
    // deixava o pior caso de fora: o Bayern casava alguns nomes reais (Neuer,
    // Upamecano), entrava no caminho de "correcao" e MANTINHA os fictícios do
    // seed — o elenco ficava com "Atacante BAY 3" ao lado do Neuer. Corrigir so
    // conserta quem ja esta la; nao traz Kane nem tira o placeholder.
    // Com --so-fotos ninguem troca de elenco: a passada e só para vincular rosto,
    // e substituir jogadores aqui mexeria em dado de jogo que ninguem pediu.
    if (!SO_FOTOS && casamentoConfiavel(team.nome, club.url) && club.players.length >= 11) {
      const antes = team.jogadores?.length ?? 0
      team.jogadores = elencoDoTm(club.players, team.jogadores)
      elencosSubstituidos++
      atletasSubstituidos += team.jogadores.length
      substituidos.push(`${team.nome}: ${antes} -> ${team.jogadores.length} atletas (${club.url?.split("/")[3]})`)
      continue
    }

    const { pct, hit } = sobreposicao(team.jogadores, idx)
    if (pct < PISO_SOBREPOSICAO || hit < MIN_CASADOS) {
      clubesRejeitados++
      rejeitados.push(`${team.nome} (${(pct * 100).toFixed(0)}%, ${hit} casados) <- ${club.url?.split("/")[3] ?? "?"}`)
      continue
    }
    clubesComDados++

    for (const jog of team.jogadores ?? []) {
      atletas++
      const real = idx.get(nameKey(jog.nome))
      if (!real) { semMatch++; continue }

      if (!SO_FOTOS && real.posicao && real.posicao !== jog.posicao) {
        mudancasPos.push(`${team.curto} ${jog.nome}: ${jog.posicao} -> ${real.posicao}`)
        jog.posicao = real.posicao
        posCorrigida++
      }
      if (!SO_FOTOS && real.nacionalidade && jog.nac !== real.nacionalidade) {
        jog.nac = real.nacionalidade
        nacDefinida++
      }
      // Referencia da foto em forma COMPACTA ("371247-1780359299"), nao a URL
      // inteira: 20 bytes em vez de ~90 por atleta. A URL e reconstruida em
      // lib/player-photos.ts. So o miolo varia; repetir o prefixo 30 mil vezes
      // so incharia o seed que viaja no bundle.
      const ficha = fichaDaFoto(real.foto)
      if (ficha && jog.ft !== ficha) { jog.ft = ficha; fotoDefinida++ }
    }
  }

  if (!SIMULAR) {
    seed.tmAppliedAt = new Date().toISOString()
    await writeFile(SEED, JSON.stringify(seed))
  }

  if (SIMULAR) console.log("SIMULACAO — nada foi gravado.\n")
  console.log(`clubes aceitos (correcao): ${clubesComDados}`)
  console.log(`elencos SUBSTITUIDOS     : ${elencosSubstituidos} (${atletasSubstituidos} atletas — seed desatualizado x elenco atual do TM)`)
  console.log(`clubes REJEITADOS       : ${clubesRejeitados} (sobreposição < ${PISO_SOBREPOSICAO * 100}%: clube provavelmente casado errado)`)
  console.log(`atletas nos aceitos     : ${atletas}`)
  console.log(`  posição corrigida     : ${posCorrigida}`)
  console.log(`  nacionalidade real    : ${nacDefinida}`)
  console.log(`  foto vinculada        : ${fotoDefinida}`)
  console.log(`  sem correspondência   : ${semMatch} (mantêm o que já tinham)`)
  console.log(`\nbackup do original: ${path.basename(BACKUP)}`)
  console.log(`\namostra de clubes rejeitados:`)
  for (const r of rejeitados.slice(0, 12)) console.log("  " + r)
  console.log(`\namostra de correções de posição:`)
  for (const m of mudancasPos.slice(0, 20)) console.log("  " + m)
}

main()
