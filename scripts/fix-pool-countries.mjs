// Corrige o campo `pais` dos clubes do pool (imported-bf2026.json).
//
// O MESMO defeito que os 116 clubes brasileiros tinham, agora no resto do mundo:
// o CODIGO do arquivo foi parar no campo `pais`. Como a divisao do pool e
// derivada dele (`pool:<pais>`), o jogo passava a ter "ligas" chamadas IT, FR,
// ARA, CHN — separadas das ligas de verdade (Italia, Franca...). Pescara e a
// Juventus ficavam numa liga "IT" enquanto o resto da Serie A estava em "Italia".
//
// Cada codigo abaixo foi conferido pelo CLUBE que estava nele, um a um: ARL nao
// e "Arlanda", e Argelia (JS Saoura); LIB e Libia (Al-Nasr de Bengazi); TRT e
// Trinidad e Tobago (Defence Force). Codigo sem clube que o identifique fica
// como esta — o pool ja mostrou que chutar sai caro.
//
// Uso: node scripts/fix-pool-countries.mjs

import { readFile, writeFile } from "node:fs/promises"

const POOL = "data/seeds/imported-bf2026.json"

/** Codigo -> nome do pais na convencao ja usada no pool (portugues, por extenso). */
const PAISES = {
  EUA: "Estados Unidos", USA: "Estados Unidos", CHN: "China",
  IT: "Itália", ITA: "Itália", FR: "França", ENG: "Inglaterra", GER: "Alemanha",
  AR: "Argentina", ARG: "Argentina", PT: "Portugal", PL: "Polônia", POL: "Polônia",
  RU: "Rússia", ARA: "Arábia Saudita", SAU: "Arábia Saudita",
  BIE: "Bielorrússia", BUL: "Bulgária", ISR: "Israel", HUN: "Hungria",
  IRN: "Irã", IRA: "Irã", IRI: "Irã", TRT: "Trinidad e Tobago",
  UAE: "Emirados", TAI: "Tailândia", FIN: "Finlândia", IRL: "Irlanda",
  TUN: "Tunísia", AZB: "Azerbaijão", AZE: "Azerbaijão",
  COR: "Coreia do Sul", KOR: "Coreia do Sul", ROM: "Romênia",
  SLK: "Eslováquia", ELQ: "Eslováquia", IND: "Índia", KOS: "Kosovo",
  ARL: "Argélia", ARM: "Armênia", ALB: "Albânia", ISL: "Islândia",
  CAZ: "Cazaquistão", PAN: "Panamá", ZAM: "Zâmbia", MTA: "Malta",
  LIB: "Líbia", LET: "Letônia", AFS: "África do Sul", CHP: "Chipre", CYP: "Chipre",
  DEN: "Dinamarca", AND: "Andorra", SEN: "Senegal", MKD: "Macedônia do Norte",
  LIT: "Lituânia", LUX: "Luxemburgo", GEO: "Geórgia", EST: "Estônia",
  MON: "Montenegro", WAL: "País de Gales", MOL: "Moldávia", MDA: "Moldávia",
  FRO: "Ilhas Faroe", GIB: "Gibraltar", UZB: "Uzbequistão", UBZ: "Uzbequistão",
  CZE: "Tchéquia", TCH: "Tchéquia", REP: "Tchéquia",
  BIH: "Bósnia e Herzegovina", BOS: "Bósnia e Herzegovina", HRV: "Croácia",
  ANG: "Angola", CAN: "Canadá", SMR: "San Marino", ELS: "El Salvador",
  CAM: "Camarões", HAI: "Haiti", HON: "Honduras", VAN: "Vanuatu", NIC: "Nicarágua",
  ESL: "Eslovênia", ELV: "Eslovênia", SVN: "Eslovênia",
  SUD: "Sudão", JOR: "Jordânia", VIE: "Vietnã", BLZ: "Belize",
  PAP: "Papua-Nova Guiné", NZE: "Nova Zelândia", MOC: "Moçambique",
  CRC: "Costa Rica", COS: "Costa Rica", NCA: "Nova Caledônia", UGA: "Uganda",
  HKG: "Hong Kong", HK: "Hong Kong", RDO: "República Dominicana", SIR: "Síria",
  CON: "República Democrática do Congo", RDC: "República Democrática do Congo",
  RDG: "República Democrática do Congo",
  GUA: "Guatemala", ZIM: "Zimbábue", CMA: "Costa do Marfim", BRN: "Brunei",
  GHA: "Gana", MTN: "Mauritânia", MAL: "Malásia", MLI: "Mali",
  KGZ: "Quirguistão", SIN: "Singapura", LIE: "Liechtenstein",
  LBN: "Líbano", LEB: "Líbano", FIJ: "Fiji", JAM: "Jamaica", IEM: "Iêmen",
  FIL: "Filipinas", TAJ: "Tajiquistão", TAN: "Tanzânia", ETI: "Etiópia",
  // Conferidos pelo clube que estava em cada codigo:
  //   NGA/NIG -> Nasarawa, Plateau, Rivers, Enyimba (Nigeria)
  //   MAD -> CNaPS Sport (Madagascar)      BOT -> fileKey township_bot (Botsuana)
  //   CRN -> "25 Abril", o 4.25 SC (Coreia do Norte)
  //   ESK -> Trencin (Eslovaquia)
  NGA: "Nigéria", NIG: "Nigéria", MAD: "Madagascar", BOT: "Botsuana",
  CRN: "Coreia do Norte", ESK: "Eslováquia",
  GUI: "Guiné", IDN: "Indonésia", CUB: "Cuba", BRB: "Barbados", MIA: "Mianmar",
}

