'use client'
import { createContext, useContext, useEffect, useState, ReactNode } from 'react'

export type Theme = 'dark' | 'light'

const THEME_KEY = 'theme'
const LEGACY_THEME_KEYS = ['pmc-theme', 'io-theme', 'sales-theme']

interface ThemeContextType {
  theme: Theme
  toggleTheme: () => void
}

const ThemeContext = createContext<ThemeContextType>({ theme: 'light', toggleTheme: () => {} })

export function readStoredTheme(): Theme {
  if (typeof window === 'undefined') return 'light'
  const saved = localStorage.getItem(THEME_KEY)
  if (saved === 'dark' || saved === 'light') return saved
  for (const key of LEGACY_THEME_KEYS) {
    const legacy = localStorage.getItem(key)
    if (legacy === 'dark' || legacy === 'light') return legacy
  }
  return 'light'
}

export function persistTheme(theme: Theme) {
  localStorage.setItem(THEME_KEY, theme)
  for (const key of LEGACY_THEME_KEYS) localStorage.removeItem(key)
  document.documentElement.dataset.theme = theme
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>('light')

  useEffect(() => {
    const initial = readStoredTheme()
    setTheme(initial)
    persistTheme(initial)
  }, [])

  function toggleTheme() {
    setTheme(prev => {
      const next = prev === 'dark' ? 'light' : 'dark'
      persistTheme(next)
      return next
    })
  }

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export const useTheme = () => useContext(ThemeContext)
