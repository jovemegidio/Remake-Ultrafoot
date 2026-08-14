import type { Metadata, Viewport } from "next"

export const metadata: Metadata = {
  title: "Ultrafoot 26 - Carregando",
  description: "Simulador de gerenciamento de futebol brasileiro",
}

// ⚠️ ESTA É A ROTA POR ONDE O CELULAR ABRE (`ROTA_INICIAL` do app, e a janela do
// Tauri no PC). Ela travava a pinça em `maximumScale: 1` enquanto o resto do jogo
// (`app/layout.tsx`) sempre permitiu ampliar — ou seja, justamente na tela de
// escolher carreira, quem não enxerga bem ficava sem a única saída que o
// aparelho oferece. Não há o que a pinça atrapalhe aqui: a splash não arrasta
// nada nem tem gesto próprio.
export const viewport: Viewport = {
  themeColor: "#000000",
  width: "device-width",
  initialScale: 1,
  userScalable: true,
}

export default function SplashLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-black">
      {children}
    </div>
  )
}
