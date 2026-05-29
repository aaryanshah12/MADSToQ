'use client'

import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { FactoryPickerModal, type IOFactoryItem } from '@/contexts/IOFactoryContext'

const STORAGE_KEY = 'pmc-factory-id'

interface PMCFactoryCtx {
  factoryId: string
  setFactoryId: (id: string) => void
  factories: IOFactoryItem[]
  factoriesLoading: boolean
}

const PMCFactoryContext = createContext<PMCFactoryCtx>({
  factoryId: '',
  setFactoryId: () => {},
  factories: [],
  factoriesLoading: true,
})

export function PMCFactoryProvider({ children }: { children: ReactNode }) {
  const { profile, loading: authLoading } = useAuth()
  const factories = (profile?.factories ?? []) as IOFactoryItem[]
  const [factoryId, setFactoryIdState] = useState('')
  const [showPicker, setShowPicker] = useState(false)
  const [pickerSelected, setPickerSelected] = useState('')

  useEffect(() => {
    if (authLoading) return
    if (factories.length === 0) {
      setFactoryIdState('')
      return
    }

    if (factories.length === 1) {
      setFactoryIdState(factories[0].id)
      localStorage.setItem(STORAGE_KEY, factories[0].id)
      return
    }

    const saved = localStorage.getItem(STORAGE_KEY)
    const valid = saved && factories.some((f) => f.id === saved)
    if (valid) {
      setFactoryIdState(saved!)
    } else {
      setPickerSelected(factories[0].id)
      setShowPicker(true)
    }
  }, [authLoading, profile, factories])

  const setFactoryId = (id: string) => {
    setFactoryIdState(id)
    localStorage.setItem(STORAGE_KEY, id)
  }

  const handlePickerContinue = () => {
    setFactoryId(pickerSelected)
    setShowPicker(false)
  }

  const factoryName = factories.find((f) => f.id === factoryId)?.name

  return (
    <PMCFactoryContext.Provider
      value={{
        factoryId,
        setFactoryId,
        factories,
        factoriesLoading: authLoading,
      }}
    >
      {showPicker && (
        <FactoryPickerModal
          factories={factories}
          selected={pickerSelected}
          onSelect={setPickerSelected}
          onContinue={handlePickerContinue}
          accentVar="var(--color-pmc)"
        />
      )}
      {children}
      {factoryId && factories.length > 1 && (
        <div className="hidden" data-pmc-factory={factoryId} data-pmc-factory-name={factoryName} />
      )}
    </PMCFactoryContext.Provider>
  )
}

export const usePMCFactory = () => useContext(PMCFactoryContext)
