/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  async rewrites() {
    return [
      {
        source: '/py-api/:path*',
        destination: 'http://127.0.0.1:8000/api/:path*' // Proxies to the internal Python backend
      },
      {
        source: '/health',
        destination: 'http://127.0.0.1:8000/health' // Proxies health check
      }
    ]
  }
}

export default nextConfig
