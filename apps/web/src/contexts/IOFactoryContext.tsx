'use client'
import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useAuth } from '@/hooks/useAuth'

export interface IOFactoryItem {
  id: string
  name: string
  location?: string | null
}

interface IOFactoryCtx {
  factoryId: string
  setFactoryId: (id: string) => void
  factories: IOFactoryItem[]
}

const IOFactoryContext = createContext<IOFactoryCtx>({
  factoryId: '',
  setFactoryId: () => {},
  factories: [],
})

export function IOFactoryProvider({ children }: { children: ReactNode }) {
  const { profile } = useAuth()
  const factories = (profile?.factories ?? []) as IOFactoryItem[]
  const [factoryId, setFactoryIdState] = useState('')
  const [showPicker, setShowPicker] = useState(false)
  const [pickerSelected, setPickerSelected] = useState('')

  useEffect(() => {
    if (factories.length === 0) return

    if (factories.length === 1) {
      setFactoryIdState(factories[0].id)
      localStorage.setItem('io-factory-id', factories[0].id)
      return
    }

    const saved = localStorage.getItem('io-factory-id')
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
    localStorage.setItem('io-factory-id', id)
  }

  const handlePickerContinue = () => {
    setFactoryId(pickerSelected)
    setShowPicker(false)
  }

  return (
    <IOFactoryContext.Provider value={{ factoryId, setFactoryId, factories }}>
      {showPicker && <FactoryPickerModal
        factories={factories}
        selected={pickerSelected}
        onSelect={setPickerSelected}
        onContinue={handlePickerContinue}
        accentVar="var(--color-inputer)"
      />}
      {children}
    </IOFactoryContext.Provider>
  )
}

export const useIOFactory = () => useContext(IOFactoryContext)

/* ── Shared Modal Component ──────────────────────────────── */
export function FactoryPickerModal({
  factories,
  selected,
  onSelect,
  onContinue,
  accentVar = 'var(--color-inputer)',
}: {
  factories: { id: string; name: string }[]
  selected: string
  onSelect: (id: string) => void
  onContinue: () => void
  accentVar?: string
}) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])
  if (!mounted) return null

  const isMobile = typeof window !== 'undefined' && window.innerWidth < 640

  const modal = (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 99999,
      display: 'flex',
      alignItems: isMobile ? 'flex-end' : 'center',
      justifyContent: 'center',
      background: 'rgba(0,0,0,0.7)',
      backdropFilter: 'blur(6px)',
      WebkitBackdropFilter: 'blur(6px)',
    }}>
      <div style={{
        width: '100%',
        maxWidth: '420px',
        margin: '0 16px',
        borderRadius: isMobile ? '20px 20px 0 0' : '20px',
        overflow: 'hidden',
        boxShadow: '0 25px 60px rgba(0,0,0,0.4)',
        background: 'var(--color-panel)',
        border: '1px solid var(--color-border)',
      }}>

        {/* Header */}
        <div style={{
          padding: '32px 28px 24px',
          textAlign: 'center',
          borderBottom: '1px solid var(--color-border)',
        }}>
          <div style={{
            width: 64, height: 64,
            borderRadius: 16,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 16px',
            fontSize: 28,
            background: accentVar,
            boxShadow: `0 8px 24px color-mix(in srgb, ${accentVar} 35%, transparent)`,
          }}>🏭</div>

          <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--color-text)', marginBottom: 6 }}>
            Select Factory
          </div>
          <div style={{ fontSize: 13, color: 'var(--color-muted)' }}>
            Choose the factory you wish to work in
          </div>
        </div>

        {/* Body */}
        <div style={{ padding: '24px 28px 28px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <div style={{
              fontSize: 10, fontFamily: 'monospace', letterSpacing: '0.1em',
              textTransform: 'uppercase', color: 'var(--color-muted)', marginBottom: 8,
            }}>Factory</div>

            <div style={{ position: 'relative' }}>
              <select
                value={selected}
                onChange={e => onSelect(e.target.value)}
                style={{
                  width: '100%',
                  appearance: 'none',
                  WebkitAppearance: 'none',
                  padding: '12px 40px 12px 16px',
                  borderRadius: 12,
                  border: `1.5px solid ${accentVar}`,
                  background: 'var(--color-surface)',
                  color: 'var(--color-text)',
                  fontSize: 14,
                  fontWeight: 500,
                  outline: 'none',
                  cursor: 'pointer',
                  boxShadow: `0 0 0 3px color-mix(in srgb, ${accentVar} 15%, transparent)`,
                }}
              >
                {factories.map(f => (
                  <option key={f.id} value={f.id}>{f.name}</option>
                ))}
              </select>
              <svg
                style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: accentVar }}
                width="16" height="16" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
              >
                <polyline points="6 9 12 15 18 9"/>
              </svg>
            </div>
          </div>

          <button
            onClick={onContinue}
            style={{
              width: '100%',
              padding: '14px',
              borderRadius: 12,
              border: 'none',
              background: accentVar,
              color: '#fff',
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer',
              letterSpacing: '0.02em',
              boxShadow: `0 4px 16px color-mix(in srgb, ${accentVar} 40%, transparent)`,
              transition: 'opacity 0.15s',
            }}
            onMouseEnter={e => (e.currentTarget.style.opacity = '0.88')}
            onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
          >
            Continue
          </button>
        </div>
      </div>
    </div>
  )

  return createPortal(modal, document.body)
}
