import type { Metadata, Viewport } from "next"
import { Geist, Geist_Mono, Oswald } from "next/font/google"
import { ThemeProvider } from "@/components/theme-provider"
import { GamepadProvider } from "@/components/gamepad-provider"
import { NotificationsProvider, NotificationToastContainer } from "@/components/notifications-system"
import { MarketNotificationsBridge } from "@/components/market-notifications-bridge"
import { FinanceInfraNotificationsBridge } from "@/components/finance-infra-notifications-bridge"
import { PendingInboxGate } from "@/components/pending-inbox-gate"
import { NativeAppProvider } from "@/components/native-app-provider"
import { MusicPlayerWrapper } from "@/components/music-player-wrapper"
import { EaActionBarProvider, EaActionBar } from "@/components/ea-action-bar"
import { FcHubLoader } from "@/components/fc-hub-loader"
import { GameAutosave } from "@/components/game-autosave"
import { PerformanceProfileBootstrap } from "@/components/performance-profile"
import "./globals.css"

const performanceBootstrapScript = `try{const k="ultrafoot:performance-profile";const s=localStorage.getItem(k);const low=(navigator.deviceMemory||8)<=4||(navigator.hardwareConcurrency||8)<=4;const p=s==="economy"||s==="balanced"||s==="quality"?s:(low?"economy":"balanced");document.documentElement.dataset.performance=p;localStorage.setItem(k,p);const forced=localStorage.getItem("ultrafoot:performance-mode");if(forced==="on"||(forced!=="off"&&low)){document.documentElement.setAttribute("data-performance-mode","");document.documentElement.setAttribute("data-a11y-reduce-motion","")}}catch{document.documentElement.dataset.performance="balanced"}`

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
    <html lang="pt-BR" className={`bg-background ${geist.variable} ${geistMono.variable} ${oswald.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: performanceBootstrapScript }} />
      </head>
      <body className="font-sans antialiased">
        <NativeAppProvider>
          <ThemeProvider>
            <GamepadProvider>
              <NotificationsProvider>
                <GameAutosave />
                <MarketNotificationsBridge />
                <FinanceInfraNotificationsBridge />
                <PendingInboxGate />
                <PerformanceProfileBootstrap />
                <EaActionBarProvider>
                  {children}
                  <EaActionBar />
                  <FcHubLoader />
                </EaActionBarProvider>
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
