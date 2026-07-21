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
  // Type-check volta a bloquear o build: um erro de tipo (ex.: icone nao importado,
  // que crashava a tela em runtime com "This page couldn't load") agora falha o build
  // ANTES de gerar o instalador, em vez de vazar para o jogador.
  typescript: {
    ignoreBuildErrors: false,
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
  // Os seeds (imported-bf2026.json tem 6,4 MB) sao importados por varios modulos
  // de cliente, e o webpack estava INLINANDO uma copia em cada chunk que os
  // alcancava: dois chunks de 6,48 MB, ~13 MB dos 18 MB do build, o mesmo dado
  // duas vezes. Um cacheGroup dedicado forca uma copia unica e compartilhada,
  // que o navegador ainda cacheia entre navegacoes.
  webpack: (config, { isServer }) => {
    if (!isServer && config.optimization?.splitChunks) {
      config.optimization.splitChunks.cacheGroups = {
        ...config.optimization.splitChunks.cacheGroups,
        seeds: {
          test: /[\\/]data[\\/]seeds[\\/].*\.json$/,
          name: 'seeds',
          chunks: 'all',
          priority: 40,
          reuseExistingChunk: true,
          enforce: true,
        },
      }
    }
    return config
  },
}

export default nextConfig
