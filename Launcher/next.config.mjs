/** @type {import('next').NextConfig} */
const nextConfig = {
  // Export estático: o Tauri empacota os arquivos de ../out como frontend do app.
  output: "export",
  // ⚠️ SEM `typescript: { ignoreBuildErrors: true }`.
  //
  // Ele estava aqui e fazia o build passar por cima de QUALQUER erro de tipo —
  // e como o `pnpm lint` também não rodava (o script apontava para um eslint que
  // não está instalado), o launcher não tinha nenhuma checagem estática ativa.
  // O `pnpm typecheck` agora é a checagem de verdade, e o build volta a falhar
  // quando precisa falhar.
  images: {
    unoptimized: true,
  },
}

export default nextConfig
