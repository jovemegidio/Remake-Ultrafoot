#!/usr/bin/env node
/**
 * ETAPA 3 - BF2026-27 Import Pipeline
 * Reads all .ban files, extracts team + player data, copies shields, generates seed JSON.
 *
 * Usage: node scripts/import-brasfoot/import-all.js
 *
 * Output:
 *   data/seeds/imported-bf2026.json  — all teams structured for Ultrafoot
 *   data/seeds/leagues-bf2026.json   — all leagues from .cfg files
 *   public/escudos/<key>.png         — club shields copied from BF pack
 *   public/escudos-selecoes/<code>.png — national team shields copied
 *   assets-missing.md                — teams without shields
 */

const fs = require('fs');
const path = require('path');
const { parseBanFile } = require('./parse-ban');
const { parseAllCfg, COUNTRY_CODES } = require('./parse-cfg');

const BF_ROOT = path.join(__dirname, '../../BF2026-27/BF2026-27');
const TEAMS_DIR = path.join(BF_ROOT, 'teams');
const ESCUDOS_SRC = path.join(TEAMS_DIR, 'escudos');
const SEL_ESCUDOS_SRC = path.join(BF_ROOT, 'selecoes/escudos');
const CFG_DIR = path.join(BF_ROOT, 'conf_ligas_nacionais');
const ESCUDOS_DEST = path.join(__dirname, '../../public/escudos');
const SEL_ESCUDOS_DEST = path.join(__dirname, '../../public/escudos-selecoes');
const DATA_DIR = path.join(__dirname, '../../data/seeds');

// Country code from filename suffix: "salzburg_aut" → "aut"
function getCountryFromKey(key) {
  const parts = key.split('_');
  return parts[parts.length - 1] || 'bra';
}

// Map BF country code → full country name
const BF_COUNTRY_MAP = {
  bra: 'Brasil', arg: 'Argentina', uru: 'Uruguai', chi: 'Chile',
  col: 'Colômbia', par: 'Paraguai', per: 'Peru', ecu: 'Equador',
  bol: 'Bolívia', ven: 'Venezuela', equ: 'Equador',
  ing: 'Inglaterra', esp: 'Espanha', ita: 'Itália', ale: 'Alemanha',
  fra: 'França', por: 'Portugal', hol: 'Holanda', bel: 'Bélgica',
  aut: 'Áustria', sui: 'Suíça', tur: 'Turquia', rus: 'Rússia',
  ucr: 'Ucrânia', cro: 'Croácia', ser: 'Sérvia', gre: 'Grécia',
  nor: 'Noruega', sue: 'Suécia', din: 'Dinamarca', esc: 'Escócia',
  eua: 'EUA', mex: 'México', jap: 'Japão', chi2: 'China',
  chin: 'China', aus: 'Austrália', mar: 'Marrocos', egi: 'Egito',
  emi: 'Emirados', cat: 'Catar', ars: 'Arábia Saudita',
  srb: 'Sérvia', ukr: 'Ucrânia', net: 'Holanda', sco: 'Escócia',
};

// Map BF country code → Ultrafoot league/divisão
const BF_LEAGUE_MAP = {
  bra: 'Série A', arg: 'Primera División', uru: 'Primera División',
  ing: 'Premier League', esp: 'La Liga', ita: 'Serie A',
  ale: 'Bundesliga', fra: 'Ligue 1', por: 'Primeira Liga',
  hol: 'Eredivisie', bel: 'Pro League', aut: 'Bundesliga Austríaca',
  sui: 'Super League', tur: 'Süper Lig', rus: 'Premier Liga',
  chi: 'Primera División', col: 'Primera A', par: 'División de Honor',
  per: 'Liga 1', ecu: 'Serie A Equatoriana', equ: 'Serie A Equatoriana',
  bol: 'División Profesional', ven: 'Primera División',
  mex: 'Liga MX', eua: 'MLS', jap: 'J-League', aus: 'A-League',
  mar: 'Botola Pro', egi: 'Premier League Egípcio',
};

function getLeagueFromKey(key) {
  const cc = getCountryFromKey(key);
  return BF_LEAGUE_MAP[cc] || 'Liga Nacional';
}

function getPaisFromKey(key) {
  const cc = getCountryFromKey(key);
  return BF_COUNTRY_MAP[cc] || cc.toUpperCase();
}

// Generate a short slug from team name
function makeSlug(name, key) {
  const base = key || name.toLowerCase().replace(/[^a-z0-9]/g, '');
  return base.slice(0, 8).toUpperCase().replace(/[^A-Z0-9]/g, 'X');
}

function getPrestigio(pais, name) {
  const topClubs = ['Real Madrid', 'Barcelona', 'Manchester City', 'Liverpool',
    'Bayern', 'PSG', 'Juventus', 'Chelsea', 'Arsenal', 'Atletico',
    'Flamengo', 'Palmeiras', 'Corinthians', 'São Paulo', 'Santos',
    'River Plate', 'Boca Juniors', 'Nacional', 'Peñarol'];
  for (const club of topClubs) {
    if (name.toLowerCase().includes(club.toLowerCase())) return 90 + Math.floor(Math.random() * 9);
  }
  if (['Inglaterra', 'Espanha', 'Alemanha', 'Itália', 'França'].includes(pais)) {
    return 75 + Math.floor(Math.random() * 15);
  }
  if (pais === 'Brasil') return 60 + Math.floor(Math.random() * 25);
  return 50 + Math.floor(Math.random() * 30);
}

