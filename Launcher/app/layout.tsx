import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
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
        {children}
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
