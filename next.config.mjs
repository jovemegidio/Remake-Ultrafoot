/** @type {import('next').NextConfig} */

// O app e empacotado como build estatico para o Tauri (`output: 'export'` +
// `trailingSlash: true`). Porem, essa combinacao conflita com o proxy do
// preview (Vercel / v0), que serve um build de PRODUCAO e entra em loop de
// redirecionamento (ERR_TOO_MANY_REDIRECTS). Por isso nao podemos depender de
// `NODE_ENV` (o preview tambem roda em producao).
//
// A exportacao estatica so deve acontecer durante o empacotamento do Tauri.
// O Tauri injeta automaticamente as variaveis `TAURI_ENV_*` ao rodar o
// `beforeBuildCommand`, entao detectamos esse contexto via `TAURI_ENV_PLATFORM`.
// Tambem aceitamos uma flag explicita `TAURI_BUILD=1` para builds manuais.
const isTauriBuild = Boolean(process.env.TAURI_ENV_PLATFORM) || process.env.TAURI_BUILD === '1'

const nextConfig = {
  ...(isTauriBuild
    ? {
        output: 'export',
        trailingSlash: true,
      }
    : {}),
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
  },
}

export default nextConfig
