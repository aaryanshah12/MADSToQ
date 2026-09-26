import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { SchemeFormData, SchemePublishStatus, SchemeRecord } from '../types/scheme'
import { generateSchemeCode, loadSchemes, saveSchemes, uid } from '../lib/schemes'

interface SchemeContextValue {
  schemes: SchemeRecord[]
  getScheme: (id: string) => SchemeRecord | undefined
  saveScheme: (
    data: SchemeFormData,
    publishStatus: SchemePublishStatus,
    id?: string,
  ) => SchemeRecord
  deleteScheme: (id: string) => void
  nextSchemeCode: () => string
}

const SchemeContext = createContext<SchemeContextValue | null>(null)

export function SchemeProvider({ children }: { children: ReactNode }) {
  const [schemes, setSchemes] = useState<SchemeRecord[]>([])

  useEffect(() => {
    setSchemes(loadSchemes())
  }, [])

  const persist = useCallback((next: SchemeRecord[]) => {
    setSchemes(next)
    saveSchemes(next)
  }, [])

  const getScheme = useCallback(
    (id: string) => schemes.find((s) => s.id === id),
    [schemes],
  )

  const nextSchemeCode = useCallback(
    () => generateSchemeCode(schemes),
    [schemes],
  )

  const saveScheme = useCallback(
    (
      data: SchemeFormData,
      publishStatus: SchemePublishStatus,
      id?: string,
    ): SchemeRecord => {
      const now = new Date().toISOString()
      const existing = id ? schemes.find((s) => s.id === id) : undefined

      const record: SchemeRecord = {
        ...data,
        id: existing?.id ?? uid(),
        publishStatus,
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
        schemeCode: data.schemeCode || generateSchemeCode(schemes),
      }

      const next = existing
        ? schemes.map((s) => (s.id === existing.id ? record : s))
        : [record, ...schemes]

      persist(next)
      return record
    },
    [persist, schemes],
  )

  const deleteScheme = useCallback(
    (id: string) => {
      persist(schemes.filter((s) => s.id !== id))
    },
    [persist, schemes],
  )

  const value = useMemo(
    () => ({
      schemes,
      getScheme,
      saveScheme,
      deleteScheme,
      nextSchemeCode,
    }),
    [schemes, getScheme, saveScheme, deleteScheme, nextSchemeCode],
  )

  return (
    <SchemeContext.Provider value={value}>{children}</SchemeContext.Provider>
  )
}

export function useSchemes() {
  const ctx = useContext(SchemeContext)
  if (!ctx) throw new Error('useSchemes must be used within SchemeProvider')
  return ctx
}
