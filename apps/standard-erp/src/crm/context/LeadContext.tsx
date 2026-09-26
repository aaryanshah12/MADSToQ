import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { LeadFormInput, LeadRecord } from '../types/sales'
import { createEmptyLeadSourceDetails } from '../types/sales'
import { loadLeads, saveLeads } from '../lib/sales'
import { uid } from '../lib/schemes'

interface LeadContextValue {
  leads: LeadRecord[]
  getLead: (id: string) => LeadRecord | undefined
  getLeadsByScheme: (schemeId: string) => LeadRecord[]
  saveLead: (input: LeadFormInput, id?: string) => LeadRecord
  updateLead: (id: string, patch: Partial<LeadRecord>) => void
  deleteLead: (id: string) => void
}

const LeadContext = createContext<LeadContextValue | null>(null)

export function LeadProvider({ children }: { children: ReactNode }) {
  const [leads, setLeads] = useState<LeadRecord[]>([])

  useEffect(() => {
    setLeads(loadLeads())
  }, [])

  const persist = useCallback((next: LeadRecord[]) => {
    setLeads(next)
    saveLeads(next)
  }, [])

  const getLead = useCallback(
    (id: string) => leads.find((l) => l.id === id),
    [leads],
  )

  const getLeadsByScheme = useCallback(
    (schemeId: string) => leads.filter((l) => l.schemeId === schemeId),
    [leads],
  )

  const saveLead = useCallback(
    (input: LeadFormInput, id?: string): LeadRecord => {
      const now = new Date().toISOString()
      const existing = id ? leads.find((l) => l.id === id) : undefined
      const record: LeadRecord = {
        ...input,
        sourceDetails: createEmptyLeadSourceDetails(input.sourceDetails),
        followUpOn: input.followUpOn || null,
        followUpNote: input.followUpNote || '',
        lastContactedAt: input.lastContactedAt || null,
        lastContactedById: input.lastContactedById || null,
        lastContactedByName: input.lastContactedByName || '',
        lastContactNote: input.lastContactNote || '',
        id: existing?.id ?? uid(),
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
      }
      persist(
        existing
          ? leads.map((l) => (l.id === existing.id ? record : l))
          : [record, ...leads],
      )
      return record
    },
    [leads, persist],
  )

  const updateLead = useCallback(
    (id: string, patch: Partial<LeadRecord>) => {
      persist(
        leads.map((l) =>
          l.id === id
            ? { ...l, ...patch, updatedAt: new Date().toISOString() }
            : l,
        ),
      )
    },
    [leads, persist],
  )

  const deleteLead = useCallback(
    (id: string) => persist(leads.filter((l) => l.id !== id)),
    [leads, persist],
  )

  const value = useMemo(
    () => ({
      leads,
      getLead,
      getLeadsByScheme,
      saveLead,
      updateLead,
      deleteLead,
    }),
    [leads, getLead, getLeadsByScheme, saveLead, updateLead, deleteLead],
  )

  return <LeadContext.Provider value={value}>{children}</LeadContext.Provider>
}

export function useLeads() {
  const ctx = useContext(LeadContext)
  if (!ctx) throw new Error('useLeads must be used within LeadProvider')
  return ctx
}
