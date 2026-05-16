'use client'

import Link from 'next/link'

const LINKS = [
  {
    href: '/pmc/master/raw-materials',
    title: 'Raw materials',
    desc: 'Maintain the list of raw materials used in product recipes.',
  },
  {
    href: '/pmc/master/products',
    title: 'Products & recipes',
    desc: 'Add products and link each product to raw materials with quantities.',
  },
]

export default function PMCMasterPage() {
  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-primary">Master</h1>
        <p className="text-sm text-muted mt-1">Setup raw materials and product bill of materials</p>
      </div>
      <ul className="grid gap-4">
        {LINKS.map((item) => (
          <li key={item.href}>
            <Link
              href={item.href}
              className="block bg-panel border border-border rounded-xl p-5 hover:border-[var(--color-pmc)] transition-colors"
            >
              <h2 className="font-semibold text-primary">{item.title}</h2>
              <p className="text-sm text-muted mt-1">{item.desc}</p>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
