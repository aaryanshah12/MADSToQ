import { prisma, serializeStockEntry, moneyStr } from '@madstoq/database'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const {
      factory_id, invoice_number, supplier_name, material_type,
      tons_loaded, rate_per_ton, vehicle_number, driver_name,
      entry_date, notes, created_by
    } = body

    if (!factory_id || !invoice_number || !supplier_name || !material_type || !tons_loaded || !rate_per_ton || !created_by) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const entry = await prisma.stockEntry.create({
      data: {
        factoryId: factory_id,
        invoiceNumber: invoice_number,
        supplierName: supplier_name,
        materialType: material_type,
        tonsLoaded: Number(tons_loaded),
        ratePerTon: moneyStr(rate_per_ton),
        vehicleNumber: vehicle_number || null,
        driverName: driver_name || null,
        entryDate: new Date(entry_date || new Date().toISOString().split('T')[0]),
        notes: notes || null,
        createdBy: created_by,
      },
    })

    return NextResponse.json({ success: true, entry: serializeStockEntry(entry) })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  try {
    const { id, ...updates } = await request.json()
    if (!id) return NextResponse.json({ error: 'Entry ID required' }, { status: 400 })

    const data: Record<string, unknown> = {}
    if (updates.factory_id !== undefined) data.factoryId = updates.factory_id
    if (updates.invoice_number !== undefined) data.invoiceNumber = updates.invoice_number
    if (updates.supplier_name !== undefined) data.supplierName = updates.supplier_name
    if (updates.material_type !== undefined) data.materialType = updates.material_type
    if (updates.tons_loaded !== undefined) data.tonsLoaded = Number(updates.tons_loaded)
    if (updates.rate_per_ton !== undefined) data.ratePerTon = moneyStr(updates.rate_per_ton)
    if (updates.vehicle_number !== undefined) data.vehicleNumber = updates.vehicle_number
    if (updates.driver_name !== undefined) data.driverName = updates.driver_name
    if (updates.entry_date !== undefined) data.entryDate = new Date(updates.entry_date)
    if (updates.notes !== undefined) data.notes = updates.notes

    await prisma.stockEntry.update({ where: { id }, data })
    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const { id } = await request.json()
    if (!id) return NextResponse.json({ error: 'Entry ID required' }, { status: 400 })

    await prisma.stockEntry.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
