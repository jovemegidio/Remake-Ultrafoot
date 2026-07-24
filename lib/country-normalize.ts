// Normalização do país do clube.
//
// O campo `pais` do banco importado (data/seeds/imported-bf2026.json) tem 274
// valores distintos para ~195 países reais. Auditoria de 2026-07-20:
//
//   126 clubes brasileiros trazem a SIGLA DO ESTADO no lugar do país
//       (Nova Iguaçu = "RJ", Amazonas FC = "AM", Cruzeiro = "BR") — 1.200 atletas
//   códigos de país de 3 letras convivem com o nome por extenso
//       ("ALB" e "Albânia", "ARA" e "Arábia Saudita")
//   3 registros "Sem Contrato" (agentes livres) com lixo de parsing
//       no campo: "172", "B.O", "CG"
//
// Isso já quebrava o agrupamento por país do bf-loader: um mesmo país aparecia
// partido em várias entradas na seleção de ligas.
//
// ⚠️ ARMADILHA: as siglas de estado brasileiro COLIDEM com códigos de país.
// "SP" é São Paulo, NÃO Espanha. "AL" é Alagoas, não Albânia. "PR" é Paraná,
// não Porto Rico. "AM" é Amazonas, não Armênia. Por isso as UFs são resolvidas
// PRIMEIRO e explicitamente — um mapa genérico de siglas mandaria 126 clubes
// brasileiros para o país errado.

/** Siglas das 27 unidades federativas + "BR". Todas significam Brasil. */
const UF_BRASIL = new Set([
  "AC", "AL", "AM", "AP", "BA", "BR", "CE", "DF", "ES", "GO", "MA", "MG",
  "MS", "MT", "PA", "PB", "PE", "PI", "PR", "RJ", "RN", "RO", "RR", "RS",
  "SC", "SE", "SP", "TO",
])

/** Códigos de país que aparecem no banco, com o nome canônico correspondente. */
const CODIGO_PAIS: Record<string, string> = {
  AFS: "África do Sul",
  ALB: "Albânia",
  AND: "Andorra",
  ANG: "Angola",
  ARA: "Arábia Saudita",
  ARG: "Argentina",
  ARL: "Argélia",
  ARM: "Armênia",
  AZB: "Azerbaijão",
  AZE: "Azerbaijão",
  BIE: "Bielorrússia",
  BIH: "Bósnia e Herzegovina",
  BOS: "Bósnia e Herzegovina",
  BLZ: "Belize",
  BRN: "Brunei",
  BUL: "Bulgária",
  CAM: "Camarões",
  CAN: "Canadá",
  CHN: "China",
  CUB: "Cuba",
  FIJ: "Fiji",
  FIL: "Filipinas",
  GUI: "Guiné",
  HK: "Hong Kong",
  IDN: "Indonésia",
  ISR: "Israel",
  JAM: "Jamaica",
  KOR: "Coreia do Sul",
  LBN: "Líbano",
  LEB: "Líbano",
  LIE: "Liechtenstein",
  MAD: "Madagascar",
  RDC: "República Democrática do Congo",
  SIN: "Singapura",
  TAJ: "Tajiquistão",
  TAN: "Tanzânia",
  ETI: "Etiópia",
  BOT: "Botsuana",
  BRB: "Barbados",
  COS: "Costa Rica",
  CRN: "Croácia",
  UBZ: "Uzbequistão",
  UZB: "Uzbequistão",
  // Códigos que ainda vazavam (auditoria 2026-07-24). Só os de país INEQUÍVOCO;
  // os ambíguos/lixo caem no fallback -> "Indefinido" (melhor que país errado).
  AR: "Argentina",
  ENG: "Inglaterra",
  FR: "França",
  IT: "Itália",
  ITA: "Itália",
  GER: "Alemanha",
  DEN: "Dinamarca",
  FIN: "Finlândia",
  PL: "Polônia",
  POL: "Polônia",
  PT: "Portugal",
  SAU: "Arábia Saudita",
  IRL: "Irlanda",
  WAL: "País de Gales",
  GEO: "Geórgia",
  EST: "Estônia",
  ISL: "Islândia",
  LET: "Letônia",
  LIT: "Lituânia",
  // No banco, LIB sao os 4 clubes libios (Tripoli/Sirte/Benghazi, fileKey _lib),
  // nao Libano (esse e LBN/LEB). Sem isto, o Al-Nasr libio colidia com o
  // Al-Nasr de pais "NASR" (lixo) — ambos caíam em Indefinido.
  LIB: "Líbia",
  TUN: "Tunísia",
  UAE: "Emirados Árabes Unidos",
  CYP: "Chipre",
  MAL: "Malta",
  TCH: "Tchéquia",
  CZE: "Tchéquia",
  HUN: "Hungria",
  MLI: "Mali",
  SEN: "Senegal",
  ROM: "Romênia",
  MKD: "Macedônia do Norte",
  HRV: "Croácia",
  SLK: "Eslováquia",
  KGZ: "Quirguistão",
  IND: "Índia",
  IRN: "Irã",
  IRI: "Irã",
  IRA: "Irã",
  JOR: "Jordânia",
  SVN: "Eslovênia",
  VIE: "Vietnã",
  LUX: "Luxemburgo",
  KOS: "Kosovo",
  NZE: "Nova Zelândia",
  MOC: "Moçambique",
  MDA: "Moldávia",
  MOL: "Moldávia",
  SMR: "San Marino",
  CAZ: "Cazaquistão",
  CRC: "Costa Rica",
  HAI: "Haiti",
  HON: "Honduras",
  NCA: "Nicarágua",
  NIC: "Nicarágua",
  PAN: "Panamá",
  VAN: "Vanuatu",
  ZAM: "Zâmbia",
  UGA: "Uganda",
  HKG: "Hong Kong",
  NGA: "Nigéria",
  RDO: "República Dominicana",
  SIR: "Síria",
  FRO: "Ilhas Faroé",
  GIB: "Gibraltar",
  GUA: "Guatemala",
  ZIM: "Zimbábue",
  GHA: "Gana",
  MTN: "Mauritânia",
}

