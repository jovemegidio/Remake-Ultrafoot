// ⚠️ SEM ANALYTICS AQUI. O `@vercel/analytics` só faz sentido num site servido
// pela Vercel: dentro do app desktop ele carrega um script que não existe no
// pacote (a UI é exportada estaticamente e roda de arquivo local), gerando
// requisição morta a cada abertura — e mandando dado de uso do jogador para
// fora sem que ninguém tenha pedido. Medição do launcher, se houver, tem de
// nascer no Rust, ser opcional e medir o que importa: taxa de sucesso de
// instalação e de auto-update.
import type { Metadata, Viewport } from 'next'
import { ProvedorDeIdioma } from '@/lib/i18n'
import { Geist, Geist_Mono, Space_Grotesk } from 'next/font/google'
// As 20 fontes escolhíveis: as variáveis precisam existir no <body> para a
// preferência do jogador poder apontar para qualquer uma delas.
import { CLASSES_DE_FONTE } from '@/lib/fontes'
import './globals.css'

const geistSans = Geist({ subsets: ['latin'], variable: '--font-geist-sans' })
const geistMono = Geist_Mono({ subsets: ['latin'], variable: '--font-geist-mono' })
const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  variable: '--font-space-grotesk',
  weight: ['500', '600', '700'],
})

export const metadata: Metadata = {
  title: 'Ultrafoot — Launcher oficial do football manager',
  description:
    'Baixe, atualize e acompanhe as novidades do Ultrafoot, o simulador definitivo de football manager, em um launcher rápido e seguro.',
  generator: 'v0.app',
  icons: {
    icon: '/games/ultrafoot-icon.png',
  },
}

export const viewport: Viewport = {
  colorScheme: 'dark',
  themeColor: '#0b1220',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="pt-BR"
      className={`dark bg-background ${geistSans.variable} ${geistMono.variable} ${spaceGrotesk.variable}`}
    >
      <body className={`font-sans antialiased ${CLASSES_DE_FONTE}`}>
        <ProvedorDeIdioma>{children}</ProvedorDeIdioma>
      </body>
    </html>
  )
}
