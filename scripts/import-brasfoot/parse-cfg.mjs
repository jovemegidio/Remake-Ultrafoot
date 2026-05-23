/**
 * Parses Brasfoot .cfg (national league) and .ces (state competition) files.
 * Both are Java-serialized; extracts league/division names from TC_STRING entries.
 */

import { readFileSync } from "fs"
import { basename } from "path"

function extractStrings(buf) {
  const results = []
  let i = 0
  while (i < buf.length - 3) {
    if (buf[i] === 0x74) {
      const len = (buf[i + 1] << 8) | buf[i + 2]
      if (len > 0 && len < 128 && i + 3 + len <= buf.length) {
        try {
          const value = new TextDecoder("utf-8").decode(buf.subarray(i + 3, i + 3 + len))
          if (value.trim().length > 2 && !/^[a-z]\.[a-z]$/.test(value) && !/^[a-z]{1,4}$/.test(value)) {
            results.push(value.trim())
          }
        } catch { /* skip */ }
        i += 3 + len
        continue
      }
    }
    i++
  }
  return results
}

/** Parses a national league .cfg file */
export function parseCfg(filePath) {
  const countryCode = basename(filePath, ".cfg")
  let buf
  try { buf = readFileSync(filePath) } catch { return null }
  if (buf[0] !== 0xAC || buf[1] !== 0xED) return null

  const strings = extractStrings(buf)
  // Strings appear in pairs: [leagueName, divisionName, leagueName2, divisionName2, ...]
  // Filter out Java-internal strings
  const meaningful = strings.filter(s =>
    !s.startsWith("L") && !s.startsWith("[") && !s.startsWith("java") &&
    !["duasVoltasMataMataSobe", "duasVoltasMataMataSobeq", "duasVoltasplayoffRebq"].includes(s)
  )

  const divisions = []
  for (let i = 0; i + 1 < meaningful.length; i += 2) {
    divisions.push({
      nome: meaningful[i],
      divisao: meaningful[i + 1],
    })
  }

  return { countryCode, divisions }
}

/** Parses a state .ces file */
export function parseCes(filePath) {
  const stateCode = basename(filePath, ".ces")
  let buf
  try { buf = readFileSync(filePath) } catch { return null }
  if (buf[0] !== 0xAC || buf[1] !== 0xED) return null

  const strings = extractStrings(buf)
  return {
    stateCode,
    nome: strings[0] ?? `Campeonato ${stateCode}`,
  }
}
