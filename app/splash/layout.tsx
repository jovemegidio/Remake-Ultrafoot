import type { Metadata, Viewport } from "next"

export const metadata: Metadata = {
  title: "Ultrafoot 26 - Carregando",
  description: "Simulador de gerenciamento de futebol brasileiro",
}

export const viewport: Viewport = {
  themeColor: "#000000",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
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
