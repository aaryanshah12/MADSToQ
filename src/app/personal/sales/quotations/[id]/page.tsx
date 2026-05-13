'use client'
import { useParams } from 'next/navigation'
import DocEditor from '@/components/sales/DocEditor'

export default function QuotationEditorPage() {
  const { id } = useParams<{ id: string }>()
  return <DocEditor docType="quotation" docId={id}/>
}
