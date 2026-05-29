/** India country code + 10-digit mobile (no + or spaces). */
export const WHATSAPP_HELP_NUMBER = '918347270090'

export function whatsAppHelpMessage(portalName: string): string {
  return `Hey, I need help with your ${portalName}`
}

export function buildWhatsAppHelpUrl(portalName: string): string {
  return `https://wa.me/${WHATSAPP_HELP_NUMBER}?text=${encodeURIComponent(whatsAppHelpMessage(portalName))}`
}
