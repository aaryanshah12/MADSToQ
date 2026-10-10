'use client'

import { useState } from 'react'
import { Download } from 'lucide-react'
import { productionApi } from '@/lib/api'
import {
  exportProductionRegisterToXlsx,
  type ExportProductGroup,
} from '@/lib/export-production-batch'

export async function downloadProductionRegister(opts: {
  factoryId: string
  productId?: string
  fileStem?: string
}): Promise<string | null> {
  const data = await productionApi.exportBatches(opts.factoryId, opts.productId)
  if (data.error) return data.error
  const products = (data.products ?? []) as ExportProductGroup[]
  if (products.length === 0) return 'No production batches to export.'
  const factoryStem = String(data.factory_name || '')
    .trim()
    .replace(/[^\w.-]+/g, '_')
    .replace(/_+/g, '_')
    .slice(0, 40)
  const productCode = products.length === 1 ? products[0].product.code : ''
  const stem =
    opts.fileStem ||
    (opts.productId && productCode
      ? `${productCode}_production-record`
      : factoryStem
        ? `${factoryStem}_production-record`
        : 'production-record')
  await exportProductionRegisterToXlsx({ products, fileStem: stem })
  return null
}

export function ProductionRecordExportButton({
  factoryId,
  productId,
  disabled,
  className,
}: {
  factoryId: string
  productId?: string
  disabled?: boolean
  className?: string
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function onClick() {
    if (!factoryId || busy) return
    setBusy(true)
    setError('')
    try {
      const err = await downloadProductionRegister({ factoryId, productId })
      if (err) setError(err)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Export failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <span className="inline-flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={() => void onClick()}
        disabled={disabled || busy || !factoryId}
        className={
          className ||
          'inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-1.5 text-sm text-foreground hover:bg-muted/40 disabled:cursor-not-allowed disabled:opacity-50'
        }
      >
        <Download size={14} />
        {busy ? 'Exporting…' : 'Export Excel'}
      </button>
      {error ? <span className="max-w-[16rem] text-xs text-red-600">{error}</span> : null}
    </span>
  )
}
