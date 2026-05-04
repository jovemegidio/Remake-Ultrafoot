/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    // Enable remote patterns for Ultrafoot escudos
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'raw.githubusercontent.com',
        pathname: '/jovemegidio/Ultrafoot/**',
      },
    ],
    // Use unoptimized for external images (Ultrafoot repo)
    unoptimized: true,
  },
  // Enable React Compiler for better performance (Next.js 16)
  reactCompiler: true,
  // Experimental performance features
  experimental: {
    // Optimize CSS
    optimizeCss: true,
    // Better tree shaking
    optimizePackageImports: ['lucide-react', 'recharts', 'date-fns'],
  },
}

export default nextConfig
