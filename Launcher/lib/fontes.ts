import {
  Inter, Roboto, Open_Sans, Montserrat, Poppins, Nunito, Rubik, Work_Sans,
  Manrope, Barlow, Oswald, Bebas_Neue, Teko, Anton, Archivo,
  Merriweather, Playfair_Display, JetBrains_Mono, IBM_Plex_Mono,
  Atkinson_Hyperlegible,
} from "next/font/google"

// AS 20 FONTES DO LAUNCHER.
//
// Por que NÃO vieram do DaFont, já que foi o que se pediu: a maioria das fontes
// de lá é "free for personal use". Embutir uma dessas num jogo vendido é uso
// comercial sem licença — problema jurídico real, não formalidade. As daqui são
// todas OFL/Apache, livres inclusive para uso comercial.
//
// `next/font/google` BAIXA E EMBUTE a fonte no build. Nada é buscado na internet
// quando o launcher roda: funciona offline e não vaza requisição para o Google
// na máquina do jogador.
//
// CADA CHAMADA PRECISA SER LITERAL. O next/font é um transformador de build, não
// uma função comum: `{ ...comum, weight: [...w] }` é recusado com "Font loader
// values must be explicitly written literals". Daí a repetição abaixo — ela é
// obrigatória, não descuido.
//
// Só os pesos usados (400/700): cada peso extra é mais um arquivo no instalador.

const inter = Inter({ subsets: ["latin"], weight: ["400", "700"], display: "swap", variable: "--f-inter" })
const roboto = Roboto({ subsets: ["latin"], weight: ["400", "700"], display: "swap", variable: "--f-roboto" })
const openSans = Open_Sans({ subsets: ["latin"], weight: ["400", "700"], display: "swap", variable: "--f-open-sans" })
const montserrat = Montserrat({ subsets: ["latin"], weight: ["400", "700"], display: "swap", variable: "--f-montserrat" })
const poppins = Poppins({ subsets: ["latin"], weight: ["400", "700"], display: "swap", variable: "--f-poppins" })
const nunito = Nunito({ subsets: ["latin"], weight: ["400", "700"], display: "swap", variable: "--f-nunito" })
const rubik = Rubik({ subsets: ["latin"], weight: ["400", "700"], display: "swap", variable: "--f-rubik" })
const workSans = Work_Sans({ subsets: ["latin"], weight: ["400", "700"], display: "swap", variable: "--f-work-sans" })
const manrope = Manrope({ subsets: ["latin"], weight: ["400", "700"], display: "swap", variable: "--f-manrope" })
const barlow = Barlow({ subsets: ["latin"], weight: ["400", "700"], display: "swap", variable: "--f-barlow" })
const oswald = Oswald({ subsets: ["latin"], weight: ["400", "700"], display: "swap", variable: "--f-oswald" })
const bebas = Bebas_Neue({ subsets: ["latin"], weight: "400", display: "swap", variable: "--f-bebas" })
const teko = Teko({ subsets: ["latin"], weight: ["400", "700"], display: "swap", variable: "--f-teko" })
const anton = Anton({ subsets: ["latin"], weight: "400", display: "swap", variable: "--f-anton" })
const archivo = Archivo({ subsets: ["latin"], weight: ["400", "700"], display: "swap", variable: "--f-archivo" })
const merriweather = Merriweather({ subsets: ["latin"], weight: ["400", "700"], display: "swap", variable: "--f-merriweather" })
const playfair = Playfair_Display({ subsets: ["latin"], weight: ["400", "700"], display: "swap", variable: "--f-playfair" })
const jetbrains = JetBrains_Mono({ subsets: ["latin"], weight: ["400", "700"], display: "swap", variable: "--f-jetbrains" })
const plexMono = IBM_Plex_Mono({ subsets: ["latin"], weight: ["400", "700"], display: "swap", variable: "--f-plex-mono" })
const atkinson = Atkinson_Hyperlegible({ subsets: ["latin"], weight: ["400", "700"], display: "swap", variable: "--f-atkinson" })