async function main() {
  console.log('=== BF2026-27 Import Pipeline ===\n');

  // 1. Parse all .ban files
  const banFiles = fs.readdirSync(TEAMS_DIR).filter(f => f.endsWith('.ban'));
  console.log(`Found ${banFiles.length} .ban files`);

  const teams = [];
  const errors = [];
  let i = 0;

  for (const file of banFiles) {
    try {
      const filePath = path.join(TEAMS_DIR, file);
      const data = parseBanFile(filePath);
      // Always use the actual filename as key (not extracted from binary)
      const key = path.basename(file, '.ban');
      const pais = getPaisFromKey(key);
      const league = getLeagueFromKey(key);
      const prestigio = getPrestigio(pais, data.name);

      teams.push({
        id: `bf_${key}`,
        nome: data.name,
        curto: makeSlug(data.name, key),
        // Colors in .ban files already include '#' prefix
        cor1: data.cor1.startsWith('#') ? data.cor1 : `#${data.cor1}`,
        cor2: data.cor2.startsWith('#') ? data.cor2 : `#${data.cor2}`,
        estadio: data.stadium,
        tecnico: data.manager,
        pais,
        liga: league,
        divisao: 'Série A',
        prestigio,
        saldo: Math.round(prestigio * 50000 + Math.random() * 1000000),
        escudo: `/escudos/${key}.png`,
        escudoDisponivel: false, // set below
        jogadores: data.players.slice(0, 30).map((nome, idx) => ({
          id: `${key}_j${idx}`,
          nome,
          posicao: idx === 0 ? 'GOL' : idx < 5 ? 'DEF' : idx < 8 ? 'MEI' : idx < 11 ? 'ATA' : 'BAN',
          overall: Math.max(55, prestigio - 10 + Math.floor(Math.random() * 20)),
          idade: 18 + Math.floor(Math.random() * 18),
          salario: Math.round((prestigio * 500 + Math.random() * 5000) / 100) * 100,
        })),
        source: 'BF2026-27',
        fileKey: key,
      });
    } catch (err) {
      errors.push({ file, error: err.message });
    }
    i++;
    if (i % 500 === 0) console.log(`  Processed ${i}/${banFiles.length}...`);
  }

  console.log(`\nParsed: ${teams.length} teams, ${errors.length} errors`);

  // 2. Copy shields
  console.log('\nCopying club shields...');
  let shieldsFound = 0;
  let shieldsMissing = 0;
  const missingShields = [];

  for (const team of teams) {
    const srcFile = path.join(ESCUDOS_SRC, `${team.fileKey}.png`);
    const destFile = path.join(ESCUDOS_DEST, `${team.fileKey}.png`);
    if (fs.existsSync(srcFile)) {
      fs.copyFileSync(srcFile, destFile);
      team.escudoDisponivel = true;
      shieldsFound++;
    } else {
      shieldsMissing++;
      missingShields.push(team.fileKey);
    }
  }
  console.log(`  Shields found: ${shieldsFound}, missing: ${shieldsMissing}`);

  // 3. Copy national team shields
  console.log('\nCopying national team shields...');
  if (fs.existsSync(SEL_ESCUDOS_SRC)) {
    const selFiles = fs.readdirSync(SEL_ESCUDOS_SRC).filter(f => f.endsWith('.png'));
    for (const f of selFiles) {
      if (f !== 'info.txt') {
        fs.copyFileSync(path.join(SEL_ESCUDOS_SRC, f), path.join(SEL_ESCUDOS_DEST, f));
      }
    }
    console.log(`  Copied ${selFiles.length} national team shields`);
  }

  // 4. Parse leagues
  console.log('\nParsing league configs...');
  const leagues = parseAllCfg(CFG_DIR);
  console.log(`  Found ${leagues.length} country league configs`);

  // 5. Write outputs
  console.log('\nWriting output files...');

  fs.writeFileSync(
    path.join(DATA_DIR, 'imported-bf2026.json'),
    JSON.stringify({ version: '2026-27', importedAt: new Date().toISOString(), count: teams.length, teams }, null, 2)
  );

  fs.writeFileSync(
    path.join(DATA_DIR, 'leagues-bf2026.json'),
    JSON.stringify({ version: '2026-27', leagues }, null, 2)
  );

  // 6. Generate assets-missing.md
  const missingMd = [
    '# Assets Faltando - BF2026-27 Import',
    '',
    `Total times importados: ${teams.length}`,
    `Escudos encontrados: ${shieldsFound}`,
    `Escudos faltando: ${shieldsMissing}`,
    '',
    '## Times sem escudo',
    '',
    ...missingShields.map(k => `- \`${k}\``),
    '',
    '## Erros de parse',
    '',
    ...errors.map(e => `- \`${e.file}\`: ${e.error}`),
  ].join('\n');

  fs.writeFileSync(path.join(__dirname, '../../assets-missing.md'), missingMd);

  console.log('\n=== Import Complete ===');
  console.log(`  data/seeds/imported-bf2026.json — ${teams.length} times`);
  console.log(`  data/seeds/leagues-bf2026.json — ${leagues.length} países`);
  console.log(`  public/escudos/ — ${shieldsFound} escudos copiados`);
  console.log(`  assets-missing.md — ${shieldsMissing} faltando`);
}

main().catch(console.error);
