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
    <div className="pmc-page max-w-3xl">
      <div>
        <h1 className="pmc-page-title">Master</h1>
        <p className="text-sm text-muted mt-1">Setup raw materials and product bill of materials</p>
      </div>
      <ul className="grid gap-4">
        {LINKS.map((item) => (
          <li key={item.href}>
            <Link
              href={item.href}
              className="block pmc-card hover:border-pmc/40 transition-colors"
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
