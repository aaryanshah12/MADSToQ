'use client'

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'

export type IoFeaturesState = {
  domestic: boolean
  international: boolean
}

const DEFAULT: IoFeaturesState = { domestic: true, international: true }

const IoFeaturesContext = createContext<IoFeaturesState>(DEFAULT)

export function IoFeaturesProvider({ children }: { children: ReactNode }) {
  const [features, setFeatures] = useState<IoFeaturesState>(DEFAULT)

  useEffect(() => {
    let cancelled = false
    fetch('/api/io/features', { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : DEFAULT))
      .then((data) => {
        if (!cancelled) {
          setFeatures({
            domestic: Boolean(data.domestic),
            international: Boolean(data.international),
          })
        }
      })
      .catch(() => {
        if (!cancelled) setFeatures(DEFAULT)
      })
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <IoFeaturesContext.Provider value={features}>{children}</IoFeaturesContext.Provider>
  )
}

export function useIoFeatures() {
  return useContext(IoFeaturesContext)
}
