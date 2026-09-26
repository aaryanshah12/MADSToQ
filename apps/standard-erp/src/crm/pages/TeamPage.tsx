import { useMemo, useState } from 'react'
import { Mail, Phone, Search, UsersRound } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { USER_ROLE_LABELS, type UserRole } from '../types/auth'
import { Card, Input } from '../components/ui/Form'

const ROLE_ORDER: UserRole[] = ['admin', 'sales', 'accountant']

export function TeamPage() {
  const { user, users } = useAuth()
  const [query, setQuery] = useState('')
  const [roleFilter, setRoleFilter] = useState<'all' | UserRole>('all')

  const directory = useMemo(() => {
    const q = query.trim().toLowerCase()
    return users
      .filter((u) => u.active)
      .filter((u) => (roleFilter === 'all' ? true : u.role === roleFilter))
      .filter((u) => {
        if (!q) return true
        const hay = [
          u.name,
          u.username,
          u.phone,
          u.email,
          u.whatsapp,
          USER_ROLE_LABELS[u.role],
        ]
          .join(' ')
          .toLowerCase()
        return hay.includes(q)
      })
      .sort((a, b) => {
        const roleCmp =
          ROLE_ORDER.indexOf(a.role) - ROLE_ORDER.indexOf(b.role)
        if (roleCmp !== 0) return roleCmp
        return a.name.localeCompare(b.name)
      })
  }, [users, query, roleFilter])

  const counts = useMemo(() => {
    const active = users.filter((u) => u.active)
    return {
      all: active.length,
      admin: active.filter((u) => u.role === 'admin').length,
      sales: active.filter((u) => u.role === 'sales').length,
      accountant: active.filter((u) => u.role === 'accountant').length,
    }
  }, [users])

  return (
    <div className="mx-auto max-w-5xl space-y-5 px-4 py-6 sm:px-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand">
          Directory
        </p>
        <h1 className="mt-1 font-display text-3xl tracking-tight text-ink">
          Team
        </h1>
        <p className="mt-1.5 max-w-2xl text-sm text-ink-muted">
          One place for sales, accounts, and admin contact details. Admin
          updates these under Users.
        </p>
      </div>

      <div className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative min-w-0 flex-1 sm:max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" />
          <Input
            className="pl-9"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name, phone, email…"
          />
        </div>
        <div
          className="inline-flex flex-wrap rounded-xl bg-surface-2 p-1"
          role="tablist"
          aria-label="Filter by role"
        >
          {(
            [
              { id: 'all' as const, label: 'All', count: counts.all },
              { id: 'admin' as const, label: 'Admin', count: counts.admin },
              { id: 'sales' as const, label: 'Sales', count: counts.sales },
              {
                id: 'accountant' as const,
                label: 'Accounts',
                count: counts.accountant,
              },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={roleFilter === tab.id}
              onClick={() => setRoleFilter(tab.id)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                roleFilter === tab.id
                  ? 'bg-surface text-ink shadow-sm'
                  : 'text-ink-muted hover:text-ink'
              }`}
            >
              {tab.label}
              <span className="ml-1 tabular-nums text-ink-faint">
                {tab.count}
              </span>
            </button>
          ))}
        </div>
      </div>

      {directory.length === 0 ? (
        <Card>
          <div className="py-10 text-center">
            <UsersRound className="mx-auto h-10 w-10 text-ink-faint" />
            <p className="mt-3 text-sm font-semibold text-ink">No matches</p>
            <p className="mt-1 text-xs text-ink-muted">
              Ask an admin to add phone and email on user profiles.
            </p>
          </div>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {directory.map((member) => {
            const whatsapp = member.whatsapp || member.phone
            return (
              <article
                key={member.id}
                className="rounded-2xl border border-line bg-surface p-4 shadow-[0_1px_0_rgba(21,36,31,0.04)]"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-base font-semibold text-ink">
                      {member.name}
                      {member.id === user?.id && (
                        <span className="ml-2 text-[11px] font-medium text-brand">
                          you
                        </span>
                      )}
                    </h2>
                    <p className="mt-0.5 text-xs text-ink-muted">
                      {USER_ROLE_LABELS[member.role]} · @{member.username}
                    </p>
                  </div>
                  <span className="rounded-lg bg-surface-2 px-2 py-1 text-[11px] font-semibold text-ink-muted">
                    {USER_ROLE_LABELS[member.role]}
                  </span>
                </div>

                <dl className="mt-4 space-y-2.5">
                  <div className="flex items-center gap-2 text-sm">
                    <Phone className="h-3.5 w-3.5 shrink-0 text-ink-faint" />
                    {member.phone ? (
                      <a
                        href={`tel:${member.phone}`}
                        className="font-medium tabular-nums text-ink hover:text-brand"
                      >
                        {member.phone}
                      </a>
                    ) : (
                      <span className="text-ink-faint">No phone</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Mail className="h-3.5 w-3.5 shrink-0 text-ink-faint" />
                    {member.email ? (
                      <a
                        href={`mailto:${member.email}`}
                        className="truncate font-medium text-ink hover:text-brand"
                      >
                        {member.email}
                      </a>
                    ) : (
                      <span className="text-ink-faint">No email</span>
                    )}
                  </div>
                  {whatsapp ? (
                    <div className="pt-1">
                      <a
                        href={`https://wa.me/${whatsapp.replace(/\D/g, '')}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs font-semibold text-brand hover:underline"
                      >
                        WhatsApp {whatsapp}
                      </a>
                    </div>
                  ) : null}
                </dl>
              </article>
            )
          })}
        </div>
      )}
    </div>
  )
}
