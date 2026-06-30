/**
 * Parses Brasfoot .ban files (Java object serialization).
 * Extracts team metadata (colors, name, stadium, manager) and player names
 * by scanning for TC_STRING (0x74) markers in the binary stream.
 *
 * Structure per file:
 *   class descriptor (team) → primitives → [cor1, cor2, fileKey, name, stadium, manager] strings → ArrayList → player objects
 * Each player: primitives (46 bytes) → TC_STRING name
 */

import { readFileSync } from "fs"
import { basename } from "path"

/** Country code → country name map (Brasfoot suffix conventions) */
const COUNTRY_MAP = {
  bra: "Brasil",     arg: "Argentina",  bol: "Bolívia",   chi: "Chile",
  col: "Colômbia",   equ: "Equador",    par: "Paraguai",  per: "Peru",
  uru: "Uruguai",    ven: "Venezuela",  bra2: "Brasil",
  ing: "Inglaterra", esp: "Espanha",    ale: "Alemanha",  ita: "Itália",
  fra: "França",     por: "Portugal",   hol: "Holanda",   bel: "Bélgica",
  tur: "Turquia",    rus: "Rússia",     ucr: "Ucrânia",   cro: "Croácia",
  ser: "Sérvia",     gre: "Grécia",     sue: "Suécia",    nor: "Noruega",
  sui: "Suíça",      aut: "Áustria",    din: "Dinamarca", esc: "Escócia",
  eua: "EUA",        mex: "México",     jap: "Japão",     chi2: "China",
  aus: "Austrália",  mar: "Marrocos",   egi: "Egito",     afs: "África do Sul",
  afg: "Afeganistão", emi: "Emirados",  cat: "Catar",     ars: "Arábia Saudita",
  ind: "Índia",      ira: "Irã",        isr: "Israel",    cor: "Coreia do Sul",
}

/**
 * Extracts all TC_STRING (0x74) values from a Java serialized binary buffer.
 * Returns [{offset, value}] in order of appearance.
 */
function extractAllStrings(buf) {
  const results = []
  let i = 0
  while (i < buf.length - 3) {
    if (buf[i] === 0x74) {
      const len = (buf[i + 1] << 8) | buf[i + 2]
      if (len > 0 && len < 256 && i + 3 + len <= buf.length) {
        const raw = buf.subarray(i + 3, i + 3 + len)
        try {
          const value = new TextDecoder("utf-8").decode(raw)
          // Only keep printable strings with meaningful content
          if (/^[\x20-\x7EÀ-ɏ-¿Ā-ɏ]+$/.test(value) && value.trim().length > 0) {
            results.push({ offset: i, value })
          }
        } catch { /* skip invalid utf-8 */ }
        i += 3 + len
        continue
      }
    }
    i++
  }
  return results
}

/**
 * Identifies which strings are class descriptor strings vs data strings.
 * Class descriptor strings match Java identifiers, class paths, or type signatures.
 */
function isDescriptorString(s) {
  return (
    /^[a-z]\.[a-z]$/.test(s) ||            // class names like "e.t", "e.g"
    /^[a-z]{1,5}$/.test(s) ||              // field names: a, b, aid, cor1, etc.
    s.startsWith("L") ||                    // type descriptors: Ljava/lang/String;
    s.startsWith("[") ||                    // array type: [Z, [I
    s === "java.util.ArrayList" ||
    /^java[./]/.test(s)
  )
}

/**
 * Parses a single .ban file and returns team data.
 * Returns null if the file can't be parsed.
 */
export function parseBan(filePath) {
  let buf
  try {
    buf = readFileSync(filePath)
  } catch {
    return null
  }

  // Verify Java serialization magic: AC ED 00 05
  if (buf[0] !== 0xAC || buf[1] !== 0xED || buf[2] !== 0x00 || buf[3] !== 0x05) {
    return null
  }

  const all = extractAllStrings(buf)
  const data = all.filter(s => !isDescriptorString(s.value))

  if (data.length < 4) return null

  // Data strings appear in order: cor1, cor2, fileKey, nome, estadio, tecnico, [player names...]
  const [cor1Entry, cor2Entry, fileKeyEntry, nomeEntry, estadioEntry, tecnicoEntry, ...playerEntries] = data

  const fileKey = basename(filePath, ".ban")
  const countryCode = fileKey.split("_").pop() ?? ""
  const country = COUNTRY_MAP[countryCode] ?? countryCode.toUpperCase()

  // Colors come with # prefix from Brasfoot (e.g., "#ffffff")
  const cor1 = (cor1Entry?.value ?? "#1a1a2e").replace(/^#/, "")
  const cor2 = (cor2Entry?.value ?? "#16213e").replace(/^#/, "")

  // fileKey string from BAN should match the filename
  const resolvedKey = fileKeyEntry?.value ?? fileKey

  // Player names: each TC_STRING that isn't one of the first 6 metadata strings
  // Filter out any that look like class descriptors that slipped through
  const players = playerEntries
    .filter(e => {
      const v = e.value
      return v.includes(" ") || v.length > 8  // names have spaces or are long
    })
    .map(e => e.value.trim())
    .filter((v, i, arr) => arr.indexOf(v) === i)  // deduplicate

  return {
    fileKey: resolvedKey,
    nome: nomeEntry?.value?.trim() ?? resolvedKey,
    cor1: `#${cor1}`,
    cor2: `#${cor2}`,
    estadio: estadioEntry?.value?.trim() ?? "",
    tecnico: tecnicoEntry?.value?.trim() ?? "",
    pais: country,
    countryCode,
    players,
    source: "ban",
  }
}
