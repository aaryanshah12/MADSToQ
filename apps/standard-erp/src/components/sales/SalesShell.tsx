'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import clsx from 'clsx'
import {
  LayoutDashboard, Users, FileText, ClipboardList,
  Wallet, Bell, LogOut, Menu, X, Sun, Moon, ChevronRight, BookOpen,
} from 'lucide-react'
import { useSalesUser } from '@/contexts/SalesUserContext'
import NotificationBell from '@/components/sales/NotificationBell'

const BASE = '/personal/sales'

const NAV = [
  { href: `${BASE}/dashboard`,        label: 'Dashboard',       icon: LayoutDashboard },
  { href: `${BASE}/leads`,            label: 'Leads',           icon: Users },
  { href: `${BASE}/quotations`,       label: 'Quotations',      icon: FileText },
  { href: `${BASE}/purchase-orders`,  label: 'Purchase Orders', icon: ClipboardList },
  { href: `${BASE}/expenses`,         label: 'Expenses',        icon: Wallet },
]

export default function SalesShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const { membership, org, signOut, loading } = useSalesUser()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [theme, setTheme] = useState<'dark' | 'light'>('light')
  const [themeMounted, setThemeMounted] = useState(false)

  useEffect(() => {
    const saved = (localStorage.getItem('sales-theme') as 'dark' | 'light' | null) ?? 'light'
    setTheme(saved)
    document.documentElement.dataset.theme = saved
    setThemeMounted(true)
  }, [])

  useEffect(() => {
    if (!themeMounted) return
    document.documentElement.dataset.theme = theme
    localStorage.setItem('sales-theme', theme)
  }, [theme, themeMounted])

  useEffect(() => { setSidebarOpen(false) }, [pathname])

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + '/')

  if (loading || !membership) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--color-bg)' }}>
        <div className="w-8 h-8 border-2 border-current border-t-transparent rounded-full animate-spin text-muted" />
      </div>
    )
  }

  const SidebarInner = () => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="px-6 py-5 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-2xl">💼</span>
          <div>
            <div className="font-display text-lg font-bold text-primary tracking-wider uppercase">
              <span className="text-owner">Sales</span>
            </div>
            <div className="font-mono text-[10px] text-muted tracking-widest truncate">
              {org?.name ?? 'PERSONAL · SALES'}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setTheme(t => t === 'dark' ? 'light' : 'dark')}
            className="text-muted hover:text-primary p-2 border border-border rounded-lg bg-layer-sm"
            aria-label="Toggle theme"
          >
            {!themeMounted || theme === 'dark' ? <Sun size={16}/> : <Moon size={16}/>}
          </button>
          <button onClick={() => setSidebarOpen(false)} className="lg:hidden text-muted hover:text-primary p-1">
            <X size={20}/>
          </button>
        </div>
      </div>

      {/* User */}
      <div className="px-4 py-4 border-b border-border">
        <div className="flex items-center gap-3 rounded-lg px-3 py-2.5 border border-owner/30 bg-owner/10 text-owner">
          <div className="w-8 h-8 rounded-lg bg-owner/20 flex items-center justify-center text-sm font-bold flex-shrink-0">
            {membership.full_name?.charAt(0).toUpperCase() ?? '?'}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold text-primary truncate">{membership.full_name}</div>
            <div className="font-mono text-[10px] uppercase tracking-widest opacity-70 truncate">{membership.email}</div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = isActive(href)
          return (
            <Link
              key={href}
              href={href}
              className={clsx(
                'w-full flex items-center gap-3 px-3 py-3 rounded-lg text-sm transition-all duration-150 group min-h-[44px]',
                active
                  ? 'text-primary font-medium bg-owner/15 border border-owner/30'
                  : 'text-muted hover:text-primary hover:bg-layer-sm'
              )}
            >
              <Icon size={17} className={active ? 'text-owner' : 'text-muted group-hover:text-primary'} />
              {label}
              {active && <ChevronRight size={13} className="ml-auto opacity-50" />}
            </Link>
          )
        })}
      </nav>

      <div className="px-4 py-4 border-t border-border space-y-1">
        <a
          href="/docs/sales-manual.html"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm text-muted hover:text-primary hover:bg-layer-sm transition-all"
        >
          <BookOpen size={16} /> User manual
        </a>
        <button
          onClick={signOut}
          className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm text-muted hover:text-red-400 hover:bg-red-500/10 transition-all"
        >
          <LogOut size={16}/> Sign Out
        </button>
      </div>
    </div>
  )

  return (
    <div className="flex min-h-screen" style={{ background: 'var(--color-bg)', color: 'var(--color-text)' }}>
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex w-64 flex-shrink-0 flex-col fixed top-0 left-0 h-screen z-30"
        style={{ background: 'var(--color-panel)', borderRight: '1px solid var(--color-border)' }}>
        <SidebarInner />
      </aside>

      {/* Mobile overlay (slides from left) */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/60" onClick={() => setSidebarOpen(false)} />
          <aside className="absolute left-0 top-0 h-full w-64 z-50 shadow-2xl"
            style={{ background: 'var(--color-panel)', borderRight: '1px solid var(--color-border)' }}>
            <SidebarInner />
          </aside>
        </div>
      )}

      <div className="flex-1 flex flex-col lg:ml-64">
        {/* Mobile topbar */}
        <div className="lg:hidden flex items-center gap-3 px-4 py-3 border-b border-border"
          style={{ background: 'var(--color-panel)' }}>
          <button onClick={() => setSidebarOpen(true)} className="text-muted hover:text-primary">
            <Menu size={20}/>
          </button>
          <div className="text-sm font-bold text-primary flex-1">Sales</div>
          <NotificationBell />
        </div>

        {/* Desktop topbar (notification bell only) */}
        <div className="hidden lg:flex items-center justify-end gap-3 px-6 py-3 border-b border-border"
          style={{ background: 'var(--color-panel)' }}>
          <NotificationBell />
        </div>

        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  )
}
