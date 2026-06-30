/**
 * Extract league names from Brasfoot .cfg and .ces files.
 * These are Java serialized ArrayLigaType objects.
 * We extract TC_STRING values and skip Java class metadata.
 */
const fs = require('fs');
const path = require('path');
const { extractStrings } = require('./parse-ban');

const COUNTRY_CODES = {
  AFG: 'Afeganistão', AFS: 'África do Sul', ALE: 'Alemanha', ARG: 'Argentina',
  ARS: 'Arábia Saudita', AUS: 'Austrália', AUT: 'Áustria', BEL: 'Bélgica',
  BOL: 'Bolívia', BRA: 'Brasil', CAT: 'Catar', CHI: 'Chile', CHN: 'China',
  COL: 'Colômbia', CRO: 'Croácia', DIN: 'Dinamarca', EGI: 'Egito',
  EMI: 'Emirados Árabes Unidos', EQU: 'Equador', ESC: 'Escócia', ESP: 'Espanha',
  EUA: 'Estados Unidos', FRA: 'França', GRE: 'Grécia', HOL: 'Holanda',
  ING: 'Inglaterra', ITA: 'Itália', JAP: 'Japão', MAR: 'Marrocos',
  MEX: 'México', NOR: 'Noruega', PAR: 'Paraguai', PER: 'Peru',
  POR: 'Portugal', RUS: 'Rússia', SER: 'Sérvia', SUE: 'Suécia',
  SUI: 'Suíça', TUR: 'Turquia', UCR: 'Ucrânia', URU: 'Uruguai',
  VEN: 'Venezuela',
};

const CFG_METADATA = new Set([
  'est.ArrayLigaType', 'est.ConfigLigaType', 'java.util.ArrayList', 'java.lang.String',
  'classificaPeloGeralI', 'desempateI', 'divisaoZ', 'doisTurnosI', 'formulaZ',
  'jogosDentroGrupoZ', 'melhoresTerceirosI', 'nGruposI', 'nRebaixadosI', 'nTimesI',
  'numeroTimesMataMataI', 'paisI', 'playoffRebaixamentoZ', 'rebaixadoPeloGrupoI',
  'rebaixadosDiretoI', 'vagasSobemPeloMataMataZ', 'validoI', 'versaoArquivo',
  'duasVoltasMataMatat', 'duasVoltasMataMataSobeq', 'duasVoltasplayoffRebq',
  'nomet', 'nomeDivisaoq', 'Ljava', 'lang', 'util', 'xp', 'sr', 'sizexp',
  'Ljava/lang/String', 'Ljava/util/ArrayList',
]);

function parseCfgFile(filePath) {
  const countryCode = path.basename(filePath, '.cfg');
  const buf = fs.readFileSync(filePath);
  const allStrings = extractStrings(buf);

  const divisions = allStrings
    .map(s => s.value)
    .filter(v => !CFG_METADATA.has(v))
    .filter(v => v.length > 2);

  return {
    countryCode,
    country: COUNTRY_CODES[countryCode] || countryCode,
    divisions,
  };
}

function parseAllCfg(cfgDir) {
  const files = fs.readdirSync(cfgDir).filter(f => f.endsWith('.cfg'));
  return files.map(f => parseCfgFile(path.join(cfgDir, f)));
}

module.exports = { parseCfgFile, parseAllCfg, COUNTRY_CODES };
