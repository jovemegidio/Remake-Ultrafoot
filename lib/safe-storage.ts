// Escrita em localStorage que NUNCA derruba a tela.
//
// Relato do jogador:
//   Failed to execute 'setItem' on 'Storage': Setting the value of
//   'ultrafoot-competitions:2026:COR' exceeded the quota.
//
// `localStorage.setItem` LANÇA quando a cota estoura. Havia 28 chamadas cruas
// espalhadas pelo jogo e qualquer uma delas, disparada dentro de um efeito do
// React, quebra a página inteira — o jogador perde a tela por causa de um cache
// que era só conveniência.
//
// A cota costuma encher por causa de escudos e uniformes importados, guardados
// como data URI (dezenas de KB cada). O jogo não pode punir quem personalizou.

const AVISADO = new Set<string>()

/**
 * Chaves descartáveis, em ordem de descarte. São CACHES: podem ser recalculados
 * ou pertencem a temporadas que já passaram. O save da carreira nunca entra
 * aqui — preferimos falhar a escrita a apagar progresso.
 */
function candidatasAoDescarte(chaveAtual: string): string[] {
  if (typeof localStorage === "undefined") return []
  const descartaveis: string[] = []
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i)
    if (!k || k === chaveAtual) continue
    if (k.startsWith("ultrafoot-competitions:")) descartaveis.push(k)
    else if (k.startsWith("ultrafoot:competitions:")) descartaveis.push(k)
    else if (k.startsWith("ultrafoot:cloud:")) descartaveis.push(k)
  }
  return descartaveis
}

/**
 * Grava e devolve se conseguiu. Estourando a cota, descarta caches e tenta uma
 * vez mais; se ainda assim não couber, desiste em silêncio (só um aviso no
 * console, uma vez por chave) em vez de estourar para cima.
 */
export function safeLocalSet(chave: string, valor: string): boolean {
  if (typeof localStorage === "undefined") return false
  try {
    localStorage.setItem(chave, valor)
    return true
  } catch {
    for (const k of candidatasAoDescarte(chave)) {
      try { localStorage.removeItem(k) } catch { /* segue */ }
    }
    try {
      localStorage.setItem(chave, valor)
      return true
    } catch {
      if (!AVISADO.has(chave)) {
        AVISADO.add(chave)
        console.warn(`[ultrafoot] armazenamento cheio: "${chave}" nao foi salvo (a tela continua funcionando).`)
      }
      return false
    }
  }
}

/** Leitura que não quebra em modo restrito nem com JSON corrompido. */
export function safeLocalGet(chave: string): string | null {
  if (typeof localStorage === "undefined") return null
  try {
    return localStorage.getItem(chave)
  } catch {
    return null
  }
}

export function safeLocalRemove(chave: string): void {
  if (typeof localStorage === "undefined") return
  try { localStorage.removeItem(chave) } catch { /* ignora */ }
}
