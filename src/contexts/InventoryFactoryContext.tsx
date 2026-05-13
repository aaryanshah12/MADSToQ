'use client'
import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { FactoryPickerModal } from './IOFactoryContext'

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

export function InventoryFactoryProvider({ children }: { children: ReactNode }) {
  const { profile } = useAuth()
  const factories = (profile?.factories ?? []) as FactoryItem[]
  const [factoryId, setFactoryIdState] = useState('')
  const [showPicker, setShowPicker] = useState(false)
  const [pickerSelected, setPickerSelected] = useState('')

  useEffect(() => {
    if (factories.length === 0) return

    if (factories.length === 1) {
      setFactoryIdState(factories[0].id)
      localStorage.setItem(STORAGE_KEY, factories[0].id)
      return
    }

    const saved = localStorage.getItem(STORAGE_KEY)
    const valid = saved && factories.some(f => f.id === saved)
    if (valid) {
      setFactoryIdState(saved!)
    } else {
      setPickerSelected(factories[0].id)
      setShowPicker(true)
    }
  }, [profile])

  const setFactoryId = (id: string) => {
    setFactoryIdState(id)
    localStorage.setItem(STORAGE_KEY, id)
  }

  const handleContinue = () => {
    setFactoryId(pickerSelected)
    setShowPicker(false)
  }

  // Accent color based on role
  const role = profile?.role ?? 'owner'
  const accentVar =
    role === 'owner'   ? 'var(--color-owner)'   :
    role === 'inputer' ? 'var(--color-inputer)' :
                         'var(--color-chemist)'

  return (
    <InventoryFactoryContext.Provider value={{ factoryId, setFactoryId, factories }}>
      {showPicker && (
        <FactoryPickerModal
          factories={factories}
          selected={pickerSelected}
          onSelect={setPickerSelected}
          onContinue={handleContinue}
          accentVar={accentVar}
        />
      )}
      {children}
    </InventoryFactoryContext.Provider>
  )
}

export const useInventoryFactory = () => useContext(InventoryFactoryContext)

/** Call this on sign-out to clear the saved factory */
export function clearInventoryFactory() {
  localStorage.removeItem('inv-factory-id')
}
