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
} from 'lucide-react'
import { usePMC } from '@/contexts/PMCContext'

const BASE = '/pmc'

const NAV = [
  { href: `${BASE}/dashboard`, label: 'Dashboard', icon: LayoutDashboard },
  { href: `${BASE}/references`, label: 'Reference Number', icon: Hash },
  { href: `${BASE}/products`, label: 'Products', icon: Package },
  { href: `${BASE}/master`, label: 'Master', icon: Database },
]

export default function PMCLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const { loading, email, signOut } = usePMC()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [theme, setTheme] = useState<'dark' | 'light'>('light')
  const [themeMounted, setThemeMounted] = useState(false)

  useEffect(() => {
    const saved = (localStorage.getItem('pmc-theme') as 'dark' | 'light' | null) ?? 'light'
    setTheme(saved)
    document.documentElement.dataset.theme = saved
    setThemeMounted(true)
  }, [])

  useEffect(() => {
    if (!themeMounted) return
    document.documentElement.dataset.theme = theme
    localStorage.setItem('pmc-theme', theme)
  }, [theme, themeMounted])

  useEffect(() => {
    if (!loading && !email) router.replace('/pmc')
  }, [loading, email, router])

  useEffect(() => setSidebarOpen(false), [pathname])

  if (loading || !email) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--color-bg)' }}>
        <div className="w-8 h-8 border-2 border-current border-t-transparent rounded-full animate-spin text-muted" />
      </div>
    )
  }

  const isActive = (href: string) =>
    pathname === href || (href !== `${BASE}/master` && pathname.startsWith(href + '/'))

  const Sidebar = () => (
    <div className="flex flex-col h-full">
      <div className="px-6 py-5 border-b border-border flex items-center justify-between">
        <div>
          <div className="font-display text-lg font-bold tracking-wider uppercase" style={{ color: 'var(--color-pmc)' }}>
            PMC Portal
          </div>
          <div className="font-mono text-[10px] text-muted tracking-widest">Product pricing</div>
        </div>
        <button
          type="button"
          onClick={() => setSidebarOpen(false)}
          className="lg:hidden text-muted hover:text-primary p-1"
          aria-label="Close menu"
        >
          <X size={20} />
        </button>
      </div>
      <nav className="flex-1 px-3 py-4 space-y-1">
        {NAV.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={clsx(
              'flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors',
              isActive(href)
                ? 'bg-layer border border-border text-primary'
                : 'text-muted hover:text-primary hover:bg-layer-sm'
            )}
          >
            <Icon size={18} style={isActive(href) ? { color: 'var(--color-pmc)' } : undefined} />
            {label}
          </Link>
        ))}
      </nav>
      <div className="p-4 border-t border-border space-y-2">
        <div className="text-xs text-muted truncate px-2">{email}</div>
        <button
          type="button"
          onClick={() => signOut()}
          className="w-full flex items-center gap-2 px-4 py-2 rounded-lg text-sm text-muted hover:text-primary hover:bg-layer-sm"
        >
          <LogOut size={16} /> Sign out
        </button>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen flex" style={{ background: 'var(--color-bg)' }}>
      <aside className="hidden lg:flex w-64 flex-shrink-0 border-r border-border bg-panel">
        <Sidebar />
      </aside>
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setSidebarOpen(false)} />
          <aside className="absolute left-0 top-0 bottom-0 w-64 bg-panel border-r border-border">
            <Sidebar />
          </aside>
        </div>
      )}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="lg:hidden flex items-center justify-between px-4 py-3 border-b border-border bg-panel">
          <button type="button" onClick={() => setSidebarOpen(true)} className="p-2 text-muted" aria-label="Open menu">
            <Menu size={22} />
          </button>
          <span className="font-semibold text-sm" style={{ color: 'var(--color-pmc)' }}>
            PMC
          </span>
          <button
            type="button"
            onClick={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
            className="p-2 text-muted"
            aria-label="Toggle theme"
          >
            {!themeMounted || theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>
        </header>
        <main className="flex-1 p-4 lg:p-8 overflow-auto">{children}</main>
      </div>
    </div>
  )
}
