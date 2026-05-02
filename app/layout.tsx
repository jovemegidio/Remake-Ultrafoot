import type { Metadata, Viewport } from "next"
import { Geist, Geist_Mono, Oswald } from "next/font/google"
import { Analytics } from "@vercel/analytics/next"
import "./globals.css"

const geist = Geist({
  subsets: ["latin"],
  variable: "--font-geist",
})
const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
})
const oswald = Oswald({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-oswald",
})

export const metadata: Metadata = {
  title: "ULTRASPORT FC — Football Manager",
  description: "Football manager game with cinematic EAFC-style broadcast UI",
  generator: "v0.app",
}

export const viewport: Viewport = {
  themeColor: "#0a0e1a",
  userScalable: true,
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="pt-BR" className={`bg-background ${geist.variable} ${geistMono.variable} ${oswald.variable}`}>
      <body className="font-sans antialiased">
        {children}
        {process.env.NODE_ENV === "production" && <Analytics />}
      </body>
    </html>
  )
}
