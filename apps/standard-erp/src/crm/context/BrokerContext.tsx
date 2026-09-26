import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { BrokerProfile, BrokerRecord } from '../types/sales'
import { loadBrokers, saveBrokers } from '../lib/brokers'
import { uid } from '../lib/schemes'

interface BrokerContextValue {
  brokers: BrokerRecord[]
  getBroker: (id: string) => BrokerRecord | undefined
  saveBroker: (input: BrokerProfile, id?: string) => BrokerRecord
  deleteBroker: (id: string) => void
}

const BrokerContext = createContext<BrokerContextValue | null>(null)

export function BrokerProvider({ children }: { children: ReactNode }) {
  const [brokers, setBrokers] = useState<BrokerRecord[]>([])

  useEffect(() => {
    setBrokers(loadBrokers())
  }, [])

  const persist = useCallback((next: BrokerRecord[]) => {
    setBrokers(next)
    saveBrokers(next)
  }, [])

  const getBroker = useCallback(
    (id: string) => brokers.find((b) => b.id === id),
    [brokers],
  )

  const saveBroker = useCallback(
    (input: BrokerProfile, id?: string): BrokerRecord => {
      const now = new Date().toISOString()
      const existing = id ? brokers.find((b) => b.id === id) : undefined
      const record: BrokerRecord = {
        ...input,
        id: existing?.id ?? uid(),
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
      }
      persist(
        existing
          ? brokers.map((b) => (b.id === existing.id ? record : b))
          : [record, ...brokers],
      )
      return record
    },
    [brokers, persist],
  )

  const deleteBroker = useCallback(
    (id: string) => persist(brokers.filter((b) => b.id !== id)),
    [brokers, persist],
  )

  const value = useMemo(
    () => ({ brokers, getBroker, saveBroker, deleteBroker }),
    [brokers, getBroker, saveBroker, deleteBroker],
  )

  return (
    <BrokerContext.Provider value={value}>{children}</BrokerContext.Provider>
  )
}

export function useBrokers() {
  const ctx = useContext(BrokerContext)
  if (!ctx) throw new Error('useBrokers must be used within BrokerProvider')
  return ctx
}
