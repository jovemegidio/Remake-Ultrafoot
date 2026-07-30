/**
 * Painel de administracao do Ultrafoot.
 *
 * Sai como SITE ESTATICO (`output: 'export'`): o nginx da VPS serve os arquivos
 * de /var/www/ultrafoot/painel/ e nao existe Node rodando para isto. Toda a
 * inteligencia vive no servidor de contas, atras de /auth.
 */

// O painel mora numa subpasta, entao os caminhos dos arquivos gerados precisam
// carregar esse prefixo — sem ele o navegador pediria /_next/... na raiz do site
// e a pagina abriria sem estilo nenhum.
const PREFIXO = process.env.PAINEL_BASE_PATH ?? '/painel'

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  basePath: PREFIXO,
  // Com barra no fim o nginx resolve /painel/ direto pelo index.html do diretorio.
  trailingSlash: true,
  images: { unoptimized: true },
  // O painel mexe em conta e em dinheiro: erro de tipo tem de derrubar o build,
  // nao virar surpresa em producao.
  typescript: { ignoreBuildErrors: false },
  // `basePath` nao alcanca <img src>. Exposto aqui para os poucos casos em que
  // montamos o caminho de um arquivo de /public na mao.
  env: { NEXT_PUBLIC_BASE_PATH: PREFIXO },
}

export default nextConfig
