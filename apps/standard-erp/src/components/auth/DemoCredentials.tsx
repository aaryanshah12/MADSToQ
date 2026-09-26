import type { DemoAccount } from '@/lib/demo-portals'

export default function DemoCredentials({
  accounts,
  tone = 'portal',
}: {
  accounts: readonly DemoAccount[]
  tone?: 'portal' | 'crm'
}) {
  if (tone === 'crm') {
    return (
      <div className="rounded-2xl border border-line bg-surface-2/50 px-4 py-3 text-xs text-ink-muted">
        <p className="font-semibold text-ink">Demo sign-in</p>
        <ul className="mt-2 space-y-1">
          {accounts.map((account) => (
            <li key={account.login}>
              {account.login} / {account.password} · {account.role}
            </li>
          ))}
        </ul>
      </div>
    )
  }

  return (
    <div className="mt-6 border-t border-border pt-6">
      <p className="mb-3 text-center font-mono text-[10px] uppercase tracking-widest text-muted">
        Demo sign-in
      </p>
      <ul className="space-y-2">
        {accounts.map((account) => (
          <li key={account.login} className="text-center text-xs" style={{ color: 'var(--color-text)' }}>
            <span className="text-muted">{account.role}</span>
            <span className="mx-1.5 text-muted">·</span>
            <span className="font-mono">{account.login}</span>
            <span className="mx-1.5 text-muted">/</span>
            <span className="font-mono">{account.password}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
