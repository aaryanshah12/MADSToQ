import {
  LEAD_SOURCE_LABELS,
  LEAD_STATUS_LABELS,
  createEmptyLeadSourceDetails,
  leadSourceSummary,
  type LeadRecord,
  type LeadSource,
  type LeadStatus,
} from '../types/sales'

export type LeadSmartQuery = {
  textTokens: string[]
  status?: LeadStatus
  source?: LeadSource
  plot?: string
  due?: 'today' | 'overdue' | 'upcoming' | 'any'
}

const STATUS_ALIASES: Record<string, LeadStatus> = {
  new: 'new',
  contacted: 'contacted',
  contact: 'contacted',
  site_visit: 'site_visit',
  sitevisit: 'site_visit',
  visit: 'site_visit',
  negotiation: 'negotiation',
  negotiate: 'negotiation',
  converted: 'converted',
  booked: 'converted',
  lost: 'lost',
}

const SOURCE_ALIASES: Record<string, LeadSource> = {
  walk_in: 'walk_in',
  walkin: 'walk_in',
  walk: 'walk_in',
  referral: 'referral',
  referred: 'referral',
  website: 'website',
  web: 'website',
  social: 'social',
  broker: 'broker',
  other: 'other',
}

const DUE_ALIASES: Record<string, LeadSmartQuery['due']> = {
  today: 'today',
  overdue: 'overdue',
  upcoming: 'upcoming',
  due: 'any',
  followup: 'any',
  reminder: 'any',
}

/** Parse smart search: status:new, source:referral, plot:43, due:today */
export function parseLeadSmartQuery(raw: string): LeadSmartQuery {
  const result: LeadSmartQuery = { textTokens: [] }
  const input = raw.trim()
  if (!input) return result

  const parts = input.match(/(?:[^\s"]+|"[^"]*")+/g) || []
  for (const part of parts) {
    const token = part.replace(/^"|"$/g, '').trim()
    if (!token) continue

    const statusMatch = token.match(/^status:(.+)$/i)
    if (statusMatch) {
      const s = STATUS_ALIASES[statusMatch[1].toLowerCase().replace(/\s+/g, '_')]
      if (s) result.status = s
      continue
    }

    const sourceMatch = token.match(/^source:(.+)$/i)
    if (sourceMatch) {
      const s =
        SOURCE_ALIASES[sourceMatch[1].toLowerCase().replace(/[\s-]+/g, '_')]
      if (s) result.source = s
      continue
    }

    const plotMatch = token.match(/^(?:plot:|#)(.+)$/i)
    if (plotMatch) {
      result.plot = plotMatch[1].trim()
      continue
    }

    const dueMatch = token.match(/^(?:due|followup|reminder):(.+)$/i)
    if (dueMatch) {
      const d = DUE_ALIASES[dueMatch[1].toLowerCase()]
      if (d) result.due = d
      continue
    }

    const bareStatus = STATUS_ALIASES[token.toLowerCase().replace(/\s+/g, '_')]
    if (bareStatus && !result.status) {
      result.status = bareStatus
      continue
    }

    const bareSource =
      SOURCE_ALIASES[token.toLowerCase().replace(/[\s-]+/g, '_')]
    if (bareSource && !result.source) {
      result.source = bareSource
      continue
    }

    if (DUE_ALIASES[token.toLowerCase()] && !result.due) {
      result.due = DUE_ALIASES[token.toLowerCase()]
      continue
    }

    result.textTokens.push(token.toLowerCase())
  }

  const loosePlot = input.match(/\bplot\s*[:=\s]\s*([a-z0-9/-]+)/i)
  if (loosePlot && !result.plot) result.plot = loosePlot[1]

  return result
}

export function leadSearchHaystack(
  lead: LeadRecord,
  schemeName: string,
  plotLabel: string,
): string {
  const details = lead.sourceDetails || createEmptyLeadSourceDetails()
  return [
    lead.name,
    lead.phone,
    lead.email,
    lead.notes,
    schemeName,
    plotLabel,
    LEAD_STATUS_LABELS[lead.status],
    LEAD_SOURCE_LABELS[lead.source],
    leadSourceSummary(lead.source, details),
    details.referredByName,
    details.referredByPhone,
    details.brokerName,
    details.walkInLocation,
    details.walkInAttendedBy,
    details.websitePage,
    details.socialHandle,
    details.otherDetail,
    lead.followUpOn || '',
    lead.followUpNote || '',
    lead.lastContactedByName || '',
    lead.lastContactNote || '',
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
}
