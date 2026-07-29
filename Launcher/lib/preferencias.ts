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
  /** Foto do avatar (data URL, 160px). Quando existe, vence emoji e iniciais. */
  fotoAvatar: string
}

export const PADRAO: Preferencias = {
  tema: "ultrafoot",
  fonte: "padrao",
  tamanhoTexto: 100,
  reduzirAnimacoes: false,
  altoContraste: false,
  avatar: "",
  corAvatar: "#48eed6",
  fotoAvatar: "",
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
  // 20 paletas. Cada uma define fundo, superficie, borda e destaque — trocar de
  // tema muda o launcher inteiro porque estas cores viram as variaveis que o
  // Tailwind ja consome. `sobrePrimaria` existe para o texto DENTRO do botao
  // continuar legivel: destaque claro pede texto escuro, e vice-versa.
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
  { id: "ouro", nome: "Ouro", primaria: "#facc15", sobrePrimaria: "#171003",
    fundo: "#0b0904", superficie: "#16120a", borda: "#2b2413", amostra: ["#facc15", "#0b0904"] },
  { id: "ceu", nome: "Céu", primaria: "#38bdf8", sobrePrimaria: "#04121b",
    fundo: "#050a0f", superficie: "#0c141b", borda: "#18262f", amostra: ["#38bdf8", "#050a0f"] },
  { id: "ametista", nome: "Ametista", primaria: "#a78bfa", sobrePrimaria: "#0f0820",
    fundo: "#08060e", superficie: "#120e1c", borda: "#231c33", amostra: ["#a78bfa", "#08060e"] },
  { id: "rubi", nome: "Rubi", primaria: "#f87171", sobrePrimaria: "#180505",
    fundo: "#0b0606", superficie: "#170e0e", borda: "#2b1919", amostra: ["#f87171", "#0b0606"] },
  { id: "esmeralda", nome: "Esmeralda", primaria: "#34d399", sobrePrimaria: "#03130d",
    fundo: "#050c0a", superficie: "#0c1613", borda: "#182924", amostra: ["#34d399", "#050c0a"] },
  { id: "grafite", nome: "Grafite", primaria: "#cbd5e1", sobrePrimaria: "#0f1318",
    fundo: "#0a0c0e", superficie: "#14181c", borda: "#262c33", amostra: ["#cbd5e1", "#0a0c0e"] },
  { id: "cafe", nome: "Café", primaria: "#d6a06a", sobrePrimaria: "#1a1006",
    fundo: "#0b0806", superficie: "#16110c", borda: "#2a2016", amostra: ["#d6a06a", "#0b0806"] },
  { id: "oceano", nome: "Oceano", primaria: "#22d3ee", sobrePrimaria: "#03141a",
    fundo: "#040c10", superficie: "#0a171d", borda: "#152b34", amostra: ["#22d3ee", "#040c10"] },
  { id: "lima", nome: "Lima", primaria: "#a3e635", sobrePrimaria: "#0e1503",
    fundo: "#070b04", superficie: "#10160b", borda: "#1f2a13", amostra: ["#a3e635", "#070b04"] },
  { id: "coral", nome: "Coral", primaria: "#fb7185", sobrePrimaria: "#1a0509",
    fundo: "#0b0608", superficie: "#170e11", borda: "#2b191e", amostra: ["#fb7185", "#0b0608"] },
  { id: "meia-noite", nome: "Meia-noite", primaria: "#818cf8", sobrePrimaria: "#070a1c",
    fundo: "#04050c", superficie: "#0b0d18", borda: "#171b2c", amostra: ["#818cf8", "#04050c"] },
  { id: "areia", nome: "Areia", primaria: "#0f766e", sobrePrimaria: "#ffffff",
    fundo: "#f3f1ea", superficie: "#ffffff", borda: "#ddd8cb", amostra: ["#0f766e", "#f3f1ea"] },
  { id: "claro", nome: "Claro", primaria: "#0e9f8a", sobrePrimaria: "#ffffff",
    fundo: "#f4f6f7", superficie: "#ffffff", borda: "#d8dee1", amostra: ["#0e9f8a", "#f4f6f7"] },
  { id: "papel", nome: "Papel", primaria: "#b45309", sobrePrimaria: "#ffffff",
    fundo: "#faf7f2", superficie: "#ffffff", borda: "#e5ddd0", amostra: ["#b45309", "#faf7f2"] },
  // Contraste maximo: preto puro com branco. Nao e enfeite — e o unico tema que
  // atende quem precisa de contraste extremo, e por isso fica na lista de temas
  // e nao escondido na acessibilidade.
  { id: "contraste", nome: "Contraste máximo", primaria: "#ffffff", sobrePrimaria: "#000000",
    fundo: "#000000", superficie: "#0a0a0a", borda: "#ffffff", amostra: ["#ffffff", "#000000"] },
]

