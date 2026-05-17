'use client'
import { useParams } from 'next/navigation'
import DocEditor from '@/components/sales/DocEditor'

export default function PurchaseOrderEditorPage() {
  const { id } = useParams<{ id: string }>()
  return <DocEditor docType="purchase_order" docId={id}/>
}
