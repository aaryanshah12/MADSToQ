'use client'

import type { IOLineItem, IOProduct } from '@madstoq/io-system/types'
import ProductComboSearch from '@/components/io/ProductComboSearch'
import { Plus, Trash2, ChevronDown, ChevronUp } from 'lucide-react'
import { IO_FIELD_LABEL, ioInputClass } from '@/components/io/io-form-styles'

type Props = {
  items: IOLineItem[]
  products: IOProduct[]
  showQuantity?: boolean
  expandedItemIndex: number
  onExpandedItemIndexChange: (index: number) => void
  onItemsChange: (updater: (prev: IOLineItem[]) => IOLineItem[]) => void
  onAddRow: () => void
  onOpenProductModal: (rowIndex: number) => void
  canAddRow: boolean
}

export default function IoOutwardStyleLineItems({
  items,
  products,
  showQuantity = false,
  expandedItemIndex,
  onExpandedItemIndexChange,
  onItemsChange,
  onAddRow,
  onOpenProductModal,
  canAddRow,
}: Props) {
  const setItem = (i: number, field: keyof IOLineItem, value: unknown) => {
    onItemsChange(prev => prev.map((it, idx) => (idx === i ? { ...it, [field]: value } : it)))
  }

  const removeItemRow = (index: number) => {
    onExpandedItemIndexChange(
      expandedItemIndex === index
        ? Math.max(0, index - 1)
        : expandedItemIndex > index
          ? expandedItemIndex - 1
          : expandedItemIndex,
    )
    onItemsChange(prev => prev.filter((_, j) => j !== index))
  }

  const desktopCols = showQuantity
    ? 'grid-cols-[minmax(0,2fr)_88px_120px_minmax(0,1.6fr)_44px]'
    : 'grid-cols-[minmax(0,2.4fr)_132px_minmax(0,2fr)_44px]'

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h3 className="text-sm font-semibold text-primary">Line Items</h3>
        <button
          type="button"
          onClick={onAddRow}
          disabled={!canAddRow}
          className="inline-flex items-center gap-1 px-1 py-1 text-xs font-medium text-inputer transition-colors hover:text-primary disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:text-inputer"
          title={canAddRow ? 'Add row' : 'Select a product before adding another row'}
        >
          <Plus size={12} /> Add Row
        </button>
      </div>

      <div className="mt-3 space-y-3 md:hidden">
        {items.map((it, i) => {
          const productName =
            it.product?.product_name ?? products.find(p => p.id === it.product_id)?.product_name
          const hasProduct = !!it.product_id
          const hasNotes = !!it.remarks?.trim()
          const itemIsComplete = hasProduct
          const isExpanded = expandedItemIndex === i
          return (
            <div
              key={i}
              className={`rounded-xl border bg-panel transition-colors ${isExpanded ? 'border-inputer/40' : 'border-border/60'}`}
            >
              <button
                type="button"
                onClick={() => onExpandedItemIndexChange(i)}
                className="flex w-full items-start justify-between gap-3 px-3 py-2.5 text-left"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-semibold uppercase tracking-wide text-muted">
                      Item {i + 1}
                    </span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${itemIsComplete ? 'bg-layer text-muted' : 'bg-inputer/10 text-inputer'}`}
                    >
                      {itemIsComplete ? 'Ready' : 'Incomplete'}
                    </span>
                  </div>
                  <div className="mt-1 truncate text-sm font-medium text-primary">
                    {productName || 'Choose product'}
                  </div>
                  {hasNotes && <div className="mt-1 text-xs text-muted">Note added</div>}
                </div>
                <div className="rounded-md p-1 text-muted">
                  {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </div>
              </button>

              {isExpanded && (
                <div className="border-t border-border/50 px-3 pb-3 pt-2.5">
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <div className="text-xs font-medium text-muted">Item details</div>
                    {items.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeItemRow(i)}
                        className="inline-flex h-8 items-center gap-1 rounded-md border border-red-500/20 px-2 text-xs font-medium text-red-400 transition-colors hover:bg-red-500/10"
                      >
                        <Trash2 size={12} /> Remove
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-1 gap-3">
                    <div>
                      <div className="mb-1 flex items-center justify-between gap-2">
                        <label className={IO_FIELD_LABEL}>
                          Product <span className="text-red-400">*</span>
                        </label>
                        <button
                          type="button"
                          onClick={() => onOpenProductModal(i)}
                          className="inline-flex items-center gap-1 px-1 py-1 text-[11px] font-medium text-inputer transition-colors hover:text-primary"
                        >
                          <Plus size={11} /> Add Product
                        </button>
                      </div>
                      <ProductComboSearch
                        products={products}
                        value={it.product_id}
                        onChange={v => setItem(i, 'product_id', v)}
                        placeholder="Search product"
                        className="flex-1"
                        inputClassName={ioInputClass()}
                      />
                    </div>
                    {showQuantity && (
                      <div>
                        <label className={`mb-1 block ${IO_FIELD_LABEL}`}>Qty (KGs)</label>
                        <input
                          type="number"
                          min={0}
                          value={it.quantity || ''}
                          placeholder="0"
                          onChange={e => setItem(i, 'quantity', parseFloat(e.target.value) || 0)}
                          className={`${ioInputClass()} text-right`}
                        />
                      </div>
                    )}
                    <div>
                      <label className={`mb-1 block ${IO_FIELD_LABEL}`}>Price</label>
                      <input
                        type="number"
                        min={0}
                        step="any"
                        value={it.price || ''}
                        placeholder="0"
                        onChange={e => setItem(i, 'price', parseFloat(e.target.value) || 0)}
                        className={`${ioInputClass()} text-right`}
                      />
                    </div>
                    <div>
                      <label className={`mb-1 block ${IO_FIELD_LABEL}`}>Product Remarks</label>
                      <input
                        value={it.remarks ?? ''}
                        onChange={e => setItem(i, 'remarks', e.target.value)}
                        placeholder="Remarks for products"
                        className={ioInputClass()}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      <div className={`hidden overflow-hidden rounded-2xl border border-border/60 bg-panel md:block`}>
        <div
          className={`grid ${desktopCols} gap-4 border-b border-border/60 px-4 py-3 text-xs font-semibold text-muted`}
        >
          <div>
            Product <span className="text-red-400">*</span>
          </div>
          {showQuantity && <div className="text-right">Qty</div>}
          <div className="text-right">Price</div>
          <div>Product Remarks</div>
          <div />
        </div>
        <div className="divide-y divide-border/60">
          {items.map((it, i) => (
            <div key={i} className={`grid ${desktopCols} items-center gap-4 px-4 py-3`}>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <ProductComboSearch
                    products={products}
                    value={it.product_id}
                    onChange={v => setItem(i, 'product_id', v)}
                    placeholder="— Product —"
                    className="min-w-0 flex-1"
                    inputClassName={ioInputClass()}
                  />
                  <button
                    type="button"
                    onClick={() => onOpenProductModal(i)}
                    className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-border/70 bg-panel text-inputer transition-colors hover:border-inputer/50 hover:bg-layer hover:text-primary"
                    aria-label={`Add product for item ${i + 1}`}
                    title="Add product"
                  >
                    <Plus size={16} />
                  </button>
                </div>
              </div>
              {showQuantity && (
                <div>
                  <input
                    type="number"
                    min={0}
                    value={it.quantity || ''}
                    placeholder="0"
                    onChange={e => setItem(i, 'quantity', parseFloat(e.target.value) || 0)}
                    className={`${ioInputClass()} text-right`}
                  />
                </div>
              )}
              <div>
                <input
                  type="number"
                  min={0}
                  step="any"
                  value={it.price || ''}
                  placeholder="0"
                  onChange={e => setItem(i, 'price', parseFloat(e.target.value) || 0)}
                  className={`${ioInputClass()} text-right`}
                />
              </div>
              <div>
                <input
                  value={it.remarks ?? ''}
                  onChange={e => setItem(i, 'remarks', e.target.value)}
                  placeholder="Remarks for products"
                  className={ioInputClass()}
                />
              </div>
              <div className="flex items-center justify-end">
                {items.length > 1 ? (
                  <button
                    type="button"
                    onClick={() => removeItemRow(i)}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-md text-muted transition-colors hover:bg-layer hover:text-red-400"
                    aria-label={`Remove item ${i + 1}`}
                  >
                    <Trash2 size={14} />
                  </button>
                ) : (
                  <div className="h-9 w-9" />
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
