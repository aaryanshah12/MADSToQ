import fs from 'fs'
import type { Browser } from 'puppeteer-core'

const LAUNCH_ARGS = [
  '--no-sandbox',
  '--disable-setuid-sandbox',
  '--disable-dev-shm-usage',
  '--font-render-hinting=none',
]

function resolveSystemChrome(): string | undefined {
  if (process.env.PUPPETEER_EXECUTABLE_PATH?.trim()) {
    return process.env.PUPPETEER_EXECUTABLE_PATH.trim()
  }
  const candidates = [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
  ]
  return candidates.find((p) => {
    try {
      return fs.existsSync(p)
    } catch {
      return false
    }
  })
}

/**
 * Launch a headless Chromium for PDF/HTML rendering on any host:
 * - env `PUPPETEER_EXECUTABLE_PATH` or system Chrome when present (local/dev)
 * - packaged `@sparticuz/chromium` on Linux cloud hosts without system Chrome
 * - full `puppeteer` download cache as a last resort (macOS/Windows)
 */
export async function launchHeadlessBrowser(): Promise<Browser> {
  const systemChrome = resolveSystemChrome()
  if (systemChrome) {
    const puppeteer = await import('puppeteer-core')
    return puppeteer.default.launch({
      headless: true,
      executablePath: systemChrome,
      args: LAUNCH_ARGS,
    })
  }

  if (process.platform === 'linux') {
    const chromium = await import('@sparticuz/chromium')
    const puppeteer = await import('puppeteer-core')
    chromium.default.setGraphicsMode = false
    return puppeteer.default.launch({
      args: puppeteer.default.defaultArgs({
        args: chromium.default.args,
        headless: 'shell',
      }),
      defaultViewport: {
        deviceScaleFactor: 1,
        hasTouch: false,
        height: 1080,
        isLandscape: false,
        isMobile: false,
        width: 1280,
      },
      executablePath: await chromium.default.executablePath(),
      headless: 'shell',
    })
  }

  const puppeteer = await import('puppeteer')
  return puppeteer.default.launch({
    headless: true,
    args: LAUNCH_ARGS,
  })
}
