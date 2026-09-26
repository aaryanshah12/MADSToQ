import { FileUp, Trash2 } from 'lucide-react'
import type { Dispatch, SetStateAction } from 'react'
import {
  DOCUMENT_KEYS,
  DOCUMENT_LABELS,
  type DocumentKey,
  type SchemeFormData,
  type UploadedFileMeta,
} from '../../../types/scheme'
import { Button, Card } from '../../ui/Form'

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function StepDocuments({
  form,
  setForm,
}: {
  form: SchemeFormData
  setForm: Dispatch<SetStateAction<SchemeFormData>>
}) {
  const setDoc = (key: DocumentKey, file: UploadedFileMeta | null) =>
    setForm((prev) => ({
      ...prev,
      documents: { ...prev.documents, [key]: file },
    }))

  const onFile = (key: DocumentKey, fileList: FileList | null) => {
    const file = fileList?.[0]
    if (!file) return
    setDoc(key, {
      name: file.name,
      size: file.size,
      type: file.type,
      uploadedAt: new Date().toISOString(),
    })
  }

  return (
    <Card
      title="Documents"
      description="Upload compliance and sales documents. Files are stored as metadata in this demo."
    >
      <div className="grid gap-3">
        {DOCUMENT_KEYS.map((key) => {
          const meta = form.documents[key]
          return (
            <div
              key={key}
              className="flex flex-col gap-3 rounded-xl border border-line bg-surface-2/50 p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <p className="text-sm font-semibold text-ink">
                  {DOCUMENT_LABELS[key]}
                </p>
                {meta ? (
                  <p className="mt-1 text-xs text-ink-muted">
                    {meta.name} · {formatSize(meta.size)}
                  </p>
                ) : (
                  <p className="mt-1 text-xs text-ink-faint">No file uploaded</p>
                )}
              </div>
              <div className="flex items-center gap-2">
                {meta && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setDoc(key, null)}
                  >
                    <Trash2 className="h-4 w-4" />
                    Remove
                  </Button>
                )}
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-line-strong bg-surface px-3 py-2 text-sm font-semibold text-ink hover:bg-surface">
                  <FileUp className="h-4 w-4" />
                  {meta ? 'Replace' : 'Upload'}
                  <input
                    type="file"
                    className="hidden"
                    accept=".pdf,.png,.jpg,.jpeg,.doc,.docx,.xls,.xlsx"
                    onChange={(e) => {
                      onFile(key, e.target.files)
                      e.target.value = ''
                    }}
                  />
                </label>
              </div>
            </div>
          )
        })}
      </div>
    </Card>
  )
}
