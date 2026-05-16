'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import clsx from 'clsx'
import {
  LayoutDashboard,
  Hash,
  Package,
  Database,
  LogOut,
  Menu,
  X,
  Sun,
  Moon,
  ChevronRight,
} from 'lucide-react'
import { usePMC } from '@/contexts/PMCContext'

const BASE = '/pmc'
const THEME_KEY = 'theme'

const NAV = [
  { href: `${BASE}/dashboard`, label: 'Dashboard', icon: LayoutDashboard },
  { href: `${BASE}/references`, label: 'Reference Number', icon: Hash },
  { href: `${BASE}/products`, label: 'Products', icon: Package },
  { href: `${BASE}/master`, label: 'Master', icon: Database },
]

function readTheme(): 'dark' | 'light' {
  if (typeof window === 'undefined') return 'light'
  return (
    (localStorage.getItem(THEME_KEY) as 'dark' | 'light' | null) ??
    (localStorage.getItem('pmc-theme') as 'dark' | 'light' | null) ??
    'light'
  )
}

export default function PMCLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const { loading, email, signOut } = usePMC()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [theme, setTheme] = useState<'dark' | 'light'>('light')
  const [themeMounted, setThemeMounted] = useState(false)

  useEffect(() => {
    const saved = readTheme()
    setTheme(saved)
    document.documentElement.dataset.theme = saved
    setThemeMounted(true)
  }, [])

  useEffect(() => {
    if (!themeMounted) return
    document.documentElement.dataset.theme = theme
    localStorage.setItem(THEME_KEY, theme)
    localStorage.removeItem('pmc-theme')
  }, [theme, themeMounted])

  useEffect(() => {
    if (!loading && !email) router.replace('/pmc')
  }, [loading, email, router])

  useEffect(() => setSidebarOpen(false), [pathname])

  if (loading || !email) {
    return (
      <div
        className="min-h-screen flex items-center justify-center grid-bg"
        style={{ background: 'var(--color-bg)' }}
      >
        <div className="w-8 h-8 border-2 border-pmc border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const isActive = (href: string) =>
    pathname === href || (href !== `${BASE}/master` && pathname.startsWith(href + '/'))

  const SidebarInner = () => (
    <div className="flex flex-col h-full min-h-0">
      <div className="px-4 sm:px-6 py-5 border-b border-border flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <span className="text-2xl shrink-0" aria-hidden>
            📊
          </span>
          <div className="min-w-0">
            <div className="font-display text-base sm:text-lg font-bold text-primary tracking-wider uppercase truncate">
              <span className="text-pmc">PMC</span> Portal
            </div>
            <div className="font-mono text-[10px] text-muted tracking-widest">PRODUCT PRICING</div>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
            className="text-muted hover:text-primary p-2 border border-border rounded-lg bg-layer-sm min-h-[40px] min-w-[40px] flex items-center justify-center"
            aria-label="Toggle theme"
          >
            {!themeMounted || theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
          </button>
          <button
            type="button"
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden text-muted hover:text-primary p-2 min-h-[40px] min-w-[40px] flex items-center justify-center"
            aria-label="Close menu"
          >
            <X size={20} />
          </button>
        </div>
      </div>

      <div className="px-4 py-4 border-b border-border shrink-0">
        <div className="flex items-center gap-3 rounded-lg px-3 py-2.5 border text-pmc border-pmc-30 bg-pmc-10">
          <div className="w-8 h-8 rounded-lg bg-pmc-20 flex items-center justify-center text-sm font-bold flex-shrink-0 text-pmc">
            {email?.charAt(0).toUpperCase() ?? '?'}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold text-primary truncate">{email}</div>
            <div className="font-mono text-[10px] uppercase tracking-widest opacity-70 text-pmc">
              PMC User
            </div>
          </div>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1 min-h-0">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = isActive(href)
          return (
            <Link
              key={href}
              href={href}
              className={clsx(
                'w-full flex items-center gap-3 px-3 py-3 rounded-lg text-sm transition-all duration-150 group min-h-[44px]',
                active ? 'pmc-nav-active' : 'text-muted hover:text-primary hover:bg-layer-sm'
              )}
            >
              <Icon
                size={17}
                className={active ? 'text-pmc' : 'text-muted group-hover:text-primary'}
              />
              <span className="truncate">{label}</span>
              {active && <ChevronRight size={13} className="ml-auto opacity-50 shrink-0" />}
            </Link>
          )
        })}
      </nav>

      <div className="px-4 py-4 border-t border-border shrink-0">
        <button
          type="button"
          onClick={() => signOut()}
          className="flex items-center gap-2 w-full px-3 py-2.5 rounded-lg text-sm text-muted hover:text-red-400 hover:bg-red-500/10 transition-all min-h-[44px]"
        >
          <LogOut size={16} /> Sign out
        </button>
      </div>
    </div>
  )

  return (
    <div
      className="flex min-h-screen min-w-0 overflow-x-hidden grid-bg"
      style={{ background: 'var(--color-bg)', color: 'var(--color-text)' }}
    >
      <aside
        className="hidden lg:flex w-64 flex-shrink-0 flex-col fixed top-0 left-0 h-screen z-30"
        style={{ background: 'var(--color-panel)', borderRight: '1px solid var(--color-border)' }}
      >
        <SidebarInner />
      </aside>

      {sidebarOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            className="absolute inset-0 bg-black/60"
            onClick={() => setSidebarOpen(false)}
            aria-hidden
          />
          <aside
            className="absolute left-0 top-0 h-full w-[min(20rem,calc(100vw-1rem))] max-w-[calc(100vw-1rem)] z-50 shadow-2xl flex flex-col min-w-0"
            style={{ background: 'var(--color-panel)', borderRight: '1px solid var(--color-border)' }}
          >
            <SidebarInner />
          </aside>
        </div>
      )}

      <div className="flex-1 flex flex-col lg:ml-64 min-w-0">
        <div
          className="lg:hidden flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-3 border-b border-border min-h-[52px] shrink-0"
          style={{ background: 'var(--color-panel)' }}
        >
          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            className="text-muted hover:text-primary shrink-0 p-2 -m-1 rounded-lg min-h-[44px] min-w-[44px] flex items-center justify-center"
            aria-label="Open menu"
          >
            <Menu size={20} />
          </button>
          <div className="text-sm font-bold text-primary flex-1 min-w-0 truncate pr-1">
            <span className="text-pmc">PMC</span> Portal
          </div>
          <button
            type="button"
            onClick={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
            className="text-muted hover:text-primary shrink-0 p-2 rounded-lg min-h-[44px] min-w-[44px] flex items-center justify-center border border-border bg-layer-sm"
            aria-label="Toggle theme"
          >
            {!themeMounted || theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
          </button>
        </div>

        <main className="flex-1 overflow-y-auto overflow-x-hidden min-w-0 px-3 sm:px-4 lg:px-8 py-4 lg:py-6 pb-[max(1rem,env(safe-area-inset-bottom))]">
          {children}
        </main>
      </div>
    </div>
  )
}
