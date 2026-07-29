"use client"

// PERSONALIZAÇÃO DO LAUNCHER — tema, fonte, acessibilidade e avatar.
//
// Tudo é aplicado por variáveis CSS no elemento raiz. Componente nenhum precisa
// saber qual tema está ativo: eles usam `var(--primary)` como já usavam, e trocar
// de tema é trocar o valor da variável. Sem isso, cada tema novo obrigaria a
// mexer em toda a árvore de componentes.
//
// Guardamos no localStorage: preferência é do APARELHO, não da conta. Quem usa
// um monitor com contraste ruim quer o ajuste naquela máquina, não em todas.

const CHAVE = "ultrafoot-launcher:preferencias"

export interface Preferencias {
  tema: string
  fonte: string
  /** Escala do texto, em %. 100 = padrão. */
  tamanhoTexto: number
  reduzirAnimacoes: boolean
  altoContraste: boolean
  /** Emoji do avatar. Cai nas iniciais do nome quando vazio. */
  avatar: string
  corAvatar: string
}

export const PADRAO: Preferencias = {
  tema: "ultrafoot",
  fonte: "padrao",
  tamanhoTexto: 100,
  reduzirAnimacoes: false,
  altoContraste: false,
  avatar: "",
  corAvatar: "#48eed6",
}

export interface Tema {
  id: string
  nome: string
  /** Cor de destaque: botões, aba ativa, realces. */
  primaria: string
  /** Cor do texto sobre a primária — precisa contrastar com ela. */
  sobrePrimaria: string
  fundo: string
  superficie: string
  borda: string
  /** Amostra mostrada no seletor. */
  amostra: [string, string]
}

export const TEMAS: Tema[] = [
  { id: "ultrafoot", nome: "Ultrafoot", primaria: "#48eed6", sobrePrimaria: "#04110f",
    fundo: "#060b0e", superficie: "#0d1417", borda: "#1b262b", amostra: ["#48eed6", "#060b0e"] },
  { id: "gramado", nome: "Gramado", primaria: "#4ade80", sobrePrimaria: "#04120a",
    fundo: "#060d09", superficie: "#0d1712", borda: "#1c2a22", amostra: ["#4ade80", "#060d09"] },
  { id: "noturno", nome: "Noturno", primaria: "#7aa2ff", sobrePrimaria: "#050a18",
    fundo: "#05070d", superficie: "#0d1119", borda: "#1a2030", amostra: ["#7aa2ff", "#05070d"] },
  { id: "brasa", nome: "Brasa", primaria: "#ff8a4c", sobrePrimaria: "#160801",
    fundo: "#0c0705", superficie: "#171010", borda: "#2a1c17", amostra: ["#ff8a4c", "#0c0705"] },
  { id: "vinho", nome: "Vinho", primaria: "#f472b6", sobrePrimaria: "#1a0510",
    fundo: "#0b060a", superficie: "#160f14", borda: "#2a1a24", amostra: ["#f472b6", "#0b060a"] },
  { id: "claro", nome: "Claro", primaria: "#0e9f8a", sobrePrimaria: "#ffffff",
    fundo: "#f4f6f7", superficie: "#ffffff", borda: "#d8dee1", amostra: ["#0e9f8a", "#f4f6f7"] },
]

export interface Fonte {
  id: string
  nome: string
  pilha: string
  /** Explica para quem escolhe, em vez de só mostrar o nome. */
  nota?: string
}

export const FONTES: Fonte[] = [
  { id: "padrao", nome: "Padrão", pilha: 'ui-sans-serif, system-ui, "Segoe UI", Roboto, sans-serif' },
  { id: "sistema", nome: "Do sistema", pilha: 'system-ui, sans-serif', nota: "Usa a fonte do Windows/macOS" },
  { id: "serifada", nome: "Serifada", pilha: 'Georgia, "Times New Roman", serif' },
  { id: "mono", nome: "Monoespaçada", pilha: 'ui-monospace, "Cascadia Mono", Consolas, monospace' },
  { id: "legivel", nome: "Alta legibilidade", pilha: 'Verdana, Tahoma, sans-serif',
    nota: "Letras mais abertas, indicada para dislexia" },
]

