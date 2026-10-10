'use client'

import { useCallback, useState } from 'react'
import { qcLabApi } from '@/lib/api'
import type { QcLogEntry } from '@/components/inventory/QcLabResultForm'
import QcResultsTable from '@/components/inventory/QcResultsTable'

export function useQcSubjectLogs(
  factoryId: string | undefined,
  stage: 'rm' | 'fg' | undefined,
) {
  const enabled = Boolean(factoryId && stage)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [logsById, setLogsById] = useState<Record<string, QcLogEntry[]>>({})
  const [loadingId, setLoadingId] = useState<string | null>(null)

  const toggle = useCallback(
    async (id: string) => {
      if (expandedId === id) {
        setExpandedId(null)
        return
      }
      setExpandedId(id)
      if (!factoryId || !stage || logsById[id]) return
      setLoadingId(id)
      try {
        const res = await qcLabApi.listLogs(factoryId, id, stage)
        setLogsById((prev) => ({
          ...prev,
          [id]: (res.entries ?? []) as QcLogEntry[],
        }))
      } finally {
        setLoadingId(null)
      }
    },
    [expandedId, factoryId, stage, logsById],
  )

  return { enabled, expandedId, logsById, loadingId, toggle }
}

export function QcHistoryResultsPanel({
  logs,
  loading,
}: {
  logs: QcLogEntry[] | undefined
  loading: boolean
}) {
  if (loading) return <p className="text-sm text-muted">Loading results…</p>
  return (
    <div className="space-y-2">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted">
        Lab results · {logs?.length ?? 0}
      </p>
      <QcResultsTable logs={logs ?? []} />
    </div>
  )
}
