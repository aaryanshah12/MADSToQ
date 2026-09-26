/** @type {import('next').NextConfig} */
const fs = require('fs')
const path = require('path')

// Monorepo env lives at the repo root. Next only auto-loads files next to this config.
const rootEnv = path.resolve(__dirname, '../../.env.local')
if (fs.existsSync(rootEnv)) {
  for (const line of fs.readFileSync(rootEnv, 'utf8').split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq === -1) continue
    const key = trimmed.slice(0, eq).trim()
    let val = trimmed.slice(eq + 1).trim()
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1)
    }
    if (!process.env[key]) process.env[key] = val
  }
}

const nextConfig = {
  transpilePackages: [
    '@madstoq/auth',
    '@madstoq/core',
    '@madstoq/database',
    '@madstoq/inventory-system',
    '@madstoq/io-system',
    '@madstoq/sales-system',
    '@madstoq/pmc-system',
    '@madstoq/ui',
    '@madstoq/shared-utils',
    '@madstoq/themes',
  ],
  images: {
    domains: [],
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
      { source: '/website/pmc.html', destination: '/pmc.html', permanent: true },
      { source: '/website/crm.html', destination: '/crm.html', permanent: true },
      { source: '/pmc/login', destination: '/portals/demo/pmc', permanent: false },
      { source: '/pmc', destination: '/portals/demo/pmc', permanent: false },
      { source: '/inventory/login', destination: '/portals/demo/inventory', permanent: false },
      { source: '/inward-outward/login', destination: '/portals/demo/inward-outward', permanent: false },
      { source: '/personal/sales/login', destination: '/portals/demo/sales', permanent: false },
      { source: '/crm/login', destination: '/portals/demo/crm', permanent: false },
      { source: '/portal/demos/crm/login', destination: '/portals/demo/crm', permanent: false },
      { source: '/portal/demos/crm', destination: '/portals/demo/crm', permanent: false },
      { source: '/website/portfolio.html', destination: '/portfolio.html', permanent: true },
      { source: '/website/ahmedabad-it-saas.html', destination: '/ahmedabad-it-saas.html', permanent: true },
      { source: '/website/styles.css', destination: '/styles.css', permanent: true },
      { source: '/website/script.js', destination: '/script.js', permanent: true },
      { source: '/website/MADSToQ.png', destination: '/MADSToQ.png', permanent: true },
      { source: '/website/favicon.png', destination: '/favicon.png', permanent: true },
      { source: '/website/favicon-192.png', destination: '/favicon-192.png', permanent: true },
      { source: '/website/apple-touch-icon.png', destination: '/apple-touch-icon.png', permanent: true },
      { source: '/website/Software/:path*', destination: '/Software/:path*', permanent: true },
      { source: '/website/docs/:path*', destination: '/docs/:path*', permanent: true },
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
        { source: '/pmc.html', destination: '/website/pmc.html' },
        { source: '/crm.html', destination: '/website/crm.html' },
        { source: '/portfolio.html', destination: '/website/portfolio.html' },
        { source: '/ahmedabad-it-saas.html', destination: '/website/ahmedabad-it-saas.html' },
        { source: '/portfolio/:path*', destination: '/website/portfolio/:path*' },
        { source: '/styles.css', destination: '/website/styles.css' },
        { source: '/script.js', destination: '/website/script.js' },
        { source: '/MADSToQ.png', destination: '/website/MADSToQ.png' },
        { source: '/Software/:path*', destination: '/website/Software/:path*' },
        { source: '/docs/:path*', destination: '/website/docs/:path*' },
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
