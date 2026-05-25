'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { useIOFactory } from '@/contexts/IOFactoryContext'
import clsx from 'clsx'
import {
  LayoutDashboard, ArrowDownToLine, ArrowUpToLine,
  Home, Globe, FileText, BookOpen,
  LogOut, Menu, X, Sun, Moon, ChevronRight, ChevronDown, Building2, Check,
} from 'lucide-react'

const BASE          = '/inward-outward'
const SESSION_KEY   = 'io-last-activity'
const EMAIL_KEY     = 'io-last-email'
const INACTIVITY_MS = 24 * 60 * 60 * 1000   // 24 hours
const CHECK_INTERVAL = 60 * 1000             // check every minute

const NAV = [
  { href: `${BASE}/dashboard`,      label: 'Dashboard',     icon: LayoutDashboard },
  { href: `${BASE}/inward`,         label: 'Inward',        icon: ArrowDownToLine },
  { href: `${BASE}/outward`,        label: 'Outward',       icon: ArrowUpToLine },
  { href: `${BASE}/domestic`,       label: 'Domestic',      icon: Home },
  { href: `${BASE}/international`,  label: 'International', icon: Globe },
  { href: `${BASE}/quotation`,      label: 'Quotation',     icon: FileText },
  { href: `${BASE}/master`,         label: 'Master',        icon: BookOpen },
]

