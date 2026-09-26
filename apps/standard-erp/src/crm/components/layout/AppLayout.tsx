import { type ReactNode, useState } from 'react'
import { NavLink, useLocation, useNavigate } from '@/crm/router'
import {
  Building2,
  LayoutGrid,
  Map,
  Moon,
  Sun,
  Users,
  Wallet,
  FileText,
  Menu,
  X,
  Landmark,
  Handshake,
  LogOut,
  UserRound,
  UsersRound,
  KeyRound,
} from 'lucide-react'
import { useTheme } from '../../context/ThemeContext'
import { useAuth } from '../../context/AuthContext'
import { USER_ROLE_LABELS } from '../../types/auth'
import { Button } from '../ui/Form'

const nav: Array<{
  to: string
  label: string
  icon: typeof Landmark
  exact?: boolean
  adminOnly?: boolean
  /** Hide from these roles */
  hideFor?: Array<'admin' | 'sales' | 'accountant'>
}> = [
  { to: '/', label: 'Schemes', icon: Landmark, exact: true },
  { to: '/schemes/new', label: 'New Scheme', icon: LayoutGrid, adminOnly: true },
  { to: '/plots', label: 'Blocks & Plots', icon: Map },
  { to: '/leads', label: 'Leads', icon: Users, hideFor: ['accountant'] },
  { to: '/brokers', label: 'Brokers', icon: Handshake },
  { to: '/bookings', label: 'Bookings', icon: FileText },
  { to: '/payments', label: 'Pending Payments', icon: Wallet },
  { to: '/other-payments', label: 'Other Payments', icon: Landmark },
  { to: '/handover', label: 'Handover', icon: KeyRound },
  { to: '/team', label: 'Team', icon: UsersRound },
  { to: '/users', label: 'Users', icon: UserRound, adminOnly: true },
]

export function AppLayout({ children }: { children: ReactNode }) {
  const { theme, toggleTheme } = useTheme()
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const location = useLocation()

  const visibleNav = nav.filter((item) => {
    if (item.adminOnly && user?.role !== 'admin') return false
    if (user?.role && item.hideFor?.includes(user.role)) return false
    return true
  })

  const handleLogout = () => {
    logout()
    navigate('/portals/demo/crm', { replace: true })
  }

  return (
    <div className="min-h-screen bg-canvas text-ink">
      <div className="flex min-h-screen">
        <aside
          className={`fixed inset-y-0 left-0 z-40 w-64 transform border-r border-line bg-sidebar text-sidebar-ink transition-transform lg:static lg:translate-x-0 ${
            open ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          <div className="flex h-16 items-center gap-3 border-b border-white/10 px-5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand text-brand-ink">
              <Building2 className="h-5 w-5" />
            </div>
            <div>
              <div className="font-display text-xl leading-none tracking-tight">
                PlotCRM
              </div>
              <div className="text-[11px] uppercase tracking-[0.14em] text-sidebar-muted">
                Developer Suite
              </div>
            </div>
            <button
              type="button"
              className="ml-auto rounded-lg p-2 text-sidebar-muted hover:bg-sidebar-active lg:hidden"
              onClick={() => setOpen(false)}
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <nav className="space-y-1 p-3 pb-36">
            {visibleNav.map((item) => {
              const Icon = item.icon
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.exact}
                  onClick={() => setOpen(false)}
                  className={({ isActive }) => {
                    const active =
                      isActive ||
                      (item.to === '/' &&
                        (location.pathname === '/' ||
                          location.pathname.startsWith('/schemes')))
                    return `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                      active
                        ? 'bg-sidebar-active text-sidebar-ink'
                        : 'text-sidebar-muted hover:bg-sidebar-active/60 hover:text-sidebar-ink'
                    }`
                  }}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </NavLink>
              )
            })}
          </nav>

          <div className="absolute bottom-0 left-0 right-0 space-y-2 border-t border-white/10 p-4">
            {user && (
              <div className="rounded-xl bg-white/5 px-3 py-2">
                <p className="truncate text-sm font-semibold text-sidebar-ink">
                  {user.name}
                </p>
                <p className="text-[11px] text-sidebar-muted">
                  {USER_ROLE_LABELS[user.role]} · @{user.username}
                </p>
              </div>
            )}
            <button
              type="button"
              onClick={handleLogout}
              className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm text-sidebar-muted hover:bg-sidebar-active hover:text-sidebar-ink"
            >
              <LogOut className="h-4 w-4" />
              Sign out
            </button>
          </div>
        </aside>

        {open && (
          <button
            type="button"
            aria-label="Close menu"
            className="fixed inset-0 z-30 bg-black/40 lg:hidden"
            onClick={() => setOpen(false)}
          />
        )}

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-line bg-surface/90 px-4 backdrop-blur sm:px-6">
            <button
              type="button"
              className="rounded-xl border border-line p-2 text-ink-muted hover:bg-surface-2 lg:hidden"
              onClick={() => setOpen(true)}
            >
              <Menu className="h-4 w-4" />
            </button>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-ink">
                Plotting Scheme Master
              </p>
              <p className="truncate text-xs text-ink-muted">
                {user
                  ? `Signed in as ${user.name}`
                  : 'Create and manage schemes before inventory & sales'}
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={toggleTheme}
              aria-label="Toggle theme"
            >
              {theme === 'dark' ? (
                <Sun className="h-4 w-4" />
              ) : (
                <Moon className="h-4 w-4" />
              )}
              <span className="hidden sm:inline">
                {theme === 'dark' ? 'Light' : 'Dark'}
              </span>
            </Button>
          </header>

          <main className="flex-1">{children}</main>
        </div>
      </div>
    </div>
  )
}
