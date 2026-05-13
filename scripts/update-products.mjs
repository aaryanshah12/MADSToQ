import fs from 'fs'

const file = 'C:/Users/Aryan/Desktop/Inventory_web-App/src/app/page.tsx'
let code = fs.readFileSync(file, 'utf8')

// Replace the tbody content and add search + zoom
const oldTbody = `              <tbody>
                {products.map((p, idx) => {
                  const StructComp = structures[p.sr]
                  return (
                    <tr key={idx} className={idx % 2 === 0 ? 'bg-slate-50' : 'bg-white'}>
                      <td className="border border-gray-200 px-3 py-3 font-semibold text-slate-900 text-center">{p.sr}</td>
                      <td className="border border-gray-200 px-3 py-3">
                        <div className="font-bold text-slate-900 text-xs md:text-sm">{p.name}</div>
                        <div className="text-xs text-gray-500 mt-0.5">{p.fullname}</div>
                      </td>
                      <td className="border border-gray-200 px-3 py-3 text-slate-900 text-xs font-mono">{p.mw}</td>
                      <td className="border border-gray-200 px-3 py-3 text-slate-900 text-xs font-mono">{p.cas}</td>
                      <td className="border border-gray-200 px-3 py-3 text-center">
                        <span className={\`inline-block px-2 py-1 rounded-full text-xs font-bold \${
                          parseInt(p.purity) >= 90 ? 'bg-green-100 text-green-700' :
                          parseInt(p.purity) >= 75 ? 'bg-blue-100 text-blue-700' :
                          p.purity === '-' ? 'bg-gray-100 text-gray-500' :
                          'bg-yellow-100 text-yellow-700'
                        }\`}>{p.purity}</span>
                      </td>
                      <td className="border border-gray-200 px-2 py-2 text-center">
                        <div className="flex items-center justify-center">
                          {StructComp ? <StructComp /> : <span className="text-gray-400 text-xs italic">Complex</span>}
                        </div>
                      </td>
                      <td className="border border-gray-200 px-3 py-3 text-center">
                        <button onClick={() => setInquiryProduct(p)}
                          className="bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white text-xs font-bold py-2 px-4 rounded-lg transition-all duration-200 whitespace-nowrap shadow-sm hover:shadow-md">
                          Inquire
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>`

const newTbody = `              <tbody>
                {(() => {
                  const q = productSearch.toLowerCase()
                  const filtered = q ? products.filter(p => p.name.toLowerCase().includes(q) || p.fullname.toLowerCase().includes(q) || p.cas.includes(q)) : products
                  if (filtered.length === 0) return <tr><td colSpan={7} className="py-12 text-center text-gray-400 italic">No products match your search.</td></tr>
                  return filtered.map((p, idx) => {
                    const structSrc = \`/structures/product-\${p.sr}.png\`
                    return (
                      <tr key={p.sr} className={\`transition-colors duration-150 \${idx % 2 === 0 ? 'bg-slate-50' : 'bg-white'} hover:bg-blue-50\`}>
                        <td className="border border-gray-200 px-3 py-3 font-semibold text-slate-900 text-center">{p.sr}</td>
                        <td className="border border-gray-200 px-3 py-3">
                          <div className="font-bold text-slate-900 text-xs md:text-sm">{p.name}</div>
                          <div className="text-xs text-gray-500 mt-0.5">{p.fullname}</div>
                        </td>
                        <td className="border border-gray-200 px-3 py-3 text-slate-900 text-xs font-mono">{p.mw}</td>
                        <td className="border border-gray-200 px-3 py-3 text-slate-900 text-xs font-mono">{p.cas}</td>
                        <td className="border border-gray-200 px-3 py-3 text-center">
                          <span className={\`inline-block px-2 py-1 rounded-full text-xs font-bold \${parseInt(p.purity) >= 90 ? 'bg-green-100 text-green-700' : parseInt(p.purity) >= 75 ? 'bg-blue-100 text-blue-700' : p.purity === '-' ? 'bg-gray-100 text-gray-500' : 'bg-yellow-100 text-yellow-700'}\`}>{p.purity}</span>
                        </td>
                        <td className="border border-gray-200 px-2 py-2 text-center">
                          <button onClick={() => setZoomStructure({ src: structSrc, name: p.name })} className="group relative inline-block hover:scale-110 transition-transform duration-200 cursor-zoom-in">
                            <img src={structSrc} alt={\`\${p.name} structure\`} className="w-20 h-16 object-contain mx-auto" onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
                            <span className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-[10px] font-bold text-blue-600 bg-blue-50/80 rounded">&#128269; Zoom</span>
                          </button>
                        </td>
                        <td className="border border-gray-200 px-3 py-3 text-center">
                          <button onClick={() => setInquiryProduct(p)} className="bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white text-xs font-bold py-2 px-4 rounded-lg transition-all duration-200 whitespace-nowrap shadow-sm hover:shadow-md active:scale-95">
                            Inquire
                          </button>
                        </td>
                      </tr>
                    )
                  })
                })()}
              </tbody>`

// Also add search bar before table and update mb-10 to mb-6
code = code.replace(
  `<p className="text-center text-gray-700 max-w-2xl mx-auto mb-10">17 premium intermediates for dyes, pigments & specialty chemicals.</p>
          <div className="overflow-x-auto rounded-xl shadow-lg">`,
  `<p className="text-center text-gray-700 max-w-2xl mx-auto mb-6">17 premium intermediates for dyes, pigments & specialty chemicals.</p>
          <div className="max-w-md mx-auto mb-8 relative">
            <input type="text" placeholder="Search by name or CAS No…" value={productSearch} onChange={e => setProductSearch(e.target.value)}
              className="w-full pl-10 pr-10 py-3 border-2 border-gray-200 rounded-xl text-sm focus:outline-none focus:border-teal-500 transition-colors shadow-sm" />
            <svg className="absolute left-3 top-3.5 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            {productSearch && <button onClick={() => setProductSearch('')} className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-700 text-xl font-bold">&times;</button>}
          </div>
          <div className="overflow-x-auto rounded-xl shadow-lg">`
)

// Replace tbody
if (!code.includes(oldTbody.trim().slice(0, 50))) {
  console.error('OLD TBODY NOT FOUND'); process.exit(1)
}
code = code.replace(oldTbody, newTbody)

// Add zoom modal before closing ProductsPage
const zoomModal = `
      {zoomStructure && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 px-4" onClick={() => setZoomStructure(null)}>
          <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-sm w-full text-center" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-black text-slate-900 mb-4">{zoomStructure.name}</h3>
            <img src={zoomStructure.src} alt={zoomStructure.name} className="w-full object-contain max-h-64 mx-auto" />
            <button onClick={() => setZoomStructure(null)} className="mt-6 bg-slate-900 text-white font-bold py-2 px-8 rounded-lg hover:bg-slate-700 transition-colors">Close</button>
          </div>
        </div>
      )}`

code = code.replace(
  `    </div>
  )

  const InfrastructurePage`,
  `${zoomModal}
    </div>
  )

  const InfrastructurePage`
)

fs.writeFileSync(file, code)
console.log('done')