/** Nomes por extenso que aparecem com grafias diferentes. */
const ALIAS_NOME: Record<string, string> = {
  EUA: "Estados Unidos",
  "USA": "Estados Unidos",
  "Holanda": "Países Baixos",
  "Inglaterra": "Inglaterra",
}

/**
 * Valores que NÃO são país — lixo de parsing do importador. Aparecem nos
 * registros "Sem Contrato" (agentes livres, que não pertencem a país nenhum) e
 * em fragmentos de nome de clube.
 */
const NAO_E_PAIS = new Set(["172", "B.O", "ARUC", "FC", "EC", "AC.", "IEM", "ESK", "RDG", "NASR", "MIA", "SPORT", "MENEMENSPOR", "OPERARIOMT"])

/** País desconhecido — melhor do que atribuir um errado. */
export const PAIS_DESCONHECIDO = "Indefinido"

/**
 * Devolve o país canônico do clube.
 *
 * A ordem importa: UF brasileira ANTES de código de país, senão "SP" (São Paulo)
 * viraria Espanha e "AL" (Alagoas) viraria Albânia.
 */
export function normalizeCountry(raw: string | undefined | null): string {
  const valor = (raw ?? "").trim()
  if (!valor) return PAIS_DESCONHECIDO
  if (NAO_E_PAIS.has(valor)) return PAIS_DESCONHECIDO

  const upper = valor.toUpperCase()
  if (UF_BRASIL.has(upper)) return "Brasil"
  if (CODIGO_PAIS[upper]) return CODIGO_PAIS[upper]
  if (ALIAS_NOME[valor]) return ALIAS_NOME[valor]

  // FALLBACK: nenhum país de verdade tem nome de 1 a 3 letras. Se sobrou um
  // codigo curto que nao reconhecemos (sigla ambigua ou lixo de parsing como
  // "CG", "REP", "ELS"), vira Indefinido — melhor do que exibir a sigla crua ou
  // chutar um pais errado (ex.: "MON" poderia ser Monaco OU Montenegro).
  if (/^[A-Z0-9.]{1,3}$/.test(upper)) return PAIS_DESCONHECIDO

  // Nome por extenso já canônico (a grande maioria dos 2.391 clubes).
  return valor
}

/**
 * Nacionalidade INFERIDA de um atleta, a partir do país do clube.
 *
 * O banco importado não traz nacionalidade — os campos são
 * `id, nome, posicao, overall, idade, salario`. O país do clube é a única
 * pista disponível e é um palpite razoável (a maioria de qualquer elenco é
 * local), mas continua sendo INFERÊNCIA sobre pessoas reais.
 *
 * Por isso NÃO serve para regras que dependem de nacionalidade verdadeira —
 * limite de estrangeiros em campo, por exemplo. Para isso é preciso importar o
 * dado real de uma fonte (o Transfermarkt, já usado para escudos e fotos, tem).
 */
export function inferredNationality(clubCountry: string | undefined | null): string {
  return normalizeCountry(clubCountry)
}
