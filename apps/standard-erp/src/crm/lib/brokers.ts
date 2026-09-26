import { browserStorage } from './storage'
import type { BrokerRecord } from '../types/sales'

const KEY = 'plotcrm.brokers.v1'

export function loadBrokers(): BrokerRecord[] {
  try {
    const raw = browserStorage()?.getItem(KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as BrokerRecord[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function saveBrokers(brokers: BrokerRecord[]): void {
  browserStorage()?.setItem(KEY, JSON.stringify(brokers))
}
