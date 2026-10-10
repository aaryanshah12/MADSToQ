'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { qcLabApi } from '@/lib/api'
import {
  logBookCell,
  logBookColumns,
  logBookTitle,
  parseInstrumentDocMeta,
  type LogBookEntryRow,
} from '@/lib/qc-log-book'
import { QcLogBookExportButton } from '@/components/inventory/QcLogBookExportButton'
import { QC_TYPE_LABEL } from '@/components/inventory/QcLabResultForm'
import { EmptyState, SpinnerBlock, useSmartFilter } from '@/components/ui'
import { MobileCard, MobileListToolbar, MobileTabs } from '@/components/inventory/MobileList'
import clsx from 'clsx'

type Instrument = {
  id: string
  code: string
  name: string
  type: string
  doc_meta?: unknown
}

type FactoryLetterhead = {
  name: string
  company_address?: string | null
  location?: string | null
}

type Entry = LogBookEntryRow & {
  instrument_type?: string | null
}

function instrumentTabLabel(inst: Instrument, all: Instrument[]) {
  const clash = all.filter((row) => row.type === inst.type).length > 1
  if (clash) return inst.code || QC_TYPE_LABEL[inst.type] || inst.name
  return QC_TYPE_LABEL[inst.type] || inst.name
}

export default function QcInstrumentLogBook({
  factoryId,
  rmQcHref,
  sfgQcHref,
  accent = 'chemist',
}: {
  factoryId: string
  rmQcHref: string
  sfgQcHref: string
  accent?: 'chemist' | 'owner'
}) {
  const [instruments, setInstruments] = useState<Instrument[]>([])
  const [instrumentId, setInstrumentId] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [factory, setFactory] = useState<FactoryLetterhead | null>(null)
  const [bookInstrument, setBookInstrument] = useState<Instrument | null>(null)
  const [entries, setEntries] = useState<Entry[]>([])
  const [loadingList, setLoadingList] = useState(true)
  const [loadingBook, setLoadingBook] = useState(false)
  const [error, setError] = useState('')
  const [sortCol, setSortCol] = useState<'entry_date' | 'sample_name'>('entry_date')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

  useEffect(() => {
    async function loadInstruments() {
      if (!factoryId) {
        setInstruments([])
        setInstrumentId('')
        setLoadingList(false)
        return
      }
      setLoadingList(true)
      setError('')
      const res = await qcLabApi.listInstruments(factoryId)
      if (res.error) {
        setError(res.error)
        setInstruments([])
        setInstrumentId('')
      } else {
        const list = (res.instruments ?? []) as Instrument[]
        setInstruments(list)
        setInstrumentId((prev) => (prev && list.some((i) => i.id === prev) ? prev : list[0]?.id || ''))
      }
      setLoadingList(false)
    }
    void loadInstruments()
  }, [factoryId])

  const reloadBook = useCallback(async () => {
    if (!factoryId || !instrumentId) {
      setEntries([])
      setFactory(null)
      setBookInstrument(null)
      setLoadingBook(false)
      return
    }
    setLoadingBook(true)
    setError('')
    const res = await qcLabApi.listLogBook(factoryId, instrumentId, {
      from: from || undefined,
      to: to || undefined,
    })
    if (res.error) {
      setError(res.error)
      setEntries([])
      setBookInstrument(null)
    } else {
      setFactory((res.factory ?? null) as FactoryLetterhead | null)
      setBookInstrument((res.instrument ?? null) as Instrument | null)
      setEntries((res.entries ?? []) as Entry[])
    }
    setLoadingBook(false)
  }, [factoryId, instrumentId, from, to])

  useEffect(() => {
    void reloadBook()
  }, [reloadBook])

  const selected = instruments.find((i) => i.id === instrumentId) || null
  const exportInstrument = bookInstrument || selected
  const columns = selected ? logBookColumns(selected.type) : []
  const meta = exportInstrument ? parseInstrumentDocMeta(exportInstrument.doc_meta) : {}
  const title = exportInstrument ? logBookTitle(exportInstrument) : 'Log book'
  const linkClass = accent === 'owner' ? 'text-owner hover:underline' : 'text-chemist hover:underline'
  const detailCols = columns.filter((col) => col.key !== 'entry_date' && col.key !== 'sample_name')
  const resultCol =
    columns.find((c) =>
      ['result_pct', 'result_c', 'density', 'percentage'].includes(c.key),
    ) ?? columns.find((c) => c.from === 'payload')

  const filter = useSmartFilter(entries, {
    getSearchText: (e) => [e.sample_name, e.subject_label, e.entry_date, e.remarks],
    facets: [],
  })

  const sorted = useMemo(() => {
    const dir = sortDir === 'asc' ? 1 : -1
    return [...filter.filtered].sort((a, b) => {
      const cmp =
        sortCol === 'sample_name'
          ? (a.sample_name ?? '').localeCompare(b.sample_name ?? '')
          : (a.entry_date ?? '').localeCompare(b.entry_date ?? '')
      return cmp * dir
    })
  }, [filter.filtered, sortCol, sortDir])

  function handleSort(col: 'entry_date' | 'sample_name') {
    if (sortCol === col) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortCol(col)
      setSortDir(col === 'entry_date' ? 'desc' : 'asc')
    }
  }

  function sampleHref(entry: Entry) {
    return entry.stage === 'rm' ? rmQcHref : sfgQcHref
  }

  return (
    <div>
      {loadingList ? (
        <SpinnerBlock accent={accent} label="Loading instruments" className="py-16" />
      ) : instruments.length === 0 ? (
        <p className="text-sm text-muted">No instruments for this factory.</p>
      ) : (
        <div>
          <MobileTabs
            ariaLabel="Lab log books"
            active={instrumentId}
            onChange={setInstrumentId}
            tabs={instruments.map((inst) => ({
              key: inst.id,
              label: instrumentTabLabel(inst, instruments),
            }))}
          />
          <div className="hidden md:block">
          <div className="folder-tabs" role="tablist" aria-label="Lab log books">
            {instruments.map((inst) => {
              const on = inst.id === instrumentId
              return (
                <button
                  key={inst.id}
                  type="button"
                  role="tab"
                  id={`log-book-tab-${inst.id}`}
                  aria-selected={on}
                  aria-controls={`log-book-panel-${inst.id}`}
                  className={on ? 'folder-tab is-active' : 'folder-tab'}
                  onClick={() => setInstrumentId(inst.id)}
                >
                  {inst.name}
                </button>
              )
            })}
          </div>
          </div>

          {selected && (
            <section
              id={`log-book-panel-${selected.id}`}
              role="tabpanel"
              aria-labelledby={`log-book-tab-${selected.id}`}
              className="p-0 md:folder-panel md:p-6"
            >
              <div className="md:hidden pb-20">
                <p className="mb-1 text-sm font-medium text-primary">{title}</p>
                <p className="mb-3 text-xs text-muted">
                  {selected.code}
                  {QC_TYPE_LABEL[selected.type] ? ` · ${QC_TYPE_LABEL[selected.type]}` : ''}
                </p>
                {error ? <p className="mb-3 text-sm text-red-600">{error}</p> : null}
                {loadingBook ? (
                  <SpinnerBlock accent={accent} size="md" label="Loading log book" className="py-12" />
                ) : (
                  <>
                    <MobileListToolbar
                      filter={filter}
                      placeholder="Search sample…"
                      dateFrom={from}
                      dateTo={to}
                      onDateChange={(nextFrom, nextTo) => {
                        setFrom(nextFrom)
                        setTo(nextTo)
                      }}
                      resultCount={sorted.length}
                      noun={{ one: 'entry', many: 'entries' }}
                      sortOptions={[
                        { col: 'entry_date', label: 'Date', kind: 'date' },
                        { col: 'sample_name', label: 'Sample', kind: 'text' },
                      ]}
                      sortCol={sortCol}
                      sortDir={sortDir}
                      onSort={handleSort}
                    />
                    {entries.length === 0 ? (
                      <EmptyState
                        className="rounded-xl bg-panel"
                        title="No QC entries"
                        description="No results on this instrument for the selected dates."
                      />
                    ) : sorted.length === 0 ? (
                      <EmptyState className="rounded-xl bg-panel" title="No entries match" />
                    ) : (
                      <div className="space-y-3 pb-20">
                        {sorted.map((entry) => {
                          const resultValue = resultCol ? logBookCell(entry, resultCol) : ''
                          return (
                            <MobileCard
                              key={entry.id}
                              id={logBookCell(entry, { key: 'entry_date', header: 'DATE', from: 'entry' })}
                              title={entry.sample_name || '—'}
                              subtitle={
                                entry.subject_label && entry.subject_label !== entry.sample_name
                                  ? entry.subject_label
                                  : undefined
                              }
                              aside={
                                resultValue ? (
                                  <>
                                    <span className="block text-base font-medium tabular-nums text-primary">
                                      {resultValue}
                                    </span>
                                    <span className="block text-[10px] uppercase tracking-wider text-muted">
                                      {resultCol?.header}
                                    </span>
                                  </>
                                ) : undefined
                              }
                              rows={detailCols
                                .filter((col) => col.key !== resultCol?.key)
                                .map((col) => ({
                                  label:
                                    col.key === 'water_factor_1'
                                      ? 'Water factor 1'
                                      : col.key === 'water_factor_2'
                                        ? 'Water factor 2'
                                        : col.key === 'water_factor_3'
                                          ? 'Water factor 3'
                                          : col.header,
                                  value: logBookCell(entry, col) || '—',
                                }))}
                              footer={
                                <Link href={sampleHref(entry)} className={`btn w-full border border-text bg-panel ${linkClass}`}>
                                  Open sample
                                </Link>
                              }
                            />
                          )
                        })}
                      </div>
                    )}
                  </>
                )}
                <QcLogBookExportButton
                  variant="fab"
                  factoryId={factoryId}
                  instruments={instruments}
                  initialFrom={from}
                  initialTo={to}
                />
              </div>

              <div className="hidden md:block">
              <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h2 className="font-display text-lg text-primary">{title}</h2>
                  <p className="text-xs text-muted">
                    Instrument ID: {selected.code}
                    {QC_TYPE_LABEL[selected.type] ? ` · ${QC_TYPE_LABEL[selected.type]}` : ''}
                    {meta.form_code ? ` · Form no: ${meta.form_code}` : ''}
                    {meta.annexure ? ` · Annexure: ${meta.annexure}` : ''}
                  </p>
                </div>
                <div className="flex flex-wrap items-end gap-2">
                  <label className="text-xs font-medium text-muted">
                    From
                    <input
                      type="date"
                      value={from}
                      onChange={(e) => setFrom(e.target.value)}
                      className="mt-1 block min-w-[11rem] rounded-lg border border-muted/80 bg-panel px-3 py-2 text-sm text-foreground shadow-sm outline-none focus:border-inputer focus:ring-2 focus:ring-highlight/70"
                    />
                  </label>
                  <label className="text-xs font-medium text-muted">
                    To
                    <input
                      type="date"
                      value={to}
                      onChange={(e) => setTo(e.target.value)}
                      className="mt-1 block min-w-[11rem] rounded-lg border border-muted/80 bg-panel px-3 py-2 text-sm text-foreground shadow-sm outline-none focus:border-inputer focus:ring-2 focus:ring-highlight/70"
                    />
                  </label>
                  <QcLogBookExportButton
                    factoryId={factoryId}
                    instruments={instruments}
                    initialFrom={from}
                    initialTo={to}
                  />
                </div>
              </div>

              {error ? <p className="mb-3 text-sm text-red-600">{error}</p> : null}

              {loadingBook ? (
                <SpinnerBlock accent={accent} size="md" label="Loading log book" className="py-12" />
              ) : entries.length === 0 ? (
                <p className="text-sm text-muted">No QC entries on this instrument for the selected dates.</p>
              ) : (
                <div className="table-panel">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[40rem] text-left text-sm">
                <thead>
                  {selected.type === 'karl_fisher' ? (
                    <>
                      <tr>
                        <th rowSpan={2} className="whitespace-nowrap px-3 py-2.5 font-semibold">DATE</th>
                        <th rowSpan={2} className="whitespace-nowrap px-3 py-2.5 font-semibold">SAMPLE NAME</th>
                        <th colSpan={3} className="whitespace-nowrap px-3 py-2.5 text-center font-semibold">WATER FACTOR</th>
                        <th rowSpan={2} className="whitespace-nowrap px-3 py-2.5 font-semibold">AVERGAE FACTOR</th>
                        <th rowSpan={2} className="whitespace-nowrap px-3 py-2.5 font-semibold">INJECT VOLUME (ml)</th>
                        <th rowSpan={2} className="whitespace-nowrap px-3 py-2.5 font-semibold">
                          DENSITY
                          <span className="block font-semibold">( W/V )</span>
                        </th>
                        <th rowSpan={2} className="whitespace-nowrap px-3 py-2.5 font-semibold">RESULT (%)</th>
                        <th rowSpan={2} className="whitespace-nowrap px-3 py-2.5 font-semibold">REMARK</th>
                      </tr>
                      <tr>
                        <th className="whitespace-nowrap px-3 py-1 text-center font-semibold">1</th>
                        <th className="whitespace-nowrap px-3 py-1 text-center font-semibold">2</th>
                        <th className="whitespace-nowrap px-3 py-1 text-center font-semibold">3</th>
                      </tr>
                    </>
                  ) : (
                    <tr>
                      {columns.map((col) => (
                        <th key={col.key} className="whitespace-nowrap px-3 py-2.5 font-semibold">
                          {col.header}
                        </th>
                      ))}
                    </tr>
                  )}
                </thead>
                <tbody>
                  {entries.map((entry) => (
                    <tr key={entry.id} className="border-b border-border/60 last:border-b-0 hover:bg-surface/40">
                      {columns.map((col) => {
                        const value = logBookCell(entry, col)
                        const isSample = col.key === 'sample_name'
                        return (
                          <td
                            key={col.key}
                            className={clsx(
                              'px-3 py-2 align-top',
                              col.from === 'payload' ? 'font-mono text-[12px] tabular-nums' : '',
                            )}
                          >
                            {isSample ? (
                              <Link href={sampleHref(entry)} className={linkClass}>
                                {value || '—'}
                                {entry.subject_label && entry.subject_label !== entry.sample_name ? (
                                  <span className="mt-0.5 block font-mono text-[10px] text-muted">
                                    {entry.subject_label}
                                  </span>
                                ) : null}
                              </Link>
                            ) : (
                              value || '—'
                            )}
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
                  </table>
                </div>
                </div>
              )}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  )
}