/** Vai no className do <body> — é o que injeta todas as variáveis de uma vez. */
export const CLASSES_DE_FONTE = [
  inter, roboto, openSans, montserrat, poppins, nunito, rubik, workSans, manrope,
  barlow, oswald, bebas, teko, anton, archivo, merriweather, playfair, jetbrains,
  plexMono, atkinson,
].map(f => f.variable).join(" ")

export type GrupoDeFonte = "Interface" | "Esportiva" | "Serifada" | "Monoespaçada" | "Acessível"

export interface OpcaoDeFonte {
  id: string
  nome: string
  /** Pilha CSS. As embutidas apontam para a variável criada pelo next/font. */
  pilha: string
  grupo: GrupoDeFonte
  nota?: string
}

export const FONTES: OpcaoDeFonte[] = [
  { id: "padrao", nome: "Padrão do Ultrafoot", grupo: "Interface",
    pilha: "var(--font-geist-sans), ui-sans-serif, system-ui, sans-serif" },
  { id: "inter", nome: "Inter", grupo: "Interface", pilha: "var(--f-inter), sans-serif",
    nota: "Desenhada para telas; ótima em tamanho pequeno" },
  { id: "roboto", nome: "Roboto", grupo: "Interface", pilha: "var(--f-roboto), sans-serif" },
  { id: "open-sans", nome: "Open Sans", grupo: "Interface", pilha: "var(--f-open-sans), sans-serif" },
  { id: "montserrat", nome: "Montserrat", grupo: "Interface", pilha: "var(--f-montserrat), sans-serif" },
  { id: "poppins", nome: "Poppins", grupo: "Interface", pilha: "var(--f-poppins), sans-serif",
    nota: "Geométrica e arredondada" },
  { id: "nunito", nome: "Nunito", grupo: "Interface", pilha: "var(--f-nunito), sans-serif" },
  { id: "rubik", nome: "Rubik", grupo: "Interface", pilha: "var(--f-rubik), sans-serif" },
  { id: "work-sans", nome: "Work Sans", grupo: "Interface", pilha: "var(--f-work-sans), sans-serif" },
  { id: "manrope", nome: "Manrope", grupo: "Interface", pilha: "var(--f-manrope), sans-serif" },
  { id: "barlow", nome: "Barlow", grupo: "Esportiva", pilha: "var(--f-barlow), sans-serif",
    nota: "Levemente condensada, cara de placar" },
  { id: "oswald", nome: "Oswald", grupo: "Esportiva", pilha: "var(--f-oswald), sans-serif",
    nota: "Condensada, estilo cartaz de jogo" },
  { id: "bebas", nome: "Bebas Neue", grupo: "Esportiva", pilha: "var(--f-bebas), sans-serif",
    nota: "Só maiúsculas — impacto alto, leitura longa ruim" },
  { id: "teko", nome: "Teko", grupo: "Esportiva", pilha: "var(--f-teko), sans-serif",
    nota: "Estreita, lembra placar eletrônico" },
  { id: "anton", nome: "Anton", grupo: "Esportiva", pilha: "var(--f-anton), sans-serif",
    nota: "Muito pesada; boa para título, cansativa no resto" },
  { id: "archivo", nome: "Archivo", grupo: "Esportiva", pilha: "var(--f-archivo), sans-serif" },
  { id: "merriweather", nome: "Merriweather", grupo: "Serifada", pilha: "var(--f-merriweather), serif",
    nota: "Serifada pensada para tela" },
  { id: "playfair", nome: "Playfair Display", grupo: "Serifada", pilha: "var(--f-playfair), serif",
    nota: "Elegante, contraste alto" },
  { id: "jetbrains", nome: "JetBrains Mono", grupo: "Monoespaçada", pilha: "var(--f-jetbrains), monospace" },
  { id: "plex-mono", nome: "IBM Plex Mono", grupo: "Monoespaçada", pilha: "var(--f-plex-mono), monospace" },
  { id: "atkinson", nome: "Atkinson Hyperlegible", grupo: "Acessível", pilha: "var(--f-atkinson), sans-serif",
    nota: "Criada para baixa visão: letras parecidas ficam distintas" },
]
