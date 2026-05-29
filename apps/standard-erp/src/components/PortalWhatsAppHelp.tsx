'use client'

import { MessageCircle } from 'lucide-react'
import { buildWhatsAppHelpUrl } from '@/lib/whatsapp-help'

type PortalWhatsAppHelpProps = {
  /** Display name inserted into the pre-filled message, e.g. "PMC Portal". */
  portalName: string
  className?: string
}

const defaultClassName =
  'flex items-center gap-2 w-full px-3 py-2.5 rounded-lg text-sm text-muted hover:text-[#25D366] hover:bg-green-500/10 transition-all min-h-[44px]'

export function PortalWhatsAppHelp({ portalName, className }: PortalWhatsAppHelpProps) {
  return (
    <a
      href={buildWhatsAppHelpUrl(portalName)}
      target="_blank"
      rel="noopener noreferrer"
      className={className ?? defaultClassName}
      aria-label={`Contact support on WhatsApp about ${portalName}`}
    >
      <MessageCircle size={16} className="text-[#25D366] shrink-0" aria-hidden />
      WhatsApp support
    </a>
  )
}
