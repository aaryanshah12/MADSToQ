'use client'

import Link from 'next/link'
import clsx from 'clsx'
import { usePMCData } from '@/contexts/PMCContext'
import type { PMCProduct } from '@madstoq/pmc-system/types'
import { PmcSimpleModal } from '@/components/pmc/PmcSimpleModal'

type ProductMaterialsViewModalProps = {
  product: PMCProduct | null
  onClose: () => void
}

export function ProductMaterialsViewModal({ product, onClose }: ProductMaterialsViewModalProps) {
  const { api: pmcApi } = usePMCData()
  if (!product) return null

  const lines = pmcApi.getProductRecipeLines(product.id)

  return (
    <PmcSimpleModal
      wide
      title={product.name}
      onClose={onClose}
      footer={
        <>
          <button type="button" onClick={onClose} className="btn btn-ghost">
            Close
          </button>
          <Link href={`/pmc/products/${product.id}`} className="btn btn-pmc">
            RMC sheet
          </Link>
        </>
      }
    >
      {product.code && (
        <p className="text-xs text-muted font-mono mb-4">{product.code}</p>
      )}
      {lines.length === 0 ? (
        <p className="text-sm text-muted">
          No raw materials assigned yet.{' '}
          <Link href={`/pmc/master/products/${product.id}`} className="text-pmc hover:underline">
            Edit recipe
          </Link>
        </p>
      ) : (
        <div className="pmc-table-wrap mx-0 px-0">
          <table className="data-table w-full text-sm">
            <thead>
              <tr>
                <th>Raw material</th>
                <th className="text-right">Quantity</th>
                <th>Unit</th>
                <th>Primary</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line, i) => (
                <tr
                  key={`${line.raw_material_name}-${i}`}
                  className={clsx(line.is_primary && 'bg-pmc-10')}
                >
                  <td className="font-medium">{line.raw_material_name}</td>
                  <td className="text-right font-mono tabular-nums">{line.qty}</td>
                  <td className="text-muted">{line.unit}</td>
                  <td>{line.is_primary ? 'Yes' : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </PmcSimpleModal>
  )
}