// As fontes moram em lib/fontes.ts porque precisam de `next/font/google`, que só
// funciona em módulo carregado pelo build do Next. Reexportamos daqui para quem
// consome preferências não ter de saber disso.
export { FONTES, type OpcaoDeFonte } from "@/lib/fontes"
import { FONTES as LISTA_DE_FONTES } from "@/lib/fontes"

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
  const fonte = LISTA_DE_FONTES.find(f => f.id === p.fonte) ?? LISTA_DE_FONTES[0]

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
  // Quais temas sao CLAROS agora sao varios; decidir pela luminancia do fundo
  // evita ter de manter uma lista de ids a cada tema novo.
  const claro = luminancia(tema.fundo) > 0.55
  raiz.style.setProperty("--foreground", claro ? "#0d1417" : "#e6edf0")
  raiz.style.setProperty("--card-foreground", claro ? "#0d1417" : "#e6edf0")
  raiz.style.setProperty("--popover-foreground", claro ? "#0d1417" : "#e6edf0")
  raiz.style.setProperty("--secondary-foreground", claro ? "#0d1417" : "#e6edf0")
  raiz.style.setProperty("--muted-foreground", claro ? "#5b686e" : "#8b9aa1")
  raiz.style.setProperty("--accent-foreground", tema.sobrePrimaria)

  // A FONTE ENTRA PELA VARIAVEL QUE O TAILWIND JA USA.
  //
  // Antes isto dependia de uma regra CSS nova (`html[data-uf-tema] body`) vencer
  // a classe `.font-sans` do body na cascata. Especificidade dizia que venceria,
  // e na pratica a fonte nao trocava. Sobrescrever `--font-geist-sans` — a
  // variavel que `.font-sans{font-family:var(--font-geist-sans)}` ja le — nao
  // depende de cascata nenhuma: e o mesmo truque usado nas cores do tema.
  //
  // `--font-space-grotesk` (classe `font-display`, usada nos titulos) acompanha,
  // senao trocar a fonte mudaria o corpo do texto e deixaria os titulos com a
  // fonte antiga. `--font-geist-mono` fica de fora de proposito: codigo, versao e
  // placar precisam de largura fixa.
  raiz.style.setProperty("--font-geist-sans", fonte.pilha)
  raiz.style.setProperty("--font-space-grotesk", fonte.pilha)
  raiz.style.setProperty("--uf-fonte", fonte.pilha)

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
  raiz.style.colorScheme = claro ? "light" : "dark"
}

/** Luminancia relativa aproximada de uma cor #rrggbb (0 = preto, 1 = branco). */
function luminancia(hex: string): number {
  const n = hex.replace("#", "")
  if (n.length !== 6) return 0
  const [r, g, b] = [0, 2, 4].map(i => parseInt(n.slice(i, i + 2), 16) / 255)
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/** Iniciais para o avatar de quem não escolheu emoji. */
export function iniciais(nome: string): string {
  const partes = (nome || "").trim().split(/\s+/).filter(Boolean)
  if (!partes.length) return "?"
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase()
  return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase()
}

export const AVATARES = ["", "⚽", "🏆", "🥅", "🧤", "📋", "🎩", "🦁", "🦅", "🐺", "🔥", "⭐", "👑", "🎯"]

/**
 * Converte a imagem escolhida numa foto de avatar pequena (160px, quadrada).
 *
 * O redimensionamento NÃO é enfeite: a foto vai para o localStorage, que tem
 * limite de poucos megabytes. Guardar o arquivo original (uma foto de celular
 * passa de 5 MB) estouraria a cota e derrubaria TODAS as preferências junto.
 * O corte é central, que é o enquadramento que quase sempre acerta o rosto.
 */
export async function fotoParaAvatar(arquivo: File): Promise<string> {
  if (!arquivo.type.startsWith("image/")) throw new Error("escolha um arquivo de imagem")
  const url = URL.createObjectURL(arquivo)
  try {
    const img = await new Promise<HTMLImageElement>((ok, erro) => {
      const i = new Image()
      i.onload = () => ok(i)
      i.onerror = () => erro(new Error("não consegui abrir esta imagem"))
      i.src = url
    })
    const LADO = 160
    const tela = document.createElement("canvas")
    tela.width = LADO
    tela.height = LADO
    const ctx = tela.getContext("2d")
    if (!ctx) throw new Error("não consegui processar a imagem")
    const corte = Math.min(img.width, img.height)
    ctx.drawImage(
      img,
      (img.width - corte) / 2, (img.height - corte) / 2, corte, corte,
      0, 0, LADO, LADO,
    )
    // JPEG a 82%: uma foto de rosto de 160px fica em ~8 KB. PNG no mesmo
    // tamanho passa de 60 KB sem ganho visível.
    return tela.toDataURL("image/jpeg", 0.82)
  } finally {
    URL.revokeObjectURL(url)
  }
}
