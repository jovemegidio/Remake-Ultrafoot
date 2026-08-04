// COR DO CLUBE QUE DÁ PARA LER.
//
// A cor primária do clube era usada crua em cima de fundo escuro. Funciona para
// a maioria — mas o Corinthians tem `cor1: "#000000"`, e o "GOOOL!" saía PRETO
// sobre o overlay preto da animação: invisível no lance mais importante do jogo.
// Não é caso isolado: Figueirense, Botafogo-PB e vários outros também são
// #000000, e o Botafogo-RJ é #181818.
//
// A saída não é abandonar a identidade do clube — é usar a SEGUNDA cor quando a
// primeira não tem contraste, que é exatamente o que um clube preto-e-branco faz
// na camisa. Só cai no branco quando as duas são escuras.

/** Luminância percebida (0 = preto, 1 = branco). Pesos ITU-R BT.601. */
export function luminanciaDaCor(hex: string): number {
  const m = /^#?([0-9a-f]{6})$/i.exec((hex ?? "").trim())
  if (!m) return 1  // cor ilegível como dado: trata como clara e deixa o fallback agir
  const n = parseInt(m[1], 16)
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255
}

/**
 * Abaixo disto a cor some no fundo escuro do jogo. 0.35 deixa passar azul-marinho
 * e vinho (que ainda se leem com o brilho do texto) e barra preto e cinza-chumbo.
 */
const PISO_DE_CONTRASTE = 0.35

/**
 * Cor do clube legível sobre fundo ESCURO: a primária quando ela se lê, senão a
 * secundária, senão branco.
 */
export function corDoClubeSobreEscuro(cor1?: string, cor2?: string): string {
  const primaria = cor1 || ""
  if (primaria && luminanciaDaCor(primaria) >= PISO_DE_CONTRASTE) return primaria
  const secundaria = cor2 || ""
  if (secundaria && luminanciaDaCor(secundaria) >= PISO_DE_CONTRASTE) return secundaria
  return "#ffffff"
}
