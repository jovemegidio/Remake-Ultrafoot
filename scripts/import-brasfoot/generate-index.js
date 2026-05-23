/**
 * Generates a compact team index from the full imported-bf2026.json.
 * The index omits player lists to keep file size manageable for UI.
 * Full data is used when creating a career (loading squad details).
 */
const fs = require('fs');
const path = require('path');

const SRC = path.join(__dirname, '../../data/seeds/imported-bf2026.json');
const DEST = path.join(__dirname, '../../public/data/teams-index.json');
const DEST_FULL = path.join(__dirname, '../../public/data/teams-full.json');

fs.mkdirSync(path.dirname(DEST), { recursive: true });

const data = JSON.parse(fs.readFileSync(SRC, 'utf8'));

const index = data.teams.map(t => ({
  id: t.id,
  nome: t.nome,
  curto: t.curto,
  cor1: t.cor1,
  cor2: t.cor2,
  estadio: t.estadio,
  tecnico: t.tecnico,
  pais: t.pais,
  liga: t.liga,
  divisao: t.divisao,
  prestigio: t.prestigio,
  saldo: t.saldo,
  escudo: t.escudo,
  escudoDisponivel: t.escudoDisponivel,
  fileKey: t.fileKey,
  nJogadores: (t.jogadores || []).length,
}));

fs.writeFileSync(DEST, JSON.stringify({ version: data.version, count: index.length, teams: index }));

// Also write full data to public for Tauri file access
fs.writeFileSync(DEST_FULL, JSON.stringify(data));

const indexSize = Math.round(fs.statSync(DEST).size / 1024);
const fullSize = Math.round(fs.statSync(DEST_FULL).size / 1024 / 1024 * 10) / 10;

console.log(`Index: ${indexSize} KB (${index.length} teams) → ${DEST}`);
console.log(`Full:  ${fullSize} MB → ${DEST_FULL}`);
