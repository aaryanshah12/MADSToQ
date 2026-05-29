'use client'

import { MessageCircle } from 'lucide-react'
import { buildWhatsAppHelpUrl } from '@/lib/whatsapp-help'

type PortalWhatsAppHelpProps = {
  /** Display name inserted into the pre-filled message, e.g. "PMC Portal". */
  portalName: string
}

export function PortalWhatsAppHelp({ portalName }: PortalWhatsAppHelpProps) {
  return (
    <a
      href={buildWhatsAppHelpUrl(portalName)}
      target="_blank"
      rel="noopener noreferrer"
      className="fixed z-50 flex items-center justify-center w-14 h-14 rounded-full bg-[#25D366] text-white shadow-lg shadow-black/20 hover:bg-[#20bd5a] hover:scale-105 active:scale-95 transition-all"
      style={{
        bottom: 'max(1.25rem, env(safe-area-inset-bottom))',
        right: 'max(1.25rem, env(safe-area-inset-right))',
      }}
      title="WhatsApp support"
      aria-label={`Contact support on WhatsApp about ${portalName}`}
    >
      <MessageCircle size={28} strokeWidth={1.75} aria-hidden />
    </a>
  )
}
