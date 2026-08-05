/**
 * QUEM CARREGA QUAL ARQUIVO DE TRADUÇÃO.
 *
 * Os idiomas são agrupados por família porque 128 arquivos separados custariam
 * 128 pedaços de JavaScript no build — e o ganho seria zero: quem fala catalão
 * dificilmente troca para occitano no meio da sessão, e o grupo inteiro pesa
 * poucos kilobytes.
 *
 * Idioma listado em `idiomas.ts` sem entrada aqui NÃO é erro: ele aparece no
 * seletor e cai na reserva (inglês → português). É assim que um idioma novo
 * entra em etapas, sem esperar a tradução ficar completa.
 */

import type { PacoteDeIdioma } from "./catalogo"

type Grupo =
  | "ocidente"
  | "germanico"
  | "eslavo"
  | "europa"
  | "orienteMedio"
  | "asiaCentral"
  | "asiaSul"
  | "asiaSudeste"
  | "asiaLeste"
  | "africa"
  | "americas"

const CARREGADORES: Record<Grupo, () => Promise<{ default: Record<string, PacoteDeIdioma> }>> = {
  ocidente: () => import("./textos/ocidente"),
  germanico: () => import("./textos/germanico"),
  eslavo: () => import("./textos/eslavo"),
  europa: () => import("./textos/europa"),
  orienteMedio: () => import("./textos/oriente-medio"),
  asiaCentral: () => import("./textos/asia-central"),
  asiaSul: () => import("./textos/asia-sul"),
  asiaSudeste: () => import("./textos/asia-sudeste"),
  asiaLeste: () => import("./textos/asia-leste"),
  africa: () => import("./textos/africa"),
  americas: () => import("./textos/americas"),
}

const GRUPO_DO_IDIOMA: Record<string, Grupo> = {
  // ocidente
  en: "ocidente", "en-GB": "ocidente",
  es: "ocidente", "es-MX": "ocidente", "es-AR": "ocidente",
  pt: "ocidente", gl: "ocidente", fr: "ocidente", it: "ocidente",
  nl: "ocidente", ca: "ocidente",
  // germânico e nórdico
  de: "germanico", sv: "germanico", da: "germanico", nb: "germanico", nn: "germanico",
  fi: "germanico", is: "germanico", fo: "germanico", af: "germanico", lb: "germanico",
  // eslavo
  ru: "eslavo", uk: "eslavo", be: "eslavo", pl: "eslavo", cs: "eslavo", sk: "eslavo",
  sl: "eslavo", hr: "eslavo", sr: "eslavo", bs: "eslavo", mk: "eslavo", bg: "eslavo",
  // resto da Europa
  el: "europa", ro: "europa", hu: "europa", sq: "europa", et: "europa", lv: "europa",
  lt: "europa", mt: "europa", cy: "europa", ga: "europa", gd: "europa", eu: "europa",
  ast: "europa", oc: "europa", co: "europa", br: "europa", eo: "europa", la: "europa",
  // Oriente Médio e Turquia
  ar: "orienteMedio", he: "orienteMedio", fa: "orienteMedio", ur: "orienteMedio",
  ps: "orienteMedio", ckb: "orienteMedio", ku: "orienteMedio", sd: "orienteMedio",
  tr: "orienteMedio", az: "orienteMedio",
  // Ásia central e Cáucaso
  kk: "asiaCentral", ky: "asiaCentral", uz: "asiaCentral", tg: "asiaCentral",
  tk: "asiaCentral", tt: "asiaCentral", ba: "asiaCentral", cv: "asiaCentral",
  mn: "asiaCentral", ka: "asiaCentral", hy: "asiaCentral",
  // sul da Ásia
  hi: "asiaSul", bn: "asiaSul", pa: "asiaSul", gu: "asiaSul", mr: "asiaSul",
  ta: "asiaSul", te: "asiaSul", kn: "asiaSul", ml: "asiaSul", or: "asiaSul",
  as: "asiaSul", ne: "asiaSul", si: "asiaSul",
  // sudeste asiático
  id: "asiaSudeste", ms: "asiaSudeste", jv: "asiaSudeste", su: "asiaSudeste",
  tl: "asiaSudeste", ceb: "asiaSudeste", vi: "asiaSudeste", th: "asiaSudeste",
  lo: "asiaSudeste", km: "asiaSudeste", my: "asiaSudeste",
  // leste asiático
  "zh-CN": "asiaLeste", "zh-TW": "asiaLeste", yue: "asiaLeste", ja: "asiaLeste", ko: "asiaLeste",
  // África
  sw: "africa", am: "africa", ti: "africa", so: "africa", ha: "africa", yo: "africa",
  ig: "africa", zu: "africa", xh: "africa", st: "africa", sn: "africa", rw: "africa",
  ny: "africa", mg: "africa", wo: "africa",
  // Américas e Pacífico
  ht: "americas", qu: "americas", gn: "americas", ay: "americas", mi: "americas",
  haw: "americas", sm: "americas", to: "americas", fj: "americas",
}

// Um grupo já carregado não volta para a rede/disco: trocar de idioma e voltar
// é instantâneo.
const cache = new Map<Grupo, Record<string, PacoteDeIdioma>>()

export async function carregarPacote(codigo: string): Promise<PacoteDeIdioma> {
  const grupo = GRUPO_DO_IDIOMA[codigo]
  if (!grupo) return {}
  try {
    let conteudo = cache.get(grupo)
    if (!conteudo) {
      conteudo = (await CARREGADORES[grupo]()).default
      cache.set(grupo, conteudo)
    }
    return conteudo[codigo] ?? {}
  } catch {
    // Pacote com erro não pode derrubar a tela: o launcher segue em português.
    return {}
  }
}

/** Idiomas que têm alguma tradução publicada (para marcar no seletor). */
export function temTraducao(codigo: string): boolean {
  return codigo === "pt-BR" || codigo in GRUPO_DO_IDIOMA
}
