/** @type {import('next').NextConfig} */

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

// A VERSAO exibida no jogo sai daqui, do package.json, e nao de uma constante
// escrita a mao: uma constante paralela envelhece em silencio e o rodape passa a
// mentir a versao para quem instalou. Publicar continua sendo bumpar
// package.json + src-tauri/tauri.conf.json, como sempre foi.
const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'))

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

// QUANDO ESTE BUILD FOI FEITO (epoch em segundos).
//
// E o arbitro entre o seed EMBUTIDO e o pacote de elencos BAIXADO. O canal de
// atualizacao foi desligado na 1.0.240 por um motivo concreto: um pacote gravado
// no disco valia para sempre e passava a sobrescrever o elenco de uma build mais
// NOVA com dados mais velhos, sem ninguem para corrigi-lo. Comparar versao do
// pacote com versao do jogo nao resolve — sao numeracoes independentes de
// proposito. Comparar DATAS resolve: um pacote publicado depois deste build so
// pode conhecer o que este build ja conhece, e mais.
const SELO_DO_BUILD = String(Math.floor(Date.now() / 1000))

const nextConfig = {
  env: {
    NEXT_PUBLIC_VERSAO_DO_JOGO: pkg.version,
    NEXT_PUBLIC_SELO_DO_BUILD: SELO_DO_BUILD,
  },
  ...(isTauriBuild
    ? {
        output: 'export',
        trailingSlash: true,
      }
    : {}),
  // Type-check volta a bloquear o build: um erro de tipo (ex.: icone nao importado,
  // que crashava a tela em runtime com "This page couldn't load") agora falha o build
  // ANTES de gerar o instalador, em vez de vazar para o jogador. O job universal
  // do macOS reaproveita a validacao ja feita pelo Linux e pelo gate do deploy:
  // repetir o compilador no runner de 7 GiB esgota a heap antes do build nativo.
  typescript: {
    ignoreBuildErrors: process.env.ULTRAFOOT_SKIP_NEXT_TYPECHECK === '1',
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
    // Os seeds entram no chunk como JSON.parse("...") em vez de literal de objeto.
    // O dado e o mesmo e o import continua sincrono — muda so o parser do V8 que
    // atravessa os 14 MB. Medido em 11/08/2026: 1206 ms -> 558 ms neste PC, e a
    // maquina do jogador e 3 a 5 vezes mais lenta. Ver scripts/seed-json-loader.cjs.
    config.module.rules.push({
      test: /[\\/]data[\\/]seeds[\\/].*\.json$/,
      // Sem isto o webpack trata o arquivo como `type: 'json'` (o padrao para
      // .json) e IGNORA o que o loader devolveu.
      type: 'javascript/auto',
      use: [{ loader: fileURLToPath(new URL('./scripts/seed-json-loader.cjs', import.meta.url)) }],
    })

    if (!isServer && config.optimization?.splitChunks) {
      config.optimization.splitChunks.cacheGroups = {
        ...config.optimization.splitChunks.cacheGroups,
        seeds: {
          test: /[\\/]data[\\/]seeds[\\/].*\.json$/,
          // ⚠️ SEM `name` FIXO — E DE PROPOSITO.
          //
          // Com `name: 'seeds'`, todo seed virava UMA chunk de nome fixo, e o
          // Next passava a anexa-la ao grupo de TODAS as rotas — inclusive as
          // que nao tocam em dado de clube nenhum. A splash carregava 46 MB de
          // JavaScript para desenhar um menu de texto, e o grafo de modulos
          // dizia que ela nao precisava de nada disso (conferido no proprio
          // moduleGraph do webpack em 06/08/2026).
          //
          // Sem o nome, o webpack ainda faz UMA copia compartilhada (o motivo
          // original deste cacheGroup, que existe para nao duplicar o dado), mas
          // so a entrega a quem realmente importa os seeds. Medido: splash de
          // 46,88 MB para 0,95 MB, sem duplicacao no total do build.
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
