import type { Metadata, Viewport } from "next"
import { Geist, Geist_Mono, Oswald, Poppins } from "next/font/google"
import { ThemeProvider } from "@/components/theme-provider"
import { GamepadProvider } from "@/components/gamepad-provider"
import { NotificationsProvider, NotificationToastContainer } from "@/components/notifications-system"
// ⚠️ Autosave, avisos de mercado/finanças, revisão de temporada e banco de
// reservas NÃO entram mais aqui: cada um alcança os seeds, e este layout envolve
// até a splash. Agora vivem em `carreira-ativa`, montados só com carreira aberta.
import { CarreiraAtiva } from "@/components/carreira-ativa"
import { ClubesPropriosBridge } from "@/components/clubes-proprios-bridge"
import { DialogoDoJogo } from "@/components/dialogo-do-jogo"
import { PendingInboxGate } from "@/components/pending-inbox-gate"
import { NativeAppProvider } from "@/components/native-app-provider"
import { MusicPlayerWrapper } from "@/components/music-player-wrapper"
import { EaActionBarProvider, EaActionBar } from "@/components/ea-action-bar"
import { FcHubLoader } from "@/components/fc-hub-loader"
import { AvisoAtualizacaoElencos } from "@/components/aviso-atualizacao-elencos"
import { PerformanceProfileBootstrap } from "@/components/performance-profile"
import { MotionProfileProvider } from "@/components/motion-profile"
import { BotaoMinimizar } from "@/components/botao-minimizar"
import { ModoControle } from "@/components/modo-controle"
import { OnlinePorConectividade } from "@/components/online-por-conectividade"
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
// GEOMETRICA, estilo Century Gothic (pedido para o menu principal). A Century
// Gothic e da Monotype e nao pode ser embutida; a Poppins e a substituta
// geometrica mais proxima e livre — mesmo "a" de um andar, mesmas formas
// circulares. O `next/font` baixa no build e SERVE DO PROPRIO PACOTE, entao o
// jogo instalado nao depende de rede nem da fonte existir no Windows.
const poppins = Poppins({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
  variable: "--font-geometrica",
})

export const metadata: Metadata = {
  title: "Ultrafoot 3.0 — Mundo Vivo e Dia de Jogo",
  description: "Simulador de gestão de futebol com mundo persistente, decisões reais no dia de jogo e ligas auditáveis.",
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
    <html lang="pt-BR" className={`bg-background ${geist.variable} ${geistMono.variable} ${oswald.variable} ${poppins.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: performanceBootstrapScript }} />
      </head>
      <body className="font-sans antialiased">
        <NativeAppProvider>
          <ThemeProvider>
            <GamepadProvider>
              <NotificationsProvider>
                {/* Autosave, avisos de mercado/finanças, revisão de temporada e
                    banco de reservas. Só montam com carreira aberta — eram eles
                    que traziam os seeds para a splash. Ver carreira-ativa. */}
                <CarreiraAtiva />
                {/* Publica os clubes criados pelo jogador nas listas de
                    teams-data. Sem carreira aberta também: quem cria um clube
                    precisa vê-lo na tela de nova carreira. */}
                <ClubesPropriosBridge />
                <PendingInboxGate />
                <PerformanceProfileBootstrap />
                <EaActionBarProvider>
                  {/* O modo economico tem que alcancar o framer-motion, que
                      anima em JS e ignora o CSS do perfil. Ver motion-profile. */}
                  <MotionProfileProvider>{children}</MotionProfileProvider>
                  <EaActionBar />
                  <FcHubLoader />
                </EaActionBarProvider>
                <NotificationToastContainer />
                {/* Fora do NotificationsProvider de propósito? Não: fica aqui dentro
                    por conveniência de árvore, mas NÃO usa o sistema de notificações
                    — aquele é escopado por carreira, e correção de elenco é global. */}
                <AvisoAtualizacaoElencos />
                {/* Avisos e confirmações do jogo, no lugar das caixas do Windows. */}
                <DialogoDoJogo />
                <MusicPlayerWrapper />
                {/* Minimizar sem Alt+Tab. Fora da EaActionBar de propósito: aquela
                    some na splash e no editor, e sair do jogo precisa valer em
                    qualquer tela. */}
                <BotaoMinimizar />
                {/* Conectou o controle, o jogo entra em modo controle: navegação
                    global nas telas que não têm handler próprio + barra de
                    comandos. Sem controle não monta nada. */}
                <ModoControle />
                {/* Liga o online sozinho quando ha internet alcancavel — a menos que
                    o jogador ja tenha decidido nas Configuracoes. */}
                <OnlinePorConectividade />
              </NotificationsProvider>
            </GamepadProvider>
          </ThemeProvider>
        </NativeAppProvider>
      </body>
    </html>
  )
}