/**
 * Codigos que NAO sao pais: a sigla faz parte do nome do clube. Globo FC e de
 * Ceara-Mirim/RN e Uberlandia EC e de Minas — os dois estavam fora do Brasil.
 */
const NAO_E_PAIS = {
  globo_fc: { pais: "Brasil", estado: "RN" },
  uberlandia_ec: { pais: "Brasil", estado: "MG" },
  // Ganes arquivado como nigeriano na fonte — o codigo NIG esta certo para os
  // outros clubes dele, este e que estava na gaveta errada.
  asantekotoko_nig: { pais: "Gana" },
}

/** Sem clube que identifique o pais — melhor deixar como esta do que chutar. */
const SEM_CERTEZA = new Set(["CG", "B.O", "172", "FC", "EC"])

async function main() {
  const data = JSON.parse(await readFile(POOL, "utf8"))
  const teams = data.teams || data

  let corrigidos = 0
  let recolocados = 0
  const naoMapeados = new Map()
  const lixo = []

  for (const t of teams) {
    const fk = String(t.fileKey || "")
    if (NAO_E_PAIS[fk]) {
      Object.assign(t, NAO_E_PAIS[fk])
      recolocados++
      continue
    }

    const atual = String(t.pais || "")
    const ehPlaceholder = /sem contrato/i.test(String(t.nome || ""))
    const ehEstadio = /^est[aá]dio|^arena\b|^stadion\b/i.test(String(t.nome || ""))

    // Estas linhas NAO sao clubes — sao nome de estadio, ou o balde de agentes
    // livres. Mas guardam 340 atletas entre elas, entao APAGAR nao e opcao:
    // sumiria com jogador de verdade. O que da para fazer e impedir que a sigla
    // vaze como se fosse um pais, criando liga fantasma no jogo.
    if (ehPlaceholder) {
      lixo.push(`${t.nome} (${atual})`)
      if (t.pais !== "Indefinido") { t.pais = "Indefinido"; corrigidos++ }
      continue
    }
    if (ehEstadio) {
      lixo.push(`${t.nome} (${atual})`)
      const doMapa = PAISES[atual.toUpperCase()]
      if (doMapa && t.pais !== doMapa) { t.pais = doMapa; corrigidos++ }
      continue
    }

    const nome = PAISES[atual.toUpperCase()]
    if (!nome) {
      // So reporta o que parece codigo: nome por extenso ja esta certo.
      if (atual.length <= 3 && atual === atual.toUpperCase() && !SEM_CERTEZA.has(atual)) {
        naoMapeados.set(atual, (naoMapeados.get(atual) ?? 0) + 1)
      }
      continue
    }
    if (t.pais !== nome) { t.pais = nome; corrigidos++ }
  }

  await writeFile(POOL, JSON.stringify(data), "utf8")
  console.log(`clubes com pais corrigido: ${corrigidos}`)
  console.log(`clubes que nao eram estrangeiros (sigla no nome): ${recolocados}`)
  console.log(`linhas de lixo (placeholder/estadio): ${lixo.length}${lixo.length ? " -> " + lixo.join(", ") : ""}`)
  console.log(`codigos ainda sem mapa: ${naoMapeados.size}${naoMapeados.size ? " -> " + [...naoMapeados].map(([c, n]) => `${c}(${n})`).join(", ") : ""}`)
}

main().catch((e) => { console.error(e); process.exit(1) })
