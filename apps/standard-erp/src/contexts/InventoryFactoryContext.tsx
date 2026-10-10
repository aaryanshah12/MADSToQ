'use client'
import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { useAuth } from '@/hooks/useAuth'

interface FactoryItem {
  id: string
  name: string
}

interface InvFactoryCtx {
  factoryId: string
  setFactoryId: (id: string) => void
  factories: FactoryItem[]
}

const InventoryFactoryContext = createContext<InvFactoryCtx>({
  factoryId: '',
  setFactoryId: () => {},
  factories: [],
})

const STORAGE_KEY = 'inv-factory-id'

function readSavedFactoryId() {
  if (typeof window === 'undefined') return ''
  return localStorage.getItem(STORAGE_KEY) || ''
}

export function InventoryFactoryProvider({ children }: { children: ReactNode }) {
  const { profile } = useAuth()
  const factories = (profile?.factories ?? []) as FactoryItem[]
  const [factoryId, setFactoryIdState] = useState(readSavedFactoryId)

  useEffect(() => {
    if (factories.length === 0) {
      setFactoryIdState('')
      return
    }

    const saved = readSavedFactoryId()
    const valid = saved && factories.some((f) => f.id === saved)
    const next = valid ? saved : factories[0]!.id
    setFactoryIdState(next)
    localStorage.setItem(STORAGE_KEY, next)
  }, [profile])

  const setFactoryId = (id: string) => {
    if (!factories.some((f) => f.id === id)) return
    setFactoryIdState(id)
    localStorage.setItem(STORAGE_KEY, id)
  }

  return (
    <InventoryFactoryContext.Provider value={{ factoryId, setFactoryId, factories }}>
      {children}
    </InventoryFactoryContext.Provider>
  )
}

export const useInventoryFactory = () => useContext(InventoryFactoryContext)

/** Call this on sign-out to clear the saved factory */
export function clearInventoryFactory() {
  localStorage.removeItem(STORAGE_KEY)
}
