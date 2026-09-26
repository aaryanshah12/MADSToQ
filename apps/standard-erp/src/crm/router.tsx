'use client'

import NextLink from 'next/link'
import {
  useParams as useNextParams,
  usePathname,
  useRouter,
  useSearchParams as useNextSearchParams,
} from 'next/navigation'
import { useEffect, type ComponentProps, type ReactNode } from 'react'

export const CRM_BASE = '/crm'

export function toHref(to: string): string {
  if (/^https?:\/\//.test(to) || to.startsWith('/portals/')) return to
  const hashIndex = to.indexOf('#')
  const hash = hashIndex >= 0 ? to.slice(hashIndex) : ''
  const withoutHash = hashIndex >= 0 ? to.slice(0, hashIndex) : to
  const queryIndex = withoutHash.indexOf('?')
  const query = queryIndex >= 0 ? withoutHash.slice(queryIndex) : ''
  const pathname = queryIndex >= 0 ? withoutHash.slice(0, queryIndex) : withoutHash
  const normalized = pathname.startsWith('/') ? pathname : `/${pathname}`
  const suffix = normalized === '/' ? '' : normalized
  return `${CRM_BASE}${suffix}${query}${hash}`
}

export function fromHref(pathname: string): string {
  if (pathname === CRM_BASE) return '/'
  if (pathname.startsWith(`${CRM_BASE}/`)) return pathname.slice(CRM_BASE.length)
  return pathname
}

type LinkProps = Omit<ComponentProps<typeof NextLink>, 'href'> & { to: string }

export function Link({ to, ...props }: LinkProps) {
  return <NextLink href={toHref(to)} {...props} />
}

export function NavLink({
  to,
  end,
  className,
  children,
  onClick,
}: {
  to: string
  end?: boolean
  className?: string | ((state: { isActive: boolean }) => string)
  children: ReactNode
  onClick?: () => void
}) {
  const { pathname } = useLocation()
  const isActive = end
    ? pathname === to
    : pathname === to || pathname.startsWith(`${to}/`)
  const cls = typeof className === 'function' ? className({ isActive }) : className
  return (
    <NextLink href={toHref(to)} className={cls} onClick={onClick}>
      {children}
    </NextLink>
  )
}

export function useLocation() {
  const pathname = usePathname()
  return { pathname: fromHref(pathname || CRM_BASE) }
}

export function useNavigate() {
  const router = useRouter()
  return (to: string, opts?: { replace?: boolean }) => {
    const href = toHref(to)
    if (opts?.replace) router.replace(href)
    else router.push(href)
  }
}

export function useParams(): { id?: string } {
  const params = useNextParams()
  const id = params.id
  return { id: Array.isArray(id) ? id[0] : id }
}

export function useSearchParams(): [
  URLSearchParams,
  (next: URLSearchParams | Record<string, string>) => void,
] {
  const current = useNextSearchParams()
  const pathname = usePathname()
  const router = useRouter()
  const params = new URLSearchParams(current.toString())
  const setParams = (next: URLSearchParams | Record<string, string>) => {
    const query =
      next instanceof URLSearchParams
        ? next
        : new URLSearchParams(
            Object.entries(next).filter((entry): entry is [string, string] =>
              Boolean(entry[1]),
            ),
          )
    const serialized = query.toString()
    router.replace(serialized ? `${pathname}?${serialized}` : pathname, {
      scroll: false,
    })
  }
  return [params, setParams]
}

export function Navigate({ to, replace }: { to: string; replace?: boolean }) {
  const router = useRouter()
  useEffect(() => {
    const href = toHref(to)
    if (replace) router.replace(href)
    else router.push(href)
  }, [replace, router, to])
  return null
}
