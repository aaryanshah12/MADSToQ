'use client'
import { usePathname, useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import { Role } from '@/types'
import clsx from 'clsx'
import { useState, useEffect } from 'react'
import {
  LayoutDashboard, Package, FlaskConical,
  BarChart3, LogOut, ChevronRight,
  Menu, X, Sun, Moon, Settings, TrendingUp,
  Building2, ChevronDown, Check, ClipboardList, ClipboardCheck, Inbox, Warehouse, Send,
  BookOpen, IndianRupee, FileText,
} from 'lucide-react'
import { useInventoryFactory, clearInventoryFactory } from '@/contexts/InventoryFactoryContext'

interface NavItem {
  href: string
  label: string
  icon: React.ReactNode
  /** Extra path prefixes that keep this item highlighted. */
  matchHrefs?: string[]
}

const roleHome: Record<Role, string> = {
  owner: '/inventory/owner',
  inputer: '/inventory/inputer',
  chemist: '/inventory/chemist',
  accountant: '/inventory/accountant',
  warehouse_manager: '/inventory/warehouse',
  lab_incharge: '/inventory/lab',
  plant_supervisor: '/inventory/chemist',
}

const navByRole: Record<Role, NavItem[]> = {
  owner: [
    { href: '/inventory/owner',             label: 'Dashboard',    icon: <LayoutDashboard size={18}/> },
    { href: '/inventory/owner/procurement', label: 'Procurement',  icon: <ClipboardList size={18}/> },
    {
      href: '/inventory/owner/rm-qc',
      label: 'QC Approve',
      icon: <ClipboardCheck size={18}/>,
      matchHrefs: ['/inventory/owner/fg-qc'],
    },
    { href: '/inventory/owner/log-book',    label: 'Lab Log Books', icon: <BookOpen size={18}/> },
    { href: '/inventory/owner/stock',       label: 'Stock Ledger', icon: <Package size={18}/> },
    { href: '/inventory/owner/usage',       label: 'Plant Usage',  icon: <FlaskConical size={18}/> },
    { href: '/inventory/owner/production',  label: 'Production',   icon: <FlaskConical size={18}/> },
    { href: '/inventory/owner/dispatch-schedule', label: 'Dispatch Schedule', icon: <TrendingUp size={18}/>, matchHrefs: ['/inventory/owner/sales-dispatch'] },
    { href: '/inventory/owner/sales', label: 'Sales', icon: <IndianRupee size={18}/> },
    { href: '/inventory/owner/management', label: 'Management', icon: <Settings size={18}/> },
  ],
  inputer: [
    { href: '/inventory/inputer',         label: 'Dashboard',  icon: <LayoutDashboard size={18}/> },
    { href: '/inventory/inputer/new',     label: 'New Entry',  icon: <Package size={18}/> },
    { href: '/inventory/inputer/history', label: 'My Entries', icon: <BarChart3 size={18}/> },
  ],
  chemist: [
    { href: '/inventory/chemist',          label: 'Dashboard',   icon: <LayoutDashboard size={18}/> },
    { href: '/inventory/chemist/requests', label: 'My Requests', icon: <ClipboardList size={18}/> },
    { href: '/inventory/chemist/production', label: 'Production', icon: <FlaskConical size={18}/> },
  ],
  accountant: [
    { href: '/inventory/accountant',          label: 'Dashboard', icon: <LayoutDashboard size={18}/> },
    { href: '/inventory/accountant/procurement', label: 'Procurement', icon: <FileText size={18}/> },
    { href: '/inventory/accountant/receive',  label: 'Receive PO', icon: <Inbox size={18}/> },
    { href: '/inventory/accountant/receipts', label: 'Receipts',  icon: <ClipboardList size={18}/> },
    { href: '/inventory/accountant/sales-dispatch', label: 'Dispatch Schedule', icon: <TrendingUp size={18}/> },
  ],
  lab_incharge: [
    { href: '/inventory/lab',       label: 'Dashboard', icon: <LayoutDashboard size={18}/> },
    { href: '/inventory/lab/rm-qc', label: 'RM QC',     icon: <ClipboardCheck size={18}/> },
    { href: '/inventory/lab/fg-qc', label: 'SFG / FG QC',     icon: <FlaskConical size={18}/> },
    { href: '/inventory/lab/coa',   label: 'Dispatch COA', icon: <ClipboardCheck size={18}/> },
    { href: '/inventory/lab/log-book', label: 'Log Books', icon: <BookOpen size={18}/> },
  ],
  warehouse_manager: [
    { href: '/inventory/warehouse',         label: 'Dashboard',       icon: <LayoutDashboard size={18}/> },
    { href: '/inventory/warehouse/stock',   label: 'Warehouse Stock', icon: <Warehouse size={18}/> },
    { href: '/inventory/warehouse/release', label: 'Release Queue',   icon: <Send size={18}/> },
    { href: '/inventory/warehouse/dispatch', label: 'Dispatch',       icon: <Send size={18}/> },
    { href: '/inventory/warehouse/buy-requests', label: 'Buy Requests', icon: <ClipboardList size={18}/> },
  ],
  /** Deprecated — same nav as chemist until profiles migrated */
  plant_supervisor: [
    { href: '/inventory/chemist',          label: 'Dashboard',   icon: <LayoutDashboard size={18}/> },
    { href: '/inventory/chemist/requests', label: 'My Requests', icon: <ClipboardList size={18}/> },
  ],
}

const roleColors: Record<Role, string> = {
  owner:             'text-owner border-owner/30 bg-owner/10',
  inputer:           'text-inputer border-inputer/30 bg-inputer/10',
  chemist:           'text-chemist border-chemist/30 bg-chemist/10',
  accountant:        'text-pmc border-pmc/30 bg-pmc/10',
  warehouse_manager: 'text-pmc border-pmc/30 bg-pmc/10',
  lab_incharge:      'text-chemist border-chemist/30 bg-chemist/10',
  plant_supervisor:  'text-chemist border-chemist/30 bg-chemist/10',
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { profile, signOut } = useAuth()
  const pathname = usePathname()
  const router   = useRouter()
  const role     = (profile?.role ?? 'chemist') as Role
  const navItems = navByRole[role] ?? navByRole.chemist
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

  const home = roleHome[role] ?? '/inventory/chemist'
  const accentText =
    role === 'owner' ? 'text-owner' :
    role === 'inputer' ? 'text-inputer' :
    role === 'accountant' || role === 'warehouse_manager' ? 'text-pmc' :
    'text-chemist'
  const accentBg =
    role === 'owner' ? 'bg-owner' :
    role === 'inputer' ? 'bg-inputer' :
    role === 'accountant' || role === 'warehouse_manager' ? 'bg-pmc' :
    'bg-chemist'

  const isNavActive = (item: (typeof navItems)[number]) =>
    [item.href, ...(item.matchHrefs ?? [])].some((href) =>
      pathname === href || (href !== home && pathname.startsWith(href + '/')),
    )
  const mobileTitle = navItems.find(isNavActive)?.label

  const NavLinks = () => (
    <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
      {navItems.map(item => {
        const active = isNavActive(item)
        return (
          <button
            key={item.href}
            type="button"
            onClick={() => navigate(item.href)}
            onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigate(item.href) }}}
            aria-current={active ? 'page' : undefined}
            style={{ touchAction: 'manipulation' }}
            className={clsx('nav-item group', active && 'nav-item-active')}
          >
            <span className={active ? 'text-current' : 'text-muted group-hover:text-primary'}>
              {item.icon}
            </span>
            {item.label}
            {!active && <ChevronRight size={14} className="ml-auto text-muted opacity-60" />}
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
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden text-muted hover:text-primary p-1"
            aria-label="Close navigation menu"
          >
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

      {/* Current factory */}
      {factories.length > 0 && (
        <div className="px-4 py-3 border-t border-border">
          <div className="font-mono text-[10px] text-muted uppercase tracking-widest mb-2">Current factory</div>
          {factories.length === 1 ? (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium"
              style={{ borderColor: 'var(--color-border)', background: 'var(--color-layer-sm)', color: 'var(--color-text)' }}
            >
              <Building2 size={13} className={accentText} />
              <span className="truncate">{factories[0]?.name}</span>
            </div>
          ) : (
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
          )}
        </div>
      )}

      {/* Sign out */}
      <div className="px-4 py-4 border-t border-border">
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
    <div className="flex min-h-screen min-w-0 overflow-x-clip">

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
      <div className="flex min-h-screen min-w-0 flex-1 flex-col lg:ml-64">

        {/* Mobile top bar */}
        <div className="mobile-topbar lg:hidden sticky top-0 z-20 flex items-center gap-2 px-4 py-3 bg-panel border-b border-border [contain:inline-size]">
          <button
            onClick={() => setSidebarOpen(true)}
            className="text-muted hover:text-primary p-2 flex-shrink-0"
            aria-label="Open navigation menu"
            aria-expanded={sidebarOpen}
          >
            <Menu size={22} />
          </button>
          {mobileTitle ? (
            <div className="flex-1 min-w-0 truncate text-base font-semibold text-primary">
              {mobileTitle}
            </div>
          ) : (
            <div className="font-display text-base font-bold text-primary tracking-wider uppercase flex-1 min-w-0 truncate">
              Chem<span className={accentText}>Factory</span>
            </div>
          )}
        </div>

        <main className="w-full min-w-0 flex-1 overflow-x-clip">
          {children}
        </main>

      </div>
    </div>
  )
}
