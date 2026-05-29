'use client'
import { usePathname, useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import { Role } from '@/types'
import clsx from 'clsx'
import { useState, useEffect } from 'react'
import {
  LayoutDashboard, Package, FlaskConical,
  BarChart3, LogOut, ChevronRight,
  Menu, X, Sun, Moon, CalendarRange, ArrowDownToLine, ArrowUpToLine, Settings, TrendingUp,
  Building2, ChevronDown, Check, BookOpen,
} from 'lucide-react'
import { useInventoryFactory, clearInventoryFactory } from '@/contexts/InventoryFactoryContext'
import { PortalWhatsAppHelp } from '@/components/PortalWhatsAppHelp'

interface NavItem { href: string; label: string; icon: React.ReactNode }

const navByRole: Record<Role, NavItem[]> = {
  owner: [
    { href: '/inventory/owner',             label: 'Dashboard',    icon: <LayoutDashboard size={18}/> },
    { href: '/inventory/owner/stock',       label: 'Stock Ledger', icon: <Package size={18}/> },
    { href: '/inventory/owner/usage',       label: 'Usage Log',    icon: <FlaskConical size={18}/> },
    { href: '/inventory/owner/monthly-entry', label: 'Monthly Material', icon: <CalendarRange size={18}/> },
    { href: '/inventory/owner/inout-products', label: 'In/Out Products', icon: <Package size={18}/> },
    { href: '/inventory/owner/inward',      label: 'Inward',       icon: <ArrowDownToLine size={18}/> },
    { href: '/inventory/owner/outward',     label: 'Outward',      icon: <ArrowUpToLine size={18}/> },
    { href: '/inventory/owner/sales',       label: 'Sales',        icon: <TrendingUp size={18}/> },
    { href: '/inventory/owner/reports',     label: 'Reports',    icon: <BarChart3 size={18}/> },
    { href: '/inventory/owner/management', label: 'Management', icon: <Settings size={18}/> },
  ],
  inputer: [
    { href: '/inventory/inputer',         label: 'Dashboard',  icon: <LayoutDashboard size={18}/> },
    { href: '/inventory/inputer/new',     label: 'New Entry',  icon: <Package size={18}/> },
    { href: '/inventory/inputer/history', label: 'My Entries', icon: <BarChart3 size={18}/> },
  ],
  chemist: [
    { href: '/inventory/chemist',         label: 'Dashboard', icon: <LayoutDashboard size={18}/> },
    { href: '/inventory/chemist/use',     label: 'Log Usage', icon: <FlaskConical size={18}/> },
    { href: '/inventory/chemist/monthly-entry', label: 'Monthly Material', icon: <CalendarRange size={18}/> },
    { href: '/inventory/chemist/inward',  label: 'Inward',    icon: <ArrowDownToLine size={18}/> },
    { href: '/inventory/chemist/outward', label: 'Outward',   icon: <ArrowUpToLine size={18}/> },
    { href: '/inventory/chemist/history', label: 'My Usage',  icon: <BarChart3 size={18}/> },
  ],
}

const roleColors: Record<Role, string> = {
  owner:   'text-owner border-owner/30 bg-owner/10',
  inputer: 'text-inputer border-inputer/30 bg-inputer/10',
  chemist: 'text-chemist border-chemist/30 bg-chemist/10',
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { profile, signOut } = useAuth()
  const pathname = usePathname()
  const router   = useRouter()
  const role     = profile?.role ?? 'chemist'
  const navItems = navByRole[role]
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [theme, setTheme] = useState<'dark' | 'light'>('light')
  const [themeMounted, setThemeMounted] = useState(false)
  const [factorySwitcherOpen, setFactorySwitcherOpen] = useState(false)
  const { factoryId, setFactoryId, factories } = useInventoryFactory()

  useEffect(() => { setSidebarOpen(false) }, [pathname])

  // Read saved theme on mount (avoids SSR/client hydration mismatch)
  useEffect(() => {
    const saved = (localStorage.getItem('theme') as 'dark' | 'light' | null) ?? 'light'
    setTheme(saved)
    document.documentElement.dataset.theme = saved
    setThemeMounted(true)
  }, [])

  // Persist theme changes
  useEffect(() => {
    if (!themeMounted) return
    document.documentElement.dataset.theme = theme
    localStorage.setItem('theme', theme)
  }, [theme, themeMounted])

  async function handleSignOut() {
    clearInventoryFactory()
    await signOut()
    router.replace('/inventory/login')
  }

  function navigate(href: string) {
    setSidebarOpen(false)
    router.push(href)
  }

  function toggleTheme() {
    setTheme(t => t === 'dark' ? 'light' : 'dark')
  }

  const accentText = role === 'owner' ? 'text-owner' : role === 'inputer' ? 'text-inputer' : 'text-chemist'
  const accentBg   = role === 'owner' ? 'bg-owner'   : role === 'inputer' ? 'bg-inputer'   : 'bg-chemist'

  const NavLinks = () => (
    <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
      {navItems.map(item => {
        const active = pathname === item.href || (item.href !== `/inventory/${role}` && pathname.startsWith(item.href + '/'))
        return (
          <button
            key={item.href}
            type="button"
            onClick={() => navigate(item.href)}
            onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigate(item.href) }}}
            aria-current={active ? 'page' : undefined}
            style={{ touchAction: 'manipulation' }}
            className={clsx(
              'w-full flex items-center gap-3 px-3 py-3 rounded-lg text-sm transition-all duration-150 group min-h-[48px] active:scale-[0.99]',
              active
                ? clsx('text-primary font-medium',
                    role === 'owner'   ? 'bg-owner/15 border border-owner/30' :
                    role === 'inputer' ? 'bg-inputer/15 border border-inputer/30' :
                                         'bg-chemist/15 border border-chemist/30')
                : 'text-muted hover:text-primary hover:bg-layer-sm'
            )}
          >
            <span className={active ? accentText : 'text-muted group-hover:text-primary'}>
              {item.icon}
            </span>
            {item.label}
            {active && <ChevronRight size={14} className="ml-auto opacity-50" />}
          </button>
        )
      })}
    </nav>
  )

  const SidebarInner = () => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="px-6 py-5 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-2xl">⚗️</span>
          <div>
            <div className="font-display text-lg font-bold text-primary tracking-wider uppercase">
              Chem<span className={accentText}>Factory</span>
            </div>
            <div className="font-mono text-[10px] text-muted tracking-widest">MANAGEMENT PORTAL</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={toggleTheme}
            className="text-muted hover:text-primary p-2 border border-border rounded-lg bg-layer-sm"
            aria-label="Toggle theme"
          >
            {!themeMounted || theme === 'dark' ? <Sun size={16}/> : <Moon size={16}/>}
          </button>
          <button onClick={() => setSidebarOpen(false)} className="lg:hidden text-muted hover:text-primary p-1">
            <X size={20} />
          </button>
        </div>
      </div>

      {/* Profile */}
      <div className="px-4 py-4 border-b border-border">
        <div className={clsx('flex items-center gap-3 rounded-lg px-3 py-2.5 border', roleColors[role])}>
          <div className="w-8 h-8 rounded-lg bg-current/10 flex items-center justify-center text-sm font-bold flex-shrink-0">
            {profile?.full_name?.charAt(0).toUpperCase() ?? '?'}
          </div>
          <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-primary truncate">{profile?.full_name}</div>
            <div className="font-mono text-[10px] uppercase tracking-widest opacity-70">{role}</div>
          </div>
        </div>
      </div>

      <NavLinks />

      {/* Factory switcher */}
      {factories.length > 1 && (
        <div className="px-4 py-3 border-t border-border">
          <div className="font-mono text-[10px] text-muted uppercase tracking-widest mb-2">Factory</div>
          <div className="relative">
            <button
              onClick={() => setFactorySwitcherOpen(v => !v)}
              className="flex items-center justify-between w-full px-3 py-2 rounded-lg border text-sm font-medium transition-all"
              style={{ borderColor: 'var(--color-border)', background: 'var(--color-layer-sm)', color: 'var(--color-text)' }}
            >
              <div className="flex items-center gap-2">
                <Building2 size={13} className={accentText} />
                <span className="truncate">{factories.find(f => f.id === factoryId)?.name ?? 'Select factory'}</span>
              </div>
              <ChevronDown size={13} className="text-muted flex-shrink-0" />
            </button>
            {factorySwitcherOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setFactorySwitcherOpen(false)} />
                <div
                  className="absolute left-0 right-0 bottom-full mb-1 z-50 rounded-xl border overflow-hidden shadow-xl"
                  style={{ background: 'var(--color-panel)', borderColor: 'var(--color-border)' }}
                >
                  {factories.map(f => (
                    <button
                      key={f.id}
                      onClick={() => { setFactoryId(f.id); setFactorySwitcherOpen(false) }}
                      className="flex items-center justify-between w-full px-3 py-2.5 text-sm transition-all hover:bg-layer-sm"
                    >
                      <span style={{ color: f.id === factoryId ? `var(--color-${role})` : 'var(--color-text)', fontWeight: f.id === factoryId ? 600 : 400 }}>
                        {f.name}
                      </span>
                      {f.id === factoryId && <Check size={13} style={{ color: `var(--color-${role})` }} />}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      <div className="px-4 py-4 border-t border-border space-y-1">
        <PortalWhatsAppHelp portalName="Inventory Portal" />
        <a
          href="/inventory/manual"
          className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm text-muted hover:text-primary hover:bg-layer-sm transition-all"
        >
          <BookOpen size={16} />
          User manual
        </a>
        <button
          onClick={handleSignOut}
          className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm text-muted hover:text-red-400 hover:bg-red-500/10 transition-all"
        >
          <LogOut size={16} />
          Sign Out
        </button>
      </div>
    </div>
  )

  return (
    <div className="flex min-h-screen">

      {/* Desktop sidebar */}
      <aside className="hidden lg:flex w-64 flex-shrink-0 bg-panel border-r border-border flex-col fixed top-0 left-0 h-screen z-30">
        <SidebarInner />
      </aside>

      {/* Mobile sidebar overlay (slides from left) */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setSidebarOpen(false)} />
          <aside className="absolute top-0 left-0 h-full w-72 bg-panel border-r border-border flex flex-col z-50 shadow-2xl">
            <SidebarInner />
          </aside>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 lg:ml-64 flex flex-col min-h-screen">

        {/* Mobile top bar */}
        <div className="lg:hidden sticky top-0 z-20 flex items-center gap-2 px-4 py-3 bg-panel border-b border-border">
          <button onClick={() => setSidebarOpen(true)} className="text-muted hover:text-primary p-2 flex-shrink-0">
            <Menu size={22} />
          </button>
          <div className="font-display text-base font-bold text-primary tracking-wider uppercase flex-1 min-w-0 truncate">
            Chem<span className={accentText}>Factory</span>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {/* Mobile factory switcher */}
            {factories.length > 1 && (
              <div className="relative">
                <button
                  onClick={() => setFactorySwitcherOpen(v => !v)}
                  className={clsx('flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-lg border transition-all', roleColors[role])}
                >
                  <Building2 size={11} />
                  <span className="max-w-[80px] truncate">{factories.find(f => f.id === factoryId)?.name ?? 'Factory'}</span>
                  <ChevronDown size={10} />
                </button>
                {factorySwitcherOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setFactorySwitcherOpen(false)} />
                    <div
                      className="absolute right-0 top-full mt-1 w-48 z-50 rounded-xl border overflow-hidden shadow-xl"
                      style={{ background: 'var(--color-panel)', borderColor: 'var(--color-border)' }}
                    >
                      {factories.map(f => (
                        <button
                          key={f.id}
                          onClick={() => { setFactoryId(f.id); setFactorySwitcherOpen(false) }}
                          className="flex items-center justify-between w-full px-3 py-2.5 text-sm transition-all hover:bg-layer-sm"
                        >
                          <span style={{ color: f.id === factoryId ? `var(--color-${role})` : 'var(--color-text)', fontWeight: f.id === factoryId ? 600 : 400 }}>
                            {f.name}
                          </span>
                          {f.id === factoryId && <Check size={13} style={{ color: `var(--color-${role})` }} />}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}
            <button
              onClick={toggleTheme}
              className="text-muted hover:text-primary p-2 border border-border rounded-lg bg-layer-sm"
              aria-label="Toggle theme"
            >
              {!themeMounted || theme === 'dark' ? <Sun size={16}/> : <Moon size={16}/>}
            </button>
            <div className={clsx('w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold flex-shrink-0', roleColors[role])}>
              {profile?.full_name?.charAt(0).toUpperCase() ?? '?'}
            </div>
          </div>
        </div>

        <main className="flex-1 grid-bg">
          {children}
        </main>

      </div>
    </div>
  )
}
