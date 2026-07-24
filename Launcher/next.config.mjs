/** @type {import('next').NextConfig} */
const nextConfig = {
  // Export estático: o Tauri empacota os arquivos de ../out como frontend do app.
  output: "export",
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
}

export default nextConfig
