'use client'
import { useEffect, useRef, useState } from 'react'
import { Bell, Check, CheckCheck } from 'lucide-react'
import { useSalesUser } from '@/contexts/SalesUserContext'
import {
  fetchNotifications, markNotificationRead, markAllNotificationsRead, fmtDate,
} from '@madstoq/sales-system/api'
import type { SalesNotification } from '@madstoq/sales-system/types'
import { supabase } from '@/lib/supabase'

const POLL_MS = 30_000

export default function NotificationBell() {
  const { org } = useSalesUser()
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<SalesNotification[]>([])
  const [loading, setLoading] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const rtChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)

  const unread = items.filter(i => !i.is_read).length

  const load = async () => {
    if (!org) return
    setLoading(true)
    try {
      const ns = await fetchNotifications(org.id)
      setItems(ns)
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }

  // Initial load + polling.
  useEffect(() => {
    if (!org) return
    load()
    const t = setInterval(load, POLL_MS)
    return () => clearInterval(t)
  }, [org?.id])

  // Realtime — best-effort. If the Supabase project doesn't have realtime
  // enabled for this table, the polling above still keeps the bell fresh.
  useEffect(() => {
    if (!org) return
    if (rtChannelRef.current) {
      supabase.removeChannel(rtChannelRef.current)
      rtChannelRef.current = null
    }

    const channelName =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? `sales-notifications-${org.id}-${crypto.randomUUID()}`
        : `sales-notifications-${org.id}-${Date.now()}`

    const channel = supabase.channel(channelName)
    rtChannelRef.current = channel

    channel.on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'sales_notifications', filter: `org_id=eq.${org.id}` },
      () => load(),
    )

    channel.subscribe()

    return () => {
      if (rtChannelRef.current) {
        supabase.removeChannel(rtChannelRef.current)
        rtChannelRef.current = null
      }
    }
  }, [org?.id])

  // Close on outside click.
  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  const handleClick = async (n: SalesNotification) => {
    if (!n.is_read) {
      try { await markNotificationRead(n.id) } catch {}
      setItems(prev => prev.map(p => p.id === n.id ? { ...p, is_read: true } : p))
    }
    if (n.link_url) window.location.href = n.link_url
  }

  const handleMarkAll = async () => {
    if (!org) return
    try { await markAllNotificationsRead(org.id) } catch {}
    setItems(prev => prev.map(p => ({ ...p, is_read: true })))
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        className="relative p-2 rounded-lg border border-border bg-layer-sm text-muted hover:text-primary transition-colors"
        aria-label="Notifications"
      >
        <Bell size={16}/>
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>
      {open && (
        <div
          className="absolute right-0 top-full mt-2 w-80 max-w-[90vw] rounded-xl border border-border shadow-2xl overflow-hidden z-50"
          style={{ background: 'var(--color-panel)' }}
        >
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <div className="text-sm font-semibold text-primary">Notifications</div>
            {unread > 0 && (
              <button onClick={handleMarkAll} className="flex items-center gap-1 text-[11px] text-owner hover:underline">
                <CheckCheck size={12}/> Mark all read
              </button>
            )}
          </div>
          <div className="max-h-[420px] overflow-y-auto">
            {loading && items.length === 0 && (
              <div className="p-6 text-center text-xs text-muted">Loading…</div>
            )}
            {!loading && items.length === 0 && (
              <div className="p-6 text-center text-xs text-muted">You&apos;re all caught up.</div>
            )}
            {items.map(n => (
              <button
                key={n.id}
                onClick={() => handleClick(n)}
                className={`w-full text-left px-4 py-3 border-b border-border last:border-0 transition-colors hover:bg-layer-sm ${n.is_read ? '' : 'bg-owner/5'}`}
              >
                <div className="flex items-start gap-2">
                  {!n.is_read && <div className="w-2 h-2 rounded-full bg-owner mt-1.5 flex-shrink-0"/>}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-primary truncate">{n.title}</div>
                    {n.body && <div className="text-xs text-muted mt-0.5 line-clamp-2">{n.body}</div>}
                    <div className="text-[10px] font-mono text-muted mt-1 uppercase tracking-widest">{fmtDate(n.created_at)}</div>
                  </div>
                  {n.is_read && <Check size={12} className="text-muted flex-shrink-0 mt-1"/>}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
