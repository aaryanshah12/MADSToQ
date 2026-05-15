/** @type {import('next').NextConfig} */
const path = require('path')

const nextConfig = {
  images: {
    domains: ['your-project.supabase.co'],
  },
  async redirects() {
    return [
      { source: '/website', destination: '/', permanent: true },
      { source: '/website/', destination: '/', permanent: true },
      { source: '/website/index.html', destination: '/', permanent: true },
      { source: '/website/about.html', destination: '/about.html', permanent: true },
      { source: '/website/contact.html', destination: '/contact.html', permanent: true },
      { source: '/website/demo.html', destination: '/demo.html', permanent: true },
      { source: '/website/services.html', destination: '/services.html', permanent: true },
      { source: '/website/inventory.html', destination: '/inventory.html', permanent: true },
      { source: '/website/io.html', destination: '/io.html', permanent: true },
      { source: '/website/portfolio.html', destination: '/portfolio.html', permanent: true },
      { source: '/website/styles.css', destination: '/styles.css', permanent: true },
      { source: '/website/script.js', destination: '/script.js', permanent: true },
      { source: '/website/MADSToQ.png', destination: '/MADSToQ.png', permanent: true },
      { source: '/website/favicon.png', destination: '/favicon.png', permanent: true },
      { source: '/website/Software/:path*', destination: '/Software/:path*', permanent: true },
    ]
  },
  async rewrites() {
    return {
      beforeFiles: [
        { source: '/', destination: '/website/index.html' },
        { source: '/index.html', destination: '/website/index.html' },
        { source: '/about.html', destination: '/website/about.html' },
        { source: '/contact.html', destination: '/website/contact.html' },
        { source: '/demo.html', destination: '/website/demo.html' },
        { source: '/services.html', destination: '/website/services.html' },
        { source: '/inventory.html', destination: '/website/inventory.html' },
        { source: '/io.html', destination: '/website/io.html' },
        { source: '/portfolio.html', destination: '/website/portfolio.html' },
        { source: '/portfolio/:path*', destination: '/website/portfolio/:path*' },
        { source: '/styles.css', destination: '/website/styles.css' },
        { source: '/script.js', destination: '/website/script.js' },
        { source: '/MADSToQ.png', destination: '/website/MADSToQ.png' },
        { source: '/Software/:path*', destination: '/website/Software/:path*' },
      ],
    }
  },
  webpack: (config) => {
    config.resolve.alias = {
      ...(config.resolve.alias || {}),
      '@': path.resolve(__dirname, 'src'),
    }
    return config
  },
}

module.exports = nextConfig