export function lerPreferencias(): Preferencias {
  if (typeof window === "undefined") return PADRAO
  try {
    const cru = localStorage.getItem(CHAVE)
    if (!cru) return PADRAO
    // Merge com o PADRAO: uma preferência salva por uma versão antiga não tem os
    // campos novos, e sem isso `tamanhoTexto` viria undefined e quebraria o CSS.
    return { ...PADRAO, ...(JSON.parse(cru) as Partial<Preferencias>) }
  } catch {
    return PADRAO
  }
}

export function gravarPreferencias(p: Preferencias): void {
  if (typeof window === "undefined") return
  localStorage.setItem(CHAVE, JSON.stringify(p))
  aplicarPreferencias(p)
}

/** Escreve as preferências como variáveis CSS na raiz do documento. */
export function aplicarPreferencias(p: Preferencias): void {
  if (typeof document === "undefined") return
  const raiz = document.documentElement
  const tema = TEMAS.find(t => t.id === p.tema) ?? TEMAS[0]
  const fonte = FONTES.find(f => f.id === p.fonte) ?? FONTES[0]

  // Sobrescreve as variaveis que o Tailwind JA consome (--primary, --background,
  // …). Foi de proposito: assim `bg-background` e `text-primary` mudam sozinhos
  // e nenhum componente precisa saber que existe tema.
  raiz.style.setProperty("--primary", tema.primaria)
  raiz.style.setProperty("--primary-foreground", tema.sobrePrimaria)
  raiz.style.setProperty("--background", tema.fundo)
  raiz.style.setProperty("--card", tema.superficie)
  raiz.style.setProperty("--popover", tema.superficie)
  raiz.style.setProperty("--secondary", tema.superficie)
  raiz.style.setProperty("--border", tema.borda)
  raiz.style.setProperty("--input", tema.borda)
  raiz.style.setProperty("--ring", tema.primaria)
  raiz.style.setProperty("--accent", tema.primaria)

  // No tema claro o texto tem de inverter junto, senao fica branco sobre branco.
  const claro = tema.id === "claro"
  raiz.style.setProperty("--foreground", claro ? "#0d1417" : "#e6edf0")
  raiz.style.setProperty("--card-foreground", claro ? "#0d1417" : "#e6edf0")
  raiz.style.setProperty("--popover-foreground", claro ? "#0d1417" : "#e6edf0")
  raiz.style.setProperty("--secondary-foreground", claro ? "#0d1417" : "#e6edf0")
  raiz.style.setProperty("--muted-foreground", claro ? "#5b686e" : "#8b9aa1")
  raiz.style.setProperty("--accent-foreground", tema.sobrePrimaria)

  raiz.style.setProperty("--uf-fonte", fonte.pilha)
  raiz.style.fontFamily = fonte.pilha

  // O tamanho vira `font-size` da raiz; tudo que usa rem acompanha. Limitado a
  // 80–140% porque fora disso o layout do launcher quebra de verdade — texto
  // gigante que corta botão é pior para acessibilidade do que texto médio.
  const escala = Math.min(140, Math.max(80, p.tamanhoTexto))
  raiz.style.fontSize = `${(16 * escala) / 100}px`

  raiz.dataset.ufTema = tema.id
  raiz.dataset.ufContraste = p.altoContraste ? "alto" : ""
  raiz.dataset.ufAnimacoes = p.reduzirAnimacoes ? "reduzidas" : ""
  // Tema claro precisa avisar o navegador, senão os controles nativos
  // (scrollbar, seleção) continuam desenhados para fundo escuro.
  raiz.style.colorScheme = tema.id === "claro" ? "light" : "dark"
}

/** Iniciais para o avatar de quem não escolheu emoji. */
export function iniciais(nome: string): string {
  const partes = (nome || "").trim().split(/\s+/).filter(Boolean)
  if (!partes.length) return "?"
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase()
  return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase()
}

export const AVATARES = ["", "⚽", "🏆", "🥅", "🧤", "📋", "🎩", "🦁", "🦅", "🐺", "🔥", "⭐", "👑", "🎯"]
