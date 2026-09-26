'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { usePathname } from 'next/navigation'
import { ThemeProvider } from './context/ThemeContext'
import { AuthProvider } from './context/AuthContext'
import { SchemeProvider } from './context/SchemeContext'
import { PlotProvider } from './context/PlotContext'
import { LeadProvider } from './context/LeadContext'
import { BookingProvider } from './context/BookingContext'
import { BrokerProvider } from './context/BrokerContext'
import { PaymentProvider } from './context/PaymentContext'
import { OtherPaymentProvider } from './context/OtherPaymentContext'
import { AppLayout } from './components/layout/AppLayout'
import { RequireAuth } from './components/RequireAuth'

function CrmFrame({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  if (pathname === '/crm/login') return children
  return (
    <RequireAuth>
      <AppLayout>{children}</AppLayout>
    </RequireAuth>
  )
}

export function CrmShell({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  return (
    <div className="crm-app min-h-screen bg-canvas text-ink">
      <ThemeProvider>
        <AuthProvider>
          <SchemeProvider>
            <PlotProvider>
              <LeadProvider>
                <BrokerProvider>
                  <BookingProvider>
                    <PaymentProvider>
                      <OtherPaymentProvider>
                        {mounted ? (
                          <CrmFrame>{children}</CrmFrame>
                        ) : (
                          <div className="min-h-screen bg-canvas" />
                        )}
                      </OtherPaymentProvider>
                    </PaymentProvider>
                  </BookingProvider>
                </BrokerProvider>
              </LeadProvider>
            </PlotProvider>
          </SchemeProvider>
        </AuthProvider>
      </ThemeProvider>
    </div>
  )
}