export default function IOLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const { user: authUser, profile, loading: authLoading } = useAuth()
  const { factoryId, setFactoryId, factories } = useIOFactory()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [theme, setTheme] = useState<'dark' | 'light'>('light')
  const [themeMounted, setThemeMounted] = useState(false)
  const [factorySwitcherOpen, setFactorySwitcherOpen] = useState(false)
  const [topbarSwitcherOpen, setTopbarSwitcherOpen] = useState(false)

  useEffect(() => {
    if (authLoading) return
    if (!authUser) {
      router.replace('/inward-outward/login')
      return
    }

    const last = parseInt(localStorage.getItem(SESSION_KEY) ?? '0', 10)
    if (last && Date.now() - last > INACTIVITY_MS) {
      localStorage.removeItem('io-factory-id')
      void supabase.auth.signOut()
      router.replace('/inward-outward/login')
      return
    }

  }, [authLoading, authUser, router])

  // Activity tracking — update timestamp on every interaction
  useEffect(() => {
    const bump = () => localStorage.setItem(SESSION_KEY, Date.now().toString())
    const events = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll']
    events.forEach(ev => window.addEventListener(ev, bump, { passive: true }))

    // Periodic check every minute
    const timer = setInterval(() => {
      const last = parseInt(localStorage.getItem(SESSION_KEY) ?? '0', 10)
      if (last && Date.now() - last > INACTIVITY_MS) {
        localStorage.removeItem('io-factory-id')
        supabase.auth.signOut()
        router.replace('/inward-outward/login')
      }
    }, CHECK_INTERVAL)

    return () => {
      events.forEach(ev => window.removeEventListener(ev, bump))
      clearInterval(timer)
    }
  }, [])

  useEffect(() => {
    const saved = (localStorage.getItem('io-theme') as 'dark' | 'light' | null) ?? 'light'
    setTheme(saved)
    document.documentElement.dataset.theme = saved
    setThemeMounted(true)
  }, [])

  useEffect(() => {
    if (!themeMounted) return
    document.documentElement.dataset.theme = theme
    localStorage.setItem('io-theme', theme)
  }, [theme, themeMounted])

  useEffect(() => { setSidebarOpen(false) }, [pathname])

  const handleLogout = async () => {
    if (authUser?.email) localStorage.setItem(EMAIL_KEY, authUser.email)
    localStorage.removeItem(SESSION_KEY)
    localStorage.removeItem('io-factory-id')
    await supabase.auth.signOut()
    router.replace('/inward-outward/login')
  }

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + '/')

  const SidebarInner = () => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="px-6 py-5 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-2xl">📦</span>
          <div>
            <div className="font-display text-lg font-bold text-primary tracking-wider uppercase">
              I/<span className="text-inputer">O</span> Portal
            </div>
            <div className="font-mono text-[10px] text-muted tracking-widest">INWARD · OUTWARD</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setTheme(t => t === 'dark' ? 'light' : 'dark')}
            className="text-muted hover:text-primary p-2 border border-border rounded-lg bg-layer-sm"
          >
            {!themeMounted || theme === 'dark' ? <Sun size={16}/> : <Moon size={16}/>}
          </button>
          <button onClick={() => setSidebarOpen(false)} className="lg:hidden text-muted hover:text-primary p-1">
            <X size={20}/>
          </button>
        </div>
      </div>

      {/* User badge */}
      <div className="px-4 py-4 border-b border-border">
        <div className="flex items-center gap-3 rounded-lg px-3 py-2.5 border text-inputer border-inputer/30 bg-inputer/10">
          <div className="w-8 h-8 rounded-lg bg-inputer/20 flex items-center justify-center text-sm font-bold flex-shrink-0 text-inputer">
            {authUser?.email?.charAt(0).toUpperCase() ?? '?'}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold text-primary truncate">{authUser?.email ?? '—'}</div>
            <div className="font-mono text-[10px] uppercase tracking-widest opacity-70">I/O User</div>
          </div>
        </div>
      </div>

      {/* Factory switcher — only if multiple factories */}
      {factories.length > 1 && (
        <div className="px-4 py-3 border-b border-border">
          <p className="text-[10px] font-mono uppercase tracking-widest text-muted mb-1.5">Factory</p>
          <div className="relative">
            <button
              onClick={() => setFactorySwitcherOpen(v => !v)}
              className="flex items-center justify-between w-full px-3 py-2 rounded-lg border text-sm font-medium transition-all hover:border-inputer/50"
              style={{ borderColor: 'var(--color-border)', background: 'var(--color-layer-sm)', color: 'var(--color-text)' }}
            >
              <div className="flex items-center gap-2">
                <Building2 size={13} style={{ color: 'var(--color-inputer)' }} />
                <span>{factories.find(f => f.id === factoryId)?.name ?? 'Select factory'}</span>
              </div>
              <ChevronDown size={13} style={{ color: 'var(--color-muted)' }} />
            </button>
            {factorySwitcherOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setFactorySwitcherOpen(false)} />
                <div
                  className="absolute left-0 right-0 top-full mt-1 z-50 rounded-xl border overflow-hidden shadow-xl"
                  style={{ background: 'var(--color-panel)', borderColor: 'var(--color-border)' }}
                >
                  {factories.map(f => (
                    <button
                      key={f.id}
                      onClick={() => { setFactoryId(f.id); setFactorySwitcherOpen(false) }}
                      className="flex items-center justify-between w-full px-3 py-2.5 text-sm transition-all hover:bg-inputer/10"
                    >
                      <span style={{ color: f.id === factoryId ? 'var(--color-inputer)' : 'var(--color-text)', fontWeight: f.id === factoryId ? 600 : 400 }}>
                        {f.name}
                      </span>
                      {f.id === factoryId && <Check size={13} style={{ color: 'var(--color-inputer)' }} />}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      )}

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
                  ? 'text-primary font-medium bg-inputer/15 border border-inputer/30'
                  : 'text-muted hover:text-primary hover:bg-layer-sm'
              )}
            >
              <Icon
                size={17}
                className={active ? 'text-inputer' : 'text-muted group-hover:text-primary'}
              />
              {label}
              {active && <ChevronRight size={13} className="ml-auto opacity-50" />}
            </Link>
          )
        })}
      </nav>

      <div className="px-4 py-4 border-t border-border space-y-1">
        <a
          href="/inward-outward/manual"
          className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm text-muted hover:text-primary hover:bg-layer-sm transition-all"
        >
          <BookOpen size={16} /> User manual
        </a>
        <button
          onClick={handleLogout}
          className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm text-muted hover:text-red-400 hover:bg-red-500/10 transition-all"
        >
          <LogOut size={16}/> Sign Out
        </button>
      </div>
    </div>
  )

  return (
    <div
      className="flex min-h-screen min-w-0 overflow-x-hidden"
      style={{ background: 'var(--color-bg)', color: 'var(--color-text)' }}
    >
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex w-64 flex-shrink-0 flex-col fixed top-0 left-0 h-screen z-30"
        style={{ background: 'var(--color-panel)', borderRight: '1px solid var(--color-border)' }}>
        <SidebarInner />
      </aside>

      {/* Mobile overlay (slides from left) */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/60" onClick={() => setSidebarOpen(false)} aria-hidden />
          <aside
            className="absolute left-0 top-0 h-full w-[min(20rem,calc(100vw-1rem))] max-w-[calc(100vw-1rem)] z-50 shadow-2xl flex flex-col min-w-0"
            style={{ background: 'var(--color-panel)', borderRight: '1px solid var(--color-border)' }}
          >
            <SidebarInner />
          </aside>
        </div>
      )}

      {/* Main */}
      <div className="flex-1 flex flex-col lg:ml-64 min-w-0">
        {/* Mobile topbar */}
        <div
          className="lg:hidden flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-3 border-b border-border min-h-[52px]"
          style={{ background: 'var(--color-panel)' }}
        >
          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            className="text-muted hover:text-primary shrink-0 p-2 -m-1 rounded-lg min-h-[44px] min-w-[44px] flex items-center justify-center"
            aria-label="Open menu"
          >
            <Menu size={20}/>
          </button>
          <div className="text-sm font-bold text-primary flex-1 min-w-0 truncate pr-1">I/O Portal</div>

          {/* Mobile factory switcher */}
          {factories.length > 1 && (
            <div className="relative shrink-0 max-w-[45%]">
              <button
                type="button"
                onClick={() => setTopbarSwitcherOpen(v => !v)}
                className="flex items-center gap-1.5 text-xs font-medium px-2 py-1.5 rounded-lg border transition-all hover:border-inputer/50 max-w-full min-h-[40px]"
                style={{ borderColor: 'var(--color-inputer)', background: 'color-mix(in srgb, var(--color-inputer) 12%, transparent)', color: 'var(--color-inputer)' }}
              >
                <Building2 size={11} className="shrink-0" />
                <span className="truncate min-w-0">{factories.find(f => f.id === factoryId)?.name ?? 'Factory'}</span>
                <ChevronDown size={10} className="shrink-0" />
              </button>
              {topbarSwitcherOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setTopbarSwitcherOpen(false)} />
                  <div
                    className="absolute right-0 top-full mt-1 w-48 z-50 rounded-xl border overflow-hidden shadow-xl"
                    style={{ background: 'var(--color-panel)', borderColor: 'var(--color-border)' }}
                  >
                    {factories.map(f => (
                      <button
                        key={f.id}
                        onClick={() => { setFactoryId(f.id); setTopbarSwitcherOpen(false) }}
                        className="flex items-center justify-between w-full px-3 py-2.5 text-sm transition-all hover:bg-inputer/10"
                      >
                        <span style={{ color: f.id === factoryId ? 'var(--color-inputer)' : 'var(--color-text)', fontWeight: f.id === factoryId ? 600 : 400 }}>
                          {f.name}
                        </span>
                        {f.id === factoryId && <Check size={13} style={{ color: 'var(--color-inputer)' }} />}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        <main className="flex-1 overflow-y-auto overflow-x-hidden min-w-0 pb-[env(safe-area-inset-bottom)]">
          {children}
        </main>
      </div>
    </div>
  )
}
