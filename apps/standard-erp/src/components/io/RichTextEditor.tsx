'use client'
import { useEffect, useRef } from 'react'
import {
  Bold, Italic, Underline, List, AlignLeft, AlignCenter, AlignRight,
} from 'lucide-react'

interface Props {
  value: string
  onChange: (val: string) => void
  placeholder?: string
  minHeight?: number
}

const TOOLS = [
  { cmd: 'bold',          icon: Bold,        title: 'Bold' },
  { cmd: 'italic',        icon: Italic,       title: 'Italic' },
  { cmd: 'underline',     icon: Underline,    title: 'Underline' },
  { cmd: 'separator' },
  { cmd: 'insertUnorderedList', icon: List,   title: 'Bullet list' },
  { cmd: 'separator' },
  { cmd: 'justifyLeft',   icon: AlignLeft,    title: 'Align left' },
  { cmd: 'justifyCenter', icon: AlignCenter,  title: 'Align center' },
  { cmd: 'justifyRight',  icon: AlignRight,   title: 'Align right' },
] as const

// Convert plain text with newlines + bullet markers → HTML for display
function textToHtml(text: string): string {
  if (!text) return ''
  // If it already looks like HTML (has tags), return as-is
  if (/<[a-z][\s\S]*>/i.test(text)) return text
  return text
    .split('\n')
    .map(line => {
      if (line.startsWith('* ')) return `<li>${line.slice(2)}</li>`
      return `<p>${line || '<br>'}</p>`
    })
    .join('')
    .replace(/(<li>.*<\/li>)+/g, match => `<ul>${match}</ul>`)
}

// Convert HTML back to plain-ish storage format
function htmlToText(html: string): string {
  return html
}

export default function RichTextEditor({ value, onChange, placeholder, minHeight = 100 }: Props) {
  const editorRef = useRef<HTMLDivElement>(null)
  const isInternalChange = useRef(false)

  // Sync external value → editor (only when value changes from outside)
  useEffect(() => {
    const el = editorRef.current
    if (!el) return
    const html = textToHtml(value)
    if (el.innerHTML !== html) {
      isInternalChange.current = true
      el.innerHTML = html
      isInternalChange.current = false
    }
  }, [value])

  function handleInput() {
    if (!editorRef.current || isInternalChange.current) return
    onChange(htmlToText(editorRef.current.innerHTML))
  }

  function exec(cmd: string) {
    document.execCommand(cmd, false)
    editorRef.current?.focus()
    handleInput()
  }

  function isActive(cmd: string) {
    try { return document.queryCommandState(cmd) } catch { return false }
  }

  return (
    <div className="border border-border rounded-xl overflow-hidden" style={{ background: 'var(--color-surface)' }}>
      {/* Toolbar */}
      <div className="flex items-center gap-0.5 px-2 py-1.5 border-b border-border flex-wrap" style={{ background: 'var(--color-panel)' }}>
        {TOOLS.map((tool, i) => {
          if (tool.cmd === 'separator') {
            return <div key={i} className="w-px h-4 mx-1" style={{ background: 'var(--color-border)' }}/>
          }
          const Icon = (tool as any).icon
          const active = isActive(tool.cmd as string)
          return (
            <button
              key={tool.cmd as string}
              type="button"
              title={(tool as any).title}
              onMouseDown={e => { e.preventDefault(); exec(tool.cmd as string) }}
              className={`p-1.5 rounded transition-all ${
                active
                  ? 'bg-inputer/20 text-inputer'
                  : 'text-muted hover:text-primary hover:bg-layer'
              }`}
            >
              <Icon size={13}/>
            </button>
          )
        })}
      </div>

      {/* Editable area */}
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        onInput={handleInput}
        data-placeholder={placeholder}
        style={{ minHeight, outline: 'none', padding: '10px 14px' }}
        className="text-sm text-primary leading-relaxed focus:ring-0 empty:before:content-[attr(data-placeholder)] empty:before:text-muted"
      />

    </div>
  )
}
