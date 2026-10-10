import { prisma, serializeProcurementPo } from '@madstoq/database'
import { NextResponse } from 'next/server'
import { sendProcurementPoEmail } from '@/lib/email/procurement-po-mailer'
import { orderToProcurementPoHtmlData } from '@/lib/procurement-po-from-order'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/**
 * Email an existing issued PO to the vendor.
 * Sets shared_with=['vendor'] + shared_at on success.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const orderId = typeof body.order_id === 'string' ? body.order_id.trim() : ''
    if (!orderId) {
      return NextResponse.json({ error: 'order_id is required' }, { status: 400 })
    }

    const order = await prisma.procurementPurchaseOrder.findUnique({
      where: { id: orderId },
      include: { factory: true, supplier: true },
    })
    if (!order) {
      return NextResponse.json({ error: 'Purchase order not found' }, { status: 404 })
    }

    const toOverride =
      typeof body.to_email === 'string' ? body.to_email.trim().toLowerCase() : ''
    const to =
      toOverride ||
      (order.vendorEmail || '').trim().toLowerCase() ||
      (order.supplier?.email || '').trim().toLowerCase()

    if (!to || !EMAIL_RE.test(to)) {
      return NextResponse.json(
        { error: 'Vendor email is required — set it on the vendor or pass to_email' },
        { status: 400 },
      )
    }

    const doc = orderToProcurementPoHtmlData(order)
    doc.vendorEmail = to

    // Prefer client snapshot when provided (matches what owner reviewed)
    const raw = body.po_document
    if (raw && typeof raw === 'object') {
      const o = raw as Record<string, unknown>
      const str = (k: string) => (typeof o[k] === 'string' ? String(o[k]).trim() : '')
      if (str('companyName')) doc.companyName = str('companyName')
      if (str('companyAddress')) doc.companyAddress = str('companyAddress')
      if (str('companyGstin')) doc.companyGstin = str('companyGstin')
      if (str('companyPan')) doc.companyPan = str('companyPan')
      if (str('billTo')) doc.billTo = str('billTo')
      if (str('shipTo')) doc.shipTo = str('shipTo')
      if (str('vendorAddress')) doc.vendorAddress = str('vendorAddress')
      if (str('vendorGstin')) doc.vendorGstin = str('vendorGstin')
      if (str('lineRemarks')) doc.lineRemarks = str('lineRemarks')
      if (str('qualityRef')) doc.qualityRef = str('qualityRef')
      if (str('specialInstructions')) doc.specialInstructions = str('specialInstructions')
      if (str('deliverySchedule')) doc.deliverySchedule = str('deliverySchedule')
      if (str('deliveryPlace')) doc.deliveryPlace = str('deliveryPlace')
      if (str('scheduleDate')) doc.scheduleDate = str('scheduleDate')
      if (str('transporter')) doc.transporter = str('transporter')
      if (str('logoUrl')) doc.logoUrl = str('logoUrl')
      if (str('factoryId')) doc.factoryId = str('factoryId')
      if (typeof o.igstRate === 'number') doc.igstRate = o.igstRate
    }
    doc.poNumber = order.poNumber
    doc.vendorEmail = to

    const mail = await sendProcurementPoEmail({ to, data: doc })

    const updated = await prisma.procurementPurchaseOrder.update({
      where: { id: order.id },
      data: {
        vendorEmail: to,
        sharedWith: ['vendor'],
        sharedAt: new Date(),
      },
    })

    return NextResponse.json({
      success: true,
      order: serializeProcurementPo(updated),
      email_sent: mail.sent,
      email_dev_logged: Boolean(mail.devLogged),
      emailed_to: to,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
