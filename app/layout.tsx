import type { Metadata, Viewport } from "next"
import { Geist, Geist_Mono, Oswald } from "next/font/google"
import { ThemeProvider } from "@/components/theme-provider"
import { GamepadProvider } from "@/components/gamepad-provider"
import { NotificationsProvider, NotificationToastContainer } from "@/components/notifications-system"
import { NativeAppProvider } from "@/components/native-app-provider"
import { MusicPlayerWrapper } from "@/components/music-player-wrapper"
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
  title: "ULTRAFOOT 26 — Football Manager",
  description: "Simulador de futebol brasileiro com visual premium estilo EA FC. Gerencie seu clube, contrate jogadores e conquiste titulos.",
  generator: "v0.app",
  keywords: ["football manager", "futebol", "brasileiro", "simulador", "EA FC", "ultrafoot"],
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
        <NativeAppProvider>
          <ThemeProvider>
            <GamepadProvider>
              <NotificationsProvider>
                {children}
                <NotificationToastContainer />
                <MusicPlayerWrapper />
              </NotificationsProvider>
            </GamepadProvider>
          </ThemeProvider>
        </NativeAppProvider>
      </body>
    </html>
  )
}
