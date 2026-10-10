'use client'

import { useEffect, useState } from 'react'
import AppLayout from '@/components/layout/AppLayout'
import PageHeader from '@madstoq/ui/erp-page-header'
import { useAuth } from '@/hooks/useAuth'
import { useInventoryFactory } from '@/contexts/InventoryFactoryContext'
import { procurementApi, qcLabApi } from '@/lib/api'
import ProcurementReceiptsBrowser, {
  type ProcurementReceiptRow,
} from '@/components/inventory/ProcurementReceiptsBrowser'
import { QcRmStickerDrawer } from '@/components/inventory/QcStickerPrint'
import { printRmQcSticker } from '@/lib/qc-sticker-print'
import type { RmQcStickerData } from '@/lib/qc-sticker'
import { useToast } from '@/components/providers/ToastProvider'

export default function AccountantReceiptsPage() {
  const { profile, loading: authLoading } = useAuth()
  const toast = useToast()
  const { factoryId: ctxFactoryId } = useInventoryFactory()
  const factoryId = ctxFactoryId || profile?.factories?.[0]?.id || ''
  const [receipts, setReceipts] = useState<ProcurementReceiptRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [stickerReceipt, setStickerReceipt] = useState<ProcurementReceiptRow | null>(null)
  const [stickerSaving, setStickerSaving] = useState(false)
  const [stickerLogs, setStickerLogs] = useState<Array<{ instrument_type?: string | null; payload?: unknown }>>([])

  async function reload() {
    if (!factoryId) {
      setReceipts([])
      setLoading(false)
      return
    }
    setLoading(true)
    setError('')
    const res = await procurementApi.listReceipts(factoryId)
    if (res.error) setError(res.error)
    setReceipts((res.receipts ?? []) as ProcurementReceiptRow[])
    setLoading(false)
  }

  useEffect(() => {
    if (authLoading) return
    void reload()
  }, [authLoading, factoryId])

  useEffect(() => {
    if (!stickerReceipt || !factoryId) {
      setStickerLogs([])
      return
    }
    void qcLabApi.listLogs(factoryId, [stickerReceipt.id], 'rm').then((res) => {
      setStickerLogs((res.entries ?? []) as Array<{ instrument_type?: string | null; payload?: unknown }>)
    })
  }, [stickerReceipt, factoryId])

  async function printRmSticker(sticker: RmQcStickerData) {
    if (!stickerReceipt) return false
    setStickerSaving(true)
    const result = await procurementApi.printRmSticker({ id: stickerReceipt.id, sticker })
    setStickerSaving(false)
    if (result.error) {
      toast.error(result.error)
      return false
    }
    printRmQcSticker({
      ...sticker,
      purity:
        (result.receipt?.sticker_data as RmQcStickerData | undefined)?.purity || sticker.purity,
    })
    setStickerReceipt(null)
    await reload()
    return true
  }

  return (
    <AppLayout>
      <div className="w-full space-y-6 p-4 md:p-8">
        <div className="hidden lg:block">
          <PageHeader
            title="Receipts"
            subtitle="Accountant · receive history, discounted accepts, and vendor returns"
            accent="accountant"
          />
        </div>
        <ProcurementReceiptsBrowser
          receipts={receipts}
          loading={loading}
          error={error}
          accent="accountant"
          factoryId={factoryId}
          onPrintSticker={setStickerReceipt}
        />
      </div>
      {stickerReceipt ? (
        <QcRmStickerDrawer
          receipt={stickerReceipt}
          logs={stickerLogs}
          factoryId={factoryId}
          saving={stickerSaving}
          onClose={() => setStickerReceipt(null)}
          onPrint={printRmSticker}
        />
      ) : null}
    </AppLayout>
  )
}
