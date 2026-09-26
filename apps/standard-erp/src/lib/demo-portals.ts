export const DEMO_PASSWORD = 'Demo@123'

export type DemoAccount = {
  role: string
  login: string
  password: string
}

export const DEMO_PORTALS = {
  inventory: {
    path: '/portals/demo/inventory',
    accounts: [
      { role: 'Owner', login: 'owner@factory.local', password: DEMO_PASSWORD },
      { role: 'Inputer', login: 'inputer@factory.local', password: DEMO_PASSWORD },
      { role: 'Chemist', login: 'chemist@factory.local', password: DEMO_PASSWORD },
    ],
  },
  'inward-outward': {
    path: '/portals/demo/inward-outward',
    accounts: [{ role: 'Owner', login: 'io@factory.local', password: DEMO_PASSWORD }],
  },
  pmc: {
    path: '/portals/demo/pmc',
    accounts: [{ role: 'PMC', login: 'pmc@factory.local', password: DEMO_PASSWORD }],
  },
  sales: {
    path: '/portals/demo/sales',
    accounts: [{ role: 'Sales', login: 'sales@factory.local', password: DEMO_PASSWORD }],
  },
  crm: {
    path: '/portals/demo/crm',
    accounts: [
      { role: 'Admin', login: 'admin', password: 'admin123' },
      { role: 'Sales', login: 'sales1', password: 'sales123' },
      { role: 'Accountant', login: 'accounts1', password: 'accounts123' },
    ],
  },
} as const satisfies Record<string, { path: string; accounts: DemoAccount[] }>
