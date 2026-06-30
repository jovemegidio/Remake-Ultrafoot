/**
 * Java Object Serialization string extractor for .ban files
 * Protocol: AC ED 00 05 (magic), then stream of type descriptors and values.
 * Strings in Java serialization: 0x74 (TC_STRING) + 2-byte big-endian length + UTF-8 bytes
 */
const fs = require('fs');
const path = require('path');

/**
 * Extract all Java-serialized strings from a buffer.
 * Returns them in order, which matches the class field declaration order.
 */
function extractStrings(buf) {
  const strings = [];
  let i = 0;
  while (i < buf.length - 2) {
    // 0x74 = TC_STRING in Java serialization
    if (buf[i] === 0x74) {
      const len = (buf[i + 1] << 8) | buf[i + 2];
      if (len > 0 && len < 512 && i + 3 + len <= buf.length) {
        const str = buf.slice(i + 3, i + 3 + len).toString('utf8');
        // Only keep printable strings (no control chars)
        if (/^[\x20-\x7EÀ-ɏ -ÿ -⁯ ]+$/.test(str) && str.trim().length > 0) {
          strings.push({ offset: i, value: str });
        }
        i += 3 + len;
        continue;
      }
    }
    i++;
  }
  return strings;
}

/**
 * Parse a .ban file and return structured team data.
 * The Java class `e.t` has fields in this order (from field name declarations in stream):
 * class fields come first as metadata, then actual string values follow.
 *
 * From analysis of multiple .ban files, the string values appear in this order:
 * [0] cor1 (hex color, e.g., "ffffff")
 * [1] cor2 (hex color, e.g., "990000")
 * [2] file_key (e.g., "salzburg_aut")
 * [3] team_name (e.g., "RB Salzburg")
 * [4] stadium (e.g., "MP Austria")
 * [5] manager (e.g., "Matthias Jaissle")
 * [6+] player names
 */
function parseBanFile(filePath) {
  const buf = fs.readFileSync(filePath);
  const allStrings = extractStrings(buf);

  // Filter out Java class/field metadata strings
  // Filter out Java class reference strings (start with 'L', contain '/', end with ';')
  function isJavaClassRef(s) {
    return /^[LQ\[]\w/.test(s) || s.includes('/') || s.endsWith(';');
  }

  const JAVA_METADATA = new Set([
    'e.t', 'e.g', 'est.ArrayLigaType', 'est.ConfigLigaType',
    'java.util.ArrayList', 'java.lang.String', 'Ljava', 'lang',
    'util', 'aidI', 'idI', 'sidI', 'tidZ', 'validI', 'vidL',
    'cor1t', 'cor2q', 'hashI', 'xp', 'sr', 'sizexp',
    'Ljava/lang/String', 'Ljava/util/ArrayList',
    'Ljava/lang/String;', 'Ljava/util/ArrayList;',
    // field name strings from class descriptor
    'aid', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'l', 'm', 'n', 'o',
    'hash', 'sid', 'tid', 'vid', 'valid', 'cor1', 'cor2', 'id',
  ]);

  const values = allStrings
    .map(s => s.value)
    .filter(v => !JAVA_METADATA.has(v))
    .filter(v => !isJavaClassRef(v))
    .filter(v => v.length >= 2);

  // Remove duplicates while preserving order
  const seen = new Set();
  const unique = [];
  for (const v of values) {
    if (!seen.has(v)) {
      seen.add(v);
      unique.push(v);
    }
  }

  // The first 6 are team metadata, the rest are players
  const [cor1, cor2, fileKey, teamName, stadium, manager, ...playerNames] = unique;

  return {
    fileKey: fileKey || path.basename(filePath, '.ban'),
    name: teamName || path.basename(filePath, '.ban'),
    cor1: cor1 || '888888',
    cor2: cor2 || 'ffffff',
    stadium: stadium || '',
    manager: manager || '',
    players: playerNames.filter(p => p && p.length > 3 && p.includes(' ')),
  };
}

module.exports = { parseBanFile, extractStrings };
